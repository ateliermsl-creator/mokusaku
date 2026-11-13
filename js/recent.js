// 底部輸入面板的「最近用過」：每種欄位記最近幾個值，點一下就帶入。純函式，不碰 DOM。
// 長度欄位共用一組（key 'len'），純數字欄位各自一組（key 是欄位 id）。讀取已存資料一律先檢查型別。

export const RECENT_MAX = 4;
const KEY_RE = /^[a-z][a-z0-9-]{0,30}$/;
const VAL_MAX = 40;

const okVal = (v) => typeof v === 'string' && v.trim() !== '' && v.length <= VAL_MAX;

/** 清理已存資料：只留合法的 key 與字串值，每組最多 RECENT_MAX 個、不重複 */
export function sanitizeRecent(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, list] of Object.entries(raw).slice(0, 60)) {
    if (!KEY_RE.test(k) || !Array.isArray(list)) continue;
    const vals = [];
    for (const v of list) {
      if (!okVal(v)) continue;
      const t = v.trim();
      if (!vals.includes(t)) vals.push(t);
      if (vals.length >= RECENT_MAX) break;
    }
    if (vals.length) out[k] = vals;
  }
  return out;
}

/** 加入一個值（放最前面、去掉重複、超過上限就丟掉最舊的）。不合法的 key 或值原樣回傳。 */
export function pushRecent(recent, key, value) {
  if (!KEY_RE.test(key) || !okVal(value)) return recent;
  const v = value.trim();
  const list = [v, ...(recent[key] || []).filter((x) => x !== v)].slice(0, RECENT_MAX);
  return { ...recent, [key]: list };
}
