import { evalLength, toKenShaku, toTaiShaku, fmtMm, toShaku } from './units.js';
import { createGlossaryUI } from './glossary-ui.js';
import {
  roofFromKobai, roofLengths, haitsukeRafters, kobaiFromAngle, kobaiFromRiseRun,
  arcFromChordRise, arcFromChordRadius, arcOffsets, diagonal,
} from './calc.js';

const $ = (id) => document.getElementById(id);
const STORE = 'mokusaku.v1';
const VERSION = '6'; // 與 sw.js 的 VERSION、index.html 的 <html data-v> 必須一致

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
  const el = $(id);
  try {
    const mm = evalLength(el.value);
    if (errId) $(errId).textContent = '';
    return mm === null ? {} : { mm };
  } catch (e) {
    if (errId) $(errId).textContent = `${e.message}`;
    return { error: true };
  }
}

/* ---------- 1. 尺貫混算 ---------- */
let history = Array.isArray(state.history) ? state.history : [];

function renderCalc() {
  const out = $('calc-out');
  try {
    const mm = evalLength($('calc-expr').value);
    if (mm === null) { out.innerHTML = ''; return null; }
    out.innerHTML = `
      <div class="mm">${fmtMm(mm)}<small>mm</small></div>
      <div class="shaku">${toTaiShaku(mm)}</div>
      <div class="shaku2">${toShaku(mm)} 尺　／　${n(mm / 1000, 4)} m</div>
      <div class="shaku2 jp">日式 ${toKenShaku(mm)}</div>`;
    return mm;
  } catch (e) {
    out.innerHTML = `<div class="err" style="display:block;margin:0"></div>`;
    out.firstElementChild.textContent = e.message;
    return null;
  }
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
$('calc-clear').addEventListener('click', () => {
  $('calc-expr').value = '';
  $('calc-expr').dispatchEvent(new Event('input', { bubbles: true }));
  $('calc-expr').focus();
});

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

function drawRoofFig(x) {
  const fig = $('roof-fig');
  if (x === null) { fig.innerHTML = ''; return; }
  const ox = 30, oy = 104;
  const s = Math.min(140 / 10, 80 / Math.max(x, 0.1));
  const run = 10 * s, rise = x * s;
  const gen = Math.sqrt(100 + x * x);
  const a = Math.atan2(rise, run);
  fig.innerHTML = `
    <polygon class="ln" points="${ox},${oy} ${ox + run},${oy} ${ox + run},${oy - rise}"/>
    <path class="ang" d="M${ox + 34},${oy} A34 34 0 0 0 ${ox + 34 * Math.cos(a)},${oy - 34 * Math.sin(a)}"/>
    <text x="${ox + run / 2 - 14}" y="${oy + 15}">股 10</text>
    <text x="${ox + run + 8}" y="${oy - rise / 2 + 4}">勾 ${n(x, 2)}</text>
    <text x="${ox + run / 2 - 40}" y="${oy - rise / 2 - 8}">弦 ${n(gen, 3)}</text>
    <text x="${ox + 38}" y="${oy - 4}">${n(Math.atan(x / 10) * 180 / Math.PI, 2)}°</text>`;
}

function renderRoof() {
  const x = roofKobai();
  const basic = $('roof-basic');
  drawRoofFig(x);
  if (x === null) { basic.innerHTML = ''; $('roof-lengths').innerHTML = ''; $('roof-haitsuke').innerHTML = ''; return; }
  const r = roofFromKobai(x);
  basic.innerHTML =
    plain(L('坡度', '寸勾配'), `${n(x, 3)} 寸`) +
    plain('角度', `${n(r.angleDeg, 3)}°`) +
    plain(L('椽木斜長 √(10²+勾²)', '垂木・玄'), `${n(r.gen, 4)}`) +
    plain(L('椽木伸長率（斜長÷10）', '伸び率'), `${n(r.nobi, 5)}`) +
    plain(L('角梁長弦 √(200+勾²)', '隅木・長玄'), `${n(r.hip.gen, 4)}`) +
    plain(L('角梁伸長率（長弦÷10）', '隅木 伸び率'), `${n(r.hip.nobi, 5)}`) +
    plain(L('角梁坡度（勾÷√2）', '隅勾配'), `${n(r.hip.kobai, 4)} 寸`) +
    plain(L('角梁角度', '隅木'), `${n(r.hip.angleDeg, 3)}°`);

  // 長さ
  const A = readLen('roof-a', 'roof-a-err');
  const lenBox = $('roof-lengths');
  if (A.mm !== undefined && A.mm > 0) {
    const R = roofLengths(A.mm, x);
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
  const hBox = $('roof-haitsuke');
  const hErr = $('roof-h-err');
  hErr.textContent = '';
  hBox.innerHTML = '';
  if (P.error || F.error) { hErr.textContent = '椽木間距或第一支椽木水平長的算式有誤'; return; }
  const first = F.mm !== undefined ? F.mm : A.mm;
  if (P.mm !== undefined && first !== undefined) {
    try {
      const h = haitsukeRafters(first, P.mm, x);
      let rows = h.rows.map((row) => `
        <tr><td>${row.n}</td>
        <td>${fmtMm(row.run)}<small>${toTaiShaku(row.run)}</small></td>
        <td>${fmtMm(row.real)}<small>${toTaiShaku(row.real)}</small></td></tr>`).join('');
      hBox.innerHTML = len(L('每支遞減量（實長）', '減り'), h.decrement) +
        `<table><thead><tr><th>支</th><th>水平長 mm</th><th>實長 mm</th></tr></thead><tbody>${rows}</tbody></table>`;
    } catch (e) { hErr.textContent = e.message; }
  }
}

/* ---------- 3. R・弧 ---------- */
function drawArcFig(c, h) {
  const fig = $('arc-fig');
  if (!(h <= c / 2)) { fig.innerHTML = ''; return; }
  // 示意圖：實際的弧通常很扁，矢高放大到至少 28px 才看得出來
  const w = 170;
  const ht = Math.min(64, Math.max(28, (h / c) * w));
  const Rs = (w * w / 4 + ht * ht) / (2 * ht);
  const x0 = 110 - w / 2, y0 = 88;
  fig.innerHTML = `
    <path class="ln" d="M${x0},${y0} A${Rs},${Rs} 0 0 1 ${x0 + w},${y0} Z"/>
    <line class="dim" x1="110" y1="${y0}" x2="110" y2="${y0 - ht}"/>
    <text x="110" y="${y0 + 15}" text-anchor="middle">弦 c</text>
    <text x="116" y="${y0 - ht / 2 + 4}">弧高 h</text>
    <text x="${x0}" y="${y0 - ht - 8}">示意圖（弧高放大）</text>`;
}

function renderArc() {
  const mode = $('arc-mode').value;
  $('arc-v-label').textContent = mode === 'h' ? '弧高 h' : '半徑 R';
  const out = $('arc-out'), tbl = $('arc-table'), err = $('arc-err');
  out.innerHTML = ''; tbl.innerHTML = ''; err.textContent = '';
  const C = readLen('arc-c', null), V = readLen('arc-v', null);
  if (C.error || V.error) { err.textContent = '算式有誤，請檢查輸入'; $('arc-fig').innerHTML = ''; return; }
  if (C.mm === undefined || V.mm === undefined) { $('arc-fig').innerHTML = ''; return; }
  try {
    const a = mode === 'h' ? arcFromChordRise(C.mm, V.mm) : arcFromChordRadius(C.mm, V.mm);
    out.innerHTML = len('弦長 c', a.c) + len(L('弧高 h', '矢高'), a.h) + len('半徑 R', a.R) +
      plain('中心角', `${n(a.thetaDeg, 3)}°`) + len('弧長', a.arc);
    drawArcFig(a.c, a.h);
    let div = parseInt($('arc-n').value, 10);
    if (!(div >= 2)) div = 8;
    div = Math.min(div, 40);
    if (a.h <= a.c / 2) {
      const rows = arcOffsets(a.c, a.h, div).map((r) => `
        <tr><td>${r.i}</td>
        <td>${fmtMm(r.x)}<small>${toTaiShaku(r.x)}</small></td>
        <td>${fmtMm(r.y)}<small>${toTaiShaku(r.y)}</small></td></tr>`).join('');
      tbl.innerHTML = `<h2>分點高度（弦 ${div} 等分）</h2><div class="card">
        <table><thead><tr><th>點</th><th>從左端 mm</th><th>弧高 mm</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
  } catch (e) { err.textContent = e.message; $('arc-fig').innerHTML = ''; }
}

/* ---------- 4. 對角線 ---------- */
function renderDiag() {
  const A = readLen('diag-a', null), B = readLen('diag-b', null);
  const out = $('diag-out'), err = $('diag-err');
  out.innerHTML = ''; err.textContent = '';
  if (A.error || B.error) err.textContent = '算式有誤，請檢查輸入';
  else if (A.mm !== undefined && B.mm !== undefined) {
    try { out.innerHTML = len('對角線', diagonal(A.mm, B.mm)); } catch (e) { err.textContent = e.message; }
  }
  const D1 = readLen('diag-d1', null), D2 = readLen('diag-d2', null);
  const chk = $('diag-chk'), cerr = $('diag-chk-err');
  chk.innerHTML = ''; cerr.textContent = '';
  if (D1.error || D2.error) cerr.textContent = '算式有誤，請檢查輸入';
  else if (D1.mm !== undefined && D2.mm !== undefined) {
    const d = D1.mm - D2.mm;
    chk.innerHTML = len('差（① − ②）', d) +
      plain('判定', Math.abs(d) < 0.5 ? '兩條一致 ✓' : (d > 0 ? '① 較長' : '② 較長'));
  }
}

/* ---------- 輸入欄位共通：還原 / 儲存 / 更新 ---------- */
const renderers = {
  'tab-mix': renderCalc, 'tab-roof': renderRoof, 'tab-arc': renderArc, 'tab-diag': renderDiag,
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

/* ---------- 快速輸入按鍵列 ---------- */
let lastInput = $('calc-expr'); // 快速鍵列作用的輸入欄
document.querySelectorAll('input.len').forEach((el) => el.addEventListener('focus', () => { lastInput = el; }));
$('keys').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  e.preventDefault(); // 不讓輸入欄失去焦點（手機鍵盤不會收起來）
  const el = lastInput;
  if (!el || el.offsetParent === null) return;
  el.focus();
  const s = el.selectionStart ?? el.value.length;
  const t = el.selectionEnd ?? s;
  if (b.dataset.act === 'bs') {
    const from = s === t ? Math.max(0, s - 1) : s;
    el.setRangeText('', from, t, 'end');
  } else {
    el.setRangeText(b.dataset.ins, s, t, 'end');
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

/* ---------- 路由 ----------
   #/ 首頁　#/install 安裝教學
   #/calc[/mix|roof|arc|diag] 木作計算機（四個分頁；沒寫分頁就開上次用的）
   舊網址 #/roof #/arc #/diag 會自動導到 #/calc/… */
const CALC_TABS = { mix: '台尺混算', roof: '屋頂坡度', arc: '弧線半徑', diag: '對角線' };
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
  $('keys').hidden = !isCalc;
  document.body.classList.toggle('on-tool', isCalc);
  document.title = page === 'home' ? '日式大木作工具箱'
    : `${isCalc ? CALC_TABS[sub] : title}｜日式大木作工具箱`;

  if (isCalc) {
    const first = document.querySelector(`#tab-${sub} input.len`);
    if (first) lastInput = first;
    renderers[`tab-${sub}`]();
  }
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
