import * as THREE from "three";
import { getFermiMesh3d } from "./getFSThree.js";

import { getBZEdges, getBZVectors, makeOriginSphere } from "./getBZThree.js";

import { colorPalette } from "../utils.js";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class FermiVisualiser {
  constructor(containerDiv, dataObject, options = {}) {
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

    // lighting
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

    this.controls.addEventListener("change", () => {
      this.renderer.render(this.scene, this.camera);
    });

    // --- BUILD + RENDER ---
    // edges
    const bzEdges = getBZEdges(vertices, edges, { color: 0x111111, width: 2 });
    this.scene.add(bzEdges);

    // reciprocal vectors
    const bvectors = getBZVectors(
      this.dataObject.brillouinZone.reciprocalVectors
    );
    bvectors.forEach((arrow) => this.scene.add(arrow));

    // origin sphere
    const originSphere = makeOriginSphere();
    this.scene.add(originSphere);

    this.buildMeshes();
    this.render();

    this.renderer.sortObjects = true;
  }

  buildMeshes() {
    this.meshes = [];

    this.dataObject.scalarFields.forEach((field, idx) => {
      const mesh = getFermiMesh3d({
        scalarFieldInfo: field.scalarFieldInfo,
        E: this.currentE,
        slicedPlanes: this.dataObject.brillouinZone.planes,
        color: colorPalette[idx % colorPalette.length],
        meshOpacity: 0.75,
      });

      this.scene.add(mesh);
      this.meshes.push(mesh);
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Private preformatter: builds the nested [nx][ny][nz] array */
  _convertNullsToInf(scalarFieldInfo) {
    const { scalarField, dimensions } = scalarFieldInfo;
    const [nx, ny, nz] = dimensions;
    const totalSize = nx * ny * nz;

    // Use Float32Array for fast numeric operations
    const formattedScalarField = new Float32Array(totalSize);

    for (let i = 0; i < totalSize; i++) {
      const v = scalarField[i];
      formattedScalarField[i] = v === null ? Infinity : v;
    }

    // Save to scalarFieldInfo
    scalarFieldInfo.formattedScalarField = formattedScalarField;
  }

  update(E) {
    this.currentE = E;

    // remove old meshes
    this.meshes.forEach((mesh) => this.scene.remove(mesh));

    // rebuild meshes at new energy
    this.meshes = this.dataObject.scalarFields.map((field, idx) => {
      const mesh = getFermiMesh3d({
        scalarFieldInfo: field.scalarFieldInfo,
        E: this.currentE,
        slicedPlanes: this.dataObject.brillouinZone.planes,
        color: colorPalette[idx % colorPalette.length],
        meshOpacity: 1.0, // opaque to avoid flicker
      });

      this.scene.add(mesh);
      return mesh;
    });

    // render updated scene
    this.renderer.render(this.scene, this.camera);
  }
}
