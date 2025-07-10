export function getBZTraces(vertices, edges, options = {}) {
  const { color = "black", width = 2.5, name = "" } = options;

  const x = [];
  const y = [];
  const z = [];

  edges.forEach(([startIdx, endIdx]) => {
    const start = vertices[startIdx];
    const end = vertices[endIdx];
    x.push(start[0], end[0], null);
    y.push(start[1], end[1], null);
    z.push(start[2], end[2], null);
  });

  return {
    type: "scatter3d",
    mode: "lines",
    x,
    y,
    z,
    line: {
      color,
      width,
    },
    name,
    hoverinfo: "skip",
  };
}
