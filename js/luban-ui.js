// 魯班尺分頁：字位條、吉凶判定、微調建議、附近的吉位區間、字位對照表。
import { h } from './dom.js';
import { fmtMm, toTaiShaku, toShaku } from './units.js';
import { RULERS, checkRuler, goodRangesNear } from './luban.js';
import { lubanBar } from './figures.js';

const n1 = (v) => `${+Number(v).toFixed(1)}`;
const SPANS = [20, 50, 100, 200];
const sign = (d) => (d > 0 ? '+' : '−');

function statusText(c) {
  const edge = Math.min(c.toStart, c.toEnd);
  if (c.status === 'good') return `✓ 吉：落在「${c.band}」（紅字），離字位邊界 前 ${n1(c.toStart)} mm／後 ${n1(c.toEnd)} mm`;
  if (c.status === 'edge') return `△ 落在「${c.band}」（吉），但離邊界只有 ${n1(edge)} mm，施工誤差可能跨到凶位`;
  return `✗ 凶：落在「${c.band}」（黑字）`;
}

function block(ruler, mm, { cfg, onCfg, onApply, span, partial }) {
  const cycleMm = cfg[ruler.id] || ruler.cycles[0].mm;
  const c = checkRuler(ruler, cycleMm, mm);
  const sel = h('select', { class: 'fsel', 'aria-label': `${ruler.name}一循環的長度`, onchange: (e) => onCfg(ruler.id, parseFloat(e.target.value)) },
    ruler.cycles.map((cy) => h('option', { value: cy.mm, selected: cy.mm === cycleMm, text: cy.label })));
  const apply = (d, label) => h('button', { type: 'button', class: 'btnlink ghost', disabled: partial, onclick: () => onApply(d), text: label });

  const sugg = [];
  if (c.fwd) sugg.push([+c.fwd.delta, c.fwd.band]);
  if (c.back) sugg.push([-c.back.delta, c.back.band]);
  sugg.sort((a, b) => Math.abs(a[0]) - Math.abs(b[0]));

  const near = goodRangesNear(ruler, cycleMm, mm, span).slice(0, 6);
  return h('section', { class: 'fsec lb' },
    h('div', { class: 'lb-head' }, h('b', { text: ruler.name }), ruler.alias ? h('small', { text: `（${ruler.alias}）` }) : null, sel),
    h('div', { class: 'lb-fig', html: lubanBar(ruler, c) }),
    h('p', { class: `lb-msg lb-${c.status}`, text: statusText(c) }),
    sugg.length ? h('div', { class: 'lb-sug' }, sugg.map(([d, band]) =>
      apply(d, `建議 ${sign(d)}${Math.abs(d)} mm 即可落入「${band}」（套用）`))) : null,
    h('h3', {}, '附近的吉位區間', h('small', { text: `目前長度 ±${span} mm 內` })),
    near.length
      ? h('ul', { class: 'near' }, near.map((x) => h('li', {},
        h('span', { class: 'nr' }, h('b', { text: `${fmtMm(x.from, 1)} – ${fmtMm(x.to, 1)} mm` }), h('small', { text: `「${x.band}」${x.delta === 0 ? '・目前就在這裡' : ''}` })),
        x.delta === 0 ? h('span', { class: 'ok', text: '✓' }) : apply(x.delta, `${sign(x.delta)}${Math.abs(x.delta)} mm`))))
      : h('p', { class: 'note', text: `±${span} mm 內沒有吉位區間，可以放大範圍。` }),
    h('p', { class: 'lb-use', text: `用途：${ruler.use}` }));
}

function refTable(ruler, cfg) {
  const cycleMm = cfg[ruler.id] || ruler.cycles[0].mm;
  const bw = cycleMm / ruler.bands.length;
  return h('details', { class: 'gl-about' },
    h('summary', { text: `${ruler.name}字位對照表（一循環 ${n1(cycleMm / 10)} cm）` }),
    h('div', { class: 'cmp-wrap' }, h('table', { class: 'cmp' },
      h('thead', {}, h('tr', {}, ['字', '吉凶', '範圍（cm）'].map((x) => h('th', { text: x })))),
      h('tbody', {}, ruler.bands.map((b, i) => {
        const good = ruler.good.includes(b);
        return h('tr', {}, h('td', { text: b }), h('td', { class: good ? 'lb-good' : 'lb-bad', text: good ? '吉（紅字）' : '凶（黑字）' }),
          h('td', { text: `${n1((i * bw) / 10)} – ${n1(((i + 1) * bw) / 10)}` }));
      })))));
}

/** 頂部的簡短結果：兩把尺各一行 */
export function renderLubanSummary(box, mm, cfg, partial) {
  box.textContent = '';
  box.classList.toggle('partial', !!partial);
  // 沒有數字時也顯示同樣行數的淡色佔位，高度固定，下方按鍵才不會被推動
  if (mm == null || !Number.isFinite(mm)) {
    box.classList.add('is-blank');
    box.append(h('div', { class: 'lb-len' }, h('b', { text: '0 mm' }), h('small', { text: '0 尺' })));
    for (const ruler of Object.values(RULERS)) box.append(h('div', { class: 'lb-line' }, h('span', { text: ruler.name }), h('b', { text: '—' })));
    return;
  }
  box.classList.remove('is-blank');
  box.append(h('div', { class: 'lb-len' }, h('b', { text: `${fmtMm(mm, 1)} mm` }), h('small', { text: `${toTaiShaku(mm)}（${toShaku(mm, 3)} 尺）` })));
  for (const ruler of Object.values(RULERS)) {
    const c = checkRuler(ruler, cfg[ruler.id] || ruler.cycles[0].mm, mm);
    const word = c.status === 'good' ? '吉' : c.status === 'edge' ? '吉（近邊界）' : '凶';
    box.append(h('div', { class: `lb-line lb-${c.status}` }, h('span', { text: ruler.name }), h('b', { text: `${word}・${c.band}` })));
  }
}

/**
 * @param box  容器
 * @param mm   要檢核的長度（null = 還沒有結果）
 * @param opts { cfg, onCfg(id, cycleMm), onApply(deltaMm), span, onSpan(n), partial }
 */
export function renderLuban(box, mm, { cfg, onCfg, onApply, span, onSpan, partial = false }) {
  box.textContent = '';
  box.classList.toggle('partial', !!partial);
  const note = h('p', { class: 'note', text: '吉凶屬民俗傳統，僅供參考。字位版本各家略有差異，可切換一循環的長度。目前只判斷到「大字」層級（紅字＝吉：門公尺的財、義、官、本；丁蘭尺的丁、旺、義、官、興、財）；每個大字底下的小字（雙紅字）查不到可靠字位表，尚未收錄。丁蘭尺依資料用於陰宅；家具、神位多用門公尺。' });
  if (mm == null || !Number.isFinite(mm)) {
    box.append(h('p', { class: 'four-empty', text: '輸入長度後，這裡會顯示門公尺與丁蘭尺的字位、吉凶、微調建議與附近的吉位區間。' }));
  } else {
    box.append(
      h('div', { class: 'lb-spanbar' }, h('span', { text: '找附近吉位的範圍：' }),
        h('div', { class: 'chips' }, SPANS.map((n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(n === span), text: `±${n} mm`, onclick: () => onSpan(n) })))),
      ...Object.values(RULERS).map((r) => block(r, mm, { cfg, onCfg, onApply, span, partial })));
  }
  box.append(...Object.values(RULERS).map((r) => refTable(r, cfg)), note);
}
