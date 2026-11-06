// 規矩術計算（純函式，不碰 DOM，方便測試）：坡度換算、勾股玄與墨付割線、角梁・谷木（振れ隅）、
// 屋頂伏圖（切妻・寄棟）、屋面面積、三邊計算、坡度速查表、角度顯示。
// 用語：勾（立上高）・殳（水平）・玄（斜邊）；寸勾配 n ＝ 水平 10 對立上高 n。

const RAD = 180 / Math.PI;
export const TSUBO_M2 = 400 / 121;          // 1 坪 ＝ 400/121 m² ≈ 3.3058 m²（台灣與日本相同）

const pos = (v, msg) => { if (!(v > 0) || !Number.isFinite(v)) throw new Error(msg); return v; };
const nonneg = (v, msg) => { if (!(v >= 0) || !Number.isFinite(v)) throw new Error(msg); return v; };

/** 伸長率 k ＝ 玄 ÷ 殳 ＝ √(10² + n²) ÷ 10 */
export const nobi = (n) => Math.sqrt(100 + n * n) / 10;

/* ───────────── 坡度換算 ───────────── */

/**
 * 把各種坡度寫法換成寸勾配 n。
 * mode：'kobai'（寸）、'angle'（度）、'percent'（%）、'fraction'（「4/10」「1:2.5」＝立上高:水平）
 */
export function parseSlope(mode, raw) {
  const s = String(raw ?? '').normalize('NFKC').trim();
  if (!s) return null;
  if (mode === 'fraction') {
    const m = /^(\d+(?:\.\d+)?)\s*[/:：／]\s*(\d+(?:\.\d+)?)$/.exec(s);
    if (!m) throw new Error('請用「立上高/水平」或「立上高:水平」，例如 4/10、1:2.5');
    const rise = +m[1], run = +m[2];
    pos(run, '水平要大於 0');
    return (10 * rise) / run;
  }
  const v = Number(s);
  if (!Number.isFinite(v)) throw new Error('請輸入數字');
  if (mode === 'kobai') return nonneg(v, '坡度要大於或等於 0');
  if (mode === 'percent') return nonneg(v, '坡度要大於或等於 0') / 10;
  if (mode === 'angle') {
    if (!(v >= 0 && v < 90)) throw new Error('角度要在 0° ~ 90° 之間');
    return 10 * Math.tan(v / RAD);
  }
  throw new Error(`不認得的坡度寫法：${mode}`);
}

/** 寸勾配 n → 角度、%、伸長率、隅勾配（真隅） */
export function slopeInfo(n) {
  nonneg(n, '坡度要大於或等於 0');
  return {
    kobai: n,
    angleDeg: Math.atan(n / 10) * RAD,
    percent: n * 10,
    nobi: nobi(n),
    hipKobai: n / Math.SQRT2,
  };
}

/* ───────────── 勾股玄（椽木）與墨付割線 ───────────── */

/**
 * 殳（水平距離）與寸勾配 → 勾、玄，以及墨付用的割線：
 * 長玄 ＝ 殳²/玄、短玄 ＝ 勾²/玄、中勾 ＝ 勾×殳/玄（從直角向斜邊作垂線）。
 */
export function kouKoGen(den, n) {
  pos(den, '殳（水平距離）要大於 0');
  nonneg(n, '坡度要大於或等於 0');
  const kou = (den * n) / 10;
  const gen = den * nobi(n);
  return {
    den, kou, gen, nobi: nobi(n), angleDeg: Math.atan(n / 10) * RAD,
    chogen: (den * den) / gen,
    tangen: (kou * kou) / gen,
    chuko: (kou * den) / gen,
  };
}

/* ───────────── 角梁（出隅）・谷木（入隅），含振れ隅 ───────────── */

/**
 * 殳＝從桁芯量起、垂直於簷桁的水平距離；n＝平勾配；alpha＝振れ角（從垂直簷桁的方向量起，45° 為真隅）。
 * 隅勾配 ＝ n × cos α；平面長 ＝ 殳 ÷ cos α；實長 ＝ 平面長 × √(10²+隅勾配²)/10。
 * 另一側（妻側）屋面坡度 ＝ n ÷ tan α（真隅時與平勾配相同）。
 */
export function sumiTani(den, n, alphaDeg = 45) {
  pos(den, '殳（水平距離）要大於 0');
  nonneg(n, '坡度要大於或等於 0');
  if (!(alphaDeg > 0 && alphaDeg < 90)) throw new Error('振れ角要在 0° ~ 90° 之間（真隅為 45°）');
  const a = alphaDeg / RAD, c = Math.cos(a);
  const hipKobai = n * c;
  const plan = den / c;
  const k = nobi(hipKobai);
  return {
    den, n, alphaDeg, hipKobai, plan, length: plan * k, rise: (den * n) / 10,
    nobi: k, angleDeg: Math.atan(hipKobai / 10) * RAD,
    otherKobai: n / Math.tan(a),
  };
}

/* ───────────── 屋頂伏圖：切妻・寄棟 ───────────── */

/**
 * B 桁行、W 梁間、n 寸勾配、E 軒の出（水平）、Eg けらば出（水平，切妻用）、P 椽距（垂木ピッチ）。全部 mm。
 * 等勾配、真隅；不含鼻隠し、母屋成、材成等加減。
 */
