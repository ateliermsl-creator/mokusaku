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
