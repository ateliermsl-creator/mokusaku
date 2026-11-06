// 追掛大栓継ぎ 的立體幾何（純函式，不依賴 3D 函式庫，方便單元測試）。
//
// 座標：x ＝ 材的長度方向；y ＝ 平面圖的橫向（材寬，向下為正）；單位 mm。
// 兩根材的斷面都是 D × D（文獻圖例材成 120 mm 的方材）。
// 平面圖上的継手界線 P 從上緣 (e, −D/2) 走到下緣 (Lx−e, +D/2)，把整個平面分成左材 A 與右材 B（兩材各有一個小榫頭伸進對方的缺口）；
// 兩材各沿厚度（高度方向）整段貫穿，所以立體 ＝ 把 A、B 的平面形狀向上拉伸 D。
// 栓沿材寬（y 方向）貫穿兩材，在側面圖看到的是方形。
//
// 依據：《古蹟木作修復技術》V-2 圖 17(a) 的平面、側面圖（尺寸與比例見 joints.js）。
// 文獻沒有標數字、由圖面目測的：界線上的小斜度與段差（SLOPE / STEP）、栓的位置（±3/4 D）。
import { KANAWA } from './joints.js';
export const E = 0.125;          // 兩端各留（× D）
export const SPAN = 3;           // 継手全長 3 D（文獻 3～3.5 D）
export const PIN_AT = 0.75;      // 栓位置：全長中點左右各 0.75 D（目測）
export const SLOPE = 0.033;      // 界線前段的下傾（× D，目測）
export const STEP = 0.05;        // 界線中段的段差（× D，目測）

/** 回傳 { A, B, pins, Lx, ext, D }；A、B 為多邊形頂點 [[x, y], …]（mm） */
export function oikakeModel(D, { span = SPAN, ext = 1 } = {}) {
  if (!(D > 0) || !Number.isFinite(D)) throw new Error('材成要大於 0');
  const e = E * D, S = span * D, Lx = S + 2 * e, xm = e + S / 2, X = ext * D, H = D / 2;
  const A = [
    [-X, -H], [e, -H], [e, -e], [0, -e], [0, 0], [e, 0], [xm, SLOPE * D], [xm, -STEP * D],
    [Lx, 0], [Lx, e], [Lx - e, e], [Lx - e, H], [-X, H],
  ];
  // B 取界線 P 的另一側（與 A 共用同一條界線，才會剛好咬合）：
  // 上緣從 (e, −H) 到右端，右端留白、右下的小缺口，再沿 P 回到左端的小榫頭。
  const B = [
    [e, -H], [Lx + X, -H], [Lx + X, H], [Lx - e, H], [Lx - e, e], [Lx, e], [Lx, 0],
    [xm, -STEP * D], [xm, SLOPE * D], [e, 0], [0, 0], [0, -e], [e, -e],
  ];
  const c = Lx / 2;
  const pins = [{ x: c - PIN_AT * D, size: 0.125 * D }, { x: c + PIN_AT * D, size: 0.15 * D }];
  return { A, B, pins, Lx, ext: X, D };
}

/** 多邊形面積（shoelace，取絕對值） */
export function polyArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/* ───────────────────────── 通用立體模型 ─────────────────────────
 * jointModel(id, D) → {
 *   members: [{ name, color: 'a'|'b', pieces: [{ poly: [[x, y], …], y0, y1 }] }],   // 每片 ＝ 平面形狀沿高度 y0→y1 拉伸
 *   pins: [{ x, size }] | [],  cx（置中用的 x）、explodeDx（拆開時每根材移動量）、D
 * }
 * 兩根材在「每一層高度」都剛好拼滿整個平面（由 tests/joint3d.test.js 以取樣點檢查）。
 */
function rectPoly(x0, x1, H) { return [[x0, -H], [x1, -H], [x1, H], [x0, H]]; }

/** 追掛大栓継ぎ：A、B 整段貫穿高度 */
function oikakeGeneric(D) {
  const m = oikakeModel(D);
  return {
    // 拆開：兩材要沿長度方向各退開 0.62 Lx（相對距離 1.24 Lx ＞ 搭接長度 Lx），榫頭才不會還互相穿插
    D, cx: m.Lx / 2, explodeDx: m.Lx * 0.62, pinDz: D * 1.35, pins: m.pins,
    x0: -m.ext, x1: m.Lx + m.ext,
    // 栓孔位置框線：材面朝 +Z 的是 B（平面 y<0 側），朝 −Z 的是 A；框線要跟著各自的材一起移動
    holes: m.pins.flatMap((p) => [{ member: 'B', x: p.x, size: p.size, zFace: 1 }, { member: 'A', x: p.x, size: p.size, zFace: -1 }]),
    members: [
      { name: 'A', color: 'a', pieces: [{ poly: m.A, y0: 0, y1: D }] },
      { name: 'B', color: 'b', pieces: [{ poly: m.B, y0: 0, y1: D }] },
    ],
  };
}

