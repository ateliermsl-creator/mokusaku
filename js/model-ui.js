// 「我的 3D 模型」頁：加入 SketchUp 等軟體匯出的 .glb／.gltf，存在手機裡，之後離線也能旋轉、剖切、看尺寸。
import { h } from './dom.js';
import { fmtMm, toTaiShaku } from './units.js';
import { storeOk, listModels, getModel, putModel, deleteModel } from './model-store.js';

const MAX_MB = 80;
let viewer = null, lib = null, curId = '';
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

async function loadLib() { if (!lib) lib = await import('./model3d.js'); return lib; }

export async function renderModelPage($) {
  const root = $('page-model');
  if (root.dataset.ready) { await refreshList($); return; }
  root.dataset.ready = '1';
  const pick = h('input', { type: 'file', accept: '.glb,.gltf,model/gltf-binary,model/gltf+json', hidden: true, id: 'md-file' });
  pick.addEventListener('change', async () => {
    const f = pick.files[0]; pick.value = '';
    if (!f) return;
    if (f.size > MAX_MB * 1048576) { setMsg($, `檔案太大（${fmtSize(f.size)}）。請在 SketchUp 匯出前先精簡模型，或壓縮到 ${MAX_MB} MB 以下。`, true); return; }
    if (!/\.(glb|gltf)$/i.test(f.name)) { setMsg($, '目前只支援 .glb 或 .gltf。其他格式可先用 Blender 轉成 .glb。', true); return; }
    try {
      setMsg($, '加入中…');
      const rec = await putModel(f);
      await refreshList($); await openModel($, rec.id);
    } catch { setMsg($, '無法儲存（可能是瀏覽器不允許或儲存空間不足）。', true); }
  });
  root.append(
    h('p', { class: 'note', style: 'margin-top:0', text: '把在 SketchUp 等軟體建好的榫卯模型放進來，手機上就能旋轉、剖切、看尺寸，沒有網路也能開。檔案只存在這支手機的瀏覽器，不會上傳；換手機或清除瀏覽器資料就會消失，請自己保留原檔。' }),
    h('label', { class: 'btn jt3d-open md-add', for: 'md-file', text: '＋ 加入模型（.glb／.gltf）' }), pick,
    h('div', { id: 'md-msg', class: 'err', role: 'status' }),
    h('div', { id: 'md-list' }),
    h('div', { id: 'md-view' }),
    h('details', { class: 'gl-about' }, h('summary', { text: '怎麼從 SketchUp 匯出？' }),
      h('p', { text: 'SketchUp 桌面版：檔案 → 匯出 → 3D 模型，格式選 glTF（.glb）。匯出選項依版本而異，若找不到 glTF，可先匯出 OBJ／FBX 再用 Blender 轉成 .glb。' }),
      h('p', { text: '尺寸：glTF 的單位是公尺，這裡會換算成 mm 顯示。請先確認 SketchUp 裡的模型是以實際尺寸建立，否則顯示的尺寸會不對。' }),
      h('p', { text: '模型太複雜會讓手機變慢：建議先刪掉不需要的細節、群組與貼圖。' })),
  );
  await refreshList($);
}

function setMsg($, t, bad = false) { const m = $('md-msg'); m.textContent = t; m.classList.toggle('bad', bad); }

async function refreshList($) {
  const box = $('md-list'); box.textContent = '';
  if (!storeOk()) { box.append(h('p', { class: 'note', text: '這個瀏覽器無法儲存模型（沒有 IndexedDB）。' })); return; }
  let items = [];
  try { items = await listModels(); } catch { box.append(h('p', { class: 'note', text: '讀取已存模型失敗。' })); return; }
  if (!items.length) { box.append(h('p', { class: 'note', text: '還沒有模型。按上面的按鈕加入。' })); return; }
  box.append(h('ul', { class: 'md-items' }, items.map((m) => h('li', { class: m.id === curId ? 'on' : '' },
    h('button', { type: 'button', class: 'md-name', onclick: () => openModel($, m.id) }, h('b', { text: m.name }), h('small', { text: fmtSize(m.size) })),
    h('button', { type: 'button', class: 'sec md-del', 'aria-label': `刪除 ${m.name}`, text: '刪除', onclick: async () => {
      if (!confirm(`刪除「${m.name}」？檔案只存在這支手機，刪除後無法復原。`)) return;
      await deleteModel(m.id);
      if (curId === m.id) { curId = ''; closeView($); }
      await refreshList($);
    } })))));
}

