import Plotly from "plotly.js-dist";
import { getBZTraces } from "./getBZ.js";
import { getFermiIsosurface } from "./getFS.js";
import { colorPalette } from "../utils.js";

let bzEdgesTrace = null;
let scalarFieldTraces = null;
let plotInitialized = false;

export async function initializePlot(
  dataObject,
  initialE = 5.5,
  initialTol = 0.0
) {
  const { vertices, edges } = dataObject.brillouinZone;

  bzEdgesTrace = getBZTraces(vertices, edges, { color: "#111", width: 5 });
  bzEdgesTrace.showlegend = false; // no legend for the BZ

  scalarFieldTraces = dataObject.scalarFields.map((field, idx) =>
    getFermiIsosurface(
      field.scalarFieldInfo,
      initialE,
      initialTol,
      colorPalette[idx % colorPalette.length],
      field.name ?? `Band ${idx + 1}`
    )
  );

  const layout = {
    title: "Brillouin Zone + Scalar Fields",
    scene: {
      xaxis: { visible: false },
      yaxis: { visible: false },
      zaxis: { visible: false },
    },
  };

  await Plotly.newPlot("plot", [bzEdgesTrace, ...scalarFieldTraces], layout);
  plotInitialized = true;

  const plotDiv = document.getElementById("plot");
  plotDiv.on("plotly_legendclick", (eventData) => {
    const scene = plotDiv._fullLayout.scene;
    if (!scene) return;

    const currentCamera = { ...scene.camera };

    setTimeout(() => {
      Plotly.relayout(plotDiv, {
        "scene.camera": currentCamera,
      });
    }, 0);
  });
}

export function updatePlot(E, tolerance, dataObject) {
  if (!plotInitialized) {
    console.warn("Plot not initialized yet.");
    return;
  }

  const plotDiv = document.getElementById("plot");
  const oldTraces = plotDiv.data;
  const visibleStates = oldTraces.map((trace) => trace.visible);

  scalarFieldTraces = dataObject.scalarFields.map((field, idx) =>
    getFermiIsosurface(
      field.scalarFieldInfo,
      E,
      tolerance,
      colorPalette[idx % colorPalette.length],
      field.name ?? `Band ${idx + 1}`
    )
  );

  const newTraces = [bzEdgesTrace, ...scalarFieldTraces];

  // Preserve visibility state of existing traces if possible
  for (let i = 0; i < newTraces.length; i++) {
    if (visibleStates[i] !== undefined) {
      newTraces[i].visible = visibleStates[i];
    }
  }

  const scene = plotDiv._fullLayout.scene;
  const camera = scene ? scene.camera : null;

  const newLayout = {
    title: "Brillouin Zone + Scalar Fields",
    scene: {
      xaxis: { visible: false },
      yaxis: { visible: false },
      zaxis: { visible: false },
      ...(camera && { camera }),
    },
  };

  Plotly.react("plot", newTraces, newLayout);
}
