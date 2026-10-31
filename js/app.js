import { evalLength, toKenShaku, toTaiShaku, fmtMm, toShaku } from './units.js';
import { createGlossaryUI } from './glossary-ui.js';
import { applyKey, softEval } from './keypad.js';
import { renderFour } from './four.js';
import { renderLuban, renderLubanSummary } from './luban-ui.js';
import {
  roofSection, hipSection, haitsukePlan, arcFigure, arcConcept, diagFigure, squareCheck, tri345,
  unitLadder, composition,
} from './figures.js';
import {
  roofFromKobai, roofLengths, haitsukeRafters, kobaiFromAngle, kobaiFromRiseRun,
  arcFromChordRise, arcFromChordRadius, arcOffsets, diagonal,
} from './calc.js';

const $ = (id) => document.getElementById(id);
const STORE = 'mokusaku.v1';
const VERSION = '13'; // 與 sw.js 的 VERSION、index.html 的 <html data-v> 必須一致

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
  <span class="v">${fmtMm(mm)} mm<small>${toTaiShaku(mm)}（${toShaku(mm)}尺）</small>
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

/* ---------- 1. 尺貫混算 ---------- */
let history = Array.isArray(state.history) ? state.history : [];

const luban = state.luban && typeof state.luban === 'object' ? state.luban : {}; // 魯班尺一循環的長度選擇（魯班尺分頁用）
function setFour(mm, partial) { renderFour($('four-panel'), mm, { partial }); }

