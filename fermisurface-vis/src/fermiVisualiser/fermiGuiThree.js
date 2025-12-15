// buildFermiGUI.js
import { colorPalette } from "../utils.js";

// simple function that builds the Legend overlay.
export function buildFermiGUI({
  containerDiv,
  legendTitle,
  scalarFields,
  meshVisibility,
  meshes,
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
    top: "10px",
    right: "10px",
    background: "rgba(255,255,255,0.95)",
    padding: "10px",
    borderRadius: "8px",
    maxHeight: "90%",
    overflowY: "auto",
    boxShadow: "0px 2px 10px rgba(0,0,0,0.25)",
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

    label.appendChild(checkbox);
    label.appendChild(colorBox);
    label.appendChild(textNode);
    guiContainer.appendChild(label);

    // helper to update opacity
    const updateLabelOpacity = () => {
      label.style.opacity = checkbox.checked ? "1.0" : "0.4";
    };
    updateLabelOpacity();

    // toggle on click
    label.addEventListener("click", () => {
      checkbox.checked = !checkbox.checked;
      meshes[idx].visible = checkbox.checked;
      meshVisibility[idx] = checkbox.checked;
      updateLabelOpacity();
      renderer.render(scene, camera);
    });
  });

  return guiContainer;
}
