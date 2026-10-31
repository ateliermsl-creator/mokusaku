// 「同步換算」面板：公制、尺貫法、曲尺裏目（角目）。魯班尺是獨立分頁（js/luban-ui.js）。
import { h } from './dom.js';
import { fmtMm, toShaku, toTaiShaku, toKenShaku, toShakuRi, SHAKU_MM } from './units.js';

const SQ2 = Math.SQRT2;
const n1 = (v) => `${+Number(v).toFixed(1)}`;

function row(k, v, sub) {
  return h('div', { class: 'frow' },
    h('span', { class: 'fk', text: k }),
    h('span', { class: 'fv' }, h('b', { text: v }), sub ? h('small', { text: sub }) : null));
}
const sec = (title, note, ...rows) => h('section', { class: 'fsec' },
  h('h3', {}, title, note ? h('small', { text: note }) : null), rows);

/**
 * @param box   容器
 * @param mm    要換算的長度（null = 還沒有結果）
 * @param opts  { partial }
 */
export function renderFour(box, mm, { partial = false } = {}) {
  box.textContent = '';
  box.classList.toggle('partial', !!partial);
  if (mm == null || !Number.isFinite(mm)) {
    box.append(h('p', { class: 'four-empty', text: '算出長度後，這裡會同步顯示公制、尺貫法與曲尺裏目（角目）。' }));
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
      row('丸目讀數（L × π）', `${fmtMm(mm * Math.PI, 1)} mm`, '圓材直徑 L 的圓周'))
  );
}
