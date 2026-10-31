import test from 'node:test';
import assert from 'node:assert/strict';
import { evalLength, toKenShaku, toTaiShaku, SHAKU_MM, fmtMm } from '../js/units.js';
import {
  roofFromKobai, roofLengths, haitsukeRafters, kobaiFromAngle, kobaiFromRiseRun,
  arcFromChordRise, arcFromChordRadius, arcOffsets, diagonal,
} from '../js/calc.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('尺 = 10/33 m', () => {
  close(SHAKU_MM, 303.030303, 1e-5);
  close(evalLength('1間'), 6 * SHAKU_MM);
  close(evalLength('1尺'), SHAKU_MM);
  close(evalLength('1寸'), SHAKU_MM / 10);
});

test('混合算式', () => {
  close(evalLength('3間2尺5寸'), 20.5 * SHAKU_MM);
  close(evalLength('1尺 - 100mm'), SHAKU_MM - 100);
  close(evalLength('(1間+1尺)*2'), 14 * SHAKU_MM);
  close(evalLength('1m + 20cm'), 1200);
  close(evalLength('３間２尺'), 20 * SHAKU_MM, 1e-6); // 全形
  close(evalLength('2尺×3'), 6 * SHAKU_MM);
  close(evalLength('120'), 120); // 沒寫單位 = mm
  close(evalLength('-1尺'), -SHAKU_MM);
  assert.equal(evalLength('   '), null);
});

test('語法錯誤', () => {
  assert.throws(() => evalLength('3間+'));
  assert.throws(() => evalLength('尺'));
  assert.throws(() => evalLength('(1尺'));
  assert.throws(() => evalLength('1尺 / 0'));
  assert.throws(() => evalLength('1尺 abc'));
  assert.throws(() => evalLength('1 2'));
});

test('顯示格式', () => {
  assert.equal(toKenShaku(evalLength('3間2尺5寸')), '3間2尺5寸');
  assert.equal(toKenShaku(evalLength('4寸5分')), '4寸5分');
  assert.equal(toKenShaku(0), '0');
  assert.equal(toKenShaku(evalLength('-2尺')), '−2尺');
  assert.equal(toKenShaku(evalLength('1間')), '1間');
  assert.equal(fmtMm(1234.5678), '1234.6');
});

test('4.5寸勾配', () => {
  const r = roofFromKobai(4.5);
  close(r.gen, Math.sqrt(120.25));
  close(r.nobi, 1.0965856, 1e-6);
  close(r.angleDeg, 24.2277, 1e-3);
  close(r.hip.gen, Math.sqrt(220.25));
  close(r.hip.kobai, 4.5 / Math.SQRT2);
  close(r.hip.nobi, Math.sqrt(220.25) / 10);
});

test('10寸勾配 = 45°', () => {
  close(roofFromKobai(10).angleDeg, 45, 1e-9);
  close(kobaiFromAngle(45), 10, 1e-9);
  close(kobaiFromRiseRun(500, 1000), 5);
});

test('隅木實長 = 單邊水平長 × √(200+勾²)/10', () => {
  const a = 1818.18; // 約 1 間
  const { rafter, rise, hip, hipPlan } = roofLengths(a, 4);
  close(rafter, a * Math.sqrt(116) / 10);
  close(rise, a * 0.4);
  close(hip, a * Math.sqrt(216) / 10);
  close(hipPlan, a * Math.SQRT2);
  // 立體對角線一致：隅木實長² = 平面隅長² + 立上り²
  close(hip * hip, hipPlan * hipPlan + rise * rise, 1e-6);
});

test('配付垂木', () => {
  const { decrement, rows } = haitsukeRafters(1000, 300, 5);
  close(decrement, 300 * Math.sqrt(125) / 10);
  assert.equal(rows.length, 4); // 1000, 700, 400, 100
  close(rows[1].real, 700 * Math.sqrt(125) / 10);
  close(rows[0].real - rows[1].real, decrement);
});

test('R 弧', () => {
  // 弦 2000、矢 100 → R = (1000²+100²)/(200) = 5050
  const a = arcFromChordRise(2000, 100);
  close(a.R, 5050);
  close(a.thetaDeg, 2 * Math.asin(1000 / 5050) * 180 / Math.PI, 1e-9);
  close(a.arc, 5050 * 2 * Math.asin(1000 / 5050), 1e-6);
  // 半圓：弦 = 2R, 矢 = R
  const half = arcFromChordRise(2000, 1000);
  close(half.R, 1000);
  close(half.thetaDeg, 180, 1e-9);
  // 反推
  close(arcFromChordRadius(2000, 5050).h, 100, 1e-6);
  assert.throws(() => arcFromChordRadius(3000, 1000));
});

test('弧的分點高度', () => {
  const rows = arcOffsets(2000, 100, 4);
  assert.equal(rows.length, 5);
  close(rows[0].y, 0, 1e-6);
  close(rows[4].y, 0, 1e-6);
  close(rows[2].y, 100, 1e-6);
  close(rows[1].y, rows[3].y, 1e-9);
});

test('對角線', () => {
  close(diagonal(3, 4), 5);
  close(diagonal(3 * SHAKU_MM, 4 * SHAKU_MM), 5 * SHAKU_MM);
});

test('台灣用語：丈・台尺', () => {
  close(evalLength('1丈'), 10 * SHAKU_MM);
  close(evalLength('2丈5寸'), 20.5 * SHAKU_MM);
  close(evalLength('1台尺'), SHAKU_MM);
  close(evalLength('1丈2尺3寸'), 12.3 * SHAKU_MM);
  assert.equal(toTaiShaku(evalLength('3間2尺5寸')), '2丈5寸'); // 20.5 尺
  assert.equal(toTaiShaku(evalLength('1丈2尺3寸4分')), '1丈2尺3寸4分');
  assert.equal(toTaiShaku(evalLength('-5尺')), '−5尺');
  assert.equal(toTaiShaku(0), '0');
  assert.equal(toKenShaku(evalLength('1丈')), '1間4尺'); // 日式顯示不受影響
});
