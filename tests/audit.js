// 圖形檢查（給各圖形測試共用；檔名不是 .test.js，不會被當成測試執行）
import assert from 'node:assert/strict';
import { textWidth } from '../js/figures.js';

const num = (s, name) => { const m = new RegExp(`\\b${name}="(-?[\\d.]+)"`).exec(s); return m ? parseFloat(m[1]) : null; };

/** 檢查一張圖：沒有 NaN／undefined，所有圖形與文字都在 viewBox 內 */
export function audit(html, label) {
  assert.ok(html.startsWith('<figure'), `${label}: 不是 figure`);
  assert.ok(!/NaN|undefined|Infinity|null/.test(html), `${label}: 含有 NaN/undefined/Infinity/null`);
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(html);
  assert.ok(vb, `${label}: 沒有 viewBox`);
  const VW = +vb[1], VH = +vb[2], tol = 1;
  const inX = (v, what) => assert.ok(v >= -tol && v <= VW + tol, `${label}: ${what} x=${v} 超出 0..${VW}`);
  const inY = (v, what) => assert.ok(v >= -tol && v <= VH + tol, `${label}: ${what} y=${v} 超出 0..${VH}`);
  for (const m of html.matchAll(/<(rect|line|circle|text|polygon|path)\b([^>]*?)\/?>/g)) {
    const [, tag, attrs] = m;
    if (tag === 'rect') {
      const x = num(attrs, 'x'), y = num(attrs, 'y'), w = num(attrs, 'width'), h = num(attrs, 'height');
      inX(x, 'rect'); inX(x + w, 'rect 右緣'); inY(y, 'rect'); inY(y + h, 'rect 下緣');
    } else if (tag === 'line') {
      for (const k of ['x1', 'x2']) inX(num(attrs, k), 'line');
      for (const k of ['y1', 'y2']) inY(num(attrs, k), 'line');
    } else if (tag === 'circle') { inX(num(attrs, 'cx'), 'circle'); inY(num(attrs, 'cy'), 'circle'); }
    else if (tag === 'polygon') {
      for (const p of /points="([^"]+)"/.exec(attrs)[1].split(' ')) { const [px, py] = p.split(',').map(Number); inX(px, 'polygon'); inY(py, 'polygon'); }
    }
  }
  // 文字：用估計寬度檢查左右邊界（旋轉的文字略過）
  for (const m of html.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const [, attrs, content] = m;
    if (attrs.includes('transform=')) continue;
    const x = num(attrs, 'x'), y = num(attrs, 'y');
    const anchor = /text-anchor="(\w+)"/.exec(attrs)[1];
    const w = textWidth(content.replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
    const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    const right = left + w;
    assert.ok(left >= -tol && right <= VW + tol, `${label}: 文字「${content}」跑出畫面 (${left.toFixed(0)}..${right.toFixed(0)} / ${VW})`);
    inY(y, `文字「${content}」`);
  }
  return html;
}
