// 仕口・継手 比例速查頁：選継手、輸入材成 D，顯示示意圖、各部尺寸表、文獻出處。
import { h } from './dom.js';
import { JOINTS, DEFAULT_D, jointSpec, jointFigure, AS_SITE, AS_URL } from './joints.js';
import { fmtMm } from './units.js';

// 實驗木場的其他接頭（依展覽文字用我們自己的話整理；尺寸與照片請看原頁）
const AS_OTHERS = [
  ['平枘榫接（柱與土台）', 'https://astaiwan.wixsite.com/website-1/team/%E5%B9%B3%E6%9E%98%E6%A6%AB%E6%8E%A5', '柱腳做公榫、土台開母榫，扣上後在接縫以大木螺絲輔助固定。力學上視為鉸接，所以日式構架要靠牆體抵抗側向力。'],
  ['火打樑榫接（角隅補強）', 'https://astaiwan.wixsite.com/website-1/team/%E7%81%AB%E6%89%93%E6%A8%91%E6%A6%AB%E6%8E%A5', '角隅的樑與火打樑各自開槽，火打樑一端崁入樑內、另一端扣上另一支樑，以大木螺絲固定，上方再壓一支水平樑。樓板四周的梁多為鉸接或半剛接，側力來時樓板會變形成平行四邊形；角隅加火打樑可以穩住平面。'],
  ['土台與布基礎接頭', 'https://astaiwan.wixsite.com/website-1/team/%E5%9C%9F%E5%8F%B0%E8%88%87%E5%B8%83%E5%9F%BA%E7%A4%8E%E6%8E%A5%E9%A0%AD', 'RC 布基礎預埋螺栓，土台下放透氣墊防潮，以螺帽調整高程；土台頂部開槽，讓螺栓鎖好後不突出。木與 RC 材料不同，靠預埋螺栓把力傳下去。（錨栓規格與間距屬結構設計，請依設計圖。）'],
];
const AS_MODERN = [
  ['DETAIL A', '非對稱樑接頭', '鐵件以螺桿穿過柱心鎖在柱兩側，兩側小樑開槽後用摩擦栓與鐵件固定；小樑設為鉸接、以傳遞軸力為主。'],
  ['DETAIL B', '樑柱接頭', '柱與大樑開槽，T 形鋼板穿入以摩擦栓相接（柱頂半剛接、抗彎）；兩側小樑的鐵件以單根螺桿鎖回接頭。'],
  ['DETAIL C', '屋頂中脊接頭', '弧形鋼板崁入大樑，LVL 版樑二夾一，摩擦栓一次打穿；中脊山形設為半剛接。'],
  ['DETAIL D', '水平樑對接接頭', '柱上預留孔，以螺桿鎖住兩側鐵件，水平樑以摩擦栓固定；鉸接、傳遞軸力。'],
  ['DETAIL E', '柱樑接頭', '樑柱開槽埋入 T 形鋼板定位，LVL 版樑二夾一、摩擦栓打穿；柱頂半剛接抗彎。'],
  ['DETAIL F', '柱與土台、布基礎接頭', '布基礎預埋螺栓、調整底座鐵件高程，土台套入底座鐵件，柱腳扣入後以摩擦栓固定；柱力經鋼板直接傳到布基礎，土台主要承接牆體。'],
  ['DETAIL G', '柱腳接頭', 'RC 底板植筋、以螺帽調高程，柱腳以摩擦栓接十字鋼板，底部用無收縮水泥砂漿收尾；半剛接、以傳遞軸力為主。'],
  ['DETAIL H', '多方向接頭', '方形底座加勁板、外伸連接板，一點匯集五支樑；所有樑設為鉸接，在一點完成力平衡。'],
];
const extLink = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer', text });

let viewer = null;          // 目前開著的 3D 檢視器
let viewerHostId = '';

