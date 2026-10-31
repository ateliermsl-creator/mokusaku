// 魯班尺（門公尺／丁蘭尺）字位檢核與微調建議。純函式，不碰 DOM。
//
// 資料來源與可信度：
//  - 門公尺（文公尺）八字「財病離義官劫害本」、紅字吉黑字凶、紅字為財義官本：有網頁佐證（見 README）。
//  - 丁蘭尺十格「丁害旺苦義官死興失財」與吉凶分組：吉凶分組有網頁佐證，字的排列順序未逐字查證。
//  - 一循環的長度各家不同（門公尺 42.9／46.08 cm 等、丁蘭尺 38.8／39.0 cm），所以做成可選。
//  - 每個大字底下的「小字」（如財德、寶庫…）查不到可靠來源，不收錄；因此只判斷到大字層級。
//  吉凶屬民俗傳統，僅供參考。

export const RULERS = {
  men: {
    id: 'men',
    name: '門公尺',
    alias: '文公尺・魯班尺',
    use: '陽宅（門、窗、廳、櫥櫃、家具、神位、佛具）',
    bands: ['財', '病', '離', '義', '官', '劫', '害', '本'],
    good: ['財', '義', '官', '本'],
    cycles: [
      { mm: 429, label: '42.9 cm（常見）' },
      { mm: 460.8, label: '46.08 cm（古制）' },
    ],
  },
  ding: {
    id: 'ding',
    name: '丁蘭尺',
    alias: '',
    use: '陰宅、祖龕（依資料；家具與神位多用門公尺）',
    bands: ['丁', '害', '旺', '苦', '義', '官', '死', '興', '失', '財'],
    good: ['丁', '旺', '義', '官', '興', '財'],
    cycles: [
      { mm: 390, label: '39.0 cm' },
      { mm: 387.9, label: '38.8 cm（1.28 尺）' },
    ],
  },
};

export const DEFAULT_MARGIN_MM = 2; // 落點離字位邊界至少多少 mm 才算穩妥（考慮施工誤差）

/**
 * @param ruler    RULERS 裡的一把尺
 * @param cycleMm  一循環的長度（mm）
 * @param lengthMm 要檢核的長度（mm）
 * @returns {
 *   r, idx, band, good, offset, toStart, toEnd, bandW, cycleMm,
 *   status: 'good' | 'edge' | 'bad',      edge = 在吉位但離邊界太近
 *   fwd:  { delta, band } | null,          往大調（+delta mm）可落入哪個吉位
 *   back: { delta, band } | null           往小調（−delta mm）
 * }
 */
export function checkRuler(ruler, cycleMm, lengthMm, margin = DEFAULT_MARGIN_MM) {
  const n = ruler.bands.length;
  const bandW = cycleMm / n;
  const r = ((lengthMm % cycleMm) + cycleMm) % cycleMm;
  const idx = Math.min(n - 1, Math.floor(r / bandW));
  const band = ruler.bands[idx];
  const good = ruler.good.includes(band);
  const offset = r - idx * bandW;
  const toStart = offset;
  const toEnd = bandW - offset;
  const out = { r, idx, band, good, offset, toStart, toEnd, bandW, cycleMm, margin, fwd: null, back: null };

  // 穩妥區間 = 吉位兩端各縮進 margin
  const norm = (x) => ((x % cycleMm) + cycleMm) % cycleMm;
  const goodIdx = ruler.bands.map((name, i) => (ruler.good.includes(name) ? i : -1)).filter((i) => i >= 0);
  const EPS = 1e-6; // 容許浮點誤差（遠小於任何實際測量）
  const insideAt = (rr) => goodIdx.some((i) => rr >= i * bandW + margin - EPS && rr <= (i + 1) * bandW - margin + EPS);
  const inside = insideAt(r);
  let fwd = null, back = null;
  for (const i of goodIdx) {
    const lo = i * bandW + margin, hi = (i + 1) * bandW - margin;
    for (let k = -1; k <= 2; k++) {
      const a = lo + k * cycleMm, b = hi + k * cycleMm;
      if (a > r) { const d = a - r; if (!fwd || d < fwd.raw) fwd = { raw: d, band: ruler.bands[i] }; }
      else if (b < r) { const d = r - b; if (!back || d < back.raw) back = { raw: d, band: ruler.bands[i] }; }
    }
  }
  out.status = inside ? 'good' : good ? 'edge' : 'bad';
  if (!inside) {
    // 取整到 mm，並實際驗證會落進穩妥區；浮點誤差造成差一點點時多加 1 mm
    const fin = (c, sign) => {
      if (!c) return null;
      let d = Math.max(1, Math.ceil(c.raw - 1e-9));
      for (let guard = 0; guard < 5 && !insideAt(norm(r + sign * d)); guard++) d += 1;
      return { delta: d, band: c.band };
    };
    out.fwd = fin(fwd, +1);
    out.back = fin(back, -1);
  }
  return out;
}

/**
 * 在 lengthMm ± spanMm 的範圍內，列出所有吉位的穩妥區間，依「離目前長度要調多少」排序。
 * 每筆：{ band, from, to, delta }
 *   from～to：穩妥區間（兩端各縮進 margin，並裁切到搜尋範圍內）
 *   delta：從目前長度調到這個區間最少要加減幾 mm（取整到 mm、並驗證會落在穩妥區；0 = 目前就在區間內）
 */
export function goodRangesNear(ruler, cycleMm, lengthMm, spanMm, margin = DEFAULT_MARGIN_MM) {
  const n = ruler.bands.length;
  const bw = cycleMm / n;
  const lo0 = lengthMm - spanMm, hi0 = lengthMm + spanMm;
  const kMin = Math.floor(lo0 / cycleMm) - 1, kMax = Math.ceil(hi0 / cycleMm) + 1;
  const isGood = (x) => checkRuler(ruler, cycleMm, x, margin).status === 'good';
  const out = [];
  ruler.bands.forEach((band, i) => {
    if (!ruler.good.includes(band)) return;
    for (let k = kMin; k <= kMax; k++) {
      const a = k * cycleMm + i * bw + margin, b = k * cycleMm + (i + 1) * bw - margin;
      const from = Math.max(a, lo0), to = Math.min(b, hi0);
      if (from > to) continue;
      let delta = 0;
      if (lengthMm < from) {                       // 要加長
        delta = Math.max(1, Math.ceil(from - lengthMm - 1e-9));
        for (let g = 0; g < 5 && !isGood(lengthMm + delta); g++) delta += 1;
      } else if (lengthMm > to) {                  // 要縮短
        delta = -Math.max(1, Math.ceil(lengthMm - to - 1e-9));
        for (let g = 0; g < 5 && !isGood(lengthMm + delta); g++) delta -= 1;
      }
      out.push({ band, from, to, delta });
    }
  });
  return out.sort((x, y) => Math.abs(x.delta) - Math.abs(y.delta) || x.from - y.from);
}
