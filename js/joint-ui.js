// 仕口・継手 比例速查頁：選継手、輸入材成 D，顯示示意圖、各部尺寸表、文獻出處。
import { h } from './dom.js';
import { JOINTS, DEFAULT_D, jointSpec, jointFigure } from './joints.js';
import { fmtMm } from './units.js';

const SRC = '《古蹟木作修復技術》V-2「日式木構造與修復」圖 17（木地檻接合工法）';

let viewer = null;          // 目前開著的 3D 檢視器
let viewerHostId = '';

const NOTE3D = {
  oikake: '3D 模型依文獻圖 17(a) 的比例生成：兩材各以平面界線整段貫穿，用兩支方栓鎖住。',
  kama: '3D 模型依文獻圖 17(b) 的平面與側面圖推定：公材的鎌首只在上半深，母材在下半多伸出 1/8 D 當「腰掛」托住。側面圖的 1/10 勾配沒有建進模型。',
  koshikake: '3D 模型依文獻圖 17(c) 的平面與側面圖推定：公材的燕尾榫頭只在上半深，母材在下半多伸出 1/8 D 當「腰掛」托住。',
};
const NOTE3D_FOOT = {
  oikake: '深色方框是栓孔位置，栓孔本身未建模（拆開後只看得到孔位的框線）。界線的小斜度與栓的位置為依圖面目測。',
  kama: '側面圖的段差解讀（榫頭只在上半深）是我依圖面推定，文獻沒有文字說明；請對照文獻圖 17(b) 確認。',
  koshikake: '側面圖的段差解讀（榫頭只在上半深）是我依圖面推定，文獻沒有文字說明；請對照文獻圖 17(c) 確認。',
};

function mount3d($, id, D) {
  const box = $('jt-3d');
  if (viewer) { viewer.update(id, D); box.dataset.id = id; const f = box.querySelector('.jt3d-foot'); if (f) f.textContent = `單指拖曳旋轉・雙指縮放・點兩下回到立體視角。兩根材的斷面皆為 D×D。${NOTE3D_FOOT[id]}`; return; }
  if (box.dataset.id === id && box.firstChild) return;
  box.dataset.id = id; box.textContent = '';
  const open = h('button', { type: 'button', class: 'sec jt3d-open', text: '🧊 開啟 3D 旋轉檢視' });
  open.addEventListener('click', async () => {
    open.disabled = true; open.textContent = '載入 3D…';
    try {
      const m = await import('./joint3d.js');
      if (!m.webglOk()) throw new Error('webgl');
      box.textContent = '';
      const host = h('div', { class: 'jt3d-host', role: 'img', 'aria-label': '継手 3D 模型，可拖曳旋轉' });
      const bar = h('div', { class: 'jt3d-bar' });
      const cur = box.dataset.id;
      box.append(host, bar, h('p', { class: 'jt-src jt3d-foot', text: `單指拖曳旋轉・雙指縮放・點兩下回到立體視角。兩根材的斷面皆為 D×D。${NOTE3D_FOOT[cur]}` }));
      viewer = m.createViewer(host, cur, currentD());
      const btn = (t, f) => h('button', { type: 'button', class: 'sec', text: t, onclick: f });
      let ex = false;
      const exBtn = btn('拆開', () => { ex = !ex; viewer.setExplode(ex); exBtn.textContent = ex ? '合起來' : '拆開'; exBtn.setAttribute('aria-pressed', String(ex)); });
      const cut = h('input', { type: 'range', min: 5, max: 100, value: 100, 'aria-label': '剖切位置（往左拉就切到材內部）', oninput: (e) => viewer.setCut(+e.target.value / 100) });
      bar.append(btn('立體', () => viewer.preset('iso')), btn('平面', () => viewer.preset('plan')), btn('側面', () => viewer.preset('side')), exBtn,
        h('label', { class: 'jt3d-cut' }, h('span', { text: '剖切' }), cut));
    } catch (e) {
      open.disabled = false; open.textContent = '🧊 開啟 3D 旋轉檢視';
      box.append(h('p', { class: 'jt-src', text: e.message === 'webgl' ? '這支裝置或瀏覽器不支援 3D 顯示（WebGL），仍可使用上面的平面、側面圖。' : '3D 載入失敗，請確認網路後重試。' }));
    }
  });
  box.append(open, h('p', { class: 'jt-src', text: NOTE3D[id] }));
}
let curDmm = DEFAULT_D;
const currentD = () => curDmm;

export function renderJointPage({ $, state, save, readLen }) {
  const id = JOINTS.some((j) => j.id === state.jointId) ? state.jointId : JOINTS[0].id;
  const j = JOINTS.find((x) => x.id === id);

  const chips = $('jt-chips');
  chips.textContent = '';
  for (const x of JOINTS) {
    chips.append(h('a', { class: 'chip', href: `#/joint/${x.id}`, 'aria-pressed': x.id === id ? 'true' : 'false', text: x.ja }));
  }
  $('jt-summary').textContent = `${j.ja}（文獻稱「${j.tw}」）：${j.summary}`;

  const r = readLen('jt-d', 'jt-err');
  let D = DEFAULT_D, usingDefault = true;
  if (r.error) { /* 錯誤訊息已顯示，沿用預設值畫圖 */ } else if (r.mm !== undefined) {
    if (r.mm > 0) { D = r.mm; usingDefault = false; } else $('jt-err').textContent = '材成要大於 0';
  }

  $('jt-fig').innerHTML = jointFigure(id, D);
  curDmm = D;
  mount3d($, id, D);

  const spec = jointSpec(id, D);
  const tbl = $('jt-table');
  tbl.textContent = '';
  tbl.append(
    h('thead', {}, h('tr', {}, h('th', {}), h('th', { text: '部位' }), h('th', { text: '比例' }), h('th', { text: `尺寸（D＝${fmtMm(D, 1)} mm）` }))),
    h('tbody', {}, spec.map((p) => h('tr', {},
      h('td', { class: 'n', text: '①②③④⑤⑥⑦'[p.n - 1] }),
      h('td', { text: p.label }),
      h('td', { text: p.ratio }),
      h('td', {}, p.valueText, p.tai ? h('small', { text: p.tai }) : null)))));

  const notes = $('jt-notes');
  notes.textContent = '';
  notes.append(
    h('p', { class: 'jt-src', text: usingDefault ? '目前用文獻圖例的材成 120 mm 示範；輸入你的材成，尺寸會依比例換算。' : '尺寸＝比例 × 材成，是依文獻圖面括號內的比例換算，不是文獻明文規定的尺寸。' }),
    ...j.notes.map((t) => h('p', { class: 'jt-src', text: `・${t}` })),
    h('p', { class: 'jt-src', text: `📖 出處：${SRC}。文獻圖例以材成 120 mm 標註；圖形為簡化示意，施工請以設計圖與現場匠師為準。` }),
    h('p', { class: 'jt-src' }, h('a', { href: '#/glossary', text: '← 回名詞對照庫查「' + j.ja + '」' })),
    h('p', { class: 'jt-src', text: '尚未收錄：金輪継ぎ、大入れ臍等，因為目前找不到可查證的比例。' }));
}
