// 計算機的圖示：全部是純函式，輸入數字、輸出 SVG 字串（不碰 DOM）。
// 圖會跟著使用者輸入的數字改變比例；沒有數字時畫示意圖並用符號標示。
import { fmtMm, splitShaku, SHAKU_MM } from './units.js';

const r1 = (v) => Math.round(v * 10) / 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const L = (mm) => fmtMm(mm, Math.abs(mm) >= 100 ? 0 : 1);
const n1 = (v) => `${+Number(v).toFixed(1)}`;
const n2 = (v) => `${+Number(v).toFixed(2)}`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const SQ2 = Math.SQRT2;

/** 估計文字寬度（CJK 約 11px、其他約 6.2px），用來避免文字跑出畫面 */
export const textWidth = (s) => [...String(s)].reduce((w, ch) => w + (ch.codePointAt(0) > 0x2e7f ? 11 : 6.2), 0);

export const line = (x1, y1, x2, y2, cls = 'dim') => `<line class="${cls}" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}"/>`;
export const poly = (pts, cls = 'ln') => `<polygon class="${cls}" points="${pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(' ')}"/>`;
export const rect = (x, y, w, h, cls = 'ln', rx = 0) => `<rect class="${cls}" x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"${rx ? ` rx="${rx}"` : ''}/>`;
const circle = (cx, cy, r, cls = 'ln') => `<circle class="${cls}" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}"/>`;
const path = (d, cls = 'ang') => `<path class="${cls}" d="${d}"/>`;
export const text = (x, y, s, anchor = 'middle', cls = '') =>
  `<text x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}"${cls ? ` class="${cls}"` : ''}>${esc(s)}</text>`;
const rotText = (x, y, s, deg, cls = '') =>
  `<text x="${r1(x)}" y="${r1(y)}" text-anchor="middle" transform="rotate(${r1(deg)} ${r1(x)} ${r1(y)})"${cls ? ` class="${cls}"` : ''}>${esc(s)}</text>`;
/** 直角記號（頂點在 (x,y)，兩邊朝 (dx,dy) 與 (ex,ey) 方向） */
const rightMark = (x, y, dx, dy, ex, ey, s = 9) =>
  path(`M${r1(x + dx * s)},${r1(y + dy * s)} L${r1(x + (dx + ex) * s)},${r1(y + (dy + ey) * s)} L${r1(x + ex * s)},${r1(y + ey * s)}`);

