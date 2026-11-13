// 易用性（v40）：錯題間隔複習、做到一半接續、最近用過的值、沒寫單位提醒、戶外模式配色、按鈕大小
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INTERVALS, REVIEW_MAX, dayNum, sanitizeReview, answerReview, dueIds, nextDue, sanitizeSession,
} from '../js/review.js';
import { sanitizeRecent, pushRecent, RECENT_MAX } from '../js/recent.js';
import { lacksUnit } from '../js/units.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const known = new Set(['law01', 'law02', 'law03', 't-ja-土台']);

test('間隔複習：答錯隔 1 天、答對後 3 天、再 7 天，連續答對 3 次才移出', () => {
  assert.deepEqual(INTERVALS, [1, 3, 7]);
  const D = 20000;
  let r = answerReview([], 'law01', false, D);
  assert.deepEqual(r, [['law01', 0, D + 1]]);
  assert.deepEqual(dueIds(r, D), [], '答錯當天不會馬上又出');
  assert.equal(answerReview(r, 'law01', true, D), r, '還沒到期先答對：不推進');
  r = answerReview(r, 'law01', true, D + 1);
  assert.deepEqual(r, [['law01', 1, D + 4]]);
  r = answerReview(r, 'law01', true, D + 4);
  assert.deepEqual(r, [['law01', 2, D + 11]]);
  r = answerReview(r, 'law01', true, D + 11);
  assert.deepEqual(r, [], '第 3 次答對移出');
});

test('間隔複習：中途答錯從頭算；不在錯題本的題目答對不會被加入；到期與下一批日期', () => {
  const D = 20000;
  let r = [['law01', 2, D], ['law02', 1, D + 5]];
  r = answerReview(r, 'law01', false, D);
  assert.deepEqual(r[0], ['law01', 0, D + 1]);
  assert.equal(answerReview(r, 'law03', true, D), r);
  assert.deepEqual(dueIds([['a', 0, D], ['b', 0, D + 1], ['c', 1, D - 3]], D), ['a', 'c']);
  assert.equal(nextDue([['a', 0, D + 2], ['b', 0, D + 1]]), D + 1);
  assert.equal(nextDue([]), null);
  const many = Array.from({ length: REVIEW_MAX + 5 }, (_, i) => [`q${i}`, 0, D]);
  assert.equal(answerReview(many, 'new', false, D).length, REVIEW_MAX);
});

test('dayNum：同一天同一個數字，隔天加 1', () => {
  const a = new Date(2026, 10, 13, 0, 5), b = new Date(2026, 10, 13, 23, 55), c = new Date(2026, 10, 14, 0, 5);
  assert.equal(dayNum(a), dayNum(b));
  assert.equal(dayNum(c), dayNum(a) + 1);
});

test('資安：複習資料讀取時擋掉竄改內容（型別、未知 id、__proto__、階段與日期超出範圍、重複）', () => {
  assert.deepEqual(sanitizeReview(null, known), []);
  assert.deepEqual(sanitizeReview({ law01: [0, 1] }, known), []);
  const evil = '<img src=x onerror=alert(1)>';
  const out = sanitizeReview([
    ['law01', 0, 100], ['law01', 1, 100], ['__proto__', 0, 1], [evil, 0, 1], ['law02', 3, 1], ['law02', -1, 1],
    ['law02', 1.5, 1], ['law02', 1, -1], ['law02', 1, 1e9], ['law02', '1', 1], 'law03', ['law03', 2, 50, 'x'], ['t-ja-土台', 2, 50],
  ], known);
  assert.deepEqual(out, [['law01', 0, 100], ['t-ja-土台', 2, 50]]);
  const many = Array.from({ length: 1000 }, (_, i) => [`q${i}`, 0, 1]);
  assert.equal(sanitizeReview(many, new Set(many.map((e) => e[0]))).length, REVIEW_MAX);
});

test('舊版錯題本（只有 id）搬進間隔複習：當作今天到期，已存在的不重複', () => {
  const out = sanitizeReview([['law01', 1, 5]], known, { legacy: ['law01', 'law02', 'nope', 7, '__proto__'], today: 99 });
  assert.deepEqual(out, [['law01', 1, 5], ['law02', 0, 99]]);
});

