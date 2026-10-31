// 讀取 glTF／GLB 模型並檢視（旋轉、縮放、沿 X/Y/Z 剖切、線框、尺寸）。需要時才載入。
// glTF 的單位是公尺、Y 軸朝上；SketchUp 等軟體匯出時會自動轉換。
import * as THREE from '../lib/three.module.min.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { attachOrbit } from './orbit.js';

export { webglOk } from './joint3d.js';
const EDGE_TRI_LIMIT = 150000;   // 三角形太多時不畫輪廓線，避免手機卡頓

/** 把 glTF 載入成 Object3D；回傳 { root, sizeMm: [x, y, z], triangles } */
export async function parseModel(buffer) {
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buffer, '', res, rej));
  const root = gltf.scene;
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) throw new Error('empty');
  const size = box.getSize(new THREE.Vector3());
  let tri = 0;
  root.traverse((o) => { if (o.isMesh) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { root, sizeMm: [size.x * 1000, size.y * 1000, size.z * 1000], triangles: tri };
}

export function createModelViewer(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  host.append(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.001, 1000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a70, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-1, 2, 1.2); scene.add(sun);

  const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  let obj = null, edges = null, info = null, baseDist = 1, radius = 1;
  const view = { az: -0.55, el: 0.5, dist: 1 };
  let axis = 'none', cutV = 1, wire = false, edgesOn = true, dirty = true, raf = 0, disposed = false;
  const center = new THREE.Vector3();

  function eachMat(fn) { obj?.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(fn); }); }
  function applyCut() {
    const on = axis !== 'none';
    const n = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
    plane.normal.set(-n[0], -n[1], -n[2]);                       // 保留 座標 ≤ 切面 的那一半
    const c = axis === 'x' ? center.x : axis === 'y' ? center.y : center.z;
    plane.constant = c + (cutV - 0.5) * 2 * radius * 1.0001 + (cutV >= 1 ? radius : 0);
    eachMat((m) => { m.clippingPlanes = on ? [plane] : []; m.needsUpdate = true; });
    edges?.traverse((o) => { if (o.material) { o.material.clippingPlanes = on ? [plane] : []; } });
    dirty = true; requestRender();
  }
  function applyWire() { eachMat((m) => { m.wireframe = wire; }); if (edges) edges.visible = edgesOn && !wire; dirty = true; requestRender(); }

  function setModel({ root, sizeMm, triangles }) {
    if (obj) { scene.remove(obj); if (edges) scene.remove(edges); }
    obj = root; info = { sizeMm, triangles };
    obj.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.side = THREE.DoubleSide; }); } });
    scene.add(obj);
    edges = null;
    if (triangles <= EDGE_TRI_LIMIT) {
      edges = new THREE.Group();
      obj.updateMatrixWorld(true);
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const l = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), new THREE.LineBasicMaterial({ color: 0x4a3f3a }));
        l.applyMatrix4(o.matrixWorld); edges.add(l);
      });
      scene.add(edges);
    }
    const box = new THREE.Box3().setFromObject(obj);
    box.getCenter(center); radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
    baseDist = radius * 4.2; view.dist = baseDist;
    camera.near = radius / 200; camera.far = radius * 100; camera.updateProjectionMatrix();
    axis = 'none'; cutV = 1; wire = false;
    applyCut(); applyWire();
  }

  function placeCamera() {
    const { az, el, dist } = view;
    camera.position.set(center.x + dist * Math.cos(el) * Math.sin(az), center.y + dist * Math.sin(el), center.z + dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(center);
  }
  function resize() {
    const w = host.clientWidth || 300, h = host.clientHeight || 300;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true; requestRender();
  }
  function frame() { raf = 0; if (disposed) return; if (dirty) { placeCamera(); renderer.render(scene, camera); dirty = false; } }
  function requestRender() { if (!raf && !disposed) raf = requestAnimationFrame(frame); }

  const PRESETS = { iso: [-0.55, 0.5], top: [0, Math.PI / 2 - 0.001], front: [0, 0], side: [Math.PI / 2, 0] };
  function preset(name) { const [az, e] = PRESETS[name] || PRESETS.iso; view.az = az; view.el = e; view.dist = baseDist; dirty = true; requestRender(); }
  attachOrbit(renderer.domElement, view, { getBase: () => baseDist, onChange: () => { dirty = true; requestRender(); }, onReset: () => preset('iso') });
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  return {
    setModel,
    info: () => info,
    setAxis(a) { axis = a; applyCut(); },
    setCut(v) { cutV = Math.max(0, Math.min(1, v)); applyCut(); },
    setWire(on) { wire = on; applyWire(); },
    setEdges(on) { edgesOn = on; applyWire(); },
    preset,
    dispose() { disposed = true; ro.disconnect(); cancelAnimationFrame(raf); renderer.dispose(); renderer.domElement.remove(); },
  };
}
