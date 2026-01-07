#!/usr/bin/env python3
import argparse
import json
import logging

import numpy as np

from .BrillouinZone import BrillouinZoneData
from .PlaneOptimizer import PlaneOptimizer
from .bxsf import parse_bxsf

logger = logging.getLogger(__name__)


def get_band_indices_around_fermi(band_ranges, fermi_energy, num_bands):
    """
    Select bands based on:
    * (highest priority) their midpoint if they cross Fermi level;
    * their maximum if they're below Fermi level;
    * their minimum if they're above Fermi level.
    """
    crossing_distances = []
    other_distances = []

    for i, (emin, emax) in enumerate(band_ranges):
        if emin <= fermi_energy <= emax:
            ref_energy = 0.5 * (emin + emax)
            dist = abs(ref_energy - fermi_energy)
            crossing_distances.append((dist, i))
        else:
            if emax < fermi_energy:
                ref_energy = emax
            else:
                ref_energy = emin
            dist = abs(ref_energy - fermi_energy)
            other_distances.append((dist, i))
    crossing_distances.sort(key=lambda x: x[0])
    other_distances.sort(key=lambda x: x[0])
    band_indices = [i for _, i in crossing_distances[:num_bands]]
    if len(band_indices) < num_bands:
        remaining = num_bands - len(band_indices)
        band_indices += [i for _, i in other_distances[:remaining]]
    band_indices.sort()
    return band_indices


def get_band_indices_from_energy_window(band_ranges, energy_window, ref_energy=0.0):
    """
    Get all bands that fall across an energy window at any point.
    """
    E_min, E_max = energy_window

    E_min += ref_energy
    E_max += ref_energy

    logger.info(f"ENERGY WINDOW: {(E_min, E_max)}")

    band_indices = []
    for i, (emin, emax) in enumerate(band_ranges):
        # Check for overlap
        if emax >= E_min and emin <= E_max:
            band_indices.append(i)

    return band_indices


# --- Main export function --- #
def export_multiple_scalar_fields_with_edges_to_json(
    scalar_fields_bz,
    band_names,
    bz: BrillouinZoneData,
    min_corner,
    max_corner,
    path,
    precision,
):
    logger.info("=== Exporting multiple scalar fields and BZ outline edges to JSON ===")
    Nz, Ny, Nx = scalar_fields_bz[0].shape
    spacing = (max_corner - min_corner) / np.array([Nx, Ny, Nz])
    origin = min_corner

    fermi_energy = bz.bxsf.fermi_energy

    scalar_fields_json = []
    for scalar_field_bz, band_name in zip(scalar_fields_bz, band_names):
        # Round to 2 decimals
        rounded_array = np.round(scalar_field_bz, precision).flatten(order="C")

        # Further compress: convert e.g. 1.0 -> 1
        rounded_array = [
            int(x) if x.is_integer() else x for x in rounded_array.tolist()
        ]

        # Convert nan to None for JSON null casting
        rounded_list = [None if np.isnan(x) else x for x in rounded_array]

        # Compute min/max ignoring None
        numeric_values = [x for x in rounded_list if x is not None]
        minval = float(np.min(numeric_values)) if numeric_values else None
        maxval = float(np.max(numeric_values)) if numeric_values else None

        scalar_fields_json.append(
            {
                "name": band_name,
                "scalarFieldInfo": {
                    "dimensions": [Nx, Ny, Nz],
                    "scalarField": rounded_list,
                    "origin": np.round(origin, 6).tolist(),
                    "spacing": np.round(spacing, 6).tolist(),
                    "minval": minval,
                    "maxval": maxval,
                },
            }
        )

    # add some (probably too much) geometry information to the data object
    # it equates to a small fraction of the total file but some large perf gains can be made.
    vertices, edges = bz.get_bz_outline_edges()
    _v, faces, planes = bz.get_bz_faces_with_planes()

    # plane clipping and reduction
    planeoptimizer = PlaneOptimizer(faces, planes, min_corner, max_corner)

    faces_unique, planes_unique = planeoptimizer.deduplicate_planes()
    logger.info(f"Original: {len(faces)} faces, {len(planes)} planes")
    logger.info(f"Deduplicated: {len(faces_unique)} faces, {len(planes_unique)} planes")

    # sorting planes by how much of the grid they will cut processes the most expensive planes first
    faces_sorted, planes_sorted = planeoptimizer.sort_by_impact()
    data = {
        "fermiEnergy": fermi_energy,
        "scalarFields": scalar_fields_json,
        "brillouinZone": {
            "vertices": np.round(vertices, 6).tolist(),
            "edges": [list(map(int, edge)) for edge in edges],
            "reciprocalVectors": np.round(bz.bxsf.reciprocal_vectors, 6).tolist(),
            "faces": faces_sorted,
            "planes": planes_sorted,
        },
    }

    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    logger.info(f"JSON export complete: {path}")


