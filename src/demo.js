import { initializePlot, updatePlot } from "./main.js";
import { debounce } from "./utils.js";

let data = null;

let currentE = 5.5;
let currentTol = 0.1;
let currentColor = "#ff0000";

async function loadJSON(path) {
  const resp = await fetch(path);
  console.log(`Loaded data from: ${path}`);
  return resp.json();
}

async function runDemo() {
  data = await loadJSON("./src/example_data/data.json");

  await initializePlot(data, currentE, currentTol, currentColor);
  console.log("Initial plot");

  const EInput = document.getElementById("E");
  const tolInput = document.getElementById("tolerance");
  const colorInput = document.getElementById("color");

  function onUserInput() {
    currentE = parseFloat(EInput.value);
    currentTol = parseFloat(tolInput.value);
    currentColor = colorInput.value;

    updatePlot(currentE, currentTol, currentColor, data);
  }

  const debouncedInput = debounce(onUserInput, 10);

  EInput.addEventListener("input", debouncedInput);
  tolInput.addEventListener("input", debouncedInput);
  colorInput.addEventListener("input", debouncedInput);
}

runDemo();