const NOTE3D = {
  oikake: '3D 模型依文獻圖 17(a) 的比例生成：兩材各以平面界線整段貫穿，用兩支方栓鎖住。',
  kama: '3D 模型依文獻圖 17(b) 的平面與側面圖推定：公材的鎌首只在上半深，母材在下半多伸出 1/8 D 當「腰掛」托住。側面圖的 1/10 勾配沒有建進模型。',
  koshikake: '3D 模型依文獻圖 17(c) 的平面與側面圖推定：公材的燕尾榫頭只在上半深，母材在下半多伸出 1/8 D 當「腰掛」托住。',
  kanawa: '3D 模型依實驗木場「金輪繼榫接」施工圖重畫：兩材的榫頭上下相疊，中央的込み栓從側面打入；拆開時込み栓往側面抽出。',
};
const NOTE3D_FOOT = {
  oikake: '深色方框是栓孔位置，栓孔本身未建模（拆開後只看得到孔位的框線）。界線的小斜度與栓的位置為依圖面目測。',
  kama: '側面圖的段差解讀（榫頭只在上半深）是我依圖面推定，文獻沒有文字說明；請對照文獻圖 17(b) 確認。',
  koshikake: '側面圖的段差解讀（榫頭只在上半深）是我依圖面推定，文獻沒有文字說明；請對照文獻圖 17(c) 確認。',
  kanawa: '全長、中點是施工圖標註；兩端段差、込み栓大小、斜度是我依圖面比例量測（約 ±2 mm）。這是單一案例的尺寸。',
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
  $('jt-summary').textContent = `${j.ja}（${j.twBy || '文獻稱'}「${j.tw}」）：${j.summary}`;

  const r = readLen('jt-d', 'jt-err');
  const defD = j.defD || DEFAULT_D;
  let D = defD, usingDefault = true;
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
  const isCase = !!j.defD;
  notes.append(
    h('p', { class: 'jt-src', text: usingDefault
      ? `目前用${isCase ? '施工圖的材' : '文獻圖例的材成'} ${defD} mm 示範；輸入你的材成，尺寸會依比例換算。`
      : `尺寸＝比例 × 材成，是依${isCase ? '施工案例的尺寸' : '文獻圖面括號內的比例'}換算，不是文獻明文規定的尺寸。` }),
    ...j.notes.map((t) => h('p', { class: 'jt-src', text: `・${t}` })));
  if (j.steps) {
    notes.append(h('h3', { class: 'sec-h', text: '施工步驟' }), h('ol', { class: 'jt-steps' }, j.steps.map((t) => h('li', { text: t }))));
  }
  if (j.mech) {
    notes.append(h('h3', { class: 'sec-h', text: '力學說明' }), h('ul', { class: 'jt-steps' }, j.mech.map((t) => h('li', { text: t }))));
  }
  if (j.caseInfo) {
    notes.append(h('h3', { class: 'sec-h', text: '施工案例對照（實驗木場）' }),
      ...j.caseInfo.lines.map((t) => h('p', { class: 'jt-src', text: `・${t}` })),
      h('p', { class: 'jt-src' }, '原頁：', extLink(j.caseInfo.url, `${j.caseInfo.name}`), '（含施工照片與施工圖）'));
  }
  notes.append(
    h('p', { class: 'jt-src', text: `📖 出處：${j.src}。圖形為簡化示意（由本工具重畫），施工請以設計圖與現場匠師為準。${j.steps ? `施工步驟、力學說明依 ${AS_SITE} 的文字整理。` : ''}` }),
    h('p', { class: 'jt-src' }, h('a', { href: '#/glossary', text: '← 回名詞對照庫查「' + j.ja + '」' })),
    h('details', { class: 'gl-about jt-more' },
      h('summary', { text: '實驗木場的其他接頭（參考）' }),
      h('p', { class: 'jt-src', text: `${AS_SITE}。以下依展覽文字整理，只有說明、沒有比例；照片與施工圖請看原頁。` }),
      h('h3', { class: 'sec-h', text: '傳統接頭' }),
      ...AS_OTHERS.map(([name, url, t]) => h('div', { class: 'jt-ref' }, h('b', {}, extLink(url, name)), h('p', { text: t }))),
      h('h3', { class: 'sec-h', text: '新式接頭（鋼板・摩擦栓・LVL）' }),
      ...AS_MODERN.map(([code, name, t]) => h('div', { class: 'jt-ref' }, h('b', {}, extLink(`${AS_URL}/detail_${code.slice(-1).toLowerCase()}`, `${code}　${name}`)), h('p', { text: t })))),
    h('p', { class: 'jt-src', text: '尚未收錄：大入れ（大入れ臍）等，因為目前找不到可查證的比例。' }));
}
