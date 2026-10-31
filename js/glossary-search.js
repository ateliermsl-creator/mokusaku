// 台日大木作名詞＆構架對照庫：搜尋邏輯（純函式，不碰 DOM）。
import { TERMS, CATEGORIES } from './glossary.js';

const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** 搜尋用正規化：全形半形統一、片假名→平假名、去掉空白與「・ー」。 */
export function norm(s) {
  return kataToHira(String(s ?? '').normalize('NFKC').toLowerCase()).replace(/[\s・･ー\-－]/g, '');
}

function prepared(t) {
  if (t._n) return t._n;
  t._n = {
    ja: [norm(t.ja), ...(t.alias || []).map(norm)],
    kana: t.kana.split('／').map(norm),
    tw: t.tw.map(norm),
    slang: (t.slang || []).map(norm),
  };
  return t._n;
}

function score(fields, q) {
  let best = 0;
  for (const f of fields) {
    if (!f) continue;
    if (f === q) return 100;
    if (f.startsWith(q)) best = Math.max(best, 60);
    else if (f.includes(q)) best = Math.max(best, 30);
  }
  return best;
}

/**
 * @param entries 詞條陣列（內建 + 自訂）
 * @param opts.q    搜尋字串（空 = 全部）
 * @param opts.dir  'all' 全部 | 'ja' 只比對日文與假名 | 'tw' 只比對台灣用語與現場行話
 * @param opts.cat  分類（空 = 全部）；'我的詞條' = 自訂
 */
export function search(entries, { q = '', dir = 'all', cat = '' } = {}) {
  const nq = norm(q);
  let list = entries;
  if (cat) list = list.filter((t) => (cat === '我的詞條' ? t.conf === 'u' : t.cat === cat));
  if (!nq) return list.slice();
  const scored = [];
  list.forEach((t, i) => {
    const n = prepared(t);
    const fields = dir === 'ja' ? [...n.ja, ...n.kana] : dir === 'tw' ? [...n.tw, ...n.slang] : [...n.ja, ...n.kana, ...n.tw, ...n.slang];
    const s = score(fields, nq);
    if (s > 0) scored.push({ t, s, i });
  });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return scored.map((x) => x.t);
}

/** 把使用者輸入整理成自訂詞條；缺少必要欄位時丟出 Error。 */
export function makeCustom({ ja, kana, tw, note }, now = Date.now()) {
  const jaT = String(ja ?? '').trim();
  const twList = String(tw ?? '').split(/[、,，;；\n]/).map((x) => x.trim()).filter(Boolean);
  if (!jaT) throw new Error('請輸入日文');
  if (!twList.length) throw new Error('請輸入台灣用語（多個用「、」分隔）');
  return {
    id: `u${now}${Math.random().toString(36).slice(2, 6)}`,
    cat: '我的詞條', ja: jaT, kana: String(kana ?? '').trim(), tw: twList,
    conf: 'u', note: String(note ?? '').trim(), src: '', slang: [], alias: [], warn: '', links: [],
  };
}

/** 讀取已存的自訂詞條：只保留文字欄位，其餘（連結、來源、警示…）一律丟掉，避免被竄改的資料進入畫面 */
export function sanitizeCustom(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const o of list.slice(0, 500)) {
    if (!o || typeof o !== 'object') continue;
    try {
      const c = makeCustom({
        ja: String(o.ja ?? '').slice(0, 100), kana: String(o.kana ?? '').slice(0, 100),
        tw: (Array.isArray(o.tw) ? o.tw : []).map((x) => String(x).slice(0, 100)).join('、'),
        note: String(o.note ?? '').slice(0, 1000),
      });
      c.id = /^u[0-9a-z]{3,40}$/.test(String(o.id)) ? o.id : c.id;
      out.push(c);
    } catch { /* 不合格的略過 */ }
  }
  return out;
}

export { TERMS, CATEGORIES };
