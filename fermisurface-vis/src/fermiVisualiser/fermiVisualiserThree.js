import * as THREE from "three";
import { getFermiMesh3d } from "./getFSThree.js";
import { getBZEdges, getBZVectors, makeOriginSphere } from "./getBZThree.js";
import { colorPalette } from "../utils.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class FermiVisualiser {
  constructor(containerDiv, dataObject, options = {}) {
    this.meshOpacity = options.meshOpacity ?? 1.0;

    this.legendTitle = options.legendTitle || "Toggle Bands";
    this.containerDiv = containerDiv;
    this.dataObject = dataObject;
    const { vertices, edges } = this.dataObject.brillouinZone;
    this.currentE = options.initialE ?? dataObject.fermiEnergy;

    for (const field of this.dataObject.scalarFields) {
      this._convertNullsToInf(field.scalarFieldInfo);
    }

    // --- THREE SETUP ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    const w = containerDiv.clientWidth;
    const h = containerDiv.clientHeight;
    const aspect = w / h;

    this.camera = new THREE.OrthographicCamera(
      -aspect,
      aspect,
      1,
      -1,
      0.01,
      100
    );
    this.camera.position.set(2, 2, 2);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    containerDiv.appendChild(this.renderer.domElement);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(1, 1, 1);
    this.scene.add(dir);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = true;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.controls.addEventListener("change", () =>
      this.renderer.render(this.scene, this.camera)
    );

    // --- BUILD BZ ---
    const bzEdges = getBZEdges(vertices, edges, {});
    this.scene.add(bzEdges);

    const bvectors = getBZVectors(
      this.dataObject.brillouinZone.reciprocalVectors
    );
    bvectors.forEach((arrow) => this.scene.add(arrow));

    const originSphere = makeOriginSphere();
    this.scene.add(originSphere);

    // --- BUILD MESHES ---
    this.meshes = [];
    this.meshVisibility = [];
    this.buildMeshes();

    // --- BUILD GUI ---
    this._buildGUI();

    this.render();
    this.renderer.sortObjects = true; // helps stop z-fighting
  }

  buildMeshes() {
    // Remove previous meshes
    this.meshes.forEach((mesh) => this.scene.remove(mesh));

    // Add new meshes
    this.meshes = this.dataObject.scalarFields.map((field, idx) => {
      const mesh = getFermiMesh3d({
        scalarFieldInfo: field.scalarFieldInfo,
        E: this.currentE,
        slicedPlanes: this.dataObject.brillouinZone.planes,
        color: colorPalette[idx % colorPalette.length],
        meshOpacity: this.meshOpacity,
      });
      mesh.visible = this.meshVisibility[idx] ?? true;
      this.scene.add(mesh);
      return mesh;
    });
  }

  _buildGUI() {
    // Remove old GUI if present
    if (this.guiContainer) this.containerDiv.removeChild(this.guiContainer);

    // Create container
    this.guiContainer = document.createElement("div");
    Object.assign(this.guiContainer.style, {
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

    this.containerDiv.style.position = "relative";
    this.containerDiv.appendChild(this.guiContainer);

    // Title
    if (this.legendTitle) {
      const titleEl = document.createElement("div");
      titleEl.textContent = this.legendTitle;
      Object.assign(titleEl.style, {
        fontWeight: "bold",
        fontSize: "14px",
        marginBottom: "8px",
        textAlign: "center",
      });
      this.guiContainer.appendChild(titleEl);
    }

    // Band toggles
    this.dataObject.scalarFields.forEach((field, idx) => {
      const label = document.createElement("label");
      Object.assign(label.style, {
        display: "flex",
        alignItems: "center",
        marginBottom: "5px",
        cursor: "pointer",
        transition: "opacity 0.1s",
      });

      // checkbox (hidden)
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = this.meshVisibility[idx] ?? true;
      checkbox.style.display = "none";

      // color box
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

      // name text
      const textNode = document.createTextNode(field.name ?? `Band ${idx + 1}`);

      // assemble
      label.appendChild(checkbox);
      label.appendChild(colorBox);
      label.appendChild(textNode);
      this.guiContainer.appendChild(label);

      // helper to update opacity
      const updateLabelOpacity = () => {
        label.style.opacity = checkbox.checked ? "1.0" : "0.4";
      };
      updateLabelOpacity();

      // toggle on click
      label.addEventListener("click", () => {
        checkbox.checked = !checkbox.checked;
        this.meshes[idx].visible = checkbox.checked;
        this.meshVisibility[idx] = checkbox.checked;
        updateLabelOpacity();
        this.renderer.render(this.scene, this.camera);
      });
    });
  }

  update(E) {
    this.currentE = E;
    // Save current visibility state
    this.meshVisibility = this.meshes.map((mesh) => mesh.visible);

    // Rebuild meshes at new energy
    this.buildMeshes();

    // Rebuild GUI (checkbox states preserved)
    this._buildGUI();

    this.renderer.render(this.scene, this.camera);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  _convertNullsToInf(scalarFieldInfo) {
    const { scalarField, dimensions } = scalarFieldInfo;
    const totalSize = dimensions.reduce((a, b) => a * b, 1);
    const formattedScalarField = new Float32Array(totalSize);
    for (let i = 0; i < totalSize; i++) {
      formattedScalarField[i] =
        scalarField[i] === null ? Infinity : scalarField[i];
    }
    scalarFieldInfo.formattedScalarField = formattedScalarField;
  }
}
