import test from 'node:test';
import assert from 'node:assert/strict';
import {
  box, roofSection, hipSection, haitsukePlan, arcFigure, arcConcept, diagFigure, squareCheck, tri345,
  unitLadder, composition, lubanBar, textWidth,
} from '../js/figures.js';
import { RULERS, checkRuler } from '../js/luban.js';
import { roofFromKobai, roofLengths, haitsukeRafters, arcFromChordRise, arcOffsets, diagonal } from '../js/calc.js';

import { audit } from './audit.js';

test('屋頂剖面：各種坡度（含 0、極陡）與有無數字', () => {
  for (const x of [0, 1, 3, 4.5, 6, 10, 20, 40]) {
    const r = roofFromKobai(x);
    audit(roofSection({ x, angleDeg: r.angleDeg }), `roof x=${x} 無數字`);
    const a = 6060.6, L = roofLengths(a, x);
    audit(roofSection({ x, a, rise: L.rise, rafter: L.rafter, angleDeg: r.angleDeg }), `roof x=${x} 有數字`);
  }
  const html = roofSection({ x: 4.5, a: 3636.4, rise: 1636.4, rafter: 3987.6, angleDeg: 24.23 });
  assert.ok(html.includes('24.23°') && html.includes('3636') && html.includes('1636') && html.includes('3988'));
});

test('角梁圖：各種坡度', () => {
  for (const x of [0, 2, 4.5, 8, 15, 40]) {
    const r = roofFromKobai(x);
    audit(hipSection({ x, hipAngleDeg: r.hip.angleDeg }), `hip x=${x}`);
    const L = roofLengths(5000, x);
    audit(hipSection({ x, a: 5000, planLen: L.hipPlan, rise: L.rise, hipLen: L.hip, hipAngleDeg: r.hip.angleDeg }), `hip x=${x} 有數字`);
  }
});

test('配付垂木平面圖：示意圖、少支、多支、極端間距', () => {
  audit(haitsukePlan(), 'haitsuke 示意');
  for (const [first, pitch] of [[3636, 303], [6000, 300], [1000, 900], [3000, 50], [200, 100], [10000, 303]]) {
    const h = haitsukeRafters(first, pitch, 4.5);
    audit(haitsukePlan({ first, pitch, decrement: h.decrement, count: h.rows.length }), `haitsuke ${first}/${pitch}`);
  }
  const h = haitsukeRafters(3636.4, 303, 4.5);
  const html = haitsukePlan({ first: 3636.4, pitch: 303, decrement: h.decrement, count: h.rows.length });
  assert.ok(html.includes(`共 ${h.rows.length} 支`));
});

test('弧圖：淺弧、深弧、半圓、不同等分數', () => {
  for (const [c, h] of [[3636, 91], [2000, 100], [2000, 400], [2000, 1000], [600, 5], [10000, 150]]) {
    const a = arcFromChordRise(c, h);
    for (const n of [2, 8, 16, 40]) audit(arcFigure({ c, h, R: a.R, thetaDeg: a.thetaDeg, n }), `arc ${c}/${h} n=${n}`);
  }
  const a = arcFromChordRise(3636.4, 90.9);
  const html = arcFigure({ c: 3636.4, h: 90.9, R: a.R, thetaDeg: a.thetaDeg, n: 8, offsets: arcOffsets(3636.4, 90.9, 8).map((r) => r.y) });
  assert.ok(html.includes('示意圖：弧高放大'));
  audit(arcConcept(), 'arc concept');
});

test('對角線與抓直角', () => {
  audit(diagFigure(), 'diag 示意');
  for (const [a, b] of [[5454, 7272], [1000, 1000], [1000, 9000], [9000, 1000], [300, 400]]) {
    audit(diagFigure({ a, b, d: diagonal(a, b) }), `diag ${a}x${b}`);
  }
  audit(squareCheck(), 'square 無資料');
  for (const [d1, d2] of [[9090, 9090], [9090, 9093], [9093, 9090], [9090, 9190], [9190, 9090], [9090, 9090.3]]) audit(squareCheck({ d1, d2 }), `square ${d1}/${d2}`);
  assert.ok(squareCheck({ d1: 9090, d2: 9090 }).includes('直角 ✓'));
  assert.ok(squareCheck({ d1: 9093, d2: 9090 }).includes('①'));
  assert.ok(squareCheck({ d1: 9090, d2: 9093 }).includes('②'));
  audit(tri345(), '345');
});

test('台尺混算：長度關係與組成條', () => {
  audit(unitLadder(), 'ladder');
  for (const mm of [0.4, 5, 303.03, 6332.1, 100000, -2000]) audit(composition(mm) || '<figure viewBox="0 0 1 1"></figure>', `composition ${mm}`);
  assert.equal(composition(0), '');
  assert.ok(composition(6332.1).includes('2 丈'));
});

test('魯班尺字位條', () => {
  for (const ruler of Object.values(RULERS)) {
    for (const L of [0, 25, 60, 250, 428.9, 500]) {
      const c = checkRuler(ruler, ruler.cycles[0].mm, L);
      const html = audit(lubanBar(ruler, c), `luban ${ruler.id} ${L}`);
      for (const band of ruler.bands) assert.ok(html.includes(`>${band}<`));
    }
  }
});

test('檢查本身有效：故意做壞的圖會被抓到', () => {
  const wrap = (body) => box([100, 50], body, 'x');
  assert.throws(() => audit(wrap('<text x="90" y="20" text-anchor="start">超出畫面很多的文字</text>'), 't1'), /跑出畫面/);
  assert.throws(() => audit(wrap('<rect class="ln" x="80" y="10" width="40" height="10"/>'), 't2'), /超出/);
  assert.throws(() => audit(wrap('<line class="dim" x1="0" y1="0" x2="50" y2="99"/>'), 't3'), /超出/);
  assert.throws(() => audit(wrap('<text x="NaN" y="1" text-anchor="start">a</text>'), 't4'), /NaN/);
  assert.throws(() => audit(wrap('<polygon class="ln" points="10,10 200,10 10,20"/>'), 't5'), /超出/);
  audit(wrap('<rect class="ln" x="10" y="10" width="40" height="10"/>'), 'ok'); // 正常的不會被誤抓
});
