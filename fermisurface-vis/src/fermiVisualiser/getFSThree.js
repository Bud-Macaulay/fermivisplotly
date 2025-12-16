import { hexToRgba } from "../utils.js";
import { marchingCubes } from "./marchingCubes.js";

import { clipMeshToPlanes } from "./clipMeshOpt.js";

import { mergeVertices } from "three-stdlib";

import * as THREE from "three";

// TODO - investigate converting this whole method to the Three.JS Marching Cubes algo...
// Requires a full rewrite but may be super performant.
function toThreeClippingPlanes(planes) {
  return planes.map(
    (p) =>
      new THREE.Plane(
        new THREE.Vector3(p.normal[0], p.normal[1], p.normal[2]),
        p.D
      )
  );
}

function makeThreeMesh({
  x,
  y,
  z,
  i,
  j,
  k,
  color,
  opacity,
  // merge tri normals [0.1 seems like a nice smoothing...]
  tolerancePercent = 1e-3,
  clippingPlanes = [],
}) {
  let geometry = new THREE.BufferGeometry();

  // positions
  const positions = new Float32Array(x.length * 3);
  for (let v = 0; v < x.length; v++) {
    positions[3 * v + 0] = x[v];
    positions[3 * v + 1] = y[v];
    positions[3 * v + 2] = z[v];
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // indices
  const index = new Uint32Array(i.length * 3);
  for (let f = 0; f < i.length; f++) {
    index[3 * f + 0] = i[f];
    index[3 * f + 1] = j[f];
    index[3 * f + 2] = k[f];
  }

  // align tri faces, smooth and calculate norms.
  geometry.setIndex(new THREE.BufferAttribute(index, 1));

  // compute bounding box for relative tolerance
  const bbox = new THREE.Box3().setFromBufferAttribute(
    geometry.getAttribute("position")
  );
  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  const tolerance = (tolerancePercent / 100) * maxDim;

  const mergedGeometry = mergeVertices(geometry, tolerance);
  geometry = mergedGeometry;
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    // wireframe: true,
    side: THREE.DoubleSide,
    flatShading: false,
    depthWrite: true,
    clippingPlanes: clippingPlanes.length ? clippingPlanes : [],
    // docs says keep Intersection true but that has the reverse behaviour?
    clipIntersection: false,
  });

  return new THREE.Mesh(geometry, material);
}

export function getFermiMesh3d({
  scalarFieldInfo,
  E,
  slicedPlanes = [],
  color = "#0000ff",
  meshOpacity = 1.0,
  gpuClipping = false,
  tolerancePercent = 1e-3, // no merge tris
}) {
  const { dimensions, origin, spacing, minval, maxval, formattedScalarField } =
    scalarFieldInfo;

  if (1.1 * E < minval || 0.9 * E > maxval) {
    // if outside of range just return a placeholder mesh
    return makeThreeMesh({
      x: 0,
      y: 0,
      z: 0,
      i: 0,
      j: 0,
      k: 0,
      color,
      opacity: meshOpacity,
    });
  }

  const [nx, ny, nz] = dimensions;

  // Physical bounds of the grid
  const bounds = [
    origin, // lower corner
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

  const t2 = performance.now();

  // Get mesh geometry - (uses some array tricks for faster indexing.
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

  const t3 = performance.now();
  console.log(`mC run took: ${t3 - t2} ms`);

  let positions,
    cells,
    clippingPlanes = [];

  // TODO: test with denser grids,
  // if marchingCubes becomes RDS, then this optimisation is useless..
  // Could also investigate clipping cpu clipping off the main thread to precalc the surface.
  if (gpuClipping && slicedPlanes.length) {
    // GPU clipping - faster calc, laggier display
    clippingPlanes = toThreeClippingPlanes(slicedPlanes);
    positions = mesh.positions;
    cells = mesh.cells;
  } else {
    // old CPU clipping - slower calc, smoother display
    ({ positions, cells } = clipMeshToPlanes(
      mesh.positions,
      mesh.cells,
      slicedPlanes
    ));
  }

  const nVertices = positions.length;
  const nFaces = cells.length;

  const x = new Float32Array(nVertices);
  const y = new Float32Array(nVertices);
  const z = new Float32Array(nVertices);

  for (let v = 0; v < nVertices; v++) {
    const p = positions[v];
    x[v] = p[0];
    y[v] = p[1];
    z[v] = p[2];
  }

  const i = new Uint32Array(nFaces);
  const j = new Uint32Array(nFaces);
  const k = new Uint32Array(nFaces);

  for (let f = 0; f < nFaces; f++) {
    const c = cells[f];
    i[f] = c[0];
    j[f] = c[1];
    k[f] = c[2];
  }

  return makeThreeMesh({
    x,
    y,
    z,
    i,
    j,
    k,
    color,
    opacity: meshOpacity,
    clippingPlanes,
    tolerancePercent,
  });
}
