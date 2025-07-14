# **FermiVisPlotly**

## Interactive 3D visualization of Fermi surfaces inside the Brillouin zone, powered by [Plotly.js](https://plotly.com/javascript/).

- A small JavaScript module to visualize Fermi surfaces as isosurfaces
- Shows them inside the Brillouin zone, rendered with Plotly.js
- Usable in:

  - Vanilla JS
  - React (via a simple wrapper component)

- Requires your data to be preprocessed into a JSON format

---

## **Converting BXSF files**

Use the helper script to convert `.bxsf` to the required JSON format:

```bash
cd convertBXSF
pip install numpy scipy  # needed for Voronoi & remapping

# Convert a file:
python3 prepareForFermiVis.py PATH/TO/your.bxsf
```

Has optional flags to control:

- Choose resolution
- Extraction of specific band indices

---

## 🚀 **Usage (Vanilla JS)**

```js
import { FermiVisualiser } from "fermi-vis-plotly";

const data = await fetch("./path/to/your/data.json").then((r) => r.json());

// Grab a div where you want the plot:
const container = document.getElementById("plot");

// Create visualiser:
const vis = new FermiVisualiser(container, data, {
  initialE: 5.5,
  initialTol: 0.0,
});

// Later, update:
vis.update(newE, newTolerance);
```

---

## ⚛ **Usage (React)**

Wrap it with your own controls:

```jsx
<FermiVisualiserReact
  data={data}
  initialE={5.5}
  initialTol={0.0}
  E={E}
  tolerance={tol}
/>
```

Your React state drives updates — the visualiser only handles plotting.

```js
const [E, setE] = useState(5.5); // controlled state for energy
const [tol, setTol] = useState(0.0); // controlled state for tolerance
```

---

## 🛠 **Development & demo**

For the included demo with an example dataset:

```bash
npm install
npm run dev
```

Then open: [http://localhost:5173/](http://localhost:5173/)

Replace `src/example_data/data.json` with your own converted dataset.

---

## **(WIP) and potential lowhanging fruit**

- Plotly.js can struggle with multiple large isosurfaces.
- Current solution: debounce user input to avoid too many updates.
- Possible future improvements:

  - “Recalculate” button instead of live update
  - Low-resolution preview that updates quickly, with full-res in background

- Edges of isosurfaces sometimes clip poorly – may be a data-level issue or an expensive fix.

  - Is this clipping expected for these isosurfaces?
  - Maybe cull near-BZ edge values at the data level

- Perhaps non uniform grids (either those not that are cubic) or those with higher density near the center may be a easy way to get better looking isosurfaces at reduced comp cost?
