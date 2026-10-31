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

import { jointModel, inPoly } from '../js/joint3d-geom.js';

const IDS = ['oikake', 'kama', 'koshikake'];
// 某一層高度 y、平面點 (x, py)：落在哪些材裡（k＝拆開程度 0～1）
const hit = (m, k, y, x, py) => m.members.filter((mem, i) => {
  const dx = (i === 0 ? -1 : 1) * k * m.explodeDx;
  return mem.pieces.some((pc) => y > pc.y0 && y < pc.y1 && inPoly([x - dx, py], pc.poly));
}).length;

test('各継手：合起來時每一層、每個點都剛好屬於一根材（不重疊、沒有縫）', () => {
  for (const id of IDS) for (const D of [120, 90.9]) {
    const m = jointModel(id, D), H = D / 2;
    for (const yy of [0.2, 0.45, 0.55, 0.8]) {
      for (let x = m.x0 + 0.37; x < m.x1; x += D / 11) for (let py = -H + 0.31; py < H; py += D / 9) {
        assert.equal(hit(m, 0, yy * D, x, py), 1, `${id}/D=${D}: y=${yy}D (${x.toFixed(1)}, ${py.toFixed(1)}) 屬於 ${hit(m, 0, yy * D, x, py)} 根材`);
      }
    }
  }
});

test('各継手：完全拆開後，兩根材沒有任何重疊的點（不再互相穿插）', () => {
  for (const id of IDS) {
    const m = jointModel(id, 120), H = 60;
    for (const yy of [0.2, 0.45, 0.55, 0.8]) {
      for (let x = m.x0 - m.explodeDx - 5; x < m.x1 + m.explodeDx + 5; x += 4.3) for (let py = -H + 0.3; py < H; py += 5.1) {
        assert.ok(hit(m, 1, yy * 120, x, py) <= 1, `${id}: 拆開後 y=${yy}D (${x.toFixed(1)}, ${py}) 同時在兩根材內`);
      }
    }
  }
});

test('各継手：拆開量要大於榫頭長度，且每根材都有東西', () => {
  const o = jointModel('oikake', 120); assert.ok(o.explodeDx * 2 > o.x1 - o.x0 - 2 * 120 - 1e-9);   // 兩材相對退開量 ＞ 搭接長度
  const k = jointModel('kama', 120); assert.ok(k.explodeDx * 2 > 150 + 15);
  const a = jointModel('koshikake', 120); assert.ok(a.explodeDx * 2 > 60 + 15);
  for (const id of IDS) for (const mem of jointModel(id, 120).members) assert.ok(mem.pieces.every((pc) => pc.poly.length >= 4 && pc.y1 > pc.y0));
  assert.throws(() => jointModel('x', 120)); assert.throws(() => jointModel('kama', -1));
});

test('鎌継ぎ、腰掛蟻継ぎ：榫頭平面尺寸與文獻一致（材成 120）', () => {
  const k = jointModel('kama', 120), tongue = k.members[0].pieces[0].poly;
  const ys = tongue.map((p) => p[1]), xs = tongue.map((p) => p[0]);
  assert.equal(Math.max(...ys.filter((_, i) => xs[i] > 15)), 22.5);          // 頭端半寬 22.5 → 寬 45
  assert.equal(Math.max(...xs), 15 + 150);                                   // 肩 15 ＋ 鎌長 150
  assert.ok(tongue.some(([x, y]) => x === 15 + 75 && y === -15));            // 頸部寬 30、長 75
  const a = jointModel('koshikake', 120), t2 = a.members[0].pieces[0].poly;
  assert.equal(Math.max(...t2.map((p) => p[0])), 15 + 60);                   // 蟻長 60
  assert.equal(Math.max(...t2.filter((p) => p[0] > 15).map((p) => p[1])), 22.5);
  assert.ok(t2.some(([x, y]) => x === 15 && y === -15));                     // 頸寬 30
  assert.equal(a.members[1].pieces[1].poly[0][0], 0);                        // 母材下半從 xA=0 起（多伸出 15 當腰掛）
});
