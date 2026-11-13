// 匠師備考：錯題的間隔複習，與「做到一半的這一回」的存檔。純函式，不碰 DOM，方便測試。
//
// 間隔複習（讀書節奏，不是法規數值）：
//   答錯 → 隔 1 天再出；複習時答對 → 3 天後再出；再答對 → 7 天後再出；再答對（連續 3 次）→ 移出錯題本。
//   還沒到期就先答對，不會往前推進（避免一天內連刷就移出）；任何時候答錯都從頭算。
// 資料格式：[[題目 id, 階段 0~2, 到期日（本地日期的天數）], ...]，最新的放前面。讀取時一律檢查型別。

export const INTERVALS = [1, 3, 7];
export const REVIEW_MAX = 300;
const DAY_MAX = 1e6;

/** 本地日期換成「天數」（同一天 = 同一個整數），用來比較是否到期 */
export function dayNum(date = new Date()) {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
}

const isDay = (d) => Number.isInteger(d) && d >= 0 && d <= DAY_MAX;

/** 清理已存的複習資料；known：目前存在的題目 id（Set）。舊版錯題本（只有 id 的陣列）用 legacy 帶進來，當作今天到期。 */
export function sanitizeReview(raw, known, { legacy = [], today = dayNum() } = {}) {
  const out = [];
  const seen = new Set();
  const add = (id, s, d) => {
    if (typeof id !== 'string' || id.length > 80 || !known.has(id) || seen.has(id)) return;
    if (!Number.isInteger(s) || s < 0 || s >= INTERVALS.length || !isDay(d)) return;
    seen.add(id); out.push([id, s, d]);
  };
  if (Array.isArray(raw)) {
    for (const e of raw.slice(0, REVIEW_MAX * 2)) {
      if (Array.isArray(e) && e.length === 3) add(e[0], e[1], e[2]);
      if (out.length >= REVIEW_MAX) return out;
    }
  }
  if (Array.isArray(legacy)) {
    for (const id of legacy.slice(0, REVIEW_MAX * 2)) {
      add(id, 0, today);
      if (out.length >= REVIEW_MAX) break;
    }
  }
  return out;
}

/** 作答後更新複習排程（回傳新陣列，不改原本的） */
export function answerReview(list, id, correct, today = dayNum()) {
  const k = list.findIndex((e) => e[0] === id);
  if (!correct) {
    const rest = list.filter((e) => e[0] !== id);
    return [[id, 0, today + INTERVALS[0]], ...rest].slice(0, REVIEW_MAX);
  }
  if (k < 0) return list;
  const [, s, d] = list[k];
  if (d > today) return list;                         // 還沒到期：不推進
  const out = list.slice();
  if (s + 1 >= INTERVALS.length) out.splice(k, 1);    // 連續答對 3 次：移出
  else out[k] = [id, s + 1, today + INTERVALS[s + 1]];
  return out;
}

/** 今天（含以前）到期要複習的題目 id */
export const dueIds = (list, today = dayNum()) => list.filter((e) => e[2] <= today).map((e) => e[0]);

/** 下一次有題目到期的日子（沒有錯題回傳 null） */
export const nextDue = (list) => (list.length ? Math.min(...list.map((e) => e[2])) : null);

/* ───────────── 做到一半的這一回：App 被關掉、手機清背景後可以接著做 ───────────── */

const SETS = ['law', 'term', 'wrong'];

/**
 * 清理存檔：{ set, ids, i, score, a }。a＝目前這題已經作答（答案已記錄，接續時直接跳下一題）。
 * 不合法或已經做完就回傳 null。
 */
export function sanitizeSession(raw, known) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { set, ids, i, score, a } = raw;
  if (!SETS.includes(set) || !Array.isArray(ids) || !ids.length || ids.length > 20) return null;
  if (!ids.every((x) => typeof x === 'string' && known.has(x)) || new Set(ids).size !== ids.length) return null;
  if (!Number.isInteger(i) || i < 0 || !Number.isInteger(score) || score < 0) return null;
  const answered = a === true;
  if (score > i + (answered ? 1 : 0)) return null;
  const next = answered ? i + 1 : i;
  if (next >= ids.length) return null;                // 已經做完了，不必接續
  return { set, ids: ids.slice(), i: next, score };
}
