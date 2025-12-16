import * as THREE from "three";
import { getFermiMesh3d } from "./getFSThree.js";
import { getBZEdges, getBZVectors, makeOriginSphere } from "./getBZThree.js";
import { buildFermiGUI } from "./fermiGuiThree.js";
import { colorPalette } from "../utils.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class FermiVisualiser {
  constructor(containerDiv, dataObject, options = {}) {
    this.gpuClipping = options.gpuClipping ?? true;
    this.mergeTolerance = options.mergeTolerance ?? 1e-3;
    this.meshOpacity = options.meshOpacity ?? 1.0;
    this.padding = options.padding ?? 2.5;

    this.legendTitle = options.legendTitle || "";
    this.containerDiv = containerDiv;
    this.dataObject = dataObject;

    if (options.noClip) {
      this.BZplanes = [];
    } else {
      this.BZplanes = dataObject.brillouinZone.planes;
    }

    this.cache = {};

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

    this.renderer.localClippingEnabled = true;

    containerDiv.appendChild(this.renderer.domElement);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.castShadow = true;
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

    // --- Zoom based on bounding box
    this._autoZoom(this.padding);

    // --- BUILD GUI ---
    this._buildGUI();

    this.renderer.render(this.scene, this.camera);
    this.renderer.sortObjects = true; // helps stop z-fighting
  }

  buildMeshes(E = this.currentE) {
    // remove old meshes
    this.meshes.forEach((mesh) => this.scene.remove(mesh));

    const roundedE = parseFloat(E.toFixed(3));
    this.currentE = roundedE;

    // get from cache or compute
    let meshes = this.cache[roundedE];
    if (!meshes) {
      meshes = this.dataObject.scalarFields.map((field, idx) =>
        getFermiMesh3d({
          scalarFieldInfo: field.scalarFieldInfo,
          E: roundedE,
          slicedPlanes: this.BZplanes,
          color: colorPalette[idx % colorPalette.length],
          meshOpacity: this.meshOpacity,
          name: field.name ?? `Band ${idx + 1}`,
          gpuClipping: this.gpuClipping,
          tolerancePercent: this.mergeTolerance,
        })
      );
      this.cache[roundedE] = meshes;
    }

    // apply visibility
    meshes.forEach((mesh, idx) => {
      mesh.visible = this.meshVisibility[idx] ?? true;
      this.scene.add(mesh);
    });

    this.meshes = meshes;
    this.renderer.render(this.scene, this.camera);
  }

  update(E) {
    this.buildMeshes(E);
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

  _buildGUI() {
    this.guiContainer = buildFermiGUI({
      containerDiv: this.containerDiv,
      legendTitle: this.legendTitle,
      scalarFields: this.dataObject.scalarFields,
      meshVisibility: this.meshVisibility,
      getMeshes: () => this.meshes,
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
    });
  }

  _autoZoom(padding = 1.2) {
    const bbox = new THREE.Box3().setFromObject(this.scene);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    console.log("BBox size:", size, "center:", center);

    const maxDim = Math.max(size.x, size.y, size.z) * 0.5 * padding;
    console.log("maxDim:", maxDim);

    this.camera.left = -maxDim;
    this.camera.right = maxDim;
    this.camera.top = maxDim;
    this.camera.bottom = -maxDim;

    const dist = maxDim * 3;
    this.camera.position.set(center.x + dist, center.y + dist, center.z + dist);
    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
    this.camera.updateProjectionMatrix();
  }
}
