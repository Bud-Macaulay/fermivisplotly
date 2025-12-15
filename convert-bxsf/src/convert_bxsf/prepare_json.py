#!/usr/bin/env python3
import argparse
import json

import numpy as np

from .BrillouinZone import BrillouinZoneData
from .bxsf import parse_bxsf


# --- Helper methods to improve the visualiser clipping algorithm --- #
def deduplicate_planes(faces, planes, tol=1e-6):
    unique_planes = []
    unique_faces = []
    seen = []

    for face, plane in zip(faces, planes):
        normal = np.array(plane["normal"])
        D = plane["D"]

        duplicate = False
        for n0, D0 in seen:
            # Check if normals are effectively identical and D matches
            if np.allclose(normal, n0, atol=tol) and abs(D - D0) < tol:
                duplicate = True
                break

        if not duplicate:
            seen.append((normal, D))
            unique_planes.append(plane)
            unique_faces.append(face)

    return unique_faces, unique_planes


def estimate_plane_clipping_impact(plane, bbox_corners):
    normal = np.array(plane["normal"])
    D = plane["D"]

    # Compute signed distances for all 8 corners
    dists = [np.dot(normal, corner) - D for corner in bbox_corners]

    # A plane where all corners are inside does nothing
    if all(d <= 0 for d in dists):
        return 0

    # Count how many are outside (> 0)
    outside_count = sum(d > 0 for d in dists)

    # You can also weight by distance, not just count
    impact = sum(max(0, d) for d in dists)

    return impact


def sort_faces_and_planes_by_impact(faces, planes, min_corner, max_corner):
    # Compute the 8 corners of the bounding box
    xs = [min_corner[0], max_corner[0]]
    ys = [min_corner[1], max_corner[1]]
    zs = [min_corner[2], max_corner[2]]
    bbox_corners = np.array([[x, y, z] for x in xs for y in ys for z in zs])

    # Pair faces and planes with impact
    paired = []
    for face, plane in zip(faces, planes):
        impact = estimate_plane_clipping_impact(plane, bbox_corners)
        paired.append((face, plane, impact))

    # Sort descending (planes impacting the most first)
    paired_sorted = sorted(paired, key=lambda x: x[2], reverse=True)

    # Extract sorted faces and planes
    faces_sorted = [p[0] for p in paired_sorted]
    planes_sorted = [p[1] for p in paired_sorted]

    return faces_sorted, planes_sorted


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

    print(f"ENERGY WINDOW: {(E_min, E_max)}")

    band_indices = []
    for i, (emin, emax) in enumerate(band_ranges):
        # Check for overlap
        if emax >= E_min and emin <= E_max:
            band_indices.append(i)

    return band_indices


# --- Main export function --- #
def export_multiple_scalar_fields_with_edges_to_json(
    scalar_fields_bz, band_names, bz: BrillouinZoneData, min_corner, max_corner, path
):
    print("\n=== Exporting multiple scalar fields and BZ outline edges to JSON ===")

    Nz, Ny, Nx = scalar_fields_bz[0].shape
    spacing = (max_corner - min_corner) / np.array([Nx - 1, Ny - 1, Nz - 1])
    origin = min_corner

    fermi_energy = bz.bxsf.fermi_energy

    scalar_fields_json = []
    for scalar_field_bz, band_name in zip(scalar_fields_bz, band_names):
        # Round to 2 decimals
        rounded_array = np.round(scalar_field_bz, 2).flatten(order="C")

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
    # deduplicating equivalent planes reduces mesh cleavage
    faces_unique, planes_unique = deduplicate_planes(faces, planes)
    print(f"Original: {len(faces)} faces, {len(planes)} planes")
    print(f"Deduplicated: {len(faces_unique)} faces, {len(planes_unique)} planes")
    # sorting planes by how much of the grid they will cut processes the most expensive planes first.
    faces_sorted, planes_sorted = sort_faces_and_planes_by_impact(
        faces_unique, planes_unique, min_corner, max_corner
    )

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
    print(f"JSON export complete: {path}")


def prepare_json(
    bxsf_file,
    energy_window=None,
    bands=None,
    resolution=20,
    output_fname="fermidata.json",
    mask_outside_bz=False,
):
    print("=== Parsing BXSF data ===")
    data = parse_bxsf(bxsf_file)
    bz = BrillouinZoneData(data)

    print(f"=== Generating grid with resolution={resolution} ===")
    grid_points, shape = bz.generate_cartesian_grid(resolution=resolution)
    margin = 0.05  # pad the grid box a little.
    min_corner = grid_points.min(axis=0)
    max_corner = grid_points.max(axis=0)
    extent = max_corner - min_corner
    min_corner = min_corner - margin * extent
    max_corner = max_corner + margin * extent

    if not mask_outside_bz:
        print("=== Using full grid, no masking ===")
        print("=== This is the better mode if you are want to use the visualiser.")
        frac_coords = bz.cartesian_to_fractional(grid_points)
    else:
        print("=== Filtering points inside BZ ===")
        print("=== This effectively cleaves (poorly) at the data level")
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

    print(
        f"=== Band indexes selected (starting from 1): {[i + 1 for i in band_indices]} ==="
    )

    print(f"=== Fermi energy: {data.fermi_energy} ===")

    scalar_fields_bz = []
    band_names = []

    for band_idx in band_indices:
        print(f"\n=== Processing Band {band_idx + 1} ===", end="")
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

        print(
            f" Interpolated stats: min={np.nanmin(interpolated_values)}, max={np.nanmax(interpolated_values)}",
            end="",
        )
        scalar_fields_bz.append(scalar_field_bz)
        band_names.append(f"Band {band_idx + 1}")

    export_multiple_scalar_fields_with_edges_to_json(
        scalar_fields_bz, band_names, bz, min_corner, max_corner, output_fname
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
        "--output_fname",
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

    args = parser.parse_args()

    if args.bands and args.energy_window:
        print("CANT USE BOTH BANDS MODE AND ENERGY WINDOW MODE exiting")
        exit()

    prepare_json(
        args.bxsf_file,
        args.energy_window,
        args.bands,
        args.resolution,
        args.output_fname,
        args.mask_outside_bz,
    )


if __name__ == "__main__":
    main()
