import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSection } from '../js/section.js';
import { SHAKU_MM } from '../js/units.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const sun = SHAKU_MM / 10;

test('公制：120×120 mm 各種寫法', () => {
  for (const src of ['120×120 mm', '120 x 120', '120x120mm', '120*120', '１２０×１２０ｍｍ', '120mm × 120mm']) {
    const r = parseSection(src);
    close(r.b, 120); close(r.d, 120);
    assert.equal(r.square, true, src);
  }
  const r = parseSection('105 × 150 mm');
  close(r.b, 105); close(r.d, 150);
  assert.equal(r.square, false);
});

test('正方形：「角」', () => {
  close(parseSection('4寸角').b, 4 * sun);
  close(parseSection('4寸角').d, 4 * sun);
  close(parseSection('4寸5分角').b, 4.5 * sun);
  close(parseSection('105角').b, 105);
  close(parseSection('120mm角').d, 120);
  assert.equal(parseSection('4寸角').square, true);
});

test('台尺：幅×せい，單位可只寫一次', () => {
  let r = parseSection('4寸×5寸');
  close(r.b, 4 * sun); close(r.d, 5 * sun);
  r = parseSection('4×5寸');
  close(r.b, 4 * sun); close(r.d, 5 * sun);
  r = parseSection('4寸×5');
  close(r.b, 4 * sun); close(r.d, 5 * sun);
  r = parseSection('３寸５分×４寸');
  close(r.b, 3.5 * sun); close(r.d, 4 * sun);
  r = parseSection('1尺2寸 x 6寸');
  close(r.b, 12 * sun); close(r.d, 6 * sun);
});

test('錯誤輸入', () => {
  for (const bad of ['', '   ', '120', '120x', 'x120', '0x5', '120x120x120', 'abc', '-4寸角', '角', '4寸×0']) {
    assert.throws(() => parseSection(bad), bad);
  }
});
