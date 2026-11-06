// 規矩術計算：用參考 App 截圖上的數字當驗算答案（4 寸、殳 1820、桁行 7280、梁間 5460…）
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nobi, parseSlope, slopeInfo, kouKoGen, sumiTani, yaneFuse, roofArea, triangle, slopeTable, fmtAngle, fmtNum, TSUBO_M2,
} from '../js/kiku.js';

const near = (a, b, tol = 0.05, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≠ ${b}`);

test('坡度換算：寸、角度、%、分數互換', () => {
  near(parseSlope('kobai', '4'), 4, 1e-12);
  near(parseSlope('percent', '40'), 4, 1e-12);
  near(parseSlope('angle', '21.80140949'), 4, 1e-6);
  near(parseSlope('fraction', '4/10'), 4, 1e-12);
  near(parseSlope('fraction', '1:2.5'), 4, 1e-12);
  near(parseSlope('fraction', '１：２．５'), 4, 1e-12);       // 全形也可以
  assert.equal(parseSlope('kobai', ''), null);
  assert.throws(() => parseSlope('angle', '90'));
  assert.throws(() => parseSlope('fraction', '4/0'));
  assert.throws(() => parseSlope('fraction', 'abc'));
  assert.throws(() => parseSlope('kobai', '-1'));
  const s = slopeInfo(4);
  near(s.angleDeg, 21.80, 0.005); near(s.percent, 40, 1e-9); near(s.nobi, 1.0770, 0.00005); near(s.hipKobai, 2.83, 0.005);
});

test('勾股玄：勾、玄與墨付割線（中勾・長玄・短玄）', () => {
  const r = kouKoGen(1820, 4);
  near(r.kou, 728.0); near(r.gen, 1960.2); near(r.nobi, 1.0770, 0.00005); near(r.angleDeg, 21.80, 0.005);
  near(r.chogen, 1689.8); near(r.tangen, 270.4); near(r.chuko, 675.9);
  // 驗算：長玄＋短玄＝玄；中勾² ＝ 長玄×短玄
  near(r.chogen + r.tangen, r.gen, 1e-9); near(r.chuko ** 2, r.chogen * r.tangen, 1e-6);
  assert.throws(() => kouKoGen(0, 4));
});

test('角梁・谷木：真隅與振れ隅', () => {
  const s = sumiTani(1820, 4, 45);
  near(s.hipKobai, 2.83, 0.005); near(s.plan, 2573.9); near(s.length, 2674.8); near(s.rise, 728.0);
  near(s.nobi, 1.0392, 0.00005); near(s.angleDeg, 15.79, 0.005); near(s.otherKobai, 4, 1e-9);
  // 與舊的 45° 公式一致：隅木長 ＝ a√(200+n²)/10
  near(s.length, 1820 * Math.sqrt(216) / 10, 1e-6);
  // 振れ隅 30°：隅勾配 ＝ n cos30°，平面長 ＝ 殳/cos30°，另一側坡度 ＝ n/tan30°
  const f = sumiTani(1000, 5, 30);
  near(f.hipKobai, 5 * Math.cos(Math.PI / 6), 1e-9); near(f.plan, 1000 / Math.cos(Math.PI / 6), 1e-9);
  near(f.otherKobai, 5 / Math.tan(Math.PI / 6), 1e-9);
  near(f.rise, f.plan * f.hipKobai / 10, 1e-9, '立上高要和隅勾配一致');
  assert.throws(() => sumiTani(1000, 4, 0)); assert.throws(() => sumiTani(1000, 4, 90));
});

test('屋頂伏圖：切妻', () => {
  const k = yaneFuse({ shape: 'kiri', B: 7280, W: 5460, n: 4, E: 600, Eg: 450, P: 455 });
  near(k.rafter, 3586.5); near(k.ridgeHKeta, 1092.0); near(k.ridgeLen, 8180); near(k.angleDeg, 21.80, 0.005);
  assert.equal(k.rafterPerSide, 18); assert.equal(k.rafterTotal, 36);
  near(k.areaMm2 / 1e6, 58.68, 0.005); near(k.gableMm2 / 1e6, 2.98, 0.005);
  assert.equal(yaneFuse({ shape: 'kiri', B: 7280, W: 5460, n: 4 }).rafterPerSide, null, '沒填椽距就不算支數');
});

test('屋頂伏圖：寄棟（棟高分開「從軒桁天端」與「從軒先」）', () => {
  const y = yaneFuse({ shape: 'yose', B: 7280, W: 5460, n: 4, E: 600, P: 455 });
  near(y.rafter, 3586.5); near(y.hip, 4894.1); near(y.decrement, 490.0); near(y.hipKobai, 2.83, 0.005);
  near(y.hipPlan, 4709.3); near(y.ridgeLen, 1820); near(y.areaMm2 / 1e6, 60.83, 0.005);
  near(y.ridgeHKeta, 1092.0, 1e-9, '從軒桁天端：梁間/2 × n/10');
  near(y.ridgeHEave, 1332.0, 1e-9, '從軒先：(梁間＋2×軒の出)/2 × n/10');
  assert.throws(() => yaneFuse({ shape: 'yose', B: 5000, W: 6000, n: 4 }), /桁行/);
  assert.throws(() => yaneFuse({ shape: 'x', B: 1, W: 1, n: 4 }));
});

test('屋面面積與坪', () => {
  const a = roofArea(66, 4);
  near(a.m2, 71.08, 0.005); near(a.k, 1.0770, 0.00005); near(a.tsubo, 21.50, 0.005);
  near(TSUBO_M2, 3.3058, 0.00005);
  assert.throws(() => roofArea(0, 4));
});

test('三邊計算：求斜邊、求另一邊、由角度求', () => {
  const h = triangle('hyp', 3000, 4000);
  near(h.gen, 5000, 1e-9); near(h.angleDeg, 53.13, 0.005); near(h.kobai, 13.33, 0.005);
  const l = triangle('leg', 5000, 3000); near(l.kou, 4000, 1e-9);
  const g = triangle('angle', 1820, 21.80140949); near(g.kou, 728, 0.01); near(g.gen, 1960.2, 0.05);
  assert.throws(() => triangle('leg', 3000, 3000)); assert.throws(() => triangle('angle', 1000, 90));
});

test('坡度速查表：1～15 寸、每 0.5 寸，共 29 列', () => {
  const t = slopeTable();
  assert.equal(t.length, 29); assert.equal(t[0].kobai, 1); assert.equal(t.at(-1).kobai, 15);
  const r4 = t.find((r) => r.kobai === 4), r10 = t.find((r) => r.kobai === 10);
  near(r4.angleDeg, 21.80, 0.005); near(r4.nobi, 1.0770, 0.00005); near(r4.hipKobai, 2.83, 0.005);
  near(r10.angleDeg, 45, 1e-9); near(r10.nobi, 1.4142, 0.00005); near(r10.hipKobai, 7.07, 0.005);
  near(t.at(-1).angleDeg, 56.31, 0.005); near(t.at(-1).nobi, 1.8028, 0.00005);
});

test('顯示：度分秒、小數位', () => {
  assert.equal(fmtAngle(21.80140949, 'dms'), `21°48'05.1"`);
  assert.equal(fmtAngle(45, 'dms'), `45°00'00.0"`);
  assert.equal(fmtAngle(21.80140949), '21.80°');
  assert.equal(fmtAngle(NaN), '—');
  assert.equal(fmtAngle(29.9999999, 'dms'), `30°00'00.0"`, '進位不能出現 60 秒');
  assert.equal(fmtNum(1969.69, 0), '1970'); assert.equal(fmtNum(-0.01, 1), '0.0'); assert.equal(nobi(0), 1);
});
