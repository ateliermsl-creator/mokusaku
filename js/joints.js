// 仕口・継手 比例速查：純函式，輸入「材成」D（mm），輸出各部尺寸與 SVG 示意圖。
//
// 資料來源：《古蹟木作修復技術》V-2「日式木構造與修復」圖 17（木地檻接合工法）的平、側面圖，
// 圖中以材成 120 mm 標註各部尺寸，並在括號內寫出相對於材成的比例（1/8、1/4、3/8…）。
// 本檔的比例（f）就是那些括號內的比例；其他材成的尺寸＝比例 × 材成，是依圖面比例換算，不是文獻明文規定。
// 圖形是依文獻圖簡化的示意圖：尺寸以文獻標註為準，未標註的位置（例如栓的位置、斜線坡度）依圖面目測。
//
// 金輪継ぎ另依「實驗木場 木構接頭線上特展」（嘉義市政府文化局主辦、原型結構工程顧問策展，2021）的
// 施工圖（材 135 mm）：圖面標註的數字照抄，其餘（段差、込み栓、斜度）是依圖面比例量測，頁面上會分開標示。
// 「施工步驟」「力學說明」是依該展覽的文字用我們自己的話整理，並附原頁連結；不轉載對方的照片與圖。
import { box, line, poly, rect, text, legend, textWidth } from './figures.js';
import { fmtMm, toTaiShaku } from './units.js';

const SRC = '《古蹟木作修復技術》V-2 日式木構造與修復 圖 17';
export const AS_SITE = '實驗木場 木構接頭線上特展（嘉義市政府文化局主辦、原型結構工程顧問策展，2021）';
export const AS_URL = 'https://astaiwan.wixsite.com/website-1/team';
const MARK = '①②③④⑤⑥⑦';
const r1 = (v) => Math.round(v * 10) / 10;
const frac = (f) => ({ 0.125: '1/8', 0.25: '1/4', 0.375: '3/8', 0.5: '1/2', 0.625: '5/8', 1.25: '1¼', 0.15: '3/20', 0.0625: '1/16', 0.1: '1/10', 3: '3', 3.5: '3.5' }[f] ?? `≈ ${f.toFixed(2)}`);

