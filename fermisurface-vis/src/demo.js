import { FermiVisualiser } from "./fermiVisualiser/fermiVisualiser";

async function runDemo() {
  const data = await fetch("/public/data.json").then((r) => r.json());

  const containerDiv = document.getElementById("plot");
  const vis = new FermiVisualiser(containerDiv, data);

  const Eslider = document.getElementById("Eslider");
  const Elabel = document.getElementById("Elabel");

  // mapping slider values to actual E values
  const Emap = [
    data.fermiEnergy - 0.05,
    data.fermiEnergy,
    data.fermiEnergy + 0.05,
  ];

  // set initial slider position to "Efermi"
  Eslider.value = 1;
  Elabel.textContent = Emap[1].toFixed(5);

  Eslider.addEventListener("input", () => {
    const idx = parseInt(Eslider.value);
    const E = Emap[idx];
    Elabel.textContent = E.toFixed(5);
    vis.update(E);
  });

  const sizeSlider = document.getElementById("sizeSlider");
  const sizeLabel = document.getElementById("sizeLabel");
  const wrapper = document.getElementById("wrapperdiv");

  sizeLabel.textContent = sizeSlider.value;

  sizeSlider.addEventListener("input", () => {
    const v = sizeSlider.value;
    sizeLabel.textContent = v;
    wrapper.style.width = `${v}vh`;
    wrapper.style.height = `${v}vh`;
  });
}

runDemo();
