import { evalLength, toKenShaku, toTaiShaku, fmtMm, toShaku } from './units.js';
import { createGlossaryUI } from './glossary-ui.js';
import { applyKey, softEval } from './keypad.js';
import { renderFour } from './four.js';
import { renderLuban, renderLubanSummary } from './luban-ui.js';
import { renderJointPage } from './joint-ui.js';
import { JOINTS } from './joints.js';
import { renderInstall, showInAppBanner, inAppName, isStandalone } from './install-ui.js';
import { arcFigure, arcConcept, tri345, unitLadder, composition } from './figures.js';
import { arcFromChordRise, arcFromChordRadius, arcOffsets } from './calc.js';
import { createCalcUI, CALC_TOOLS } from './calc-ui.js';

const $ = (id) => document.getElementById(id);
const STORE = 'mokusaku.v1';
const VERSION = '36'; // 與 sw.js 的 VERSION、index.html 的 <html data-v> 必須一致

/* ---------- 儲存（localStorage 可能被擋，全部包 try） ---------- */
let state = {};
try { state = JSON.parse(localStorage.getItem(STORE)) || {}; } catch { state = {}; }
function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ } }

/* ---------- 顯示小工具 ---------- */
// 標籤：台灣用語為主，日文為輔
const L = (zh, jp) => `${zh}${jp ? ` <i class="jp">${jp}</i>` : ''}`;
// 長度：mm、台尺（丈尺寸分）為主，日式（間尺寸分）為輔
const len = (label, mm) => `
  <div class="line"><span class="k">${label}</span>
  <span class="v">${fmtMm(mm, calcUI.prefs().dec)} mm<small>${toTaiShaku(mm)}（${toShaku(mm)}尺）</small>
  <small class="jp">日式 ${toKenShaku(mm)}</small></span></div>`;
const plain = (label, text) => `<div class="line"><span class="k">${label}</span><span class="v">${text}</span></div>`;
const n = (v, d = 3) => `${+v.toFixed(d)}`;

/** 嘗試解析長度欄位：回傳 {mm} 或 {error} 或 {} (空) */
function readLen(id, errId) {
  try {
    const mm = evalLength($(id).value);
    if (errId) $(errId).textContent = '';
    return mm === null ? {} : { mm };
  } catch (e) {
    if (errId) $(errId).textContent = `${e.message}`;
    return { error: true };
  }
}

/* ---------- 木作計算機：選單與各工具（js/calc-ui.js） ---------- */
const calcUI = createCalcUI({ $, state, save, readLen });

/* ---------- 1. 尺貫混算 ---------- */
let history = (Array.isArray(state.history) ? state.history : [])
  .filter((x) => x && typeof x.expr === 'string' && x.expr.length <= 300 && Number.isFinite(x.mm)).slice(0, 30);   // 讀取時檢查型別，避免被竄改的內容進入畫面

const luban = state.luban && typeof state.luban === 'object' ? state.luban : {}; // 魯班尺一循環的長度選擇（魯班尺分頁用）
function setFour(mm, partial) { renderFour($('four-panel'), mm, { partial }); }

