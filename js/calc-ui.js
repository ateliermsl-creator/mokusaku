// 木作計算機：分組選單與各工具頁（坡度換算、勾股玄、角梁・谷木、屋頂伏圖、屋面面積、三邊・對角線、
// 坡度速查表、計算紀錄、設定）。所有文字一律用 textContent；圖形是本程式自己產生的 SVG。
import { h } from './dom.js';
import { toTaiShaku, toKenShaku } from './units.js';
import {
  parseSlope, slopeInfo, kouKoGen, sumiTani, yaneFuse, roofArea, triangle, slopeTable, fmtAngle, fmtNum, TSUBO_M2,
} from './kiku.js';
import { haitsukeRafters } from './calc.js';
import { haitsukePlan, squareCheck } from './figures.js';
import { triangleFigure, sumiFigure, yaneFigure, areaFigure } from './figures-kiku.js';
import { addLog, sanitizeLog, sanitizePrefs, LOG_MAX } from './calc-log.js';

/** 工具名稱（路由 #/calc/<id>） */
export const CALC_TOOLS = {
  menu: '木作計算機', slope: '坡度換算', kouko: '勾股玄（椽木）', sumi: '角梁・谷木', yane: '屋頂伏圖', area: '屋面面積',
  mix: '台尺混算', diag: '三邊・對角線', arc: '弧線半徑', luban: '魯班尺', table: '坡度速查表', log: '計算紀錄', settings: '設定',
};
const TOOL_JP = {
  slope: '勾配変換', kouko: '勾殳玄・割線', sumi: '隅木・谷木', yane: '屋根伏せ', area: '屋根面積', mix: '尺貫法',
  diag: '三辺・矩出し', arc: 'R・矢高', luban: '字位検核', table: '勾配早見表', log: '履歴', settings: '設定',
};

// 線條圖示（stroke＝currentColor）
const ICON = {
  compass: 'M12 3v3M12 6l-5 15M12 6l5 15M8.5 15h7',
  tri: 'M12 4 21 20H3Z',
  arrow: 'M5 19 19 5M10 5h9v9',
  house: 'M3 12 12 4l9 8M7 10v10h10V10M10 20v-5h4v5',
  houseArea: 'M3 11 12 3l9 8M5 9v11h14V9M9 20v-6h6v6',
  ruler: 'M3 8h18v8H3ZM7 8v3M11 8v4M15 8v3M19 8v4',
  triOpen: 'M12 4 21 20H3ZM12 10v10',
  arc: 'M4 18a8 8 0 0 1 16 0M12 18V10',
  luban: 'M4 6h16v12H4ZM4 10h16M9 6v12M14 6v12',
  table: 'M4 5h16v14H4ZM4 10h16M10 10v9',
  history: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4M12 8v4l3 2',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
};
export const MENU = [
  { g: '坡度', jp: '勾配', items: [['slope', '寸・度・%・分數互換', 'compass'], ['kouko', '殳與坡度 → 勾・玄・中勾・長玄・短玄', 'tri'], ['sumi', '隅勾配・實長・振れ隅・配付椽', 'arrow']] },
  { g: '屋頂', jp: '屋根', items: [['yane', '切妻・寄棟一次算出', 'house'], ['area', '水平面積 × 伸長率、換算坪', 'houseArea']] },
  { g: '尺寸', jp: '寸法', items: [['mix', '丈尺寸分與 mm 混算、四制換算', 'ruler'], ['diag', '兩邊求第三邊、抓直角', 'triOpen'], ['arc', '弦長・矢高・半徑・分點高度', 'arc'], ['luban', '門公尺／丁蘭尺字位檢核', 'luban']] },
  { g: '參考', jp: '参考', items: [['table', '每 0.5 寸一列・29 列', 'table'], ['log', '回到之前的計算', 'history']] },
  { g: '', items: [['settings', '小數位・角度顯示・計算說明', 'gear']] },
];

const svgIcon = (name) => {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'mi');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICON[name]); s.append(p);
  return s;
};

