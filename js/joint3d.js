// 3D 旋轉檢視（three.js）。單指旋轉、雙指縮放，可拆開、剖切。需要時才載入（見 joint-ui.js）。
// 只在有變化時才重繪，閒置時不耗電。
import * as THREE from '../lib/three.module.min.js';
import { jointModel } from './joint3d-geom.js';

const COL = { a: 0xb5a199, b: 0xc6cbd0, pin: 0x8a5a2b, edge: 0x4a3f3a, hole: 0x8a5a2b };

export function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/** 在 host 裡建立檢視器；回傳 { update(id, D), setExplode(bool), setCut(0..1), preset(name), dispose() } */
export function createViewer(host, id, D) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  host.append(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 100000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a70, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-1, 2, 1.2); scene.add(sun);

  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, clippingPlanes: [cutPlane] });
  const edgeMat = new THREE.LineBasicMaterial({ color: COL.edge, clippingPlanes: [cutPlane] });
  const holeMat = new THREE.LineBasicMaterial({ color: COL.hole, clippingPlanes: [cutPlane] });

  let group = null, parts = null, curId = id, curD = D;
  const view = { az: -0.55, el: 0.5, dist: 1, target: new THREE.Vector3() };
  let explode = 0, explodeTo = 0, cut = 1, dirty = true, raf = 0, disposed = false, baseDist = 1;

  function build(jid, Dmm) {
    if (group) { scene.remove(group); group.traverse((o) => { o.geometry?.dispose(); }); }
    curId = jid; curD = Dmm;
    const m = jointModel(jid, Dmm);
    group = new THREE.Group();
    const memberObjs = {};
    m.members.forEach((mem) => {
      const g = new THREE.Group();
      for (const pc of mem.pieces) {
        const shape = new THREE.Shape(pc.poly.map(([x, y]) => new THREE.Vector2(x, y)));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: pc.y1 - pc.y0, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);            // 平面 y → −Z，拉伸方向 → 向上（Y）
        geo.translate(0, pc.y0, 0);
        const mesh = new THREE.Mesh(geo, mat(COL[mem.color]));
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat));
        g.add(mesh);
      }
      memberObjs[mem.name] = g;
      group.add(g);
    });
    // 栓孔位置：在材面畫方框，框線掛在各自的材上，拆開時跟著材走（不會留在原地與別的零件重疊）
    for (const hl of m.holes) {
      const h = hl.size / 2, y0 = Dmm / 2;
      const pts = [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]].map(([a, b]) => new THREE.Vector3(hl.x + a, y0 + b, hl.zFace * (Dmm / 2) * 1.001));
      memberObjs[hl.member].add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), holeMat));
    }
    const pinMeshes = m.pins.map((p) => {
      const geo = new THREE.BoxGeometry(p.size, p.size, Dmm * 1.08);
      const mesh = new THREE.Mesh(geo, mat(COL.pin));
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
      mesh.position.set(p.x, Dmm / 2, 0);
      return mesh;
    });
    for (const pm of pinMeshes) group.add(pm);
    group.position.set(-m.cx, -Dmm / 2, 0);
    scene.add(group);
    parts = { m, memberObjs, pins: pinMeshes, names: m.members.map((x) => x.name) };
    baseDist = Math.max(8 * Dmm, (m.x1 - m.x0) * 2.4);
    view.dist = baseDist; view.target.set(0, 0, 0);
    applyExplode(); dirty = true; requestRender();
  }

  function applyExplode() {
    if (!parts) return;
    const { m, memberObjs, pins, names } = parts, k = explode;
    memberObjs[names[0]].position.x = -k * m.explodeDx;
    memberObjs[names[1]].position.x = k * m.explodeDx;
    for (const p of pins) p.position.z = k * m.pinDz;
    applyCut();
  }
  function applyCut() {
    // 沿材寬（z）方向剖切：只顯示 z ≤ 切面的部分；cut=1 時切面在材外，等於完全不切
    // 拆開時，被抽出的栓在材外，切面要跟著放寬，否則栓會被切掉
    cutPlane.constant = (cut - 0.5) * curD + 0.02 * curD + explode * curD * 2;
  }

  function placeCamera() {
    const { az, el, target } = view, dist = view.dist * (1 + 0.45 * explode);   // 拆開時自動拉遠，才看得到全部
    camera.position.set(target.x + dist * Math.cos(el) * Math.sin(az), target.y + dist * Math.sin(el), target.z + dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(target);
  }
  function resize() {
    const w = host.clientWidth || 300, h = host.clientHeight || 300;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true; requestRender();
  }
  function frame() {
    raf = 0;
    if (disposed) return;
    if (Math.abs(explodeTo - explode) > 0.002) { explode += (explodeTo - explode) * 0.22; applyExplode(); dirty = true; } else if (explode !== explodeTo) { explode = explodeTo; applyExplode(); dirty = true; }
    if (dirty) { placeCamera(); renderer.render(scene, camera); dirty = false; }
    if (explode !== explodeTo) requestRender();
  }
  function requestRender() { if (!raf && !disposed) raf = requestAnimationFrame(frame); }

  // ── 操作：單指旋轉、雙指縮放、滾輪縮放、雙擊重置 ──
  const el = renderer.domElement, ptrs = new Map();
  let last = null, pinch0 = 0, dist0 = 0;
  const clampEl = (v) => Math.max(-1.45, Math.min(1.45, v));
  const clampDist = (v) => Math.max(baseDist * 0.3, Math.min(baseDist * 3, v));
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = view.dist; } });
  el.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch0 > 0) view.dist = clampDist(dist0 * pinch0 / d);
    } else if (last) {
      view.az -= (e.clientX - last[0]) * 0.008; view.el = clampEl(view.el + (e.clientY - last[1]) * 0.008);
    }
    last = [e.clientX, e.clientY]; dirty = true; requestRender();
  });
  const up = (e) => { ptrs.delete(e.pointerId); last = ptrs.size === 1 ? [...ptrs.values()][0] : null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => { e.preventDefault(); view.dist = clampDist(view.dist * Math.exp(e.deltaY * 0.0012)); dirty = true; requestRender(); }, { passive: false });
  el.addEventListener('dblclick', () => preset('iso'));

  const PRESETS = { iso: [-0.55, 0.5], plan: [0, Math.PI / 2 - 0.001], side: [0, 0] };
  function preset(name) { const [az, e] = PRESETS[name] || PRESETS.iso; view.az = az; view.el = e; view.dist = baseDist; dirty = true; requestRender(); }

  const ro = new ResizeObserver(resize); ro.observe(host);
  build(id, D); resize();

  return {
    update(jid, Dmm) { if (jid !== curId || Dmm !== curD) build(jid, Dmm); },
    setExplode(on) { explodeTo = on ? 1 : 0; requestRender(); },
    setCut(v) { cut = Math.max(0, Math.min(1, v)); applyCut(); dirty = true; requestRender(); },
    preset,
    dispose() { disposed = true; ro.disconnect(); cancelAnimationFrame(raf); renderer.dispose(); renderer.domElement.remove(); },
    // 測試用：回傳各零件在世界座標下的包圍盒
    _boxes: () => {
      group.updateMatrixWorld(true);
      const out = {};
      parts.names.forEach((n) => { const b = new THREE.Box3().setFromObject(parts.memberObjs[n]); out[n] = { min: b.min.toArray(), max: b.max.toArray() }; });
      out.pins = parts.pins.map((p) => { const b = new THREE.Box3().setFromObject(p); return { min: b.min.toArray(), max: b.max.toArray() }; });
      return out;
    },
  };
}
