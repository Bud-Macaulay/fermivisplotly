import { hexToRgba } from "../utils.js";
import { marchingCubes } from "./marchingCubes.js";

import { clipMeshToPlanes } from "./clipMeshOpt.js";

import { mergeVertices } from "three-stdlib";

import * as THREE from "three";

export function makeThreeMeshFromRaw({ positions, indices, color, opacity }) {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  mergeVertices(geometry, 0.01);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    shininess: 40,
    side: THREE.DoubleSide,
    flatShading: false,
    depthWrite: true,
  });

  return new THREE.Mesh(geometry, material);
}

export function getFermiMesh3d({
  scalarFieldInfo,
  E,
  slicedPlanes = [],
  color = "#0000ff",
  meshOpacity = 0.95,
  name = "Fermi Surface",
}) {
  const raw = getFermiMesh3dRaw({
    scalarFieldInfo,
    E,
    slicedPlanes,
  });

  if (!raw) {
    return new THREE.Mesh(); // empty placeholder
  }

  const mesh = makeThreeMeshFromRaw({
    positions: raw.positions,
    indices: raw.indices,
    color,
    opacity: meshOpacity,
  });

  mesh.name = name;
  return mesh;
}

export function getFermiMesh3dRaw({ scalarFieldInfo, E, slicedPlanes = [] }) {
  const { dimensions, origin, spacing, minval, maxval, formattedScalarField } =
    scalarFieldInfo;

  if (1.1 * E < minval || 0.9 * E > maxval) {
    return null;
  }

  const [nx, ny, nz] = dimensions;

  const bounds = [
    origin,
    [
      origin[0] + (nx - 1) * spacing[0],
      origin[1] + (ny - 1) * spacing[1],
      origin[2] + (nz - 1) * spacing[2],
    ],
  ];

  const invSpacingX = 1 / spacing[0];
  const invSpacingY = 1 / spacing[1];
  const invSpacingZ = 1 / spacing[2];
  const nyz = ny * nz;

  const mesh = marchingCubes(
    [nx, ny, nz],
    (x, y, z) => {
      const ix = ((x - origin[0]) * invSpacingX) | 0;
      const iy = ((y - origin[1]) * invSpacingY) | 0;
      const iz = ((z - origin[2]) * invSpacingZ) | 0;

      const idx = ix * nyz + iy * nz + iz;
      return formattedScalarField[idx] - E;
    },
    bounds
  );

  const { positions, cells } = clipMeshToPlanes(
    mesh.positions,
    mesh.cells,
    slicedPlanes
  );

  const nVertices = positions.length;
  const nFaces = cells.length;

  const positionArray = new Float32Array(nVertices * 3);
  for (let v = 0; v < nVertices; v++) {
    const p = positions[v];
    positionArray[3 * v + 0] = p[0];
    positionArray[3 * v + 1] = p[1];
    positionArray[3 * v + 2] = p[2];
  }

  const indexArray = new Uint32Array(nFaces * 3);
  for (let f = 0; f < nFaces; f++) {
    const c = cells[f];
    indexArray[3 * f + 0] = c[0];
    indexArray[3 * f + 1] = c[1];
    indexArray[3 * f + 2] = c[2];
  }

  return {
    positions: positionArray,
    indices: indexArray,
  };
}
