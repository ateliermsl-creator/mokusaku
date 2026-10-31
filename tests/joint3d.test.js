import test from 'node:test';
import assert from 'node:assert/strict';
import { oikakeModel, polyArea, E, SPAN } from '../js/joint3d-geom.js';

const rectArea = (m) => (m.Lx + 2 * m.ext) * m.D;

test('追掛大栓継ぎ：兩材剛好拼滿整個平面（沒有重疊、沒有縫）', () => {
  for (const D of [120, 121.2, 60, 450]) {
    const m = oikakeModel(D);
    const a = polyArea(m.A), b = polyArea(m.B);
    assert.ok(Math.abs(a + b - rectArea(m)) < 1e-6 * rectArea(m), `D=${D}: A+B=${a + b} ≠ ${rectArea(m)}`);
    assert.ok(Math.abs(a - b) < 0.02 * a, '兩材面積應該相近（只差界線上的小斜度與段差）');
  }
});

test('尺寸與文獻圖 17(a)（材成 120）一致', () => {
  const m = oikakeModel(120);
  assert.equal(m.Lx, 3 * 120 + 2 * 15);                       // 肩到肩 360，兩端各留 15
  assert.equal(E * 120, 15);
  assert.equal(SPAN, 3);
  assert.deepEqual(m.pins.map((p) => p.size), [15, 18]);       // 栓 15×15 與 18×18
  const xs = m.A.map((p) => p[0]);
  assert.ok(xs.includes(0) && xs.includes(15) && xs.includes(m.Lx) && xs.includes(m.Lx - 15));
});

test('A、B 共用同一條界線：A 的界線頂點全部也在 B 上', () => {
  const m = oikakeModel(120);
  const key = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const bset = new Set(m.B.map(key));
  for (const q of [[15, 0], [195, 3.96], [195, -6], [390, 0], [0, 0], [0, -15], [15, -15], [375, 15], [390, 15]]) assert.ok(bset.has(key(q)), `B 缺少界線頂點 ${q}`);
});

test('栓在兩材重疊的範圍內，並與兩端對稱', () => {
  const m = oikakeModel(120), c = m.Lx / 2;
  for (const p of m.pins) assert.ok(p.x > 15 && p.x < m.Lx - 15);
  assert.ok(Math.abs((c - m.pins[0].x) - (m.pins[1].x - c)) < 1e-9);
  assert.throws(() => oikakeModel(0)); assert.throws(() => oikakeModel(NaN));
});