export const JOINTS = [
  {
    id: 'oikake', ja: '追掛大栓継ぎ', kana: 'おいかけだいせんつぎ', tw: '犁壁榫', fig: '17(a)',
    ref: ['榫卯・接合', '追掛大栓継ぎ'],
    summary: '木地檻最常用的續接：兩材長度方向缺口對接，再打兩支方栓鎖住。文獻稱「犁壁榫（日文：追掛繼手）」。',
    params: [
      { label: '兩端各留', f: 0.125 },
      { label: '継手全長（肩到肩）', f: 3, range: [3, 3.5] },
      { label: '較小的方栓（邊長）', f: 0.125 },
      { label: '較大的方栓（邊長）', f: 0.15 },
      { label: '栓位置（沿厚度）', f: 0.5, text: '在材成中線（1/2）' },
    ],
    notes: ['文獻圖例全長 3 D（360 mm），括號標示 3～3.5 倍材成皆可。', '兩支栓沿長度方向的位置，文獻沒有標數字；圖中以全長中點左右各 3/4 D 示意（依圖面目測）。'],
    src: `${SRC}（木地檻接合工法）`,
  },
  {
    id: 'kama', ja: '鎌継ぎ', kana: 'かまつぎ', tw: '蛇頭榫', fig: '17(b)',
    ref: ['榫卯・接合', '鎌継ぎ'],
    summary: '一材端部做出頸細頭寬的「鎌首」，插入另一材的凹槽卡住。文獻圖 17(b) 標「蛇頭榫」。',
    params: [
      { label: '端留', f: 0.125 },
      { label: '鎌全長', f: 1.25 },
      { label: '頸部寬', f: 0.25 },
      { label: '頭端加寬（每側）', f: 0.0625 },
      { label: '頭端寬', f: 0.375 },
      { label: '側面勾配', f: 0.1, text: '1/10 勾配' },
    ],
    notes: ['鎌全長 1¼ D，頸部與頭部各約一半（圖中各標 75 mm）。', '頭端寬 3/8 D ＝ 頸寬 1/4 D ＋ 兩側各 1/16 D。'],
    src: `${SRC}（木地檻接合工法）`,
  },
  {
    id: 'koshikake', ja: '腰掛蟻継ぎ', kana: 'こしかけありつぎ', tw: '燕尾榫', fig: '17(c)',
    ref: ['榫卯・接合', '腰掛蟻継ぎ'],
    summary: '一材端部做燕尾形的榫頭，嵌入另一材的蟻溝，並留「腰掛」承台承重。文獻圖 17(c) 標「燕尾榫」。',
    params: [
      { label: '端留', f: 0.125 },
      { label: '蟻長（榫頭長）', f: 0.5 },
      { label: '頸部寬', f: 0.25 },
      { label: '頭端寬', f: 0.375 },
      { label: '腰掛深', f: 0.125 },
    ],
    notes: ['頭端寬 3/8 D ＝ 頸寬 1/4 D ＋ 兩側各 1/16 D（與鎌継ぎ相同的加寬量）。'],
    src: `${SRC}（木地檻接合工法）`,
    steps: ['兩支土台各自開槽，一支做公榫（燕尾形榫頭），另一支做母榫（蟻溝）。', '公榫由上往下垂直扣進母榫，完成續接。'],
    mech: ['以抗拉為主：燕尾形的榫頭卡住，讓水平方向的兩支材料連成一體、不會被拉開。'],
    caseInfo: {
      name: '鳩尾榫接（土台續接）', url: 'https://astaiwan.wixsite.com/website-1/team/%E9%B3%A9%E5%B0%BE%E6%A6%AB%E6%8E%A5',
      lines: [
        '實驗木場的土台（120 mm）施工圖標註：頸寬 30（兩側各 45）、頭寬 50；沿長度方向另標 15 與 60。',
        '對照文獻圖 17(c)（材成 120）：頸寬 30、頭寬 45、端留（腰掛）15、蟻長 60。除了頭寬（50 對 45）以外相同；15、60 的對應是我依圖面位置判斷。',
      ],
    },
  },
  {
    id: 'kanawa', ja: '金輪継ぎ', kana: 'かなわつぎ', tw: '金輪繼榫接', fig: '實驗木場',
    ref: ['榫卯・接合', '金輪継ぎ'], defD: 135, twBy: '實驗木場稱',
    summary: '兩材的榫頭上下相疊、兩端各有段差卡住，中央打入一支小木栓（込み栓）鎖緊；可用於梁、柱的續接。',
    params: [
      { label: '継手全長（肩到肩）', f: 26 / 9, rt: '≈ 2.89 D（標註 390）' },
      { label: '込み栓位置', f: 13 / 9, rt: '全長中點（標註 195）' },
      { label: '兩端段差長', f: 1 / 9, rt: '≈ 1/9 D（量測）' },
      { label: '兩端段差深（自中心線）', f: 1 / 9, rt: '≈ 1/9 D（量測）' },
      { label: '込み栓寬', f: 0.125, rt: '≈ 1/8 D（量測）' },
      { label: '込み栓高（＝中央段差）', f: 0.13, rt: '≈ 0.13 D（量測）' },
      { label: '圖面另標 60、30', f: 0, text: '自端部 60、90 mm 處，用途待確認' },
    ],
    notes: [
      '尺寸取自實驗木場「金輪繼榫接」施工圖（材 135 × 135 mm）：全長 390、中點 195、中心線 67.5 是圖面標註；兩端段差、込み栓、斜度是我依圖面比例量測，可能差 ±2 mm。',
      '這是單一施工案例的尺寸，不是文獻的通用比例；換算到其他材成只是等比例放大縮小，施工請依設計圖與匠師判斷。',
    ],
    src: `${AS_SITE}「金輪繼榫接」施工圖`,
    steps: ['選好適合續接的位置，兩材各做公母榫頭。', '公母榫頭上下扣合。', '在中央留下的空隙打入小木栓（込み栓），讓榫頭緊密互卡固定。'],
    mech: ['公母榫頭互相卡住，可以抵抗彎矩。', '側面打入的木栓讓整個接頭緊密互卡，對側向力也有效，因此可用在柱與梁的續接。'],
    caseInfo: { name: '金輪繼榫接（梁柱續接）', url: 'https://astaiwan.wixsite.com/website-1/team/%E9%87%91%E8%BC%AA%E7%B9%BC%E6%A6%AB%E6%8E%A5', lines: [] },
  },
];