// 結果框永遠是同樣的四行（空白時顯示淡色的 0），高度固定，按鍵才不會被推上推下
function showCalcResult(out, mm, { empty = false, error = '' } = {}) {
  const has = Number.isFinite(mm);
  out.innerHTML = `
    <div class="mm">${has ? fmtMm(mm, calcUI.prefs().dec) : empty ? '0' : '—'}<small>mm</small></div>
    <div class="shaku"></div>
    <div class="shaku2">${has ? `${toShaku(mm)} 尺　／　${n(mm / 1000, 4)} m` : '0 尺　／　0 m'}</div>
    <div class="shaku2 jp">日式 ${has ? toKenShaku(mm) : '—'}</div>`;
  const sh = out.querySelector('.shaku');
  sh.textContent = error || (has ? toTaiShaku(mm) : '0 尺');   // 錯誤訊息用 textContent
  sh.classList.toggle('err-line', !!error);
  out.classList.toggle('is-blank', !has);
}
function renderCalc() {
  const out = $('calc-out'), hint = $('calc-hint');
  const r = softEval($('calc-expr').value);
  out.classList.remove('partial');
  hint.textContent = '';
  if (r.empty) { showCalcResult(out, NaN, { empty: true }); $('mix-fig').innerHTML = ''; setFour(null); return null; }
  if (r.error) {
    showCalcResult(out, NaN, { error: r.error.message });
    $('mix-fig').innerHTML = ''; setFour(null);
    return null;
  }
  if (r.incomplete) {
    showCalcResult(out, NaN, { empty: true });
    hint.textContent = r.pending ? '請點單位：丈、尺、寸、分、間、mm' : '請繼續輸入數字';
    $('mix-fig').innerHTML = ''; setFour(null);
    return null;
  }
  const mm = r.mm;
  $('mix-fig').innerHTML = composition(mm);
  setFour(mm, !!r.partial);
  showCalcResult(out, mm);
  if (r.partial) {
    out.classList.add('partial');
    hint.textContent = r.pending ? '最後的數字還沒點單位（先顯示前面的結果）'
      : r.dangling ? '請繼續輸入數字（先顯示前面的結果）'
        : '括號還沒補完（先當作已補上右括號）';
    return null; // 還沒輸入完的結果不可記錄
  }
  if (r.pending) hint.textContent = '沒點單位的數字會當作 mm';
  return mm;
}
function renderHistory() {
  const ul = $('history');
  ul.textContent = '';
  for (const h of history) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    const ex = document.createElement('div'), rs = document.createElement('div'), em = document.createElement('em');
    ex.className = 'h-expr'; rs.className = 'h-res';
    ex.textContent = h.expr; em.textContent = toTaiShaku(h.mm); rs.append(`${fmtMm(h.mm)} mm`, em);
    b.append(ex, rs);
    b.addEventListener('click', () => {
      $('calc-expr').value = h.expr;
      $('calc-expr').dispatchEvent(new Event('input', { bubbles: true }));
    });
    li.append(b);
    ul.append(li);
  }
}
$('calc-expr').addEventListener('input', renderCalc);
$('calc-save').addEventListener('click', () => {
  const mm = renderCalc();
  const expr = $('calc-expr').value.trim();
  if (mm === null || !expr) return;
  history = [{ expr, mm }, ...history.filter((h) => h.expr !== expr)].slice(0, 30);
  state.history = history; save(); renderHistory();
  calcUI.logAdd({ tool: 'mix', title: '台尺混算', sum: expr, res: `${fmtMm(mm, calcUI.prefs().dec)} mm（${toTaiShaku(mm)}）`, inp: { 'calc-expr': expr } });
});

