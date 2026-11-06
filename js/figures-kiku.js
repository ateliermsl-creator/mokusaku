// 規矩術工具的示意圖（純函式，輸入數字、輸出 SVG 字串）。圖是示意，尺寸以數值為準。
import { box, line, poly, rect, text, legend, textWidth } from './figures.js';

const r1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const path = (d, cls = 'ang') => `<path class="${cls}" d="${d}"/>`;
const mark = (x, y, dx, dy, ex, ey, s = 8) =>
  path(`M${r1(x + dx * s)},${r1(y + dy * s)} L${r1(x + (dx + ex) * s)},${r1(y + (dy + ey) * s)} L${r1(x + ex * s)},${r1(y + ey * s)}`);
const arc = (cx, cy, r, a0, a1) => {       // 角度弧（a0→a1，弧度，數學座標：逆時針為正、y 向上）
  const p = (a) => `${r1(cx + r * Math.cos(a))},${r1(cy - r * Math.sin(a))}`;
  return path(`M${p(a0)} A${r1(r)},${r1(r)} 0 0 ${a1 > a0 ? 0 : 1} ${p(a1)}`);
};

/** 直角三角形：殳（水平）、勾（垂直）、玄（斜邊）；split＝true 時畫中勾與長玄・短玄 */
export function triangleFigure({ n = 4, split = false, labels = {}, nums = [], angleText = '' } = {}) {
  const vbW = 360, ox = 34, oy = 150;
  const t = Math.max(n, 0.05) / 10;
  let w = 240, h = w * t;
  if (h > 110) { h = 110; w = h / t; }
  w = Math.max(w, 40); h = Math.max(h, 2);
  const bx = ox + w, ty = oy - h, len = Math.hypot(w, h), th = Math.atan2(h, w);
  const nx = -h / len, ny = -w / len;                 // 斜邊外側法向量（左上）
  let b = poly([[ox, oy], [bx, oy], [bx, ty]], 'ln') + line(ox, oy, bx, ty, 'hyp') + mark(bx, oy, -1, 0, 0, -1);
  const ar = Math.min(30, w * 0.4);
  b += arc(ox, oy, ar, 0, th);
  b += text(clamp(ox + w / 2, 60, 300), oy + 22, labels.den || '殳（水平）');
  b += text(Math.min(bx + 8, vbW - 4 - textWidth(labels.kou || '勾')), oy - h / 2 + 4, labels.kou || '勾', 'start');
  const gl = labels.gen || '玄';
  b += text(clamp(ox + w / 2 + nx * 14, 4 + textWidth(gl), vbW - 4), clamp(oy - h / 2 + ny * 14, 14, oy - 4), gl, 'end');
  if (angleText) b += text(Math.min(ox + ar + 6, vbW - 4 - textWidth(angleText)), oy - 6, angleText, 'start', 't2');
  if (split) {
    // 從直角頂點 (bx, oy) 向斜邊作垂線，垂足 F
    const k = (w * w) / (len * len);                   // OF / OT
    const fx = ox + w * k, fy = oy - h * k;
    b += line(bx, oy, fx, fy, 'dash2');
    const ux = w / len, uy = -h / len;                 // 斜邊方向（螢幕座標）
    b += mark(fx, fy, -ux, -uy, (bx - fx) / Math.hypot(bx - fx, oy - fy), (oy - fy) / Math.hypot(bx - fx, oy - fy), 6);
    const lab = (s, x, y, anchor = 'middle') => text(clamp(x, 4 + (anchor === 'middle' ? textWidth(s) / 2 : 0), vbW - 4 - (anchor === 'middle' ? textWidth(s) / 2 : textWidth(s))), clamp(y, 14, 186), s, anchor, 't2');
    b += lab('長玄', (ox + fx) / 2 + 14, (oy + fy) / 2 + 16);
    b += lab('短玄', (fx + bx) / 2 - nx * 0 - 10, (fy + ty) / 2 - 8);
    b += lab('中勾', (fx + bx) / 2 - 6, (fy + oy) / 2 + 12, 'end');   // 放在垂線左側，避開右邊的「勾」標籤
  }
  b += legend(vbW, 192, nums.length ? nums : ['示意圖：輸入數值後會依比例重新繪製']);
  return box([vbW, nums.length > 2 ? 226 : 212], b, split ? '勾股玄與中勾・長玄・短玄' : '直角三角形：殳、勾、玄', '圖為示意，尺寸以下方數值為準。');
}