test('做到一半接續：存檔要合法才接；已作答的那題直接跳下一題；做完就不接', () => {
  const ids = ['law01', 'law02', 'law03'];
  assert.deepEqual(sanitizeSession({ set: 'law', ids, i: 1, score: 1, a: false }, known), { set: 'law', ids, i: 1, score: 1 });
  assert.deepEqual(sanitizeSession({ set: 'law', ids, i: 1, score: 2, a: true }, known), { set: 'law', ids, i: 2, score: 2 });
  assert.equal(sanitizeSession({ set: 'law', ids, i: 2, score: 2, a: true }, known), null, '最後一題答完＝做完');
  for (const bad of [null, 'x', [], { set: 'evil', ids, i: 0, score: 0 }, { set: 'law', ids: [], i: 0, score: 0 },
    { set: 'law', ids: ['law01', 'nope'], i: 0, score: 0 }, { set: 'law', ids: ['law01', 'law01'], i: 0, score: 0 },
    { set: 'law', ids, i: -1, score: 0 }, { set: 'law', ids, i: 0.5, score: 0 }, { set: 'law', ids, i: 1, score: 5 },
    { set: 'law', ids, i: 9, score: 0 }, { set: 'law', ids: Array(21).fill('law01'), i: 0, score: 0 }]) {
    assert.equal(sanitizeSession(bad, known), null, JSON.stringify(bad));
  }
});

test('最近用過的值：放最前面、不重複、最多 4 個；讀取時擋掉竄改內容', () => {
  let r = {};
  for (const v of ['6尺', '4間', '6尺', '1尺5寸', '3間', '2丈']) r = pushRecent(r, 'len', v);
  assert.deepEqual(r.len, ['2丈', '3間', '1尺5寸', '6尺']);
  assert.equal(RECENT_MAX, 4);
  assert.equal(pushRecent(r, '__proto__', '1'), r);
  assert.equal(pushRecent(r, 'len', ''), r);
  assert.equal(pushRecent(r, 'len', 'x'.repeat(41)), r);
  assert.deepEqual(sanitizeRecent(null), {});
  assert.deepEqual(sanitizeRecent(['6尺']), {});
  const s = sanitizeRecent({ len: ['6尺', 6, null, '6尺', ' 4間 ', 'x'.repeat(99), 'a', 'b', 'c'], '__proto__': ['1'], 'Bad Key': ['1'], 'sl-kobai': 'x', 'ko-n': ['4'] });
  assert.deepEqual(s, { len: ['6尺', '4間', 'a', 'b'], 'ko-n': ['4'] });
  assert.equal(Object.getPrototypeOf(s), Object.prototype);
});

test('沒寫單位提醒：只有數字、沒有任何單位時才提醒', () => {
  for (const v of ['6', '6+3', ' 1200 ', '６']) assert.equal(lacksUnit(v), true, v);
  for (const v of ['', '  ', '6尺', '6 mm', '2丈5寸', '3間+200', '6尺*2', '尺', '6??']) assert.equal(lacksUnit(v), false, v);
});

// ── 戶外模式配色：文字對比要 ≥ 7（WCAG AAA），比一般模式更嚴 ──
function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('戶外模式：文字與底色對比 ≥ 7，圖形色塊 ≥ 4.5', () => {
  const block = /:root\.outdoor \{([^}]*)\}/.exec(css);
  assert.ok(block, '要有 :root.outdoor 色票');
  const P = {};
  for (const m of block[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) P[m[1]] = m[2];
  for (const [fg, bg] of [['ink', 'bg'], ['ink', 'surface-2'], ['muted', 'bg'], ['muted', 'surface-2'], ['accent', 'bg'], ['accent', 'surface-2'],
    ['accent-2', 'bg'], ['accent-ink', 'accent'], ['bar-ink', 'bar'], ['on-highlight', 'highlight'], ['err', 'bg']]) {
    const c = contrast(P[fg], P[bg]);
    assert.ok(c >= 7, `${fg} on ${bg} = ${c.toFixed(2)} < 7`);
  }
  for (const k of ['s0', 's1', 's2', 's3', 'fig-line']) assert.ok(contrast(P[k], P.surface) >= 4.5, k);
});

test('深色模式的規則都排除戶外模式（戶外一律用淺色）', () => {
  const blocks = [...css.matchAll(/@media \(prefers-color-scheme: dark\) \{([\s\S]*?\})\s*\}/g)];
  assert.ok(blocks.length >= 8);
  for (const [, body] of blocks) {
    for (const m of body.matchAll(/([^{}]+)\{/g)) {
      for (const sel of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
        assert.ok(sel.startsWith('html:not(.outdoor)') || sel.startsWith(':root:not(.outdoor)'), `深色規則沒有排除戶外模式：${sel}`);
      }
    }
  }
});

test('按鈕大小：常用的小按鈕、輸入面板按鍵、下一題都至少 48px', () => {
  const tail = css.slice(css.indexOf('易用性（v40）'));
  assert.match(tail, /\.chip, \.btnlink, \.sec, \.sheet-done, \.hint button \{ min-height: 48px; \}/);
  assert.match(tail, /\.sheet \.keypad \.k \{ min-height: 48px; \}/);
  assert.match(tail, /\.linkbtn \{[^}]*min-height: 48px/);
  assert.match(tail, /\.ex-next \{[^}]*min-height: 56px/);
  assert.match(tail, /\.ex-nextbar \{[^}]*position: fixed;[^}]*bottom: 0/);
});
