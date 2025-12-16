import { FermiVisualiser } from "./fermiVisualiser/fermiVisualiser";

async function runDemo() {
  const plotsDiv = document.getElementById("plots");

  const precision = [1, 2, 3, 4, 5];
  const res = [24, 36, 48, 96];

  const files = [];

  for (const p of precision) {
    for (const r of res) {
      files.push(`/testdata/testfile_${p}_${r}.json`);
    }
  }

  for (const file of files) {
    const response = await fetch(file);
    const data = await response.json();

    const sizeBytes = Number(response.headers.get("content-length"));
    const sizeKB = sizeBytes
      ? (sizeBytes / 1024 / 1024).toFixed(1) + " MB"
      : "unknown size";

    // wrapper per visualiser
    const wrapper = document.createElement("div");
    wrapper.style.width = "450px";
    wrapper.style.height = "450px";
    wrapper.style.border = "2px solid #ccc";
    wrapper.style.position = "relative";

    // title
    const title = document.createElement("div");
    title.textContent = `${file} (${sizeKB})`;
    title.style.textAlign = "center";
    title.style.fontFamily = "sans-serif";
    title.style.fontSize = "12px";
    title.style.marginBottom = "4px";

    // plot container
    const plotDiv = document.createElement("div");
    plotDiv.style.width = "100%";
    plotDiv.style.aspectRatio = "1 / 1";

    wrapper.appendChild(title);
    wrapper.appendChild(plotDiv);
    plotsDiv.appendChild(wrapper);

    new FermiVisualiser(plotDiv, data, {
      gpuClipping: true,
      meshOpacity: 1.0,
    });
  }
}

runDemo();