/**
 * 角梁・谷木：
 *  左上＝L 型屋頂全圖：外凸的屋角是角梁（出隅），凹進去的屋角是谷木（入隅）；目前選的那一種用主色。
 *  右上＝轉角放大（俯視）：灰底是屋面，振れ角 α 從垂直於簷桁的方向量起（45° 為真隅）。
 *  下＝沿角梁（谷木）剖開的立面：平面長與立上高。
 */
export function sumiFigure({ alphaDeg = 45, n = 4, kind = 'de', nums = [], hipText = '' } = {}) {
  const vbW = 360, tani = kind === 'tani';
  const name = tani ? '谷木' : '角梁';
  const a = clamp(alphaDeg, 1, 89) * Math.PI / 180;
  let b = '';

  // ── 左上：L 型屋頂全圖（單位格 u）──
  const u = 9.5, kx = 14, ky = 34;
  const P = (x, y) => [kx + x * u, ky + y * u];
  const L = (x1, y1, x2, y2, c) => { const [X1, Y1] = P(x1, y1), [X2, Y2] = P(x2, y2); return line(X1, Y1, X2, Y2, c); };
  b += text(kx, 22, 'L 型屋頂全圖', 'start', 't2');
  b += poly([[0, 0], [4, 0], [4, 6], [12, 6], [12, 10], [0, 10]].map(([x, y]) => P(x, y)), 'ln');
  b += L(2, 2, 2, 8, 'dim') + L(2, 8, 10, 8, 'dim');                                  // 屋脊
  const hips = [[0, 0, 2, 2], [4, 0, 2, 2], [12, 6, 10, 8], [12, 10, 10, 8], [0, 10, 2, 8]];
  for (const [x1, y1, x2, y2] of hips) b += L(x1, y1, x2, y2, tani ? 'rf' : 'hyp');  // 角梁：外凸角
  b += L(4, 6, 2, 8, tani ? 'hyp' : 'rf');                                              // 谷木：凹角
  const ring = (x, y) => { const [X, Y] = P(x, y); return `<circle class="ang" cx="${r1(X)}" cy="${r1(Y)}" r="7"/>`; };
  b += tani ? ring(4, 6) : ring(12, 10);
  b += text(P(12, 10)[0] - 2, P(12, 10)[1] + 14, '角梁＝外凸角', 'end', 't3');
  b += text(P(4, 6)[0] + 6, P(4, 6)[1] - 6, '谷木＝凹角', 'start', 't3');

  // ── 右上：轉角放大（俯視）──
  const dx0 = 168, dy0 = 28, dw = 180, dh = 132;
  b += text(dx0 + dw / 2, 22, tani ? '凹角放大（入隅）' : '外凸角放大（出隅）', 'middle', 't2');
  let S = 70, Hh = S * Math.tan(a);
  if (Hh > 80) { Hh = 80; S = Hh / Math.tan(a); }
  if (!tani) {
    // 屋面在轉角的右上方；角梁往右上走
    const cx = dx0 + 22, cy = dy0 + dh - 10;
    b += poly([[cx, cy], [dx0 + dw, cy], [dx0 + dw, dy0 + 8], [cx, dy0 + 8]], 'ln');
    b += line(cx, cy, dx0 + dw, cy, 'ln') + line(cx, cy, cx, dy0 + 8, 'ln');
    const px = cx + Hh, py = cy - S;
    b += line(cx, cy, px, py, 'hyp') + line(px, cy, px, py, 'dim');
    b += text(dx0 + dw - 2, cy + 14, '簷桁', 'end', 't2') + text(cx - 4, dy0 + 18, '簷桁', 'end', 't2');
    b += text(Math.min(px + 4, dx0 + dw - 14), cy - S / 2, '殳', 'start', 't2');
    b += arc(cx, cy, 20, Math.PI / 2, Math.PI / 2 - a) + text(cx + 4, cy - 24, 'α', 'start', 't2');
    b += text(clamp((cx + px) / 2 - 6, dx0 + 30, dx0 + dw - 10), clamp((cy + py) / 2 - 4, dy0 + 20, cy - 10), name, 'end');
    b += text(cx - 4, cy + 14, '出隅', 'end', 't3');
  } else {
    // 凹角：右上是空地（沒有屋面），其餘三面是屋面；谷木往左下走（朝屋脊）
    const cx = dx0 + dw - 60, cy = dy0 + 52;
    b += poly([[dx0 + 6, dy0 + 8], [cx, dy0 + 8], [cx, cy], [dx0 + dw, cy], [dx0 + dw, dy0 + dh], [dx0 + 6, dy0 + dh]], 'ln');
    b += line(cx, dy0 + 8, cx, cy, 'ln') + line(cx, cy, dx0 + dw, cy, 'ln');
    let S2 = 64, H2 = S2 * Math.tan(a);
    if (H2 > cx - dx0 - 14) { H2 = cx - dx0 - 14; S2 = H2 / Math.tan(a); }
    const px = cx - H2, py = cy + S2;
    b += line(cx, cy, px, py, 'hyp') + line(px, cy, px, py, 'dim');
    b += text(dx0 + dw - 2, cy - 6, '簷桁', 'end', 't2') + text(cx + 4, dy0 + 20, '簷桁', 'start', 't2');
    b += text(dx0 + dw - 2, dy0 + 34, '（沒有屋面）', 'end', 't3');
    b += text(Math.max(px - 4, dx0 + 20), cy + S2 / 2, '殳', 'end', 't2');
    b += arc(cx, cy, 20, -Math.PI / 2, -Math.PI / 2 - a) + text(cx - 8, cy + 34, 'α', 'end', 't2');
    // 名稱放在谷木線的右下方（屋面那一側），避開 α
    b += text(clamp(cx - H2 * 0.7 + 10, dx0 + 20, dx0 + dw - 40), clamp(cy + S2 * 0.7 + 16, cy + 30, dy0 + dh - 4), name, 'start');
    b += text(cx + 4, cy + 14, '入隅', 'start', 't3');
  }

  // ── 下：沿角梁（谷木）剖開的立面 ──
  const oy = 236, x0 = 40, hk = Math.max(n * Math.cos(a), 0.05) / 10;
  let w = 240, h = w * hk;
  if (h > 56) { h = 56; w = h / hk; }
  h = Math.max(h, 2);
  b += text(12, oy - 62, `立面（沿${name}剖開）`, 'start', 't2');
  b += poly([[x0, oy], [x0 + w, oy], [x0 + w, oy - h]], 'ln') + line(x0, oy, x0 + w, oy - h, 'hyp') + mark(x0 + w, oy, -1, 0, 0, -1);
  b += text(x0 + w / 2, oy + 15, `${name}平面長`, 'middle', 't2');
  b += text(Math.min(x0 + w + 6, vbW - 40), oy - h / 2 + 4, '立上高', 'start', 't2');
  if (hipText) b += text(clamp(x0 + w / 2 - 6, 60 + textWidth(hipText), vbW - 60), clamp(oy - h / 2 - 10, oy - 60, oy - 14), hipText, 'end', 't2');
  b += legend(vbW, oy + 34, nums.length ? nums : ['示意圖：輸入殳、坡度與振れ角後重新繪製']);
  const cap = tani
    ? '谷木在兩個屋面「凹進去」的轉角（入隅）相交成屋谷，例如 L 型、U 型屋頂的交會處，下方是天溝。'
    : '角梁（隅木）在兩個屋面「外凸」的轉角（出隅）相交，例如四坡屋頂的四個角。';
  return box([vbW, nums.length > 2 ? oy + 68 : oy + 54], b, `${name}：L 型屋頂全圖、轉角放大與立面`,
    `${cap}振れ角 α 從垂直於簷桁的方向量起，45° 為真隅。圖為示意，尺寸以數值為準。`);
}

