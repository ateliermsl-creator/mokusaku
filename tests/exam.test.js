// 匠師備考：題庫格式、出處、出題邏輯，以及錯題本的資料儲存（資安：竄改的資料要被擋掉）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TERMS } from '../js/glossary.js';
import {
  LAW_QUESTIONS, termQuestions, buildQuiz, rng32, RULES, RULES_URL,
  sanitizeExam, recordAnswer, WRONG_MAX,
} from '../js/exam.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

function checkQuestion(q) {
  assert.ok(typeof q.id === 'string' && q.id, '要有 id');
  assert.ok(typeof q.q === 'string' && q.q.length > 4, `${q.id}: 題目太短`);
  assert.ok(['tf', 'mc'].includes(q.kind), `${q.id}: 題型`);
  assert.equal(q.opts.length, q.kind === 'tf' ? 2 : 4, `${q.id}: 選項數`);
  assert.equal(new Set(q.opts).size, q.opts.length, `${q.id}: 選項不可重複`);
  assert.ok(Number.isInteger(q.ans) && q.ans >= 0 && q.ans < q.opts.length, `${q.id}: 答案索引`);
  assert.ok(typeof q.src === 'string' && q.src.length > 4, `${q.id}: 一定要有出處`);
  assert.ok(['ok', 'check'].includes(q.status), `${q.id}: 狀態`);
}

test('法規題：22 題、id 不重複、每題附法規名稱與條號，且都標「待核對」', () => {
  assert.equal(LAW_QUESTIONS.length, 22);
  assert.equal(new Set(LAW_QUESTIONS.map((q) => q.id)).size, 22);
  for (const q of LAW_QUESTIONS) {
    checkQuestion(q);
    assert.match(q.src, /《(文化資產保存法|古蹟修復及再利用辦法)》（\d{3}\.\d{2}\.\d{2} 修正版） 第 \d+ 條/, `${q.id}: 出處要有法規名稱、版本日期與條號`);
    assert.equal(q.status, 'check', `${q.id}: 還沒逐字核對前一律是待核對`);
  }
});

test('名詞題：只用「已查證」且有出處的詞條，答案只出現一次，同一詞兩個方向', () => {
  const qs = termQuestions(TERMS, rng32(1));
  const v = TERMS.filter((t) => t.conf === 'v' && t.ja !== '—' && t.src);
  assert.ok(qs.length >= 2 * v.length - 4 && qs.length <= 2 * v.length, `題數 ${qs.length}，已查證 ${v.length}`);
  assert.equal(new Set(qs.map((q) => q.id)).size, qs.length, 'id 不重複');
  for (const q of qs) {
    checkQuestion(q);
    const [, dir, ja] = /^t-(ja|tw)-(.+)$/.exec(q.id);
    const t = TERMS.find((x) => x.ja === ja);
    assert.equal(t.conf, 'v', `${q.id}: 只能用已查證詞條`);
    assert.equal(q.src, t.src, '出處沿用名詞庫');
    assert.equal(q.opts[q.ans], dir === 'ja' ? t.tw[0] : t.ja);
    assert.equal(q.opts.filter((o) => o === q.opts[q.ans]).length, 1);
  }
  assert.ok(!termQuestions([TERMS.find((t) => t.conf === 'q')]).length, '待確認詞條不出題');
});

test('出題：題數上限、範圍篩選、錯題本只出錯過的題，同一個 seed 結果相同', () => {
  const all = [...LAW_QUESTIONS, ...termQuestions(TERMS, rng32(2))];
  const a = buildQuiz(all, { set: 'law', n: 10, rnd: rng32(5) });
  assert.equal(a.length, 10);
  assert.ok(a.every((q) => q.set === 'law'));
  assert.deepEqual(a.map((q) => q.id), buildQuiz(all, { set: 'law', n: 10, rnd: rng32(5) }).map((q) => q.id));
  assert.ok(buildQuiz(all, { set: 'term', n: 10 }).every((q) => q.set === 'term'));
  const w = buildQuiz(all, { set: 'wrong', n: 10, wrong: ['law03', 'law07', 'nope'] });
  assert.deepEqual(w.map((q) => q.id).sort(), ['law03', 'law07']);
  assert.equal(buildQuiz(all, { set: 'wrong', wrong: [] }).length, 0);
});

test('資安：錯題本讀取時擋掉竄改資料（型別、未知 id、__proto__、過長、重複）；舊版檢核表資料略過', () => {
  const known = new Set(['law01', 'law02', 't-ja-土台']);
  assert.deepEqual(sanitizeExam(null, known), { wrong: [] });
  assert.deepEqual(sanitizeExam('x', known), { wrong: [] });
  assert.deepEqual(sanitizeExam([1, 2], known), { wrong: [] });
  const evil = '<img src=x onerror=alert(1)>';
  const out = sanitizeExam({
    wrong: ['law01', 'law01', 5, null, {}, evil, '__proto__', 'law99', 'x'.repeat(200), 't-ja-土台'],
    done: ['d1a', 'd1a', 'zzz', evil, 3, 'd6c'],
  }, known);
  assert.deepEqual(out.wrong, ['law01', 't-ja-土台']);
  assert.deepEqual(Object.keys(out), ['wrong'], '舊版的檢核表（done）不再保留');
  const many = Array.from({ length: 1000 }, (_, i) => `q${i}`);
  assert.equal(sanitizeExam({ wrong: many }, new Set(many)).wrong.length, WRONG_MAX);
});

test('錯題本：答錯加入（最前面、不重複），答對移除', () => {
  let e = { wrong: [] };
  e = recordAnswer(e, 'law01', false);
  e = recordAnswer(e, 'law02', false);
  e = recordAnswer(e, 'law01', false);
  assert.deepEqual(e.wrong, ['law01', 'law02']);
  e = recordAnswer(e, 'law02', true);
  assert.deepEqual(e.wrong, ['law01']);
});

test('術科提醒：試場規則附條號與原文連結；讀書檢核已移除', () => {
  for (const r of RULES) assert.match(r.art, /^第 [\d、]+ 條$/);
  assert.match(RULES_URL, /^https:\/\/themefile\.culture\.tw\//);
  assert.ok(!/讀書檢核|STUDY|toggleDone/.test(read('js/exam.js') + read('js/exam-ui.js') + read('index.html')));
});

test('資安：備考介面不用 innerHTML；有首頁入口、頁面與路由', () => {
  const ui = read('js/exam-ui.js').replace(/^\s*\/\/.*$/gm, '');   // 註解不算
  assert.ok(!/innerHTML|insertAdjacentHTML|\bhtml:/.test(ui), 'exam-ui.js 一律用 textContent');
  assert.ok(/noopener noreferrer/.test(ui), '外部連結要有 noopener');
  const html = read('index.html'), app = read('js/app.js');
  assert.ok(html.includes('href="#/exam"') && html.includes('id="page-exam"') && html.includes('id="ex-root"'));
  assert.match(app, /const PAGES = \[[^\]]*'exam'/);
});
