// 仕口・継手 比例速查頁：選継手、輸入材成 D，顯示示意圖、各部尺寸表、文獻出處。
import { h } from './dom.js';
import { JOINTS, DEFAULT_D, jointSpec, jointFigure } from './joints.js';
import { fmtMm } from './units.js';

const SRC = '《古蹟木作修復技術》V-2「日式木構造與修復」圖 17（木地檻接合工法）';

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
