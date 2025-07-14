import { FermiVisualiser } from "./fermiVisualiser/fermiVisualiser.js";
import { debounce } from "./utils.js";

async function runDemo() {
  const data = await fetch("./src/example_data/data.json").then((r) =>
    r.json()
  );

  const containerDiv = document.getElementById("plot");
  const vis = new FermiVisualiser(containerDiv, data, {
    initialE: 5.5,
    initialTol: 0.0,
  });

  const EInput = document.getElementById("E");
  const tolInput = document.getElementById("tolerance");

  const onUserInput = () => {
    const E = parseFloat(EInput.value);
    const tol = parseFloat(tolInput.value);
    vis.update(E, tol);
  };

  const debouncedInput = debounce(onUserInput, 0);
  EInput.addEventListener("input", debouncedInput);
  tolInput.addEventListener("input", debouncedInput);
}

runDemo();