// 按鍵面板（台尺混算與魯班尺共用）：pointerdown 時 preventDefault，輸入欄不會失去焦點，也不會跳出手機鍵盤
const KEYPAD_HTML = `
<button type="button" class="k u" data-k="丈">丈</button>
<button type="button" class="k u" data-k="尺">尺</button>
<button type="button" class="k u" data-k="寸">寸</button>
<button type="button" class="k u" data-k="分">分</button>
<button type="button" class="k u" data-k="間">間</button>
<button type="button" class="k" data-k="7">7</button>
<button type="button" class="k" data-k="8">8</button>
<button type="button" class="k" data-k="9">9</button>
<button type="button" class="k op" data-k="÷">÷</button>
<button type="button" class="k fn" data-k="bs" aria-label="退格">⌫</button>
<button type="button" class="k" data-k="4">4</button>
<button type="button" class="k" data-k="5">5</button>
<button type="button" class="k" data-k="6">6</button>
<button type="button" class="k op" data-k="×">×</button>
<button type="button" class="k fn" data-k="ac" aria-label="全部清除">清除</button>
<button type="button" class="k" data-k="1">1</button>
<button type="button" class="k" data-k="2">2</button>
<button type="button" class="k" data-k="3">3</button>
<button type="button" class="k op" data-k="−">−</button>
<button type="button" class="k op" data-k="(">(</button>
<button type="button" class="k" data-k="0">0</button>
<button type="button" class="k" data-k=".">.</button>
<button type="button" class="k u" data-k="mm">mm</button>
<button type="button" class="k op" data-k="+">＋</button>
<button type="button" class="k op" data-k=")">)</button>
<button type="button" class="k u" data-k="厘">厘</button>
<button type="button" class="k u" data-k="cm">cm</button>
<button type="button" class="k u" data-k="m">m</button>
<button type="button" class="k sq" data-k="×√2" aria-label="乘以根號二：裏目、對角線">×√2</button>
<button type="button" class="k sq" data-k="÷√2" aria-label="除以根號二：角目">÷√2</button>
`;
/** 數字按鍵（坡度、角度、面積等純數字欄位）：frac＝分數欄位多「/」「:」；int＝只能整數 */
function numKeypadHtml({ frac = false, int = false } = {}) {
  const k = (key, label = key, cls = 'k') => `<button type="button" class="${cls}" data-k="${key}"${key === 'bs' ? ' aria-label="退格"' : key === 'ac' ? ' aria-label="全部清除"' : ''}>${label}</button>`;
  return `<div class="numpad">${k('7')}${k('8')}${k('9')}${k('bs', '⌫', 'k fn')}${k('4')}${k('5')}${k('6')}${k('ac', '清除', 'k fn')}${k('1')}${k('2')}${k('3')}${frac ? k('/', '/', 'k op') : '<span></span>'}${k('0')}${int ? '<span></span>' : k('.')}${frac ? k(':', ':', 'k op') : '<span></span>'}<span></span></div>`;
}
/** 分數用的「/」「:」：只能接在數字後面、一個欄位只能有一個 */
function applyFracKey(value, s0, e0, key) {
  const before = value.slice(0, s0), after = value.slice(e0);
  if (!/\d$/.test(before) || /[/:]/.test(before + after)) return null;
  return { value: before + key + after, caret: s0 + 1 };
}
function wireKeypad(host, getInput, html = KEYPAD_HTML) {
  host.innerHTML = html;
  const press = (key) => {
    const input = getInput();
    if (!input) return;
    const s0 = input.selectionStart ?? input.value.length;
    const e0 = input.selectionEnd ?? s0;
    if (input.classList.contains('num') && (key === '.' && input.dataset.kp === 'int')) return;
    const r = key === '/' || key === ':' ? applyFracKey(input.value, s0, e0, key) : applyKey(input.value, s0, e0, key);
    if (!r) return;
    input.value = r.value;
    input.setSelectionRange(r.caret, r.caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  host.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button[data-k]');
    if (!b) return;
    e.preventDefault();
    press(b.dataset.k);
  });
  host.addEventListener('click', (e) => { // 鍵盤（Enter／空白鍵）操作
    const b = e.target.closest('button[data-k]');
    if (b && e.detail === 0) press(b.dataset.k);
  });
}
wireKeypad($('keypad'), () => $('calc-expr'));
wireKeypad($('lb-keypad'), () => $('lb-len'));

// 預設不跳手機鍵盤（inputmode=none）；需要打其他字時可切換（兩個分頁共用這個選擇）
function applySysKb() {
  const on = !!state.calcSysKb;
  for (const [inp, btn] of [['calc-expr', 'calc-kb'], ['lb-len', 'lb-kb']]) {
    $(inp).inputMode = on ? 'text' : 'none';
    $(btn).textContent = on ? '🔢 改回按鍵輸入' : '⌨ 改用手機鍵盤';
  }
}
for (const [inp, btn] of [['calc-expr', 'calc-kb'], ['lb-len', 'lb-kb']]) {
  $(btn).addEventListener('click', () => {
    state.calcSysKb = !state.calcSysKb; save(); applySysKb();
    $(inp).focus();
  });
}
applySysKb();

/* ---------- 底部輸入面板（不跳手機鍵盤） ----------
   點長度欄位 → 升起台尺按鍵（丈尺寸分…），上方即時顯示算出幾 mm、幾丈幾尺；
   點純數字欄位（坡度、角度、面積…）→ 升起數字按鍵。 */
const sheetEl = $('sheet');
let sheetTarget = null;
const sheetFieldSel = '#page-calc .panel:not(#tab-mix):not(#tab-luban) input.len, #page-calc input.num, #page-joint input.len';
const fieldTitle = (el) => { const sp = el.closest('label') && el.closest('label').querySelector('span'); return sp ? sp.textContent.trim() : '長度'; };