export const DEFAULT_D = 120; // 文獻圖例的材成

/** 各部尺寸表。D 為材成 mm；回傳 { n, label, ratio, mm, textMm } 陣列 */
export function jointSpec(id, D) {
  const j = JOINTS.find((x) => x.id === id);
  if (!j) throw new Error(`沒有這個継手：${id}`);
  if (!(D > 0) || !Number.isFinite(D)) throw new Error('材成要大於 0');
  return j.params.map((p, i) => {
    const mm = p.f * D;
    const rng = p.range ? p.range.map((f) => f * D) : null;
    return {
      n: i + 1, label: p.label,
      ratio: p.text ?? p.rt ?? (p.range ? `${frac(p.range[0])}～${frac(p.range[1])} D` : `${frac(p.f)} D`),
      mm, range: rng,
      valueText: p.text && !p.range ? '—' : rng ? `${fmtMm(rng[0], 1)}～${fmtMm(rng[1], 1)} mm` : `${fmtMm(mm, 1)} mm`,
      tai: p.text && !p.range ? '' : rng ? `${toTaiShaku(rng[0])}～${toTaiShaku(rng[1])}` : toTaiShaku(mm),
    };
  });
}

/* ───────────── 示意圖 ───────────── */
const VW = 360;
const cls = (c) => c;
const seg = (x1, y1, x2, y2, c) => line(x1, y1, x2, y2, c);
const pl = (pts, c = 'cut') => `<polyline class="${c}" points="${pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(' ')}"/>`;

