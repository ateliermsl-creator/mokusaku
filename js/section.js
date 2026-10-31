// 角材斷面輸入解析：
//   「120×120 mm」「120 x 120」「4寸角」「105角」「4寸×5寸」「4×5寸」「4寸5分角」
// 回傳 { b, d, square }（皆為 mm）。約定：第一個數字是「幅」(b)，第二個是「せい」(d，成/梁深)。
// 「角」表示正方形斷面；只有一邊寫單位時，另一邊沿用同一個單位（「4×5寸」= 4寸×5寸）。
import { evalLength } from './units.js';

const TRAILING_UNIT = /(mm|cm|m|丈|間|台尺|尺|寸|分|厘)$/;

function normalize(src) {
  return String(src)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[×＊*]/g, 'x')
    .replace(/[−–—ー]/g, '-')
    .trim();
}

function positive(label, mm) {
  if (mm === null) throw new Error(`請輸入${label}`);
  if (!(mm > 0)) throw new Error(`${label}要大於 0`);
  return mm;
}

export function parseSection(src) {
  const s = normalize(src);
  if (!s) throw new Error('請輸入角材斷面，例如 120×120 mm 或 4寸角');

  // 正方形：「4寸角」「105角」
  if (s.endsWith('角')) {
    const side = positive('邊長', evalLength(s.slice(0, -1)));
    return { b: side, d: side, square: true };
  }

  const parts = s.split('x').map((p) => p.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('請用「幅×せい」的寫法，例如 120×150 mm 或 4寸×5寸；正方形可寫「4寸角」');
  }
  let [pa, pb] = parts;
  const ua = TRAILING_UNIT.exec(pa), ub = TRAILING_UNIT.exec(pb);
  if (!ua && ub) pa += ub[1];      // 「4×5寸」→ 4寸×5寸
  else if (ua && !ub) pb += ua[1]; // 「4寸×5」→ 4寸×5寸

  const b = positive('幅', evalLength(pa));
  const d = positive('せい', evalLength(pb));
  return { b, d, square: Math.abs(b - d) < 1e-9 };
}
