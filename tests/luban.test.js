import test from 'node:test';
import assert from 'node:assert/strict';
import { RULERS, checkRuler, goodRangesNear } from '../js/luban.js';

const men = RULERS.men, ding = RULERS.ding;
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('字位表資料', () => {
  assert.deepEqual(men.bands, ['財', '病', '離', '義', '官', '劫', '害', '本']);
  assert.deepEqual(men.good, ['財', '義', '官', '本']);
  assert.equal(ding.bands.length, 10);
  assert.deepEqual(ding.good, ['丁', '旺', '義', '官', '興', '財']);
  for (const r of [men, ding]) {
    for (const g of r.good) assert.ok(r.bands.includes(g));
    assert.equal(new Set(r.bands).size, r.bands.length);
  }
});

test('門公尺：落點與吉凶（循環 429 mm，每字 53.625 mm）', () => {
  const at = (L) => checkRuler(men, 429, L);
  close(at(0).bandW, 53.625);
  assert.equal(at(25).band, '財'); assert.equal(at(25).status, 'good');
  assert.equal(at(60).band, '病'); assert.equal(at(60).status, 'bad');
  assert.equal(at(120).band, '離');
  assert.equal(at(200).band, '義'); assert.equal(at(200).status, 'good');
  assert.equal(at(250).band, '官');
  assert.equal(at(300).band, '劫');
  assert.equal(at(350).band, '害');
  assert.equal(at(400).band, '本'); assert.equal(at(400).status, 'good');
});

test('循環：超過一循環會繞回來，負數也可', () => {
  assert.equal(checkRuler(men, 429, 429 * 3 + 200).band, '義');
  assert.equal(checkRuler(men, 429, 200 - 429).band, '義');
  close(checkRuler(men, 429, 429 * 2).r, 0);
});

test('吉位但太靠邊界 → edge；中央 → good', () => {
  const nearEdge = checkRuler(men, 429, 0.5);          // 財的起點附近
  assert.equal(nearEdge.band, '財'); assert.equal(nearEdge.status, 'edge');
  assert.ok(nearEdge.fwd && nearEdge.fwd.delta <= 2);
  assert.equal(checkRuler(men, 429, 53.0).status, 'edge'); // 財的尾端（53.625 前 0.6 mm）
  assert.equal(checkRuler(men, 429, 26).status, 'good');
});

test('微調建議：往前、往後各給一個最小調整', () => {
  const c = checkRuler(men, 429, 500);                  // r = 71 → 病
  assert.equal(c.band, '病'); assert.equal(c.status, 'bad');
  // 往小：退到財的穩妥區尾端 51.625 → 71 − 51.625 = 19.375 → 20
  assert.equal(c.back.delta, 20); assert.equal(c.back.band, '財');
  // 往大：下一個吉位是義，起點 160.875 + 2 → 91.875 → 92
  assert.equal(c.fwd.delta, 92); assert.equal(c.fwd.band, '義');
  // 套用建議後確實落在吉位穩妥區
  assert.equal(checkRuler(men, 429, 500 - c.back.delta).status, 'good');
  assert.equal(checkRuler(men, 429, 500 + c.fwd.delta).status, 'good');
});

test('建議套用後一定 good（掃描 0～1500 mm，兩把尺、兩種循環）', () => {
  for (const ruler of [men, ding]) {
    for (const cyc of ruler.cycles) {
      for (let L = 0; L <= 1500; L += 0.7) {
        const c = checkRuler(ruler, cyc.mm, L);
        if (c.status === 'good') { assert.equal(c.fwd, null); continue; }
        assert.ok(c.fwd && c.back, `${ruler.id} ${L}`);
        assert.equal(checkRuler(ruler, cyc.mm, L + c.fwd.delta).status, 'good', `${ruler.id} ${cyc.mm} +${c.fwd.delta} @${L}`);
        assert.equal(checkRuler(ruler, cyc.mm, L - c.back.delta).status, 'good', `${ruler.id} ${cyc.mm} -${c.back.delta} @${L}`);
      }
    }
  }
});

test('丁蘭尺（循環 390 mm，十格，每格 39 mm）', () => {
  const at = (L) => checkRuler(ding, 390, L);
  assert.equal(at(20).band, '丁'); assert.equal(at(20).status, 'good');
  assert.equal(at(45).band, '害'); assert.equal(at(45).status, 'bad');
  assert.equal(at(100).band, '旺');
  assert.equal(at(130).band, '苦');
  assert.equal(at(160).band, '義');
  assert.equal(at(200).band, '官');
  assert.equal(at(250).band, '死');
  assert.equal(at(290).band, '興');
  assert.equal(at(330).band, '失');
  assert.equal(at(370).band, '財'); assert.equal(at(370).status, 'good');
  const c = at(45);                                       // 害：往後退到丁，往前進到旺
  assert.equal(c.back.band, '丁'); assert.equal(c.fwd.band, '旺');
});

test('附近的吉位區間：與「建議」一致、依距離排序', () => {
  const c = checkRuler(men, 429, 500);                       // 凶（病）；建議 −20 → 財、+92 → 義
  const near = goodRangesNear(men, 429, 500, 100);
  assert.ok(near.length >= 2);
  assert.equal(near[0].delta, -c.back.delta); assert.equal(near[0].band, '財');
  const fwd = near.find((x) => x.delta > 0);
  assert.equal(fwd.delta, c.fwd.delta); assert.equal(fwd.band, '義');
  // 依 |delta| 由小到大
  for (let i = 1; i < near.length; i++) assert.ok(Math.abs(near[i].delta) >= Math.abs(near[i - 1].delta));
  // 區間端點在搜尋範圍內、且是穩妥區
  for (const x of near) {
    assert.ok(x.from >= 400 - 1e-9 && x.to <= 600 + 1e-9 && x.from <= x.to);
    assert.equal(checkRuler(men, 429, (x.from + x.to) / 2).status, 'good');
    assert.equal(checkRuler(men, 429, 500 + x.delta).status, 'good', `delta ${x.delta}`);
  }
});

test('附近的吉位區間：目前就在吉位時 delta = 0 排第一', () => {
  const near = goodRangesNear(men, 429, 200, 50);            // 200 在義（160.9–214.5）
  assert.equal(near[0].delta, 0); assert.equal(near[0].band, '義');
  assert.ok(near[0].from <= 200 && near[0].to >= 200);
});

test('附近的吉位區間：範圍小到沒有吉位時回傳空陣列；跨循環也能找', () => {
  assert.deepEqual(goodRangesNear(men, 429, 75, 5), []);      // 75±5 全在「病」
  const wrap = goodRangesNear(men, 429, 425, 30);             // 接近一循環尾端，會跨到下一個循環的「財」
  assert.ok(wrap.some((x) => x.band === '財' && x.from >= 429));
  for (const ruler of [men, ding]) for (const cyc of ruler.cycles) for (let L = 0; L < 900; L += 13.7) {
    for (const x of goodRangesNear(ruler, cyc.mm, L, 80)) assert.equal(checkRuler(ruler, cyc.mm, L + x.delta).status, 'good', `${ruler.id} ${L} ${x.delta}`);
  }
});
