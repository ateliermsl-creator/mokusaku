import test from 'node:test';
import assert from 'node:assert/strict';
import { JOINTS, jointSpec, jointFigure, DEFAULT_D } from '../js/joints.js';
import { TERMS } from '../js/glossary.js';
import { textWidth } from '../js/figures.js';

const spec = (id, D = 120) => Object.fromEntries(jointSpec(id, D).map((p) => [p.label, p]));

test('材成 120 mm 時，各部尺寸與文獻圖 17 標註一致', () => {
  const o = spec('oikake');
  assert.equal(o['兩端各留'].mm, 15);
  assert.deepEqual(o['継手全長（肩到肩）'].range, [360, 420]);
  assert.equal(o['較小的方栓（邊長）'].mm, 15);
  assert.equal(o['較大的方栓（邊長）'].mm, 18);
  const k = spec('kama');
  assert.equal(k['端留'].mm, 15); assert.equal(k['鎌全長'].mm, 150); assert.equal(k['頸部寬'].mm, 30);
  assert.equal(k['頭端加寬（每側）'].mm, 7.5); assert.equal(k['頭端寬'].mm, 45);
  const a = spec('koshikake');
  assert.equal(a['蟻長（榫頭長）'].mm, 60); assert.equal(a['頸部寬'].mm, 30);
  assert.equal(a['頭端寬'].mm, 45); assert.equal(a['腰掛深'].mm, 15);
});

test('尺寸隨材成等比例縮放', () => {
  const s1 = jointSpec('kama', 120), s2 = jointSpec('kama', 240);
  s1.forEach((p, i) => { if (p.mm) assert.ok(Math.abs(s2[i].mm - p.mm * 2) < 1e-9); });
  assert.equal(spec('koshikake', 121.2)['頭端寬'].mm, 0.375 * 121.2);
  assert.throws(() => jointSpec('kama', 0)); assert.throws(() => jointSpec('kama', NaN)); assert.throws(() => jointSpec('x', 120));
});

test('頭端寬 ＝ 頸寬 ＋ 兩側加寬（鎌継ぎ、腰掛蟻継ぎ）', () => {
  const k = spec('kama'); assert.equal(k['頭端寬'].mm, k['頸部寬'].mm + 2 * k['頭端加寬（每側）'].mm);
  const a = spec('koshikake'); assert.equal(a['頭端寬'].mm, a['頸部寬'].mm + 2 * 7.5);
});

test('每個継手都對應詞庫的已查證詞條，台灣用語與文獻一致', () => {
  const tw = { oikake: '犁壁榫', kama: '蛇頭榫', koshikake: '燕尾榫' };
  for (const j of JOINTS) {
    const t = TERMS.find((x) => x.cat === j.ref[0] && x.ja === j.ref[1]);
    assert.ok(t, `${j.id}: 找不到詞條`);
    assert.equal(t.tw[0], tw[j.id]); assert.equal(t.conf, 'v');
    assert.ok(t.links.some((l) => l.href === `#/joint/${j.id}`), `${j.id}: 詞條要連到比例速查`);
  }
});

const num = (s, name) => { const m = new RegExp(`\\b${name}="(-?[\\d.]+)"`).exec(s); return m ? parseFloat(m[1]) : null; };
test('示意圖：沒有 NaN、圖形與文字都在畫面內（各種材成）', () => {
  for (const j of JOINTS) for (const D of [DEFAULT_D, 30, 90.9, 121.2, 450]) {
    const html = jointFigure(j.id, D);
    assert.ok(html.startsWith('<figure') && !/NaN|undefined|Infinity|null/.test(html), `${j.id}/${D}`);
    const [, VW, VH] = /viewBox="0 0 (\d+) (\d+)"/.exec(html).map(Number);
    for (const m of html.matchAll(/<(line|rect|polyline|polygon)\b([^>]*?)\/?>/g)) {
      const [, tag, at] = m;
      const pts = tag === 'line' ? [[num(at, 'x1'), num(at, 'y1')], [num(at, 'x2'), num(at, 'y2')]]
        : tag === 'rect' ? [[num(at, 'x'), num(at, 'y')], [num(at, 'x') + num(at, 'width'), num(at, 'y') + num(at, 'height')]]
          : /points="([^"]+)"/.exec(at)[1].split(' ').map((p) => p.split(',').map(Number));
      for (const [x, y] of pts) assert.ok(x >= -1 && x <= VW + 1 && y >= -1 && y <= VH + 1, `${j.id}/${D}: ${tag} (${x},${y}) 超出 ${VW}x${VH}`);
    }
    for (const m of html.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
      const x = num(m[1], 'x'), y = num(m[1], 'y'), a = /text-anchor="(\w+)"/.exec(m[1])[1], w = textWidth(m[2]);
      const l = a === 'middle' ? x - w / 2 : a === 'end' ? x - w : x;
      assert.ok(l >= -1 && l + w <= VW + 1 && y >= 0 && y <= VH + 1, `${j.id}/${D}: 文字「${m[2]}」跑出畫面`);
    }
  }
});

test('圖上寫出的尺寸文字與表格一致', () => {
  assert.ok(jointFigure('oikake', 120).includes('D（材成）＝ 120 mm'));
  assert.ok(jointFigure('kama', 120).includes('1¼D＝150'));
  assert.ok(jointFigure('koshikake', 240).includes('3/8D＝90'));
});
