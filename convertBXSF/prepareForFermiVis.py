#!/usr/bin/env python3
import argparse
import numpy as np
import json

from bxsf import parse_bxsf
from BrillouinZone import BrillouinZoneData


def export_multiple_scalar_fields_with_edges_to_json(
    scalar_fields_bz, band_names, bz: BrillouinZoneData, min_corner, max_corner, path
):
    print("=== Exporting multiple scalar fields and BZ outline edges to JSON ===")

    Nz, Ny, Nx = scalar_fields_bz[0].shape
    spacing = (max_corner - min_corner) / np.array([Nx - 1, Ny - 1, Nz - 1])
    origin = min_corner

    scalar_fields_json = []
    for scalar_field_bz, band_name in zip(scalar_fields_bz, band_names):
        safe_field = np.nan_to_num(scalar_field_bz, nan=0.0)

        # 'lossy but significant' fs reduction: 
        rounded_array = np.round(safe_field, 2).flatten(order="C")

        # lossless fs reduction: 
        # Cleans up 0.0 -> 0; (15% fs reduction)
        # Also 1.0 -> 1; [we expect 1% to land on an integer after rounding]
        rounded_list = [
            int(x) if x.is_integer() else x
            for x in rounded_array.tolist()
        ]

        scalar_fields_json.append({
            "name": band_name,
            "scalarFieldInfo": {
                "dimensions": [Nx, Ny, Nz],
                "scalarField": rounded_list,
                "origin": np.round(origin, 6).tolist(),
                "spacing": np.round(spacing, 6).tolist()
            }
        })

    vertices, edges = bz.get_bz_outline_edges()
    data = {
        "scalarFields": scalar_fields_json,
        "brillouinZone": {
            "vertices": np.round(vertices, 6).tolist(),
            "edges": [list(map(int, edge)) for edge in edges],
            "reciprocalVectors": np.round(bz.bxsf.reciprocal_vectors, 6).tolist()
        }
    }
    # lossless reduction of file size by culling spaces.
    with open(path, "w") as f:
        json.dump(data, f, separators=(',', ':'))
    print(f"JSON export complete: {path}")


def main():
    parser = argparse.ArgumentParser(
        description="Export BXSF scalar fields and Brillouin zone outline to JSON."
    )
    parser.add_argument("bxsf_file", help="Input .bxsf file path")
    parser.add_argument(
        "-r", "--resolution", type=int, default=20,
        help="Grid resolution along each axis (default: 20)"
    )
    parser.add_argument(
        "-o", "--output", default="fermidata.json",
        help="Output JSON filename (default: fermidata.json)"
    )
    parser.add_argument(
        "-b", "--bands", type=str,
        help="Comma-separated list of band indices to export (1-based; default: all bands)"
    )

    args = parser.parse_args()

    print("=== Parsing BXSF data ===")
    data = parse_bxsf(args.bxsf_file)
    bz = BrillouinZoneData(data)

    print(f"=== Generating grid with resolution={args.resolution} ===")
    grid_points, shape = bz.generate_cartesian_grid(resolution=args.resolution)
    min_corner = grid_points.min(axis=0)
    max_corner = grid_points.max(axis=0)

    print("=== Filtering points inside BZ ===")
    points_in_bz, mask = bz.filter_points_in_bz(grid_points)
    frac_coords = bz.cartesian_to_fractional(points_in_bz)

    if args.bands:
        band_indices = [int(idx.strip()) - 1 for idx in args.bands.split(",")]
    else:
        band_indices = list(range(data.num_bands))

    scalar_fields_bz = []
    band_names = []

    for band_idx in band_indices:
        print(f"\n=== Processing Band {band_idx+1} ===")
        interpolated_values = bz.interpolate_scalar_field(frac_coords, band_index=band_idx)

        scalar_field_bz = np.full((np.prod(shape),), np.nan)
        scalar_field_bz[mask] = interpolated_values
        scalar_field_bz = scalar_field_bz.reshape(shape)

        scalar_fields_bz.append(scalar_field_bz)
        band_names.append(f"Band {band_idx+1}")

        print(f"Interpolated stats: min={np.nanmin(interpolated_values)}, max={np.nanmax(interpolated_values)}")

    export_multiple_scalar_fields_with_edges_to_json(
        scalar_fields_bz, band_names, bz, min_corner, max_corner, args.output
    )


if __name__ == "__main__":
    main()