/** 屋頂伏圖（俯視）：外框＝屋面（含軒の出／けらば出），虛線＝外牆芯 */
export function yaneFigure({ shape = 'kiri', B = 7280, W = 5460, E = 600, Eg = 450, P = 0, nums = [] } = {}) {
  const vbW = 360;
  const B2 = B + 2 * (shape === 'kiri' ? Eg : E), W2 = W + 2 * E;
  const s = Math.min(280 / B2, 130 / W2);
  const ow = B2 * s, oh = W2 * s, ox = (vbW - ow) / 2 + 8, oy = 22;
  let b = rect(ox, oy, ow, oh, 'ln');
  const ix = ox + (shape === 'kiri' ? Eg : E) * s, iy = oy + E * s;
  b += rect(ix, iy, B * s, W * s, 'dim');
  const my = oy + oh / 2;
  if (shape === 'kiri') {
    if (P > 0) {
      const cnt = Math.floor(B2 / P + 1e-9) + 1;
      if (cnt <= 80) for (let i = 0; i < cnt; i++) { const x = ox + Math.min(i * P, B2) * s; b += line(x, oy, x, oy + oh, 'rf'); }
    }
    b += line(ox, my, ox + ow, my, 'hyp');
    b += text(ox + ow / 2, my - 6, '棟', 'middle', 't2');
  } else {
    const rx0 = ox + oh / 2, rx1 = ox + ow - oh / 2;
    b += line(rx0, my, rx1, my, 'hyp');
    for (const [x, y] of [[ox, oy], [ox, oy + oh], [ox + ow, oy], [ox + ow, oy + oh]]) b += line(x, y, x < ox + ow / 2 ? rx0 : rx1, my, 'hyp');
    b += text(ox + ow / 2, my - 6, rx1 - rx0 > 24 ? '棟' : '', 'middle', 't2');
  }
  b += text(ox + ow / 2, oy + oh + 16, `${shape === 'kiri' ? '棟長' : '桁行（含軒の出）'}`, 'middle', 't2');
  b += text(Math.max(ox - 6, 4 + textWidth('梁間')), oy + oh / 2 + 4, '梁間', 'end', 't2');
  const y0 = oy + oh + 34;
  b += legend(vbW, y0, nums.length ? nums : ['示意圖：輸入桁行、梁間後依比例繪製', '外框＝屋面、虛線＝外牆芯']);
  return box([vbW, Math.round(y0 + 34)], b, shape === 'kiri' ? '切妻屋頂伏圖' : '寄棟屋頂伏圖', '俯視圖：外框是屋面（含軒の出、けらば出），虛線是外牆芯。圖為示意，尺寸以數值為準。');
}

