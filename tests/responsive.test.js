import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const html = read('index.html');
const css = read('css/style.css');

test('電腦版側欄：連結對應到實際存在的頁面', () => {
  const nav = /<nav id="sidenav"[\s\S]*?<\/nav>/.exec(html)[0];
  const pages = [...nav.matchAll(/data-nav="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(pages, ['home', 'calc', 'joint', 'glossary', 'exam']);
  for (const p of pages.filter((x) => x !== 'home')) assert.ok(html.includes(`id="page-${p}"`), `缺 page-${p}`);
});

test('側欄預設隱藏，只在 900px 以上顯示（手機版不受影響）', () => {
  assert.match(css, /#sidenav \{ display: none; \}/);
  assert.match(css, /@media \(min-width: 900px\)[\s\S]*#sidenav \{\s*display: flex/);
  assert.match(css, /@media \(min-width: 1280px\)/);
});

test('為雙欄新增的外框不改變手機版的順序，且原本的 id 都還在', () => {
  const mix = /<section id="tab-mix"[\s\S]*?<\/section>/.exec(html)[0];
  const order = ['calc-expr', 'calc-out', 'calc-hint', 'keypad', 'calc-save', 'mix-more', 'mix-fig', 'four-panel', 'history'];
  let last = -1;
  for (const id of order) { const i = mix.indexOf(`id="${id}"`); assert.ok(i > last, `${id} 順序不對`); last = i; }
  const jt = /<section id="page-joint"[\s\S]*?<\/section>/.exec(html)[0];
  let l2 = -1;
  for (const id of ['jt-d', 'jt-err', 'jt-vis', 'jt-fig', 'jt-3d', 'jt-table', 'jt-notes']) { const i = jt.indexOf(`id="${id}"`); assert.ok(i > l2, `${id} 順序不對`); l2 = i; }
});

test('版面變更沒有放寬 CSP', () => {
  const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  assert.ok(!/unsafe-eval|https?:/.test(csp));
  assert.match(csp, /script-src 'self'(;|$)/);
});