function renderCalc() {
  const out = $('calc-out'), hint = $('calc-hint');
  const r = softEval($('calc-expr').value);
  out.classList.remove('partial');
  hint.textContent = '';
  if (r.empty) { out.innerHTML = ''; $('mix-fig').innerHTML = ''; setFour(null); return null; }
  if (r.error) {
    out.innerHTML = '<div class="err" style="display:block;margin:0"></div>';
    out.firstElementChild.textContent = r.error.message;
    $('mix-fig').innerHTML = ''; setFour(null);
    return null;
  }
  if (r.incomplete) {
    out.innerHTML = '';
    hint.textContent = r.pending ? '請點單位：丈、尺、寸、分、間、mm' : '請繼續輸入數字';
    $('mix-fig').innerHTML = ''; setFour(null);
    return null;
  }
  const mm = r.mm;
  $('mix-fig').innerHTML = composition(mm);
  setFour(mm, !!r.partial);
  out.innerHTML = `
    <div class="mm">${fmtMm(mm)}<small>mm</small></div>
    <div class="shaku">${toTaiShaku(mm)}</div>
    <div class="shaku2">${toShaku(mm)} 尺　／　${n(mm / 1000, 4)} m</div>
    <div class="shaku2 jp">日式 ${toKenShaku(mm)}</div>`;
  if (r.partial) {
    out.classList.add('partial');
    hint.textContent = r.pending ? '最後的數字還沒選單位，請點 丈／尺／寸／分…（目前顯示的是前面已算好的部分）'
      : r.dangling ? '請繼續輸入數字（目前顯示的是前面已算好的部分）'
        : '括號還沒補完（目前以補上右括號計算）';
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
    b.innerHTML = `<div class="h-expr"></div><div class="h-res"></div>`;
    b.querySelector('.h-expr').textContent = h.expr;
    b.querySelector('.h-res').innerHTML = `${fmtMm(h.mm)} mm<em>${toTaiShaku(h.mm)}</em>`;
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
function wireKeypad(host, getInput) {
  host.innerHTML = KEYPAD_HTML;
  const press = (key) => {
    const input = getInput();
    if (!input) return;
    const s0 = input.selectionStart ?? input.value.length;
    const e0 = input.selectionEnd ?? s0;
    const r = applyKey(input.value, s0, e0, key);
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

/* ---------- 長度輸入面板（屋頂坡度、弧線半徑、對角線） ----------
   點長度欄位 → 底部升起和台尺混算同一組按鍵；上方即時顯示算出幾 mm、幾丈幾尺。 */
const sheetEl = $('sheet');
let sheetTarget = null;
const sheetFieldSel = '#tab-roof input.len, #tab-arc input.len, #tab-diag input.len';
const fieldTitle = (el) => { const sp = el.closest('label') && el.closest('label').querySelector('span'); return sp ? sp.textContent.trim() : '長度'; };

function updateSheetLive() {
  if (!sheetTarget) return;
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
function openSheet(el) {
  sheetTarget = el;
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
  if (e.target.closest('input.len') || (lab && lab.querySelector('input.len'))) return;
  closeSheet();
});
addEventListener('resize', () => { if (sheetTarget) ensureVisible(sheetTarget); });

/* ---------- 2. 屋根・隅木・垂木 ---------- */
function roofKobai() {
  const mode = $('roof-mode').value;
  $('roof-f-kobai').hidden = mode !== 'kobai';
  $('roof-f-angle').hidden = mode !== 'angle';
  $('roof-f-rise').hidden = mode !== 'riserun';
  $('roof-f-run').hidden = mode !== 'riserun';
  $('roof-err').textContent = '';
  try {
    if (mode === 'kobai') {
      const v = parseFloat($('roof-kobai').value);
      return Number.isFinite(v) ? v : null;
    }
    if (mode === 'angle') {
      const v = parseFloat($('roof-angle').value);
      return Number.isFinite(v) ? kobaiFromAngle(v) : null;
    }
    const rise = evalLength($('roof-rise').value);
    const run = evalLength($('roof-run').value);
    if (rise === null || run === null) return null;
    return kobaiFromRiseRun(rise, run);
  } catch (e) {
    $('roof-err').textContent = e.message;
    return null;
  }
}

function renderRoof() {
  const xIn = roofKobai();
  const sample = xIn === null;              // 還沒輸入坡度：畫示意圖
  const x = sample ? 4.5 : xIn;
  const r = roofFromKobai(x);
  const basic = $('roof-basic');
  const A = readLen('roof-a', 'roof-a-err');
  const hasA = !sample && A.mm !== undefined && A.mm > 0;
  const R = hasA ? roofLengths(A.mm, x) : null;

  // 圖：屋頂剖面、角梁（沒有數字時畫示意圖）
  $('roof-fig').innerHTML = roofSection({
    x, a: hasA ? A.mm : null, rise: R ? R.rise : null, rafter: R ? R.rafter : null, angleDeg: r.angleDeg, sample });
  $('hip-fig').innerHTML = hipSection({
    x, a: hasA ? A.mm : null, planLen: R ? R.hipPlan : null, rise: R ? R.rise : null, hipLen: R ? R.hip : null,
    hipAngleDeg: r.hip.angleDeg, sample });

  const hBox = $('roof-haitsuke');
  const hErr = $('roof-h-err');
  hErr.textContent = '';
  hBox.innerHTML = '';
  $('hai-fig').innerHTML = haitsukePlan();   // 預設先畫示意圖，算得出來再換成實際數字
  if (sample) { basic.innerHTML = ''; $('roof-lengths').innerHTML = ''; return; }

  basic.innerHTML =
    plain(L('坡度', '寸勾配'), `${n(x, 3)} 寸`) +
    plain('角度', `${n(r.angleDeg, 3)}°`) +
    plain(L('椽木斜長 √(10²+勾²)', '垂木・玄'), `${n(r.gen, 4)}`) +
    plain(L('椽木伸長率（斜長÷10）', '伸び率'), `${n(r.nobi, 5)}`) +
    plain(L('角梁長弦 √(200+勾²)', '隅木・長玄'), `${n(r.hip.gen, 4)}`) +
    plain(L('角梁伸長率（長弦÷10）', '隅木 伸び率'), `${n(r.hip.nobi, 5)}`) +
    plain(L('角梁坡度（勾÷√2）', '隅木 勾配'), `${n(r.hip.kobai, 4)} 寸`) +
    plain(L('角梁角度', '隅木'), `${n(r.hip.angleDeg, 3)}°`);

  // 長さ
  const lenBox = $('roof-lengths');
  if (R) {
    lenBox.innerHTML =
      len('單邊水平長 a', A.mm) + len(L('椽木實長', '垂木'), R.rafter) + len(L('立上高', '立上り'), R.rise) +
      len(L('角梁平面長（a√2）', '隅木'), R.hipPlan) + len(L('角梁實長', '隅木'), R.hip);
  } else {
    lenBox.innerHTML = '';
    if (A.mm !== undefined && A.mm <= 0) $('roof-a-err').textContent = '水平長要大於 0';
  }

  // 配付垂木
  const P = readLen('roof-pitch', null);
  const F = readLen('roof-first', null);
  if (P.error || F.error) { hErr.textContent = '椽木間距或第一支椽木水平長的算式有誤'; return; }
  const first = F.mm !== undefined ? F.mm : A.mm;
  if (P.mm !== undefined && first !== undefined) {
    try {
      const h = haitsukeRafters(first, P.mm, x);
      const rows = h.rows.map((row) => `
        <tr><td>${row.n}</td>
        <td>${fmtMm(row.run)}<small>${toTaiShaku(row.run)}</small></td>
        <td>${fmtMm(row.real)}<small>${toTaiShaku(row.real)}</small></td></tr>`).join('');
      hBox.innerHTML = len(L('每支遞減量（實長）', '減り'), h.decrement) +
        `<table><thead><tr><th>支</th><th>水平長 mm</th><th>實長 mm</th></tr></thead><tbody>${rows}</tbody></table>`;
      $('hai-fig').innerHTML = haitsukePlan({ first, pitch: P.mm, decrement: h.decrement, count: h.rows.length });
    } catch (e) { hErr.textContent = e.message; }
  }
}

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

/* ---------- 4. 對角線 ---------- */
function renderDiag() {
  const A = readLen('diag-a', null), B = readLen('diag-b', null);
  const out = $('diag-out'), err = $('diag-err');
  out.innerHTML = ''; err.textContent = '';
  let figArgs = {};
  if (A.error || B.error) err.textContent = '算式有誤，請檢查輸入';
  else if (A.mm !== undefined && B.mm !== undefined) {
    try {
      const d = diagonal(A.mm, B.mm);
      out.innerHTML = len('對角線', d);
      figArgs = { a: Math.min(A.mm, B.mm), b: Math.max(A.mm, B.mm), d };
    } catch (e) { err.textContent = e.message; }
  }
  $('diag-fig').innerHTML = diagFigure(figArgs);

  const D1 = readLen('diag-d1', null), D2 = readLen('diag-d2', null);
  const chk = $('diag-chk'), cerr = $('diag-chk-err');
  chk.innerHTML = ''; cerr.textContent = '';
  let sq = {};
  if (D1.error || D2.error) cerr.textContent = '算式有誤，請檢查輸入';
  else if (D1.mm !== undefined && D2.mm !== undefined) {
    const d = D1.mm - D2.mm;
    chk.innerHTML = len('差（① − ②）', d) +
      plain('判定', Math.abs(d) < 0.5 ? '兩條一致 ✓' : (d > 0 ? '① 較長' : '② 較長'));
    sq = { d1: D1.mm, d2: D2.mm };
  }
  $('sq-fig').innerHTML = squareCheck(sq);
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
    if (partial) hint.textContent = '還沒輸入完，先以前面已算好的部分判斷（暫時不能套用建議）';
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
  if (changed) save();
})();

/* ---------- 輸入欄位共通：還原 / 儲存 / 更新 ---------- */
const renderers = {
  'tab-mix': renderCalc, 'tab-roof': renderRoof, 'tab-arc': renderArc, 'tab-diag': renderDiag, 'tab-luban': renderLubanTab,
};
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
   #/calc[/mix|roof|arc|diag] 木作計算機（四個分頁；沒寫分頁就開上次用的）
   舊網址 #/roof #/arc #/diag 會自動導到 #/calc/… */
const CALC_TABS = { mix: '台尺混算', roof: '屋頂坡度', arc: '弧線半徑', diag: '對角線', luban: '魯班尺' };
const PAGES = ['home', 'install', 'calc', 'glossary'];
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
    if (!(sub in CALC_TABS)) sub = state.calcTab in CALC_TABS ? state.calcTab : 'mix';
    if (state.calcTab !== sub) { state.calcTab = sub; save(); }
  }

  document.querySelectorAll('main > section').forEach((sec) => { sec.hidden = sec.id !== `page-${page}`; });
  if (isCalc) document.querySelectorAll('#page-calc > .panel').forEach((p) => { p.hidden = p.id !== `tab-${sub}`; });
  document.querySelectorAll('#subtabs a').forEach((a) => {
    if (a.dataset.sub === sub && isCalc) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  const title = isCalc ? '木作計算機'
    : page === 'install' ? '加到手機桌面'
      : page === 'glossary' ? '台日大木作名詞＆構架對照庫' : '日式大木作工具箱';
  $('topbar').hidden = page === 'home';
  $('subtabs').hidden = !isCalc;
  $('topTitle').textContent = title;
  $('topJp').textContent = isCalc ? '電卓' : '';
  document.title = page === 'home' ? '日式大木作工具箱'
    : `${isCalc ? CALC_TABS[sub] : title}｜日式大木作工具箱`;

  closeSheet();
  if (isCalc) renderers[`tab-${sub}`]();
  if (page === 'home') renderHome();
  if (page === 'install') $('inAppWarn').hidden = !inApp();
  if (page === 'glossary') glossary.render();
  window.scrollTo(0, 0);
}

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const inApp = () => /Line\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(navigator.userAgent);

let updatesLoaded = false;
async function renderHome() {
  // 加到桌面提醒
  let hidden = false;
  try { hidden = !!localStorage.getItem('installHint'); } catch { /* ignore */ }
  $('instHint').hidden = isStandalone() || hidden;

  if (updatesLoaded) return;
  updatesLoaded = true;
  try {
    const list = await (await fetch('updates.json')).json();
    if (!Array.isArray(list) || !list.length) return;
    $('updDate').textContent = list[0].date;
    const body = $('updBody');
    body.textContent = '';
    for (const u of list) {
      const d = document.createElement('div');
      d.className = 'd';
      d.textContent = u.date;
      const ul = document.createElement('ul');
      for (const it of u.items) {
        const li = document.createElement('li');
        li.textContent = it;
        ul.append(li);
      }
      body.append(d, ul);
    }
    $('updates').hidden = false;
  } catch { updatesLoaded = false; /* 離線且沒快取時就不顯示 */ }
}
$('instHide').addEventListener('click', () => {
  try { localStorage.setItem('installHint', '1'); } catch { /* ignore */ }
  $('instHint').hidden = true;
});

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