def prepare_json(
    bxsf_file,
    energy_window=None,
    bands=None,
    resolution=20,
    precision=4,
    output_path="fermidata.json",
    mask_outside_bz=False,
):
    logger.info("=== Parsing BXSF data ===")
    data = parse_bxsf(bxsf_file)
    bz = BrillouinZoneData(data)

    logger.info(f"=== Generating grid with resolution={resolution} ===")
    grid_points, shape, min_corner, max_corner = bz.generate_cartesian_grid(
        resolution=resolution, padding_points=2
    )

    if not mask_outside_bz:
        logger.info("=== Using full grid, no masking ===")
        logger.info(
            "=== This is the better mode if you are want to use the visualiser."
        )
        frac_coords = bz.cartesian_to_fractional(grid_points)
    else:
        logger.info("=== Filtering points inside BZ ===")
        logger.info("=== This effectively cleaves (poorly) at the data level")
        points_in_bz, mask = bz.filter_points_in_bz(grid_points)
        frac_coords = bz.cartesian_to_fractional(points_in_bz)

    if energy_window is not None:
        band_indices = get_band_indices_from_energy_window(
            data.band_ranges, energy_window, ref_energy=data.fermi_energy
        )

    elif bands is not None:
        band_indices = get_band_indices_around_fermi(
            data.band_ranges, data.fermi_energy, bands
        )
    else:
        band_indices = list(range(data.num_bands))

    logger.info(
        f"=== Band indexes selected (starting from 1): {[i + 1 for i in band_indices]} ==="
    )

    logger.info(f"=== Fermi energy: {data.fermi_energy} ===")

    scalar_fields_bz = []
    band_names = []

    for band_idx in band_indices:
        logger.info(f"=== Processing Band {band_idx + 1} ===")
        interpolated_values = bz.interpolate_scalar_field(
            frac_coords, band_index=band_idx
        )

        if not mask_outside_bz:
            # Interpolate everywhere, reshape directly
            scalar_field_bz = interpolated_values.reshape(shape)
        else:
            # Create full grid, fill with NaN, insert values only inside BZ
            scalar_field_flat = np.full((np.prod(shape),), np.nan)
            scalar_field_flat[mask] = interpolated_values
            scalar_field_bz = scalar_field_flat.reshape(shape)

        logger.info(
            f" Interpolated stats: min={np.nanmin(interpolated_values)}, max={np.nanmax(interpolated_values)}"
        )
        scalar_fields_bz.append(scalar_field_bz)
        band_names.append(f"Band {band_idx + 1}")

    export_multiple_scalar_fields_with_edges_to_json(
        scalar_fields_bz,
        band_names,
        bz,
        min_corner,
        max_corner,
        output_path,
        precision,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Export BXSF scalar fields and Brillouin zone outline to JSON."
    )
    parser.add_argument("bxsf_file", help="Input .bxsf file path")
    parser.add_argument(
        "-r",
        "--resolution",
        type=int,
        default=20,
        help="Grid resolution along each axis (default: 20)",
    )
    parser.add_argument(
        "-o",
        "--output_path",
        default="fermidata.json",
        help="Output JSON filename (default: fermidata.json)",
    )
    parser.add_argument(
        "-b",
        "--bands",
        type=int,
        help="Number of bands around Fermi (default: all bands)",
    )

    parser.add_argument(
        "-e",
        "--energy_window",
        nargs=2,
        type=float,
        metavar=("E_MIN", "E_MAX"),
        help="Energy window w.r.t. Fermi level [min, max] to select bands. (default: all bands)",
    )

    parser.add_argument(
        "-m",
        "--mask_outside_bz",
        dest="mask_outside_bz",
        action="store_true",
        default=False,
        help="Mask values outside of the brillioun Zone",
    )

    parser.add_argument(
        "-p",
        "--precision",
        type=int,
        default=4,
        help="precision to round scalar field values to (default: 4)",
    )

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if args.bands and args.energy_window:
        logger.info("CANT USE BOTH BANDS MODE AND ENERGY WINDOW MODE exiting")
        exit()

    prepare_json(
        args.bxsf_file,
        args.energy_window,
        args.bands,
        args.resolution,
        args.precision,
        args.output_path,
        args.mask_outside_bz,
    )


if __name__ == "__main__":
    main()