/** 一張圖：plan(x,y,s) / side 由各継手提供；座標單位 = 材成 D */
function build(j, D, parts) {
  const { lx, base, planPts, planDash, sideDash, sideSolid, pins, dims, marks, views = ['平面', '側面'], planRects = [] } = parts;
  const W = lx + base * 2;
  const s = Math.min((VW - 40) / W, 84);
  const ox = (VW - W * s) / 2 + base * s;      // x = 0 的位置（左端留白後）
  const X = (x) => ox + x * s;
  const planTop = 56, ycP = planTop + s / 2, planBot = planTop + s;
  const sideTop = planBot + 52, ycS = sideTop + s / 2, sideBot = sideTop + s;
  const left = X(-base), right = X(lx + base);
  let b = '';
  // 圖名
  b += text(12, 16, views[0], 'start', 't2') + text(12, sideTop - 12, views[1], 'start', 't2');
  // 平面：上下緣、中線、継手外形
  b += seg(left, planTop, right, planTop, 'ln') + seg(left, planBot, right, planBot, 'ln');
  b += seg(left, ycP, right, ycP, 'dim');
  for (const x of planDash) b += seg(X(x), planTop, X(x), planBot, 'hid');
  b += pl(planPts.map(([x, y]) => [X(x), ycP + y * s]), 'cut');
  for (const [x0, y0, x1, y1] of planRects) b += rect(X(x0), ycP + y0 * s, (x1 - x0) * s, (y1 - y0) * s, 'ln');
  // 側面
  b += seg(left, sideTop, right, sideTop, 'ln') + seg(left, sideBot, right, sideBot, 'ln');
  b += seg(left, ycS, right, ycS, 'dim');
  for (const [x1, y1, x2, y2] of sideDash) b += seg(X(x1), ycS + y1 * s, X(x2), ycS + y2 * s, 'hid');
  for (const [x1, y1, x2, y2] of sideSolid) b += seg(X(x1), ycS + y1 * s, X(x2), ycS + y2 * s, 'ln');
  for (const pin of pins) b += rect(X(pin.x) - (pin.size * s) / 2, ycS - (pin.size * s) / 2, pin.size * s, pin.size * s, 'ln');
  // 尺寸線（水平，畫在平面上方）：有空間就寫字，否則只放編號
  for (const d of dims) {
    const y = planTop - d.row * 15 - 6;
    const x1 = X(d.x1), x2 = X(d.x2);
    b += seg(x1, y, x2, y, 'dm') + seg(x1, y - 3, x1, y + 3, 'dm') + seg(x2, y - 3, x2, y + 3, 'dm');
    const lab = d.label ? `${MARK[d.n - 1]} ${d.label}` : MARK[d.n - 1];
    const lw = textWidth(lab);
    b += text((x1 + x2) / 2, y - 4, lw <= x2 - x1 - 4 ? lab : MARK[d.n - 1], 'middle', 't3');
  }
  // 編號標記
  for (const m of marks) b += text(X(m.x), (m.side ? ycS : ycP) + m.y * s, MARK[m.n - 1], 'middle', 't3');
  const spec = jointSpec(j.id, D);
  const items = [`D（材成）＝ ${fmtMm(D, 1)} mm`, ...spec.filter((p) => p.valueText !== '—').map((p) => `${MARK[p.n - 1]}${p.ratio.replace(/（.*?）/, '').replace(' D', 'D')}＝${p.range ? p.valueText.replace(' mm', '') : fmtMm(p.mm, 1)}`)];
  const leg = legend(VW, sideBot + 26, items);
  const rows = Math.ceil(items.reduce((a, it) => a + textWidth(it) + 18, 0) / (VW - 24)) + 1;
  const H = Math.ceil(sideBot + 26 + rows * 14 + 4);
  const cap = j.id === 'kanawa'
    ? `${j.ja}（實驗木場稱${j.tw}）：依該案施工圖重畫的簡化示意圖；標註與量測的尺寸見下表。`
    : `${j.ja}（文獻稱${j.tw}）：依 ${SRC}${j.fig.replace(/^17/, '')} 簡化的示意圖，比例以括號內的材成倍數為準。`;
  return box([VW, H], b + leg, `${j.ja}（${j.tw}）${views[0]}與${views[1]}示意圖`, cap);
}

const E = 0.125;
/** 金輪継ぎ（實驗木場施工圖，材 135）：以材成 D 為單位。e 兩端段差、k 込み栓寬、s1／s2 中央段差上下（自中心線） */
export const KANAWA = { e: 1 / 9, lx: 26 / 9, k: 0.125, s1: 0.06, s2: 0.07, get xm() { return this.lx / 2 - this.k / 2; } };

