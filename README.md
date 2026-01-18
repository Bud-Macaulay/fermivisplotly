# Materials Cloud fermisurface visualiser

This repository contains

- ./convert-bxsf - a python package that allows conversion from a single bxsf file to a web-friendly json file.
- ./fermisurface-vis - the javascript package to visualise the json file.

---

### Usage (Vanilla JS)

```js
import { FermiVisualiser } from "fermisurface-visualiser";

const data = await fetch("./path/to/your/data.json").then((r) => r.json());

// Grab a div where you want the plot:
const container = document.getElementById("plot");

// Create visualiser defaults to fermilevel.
const vis = new FermiVisualiser(container, data);

// update the plot
vis.update(newFermiEValue);
```

---

### Development

```bash
npm install
npm run dev

# GOTO http://localhost:5173/
# The data.json inside public will be read.
```

### Development notes and TODOS

#### Testing on 100x100x100 grid - performance notes etc.

- Currently BZ and Fermisurface positioning is fully managed with custom code, in principle it may be better to switch to using SeeKPath instead (see weas)

- Investigation of the size of the cache is reasonable - even for very large caches (100+ values, on very dense grids) results in 0.5mb memory footprint.

  - currently these are simple THREE.Mesh(geometry, material); objects. I presume that their internal data structure is very performant but its unclear if this performance is for rendering/updates or memory footprint.
  - currently the visualiser swaps values in and out of the cache by removing invalid surfaces and rerendering valid ones, this could possibly be improved by switching to a ThreeJS visibility states, (however the overhead here seems tiny.)

- Mesh calculation (both formation and cleavage) is fully external to Three, using just JIT JS, this was a comprimise as it wasnt clear what visualiser engine we would use.

  - I imagine that the internal Three Marchingcubes/Mesh Clipping is faster. Clipping is basically instant bit numerous optimisations have been made in the getFS file and it now does a lot of difficult to understand steps to run marching cubes fast.
  - if we can lock this away safely with ThreeJS that'd be great

- Offloading mesh calculation to a webworker through wasm (or even just a generic webworker) was implemented as some point - running efficient wasm marchingCubes could be great, this may be unneccessary if using ThreeJS MC implementation.
