// 「四制同步換算」面板：公制、尺貫法、曲尺裏目（角目）、魯班尺（門公尺／丁蘭尺）。
import { h } from './dom.js';
import { fmtMm, toShaku, toTaiShaku, toKenShaku, toShakuRi, SHAKU_MM } from './units.js';
import { RULERS, checkRuler } from './luban.js';
import { lubanBar } from './figures.js';

const SQ2 = Math.SQRT2;
const n1 = (v) => `${+Number(v).toFixed(1)}`;

function row(k, v, sub) {
  return h('div', { class: 'frow' },
    h('span', { class: 'fk', text: k }),
    h('span', { class: 'fv' }, h('b', { text: v }), sub ? h('small', { text: sub }) : null));
}
const sec = (title, note, ...rows) => h('section', { class: 'fsec' },
  h('h3', {}, title, note ? h('small', { text: note }) : null), rows);

function lubanBlock(ruler, mm, cfg, onCfg, onApply) {
  const cycleMm = cfg[ruler.id] || ruler.cycles[0].mm;
  const c = checkRuler(ruler, cycleMm, mm);
  const sel = h('select', { class: 'fsel', 'aria-label': `${ruler.name}一循環的長度`, onchange: (e) => onCfg(ruler.id, parseFloat(e.target.value)) },
    ruler.cycles.map((cy) => h('option', { value: cy.mm, selected: cy.mm === cycleMm, text: cy.label })));
  const edge = Math.min(c.toStart, c.toEnd);
  const msg = c.status === 'good'
    ? `✓ 吉：落在「${c.band}」（紅字），離字位邊界 前 ${n1(c.toStart)} mm／後 ${n1(c.toEnd)} mm`
    : c.status === 'edge'
      ? `△ 落在「${c.band}」（吉），但離邊界只有 ${n1(edge)} mm，施工誤差可能跨到凶位`
      : `✗ 凶：落在「${c.band}」（黑字）`;
  const sugg = [];
  if (c.fwd) sugg.push([+c.fwd.delta, c.fwd.band]);
  if (c.back) sugg.push([-c.back.delta, c.back.band]);
  sugg.sort((a, b) => Math.abs(a[0]) - Math.abs(b[0]));
  return h('div', { class: 'lb' },
    h('div', { class: 'lb-head' },
      h('b', { text: ruler.name }), ruler.alias ? h('small', { text: `（${ruler.alias}）` }) : null, sel),
    h('div', { class: 'lb-fig', html: lubanBar(ruler, c) }),
    h('p', { class: `lb-msg lb-${c.status}`, text: msg }),
    sugg.length ? h('div', { class: 'lb-sug' }, sugg.map(([d, band]) =>
      h('button', { type: 'button', class: 'btnlink ghost', onclick: () => onApply(d),
        text: `建議 ${d > 0 ? '+' : '−'}${Math.abs(d)} mm 即可落入「${band}」（套用）` }))) : null,
    h('p', { class: 'lb-use', text: `用途：${ruler.use}` }));
}

/**
 * @param box   容器
 * @param mm    要換算的長度（null = 還沒有結果）
 * @param opts  { cfg, onCfg(id, cycleMm), onApply(deltaMm), partial }
 */
export function renderFour(box, mm, { cfg, onCfg, onApply, partial = false }) {
  box.textContent = '';
  box.classList.toggle('partial', !!partial);
  if (mm == null || !Number.isFinite(mm)) {
    box.append(h('p', { class: 'four-empty', text: '算出長度後，這裡會同步顯示公制、尺貫法、曲尺裏目（角目）與魯班尺。' }));
    return;
  }
  const both = (v) => `${toShaku(v, 3)} 尺`;
  box.append(
    sec('公制', '', row('毫米 mm', `${fmtMm(mm, 2)}`), row('公分 cm', `${+(mm / 10).toFixed(3)}`), row('公尺 m', `${+(mm / 1000).toFixed(5)}`)),
    sec('尺貫法', `1 尺 = 10/33 m ≈ ${SHAKU_MM.toFixed(2)} mm`,
      row('尺', `${toShaku(mm, 4)} 尺`),
      row('尺・寸・分・厘', toShakuRi(mm)),
      row('台尺（丈・尺・寸・分）', toTaiShaku(mm)),
      row('日式（間・尺・寸・分）', toKenShaku(mm))),
    sec('曲尺裏目', '以表目量得這個長度 L 時',
      row('角目讀數（L ÷ √2）', `${fmtMm(mm / SQ2, 1)} mm`, `${both(mm / SQ2)}・圓材直徑 L 可取的方材邊長`),
      row('對角線（L × √2）', `${fmtMm(mm * SQ2, 1)} mm`, `${both(mm * SQ2)}・方材邊長 L 的對角線`),
      row('丸目讀數（L × π）', `${fmtMm(mm * Math.PI, 1)} mm`, '圓材直徑 L 的圓周')),
    h('section', { class: 'fsec' },
      h('h3', {}, '魯班尺', h('small', { text: '吉凶屬民俗傳統，僅供參考' })),
      lubanBlock(RULERS.men, mm, cfg, onCfg, onApply),
      lubanBlock(RULERS.ding, mm, cfg, onCfg, onApply),
      h('p', { class: 'note', text: '字位版本各家略有差異，可切換一循環的長度。目前只判斷到「大字」層級（紅字＝吉：門公尺的財、義、官、本；丁蘭尺的丁、旺、義、官、興、財）；每個大字底下的小字（雙紅字）查不到可靠字位表，尚未收錄。丁蘭尺依資料用於陰宅；家具、神位多用門公尺。' })));
}
