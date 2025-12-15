// buildFermiGUI.js
import { colorPalette } from "../utils.js";

export function buildFermiGUI({
  containerDiv,
  legendTitle,
  scalarFields,
  meshVisibility,
  getMeshes, // <-- function to get current meshes
  renderer,
  scene,
  camera,
}) {
  // Cleanup old GUI if present
  let oldGUI = containerDiv.querySelector(".fermi-gui-container");
  if (oldGUI) containerDiv.removeChild(oldGUI);

  // Create container
  const guiContainer = document.createElement("div");
  guiContainer.classList.add("fermi-gui-container");
  Object.assign(guiContainer.style, {
    position: "absolute",
    top: "5px",
    right: "5px",
    background: "rgba(255, 255, 255, 0.50)",
    padding: "5px",
    borderRadius: "8px",
    maxHeight: "90%",
    overflowY: "auto",
    zIndex: "10",
    fontFamily: "sans-serif",
    fontSize: "13px",
  });

  containerDiv.style.position = "relative";
  containerDiv.appendChild(guiContainer);

  // Title
  if (legendTitle) {
    const titleEl = document.createElement("div");
    titleEl.textContent = legendTitle;
    Object.assign(titleEl.style, {
      fontWeight: "bold",
      fontSize: "14px",
      marginBottom: "8px",
      textAlign: "center",
    });
    guiContainer.appendChild(titleEl);
  }

  // Band toggles
  scalarFields.forEach((field, idx) => {
    const label = document.createElement("label");
    Object.assign(label.style, {
      display: "flex",
      alignItems: "center",
      marginBottom: "5px",
      cursor: "pointer",
      transition: "opacity 0.1s",
    });

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = meshVisibility[idx] ?? true;
    checkbox.style.display = "none";

    const colorBox = document.createElement("span");
    colorBox.style.backgroundColor = colorPalette[idx % colorPalette.length];
    Object.assign(colorBox.style, {
      display: "inline-block",
      width: "12px",
      height: "12px",
      marginRight: "5px",
      border: "1px solid #999",
      borderRadius: "2px",
    });

    const textNode = document.createTextNode(field.name ?? `Band ${idx + 1}`);

    label.append(checkbox, colorBox, textNode);
    guiContainer.appendChild(label);

    // helper to update opacity
    const updateLabelOpacity = () => {
      label.style.opacity = checkbox.checked ? "1.0" : "0.4";
    };
    updateLabelOpacity();

    // toggle on click
    label.addEventListener("click", () => {
      checkbox.checked = !checkbox.checked;
      meshVisibility[idx] = checkbox.checked;

      // Apply to **current meshes** dynamically
      const meshes = getMeshes();
      if (meshes[idx]) meshes[idx].visible = checkbox.checked;

      updateLabelOpacity();
      renderer.render(scene, camera);
    });
  });

  return guiContainer;
}
