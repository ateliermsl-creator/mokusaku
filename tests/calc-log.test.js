// 計算紀錄與設定（資料儲存）：被竄改或格式不對的資料要被擋掉
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLog, addLog, sanitizePrefs, LOG_MAX } from '../js/calc-log.js';

const ok = (o = {}) => ({ tool: 'kouko', title: '勾股玄', sum: '殳 1820 mm・4 寸', res: '玄 1960.2 mm', ts: 1, inp: { 'ko-den': '1820', 'ko-n': '4' }, ...o });

test('計算紀錄：只留認得的工具與文字欄位，輸入欄位 id 要符合格式', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const out = sanitizeLog([
    ok(), ok({ tool: 'evil' }), ok({ ts: 'x' }), ok({ title: '' }), null, 'str', 5,
    ok({ inp: { 'ko-den': 123, '__proto__': 'x', 'bad id': '1', 'ko-n': evil, 'yn-b': 'a'.repeat(500) }, res: 'r'.repeat(500), title: evil }),
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].inp, { 'ko-den': '1820', 'ko-n': '4' });
  assert.deepEqual(Object.keys(out[1].inp).sort(), ['ko-n', 'yn-b']);
  assert.equal(out[1].inp['yn-b'].length, 200); assert.equal(out[1].res.length, 120);
  assert.equal(out[1].title, evil.slice(0, 40), '文字原樣保留（顯示時用 textContent，不會被當成 HTML）');
  assert.deepEqual(sanitizeLog('nope'), []);
});

test('計算紀錄：新的在前、同樣輸入會取代、最多 100 筆', () => {
  let list = [];
  for (let i = 0; i < 130; i++) list = addLog(list, ok({ ts: i + 1, inp: { 'ko-den': String(i) } }));
  assert.equal(list.length, LOG_MAX);
  assert.equal(list[0].inp['ko-den'], '129');
  assert.equal(list.at(-1).inp['ko-den'], '30', '超過上限從最舊的開始刪');
  const again = addLog(list, ok({ ts: 999, inp: { 'ko-den': '129' } }));
  assert.equal(again.length, LOG_MAX); assert.equal(again[0].ts, 999);
  assert.equal(again.filter((x) => x.inp['ko-den'] === '129').length, 1, '同樣輸入只留一筆');
  assert.equal(addLog(list, { tool: 'bad' }), list, '不合格的不加入');
});

test('設定：小數位與角度格式只接受合法值', () => {
  assert.deepEqual(sanitizePrefs(null), { dec: 1, ang: 'deg' });
  assert.deepEqual(sanitizePrefs({ dec: 2, ang: 'dms' }), { dec: 2, ang: 'dms' });
  assert.deepEqual(sanitizePrefs({ dec: '2', ang: '<x>' }), { dec: 1, ang: 'deg' });
});
