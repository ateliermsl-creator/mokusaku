// 計算紀錄與設定：純函式（讀取、清理、加入），不碰 DOM。資料存在 localStorage，讀出來一律先檢查型別。
export const LOG_MAX = 100;
export const LOG_TOOLS = ['mix', 'slope', 'kouko', 'sumi', 'yane', 'area', 'diag', 'arc', 'luban'];
const ID_RE = /^[a-z]+-[a-z0-9-]{1,30}$/;     // 只還原這種格式的輸入欄位 id

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

/** 讀取已存的紀錄：型別不對、工具不認得的都丟掉；輸入值只留字串 */
export function sanitizeLog(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list.slice(0, LOG_MAX)) {
    if (!e || typeof e !== 'object' || !LOG_TOOLS.includes(e.tool)) continue;
    const ts = Number(e.ts);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const inp = {};
    if (e.inp && typeof e.inp === 'object') {
      for (const [k, v] of Object.entries(e.inp).slice(0, 20)) if (ID_RE.test(k) && typeof v === 'string') inp[k] = v.slice(0, 200);
    }
    const title = str(e.title, 40), res = str(e.res, 120);
    if (!title || !res) continue;
    out.push({ tool: e.tool, title, sum: str(e.sum, 200), res, ts, inp });
  }
  return out;
}

/** 加入一筆（新的在前）；同一工具、同樣輸入的舊紀錄會被取代；超過上限從最舊的開始刪 */
export function addLog(list, entry) {
  const [e] = sanitizeLog([entry]);
  if (!e) return list;
  const key = (x) => `${x.tool}|${JSON.stringify(x.inp)}`;
  return [e, ...list.filter((x) => key(x) !== key(e))].slice(0, LOG_MAX);
}

/** 設定：小數位 0／1／2；角度 'deg'（度）或 'dms'（度分秒） */
export function sanitizePrefs(p) {
  const o = p && typeof p === 'object' ? p : {};
  return { dec: [0, 1, 2].includes(o.dec) ? o.dec : 1, ang: o.ang === 'dms' ? 'dms' : 'deg' };
}
