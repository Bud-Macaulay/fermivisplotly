import * as THREE from "three";
import { getFermiMesh3d } from "./getFS.js";
import { getBZEdges, getBZVectors, makeOriginSphere } from "./getBZ.js";
import { buildFermiGUI } from "./fermiGuiThree.js";
import { colorPalette } from "../utils.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class FermiVisualiser {
  constructor(containerDiv, dataObject, options = {}) {
    // options defined here so control is known.
    this.gpuClipping = options.gpuClipping ?? true;
    // tri faces to merge (normalised to bounding box for [as %])
    this.mergeTolerance = options.mergeTolerance ?? 0.1;
    this.meshOpacity = options.meshOpacity ?? 1.0;
    this.padding = options.padding ?? 2.5;
    this.noClip = options.noClip ?? false;

    this.wireframe = options.wireframe ?? false;

    // optional values to initialise and add to cache.
    this.precacheValues = options.precacheValues ?? [
      dataObject.fermiEnergy - 0.05,
      dataObject.fermiEnergy + 0.05,
    ];
    // used to determine how accurate the values when doing cache compares are.
    this.cachePrecision = options.cachePrecision ?? 3;

    // camera and lighting options
    this.ambientLightColor = options.ambientLightColor ?? 0xffffff;
    this.ambientLightValue = options.ambientLightValue ?? 0.6;
    this.directionalLightColor = options.directionalLightColor ?? 0xffffff;
    this.directionalLightValue = options.directionalLightValue ?? 0.6;
    this.directionalLightPosition = options.directionalLightPosition ?? [
      1, 1, 1,
    ];

    // optional title for the legend
    this.legendTitle = options.legendTitle || "";

    this.containerDiv = containerDiv;
    this.dataObject = dataObject;

    if (this.noClip) {
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
    this.scene.add(
      new THREE.AmbientLight(this.ambientLightColor, this.ambientLightValue)
    );
    const dir = new THREE.DirectionalLight(
      this.directionalLightColor,
      this.ambientLightValue
    );

    dir.castShadow = true;
    dir.position.set(...this.directionalLightPosition);
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

    // --- PRECOMPUTE INIT ARRAY ---
    if (this.precacheValues && this.precacheValues.length) {
      for (const E of this.precacheValues) {
        const roundedE = parseFloat(E.toFixed(this.cachePrecision));
        if (!this.cache[roundedE]) {
          const meshes = this.dataObject.scalarFields.map((field, idx) =>
            getFermiMesh3d({
              scalarFieldInfo: field.scalarFieldInfo,
              E: roundedE,
              slicedPlanes: this.BZplanes,
              color: colorPalette[idx % colorPalette.length],
              meshOpacity: this.meshOpacity,
              name: field.name ?? `Band ${idx + 1}`,
              gpuClipping: this.gpuClipping,
              tolerancePercent: this.mergeTolerance,
              wireframe: this.wireframe,
            })
          );
          this.cache[roundedE] = meshes;
        }
      }
    }
  }

  buildMeshes(E = this.currentE) {
    // remove old meshes
    this.meshes.forEach((mesh) => this.scene.remove(mesh));

    const roundedE = parseFloat(E.toFixed(this.cachePrecision));
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
          wireframe: this.wireframe,
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

  _autoZoom(padding = 2.5) {
    const bbox = new THREE.Box3().setFromObject(this.scene);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z) * 0.5 * this.padding;

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
