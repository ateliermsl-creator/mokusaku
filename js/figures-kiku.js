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

/** 角梁・谷木：左＝平面（振れ角 α），右＝沿角梁剖開的立面 */
export function sumiFigure({ alphaDeg = 45, n = 4, kind = 'de', nums = [], hipText = '' } = {}) {
  const vbW = 360, oy = 150;
  const a = clamp(alphaDeg, 1, 89) * Math.PI / 180;
  // 平面：簷桁（水平）＋ 妻側（垂直），角梁從角落以 α（自垂直於簷桁的方向量起）出發
  const cx = 30;
  let S = 96, H = S * Math.tan(a);
  if (H > 120) { H = 120; S = H / Math.tan(a); }
  const px = cx + H, py = oy - S;
  const name = kind === 'tani' ? '谷木' : '角梁';
  let b = text(90, 22, '平面（俯視）', 'middle', 't2');
  b += line(cx, oy, cx + 140, oy, 'ln') + line(cx, oy, cx, oy - 120, 'ln');
  b += text(cx + 140, oy + 16, '簷桁', 'end', 't2') + text(cx + 4, oy - 112, '妻側', 'start', 't2');
  b += line(cx, oy, px, py, 'hyp') + line(px, oy, px, py, 'dim');
  b += text(Math.min(px + 4, 168), oy - S / 2, '殳', 'start', 't2');
  b += arc(cx, oy, 22, Math.PI / 2, Math.PI / 2 - a);
  b += text(cx + 6, oy - 26, `α`, 'start', 't2');
  b += text(clamp((cx + px) / 2 - 6, 40, 160), clamp((oy + py) / 2 - 6, 30, 140), name, 'end');
  if (kind === 'tani') b += text(cx + 4, oy - 4, '入隅', 'start', 't2');
  // 立面：平面長 vs 立上高
  const x0 = 200, hk = Math.max(n * Math.cos(a), 0.05) / 10;
  let w = 140, h = w * hk;
  if (h > 100) { h = 100; w = h / hk; }
  h = Math.max(h, 2);
  b += text(270, 22, '立面（沿' + name + '剖開）', 'middle', 't2');
  b += poly([[x0, oy], [x0 + w, oy], [x0 + w, oy - h]], 'ln') + line(x0, oy, x0 + w, oy - h, 'hyp') + mark(x0 + w, oy, -1, 0, 0, -1);
  b += text(x0 + w / 2, oy + 16, '平面長', 'middle', 't2');
  b += text(Math.min(x0 + w + 4, vbW - 40), oy - h / 2 + 4, '立上高', 'start', 't2');
  if (hipText) b += text(clamp(x0 + w / 2 - 4, 210, 340), clamp(oy - h / 2 - 10, 40, 140), hipText, 'end', 't2');
  b += legend(vbW, 186, nums.length ? nums : ['示意圖：輸入殳、坡度與振れ角後重新繪製']);
  return box([vbW, nums.length > 2 ? 220 : 206], b, `${name}：平面與立面`, `振れ角 α 從垂直於簷桁的方向量起，45° 為真隅。圖為示意，尺寸以數值為準。`);
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
