import { initializePlot, updatePlot } from "./main.js";
import { debounce } from "./utils.js";

let data = null;
let currentE = 5.5;
let currentTol = 0.0;

async function loadJSON(path) {
  const resp = await fetch(path);
  console.log(`Loaded data from: ${path}`);
  return resp.json();
}

async function runDemo() {
  data = await loadJSON("./src/example_data/data.json");

  await initializePlot(data, currentE, currentTol);

  const EInput = document.getElementById("E");
  const tolInput = document.getElementById("tolerance");

  const onUserInput = () => {
    currentE = parseFloat(EInput.value);
    currentTol = parseFloat(tolInput.value);

    updatePlot(currentE, currentTol, data);
  };

  const debouncedInput = debounce(onUserInput, 0);
  EInput.addEventListener("input", debouncedInput);
  tolInput.addEventListener("input", debouncedInput);
}

runDemo();
