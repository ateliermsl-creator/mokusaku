import test from 'node:test';
import assert from 'node:assert/strict';
import { applyKey, softEval } from '../js/keypad.js';
import { SHAKU_MM } from '../js/units.js';

// 依序按鍵，模擬游標一直在最後面
const press = (keys, start = '') => {
  let v = start;
  for (const k of keys) {
    const r = applyKey(v, v.length, v.length, k);
    if (r) v = r.value;
  }
  return v;
};
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('數字加單位：2 丈 5 寸', () => {
  assert.equal(press(['2', '丈', '5', '寸']), '2丈5寸');
  assert.equal(press(['1', '2', '0', 'mm']), '120mm');
});

test('運算符自動加空白，連按會取代', () => {
  assert.equal(press(['2', '丈', '+', '1', '2', '0', 'mm']), '2丈 + 120mm');
  assert.equal(press(['5', '+', '×']), '5 × ');          // 取代前一個
  assert.equal(press(['5', '+', '×', '÷', '−']), '5 − ');
  assert.equal(press(['+']), '');                        // 開頭不能放 +
  assert.equal(press(['−', '5']), '−5');                 // 開頭可以放負號
  assert.equal(press(['5', '+', '−']), '5 − ');          // 運算符後的 − 取代（不當負號）
});

test('單位只能接在數字後面', () => {
  assert.equal(press(['尺']), '');
  assert.equal(press(['2', '丈', '尺']), '2丈');         // 不能「丈尺」
  assert.equal(press(['2', '+', '尺']), '2 + ');
  assert.equal(press(['2', '.', '尺']), '2尺');          // 懸空的小數點會被去掉
});

test('小數點規則', () => {
  assert.equal(press(['.']), '0.');
  assert.equal(press(['2', '.', '5']), '2.5');
  assert.equal(press(['2', '.', '5', '.']), '2.5');      // 第二個小數點被忽略
  assert.equal(press(['2', '丈', '.', '5', '寸']), '2丈0.5寸');
  assert.equal(press(['2', '+', '.']), '2 + 0.');
});

test('括號', () => {
  assert.equal(press(['(', '2', '丈', '+', '3', '尺', ')']), '(2丈 + 3尺)');
  assert.equal(press([')']), '');                        // 沒有左括號不能放右括號
  assert.equal(press(['(', '2', ')', ')']), '(2)');
  assert.equal(press(['(', '+']), '(');                  // 左括號後不能放 +
  assert.equal(press(['2', '尺', '(']), '2尺 × (');      // 數字後接左括號 = 相乘
  assert.equal(press(['(', '(']), '((');
});

test('退格：運算符與 mm 整組刪除', () => {
  assert.equal(press(['2', '丈', '5', '寸', 'bs']), '2丈5');
  assert.equal(press(['5', '+', 'bs']), '5');            // ' + ' 整組刪
  assert.equal(press(['1', '2', 'mm', 'bs']), '12');     // mm 整組刪
  assert.equal(press(['bs']), '');
  assert.equal(press(['1', '2', 'bs', 'bs', 'bs']), '');
});

test('清除', () => {
  assert.equal(press(['1', '2', '丈', 'ac']), '');
});

test('在算式中間插入（游標不在最後）', () => {
  // 「2丈 + 120mm」游標在「丈」後面，插入 5 與 寸
  let r = applyKey('2丈 + 120mm', 2, 2, '5');
  assert.equal(r.value, '2丈5 + 120mm'); assert.equal(r.caret, 3);
  r = applyKey(r.value, r.caret, r.caret, '寸');
  assert.equal(r.value, '2丈5寸 + 120mm');
  // 選取一段後輸入會取代選取範圍
  r = applyKey('12345', 1, 4, '9');
  assert.equal(r.value, '195');
  r = applyKey('12345', 1, 4, 'bs');
  assert.equal(r.value, '15');
});

test('按鍵序列算出來的結果正確', () => {
  const v = press(['2', '丈', '5', '寸', '+', '1', '2', '0', 'mm']);
  close(softEval(v).mm, 20.5 * SHAKU_MM + 120);
  close(softEval(press(['3', '間', '2', '尺'])).mm, 20 * SHAKU_MM);
  close(softEval(press(['(', '1', '丈', '+', '2', '尺', ')', '×', '2'])).mm, 24 * SHAKU_MM); // (10+2)尺×2
});

test('輸入到一半：不報錯，算出前面完成的部分', () => {
  assert.equal(softEval('').empty, true);
  assert.equal(softEval('   ').empty, true);
  let r = softEval('2丈5');
  close(r.mm, 20 * SHAKU_MM); assert.ok(r.partial && r.pending);         // 2丈 = 20 尺；5 還沒選單位
  r = softEval('2丈 + ');
  close(r.mm, 20 * SHAKU_MM); assert.ok(r.partial && r.dangling);         // 等著輸入下一個數字
  r = softEval('(2丈 + 3尺');
  close(r.mm, 23 * SHAKU_MM); assert.ok(r.partial);                       // 括號還沒補完
  r = softEval('120');
  close(r.mm, 120); assert.ok(!r.partial && r.pending);                   // 單獨的數字當作 mm
  r = softEval('2丈 + 5');
  close(r.mm, 20 * SHAKU_MM + 5); assert.ok(!r.partial && r.pending);
  r = softEval('−'); assert.ok(r.incomplete);
  r = softEval('('); assert.ok(r.incomplete);
  r = softEval('2丈');
  close(r.mm, 20 * SHAKU_MM); assert.ok(!r.partial && !r.pending && !r.dangling);
});

test('真的有誤才回報錯誤', () => {
  assert.ok(softEval('3尺 abc').error);
  assert.ok(softEval('1尺 / 0').error);
  assert.ok(softEval('尺').error);
  assert.ok(softEval('1尺 / 0 ').error);                                // 除以 0 不被容錯吞掉
  assert.ok(softEval('2丈 + 3尺 abc').error);
});

test('裏目鍵：×√2、÷√2', () => {
  assert.equal(press(['3', '尺', '×√2']), '3尺 × √2');
  assert.equal(press(['3', '尺', '÷√2']), '3尺 ÷ √2');
  assert.equal(press(['×√2']), '');                     // 沒有前一個數字不能按
  assert.equal(press(['3', '+', '×√2']), '3 + ');
  assert.equal(press(['3', '尺', '×√2', 'bs']), '3尺 × ');   // √2 整組刪
  assert.equal(press(['3', '尺', '×√2', 'bs', 'bs']), '3尺');
  assert.equal(press(['(', '3', '尺', ')', '×√2']), '(3尺) × √2');
  close(softEval('3尺 × √2').mm, 3 * SHAKU_MM * Math.SQRT2);
  close(softEval('1間 ÷ √2').mm, 6 * SHAKU_MM / Math.SQRT2);
  const r = softEval('3尺 × √2');
  assert.ok(!r.pending && !r.partial, '√2 結尾不算「還沒選單位的數字」');
});
test('厘、cm、m 單位鍵', () => {
  assert.equal(press(['5', '厘']), '5厘');
  assert.equal(press(['2', '0', 'cm']), '20cm');
  assert.equal(press(['1', 'm']), '1m');
});
