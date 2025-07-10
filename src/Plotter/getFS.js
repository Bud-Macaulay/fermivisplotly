import { hexToRgba} from "../utils.js"

export function getFermiIsosurface(
  scalarFieldInfo,
  E,
  tolerance,
  color = "#0000ff" // default blue
) {
  const { dimensions, origin, spacing, scalarField } = scalarFieldInfo;
  const [nx, ny, nz] = dimensions;

  console.log(tolerance);
  console.log(E);

  const x = [];
  const y = [];
  const z = [];

  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        x.push(origin[0] + ix * spacing[0]);
        y.push(origin[1] + iy * spacing[1]);
        z.push(origin[2] + iz * spacing[2]);
      }
    }
  }

  const rgbaColor = hexToRgba(color, 0.25);

  const colorscale = [
    [0, rgbaColor],
    [1, rgbaColor],
  ];

  return {
    type: "isosurface",
    x,
    y,
    z,
    value: scalarField,
    isomin: E - tolerance,
    isomax: E + tolerance,
    colorscale: colorscale,
    showscale: false,
    lighting: {
      ambient: 0.7,
      diffuse: 0.2,
      specular: 0.2,
      roughness: 0.0,
      fresnel: 0.1,
    },
  };
}
