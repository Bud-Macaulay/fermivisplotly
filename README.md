# FermiVisPlotly

### WIP README. - if you are reading this and its after 15.07.2025, tell bud to update this readme...

Interactive 3D visualization of Fermi surfaces within the Brillouin zone using Plotly.js.

This package is largely a WIP and requires data to be preformated into a specific datastructure.

## Convert a bxsf

There is a utilty (see convertBXSF/) to convert bxsf to json.
``` py
cd convertBXSF
pip install numpy, scipy # for voronoi and remapping

# Simple usage
python3 prepareForFermiVis.py PATH/TO/BXSF.bxsf
```
This utility also has individual band scraping and resolution control.

## Usage 
The usage is currently a bit finnicky because I have yet to make this into a nice component... I will - 

For now updating the data.json file inside src/example_data:
``` py
npm install
npm run dev
http://localhost:5173/ # for a visualiser
```

## Performance (Notes to self)
Rendering of isosurfaces is expensive and plotly struggles with multiple isosurfaces, as of current there is a listener and debouncer that tracks E choice and updates the isosurface. 

Maybe a 'recalculate' button might be a bit nicer, or even an extremely low res isosurface is calculated in the foreground while the larger isosurfaces get calculated in the background.

The plot seems to function moderatlely well with the default resolutions (5 band test file), although not particularly pretty.

Would like to fix the edge isosurfaces being clipped very poorly but i think this is either a very complicated task or a very expensive process. 
    
 - Is this even expected behaviour for these isosurfaces? 
 - maybe there is a solution at the data level?
 
 - if its not expected behaviour we can maybe choose to just not render if 98+ of points are some tolerance away from the origin?