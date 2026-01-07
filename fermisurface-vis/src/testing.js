import { FermiVisualiser } from "./fermiVisualiser/fermiVisualiser";

function parseFilename(name) {
  const m = name.match(/^(.*)_p(\d+)_r(\d+)\.json$/);
  if (!m) return null;

  return {
    dataset: m[1],
    precision: Number(m[2]),
    resolution: Number(m[3]),
    filename: name,
  };
}

function formatBytes(bytes) {
  if (bytes == null) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatReduction(original, compressed) {
  if (!original || !compressed) return "—";
  return `${(((original - compressed) / original) * 100).toFixed(1)}%`;
}

async function runDemo() {
  const plotsDiv = document.getElementById("plots");

  let files;
  try {
    const indexResponse = await fetch("public/testdata/testinfo.json");
    files = await indexResponse.json();
  } catch (err) {
    console.error("Failed to load testdata testinfo.json", err);
    return;
  }

  // --- render table at the top ---
  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.marginBottom = "16px";
  table.style.fontFamily = "sans-serif";

  const headerRow = document.createElement("tr");
  [
    "Filename",
    "Raw Size",
    "Gzip Size",
    "Gzip %",
    "Brotli Size",
    "Brotli %",
  ].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    th.style.border = "1px solid #ccc";
    th.style.padding = "4px 8px";
    th.style.background = "#eee";
    th.style.fontSize = "12px";
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // populate rows
  files.forEach((f) => {
    const tr = document.createElement("tr");

    const cells = [
      f.file,
      formatBytes(f.size),
      formatBytes(f.gzip),
      formatReduction(f.size, f.gzip),
      formatBytes(f.brotli),
      formatReduction(f.size, f.brotli),
    ];

    cells.forEach((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      td.style.border = "1px solid #ccc";
      td.style.padding = "2px 6px";
      td.style.fontSize = "11px";
      tr.appendChild(td);
    });

    table.appendChild(tr);
  });

  // --- sort and render plots as before ---
  const parsed = files
    .map((f) => parseFilename(f.file))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.dataset !== b.dataset) return a.dataset.localeCompare(b.dataset);
      if (a.resolution !== b.resolution) return a.resolution - b.resolution;
      return a.precision - b.precision;
    })
    .map((f) => f.filename);

  for (const filename of parsed) {
    const file = `public/testdata/${filename}`;
    let data;

    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (err) {
      console.error(`Failed to load ${file}`, err);
      continue;
    }

    const wrapper = document.createElement("div");
    wrapper.style.width = "450px";
    wrapper.style.height = "450px";
    wrapper.style.border = "2px solid #ccc";
    wrapper.style.position = "relative";

    const title = document.createElement("div");
    const info = files.find((f) => f.file === filename);
    const sizeText = info ? formatBytes(info.size) : "unknown size";
    title.textContent = `${filename} (${sizeText})`;
    title.style.textAlign = "center";
    title.style.fontFamily = "sans-serif";
    title.style.fontSize = "12px";
    title.style.paddingBottom = "4px";

    const plotDiv = document.createElement("div");
    plotDiv.style.width = "97%";
    plotDiv.style.aspectRatio = "1 / 1";

    const tableContainer = document.getElementById("table-container");
    tableContainer.appendChild(table);

    wrapper.appendChild(plotDiv);
    wrapper.appendChild(title);
    plotsDiv.appendChild(wrapper);

    new FermiVisualiser(plotDiv, data, {
      precacheValues: [],
    });
  }
}

runDemo();