function closeView($) { if (viewer) { viewer.dispose(); viewer = null; } $('md-view').textContent = ''; }

async function openModel($, id) {
  curId = id; closeView($); setMsg($, '載入模型…');
  try {
    const rec = await getModel(id);
    if (!rec) throw new Error('missing');
    const L = await loadLib();
    if (!L.webglOk()) { setMsg($, '這支裝置或瀏覽器不支援 3D 顯示（WebGL）。', true); return; }
    const parsed = await L.parseModel(await rec.blob.arrayBuffer());
    setMsg($, '');
    const view = $('md-view');
    const host = h('div', { class: 'jt3d-host', role: 'img', 'aria-label': `${rec.name} 的 3D 模型，可拖曳旋轉` });
    const bar = h('div', { class: 'jt3d-bar' }), cutBar = h('div', { class: 'jt3d-bar' });
    const [sx, sy, sz] = parsed.sizeMm;
    const dimLine = (label, v) => `${label} ${fmtMm(v, 1)} mm（${toTaiShaku(v)}）`;
    view.append(host, bar, cutBar,
      h('p', { class: 'jt-src', text: `外框尺寸（依模型單位為公尺換算）：${dimLine('X', sx)}　${dimLine('Y（高）', sy)}　${dimLine('Z', sz)}。三角形數 ${Math.round(parsed.triangles).toLocaleString()}。` }),
      h('p', { class: 'jt-src', text: '單指拖曳旋轉・雙指縮放・點兩下回到立體視角。剖切只是顯示上的切面，不會補上截面。座標軸依 glTF（Y 朝上）；SketchUp 的 Z 軸朝上會被轉成 Y。' }));
    viewer = L.createModelViewer(host);
    viewer.setModel(parsed);
    const btn = (t, f) => h('button', { type: 'button', class: 'sec', text: t, onclick: f });
    bar.append(btn('立體', () => viewer.preset('iso')), btn('上', () => viewer.preset('top')), btn('前', () => viewer.preset('front')), btn('側', () => viewer.preset('side')));
    let wire = false; const wb = btn('線框', () => { wire = !wire; viewer.setWire(wire); wb.setAttribute('aria-pressed', String(wire)); });
    bar.append(wb);
    const axes = h('div', { class: 'jt3d-axes', role: 'group', 'aria-label': '剖切方向' });
    for (const [k, t] of [['none', '不剖'], ['x', '剖 X'], ['y', '剖 Y（高）'], ['z', '剖 Z']]) {
      const b = h('button', { type: 'button', class: 'sec', 'aria-pressed': String(k === 'none'), text: t, onclick: () => {
        axes.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        viewer.setAxis(k); slider.disabled = k === 'none'; slider.value = 100; viewer.setCut(1);
      } });
      axes.append(b);
    }
    const slider = h('input', { type: 'range', min: 0, max: 100, value: 100, disabled: true, 'aria-label': '剖切位置', oninput: (e) => viewer.setCut(+e.target.value / 100) });
    cutBar.append(axes, h('label', { class: 'jt3d-cut' }, h('span', { text: '切面' }), slider));
    await refreshList($);
    view.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  } catch (e) {
    closeView($);
    setMsg($, e.message === 'empty' ? '模型裡沒有可顯示的幾何。' : '這個檔案讀不出來：請確認是 glTF／GLB，且未使用壓縮擴充（Draco、Meshopt）。', true);
  }
}
