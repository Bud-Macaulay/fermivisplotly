# bxsf.py
from dataclasses import dataclass
import numpy as np
import re

@dataclass
class BxsfData:
    num_bands: int
    grid_shape: tuple
    origin: np.ndarray             # shape (3,)
    reciprocal_vectors: np.ndarray  # shape (3, 3)
    fermi_energy: float = None
    comment: str = ""
    scalar_field: np.ndarray = None  # shape: (num_bands, nx, ny, nz)


def parse_bxsf_header(file_path):
    with open(file_path, 'r') as f:
        lines = [line.strip() for line in f]

    comment = ""
    fermi_energy = None
    num_bands = None
    grid_shape = None
    origin = None
    reciprocal_vectors = []

    for i, line in enumerate(lines):
        if line.startswith("#") and not comment:
            comment = line[1:].strip()

        if "Fermi Energy:" in line:
            try:
                fermi_energy = float(line.split(":")[1].strip())
            except ValueError:
                pass

        if "BANDGRID_3D_BANDS" in line:
            try:
                num_bands = int(lines[i+1])
                grid_shape = tuple(map(int, lines[i+2].split()))
                origin = np.array(list(map(float, lines[i+3].split())))
                reciprocal_vectors = np.array([
                    list(map(float, lines[i+4].split())),
                    list(map(float, lines[i+5].split())),
                    list(map(float, lines[i+6].split()))
                ])
            except Exception as e:
                raise ValueError(f"Failed to parse BANDGRID_3D_BANDS block: {e}")
            break

    return num_bands, grid_shape, origin, reciprocal_vectors, fermi_energy, comment



def parse_bxsf(file_path):
    (
        num_bands,
        grid_shape,
        origin,
        reciprocal_vectors,
        fermi_energy,
        comment,
    ) = parse_bxsf_header(file_path)

    with open(file_path, 'r') as f:
        lines = [line.strip() for line in f]

    nx, ny, nz = grid_shape
    total_points = nx * ny * nz
    scalar_field = []

    reading_band = False
    current_band_data = []
    band_count = 0

    for line in lines:
        if line.startswith("BAND:"):
            if reading_band:
                raise ValueError("Unexpected BAND before previous band finished")

            current_band_data = []
            reading_band = True
            continue

        if line.startswith("END_BANDGRID_3D"):
            if reading_band:
                raise ValueError("Unexpected END_BANDGRID_3D before finishing band data")
            break

        if reading_band:
            if not line:
                continue
            values = list(map(float, line.split()))
            current_band_data.extend(values)

            if len(current_band_data) >= total_points:
                if len(current_band_data) != total_points:
                    raise ValueError(f"Band {band_count} has incorrect number of values")
                band_array = np.array(current_band_data).reshape(grid_shape)
                scalar_field.append(band_array)
                reading_band = False
                band_count += 1

    if band_count != num_bands:
        raise ValueError(f"Expected {num_bands} bands, but parsed {band_count}")
        
    return BxsfData(
        num_bands=num_bands,
        grid_shape=grid_shape,
        origin=origin,
        reciprocal_vectors=reciprocal_vectors,
        fermi_energy=fermi_energy,
        comment=comment,
        scalar_field=np.stack(scalar_field),
    )
