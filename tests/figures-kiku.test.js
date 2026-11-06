// 規矩術工具的示意圖：各種輸入（含極端坡度、振れ角）都不能出現 NaN 或跑出畫面
import test from 'node:test';
import assert from 'node:assert/strict';
import { triangleFigure, sumiFigure, yaneFigure, areaFigure } from '../js/figures-kiku.js';
import { audit } from './audit.js';

test('直角三角形與中勾・長玄・短玄：各種坡度', () => {
  for (const n of [0, 0.3, 1, 4, 10, 15, 40]) for (const split of [false, true]) {
    audit(triangleFigure({ n, split, angleText: '21.80°', nums: ['殳 1820.0 mm', '勾 728.0 mm', '玄 1960.2 mm'] }), `tri n=${n} split=${split}`);
  }
  audit(triangleFigure(), '預設');
  assert.ok(triangleFigure({ split: true }).includes('中勾'));
});

test('角梁・谷木：各種振れ角與坡度', () => {
  for (const a of [1, 15, 30, 45, 60, 80, 89]) for (const n of [0, 2, 4, 12]) for (const kind of ['de', 'tani']) {
    audit(sumiFigure({ alphaDeg: a, n, kind, hipText: '2.83 寸', nums: ['殳 1820', '平面長 2573.9', '實長 2674.8'] }), `sumi α=${a} n=${n} ${kind}`);
  }
  assert.ok(sumiFigure({ kind: 'tani' }).includes('谷木'));
});

test('屋頂伏圖：切妻、寄棟、極端長寬比', () => {
  for (const shape of ['kiri', 'yose']) for (const [B, W] of [[7280, 5460], [20000, 3000], [5460, 5460], [3000, 2900]]) {
    audit(yaneFigure({ shape, B, W, E: 600, Eg: 450, P: 455, nums: ['棟長 8180.0 mm', '椽長 3586.5 mm'] }), `${shape} ${B}x${W}`);
  }
  audit(yaneFigure({ shape: 'kiri', B: 100000, W: 3000, P: 10 }), '椽木太多時不畫');
});

test('屋面面積圖', () => {
  audit(areaFigure(), '預設');
  for (const k of [1, 1.077, 1.8]) audit(areaFigure({ planM2: 66, m2: 66 * k, k }), `k=${k}`);
});