/** 圖框：回傳完整 <figure>。vb = [寬, 高] */
export function box(vb, body, label, caption = '') {
  return `<figure class="figbox"><svg class="fig big" viewBox="0 0 ${vb[0]} ${vb[1]}" role="img" aria-label="${esc(label)}">${body}</svg>${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
}

/** 底部的數值列：放不下就自動換行 */
export function legend(vbW, y0, items) {
  const rows = [[]]; let w = 0;
  for (const it of items) {
    const iw = textWidth(it) + 18;
    if (w + iw > vbW - 24 && rows[rows.length - 1].length) { rows.push([]); w = 0; }
    rows[rows.length - 1].push(it); w += iw;
  }
  return rows.map((row, i) => text(12, y0 + i * 14, row.join('　'), 'start', 't2')).join('');
}

/* ───────────────────── 屋頂坡度 ───────────────────── */

/** 屋頂剖面：水平長、立上高、椽木實長、角度 */
export function roofSection({ x, a = null, rise = null, rafter = null, angleDeg, sample = false }) {
  const vbW = 360, ox = 30, oy = 146;
  const t = x / 10;
  let w = 200, h = w * t;
  if (h > 100) { h = 100; w = h / t; }
  h = Math.max(h, 1.5);
  const bx = ox + w, ty = oy - h, th = Math.atan2(h, w), len = Math.hypot(w, h);
  const ar = Math.min(30, w * 0.5);
  const nx = -h / len, ny = -w / len; // 斜邊外側（左上）的單位法向量
  const hypLabel = '椽木';
  const hx = Math.max(ox + w / 2 + nx * 9, textWidth(hypLabel) + 6);
  const hy = oy - h / 2 + ny * 9;
  let b = poly([[ox, oy], [bx, oy], [bx, ty]], 'ln') + line(ox, oy, bx, ty, 'hyp');
  b += rect(ox - 6, oy - 6, 12, 12, 'ln') + rect(bx - 6, ty - 6, 12, 12, 'ln');
  b += rightMark(bx, oy, -1, 0, 0, -1);
  b += path(`M${r1(ox + ar)},${oy} A${r1(ar)},${r1(ar)} 0 0 0 ${r1(ox + ar * Math.cos(th))},${r1(oy - ar * Math.sin(th))}`);
  b += text(clamp(ox + w / 2, 70, 290), oy + 26, '水平長 a（股）') + text(bx + 10, oy - h / 2 + 4, '立上高（勾）', 'start');
  b += text(hx, hy, hypLabel, 'end') + text(ox + ar + 8, oy + 14, `${n2(angleDeg)}°`, 'start');
  b += text(2, oy - 14, '簷桁', 'start', 't2') + text(bx, ty - 12, '棟', 'middle', 't2');
  const nums = [];
  if (a != null) nums.push(`水平長 a = ${L(a)}`);
  if (rise != null) nums.push(`立上高 = ${L(rise)}`);
  if (rafter != null) nums.push(`椽木實長 = ${L(rafter)}`);
  if (sample) { nums.length = 0; nums.push('示意圖：輸入坡度後，會依你的坡度重新繪製'); } else nums.push(`坡度 ${n1(x)} 寸`);
  b += legend(vbW, 184, a != null && !sample ? [...nums, '（mm）'] : nums);
  return box([vbW, 204], b, '屋頂剖面：水平長、立上高、椽木實長與角度', '屋頂剖面（垂直於棟）：從簷桁往上到棟，水平走 a，立起 勾，椽木沿斜面實長為 弦。');
}

/** 角梁：左邊平面（為什麼是 a√2），右邊立面（角梁實長） */
export function hipSection({ x, a = null, planLen = null, rise = null, hipLen = null, hipAngleDeg, sample = false }) {
  const vbW = 360, oy = 140;
  // 平面
  const sx = 26, sy = 46, sz = 72;
  let b = text(sx + sz / 2, 32, '平面（俯視）', 'middle', 't2');
  b += rect(sx, sy, sz, sz, 'ln') + line(sx, sy + sz, sx + sz, sy, 'hyp');
  b += text(sx + sz / 2, sy + sz + 16, 'a', 'middle') + text(sx + sz + 6, sy + sz / 2 + 4, 'a', 'start');
  b += text(sx + sz + 4, sy + 6, 'a√2', 'start', 't2');
  b += path(`M${sx + 14},${sy + sz} A14,14 0 0 0 ${r1(sx + 14 * Math.cos(Math.PI / 4))},${r1(sy + sz - 14 * Math.sin(Math.PI / 4))}`);
  b += text(sx + 20, sy + sz - 18, '45°', 'start', 't2');
  // 立面
  const bx0 = 150, tt = x / Math.sqrt(200);
  let w = 160, h = w * tt;
  if (h > 92) { h = 92; w = h / tt; }
  h = Math.max(h, 1.5);
  const bx1 = bx0 + w, ty = oy - h, th = Math.atan2(h, w), len = Math.hypot(w, h);
  const ar = Math.min(28, w * 0.5);
  const hx = Math.max(bx0 + w / 2 - h / len * 9, bx0 + 4 + textWidth('角梁實長'));
  b += text(bx0 + 80, 32, '立面（沿角梁方向剖開）', 'middle', 't2');
  b += poly([[bx0, oy], [bx1, oy], [bx1, ty]], 'ln') + line(bx0, oy, bx1, ty, 'hyp');
  b += rightMark(bx1, oy, -1, 0, 0, -1);
  b += path(`M${r1(bx0 + ar)},${oy} A${r1(ar)},${r1(ar)} 0 0 0 ${r1(bx0 + ar * Math.cos(th))},${r1(oy - ar * Math.sin(th))}`);
  b += text(clamp(bx0 + w / 2, 205, 300), oy + 24, '角梁平面長 a√2') + text(bx1 + 8, oy - h / 2 + 4, '立上高', 'start');
  b += text(hx, oy - h / 2 - w / len * 9, '角梁實長', 'end') + text(bx0 + ar + 8, oy + 13, `${n2(hipAngleDeg)}°`, 'start', 't2');
  const nums = [];
  if (a != null) nums.push(`a = ${L(a)}`);
  if (planLen != null) nums.push(`a√2 = ${L(planLen)}`);
  if (rise != null) nums.push(`立上高 = ${L(rise)}`);
  if (hipLen != null) nums.push(`角梁實長 = ${L(hipLen)}`);
  b += legend(vbW, 182, !sample && nums.length ? [...nums, '（mm）'] : ['勾 = 立上高；水平股 = a√2；弦 = √(200 + 勾²)']);
  return box([vbW, 204], b, '角梁：平面長 a√2、立上高與角梁實長', '45° 的角梁，平面長度是單邊水平長的 √2 倍；再和立上高組成直角三角形，斜邊就是角梁實長。');
}

/** 配付垂木平面圖：逐支往角梁方向遞減。沒有數字時畫示意圖。 */
export function haitsukePlan({ first = null, pitch = null, decrement = null, count = null } = {}) {
  const vbW = 360, cx = 36, cy = 168, maxPx = 130;
  const symbolic = first == null || pitch == null || !(first > 0) || !(pitch > 0);
  const f = symbolic ? 6 : first, p = symbolic ? 1 : pitch;
  const total = symbolic ? 6 : Math.max(1, Math.min(count ?? Math.ceil(f / p), 60));
  const s = maxPx / f;
  const runs = [];
  for (let i = 0; i < total; i++) { const r = f - i * p; if (r <= 1e-9) break; runs.push(r); }
  const n = runs.length;
  const x1 = cx + f * s, ytop = cy - f * s;
  let b = line(cx - 8, cy, x1 + 28, cy, 'ln') + text(x1 + 32, cy + 4, '屋簷線', 'start', 't2');
  b += line(cx, cy, cx, ytop - 6, 'dim') + line(cx, cy, x1, ytop, 'hyp');
  runs.forEach((r, i) => { const x = cx + r * s; b += line(x, cy, x, cy - r * s, i === 0 ? 'rf1' : 'rf'); });
  b += rotText(cx + f * s / 2 - 12, cy - f * s / 2 - 6, '角梁', -45, 't2');
  b += text(x1, ytop - 8, '第 1 支（最長）', 'middle');
  const gap = p * s;
  if (n >= 3 && gap >= 9) b += text(cx + runs[n - 1] * s, cy - runs[n - 1] * s - 6, `第 ${n} 支`, 'middle', 't2');
  if (n >= 2 && gap >= 10) {
    const xa = cx + runs[1] * s, xb = cx + runs[0] * s;
    b += line(xa, cy + 10, xb, cy + 10, 'dim') + line(xa, cy + 6, xa, cy + 14, 'dim') + line(xb, cy + 6, xb, cy + 14, 'dim');
    b += text((xa + xb) / 2, cy + 24, '間距', 'middle', 't2');
  }
  const lx = 228;
  if (symbolic) {
    b += text(lx, 72, '椽木間距 p（水平）', 'start') + text(lx, 92, '每支水平短 p', 'start') + text(lx, 112, '實長每支減', 'start') + text(lx, 128, '= p × 伸長率', 'start');
  } else {
    b += text(lx, 72, `共 ${n} 支`, 'start') + text(lx, 92, `間距（水平）${L(p)}`, 'start');
    if (decrement != null) b += text(lx, 112, `實長每支減 ${L(decrement)}`, 'start');
    b += text(lx, 132, '（mm）', 'start', 't2');
  }
  return box([vbW, 204], b, '配付垂木平面圖：椽木往角梁方向逐支變短', '俯視一個轉角：椽木垂直於屋簷線排列，越靠近角梁越短，每支短一個間距（水平）；實長每支減 間距 × 伸長率。');
}

/* ───────────────────── 弧線半徑 ───────────────────── */

/** 弧與弦等分點：c、h、R、中心角、各分點高度 */
export function arcFigure({ c, h, R, thetaDeg, n = 8, offsets = null }) {
  const vbW = 360, x0 = 40, x1 = 320, y0 = 118, cw = x1 - x0;
  const trueH = (h / c) * cw;
  const ht = clamp(trueH, 30, 78);
  const ex = ht / trueH;
  const Rs = (cw * cw / 4 + ht * ht) / (2 * ht);
  const cxm = (x0 + x1) / 2, base = Rs - ht;
  const yAt = (x) => y0 - (Math.sqrt(Math.max(0, Rs * Rs - (x - cxm) * (x - cxm))) - base);
  const nn = clamp(Math.round(n), 2, 40);
  let b = path(`M${x0},${y0} A${r1(Rs)},${r1(Rs)} 0 0 1 ${x1},${y0} Z`, 'ln');
  for (let i = 0; i <= nn; i++) {
    const x = x0 + (cw * i) / nn, y = yAt(x);
    b += line(x, y0, x, y, 'dim');
    if (i > 0 && i < nn) b += circle(x, y, 2.2, 'dot');
    if (nn <= 16 && i > 0 && i < nn) b += text(x, y - 6, String(i), 'middle', 't3');
  }
  b += line(cxm, y0, cxm, y0 - ht, 'hyp');
  b += text(cxm + 8, y0 - ht / 2 + 4, 'h 弧高', 'start');
  b += line(x0, y0 + 14, x1, y0 + 14, 'dim') + line(x0, y0 + 9, x0, y0 + 19, 'dim') + line(x1, y0 + 9, x1, y0 + 19, 'dim');
  b += text(cxm, y0 + 30, 'c 弦長');
  b += text(vbW - 8, 22, `R 半徑 ${L(R)}`, 'end') + text(vbW - 8, 38, `中心角 ${n1(thetaDeg)}°`, 'end');
  b += text(vbW - 8, 54, `h = ${L(h)}　c = ${L(c)}`, 'end', 't2');
  if (ex > 1.1) b += text(8, 22, `示意圖：弧高放大約 ${n1(ex)} 倍`, 'start', 't2');
  let cap = `弦等分成 ${nn} 段，各分點到弧面的高度就是「分點高度表」；圓心在弧的下方，距離弦線 R − h。`;
  if (offsets && offsets.length) cap += `（最大 ${L(Math.max(...offsets))} mm 在正中央）`;
  return box([vbW, 160], b, '弧與弦等分點示意圖', cap);
}

/** 概念圖：圓心、半徑、中心角、弦、弧高（固定角度，不依輸入變動） */
export function arcConcept() {
  const R = 100, th = (50 * Math.PI) / 180, ox = 150, oy = 56;
  const ax = ox - R * Math.sin(th), ay = oy + R * Math.cos(th), bx = ox + R * Math.sin(th), my = oy + R;
  let b = path(`M${r1(ax)},${r1(ay)} A${R},${R} 0 0 0 ${r1(bx)},${r1(ay)}`, 'ln');
  b += line(ox, oy, ax, ay, 'dim') + line(ox, oy, bx, ay, 'dim') + line(ax, ay, bx, ay, 'ln') + line(ox, ay, ox, my, 'hyp');
  b += circle(ox, oy, 3, 'dot');
  b += path(`M${r1(ox - 22 * Math.sin(th))},${r1(oy + 22 * Math.cos(th))} A22,22 0 0 0 ${r1(ox + 22 * Math.sin(th))},${r1(oy + 22 * Math.cos(th))}`);
  b += text(ox, oy - 8, 'O 圓心') + text(ox, oy + 42, 'θ 中心角', 'middle', 't2');
  b += text((ox + ax) / 2 - 10, (oy + ay) / 2, 'R', 'end') + text((ox + bx) / 2 + 10, (oy + ay) / 2, 'R', 'start');
  b += text(ox, ay - 8, 'c 弦長') + text(ox + 8, (ay + my) / 2 + 4, 'h 弧高', 'start');
  b += text(ox, 192, 'R = (c² ÷ 4 + h²) ÷ 2h', 'middle', 't2');
  return box([300, 204], b, '弧的概念圖：圓心、半徑、中心角、弦長、弧高', '弧是一個大圓的一小段：量得弦長 c 和弧高 h，就能反推出這個圓的半徑 R。');
}

/* ───────────────────── 對角線・抓直角 ───────────────────── */

/** 矩形與對角線（比例依實際輸入；長寬比超過 4:1 時壓縮） */
export function diagFigure({ a = null, b: bb = null, d = null } = {}) {
  const vbW = 360;
  const symbolic = !(a > 0 && bb > 0);
  const ratio = symbolic ? 1.6 : clamp(bb / a, 0.25, 4);
  const W = Math.min(250, 100 * ratio) , H = W / ratio;
  const X0 = 56, Y0 = 20;
  let s = rect(X0, Y0, W, H, 'ln') + line(X0, Y0, X0 + W, Y0 + H, 'hyp') + rightMark(X0, Y0 + H, 1, 0, 0, -1);
  s += text(X0 + W / 2, Y0 + H + 18, symbolic ? '長邊' : `長邊　${L(bb)}`);
  s += text(X0 - 6, Y0 + H / 2 - 2, '短邊', 'end');
  if (!symbolic) s += text(X0 - 6, Y0 + H / 2 + 12, L(a), 'end', 't2');
  s += text(clamp(X0 + W / 2 + 12, 120, 330), Y0 + H / 2 - 8, symbolic ? '對角線' : `對角線 ${d != null ? L(d) : ''}`, 'start');
  return box([vbW, Math.round(Y0 + H + 34)], s, '矩形與對角線', '對角線 = √(短邊² + 長邊²)。');
}

/** 抓直角檢查：兩條對角線一樣長就是直角；不一樣時圖會（放大）歪給你看 */
export function squareCheck({ d1 = null, d2 = null } = {}) {
  const vbW = 360, X0 = 80, Y0 = 26, W = 200, H = 96;
  const has = d1 != null && d2 != null;
  const diff = has ? d1 - d2 : 0;
  const off = has && Math.abs(diff) >= 0.5 ? Math.sign(diff) * clamp(Math.abs(diff) * 1.2, 5, 28) : 0;
  // d1 = 左上→右下，d2 = 右上→左下。d1 較長 → 把上緣往左、下緣往右推（左上、右下被拉遠）
  const TL = [X0 - off, Y0], TR = [X0 + W - off, Y0], BL = [X0 + off, Y0 + H], BR = [X0 + W + off, Y0 + H];
  let b = poly([TL, TR, BR, BL], 'ln');
  b += line(TL[0], TL[1], BR[0], BR[1], 'hyp') + line(TR[0], TR[1], BL[0], BL[1], 'dash2');
  b += text(TL[0] + 18, TL[1] + 18, '①', 'middle') + text(TR[0] - 18, TR[1] + 18, '②', 'middle');
  if (off === 0) b += rightMark(BL[0], BL[1], 1, 0, 0, -1) + rightMark(BR[0], BR[1], -1, 0, 0, -1);
  let status, cls = '';
  if (!has) status = '兩條對角線一樣長 → 四個角都是直角';
  else if (off === 0) { status = `① ② 一致（差 ${n1(Math.abs(diff))} mm 以內）→ 直角 ✓`; cls = 'good'; }
  else { status = `差 ${L(Math.abs(diff))} mm（${diff > 0 ? '①' : '②'} 較長）→ 還不是直角；圖已放大歪斜`; cls = 'bad'; }
  b += text(vbW / 2, Y0 + H + 28, status, 'middle', cls);
  return box([vbW, Y0 + H + 42], b, '抓直角檢查：量兩條對角線', '量矩形的兩條對角線 ① ②，一樣長，四個角就是直角；差越多，歪得越厲害。');
}

/** 3-4-5 法 */
export function tri345() {
  const A = [60, 96], B = [180, 96], C = [60, 6];
  let b = poly([A, B, C], 'ln') + line(C[0], C[1], B[0], B[1], 'hyp') + rightMark(A[0], A[1], 1, 0, 0, -1);
  b += text(A[0] - 8, 54, '3', 'end') + text(120, 114, '4') + text(132, 44, '5', 'start');
  b += text(206, 40, '量 3 尺、4 尺，', 'start') + text(206, 58, '斜邊剛好 5 尺', 'start') + text(206, 76, '→ 就是直角', 'start');
  b += text(206, 96, '可同乘倍數：6-8-10', 'start', 't2');
  return box([360, 124], b, '3-4-5 法抓直角', '現場抓直角：兩邊量 3 與 4（任何同一單位，也可同乘倍數），斜邊是 5，就是直角。');
}

/* ───────────────────── 台尺混算 ───────────────────── */

/** 丈、間、尺、寸、分的長度關係（依比例畫） */
export function unitLadder() {
  const X = 30, S = 30; // 1 尺 = 30px
  let b = '';
  const bar = (y, units, label, cls, ticks, tickEvery) => {
    b += text(X, y - 8, label, 'start');
    b += rect(X, y, units * S, 14, cls);
    for (let i = 1; i < ticks; i++) b += line(X + i * tickEvery, y, X + i * tickEvery, y + (i % 5 === 0 ? 14 : 8), 'dim');
  };
  bar(34, 10, `1 丈 = 10 尺 ≈ ${n1(10 * SHAKU_MM)} mm`, 'ln', 10, S);
  bar(72, 6, `1 間 = 6 尺 ≈ ${n1(6 * SHAKU_MM)} mm`, 'ln', 6, S);
  bar(120, 10, `1 尺 放大 10 倍：1 尺 = 10 寸 ≈ ${n1(SHAKU_MM)} mm`, 'ln', 10, S);
  b += rect(X, 120, 10 * S, 14, 'ln');
  b += text(X, 156, '1 寸 = 10 分 ≈ 30.3 mm；1 分 = 10 厘 ≈ 3.03 mm', 'start', 't2');
  return box([360, 172], b, '丈、間、尺、寸、分的長度關係', '三條長條依同一比例（1 尺 = 30 px）；第三條是 1 尺放大 10 倍，看清楚 10 寸的刻度。');
}

/** 算出來的長度由幾丈幾尺幾寸幾分組成（各段依長度比例） */
export function composition(mm) {
  const vbW = 360, X = 30, W = 300, Y = 30;
  if (!Number.isFinite(mm) || Math.abs(mm) < 1e-9) return '';
  const p = splitShaku(mm, 10);
  const segs = [
    { k: '丈', v: p.big, len: p.big * 10 }, { k: '尺', v: p.shaku, len: p.shaku },
    { k: '寸', v: p.sun, len: p.sun * 0.1 }, { k: '分', v: p.bun, len: p.bun * 0.01 },
  ];
  const total = segs.reduce((s, g) => s + g.len, 0) || 1;
  let b = text(X, 20, '依長度比例，由大到小：', 'start', 't2');
  let x = X;
  segs.forEach((g, i) => {
    const w = g.len > 0 ? Math.max(3, (g.len / total) * W) : 0;
    if (w) { b += rect(x, Y, w, 22, `seg seg${i}`); x += w; }
  });
  const cols = [X, X + 78, X + 156, X + 234];
  segs.forEach((g, i) => {
    b += rect(cols[i], 74, 10, 10, `seg seg${i}`) + text(cols[i] + 16, 83, `${g.v} ${g.k}`, 'start');
  });
  return box([vbW, 96], b, '長度由丈、尺、寸、分組成', '');
}

/* ───────────────────── 魯班尺 ───────────────────── */

/** 字位條：每個字一段（吉＝紅、凶＝黑），標出目前落點 */
export function lubanBar(ruler, check) {
  const vbW = 360, X = 12, W = 336, Y = 30, H = 22;
  const n = ruler.bands.length, bw = W / n;
  let b = '';
  ruler.bands.forEach((name, i) => {
    const good = ruler.good.includes(name);
    b += rect(X + i * bw, Y, bw, H, good ? 'lb-good' : 'lb-bad');
    b += text(X + i * bw + bw / 2, Y + 15, name, 'middle', 'lb-t');
  });
  const mx = X + (check.r / check.cycleMm) * W;
  b += `<polygon class="lb-mark" points="${r1(mx)},${Y - 2} ${r1(mx - 6)},${Y - 12} ${r1(mx + 6)},${Y - 12}"/>`;
  b += text(clamp(mx, 40, vbW - 40), Y - 16, `${n1(check.r)} mm`, 'middle', 't2');
  b += text(X, Y + H + 14, '0', 'start', 't3') + text(X + W, Y + H + 14, `${n1(check.cycleMm)} mm`, 'end', 't3');
  return box([vbW, Y + H + 22], b, `${ruler.name}字位條`, '');
}
