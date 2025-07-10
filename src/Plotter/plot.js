import Plotly from "plotly.js-dist";
import { getBZTraces } from "./getBZ.js";
import { getFermiIsosurface } from "./getFS.js";

let bzEdgesTrace = null;
let scalarFieldTrace = null;
let plotInitialized = false;

// Initialize plot with preloaded data object and params
export async function initializePlot(cachedData, initialE = 5.5, initialTol = 0.00, initialColor = "#ff0000") {
  const vertices = cachedData.brillouinZone.vertices;
  const edges = cachedData.brillouinZone.edges;

  bzEdgesTrace = getBZTraces(vertices, edges, { color: "#111", width: 5 });

  scalarFieldTrace = getFermiIsosurface(
    cachedData.scalarFieldInfo,
    initialE,
    initialTol,
    initialColor
  );

  const layout = {
    title: "Brillouin Zone + Scalar Field",
    scene: {
      xaxis: { visible: false },
      yaxis: { visible: false },
      zaxis: { visible: false },
    },
  };

  await Plotly.newPlot("plot", [bzEdgesTrace, scalarFieldTrace], layout);
  plotInitialized = true;
}

export function updatePlot(E, tolerance, color, cachedData) {
  if (!plotInitialized) {
    console.warn("Plot not initialized yet.");
    return;
  }

  // Create new isosurface trace
  scalarFieldTrace = getFermiIsosurface(
    cachedData.scalarFieldInfo,
    E,
    tolerance,
    color
  );

  // Get current camera
  const scene = document.getElementById('plot')._fullLayout.scene;
  const camera = scene ? scene.camera : null;

  const newLayout = {
    title: "Brillouin Zone + Scalar Field",
    scene: {
      xaxis: { visible: false },
      yaxis: { visible: false },
      zaxis: { visible: false },
      ...(camera && { camera }), // preserve camera if it exists
    },
  };

  Plotly.react("plot", [bzEdgesTrace, scalarFieldTrace], newLayout);
}