const isFrac = (el) => el.id === 'sl-val' && $('sl-mode').value === 'fraction';
function updateSheetLive() {
  if (!sheetTarget) return;
  if (sheetTarget.classList.contains('num')) {
    const v = sheetTarget.value.trim(), row = sheetTarget.closest('.irow, .field');
    const unit = row && row.querySelector('.iu') ? row.querySelector('.iu').textContent : '';
    $('sheet-live').textContent = v ? `＝ ${v}${unit ? ` ${unit}` : ''}` : (isFrac(sheetTarget) ? '輸入「立上高/水平」，例如 4/10、1:2.5' : '輸入數字');
    $('sheet-live').classList.remove('bad');
    return;
  }
  const r = softEval(sheetTarget.value);
  let text, bad = false;
  if (r.empty) text = '點數字，再點單位（丈・尺・寸・分・間・mm）';
  else if (r.error) { text = r.error.message; bad = true; }
  else if (r.incomplete) text = r.pending ? '請點單位' : '請繼續輸入數字';
  else text = `= ${fmtMm(r.mm, 1)} mm（${toTaiShaku(r.mm)}）${r.partial ? '・還沒輸入完' : r.pending ? '・沒點單位會當作 mm' : ''}`;
  $('sheet-live').textContent = text;
  $('sheet-live').classList.toggle('bad', bad);
}
function ensureVisible(el) { // 讓正在編輯的欄位停在面板上方、標題列下方
  const sh = sheetEl.offsetHeight;
  const limit = innerHeight - sh - 12;
  const top = $('topbar').getBoundingClientRect().bottom + 8;
  const r = el.getBoundingClientRect();
  if (r.bottom > limit) scrollBy({ top: r.bottom - limit + 8 });
  else if (r.top < top) scrollBy({ top: r.top - top });
}
let sheetKind = 'len';
function openSheet(el) {
  sheetTarget = el;
  const kind = el.classList.contains('num') ? `num${isFrac(el) ? '-frac' : el.dataset.kp === 'int' ? '-int' : ''}` : 'len';
  if (kind !== sheetKind) {      // 換一組按鍵（按鍵的事件是掛在外框上，換內容不用重新綁）
    sheetKind = kind;
    $('sheet-keypad').innerHTML = kind === 'len' ? KEYPAD_HTML : numKeypadHtml({ frac: kind === 'num-frac', int: kind === 'num-int' });
    $('sheet-keypad').classList.toggle('isnum', kind !== 'len');
  }
  $('sheet-title').textContent = fieldTitle(el);
  sheetEl.hidden = false;
  document.body.classList.add('sheet-open');
  updateSheetLive();
  requestAnimationFrame(() => {
    document.body.style.setProperty('--sheet-h', `${sheetEl.offsetHeight}px`);
    ensureVisible(el);
  });
}
function closeSheet() {
  if (!sheetTarget) return;
  sheetTarget = null;
  sheetEl.hidden = true;
  document.body.classList.remove('sheet-open');
}
wireKeypad($('sheet-keypad'), () => sheetTarget);
document.querySelectorAll(sheetFieldSel).forEach((el) => {
  el.addEventListener('focus', () => openSheet(el));
  el.addEventListener('click', () => { if (sheetTarget !== el) openSheet(el); });
});
$('sheet-done').addEventListener('click', () => { const t = sheetTarget; closeSheet(); if (t) t.blur(); });
document.addEventListener('input', (e) => { if (e.target === sheetTarget) updateSheetLive(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
document.addEventListener('focusin', (e) => { // 跳到別的（非長度）欄位 → 收起面板，改用該欄位自己的輸入方式
  if (sheetTarget && !sheetEl.contains(e.target) && !e.target.matches(sheetFieldSel)) closeSheet();
});
document.addEventListener('pointerdown', (e) => { // 點面板與長度欄位以外的地方 → 收起
  if (!sheetTarget || sheetEl.contains(e.target)) return;
  const lab = e.target.closest('label');
  if (e.target.closest('input.len, input.num') || (lab && lab.querySelector('input.len, input.num'))) return;
  closeSheet();
});
addEventListener('resize', () => { if (sheetTarget) ensureVisible(sheetTarget); });

/* ---------- 3. R・弧 ---------- */
function renderArc() {
  const mode = $('arc-mode').value;
  $('arc-v-label').textContent = mode === 'h' ? '弧高 h' : '半徑 R';
  const out = $('arc-out'), tbl = $('arc-table'), err = $('arc-err');
  out.innerHTML = ''; tbl.innerHTML = ''; err.textContent = '';
  $('arc-fig').innerHTML = '';              // 概念圖（#arc-concept）永遠顯示在最下面
  const C = readLen('arc-c', null), V = readLen('arc-v', null);
  if (C.error || V.error) { err.textContent = '算式有誤，請檢查輸入'; return; }
  if (C.mm === undefined || V.mm === undefined) return;
  try {
    const a = mode === 'h' ? arcFromChordRise(C.mm, V.mm) : arcFromChordRadius(C.mm, V.mm);
    out.innerHTML = len('弦長 c', a.c) + len(L('弧高 h', '矢高'), a.h) + len('半徑 R', a.R) +
      plain('中心角', `${n(a.thetaDeg, 3)}°`) + len('弧長', a.arc);
    let div = parseInt($('arc-n').value, 10);
    if (!(div >= 2)) div = 8;
    div = Math.min(div, 40);
    if (a.h <= a.c / 2) {
      const offs = arcOffsets(a.c, a.h, div);
      $('arc-fig').innerHTML = arcFigure({ c: a.c, h: a.h, R: a.R, thetaDeg: a.thetaDeg, n: div, offsets: offs.map((r) => r.y) });
      const rows = offs.map((r) => `
        <tr><td>${r.i}</td>
        <td>${fmtMm(r.x)}<small>${toTaiShaku(r.x)}</small></td>
        <td>${fmtMm(r.y)}<small>${toTaiShaku(r.y)}</small></td></tr>`).join('');
      tbl.innerHTML = `<h2>分點高度（弦 ${div} 等分）</h2><div class="card">
        <table><thead><tr><th>點</th><th>從左端 mm</th><th>弧高 mm</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
  } catch (e) { err.textContent = e.message; }
}

/* ---------- 5. 魯班尺 ---------- */
let lbSpan = [20, 50, 100, 200].includes(state.lbSpan) ? state.lbSpan : 50;
function renderLubanTab() {
  const el = $('lb-len'), hint = $('lb-hint');
  const r = softEval(el.value);
  let mm = null, partial = false;
  hint.textContent = '';
  if (r.error) hint.textContent = r.error.message;
  else if (r.incomplete) hint.textContent = r.pending ? '請點單位：丈、尺、寸、分、間、mm' : '請繼續輸入數字';
  else if (!r.empty) {
    mm = r.mm; partial = !!r.partial;
    if (partial) hint.textContent = '還沒輸入完（先以前面的結果判斷）';
    else if (r.pending) hint.textContent = '沒點單位的數字會當作 mm';
  }
  renderLubanSummary($('lb-sum'), mm, luban, partial);
  renderLuban($('lb-panel'), mm, {
    cfg: luban, partial, span: lbSpan,
    onCfg: (id, cyc) => { luban[id] = cyc; state.luban = luban; save(); renderLubanTab(); },
    onSpan: (n) => { lbSpan = n; state.lbSpan = n; save(); renderLubanTab(); },
    onApply: (d) => {
      el.value = `${el.value.trim()} ${d > 0 ? '+' : '−'} ${Math.abs(d)}mm`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
  });
}

// 固定不變的圖：只畫一次
$('tri-fig').innerHTML = tri345();
$('mix-ladder').innerHTML = unitLadder();
$('arc-concept').innerHTML = arcConcept();

/* ---------- 升級：把 v11 存的「數字＋單位下拉」合成「12尺」 ---------- */
(function migrateUnitSelects() {
  const inp = state.inputs;
  if (!inp) return;
  let changed = false;
  for (const key of Object.keys(inp)) {
    if (!key.endsWith('-u')) continue;
    const id = key.slice(0, -2), v = inp[id];
    if (typeof v === 'string' && /^[\d.]+$/.test(v.trim())) inp[id] = v.trim() + inp[key];
    delete inp[key];
    changed = true;
  }
  // v32：屋頂坡度分頁拆成「勾股玄」與「角梁・谷木」，把舊欄位的值帶過去
  for (const [from, to] of [['roof-kobai', 'ko-n'], ['roof-a', 'ko-den'], ['roof-pitch', 'su-p'], ['roof-first', 'su-first']]) {
    if (typeof inp[from] === 'string' && inp[from] && !inp[to]) { inp[to] = inp[from]; if (to === 'ko-n') inp['su-n'] = inp['su-n'] || inp[from]; if (to === 'ko-den') inp['su-den'] = inp['su-den'] || inp[from]; changed = true; }
  }
  if (changed) save();
})();

/* ---------- 輸入欄位共通：還原 / 儲存 / 更新 ---------- */
const renderers = {
  'tab-mix': renderCalc, 'tab-arc': renderArc, 'tab-luban': renderLubanTab,
  ...calcUI.renderers,
  'page-joint': () => renderJointPage({ $, state, save, readLen }),
};
calcUI.init();
document.querySelectorAll('main input, main select').forEach((el) => {
  if (el.classList.contains('nopersist')) return; // 搜尋框、新增詞條表單不存草稿
  if (state.inputs && el.id in state.inputs) el.value = state.inputs[el.id];
  el.addEventListener('input', () => {
    state.inputs = state.inputs || {};
    state.inputs[el.id] = el.value;
    save();
    const sec = el.closest('section');
    if (sec && renderers[sec.id]) renderers[sec.id]();
  });
});

/* ---------- 路由 ----------
   #/ 首頁　#/install 安裝教學
   #/joint[/oikake|kama|koshikake] 仕口・継手 比例速查
   #/calc 木作計算機選單；#/calc/<工具> 各工具（見 js/calc-ui.js 的 CALC_TOOLS）（四個分頁；沒寫分頁就開上次用的）
   舊網址 #/roof #/arc #/diag 會自動導到 #/calc/… */
const CALC_TABS = CALC_TOOLS;
const CALC_ALIAS = { roof: 'kouko' };   // 舊網址：屋頂坡度分頁已拆成勾股玄、角梁・谷木
const PAGES = ['home', 'install', 'calc', 'glossary', 'joint'];
const glossary = createGlossaryUI({ state, save });
const LEGACY = ['roof', 'arc', 'diag'];

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  let page = parts[0] || 'home';
  let sub = parts[1];
  if (LEGACY.includes(page)) { location.replace(`#/calc/${page}`); return; }
  if (!PAGES.includes(page)) page = 'home';
  const isCalc = page === 'calc';
  if (isCalc) {
    if (sub in CALC_ALIAS) { location.replace(`#/calc/${CALC_ALIAS[sub]}`); return; }
    if (!(sub in CALC_TABS)) sub = 'menu';
  }

  document.querySelectorAll('main > section').forEach((sec) => { sec.hidden = sec.id !== `page-${page}`; });
  if (isCalc) document.querySelectorAll('#page-calc > .panel').forEach((p) => { p.hidden = p.id !== `tab-${sub}`; });

  if (page === 'joint' && JOINTS.some((j) => j.id === sub)) { state.jointId = sub; save(); }   // 網址上的值要在已知清單內才存
  const title = isCalc ? CALC_TABS[sub]
    : page === 'install' ? '加到手機桌面'
      : page === 'joint' ? '仕口・継手 比例速查'
      : page === 'glossary' ? '台日大木作名詞＆構架對照庫' : '柴柴木作';
  $('topbar').hidden = page === 'home';
  $('backBtn').hidden = !(isCalc && sub !== 'menu');
  $('topTitle').textContent = title;
  $('topJp').textContent = isCalc && sub === 'menu' ? '電卓' : '';
  document.title = page === 'home' ? '柴柴木作｜日式大木作工具箱'
    : `${title}｜柴柴木作`;

  closeSheet();
  if (isCalc) renderers[`tab-${sub}`]();
  if (page === 'home') renderHome();
  if (page === 'install') renderInstall();
  showInAppBanner();
  if (page === 'glossary') glossary.render();
  if (page === 'joint') renderers['page-joint']();
  window.scrollTo(0, 0);
}


function renderHome() {
  // 加到桌面提醒
  let hidden = false;
  try { hidden = !!localStorage.getItem('installHint'); } catch { /* ignore */ }
  $('instHint').hidden = isStandalone() || !!inAppName() || hidden;
}
$('instHide').addEventListener('click', () => {
  try { localStorage.setItem('installHint', '1'); } catch { /* ignore */ }
  $('instHint').hidden = true;
});

try { if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase('mokusaku-models'); } catch { /* ignore */ }   // 已移除「我的 3D 模型」，順手清掉舊資料
addEventListener('hashchange', route);
renderHistory();
route();

/* ---------- PWA：更新提示與版本一致檢查 ---------- */
function showBar(text, btnText, onClick) {
  if ($('updBar')) return;
  const bar = document.createElement('div');
  bar.id = 'updBar';
  bar.setAttribute('role', 'status');
  const span = document.createElement('span');
  span.textContent = text;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = btnText;
  btn.addEventListener('click', onClick);
  bar.append(span, btn);
  document.body.prepend(bar);
}

async function resetAndReload() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch { /* ignore */ }
  location.replace(`${location.pathname}?r=${Date.now()}${location.hash}`);
}

// 頁面 HTML 與 JS 版本不一致（舊快取混版）時，給使用者一個明確的出路，而不是一片空白
if (document.documentElement.dataset.v !== VERSION) {
  showBar('偵測到新舊版本混在一起，畫面可能不完整。', '清除快取並重新載入', resetAndReload);
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) showBar('已有新版本。', '重新載入', () => location.reload());
    });
  });
}
