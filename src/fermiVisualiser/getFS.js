import { hexToRgba} from "../utils.js"

export function getFermiIsosurface(
  scalarFieldInfo,
  E,
  tolerance,
  color = "#0000ff",
  name = "Fermi Surface"
) {
  const { dimensions, origin, spacing, scalarField } = scalarFieldInfo;
  const [nx, ny, nz] = dimensions;

  const x = [], y = [], z = [];
  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        x.push(origin[0] + ix * spacing[0]);
        y.push(origin[1] + iy * spacing[1]);
        z.push(origin[2] + iz * spacing[2]);
      }
    }
  }

  const colorscale = [
    [0, color],
    [1, color],
  ];

  return {
    type: "isosurface",
    x,
    y,
    z,
    value: scalarField,
    showlegend: true,
    isomin: E - tolerance,
    isomax: E + tolerance,
    colorscale,
    opacity: 0.45,
    showscale: false,
    name,
    hoverinfo: "skip", // disable hover
    lighting: {
      ambient: 1.0,
      diffuse: 0.0,
      specular: 0.0,
      roughness: 0.0,
      fresnel: 0,
    }
  };
}

