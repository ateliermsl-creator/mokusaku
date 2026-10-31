// 規矩術・弧・對角線的純計算函式（不碰 DOM，方便測試）。
// 規矩術用語：勾（立上り）・殳（水平 = 10）・玄（斜邊）。

const RAD = 180 / Math.PI;
const SQRT200 = Math.sqrt(200); // 隅木の殳（水平 10 × √2）

/** 寸勾配 x（水平 10 に対して立ち上がり x 寸） */
export function roofFromKobai(x) {
  if (!(x >= 0)) throw new Error('勾配要大於或等於 0');
  const tanA = x / 10;
  const tanHip = x / SQRT200;
  return {
    kobai: x,
    angleDeg: Math.atan(tanA) * RAD,
    /** 垂木：玄 = √(10²+勾²)（短玄）、伸び率 = 玄/10 */
    gen: Math.sqrt(100 + x * x),
    nobi: Math.sqrt(100 + x * x) / 10,
    hip: {
      /** 隅木：殳 = 10√2、長玄 = √(200+勾²) */
      den: SQRT200,
      gen: Math.sqrt(200 + x * x),
      /** 以隅木水平長為殳 10 時的勾配（隅勾配） */
      kobai: x / Math.SQRT2,
      angleDeg: Math.atan(tanHip) * RAD,
      /** 隅木實長 ÷ 單邊水平長 */
      nobi: Math.sqrt(200 + x * x) / 10,
    },
  };
}

export function kobaiFromAngle(deg) {
  if (!(deg >= 0 && deg < 90)) throw new Error('角度要在 0° ~ 90° 之間');
  return 10 * Math.tan(deg / RAD);
}

export function kobaiFromRiseRun(rise, run) {
  if (!(run > 0)) throw new Error('水平長要大於 0');
  if (!(rise >= 0)) throw new Error('立上り要大於或等於 0');
  return (10 * rise) / run;
}

/** 單邊水平長 a → 垂木實長、立上り、隅木實長（皆 mm） */
export function roofLengths(a, x) {
  const r = roofFromKobai(x);
  return {
    rafter: a * r.nobi,
    rise: (a * x) / 10,
    hip: a * r.hip.nobi,
    hipPlan: a * Math.SQRT2,
  };
}

/**
 * 配付垂木：由最長那支（水平長 firstRun）往隅木方向，每支水平長減 pitch。
 * 實長 = 水平長 × 伸び率；每支減り（實長）= pitch × 伸び率。
 */
export function haitsukeRafters(firstRun, pitch, x, maxCount = 60) {
  if (!(firstRun > 0)) throw new Error('先頭垂木的水平長要大於 0');
  if (!(pitch > 0)) throw new Error('垂木間距要大於 0');
  const { nobi } = roofFromKobai(x);
  const rows = [];
  for (let i = 0; i < maxCount; i++) {
    const run = firstRun - i * pitch;
    if (run <= 1e-9) break;
    rows.push({ n: i + 1, run, real: run * nobi });
  }
  return { decrement: pitch * nobi, rows };
}

/** 弦長 c、矢高 h → 半徑 R、中心角、弧長 */
export function arcFromChordRise(c, h) {
  if (!(c > 0) || !(h > 0)) throw new Error('弦長與矢高都要大於 0');
  const R = (c * c / 4 + h * h) / (2 * h);
  const theta = 2 * Math.atan2(c / 2, R - h);
  return { c, h, R, thetaDeg: theta * RAD, arc: R * theta };
}

/** 弦長 c、半徑 R → 矢高 h（取小弧） */
export function arcFromChordRadius(c, R) {
  if (!(c > 0) || !(R > 0)) throw new Error('弦長與半徑都要大於 0');
  if (c > 2 * R) throw new Error('弦長不能大於直徑（2R）');
  return arcFromChordRise(c, R - Math.sqrt(R * R - c * c / 4));
}

/** 把弦 n 等分，回傳每個分點到弧面的高度（從弦線量起），供 墨出し */
export function arcOffsets(c, h, n) {
  const { R } = arcFromChordRise(c, h);
  const base = R - h; // 圓心到弦的距離（h > R 時為負，不在此處理）
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const x = -c / 2 + (c * i) / n;
    const y = Math.sqrt(Math.max(0, R * R - x * x)) - base;
    rows.push({ i, x: c * i / n, y });
  }
  return rows;
}

export function diagonal(a, b) {
  if (!(a > 0) || !(b > 0)) throw new Error('兩邊都要大於 0');
  return Math.hypot(a, b);
}