/**
 * 鎌継ぎ／腰掛蟻継ぎ 共同結構（依文獻圖 17(b)(c) 的平面與側面圖推定）：
 *  - 公材（左）的榫頭只在上半深（D/2），從肩 xB 伸出；母材（右）上半有對應的凹槽。
 *  - 下半：母材比公材的肩多伸出 e（xA→xB）當「腰掛」承台，托住榫頭。
 *  - 榫頭平面形狀：頸寬 1/4 D；頭端加寬到 3/8 D。
 * 側面圖的 1/10 勾配（榫頭端面斜度）沒有建進模型。
 */
function halfTongue(D, { neckLen, headLen, wNeck, wHead, ext = 1 }) {
  const e = E * D, H = D / 2, X = ext * D;
  const xA = 0, xB = e, xT = xB + neckLen + headLen, xEnd = xT + X;
  const n = wNeck / 2, w = wHead / 2;
  const tongue = neckLen > 0
    ? [[xB, -n], [xB + neckLen, -n], [xT, -w], [xT, w], [xB + neckLen, n], [xB, n]]
    : [[xB, -n], [xT, -w], [xT, w], [xB, n]];
  // 公材上半：左段方材 ＋ 榫頭（以順時針頂點表示輪廓）
  const upperMale = [[-X, -H], [xB, -H], ...tongue, [xB, H], [-X, H]];
  // 母材上半：右段方材，左端挖掉榫頭形狀
  const upperFemale = [[xB, -H], [xEnd, -H], [xEnd, H], [xB, H], ...[...tongue].reverse()];
  return {
    D, cx: (xT + xB) / 2, explodeDx: (xT - xB) * 0.65 + e, pinDz: 0, pins: [], holes: [], x0: -X, x1: xEnd, e, xA, xB, xT,
    members: [
      { name: '公材', color: 'a', pieces: [{ poly: upperMale, y0: H, y1: D }, { poly: rectPoly(-X, xA, H), y0: 0, y1: H }] },
      { name: '母材', color: 'b', pieces: [{ poly: upperFemale, y0: H, y1: D }, { poly: rectPoly(xA, xEnd, H), y0: 0, y1: H }] },
    ],
  };
}

/**
 * 金輪継ぎ（實驗木場施工圖，材 135）：外形畫在側面（高度方向），沿材寬整段拉伸；
 * 中央的込み栓沿材寬打入（拆開時往側面抽出）。座標 (x, h)：h ＝ 從材底量起的高度。
 * 兩材與込み栓三者剛好拼滿（込み栓的孔一半在下材、一半在上材）。
 */
function kanawaGeneric(D, ext = 1) {
  const { e, lx, k, s1, s2 } = KANAWA;
  const E = e * D, L = lx * D, K = k * D, S1 = s1 * D, S2 = s2 * D, H = D / 2, X = ext * D, xm = L / 2 - K / 2;
  const toH = (pts) => pts.map(([x, v]) => [x, H - v]);     // v：自中心線往下為正（同施工圖）
  const A = toH([[-X, -H], [E, -H], [E, -E], [0, -E], [0, 0], [E, 0], [xm, S1], [xm + K, S1], [xm + K, -S2], [L, 0], [L, E], [L - E, E], [L - E, H], [-X, H]]);
  const B = toH([[E, -H], [L + X, -H], [L + X, H], [L - E, H], [L - E, E], [L, E], [L, 0], [xm + K, -S2], [xm, -S2], [xm, S1], [E, 0], [0, 0], [0, -E], [E, -E]]);
  return {
    D, cx: L / 2, explodeDx: L * 0.62, pinDz: D * 1.35, x0: -X, x1: L + X, holes: [],
    pins: [{ x: xm + K / 2, size: K, sy: S1 + S2, hy: H - (S1 - S2) / 2, key: true }],
    members: [
      { name: '下材', color: 'a', pieces: [{ poly: A, y0: 0, y1: D, axis: 'elev' }] },
      { name: '上材', color: 'b', pieces: [{ poly: B, y0: 0, y1: D, axis: 'elev' }] },
    ],
  };
}

export function jointModel(id, D, { ext = 1 } = {}) {
  if (!(D > 0) || !Number.isFinite(D)) throw new Error('材成要大於 0');
  if (id === 'oikake') return oikakeGeneric(D);
  if (id === 'kanawa') return kanawaGeneric(D, ext);
  if (id === 'kama') return halfTongue(D, { neckLen: 0.625 * D, headLen: 0.625 * D, wNeck: 0.25 * D, wHead: 0.375 * D, ext });
  if (id === 'koshikake') return halfTongue(D, { neckLen: 0, headLen: 0.5 * D, wNeck: 0.25 * D, wHead: 0.375 * D, ext });
  throw new Error(`沒有這個継手：${id}`);
}

/** 點是否在多邊形內（射線法），測試用 */
export function inPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
