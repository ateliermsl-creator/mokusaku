// 台尺混算的按鍵輸入：純函式，不碰 DOM。
//  applyKey(value, selStart, selEnd, key) → { value, caret } | null（按鍵被忽略）
//  softEval(src) → 輸入到一半也盡量算出前面已完成的部分，不吐出紅色錯誤
import { evalLength } from './units.js';

export const UNIT_KEYS = ['丈', '間', '尺', '寸', '分', '厘', 'mm', 'cm', 'm'];
const OPS = ['+', '−', '×', '÷'];
// 這幾種錯誤代表「還沒輸入完」，其餘（除以 0、無法辨識的字…）是真的有誤
const INCOMPLETE_ERRORS = ['算式有多餘的部分', '算式不完整', '缺少右括號 )'];
const OP_END = /[+−×÷]$/;
const OPEN_OR_OP_END = /[+−×÷(]$/;

export function applyKey(value, selStart = value.length, selEnd = selStart, key) {
  let before = value.slice(0, selStart);
  const after = value.slice(selEnd);
  let ins = '';
  const done = () => ({ value: before + ins + after, caret: (before + ins).length });
  const dropDot = () => { if (before.endsWith('.')) before = before.slice(0, -1); };
  const trimEnd = (s) => s.replace(/\s+$/, '');

  if (key === 'ac') return { value: '', caret: 0 };

  if (key === 'bs') {
    if (selStart !== selEnd) return { value: before + after, caret: before.length };
    const m = /( [+−×÷] |mm|cm|台尺|[\s\S])$/.exec(before);
    if (!m) return null;
    before = before.slice(0, before.length - m[0].length);
    return done();
  }

  if (/^[0-9]$/.test(key)) { ins = key; return done(); }

  if (key === '.') {
    const tail = /[\d.]*$/.exec(before)[0];
    if (tail.includes('.')) return null;     // 一個數字只能有一個小數點
    ins = tail ? '.' : '0.';
    return done();
  }

  if (UNIT_KEYS.includes(key)) {
    dropDot();
    if (!/\d$/.test(before)) return null;     // 單位只能接在數字後面
    ins = key;
    return done();
  }

  if (OPS.includes(key)) {
    const t = trimEnd(before);
    if (t === '' || /\($/.test(t)) {          // 開頭或左括號後面，只允許負號
      if (key !== '−') return null;
      before = t; ins = '−';
      return done();
    }
    if (OP_END.test(t)) {                     // 連按運算符 → 取代前一個
      const base = trimEnd(t.slice(0, -1));
      if (base === '' || /\($/.test(base)) return null; // 前一個其實是負號
      before = base; ins = ` ${key} `;
      return done();
    }
    dropDot();
    before = trimEnd(before); ins = ` ${key} `;
    return done();
  }

  if (key === '(') {
    const t = trimEnd(before);
    if (t === '' || OPEN_OR_OP_END.test(t)) { ins = '('; return done(); }
    dropDot(); before = trimEnd(before); ins = ' × (';   // 數字後面直接接左括號 = 相乘
    return done();
  }

  if (key === ')') {
    const open = (before.match(/\(/g) || []).length;
    const close = (before.match(/\)/g) || []).length;
    const t = trimEnd(before);
    if (open <= close || t === '' || OPEN_OR_OP_END.test(t)) return null;
    dropDot(); before = trimEnd(before); ins = ')';
    return done();
  }

  return null;
}

/**
 * 輸入到一半時的容錯計算。回傳：
 *   { empty:true }                         算式是空的
 *   { mm, partial, pending, dangling }     算得出來；partial = 只算了前面完成的部分
 *   { incomplete:true, pending, dangling } 還太早，不顯示錯誤
 *   { error }                              真的有誤
 */
export function softEval(src) {
  const s0 = String(src ?? '').replace(/\s+$/, '');
  if (!s0.trim()) return { empty: true };
  const closeParens = (x) => x + ')'.repeat(Math.max(0, (x.match(/\(/g) || []).length - (x.match(/\)/g) || []).length));
  const stripOps = (x) => x.replace(/[\s+\-−×÷*/(]+$/, '');
  const pending = /[\d.]$/.test(s0);                 // 結尾有數字，還沒選單位
  const dangling = /[+\-−×÷*/(]$/.test(s0);           // 結尾是運算符或左括號

  // 先看原本的錯誤是「還沒輸入完」還是「真的有誤」；真的有誤就直接回報，不容錯
  try {
    const mm = evalLength(s0);
    if (mm !== null) return { mm, partial: false, pending, dangling };
  } catch (e) {
    if (!INCOMPLETE_ERRORS.includes(e.message)) return { error: e };
  }
  const cands = [];
  const push = (x) => { if (x.trim()) cands.push(x); };
  push(closeParens(s0));
  const a = stripOps(s0); push(a); push(closeParens(a));
  if (pending) {
    const b = s0.replace(/[\d.]+$/, '');            // 去掉結尾還沒選單位的數字
    push(b); push(closeParens(b));
    const c = stripOps(b); push(c); push(closeParens(c));
  }
  for (const c of cands) {
    try {
      const mm = evalLength(c);
      if (mm !== null) return { mm, partial: true, pending, dangling };
    } catch { /* 試下一個 */ }
  }
  return { incomplete: true, pending, dangling };
}
