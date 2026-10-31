// 台日大木作名詞＆構架對照庫：介面。所有文字一律用 textContent，避免自訂詞條帶入 HTML。
import { TERMS, CATEGORIES, CONF } from './glossary.js';
import { search, makeCustom } from './glossary-search.js';
import { DIAGRAMS, COMPARE, renderDiagramSvg } from './diagrams.js';
import { h } from './dom.js';

const $ = (id) => document.getElementById(id);

const DIR_HINT = {
  all: '輸入日文、假名、中文或現場講法都可以，兩邊一起比對。',
  ja: '你輸入的是日文或假名：只比對日文欄位，答案顯示台灣說法。例：垂木、たるき。',
  tw: '你輸入的是中文或現場講法（含台語、日語外來語）：只比對台灣欄位，答案顯示日文。例：椽、角梁、Taruki。',
};
const DIR_PLACEHOLDER = {
  all: '例：垂木、たるき、椽、角梁、ヌキ',
  ja: '輸入日文或假名，例：垂木、たるき',
  tw: '輸入中文或現場講法，例：椽、角梁、Taruki',
};

export function createGlossaryUI({ state, save }) {
  let dir = 'all', cat = '', tab = state.glossTab === 'frame' ? 'frame' : 'terms';
  let dgId = DIAGRAMS.some((d) => d.id === state.glossDiagram) ? state.glossDiagram : DIAGRAMS[0].id;
  let custom = Array.isArray(state.terms) ? state.terms : [];
  let selectedPart = '';
  let wired = false;

  const all = () => [...TERMS, ...custom];
  const findTerm = (c, ja) => all().find((t) => t.cat === c && t.ja === ja);
  const persistCustom = () => { state.terms = custom; save(); };

  /* ---------- 詞條卡片：日本／台灣傳統／現場行話／機能與差異 ---------- */
  function dimRow(label, ...content) {
    return h('div', { class: 'dim' }, h('span', { class: 'dl', text: label }), h('div', { class: 'dv' }, content));
  }
  const markRole = (row, role) => {
    row.classList.add(role);
    row.querySelector('.dl').append(h('em', { class: 'role', text: role === 'ask' ? '你查的' : '答案' }));
  };

  function termCard(t, mode = 'all') {
    const card = h('article', { class: `term mode-${mode}` });
    card.append(h('div', { class: 'term-top' },
      h('span', { class: `conf conf-${t.conf}`, text: CONF[t.conf] }),
      t.cat && t.conf !== 'u' ? h('span', { class: 'cat', text: t.cat }) : null));

    const jaRow = dimRow('日本',
      t.ja === '—' ? h('b', { class: 'none', text: '（無直接對應）' }) : h('b', { text: t.ja }),
      t.kana ? h('small', { text: t.kana }) : null,
      t.alias && t.alias.length ? h('small', { text: `別稱：${t.alias.join('、')}` }) : null);
    const twRow = dimRow('台灣傳統', h('b', { text: t.tw[0] }),
      t.tw.length > 1 ? h('small', { text: t.tw.slice(1).join('、') }) : null);
    const slangRow = t.slang && t.slang.length
      ? dimRow('現場行話', t.slang.map((x) => h('div', { class: 'sl', text: x }))) : null;

    // 查詢方向會改變排列：你輸入的那一邊排前面（淡），答案那一邊放大、反白
    // 注意：沒有現場行話時 slangRow 是 null，append(null) 會變成文字 "null"，所以一律先濾掉
    let rows;
    if (mode === 'ja') { markRole(jaRow, 'ask'); markRole(twRow, 'ans'); rows = [jaRow, twRow, slangRow]; }
    else if (mode === 'tw') { markRole(twRow, 'ask'); markRole(jaRow, 'ans'); rows = [twRow, slangRow, jaRow]; }
    else rows = [jaRow, twRow, slangRow];
    card.append(...rows.filter(Boolean));
    if (t.note) card.append(dimRow('機能與差異', h('div', { class: 'nt', text: t.note })));
    if (t.warn) card.append(h('div', { class: 'warn', role: 'note', text: t.warn }));

    const acts = h('div', { class: 'acts' });
    for (const l of t.links || []) {
      acts.append(l.disabled
        ? h('span', { class: 'btnlink dis', text: l.label })
        : h('a', { class: 'btnlink', href: l.href, text: `🧮 ${l.label}` }));
    }
    if (/^https?:\/\//.test(t.src)) acts.append(h('a', { class: 'btnlink ghost', href: t.src, target: '_blank', rel: 'noopener noreferrer', text: '📎 查看來源' }));
    else if (t.src) card.append(h('div', { class: 'cite', text: `📖 出處：${t.src}` }));
    if (t.conf === 'u') {
      acts.append(h('button', { type: 'button', class: 'btnlink ghost', text: '🗑 刪除', onclick: () => {
        custom = custom.filter((x) => x.id !== t.id); persistCustom(); renderList();
      } }));
    } else {
      acts.append(h('button', { type: 'button', class: 'btnlink ghost', text: '＋ 我的說法', onclick: () => openForm(t) }));
    }
    if (acts.children.length) card.append(acts);
    return card;
  }

  /* ---------- 名詞對照 ---------- */
  function chips(box, items, current, onPick) {
    box.textContent = '';
    for (const [value, label] of items) {
      box.append(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(value === current), text: label,
        onclick: () => onPick(value) }));
    }
  }

  function renderChips() {
    chips($('gl-dir'), [['all', '全部'], ['ja', '日文 → 台灣'], ['tw', '台灣 → 日文']], dir, (v) => { dir = v; renderChips(); renderList(); });
    $('gl-dir-hint').textContent = DIR_HINT[dir];
    $('gl-q').placeholder = DIR_PLACEHOLDER[dir];
    const cats = [['', '全部分類'], ...CATEGORIES.map((c) => [c, c])];
    if (custom.length) cats.push(['我的詞條', `我的詞條（${custom.length}）`]);
    chips($('gl-cat'), cats, cat, (v) => { cat = v; renderChips(); renderList(); });
  }

  function renderList() {
    const q = $('gl-q').value;
    const list = search(all(), { q, dir, cat });
    const box = $('gl-list');
    box.textContent = '';
    $('gl-count').textContent = q.trim() || cat
      ? `找到 ${list.length} 條（共 ${all().length} 條）` : `共 ${all().length} 條（內建 ${TERMS.length}、我的 ${custom.length}）`;
    if (!list.length) {
      box.append(h('p', { class: 'empty', text: `找不到「${q.trim()}」。可以按下方「＋ 新增詞條」補上你的說法。` }));
      return;
    }
    const MAX = 40;
    for (const t of list.slice(0, MAX)) box.append(termCard(t, dir));
    if (list.length > MAX) box.append(h('p', { class: 'note', text: `只顯示前 ${MAX} 條，請輸入更多字或選分類縮小範圍。` }));
  }

  function openForm(t) {
    const f = $('gl-form');
    f.hidden = false;
    $('gl-f-ja').value = t ? (t.ja === '—' ? '' : t.ja) : $('gl-q').value.trim();
    $('gl-f-kana').value = t && t.ja !== '—' ? t.kana : '';
    $('gl-f-tw').value = '';
    $('gl-f-note').value = '';
    $('gl-f-err').textContent = '';
    f.scrollIntoView({ block: 'center', behavior: 'smooth' });
    $('gl-f-tw').focus({ preventScroll: true });
  }

  /* ---------- 構架圖鑑 ---------- */
  function renderFrame() {
    chips($('gl-dg'), DIAGRAMS.map((d) => [d.id, d.label]), dgId, (v) => { dgId = v; state.glossDiagram = v; save(); selectedPart = ''; renderFrame(); });
    const d = DIAGRAMS.find((x) => x.id === dgId);
    $('gl-dg-title').textContent = d.title;
    $('gl-dg-desc').textContent = d.desc;
    const fig = $('gl-fig');
    fig.setAttribute('viewBox', d.viewBox);
    fig.setAttribute('aria-label', d.title);
    fig.innerHTML = renderDiagramSvg(d); // 靜態、可信的圖形字串
    $('gl-pick').textContent = '';
    renderExplain(d);
    if (selectedPart) pickPart(selectedPart);
  }

  function renderExplain(d) {
    const box = $('gl-explain');
    box.textContent = '';
    box.append(h('div', { class: 'expl' }, h('h3', { text: d.explain.heading }), h('ul', {}, d.explain.points.map((x) => h('li', { text: x })))));
    if (d.id === 'wa' || d.id === 'yo') {
      const col = d.id === 'wa' ? 1 : 2;
      const cell = (txt, i, tag = 'td') => h(tag, { class: i === col ? 'on' : null, text: txt });
      box.append(h('div', { class: 'expl' },
        h('h3', { text: '和小屋 vs 洋小屋：差在哪裡？' }),
        h('div', { class: 'cmp-wrap' }, h('table', { class: 'cmp' },
          h('thead', {}, h('tr', {}, COMPARE.heads.map((x, i) => cell(x, i, 'th')))),
          h('tbody', {}, COMPARE.rows.map((r) => h('tr', {}, r.map((x, i) => cell(x, i, i === 0 ? 'th' : 'td')))))))));
    }
  }

  function pickPart(id) {
    const d = DIAGRAMS.find((x) => x.id === dgId);
    const p = d.parts.find((x) => x.id === id);
    if (!p) return;
    selectedPart = id;
    $('gl-fig').querySelectorAll('.part').forEach((g) => g.classList.toggle('sel', g.dataset.id === id));
    const t = findTerm(p.ref[0], p.ref[1]);
    const box = $('gl-pick');
    box.textContent = '';
    box.append(h('p', { class: 'pick-h', text: `你點的是：${p.aria}` }));
    if (t) box.append(termCard(t));
  }

  /* ---------- 分頁 ---------- */
  function renderTab() {
    $('gl-terms').hidden = tab !== 'terms';
    $('gl-frame').hidden = tab !== 'frame';
    document.querySelectorAll('#gl-seg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (tab === 'terms') { renderChips(); renderList(); } else renderFrame();
  }

  function wire() {
    if (wired) return;
    wired = true;
    $('gl-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      tab = b.dataset.tab; state.glossTab = tab; save(); renderTab();
    });
    $('gl-q').addEventListener('input', renderList);
    $('gl-rand').addEventListener('click', () => {
      const t = TERMS[Math.floor(Math.random() * TERMS.length)];
      $('gl-q').value = t.ja === '—' ? t.tw[0] : t.ja; dir = 'all'; cat = '';
      renderChips(); renderList(); $('gl-list').scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    $('gl-add').addEventListener('click', () => openForm(null));
    $('gl-f-cancel').addEventListener('click', () => { $('gl-form').hidden = true; });
    $('gl-form').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const item = makeCustom({ ja: $('gl-f-ja').value, kana: $('gl-f-kana').value, tw: $('gl-f-tw').value, note: $('gl-f-note').value });
        custom = [item, ...custom]; persistCustom();
        $('gl-form').hidden = true;
        $('gl-q').value = item.ja; dir = 'all'; cat = '';
        renderChips(); renderList();
      } catch (err) { $('gl-f-err').textContent = err.message; }
    });
    $('gl-export').addEventListener('click', async () => {
      const btn = $('gl-export');
      if (!custom.length) { btn.textContent = '還沒有自訂詞條'; setTimeout(() => { btn.textContent = '複製我的詞條（JSON）'; }, 1800); return; }
      const text = JSON.stringify(custom.map(({ ja, kana, tw, note }) => ({ ja, kana, tw, note })), null, 2);
      try { await navigator.clipboard.writeText(text); btn.textContent = '已複製 ✓'; }
      catch {
        const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0' }); ta.value = text;
        document.body.append(ta); ta.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
        ta.remove(); btn.textContent = ok ? '已複製 ✓' : '複製失敗，請改用長按選取';
      }
      setTimeout(() => { btn.textContent = '複製我的詞條（JSON）'; }, 1800);
    });
    const fig = $('gl-fig');
    fig.addEventListener('click', (e) => { const g = e.target.closest('.part'); if (g) pickPart(g.dataset.id); });
    fig.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const g = e.target.closest('.part');
      if (g) { e.preventDefault(); pickPart(g.dataset.id); }
    });
  }

  return { render() { wire(); renderTab(); } };
}
