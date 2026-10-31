// 觸控／滑鼠軌道控制：單指旋轉、雙指縮放、滾輪縮放、雙擊重置。
// view = { az, el, dist }（弧度、距離）；getBase() 回傳基準距離（用來限制縮放範圍）。
export function attachOrbit(el, view, { getBase, onChange, onReset }) {
  const ptrs = new Map();
  let last = null, pinch0 = 0, dist0 = 0;
  const clampEl = (v) => Math.max(-1.45, Math.min(1.45, v));
  const clampDist = (v) => { const b = getBase(); return Math.max(b * 0.3, Math.min(b * 3, v)); };
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY];
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = view.dist; }
  });
  el.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch0 > 0 && d > 0) view.dist = clampDist(dist0 * pinch0 / d);
    } else if (last) {
      view.az -= (e.clientX - last[0]) * 0.008; view.el = clampEl(view.el + (e.clientY - last[1]) * 0.008);
    }
    last = [e.clientX, e.clientY]; onChange();
  });
  const up = (e) => { ptrs.delete(e.pointerId); last = ptrs.size === 1 ? [...ptrs.values()][0] : null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => { e.preventDefault(); view.dist = clampDist(view.dist * Math.exp(e.deltaY * 0.0012)); onChange(); }, { passive: false });
  el.addEventListener('dblclick', onReset);
}