export function createCalcUI({ $, state, save, readLen }) {
  let prefs = sanitizePrefs(state.prefs);
  let log = sanitizeLog(state.log);
  state.log = log;

  /* ── 格式 ── */
  const mm = (v) => `${fmtNum(v, prefs.dec)} mm`;
  const mmSub = (v) => `台尺 ${toTaiShaku(v)}・日式 ${toKenShaku(v)}`;
  const ang = (d) => fmtAngle(d, prefs.ang);
  const m2 = (v) => `${fmtNum(v, Math.max(prefs.dec, 2))} m²`;
  const tsubo = (v) => `${fmtNum(v, Math.max(prefs.dec, 2))} 坪`;
  const k4 = (v) => fmtNum(v, 4);
  const sun = (v) => `${fmtNum(v, 2)} 寸`;
  const f1 = (v) => fmtNum(v, 1);

  /** 一般數字欄位（寸、度、m²）：回傳 {v} 或 {}（空白）或 {error} */
  function readNum(id) {
    const raw = String($(id).value ?? '').normalize('NFKC').trim();
    if (!raw) return {};
    const v = Number(raw);
    return Number.isFinite(v) ? { v } : { error: true };
  }

  /* ── 分段按鈕（由隱藏的 <select> 產生，值仍存在 select 上，草稿保存照舊） ── */
  function initSegs() {
    document.querySelectorAll('select.segsel').forEach((sel) => {
      if (sel.dataset.seg) return;
      sel.dataset.seg = '1'; sel.hidden = true;
      const wrap = h('div', { class: 'seg2', role: 'group', 'aria-label': sel.getAttribute('aria-label') || '' });
      for (const o of sel.options) {
        wrap.append(h('button', { type: 'button', 'data-v': o.value, text: o.textContent, onclick: () => {
          sel.value = o.value; syncSeg(sel); sel.dispatchEvent(new Event('input', { bubbles: true }));
        } }));
      }
      sel.after(wrap);
      syncSeg(sel);
    });
  }
  function syncSeg(sel) {
    const wrap = sel.nextElementSibling;
    if (!wrap || !wrap.classList.contains('seg2')) return;
    for (const b of wrap.children) b.setAttribute('aria-pressed', String(b.dataset.v === sel.value));
  }
  const segVal = (id) => { const sel = $(id); syncSeg(sel); return sel.value; };

  /* ── 提示 ── */
  let toastTimer = 0;
  function toast(msg) {
    let t = $('toast');
    if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.append(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
  }

  /* ── 結果卡片 ──
     items：{ k, v, sub, big, jp } 一列；{ head } 小標題；{ fx: [...] } 公式；{ note } 說明 */
  function renderBox(box, items, act) {
    box.textContent = '';
    if (!items) return;
    let card = null;
    const flush = () => { if (card) { box.append(card); card = null; } };
    for (const it of items) {
      if (it.head) { flush(); box.append(h('h3', { class: 'sec-h', text: it.head })); continue; }
      if (it.fx) { flush(); box.append(h('div', { class: 'fx' }, it.fx.map((l) => h('div', { text: l })))); continue; }
      if (it.note) { flush(); box.append(h('p', { class: 'note', text: it.note })); continue; }
      if (!card) card = h('div', { class: 'rcard' });
      card.append(h('div', { class: `rrow${it.big ? ' big' : ''}` },
        h('span', { class: 'rk' }, it.k, it.jp ? h('i', { class: 'jp', text: ` ${it.jp}` }) : null),
        h('span', { class: 'rv' }, h('b', { text: it.v })),
        it.sub ? h('small', { class: 'rsub', text: it.sub }) : null));   // 換算字獨立一行，標籤不會被擠成兩行
    }
    flush();
    if (act) box.append(actionBar(act, items));
  }

  /** 純文字摘要（複製、分享用） */
  function summaryText(title, inputs, items) {
    const lines = [`【${title}】`, inputs];
    for (const it of items) {
      if (it.head) lines.push(`— ${it.head} —`);
      else if (it.k) lines.push(`${it.k}：${it.v}${it.sub ? `（${it.sub}）` : ''}`);
    }
    lines.push('— 柴柴木作');
    return lines.join('\n');
  }

  function collectInputs(tool) {
    const sec = $(`tab-${tool}`), inp = {};
    sec.querySelectorAll('input[id], select[id]').forEach((el) => {
      if (el.classList.contains('nopersist') || el.type === 'range') return;
      if (el.value !== '') inp[el.id] = String(el.value);
    });
    return inp;
  }

  function actionBar({ tool, inputs, res }, items) {
    const title = CALC_TOOLS[tool];
    const text = () => summaryText(title, inputs, items);
    const row = (icon, label, fn) => h('button', { type: 'button', class: 'arow', onclick: fn }, h('span', { class: 'ai', text: icon }), label);
    const bar = h('div', { class: 'acts2' },
      row('⧉', '複製結果', async () => {
        try { await navigator.clipboard.writeText(text()); toast('已複製'); } catch { prompt('請複製以下內容', text()); }
      }),
      row('📌', '存到計算紀錄', () => { logAdd({ tool, title, sum: inputs, res, inp: collectInputs(tool) }); toast('已存到計算紀錄'); }));
    if (navigator.share) {
      bar.insertBefore(row('↗', '分享', async () => { try { await navigator.share({ title, text: text() }); } catch { /* 使用者取消 */ } }), bar.children[1]);
    }
    return bar;
  }

  function logAdd(entry) {
    log = addLog(log, { ...entry, ts: Date.now() });
    state.log = log; save();
  }

  /* ── 圖 ── */
  const fig = (id, html) => { $(id).innerHTML = html; };     // html 由 figures*.js 產生（文字已跳脫）

  /* ═════════════ 坡度換算 ═════════════ */
  const SL_UI = {
    kobai: ['坡度', '寸', '例：4', 'decimal'], angle: ['角度', '°', '例：21.8', 'decimal'],
    percent: ['坡度', '%', '例：40', 'decimal'], fraction: ['分數', '', '例：4/10 或 1:2.5', 'text'],
  };
  function renderSlope() {
    const mode = segVal('sl-mode');
    const [lab, unit, ph] = SL_UI[mode] || SL_UI.kobai;
    $('sl-label').textContent = lab; $('sl-unit').textContent = unit;
    $('sl-val').placeholder = ph;          // 一律用 App 的數字按鍵，不跳手機鍵盤
    $('sl-err').textContent = '';
    let n = null;
    try { n = parseSlope(mode, $('sl-val').value); } catch (e) { $('sl-err').textContent = e.message; }
    const show = n === null ? 4 : n;
    const s = slopeInfo(show);
    fig('sl-fig', triangleFigure({ n: show, labels: { den: '殳 10', kou: `勾 ${fmtNum(show, 2)}`, gen: '玄' }, angleText: ang(s.angleDeg),
      nums: n === null ? [] : [`寸勾配 ${fmtNum(n, 2)}`, `角度 ${ang(s.angleDeg)}`, `伸長率 ${k4(s.nobi)}`] }));
    if (n === null) { renderBox($('sl-out'), null); return; }
    const items = [
      { k: '寸勾配', jp: '寸勾配', v: `${fmtNum(n, 2)} 寸`, sub: `${fmtNum(n, 2)}/10` },
      { k: '角度', v: ang(s.angleDeg), big: true },
      { k: '坡度（%）', v: `${fmtNum(s.percent, 1)} %` },
      { k: '伸長率（玄 ÷ 殳）', jp: '伸び率', v: k4(s.nobi) },
      { k: '隅勾配（真隅）', jp: '隅勾配', v: sun(s.hipKobai) },
      { fx: [
        '寸勾配 n ＝ 水平 10 對立上高 n',
        `角度 ＝ atan(n/10) ＝ atan(${fmtNum(n, 2)}/10) ＝ ${ang(s.angleDeg)}`,
        `% ＝ n/10 × 100 ＝ ${fmtNum(s.percent, 1)}`,
        `伸長率 ＝ √(10²＋n²)/10 ＝ ${k4(s.nobi)}`,
        `隅勾配 ＝ n ÷ √2 ＝ ${fmtNum(s.hipKobai, 2)} 寸`,
      ] },
    ];
    renderBox($('sl-out'), items, { tool: 'slope', inputs: `${lab} ${$('sl-val').value.trim()}${unit ? ` ${unit}` : ''}`, res: `${fmtNum(n, 2)} 寸 ＝ ${ang(s.angleDeg)}` });
  }

  /* ═════════════ 勾股玄（椽木）與割線 ═════════════ */
  function renderKouko() {
    $('ko-err').textContent = '';
    const D = readLen('ko-den', 'ko-err'), N = readNum('ko-n');
    if (N.error) $('ko-err').textContent = '坡度請輸入數字（寸）';
    const ready = D.mm !== undefined && N.v !== undefined;
    let r = null;
    if (ready) { try { r = kouKoGen(D.mm, N.v); } catch (e) { $('ko-err').textContent = e.message; } }
    const n = N.v ?? 4;
    fig('ko-fig', triangleFigure({ n, split: true, labels: { den: r ? `殳 ${f1(r.den)}` : '殳', kou: r ? `勾 ${f1(r.kou)}` : '勾', gen: r ? `玄 ${f1(r.gen)}` : '玄' },
      angleText: ang(Math.atan(n / 10) * 180 / Math.PI), nums: r ? [`長玄 ${f1(r.chogen)}`, `短玄 ${f1(r.tangen)}`, `中勾 ${f1(r.chuko)}`, '（mm）'] : [] }));
    if (!r) { renderBox($('ko-out'), null); return; }
    const items = [
      { k: '勾（立上高）', jp: '勾', v: mm(r.kou), sub: mmSub(r.kou) },
      { k: '玄（椽木長）', jp: '玄', v: mm(r.gen), sub: mmSub(r.gen), big: true },
      { k: '伸長率', jp: '伸び率', v: k4(r.nobi) },
      { k: '角度', v: ang(r.angleDeg) },
      { fx: [
        `勾 ＝ 殳 × n/10 ＝ ${f1(r.den)} × ${fmtNum(N.v / 10, 2)} ＝ ${f1(r.kou)}`,
        `玄 ＝ 殳 × √(10²＋n²)/10 ＝ ${f1(r.den)} × ${k4(r.nobi)} ＝ ${f1(r.gen)}`,
        '※ 不含軒の出、母屋成的加減',
      ] },
      { head: '墨付割線（中勾・長玄・短玄）' },
      { k: '長玄', v: mm(r.chogen), sub: mmSub(r.chogen) },
      { k: '短玄', v: mm(r.tangen), sub: mmSub(r.tangen) },
      { k: '中勾', v: mm(r.chuko), sub: mmSub(r.chuko) },
      { k: '驗算：長玄＋短玄', v: `${f1(r.chogen + r.tangen)} ＝ 玄 ✓` },
      { k: '驗算：中勾²', v: `${Math.round(r.chuko ** 2).toLocaleString()} ＝ 長玄×短玄 ✓` },
      { fx: [
        `長玄 ＝ 殳²/玄 ＝ ${f1(r.den)}² / ${f1(r.gen)} ＝ ${f1(r.chogen)}`,
        `短玄 ＝ 勾²/玄 ＝ ${f1(r.kou)}² / ${f1(r.gen)} ＝ ${f1(r.tangen)}`,
        `中勾 ＝ 勾×殳/玄 ＝ ${f1(r.kou)} × ${f1(r.den)} / ${f1(r.gen)} ＝ ${f1(r.chuko)}`,
        '※ 中勾、長玄、短玄的叫法依地區與流派可能不同',
      ] },
    ];
    renderBox($('ko-out'), items, { tool: 'kouko', inputs: `殳 ${mm(r.den)}・坡度 ${fmtNum(N.v, 2)} 寸`, res: `玄 ${mm(r.gen)}・勾 ${mm(r.kou)}` });
  }

  /* ═════════════ 角梁・谷木（振れ隅）與配付椽 ═════════════ */
  function renderSumi() {
    const kind = segVal('su-kind'), name = kind === 'tani' ? '谷木' : '角梁', kname = kind === 'tani' ? '谷勾配' : '隅勾配';
    $('su-err').textContent = ''; $('su-h-err').textContent = '';
    const D = readLen('su-den', 'su-err'), N = readNum('su-n'), A = readNum('su-a');
    if (N.error || A.error) $('su-err').textContent = '坡度、振れ角請輸入數字';
    const alpha = A.v ?? 45;
    let r = null;
    if (D.mm !== undefined && N.v !== undefined) { try { r = sumiTani(D.mm, N.v, alpha); } catch (e) { $('su-err').textContent = e.message; } }
    fig('su-fig', sumiFigure({ alphaDeg: alpha, n: N.v ?? 4, kind, hipText: r ? `${name} ${f1(r.length)}` : name,
      nums: r ? [`平面長 ${f1(r.plan)}`, `實長 ${f1(r.length)}`, `立上高 ${f1(r.rise)}`, '（mm）'] : [] }));
    const hai = $('su-hai'); hai.textContent = ''; fig('su-hai-fig', haitsukePlan());
    if (!r) { renderBox($('su-out'), null); return; }
    const items = [
      { k: kname, jp: kind === 'tani' ? '谷勾配' : '隅勾配', v: sun(r.hipKobai), big: true },
      { k: `${name}實長`, v: mm(r.length), sub: mmSub(r.length), big: true },
      { k: `${name}平面長`, v: mm(r.plan), sub: mmSub(r.plan) },
      { k: '勾（到屋脊的高度）', v: mm(r.rise), sub: mmSub(r.rise) },
      { k: '伸長率', v: k4(r.nobi) },
      { k: '角度', v: ang(r.angleDeg) },
      { k: '另一側（妻側）坡度', v: sun(r.otherKobai), sub: Math.abs(alpha - 45) < 1e-9 ? '真隅：與平勾配相同' : '振れ隅：兩側坡度不同' },
      { fx: [
        `${kname} ＝ n × cos α ＝ ${fmtNum(N.v, 2)} × cos${fmtNum(alpha, 1)}° ＝ ${fmtNum(r.hipKobai, 2)}`,
        `平面長 ＝ 殳 ÷ cos α ＝ ${f1(r.den)} ÷ ${k4(Math.cos(alpha * Math.PI / 180))} ＝ ${f1(r.plan)}`,
        `實長 ＝ 平面長 × √(10²＋${kname}²)/10 ＝ ${f1(r.plan)} × ${k4(r.nobi)} ＝ ${f1(r.length)}`,
        `另一側坡度 ＝ n ÷ tan α ＝ ${fmtNum(r.otherKobai, 2)} 寸`,
        '※ 等勾配、不含軒の出的芯對芯尺寸；材料尺寸、鼻隠し的加減不含',
      ] },
    ];
    renderBox($('su-out'), items, { tool: 'sumi', inputs: `${name}・殳 ${mm(r.den)}・平勾配 ${fmtNum(N.v, 2)} 寸・振れ角 ${fmtNum(alpha, 1)}°`, res: `${kname} ${sun(r.hipKobai)}・實長 ${mm(r.length)}` });

    // 配付椽：椽木垂直於簷桁、沿簷桁每隔 P 一支 → 水平長每支少 P ÷ tan α（真隅時就是 P）
    const P = readLen('su-p', null), F = readLen('su-first', null);
    if (P.error || F.error) { $('su-h-err').textContent = '椽木間距或第一支水平長的算式有誤'; return; }
    if (P.mm === undefined) return;
    const first = F.mm ?? r.den, step = P.mm / Math.tan(alpha * Math.PI / 180);
    try {
      const hs = haitsukeRafters(first, step, N.v);
      const tbl = h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: '支' }), h('th', { text: '水平長' }), h('th', { text: '實長' }))),
        h('tbody', {}, hs.rows.map((row) => h('tr', {}, h('td', { text: String(row.n) }),
          h('td', {}, fmtNum(row.run, prefs.dec), h('small', { text: toTaiShaku(row.run) })),
          h('td', {}, fmtNum(row.real, prefs.dec), h('small', { text: toTaiShaku(row.real) }))))));
      renderBox(hai, [
        { k: '每支遞減量（實長）', jp: '減り', v: mm(hs.decrement), sub: mmSub(hs.decrement), big: true },
        { k: '每支水平長減少', v: mm(step), sub: Math.abs(alpha - 45) < 1e-9 ? '真隅：等於椽木間距' : '振れ隅：間距 ÷ tan α' },
      ]);
      hai.append(h('div', { class: 'rcard tblcard' }, tbl));
      fig('su-hai-fig', haitsukePlan({ first, pitch: step, decrement: hs.decrement, count: hs.rows.length }));
    } catch (e) { $('su-h-err').textContent = e.message; }
  }

  /* ═════════════ 屋頂伏圖 ═════════════ */
  function renderYane() {
    const shape = segVal('yn-shape');
    $('yn-eg-row').hidden = shape !== 'kiri';
    $('yn-err').textContent = '';
    const B = readLen('yn-b', null), W = readLen('yn-w', null), N = readNum('yn-n');
    const E = readLen('yn-e', null), Eg = readLen('yn-eg', null), P = readLen('yn-p', null);
    if ([B, W, E, Eg, P].some((x) => x.error)) $('yn-err').textContent = '有長度的算式有誤，請檢查';
    if (N.error) $('yn-err').textContent = '坡度請輸入數字（寸）';
    let r = null;
    const args = { shape, B: B.mm, W: W.mm, n: N.v, E: E.mm ?? 0, Eg: Eg.mm ?? 0, P: P.mm ?? 0 };
    if (B.mm !== undefined && W.mm !== undefined && N.v !== undefined) { try { r = yaneFuse(args); } catch (e) { $('yn-err').textContent = e.message; } }
    fig('yn-fig', yaneFigure(r ? { shape, B: args.B, W: args.W, E: args.E, Eg: args.Eg, P: args.P,
      nums: [`${shape === 'kiri' ? '棟長' : '含出簷'} ${f1(r.B2)} × ${f1(r.W2)} mm`, shape === 'yose' ? `棟長 ${f1(r.ridgeLen)}` : `椽 ${r.rafterPerSide ?? '—'} 支／面`] } : { shape }));
    if (!r) { renderBox($('yn-out'), null); return; }
    const area = (mm2) => ({ v: m2(mm2 / 1e6), sub: tsubo(mm2 / 1e6 / TSUBO_M2) });
    const nn = fmtNum(N.v, 2);
    let items;
    if (shape === 'kiri') {
      items = [
        { k: '椽木長（到軒先）', jp: '垂木', v: mm(r.rafter), sub: mmSub(r.rafter), big: true },
        { k: '棟高（從軒桁天端）', v: mm(r.ridgeHKeta), sub: mmSub(r.ridgeHKeta) },
        { k: '棟高（從軒先）', v: mm(r.ridgeHEave), sub: mmSub(r.ridgeHEave) },
        { k: '棟長', v: mm(r.ridgeLen), sub: mmSub(r.ridgeLen) },
        { k: '椽木支數（單面）', v: r.rafterPerSide === null ? '—（請填椽木間距）' : `${r.rafterPerSide} 支` },
        { k: '椽木支數（兩面合計）', v: r.rafterTotal === null ? '—' : `${r.rafterTotal} 支` },
        { k: '屋面面積（兩面）', ...area(r.areaMm2), big: true },
        { k: '山牆三角部分（一面）', ...area(r.gableMm2) },
        { k: '伸長率', v: k4(r.k) },
        { k: '角度', v: ang(r.angleDeg) },
        { fx: [
          `B′ ＝ 桁行＋2×けらば出 ＝ ${f1(r.B2)}；W′ ＝ 梁間＋2×軒の出 ＝ ${f1(r.W2)}`,
          `椽木長 ＝ (梁間/2＋軒の出) × 伸長率 ＝ ${f1(args.W / 2 + args.E)} × ${k4(r.k)} ＝ ${f1(r.rafter)}`,
          `棟高（軒桁天端）＝ 梁間/2 × n/10 ＝ ${f1(args.W / 2)} × ${fmtNum(N.v / 10, 2)} ＝ ${f1(r.ridgeHKeta)}`,
          `棟高（軒先）＝ W′/2 × n/10 ＝ ${f1(r.ridgeHEave)}`,
          r.rafterPerSide === null ? '椽木支數：請填椽木間距' : `支數（單面）＝ floor(B′ ÷ 間距) ＋ 1 ＝ floor(${f1(r.B2)} ÷ ${f1(args.P)}) ＋ 1 ＝ ${r.rafterPerSide}`,
          `面積 ＝ W′ × B′ × 伸長率 ＝ ${fmtNum(r.areaMm2 / 1e6, 2)} m²`,
          `山牆 ＝ 梁間 × 棟高 ÷ 2 ＝ ${fmtNum(r.gableMm2 / 1e6, 2)} m²`,
        ] },
      ];
    } else {
      items = [
        { k: '平椽長（到軒先）', jp: '平垂木', v: mm(r.rafter), sub: mmSub(r.rafter), big: true },
        { k: '角梁長（四支相同）', jp: '隅木', v: mm(r.hip), sub: mmSub(r.hip), big: true },
        { k: '配付椽每支遞減', jp: '減り', v: r.decrement === null ? '—（請填椽木間距）' : mm(r.decrement), sub: r.decrement === null ? '' : '往角梁方向，每一間距短這麼多' },
        { k: '隅勾配', v: sun(r.hipKobai) },
        { k: '角梁平面長', v: mm(r.hipPlan), sub: mmSub(r.hipPlan) },
        { k: '棟長', v: mm(r.ridgeLen), sub: r.ridgeLen < 1e-6 ? '方形（攢尖）：沒有棟' : mmSub(r.ridgeLen) },
        { k: '棟高（從軒桁天端）', v: mm(r.ridgeHKeta), sub: mmSub(r.ridgeHKeta) },
        { k: '棟高（從軒先）', v: mm(r.ridgeHEave), sub: mmSub(r.ridgeHEave) },
        { k: '屋面面積', ...area(r.areaMm2), big: true },
        { k: '伸長率', v: k4(r.k) },
        { fx: [
          `B′ ＝ 桁行＋2×軒の出 ＝ ${f1(r.B2)}；W′ ＝ 梁間＋2×軒の出 ＝ ${f1(r.W2)}`,
          `平椽 ＝ W′/2 × 伸長率 ＝ ${f1(r.W2 / 2)} × ${k4(r.k)} ＝ ${f1(r.rafter)}`,
          `角梁 ＝ W′/2 × √(200＋n²)/10 ＝ ${f1(r.W2 / 2)} × ${k4(Math.sqrt(200 + N.v ** 2) / 10)} ＝ ${f1(r.hip)}`,
          r.decrement === null ? '減り：請填椽木間距' : `減り ＝ 間距 × 伸長率 ＝ ${f1(args.P)} × ${k4(r.k)} ＝ ${f1(r.decrement)}`,
          `棟長 ＝ B′ − W′ ＝ ${f1(r.ridgeLen)}`,
          `棟高（軒桁天端）＝ 梁間/2 × n/10 ＝ ${f1(r.ridgeHKeta)}；（軒先）＝ W′/2 × n/10 ＝ ${f1(r.ridgeHEave)}`,
          `面積 ＝ B′ × W′ × 伸長率 ＝ ${fmtNum(r.areaMm2 / 1e6, 2)} m²`,
        ] },
      ];
    }
    items.push({ note: '不包含：鼻隠し（封簷板）、母屋成、材料尺寸、水下的加減。等勾配、真隅。寄棟的椽木支數依收頭方式而變，所以不顯示。' });
    renderBox($('yn-out'), items, { tool: 'yane',
      inputs: `${shape === 'kiri' ? '切妻' : '寄棟'}・桁行 ${mm(args.B)}・梁間 ${mm(args.W)}・坡度 ${nn} 寸・軒の出 ${mm(args.E)}${shape === 'kiri' ? `・けらば出 ${mm(args.Eg)}` : ''}${args.P ? `・間距 ${mm(args.P)}` : ''}`,
      res: shape === 'kiri' ? `椽木長 ${mm(r.rafter)}` : `平椽 ${mm(r.rafter)}・角梁 ${mm(r.hip)}` });
  }

  /* ═════════════ 屋面面積 ═════════════ */
  function renderArea() {
    $('ar-err').textContent = '';
    const A = readNum('ar-plan'), N = readNum('ar-n');
    if (A.error || N.error) $('ar-err').textContent = '請輸入數字';
    let r = null;
    if (A.v !== undefined && N.v !== undefined) { try { r = roofArea(A.v, N.v); } catch (e) { $('ar-err').textContent = e.message; } }
    fig('ar-fig', areaFigure(r ? { planM2: r.planM2, m2: r.m2, k: r.k } : {}));
    if (!r) { renderBox($('ar-out'), null); return; }
    renderBox($('ar-out'), [
      { k: '屋面實際面積', v: m2(r.m2), big: true },
      { k: '伸長率', v: k4(r.k) },
      { k: '換算坪', v: tsubo(r.tsubo) },
      { fx: [`實際面積 ＝ 水平面積 × 伸長率 ＝ ${fmtNum(r.planM2, 2)} × ${k4(r.k)} ＝ ${fmtNum(r.m2, 2)}`, `1 坪 ＝ 400/121 m² ≈ ${k4(TSUBO_M2)} m²`] },
    ], { tool: 'area', inputs: `水平投影 ${fmtNum(r.planM2, 2)} m²・坡度 ${fmtNum(N.v, 2)} 寸`, res: `實際 ${m2(r.m2)}（${tsubo(r.tsubo)}）` });
  }

  /* ═════════════ 三邊・對角線 ═════════════ */
  const DG = { hyp: ['水平（殳）', '垂直（勾）'], leg: ['斜邊（玄）', '已知的一邊'], angle: ['水平（殳）', ''] };
  function renderDiag() {
    const mode = segVal('dg-mode');
    $('dg-la').textContent = DG[mode][0]; $('dg-lb').textContent = DG[mode][1];
    $('dg-rb').hidden = mode === 'angle'; $('dg-rang').hidden = mode !== 'angle';
    const err = $('diag-err'); err.textContent = '';
    const A = readLen('diag-a', null), B = readLen('diag-b', null), G = readNum('dg-ang');
    let r = null;
    if (A.error || (mode !== 'angle' && B.error) || (mode === 'angle' && G.error)) err.textContent = '算式有誤，請檢查輸入';
    else {
      const q = mode === 'angle' ? G.v : B.mm;
      if (A.mm !== undefined && q !== undefined) { try { r = triangle(mode, A.mm, q); } catch (e) { err.textContent = e.message; } }
    }
    const n = r ? (10 * r.kou) / r.den : 7.5;
    fig('diag-fig', triangleFigure({ n, labels: r ? { den: `殳 ${f1(r.den)}`, kou: `勾 ${f1(r.kou)}`, gen: `玄 ${f1(r.gen)}` } : { den: '水平（殳）', kou: '垂直（勾）', gen: '斜邊（玄）' },
      angleText: r ? ang(r.angleDeg) : '', nums: r ? [`3:4:5 ＝ 矩（直角）的基本`, '（mm）'] : [] }));
    if (!r) renderBox($('diag-out'), null);
    else {
      renderBox($('diag-out'), [
        { k: '斜邊（玄）', v: mm(r.gen), sub: mmSub(r.gen), big: mode !== 'leg' },
        { k: '水平（殳）', v: mm(r.den), sub: mmSub(r.den) },
        { k: '垂直（勾）', v: mm(r.kou), sub: mmSub(r.kou), big: mode === 'leg' },
        { k: '角度（對水平）', v: ang(r.angleDeg) },
        { k: '換算坡度', v: sun(r.kobai) },
        { fx: mode === 'hyp' ? [`玄 ＝ √(殳²＋勾²) ＝ √(${f1(r.den)}²＋${f1(r.kou)}²) ＝ ${f1(r.gen)}`, `角度 ＝ atan(勾/殳) ＝ ${ang(r.angleDeg)}`]
          : mode === 'leg' ? [`勾 ＝ √(玄²−殳²) ＝ √(${f1(r.gen)}²−${f1(r.den)}²) ＝ ${f1(r.kou)}`, `角度 ＝ atan(勾/殳) ＝ ${ang(r.angleDeg)}`]
            : [`勾 ＝ 殳 × tan θ ＝ ${f1(r.kou)}`, `玄 ＝ 殳 ÷ cos θ ＝ ${f1(r.gen)}`] },
      ], { tool: 'diag', inputs: `${DG[mode][0]} ${mm(A.mm)}・${mode === 'angle' ? `角度 ${fmtNum(G.v, 2)}°` : `${DG[mode][1]} ${mm(B.mm)}`}`, res: `玄 ${mm(r.gen)}・勾 ${mm(r.kou)}` });
    }

    // 抓直角檢查
    const D1 = readLen('diag-d1', null), D2 = readLen('diag-d2', null);
    const chk = $('diag-chk'), cerr = $('diag-chk-err');
    chk.textContent = ''; cerr.textContent = '';
    let sq = {};
    if (D1.error || D2.error) cerr.textContent = '算式有誤，請檢查輸入';
    else if (D1.mm !== undefined && D2.mm !== undefined) {
      const d = D1.mm - D2.mm;
      renderBox(chk, [
        { k: '差（① − ②）', v: mm(d), sub: mmSub(Math.abs(d)) },
        { k: '判定', v: Math.abs(d) < 0.5 ? '兩條一致 ✓' : (d > 0 ? '① 較長' : '② 較長'), big: true },
      ]);
      sq = { d1: D1.mm, d2: D2.mm };
    }
    fig('sq-fig', squareCheck(sq));
  }

  /* ═════════════ 坡度速查表 ═════════════ */
  function renderTable() {
    const box = $('tb-out'); box.textContent = '';
    const rows = slopeTable();
    const tbl = h('table', { class: 'qtable' },
      h('thead', {}, h('tr', {}, h('th', { text: '坡度' }), h('th', { text: '角度' }), h('th', { text: '伸長率' }), h('th', { text: '隅勾配' }))),
      h('tbody', {}, rows.map((r) => h('tr', {
        class: r.kobai === 10 ? 'on' : '', tabindex: '0', role: 'button', 'aria-label': `${r.kobai} 寸，帶到勾股玄計算`,
        onclick: () => openKouko(r.kobai), onkeydown: (e) => { if (e.key === 'Enter') openKouko(r.kobai); },
      }, h('td', { text: `${fmtNum(r.kobai, 1)} 寸` }), h('td', { text: ang(r.angleDeg) }), h('td', { text: k4(r.nobi) }), h('td', { text: sun(r.hipKobai) })))));
    box.append(h('div', { class: 'rcard tblcard' }, tbl));
  }
  function openKouko(n) {
    $('ko-n').value = String(n);
    state.inputs = state.inputs || {}; state.inputs['ko-n'] = String(n); save();
    location.hash = '#/calc/kouko';
  }

  /* ═════════════ 計算紀錄 ═════════════ */
  function restore(e) {
    for (const [id, v] of Object.entries(e.inp)) {
      const el = $(id);
      if (!el || !el.closest(`#tab-${e.tool}`) || el.classList.contains('nopersist')) continue;   // 只還原該工具自己的欄位
      el.value = v;
      state.inputs = state.inputs || {}; state.inputs[id] = v;
    }
    save();
    location.hash = `#/calc/${e.tool}`;
  }
  function renderLog() {
    const box = $('lg-out'); box.textContent = '';
    if (!log.length) { box.append(h('p', { class: 'note', text: '還沒有紀錄。在各計算結果下方按「存到計算紀錄」，就會出現在這裡。' })); return; }
    const day = (ts) => { const d = new Date(ts), t = new Date(); return d.toDateString() === t.toDateString() ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`; };
    let cur = '', card = null;
    for (const e of log) {
      const d = day(e.ts);
      if (d !== cur) { cur = d; box.append(h('h3', { class: 'sec-h', text: d })); card = h('div', { class: 'rcard' }); box.append(card); }
      const t = new Date(e.ts);
      card.append(h('button', { type: 'button', class: 'logrow', onclick: () => restore(e) },
        svgIcon(MENU.flatMap((g) => g.items).find((x) => x[0] === e.tool)?.[2] || 'history'),
        h('span', { class: 'lgt' },
          h('span', { class: 'lgh' }, h('b', { text: e.title }), h('small', { text: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` })),
          e.sum ? h('small', { class: 'lgs', text: e.sum }) : null,
          h('span', { class: 'lgr', text: e.res }))));
    }
    box.append(h('p', { class: 'note', text: `最多保存 ${LOG_MAX} 筆，滿了會從最舊的開始刪（目前 ${log.length} / ${LOG_MAX}）。點一筆可以回到那次的計算。` }));
  }

  /* ═════════════ 設定 ═════════════ */
  function renderSettings() {
    $('st-dec').value = String(prefs.dec); $('st-ang').value = prefs.ang;
    syncSeg($('st-dec')); syncSeg($('st-ang'));
    const box = $('st-log'); box.textContent = '';
    box.append(h('div', { class: 'rrow' }, h('span', { class: 'rk', text: '保存筆數' }), h('span', { class: 'rv' }, h('b', { text: `${log.length} / ${LOG_MAX}` }))));
    box.append(h('button', { type: 'button', class: 'arow danger', text: '刪除全部計算紀錄', onclick: () => {
      if (!log.length || !confirm('刪除全部計算紀錄？刪除後無法復原。')) return;
      log = []; state.log = log; save(); renderSettings(); toast('已刪除');
    } }));
    $('st-ver').textContent = `版本 v${document.documentElement.dataset.v}`;
  }
  function onPref() {
    prefs = sanitizePrefs({ dec: Number($('st-dec').value), ang: $('st-ang').value });
    state.prefs = prefs; save();
  }

  /* ═════════════ 選單 ═════════════ */
  function renderMenu() {
    const box = $('calc-menu');
    if (box.firstChild) return;
    for (const grp of MENU) {
      if (grp.g) box.append(h('h3', { class: 'sec-h' }, grp.g, h('i', { class: 'jp', text: ` ${grp.jp}` })));
      box.append(h('div', { class: 'rcard menu' }, grp.items.map(([id, sub, icon]) => h('a', { class: 'mrow', href: `#/calc/${id}` },
        svgIcon(icon),
        h('span', { class: 'mt' }, h('b', {}, CALC_TOOLS[id], TOOL_JP[id] ? h('i', { class: 'jp', text: ` ${TOOL_JP[id]}` }) : null), h('small', { text: sub })),
        h('span', { class: 'arrow', text: '›' })))));
    }
  }

  function init() {
    initSegs();
    for (const id of ['st-dec', 'st-ang']) $(id).addEventListener('input', onPref);
  }

  return {
    init,
    prefs: () => prefs,
    logAdd,
    renderers: {
      'tab-menu': renderMenu, 'tab-slope': renderSlope, 'tab-kouko': renderKouko, 'tab-sumi': renderSumi, 'tab-yane': renderYane,
      'tab-area': renderArea, 'tab-diag': renderDiag, 'tab-table': renderTable, 'tab-log': renderLog, 'tab-settings': renderSettings,
    },
  };
}