export function yaneFuse({ shape, B, W, n, E = 0, Eg = 0, P = 0 }) {
  pos(B, '桁行要大於 0'); pos(W, '梁間要大於 0'); nonneg(n, '坡度要大於或等於 0');
  nonneg(E, '軒の出要大於或等於 0'); nonneg(Eg, 'けらば出要大於或等於 0'); nonneg(P, '椽距要大於或等於 0');
  const k = nobi(n);
  const W2 = W + 2 * E;
  const ridgeHKeta = (W / 2) * n / 10;          // 從軒桁天端起算
  const ridgeHEave = (W2 / 2) * n / 10;         // 從軒先起算
  if (shape === 'kiri') {
    const B2 = B + 2 * Eg;
    const perSide = P > 0 ? Math.floor(B2 / P + 1e-9) + 1 : null;
    return {
      shape, k, B2, W2, angleDeg: Math.atan(n / 10) * RAD,
      rafter: (W / 2 + E) * k, ridgeLen: B2, ridgeHKeta, ridgeHEave,
      rafterPerSide: perSide, rafterTotal: perSide === null ? null : perSide * 2,
      areaMm2: W2 * B2 * k,                      // 兩面合計
      gableMm2: (W * ridgeHKeta) / 2,           // 山牆三角形（一面，軒桁天端以上）
    };
  }
  if (shape === 'yose') {
    const B2 = B + 2 * E;
    if (B2 < W2 - 1e-9) throw new Error('寄棟的桁行要大於或等於梁間（請把長邊填在桁行）');
    const half = W2 / 2;
    return {
      shape, k, B2, W2, angleDeg: Math.atan(n / 10) * RAD,
      rafter: half * k,                          // 平垂木（軒先まで）
      hip: half * Math.sqrt(200 + n * n) / 10,  // 隅木（四支相同）
      hipPlan: half * Math.SQRT2,
      hipKobai: n / Math.SQRT2,
      decrement: P > 0 ? P * k : null,          // 配付垂木每一間距的減り
      ridgeLen: B2 - W2, ridgeHKeta, ridgeHEave,
      areaMm2: B2 * W2 * k,
    };
  }
  throw new Error('屋頂形式要選切妻或寄棟');
}

/* ───────────── 屋面面積 ───────────── */
export function roofArea(planM2, n) {
  pos(planM2, '水平投影面積要大於 0');
  const k = nobi(n);
  const m2 = planM2 * k;
  return { planM2, k, m2, tsubo: m2 / TSUBO_M2 };
}

/* ───────────── 三邊計算 ───────────── */
/**
 * mode 'hyp'：殳、勾 → 玄；'leg'：玄、一邊 → 另一邊（a＝殳）；'angle'：殳、角度（對水平）→ 勾、玄。
 * 回傳 { den（殳）, kou（勾）, gen（玄）, angleDeg, kobai }
 */
export function triangle(mode, p, q) {
  let den, kou, gen;
  if (mode === 'hyp') {
    den = pos(p, '水平（殳）要大於 0'); kou = pos(q, '垂直（勾）要大於 0'); gen = Math.hypot(den, kou);
  } else if (mode === 'leg') {
    gen = pos(p, '斜邊（玄）要大於 0'); den = pos(q, '已知邊要大於 0');
    if (den >= gen) throw new Error('已知邊要小於斜邊');
    kou = Math.sqrt(gen * gen - den * den);
  } else if (mode === 'angle') {
    den = pos(p, '水平（殳）要大於 0');
    if (!(q > 0 && q < 90)) throw new Error('角度要在 0° ~ 90° 之間');
    kou = den * Math.tan(q / RAD); gen = den / Math.cos(q / RAD);
  } else throw new Error(`不認得的模式：${mode}`);
  return { den, kou, gen, angleDeg: Math.atan2(kou, den) * RAD, kobai: (10 * kou) / den };
}

/* ───────────── 坡度速查表 ───────────── */
export function slopeTable(from = 1, to = 15, step = 0.5) {
  const rows = [];
  for (let i = 0; from + i * step <= to + 1e-9; i++) {
    const n = Math.round((from + i * step) * 1000) / 1000;
    rows.push({ kobai: n, angleDeg: Math.atan(n / 10) * RAD, nobi: nobi(n), hipKobai: n / Math.SQRT2 });
  }
  return rows;
}

/* ───────────── 顯示 ───────────── */
/** 角度顯示：'deg' → 21.80°；'dms' → 21°48'05.1" */
export function fmtAngle(deg, mode = 'deg', digits = 2) {
  if (!Number.isFinite(deg)) return '—';
  if (mode !== 'dms') return `${deg.toFixed(digits)}°`;
  const sign = deg < 0 ? '-' : '';
  let t = Math.round(Math.abs(deg) * 36000);      // 0.1 秒為單位
  const d = Math.floor(t / 36000); t -= d * 36000;
  const m = Math.floor(t / 600); t -= m * 600;
  const s = t / 10;
  return `${sign}${d}°${String(m).padStart(2, '0')}'${s.toFixed(1).padStart(4, '0')}"`;
}

/** 數字固定小數位（去掉 -0） */
export function fmtNum(v, dec = 1) {
  if (!Number.isFinite(v)) return '—';
  const s = v.toFixed(dec);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
}