/** 屋面面積：水平投影 vs 實際面積 */
export function areaFigure({ planM2 = null, m2 = null, k = 1.077 } = {}) {
  const vbW = 360, x0 = 70, full = 240;
  const has = planM2 > 0 && m2 > 0;
  const wPlan = full / k;
  let b = line(x0, 70, x0 + wPlan, 70, 'ln') + poly([[x0, 70], [x0 + wPlan, 70], [x0 + wPlan, Math.max(70 - wPlan * Math.sqrt(Math.max(k * k - 1, 0)), 14)]], 'ln');
  b += text(x0 + wPlan / 2, 86, '水平投影', 'middle', 't2') + text(x0 + 10, 40, '屋面', 'start', 't2');
  b += text(x0 - 8, 112, '水平', 'end', 't2') + rect(x0, 101, wPlan, 14, 'ln', 4);
  b += text(x0 - 8, 136, '實際', 'end', 't2') + rect(x0, 125, full, 14, 'hyp', 4);
  b += legend(vbW, 162, has ? [`水平 ${planM2.toFixed(2)} m²`, `實際 ${m2.toFixed(2)} m²`, `伸長率 ${k.toFixed(4)}`] : ['實際面積 ＝ 水平投影面積 × 伸長率']);
  return box([vbW, 176], b, '屋面面積：水平投影與實際面積', '屋面是斜的，實際面積比從上面看到的大，倍數就是伸長率。');
}
