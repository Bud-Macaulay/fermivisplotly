import * as THREE from "three";

/**
 * Build the Brillouin zone edges as a LineSegments object
 */
export function getBZEdges(vertices, edges, options = {}) {
  const { color = 0x000000, width = 1 } = options;

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(edges.length * 2 * 3); // 2 points per edge, 3 coords each

  // some complicated edge positions sorting.
  edges.forEach(([startIdx, endIdx], e) => {
    const start = vertices[startIdx];
    const end = vertices[endIdx];
    positions[6 * e + 0] = start[0];
    positions[6 * e + 1] = start[1];
    positions[6 * e + 2] = start[2];
    positions[6 * e + 3] = end[0];
    positions[6 * e + 4] = end[1];
    positions[6 * e + 5] = end[2];
  });

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color, linewidth: width });

  return new THREE.LineSegments(geometry, material);
}

/**
 * Build reciprocal lattice vectors as ArrowHelpers
 */
export function getBZVectors(
  reciprocalVectors,
  axisColors = [0x2ca02c, 0x1f77b4, 0xd62728]
) {
  const arrows = [];

  reciprocalVectors.forEach((v, idx) => {
    const dir = new THREE.Vector3(v[0], v[1], v[2]).normalize();
    const length = 0.95 * new THREE.Vector3(...v).length();
    const color = axisColors[idx % axisColors.length];

    const arrow = new THREE.ArrowHelper(
      dir,
      new THREE.Vector3(0, 0, 0),
      length,
      color,
      0.1 * length,
      0.05 * length
    );
    arrows.push(arrow);
  });

  return arrows;
}

/**
 * Build a small sphere at the origin
 */
export function makeOriginSphere({
  radius = 0.04,
  color = 0x999999,
  resolution = 16,
} = {}) {
  const geometry = new THREE.SphereGeometry(radius, resolution, resolution);
  const material = new THREE.MeshStandardMaterial({ color });
  return new THREE.Mesh(geometry, material);
}