export function jointFigure(id, D = DEFAULT_D) {
  const j = JOINTS.find((x) => x.id === id);
  if (!j) throw new Error(`沒有這個継手：${id}`);
  if (!(D > 0) || !Number.isFinite(D)) throw new Error('材成要大於 0');
  if (id === 'oikake') {
    const S = 3, lx = S + 2 * E, xm = E + S / 2, c = lx / 2;
    return build(j, D, {
      lx, base: 0,
      planDash: [E, S + E],
      planPts: [[E, -0.5], [E, -E], [0, -E], [0, 0], [E, 0], [xm, 0.033], [xm, -0.05], [lx, 0], [lx, E], [lx - E, E], [lx - E, 0.5]],
      sideDash: [[E, -0.5, E, 0.5], [S + E, -0.5, S + E, 0.5], [xm, -0.5, xm + 0.04, 0.5]],
      sideSolid: [],
      pins: [{ x: c - 0.75, size: 0.125 }, { x: c + 0.75, size: 0.15 }],
      dims: [
        { n: 2, x1: E, x2: S + E, row: 0, label: '3～3.5D' },
        { n: 1, x1: 0, x2: E, row: 1, label: '' },
      ],
      marks: [{ n: 3, x: c - 0.75, y: -0.12, side: true }, { n: 4, x: c + 0.75, y: -0.12, side: true }],
    });
  }
  if (id === 'kama') {
    const base = 0.4, a = 0, bx = E, neck = 0.625, head = 1.25, n = 0.125, w = 0.1875;
    return build(j, D, {
      lx: E + head, base,
      planDash: [a, bx],
      planPts: [[bx, -n], [bx + neck, -n], [bx + head, -w], [bx + head, w], [bx + neck, n], [bx, n]],
      sideDash: [[bx + neck, -0.5, bx + neck + 0.05, 0], [bx + head, -0.5, bx + head + 0.05, 0], [a, 0, bx + head, 0]],
      sideSolid: [[bx, -0.5, bx, 0], [a, 0, a, 0.5]],
      pins: [],
      dims: [
        { n: 2, x1: bx, x2: bx + head, row: 0, label: '1¼D' },
        { n: 1, x1: a, x2: bx, row: 1, label: '' },
      ],
      marks: [{ n: 3, x: bx + neck * 0.5, y: -0.5 + 0.25 }, { n: 4, x: bx + head + 0.12, y: 0.06 }, { n: 5, x: bx + head - 0.05, y: 0.5 - 0.05 }, { n: 6, x: bx + neck + 0.2, y: -0.12, side: true }],
    });
  }
  if (id === 'kanawa') {
    // 實驗木場施工圖：側面（上）是榫頭外形與込み栓；平面（下）以虛線表示段差與込み栓位置
    const { e, lx, xm, k, s1, s2 } = KANAWA;
    return build(j, D, {
      lx, base: 0, views: ['側面（榫頭外形）', '平面'],
      planDash: [e, lx - e],
      planPts: [[e, -0.5], [e, -e], [0, -e], [0, 0], [e, 0], [xm, s1], [xm, -s2], [xm + k, -s2], [lx, 0], [lx, e], [lx - e, e], [lx - e, 0.5]],
      planRects: [[xm, -s2, xm + k, s1]],      // 込み栓
      sideDash: [[e, -0.5, e, 0.5], [lx - e, -0.5, lx - e, 0.5], [xm, -0.5, xm, 0.5], [xm + k, -0.5, xm + k, 0.5]],
      sideSolid: [],
      pins: [],
      dims: [
        { n: 1, x1: 0, x2: lx, row: 0, label: '≈2.89D' },
        { n: 3, x1: 0, x2: e, row: 1, label: '' },
      ],
      marks: [{ n: 5, x: xm + k / 2, y: -0.22 }, { n: 2, x: xm + k / 2, y: 0.62, side: true }],
    });
  }
  // koshikake
  const base = 0.5, a = 0, bx = E, len = 0.5, n = 0.125, w = 0.1875;
  return build(j, D, {
    lx: E + len, base,
    planDash: [a, bx],
    planPts: [[bx, -n], [bx + len, -w], [bx + len, w], [bx, n]],
    sideDash: [[bx + len, -0.5, bx + len, 0]],
    sideSolid: [[bx, -0.5, bx, 0.5], [a, 0, a, 0.5]],
    pins: [],
    dims: [
      { n: 2, x1: bx, x2: bx + len, row: 0, label: '1/2D' },
      { n: 1, x1: a, x2: bx, row: 1, label: '' },
    ],
    marks: [{ n: 3, x: bx + len * 0.5, y: -0.5 + 0.25 }, { n: 4, x: bx + len + 0.12, y: 0.06 }, { n: 5, x: a - 0.15, y: 0.3, side: true }],
  });
}
