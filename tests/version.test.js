import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');

test('sw.js、app.js、index.html 的版本號一致', () => {
  const sw = /const VERSION = (\d+);/.exec(read('sw.js'))[1];
  const app = /const VERSION = '(\d+)';/.exec(read('js/app.js'))[1];
  const html = /<html[^>]*data-v="(\d+)"/.exec(read('index.html'))[1];
  assert.equal(app, sw, 'js/app.js 的 VERSION 要和 sw.js 一致');
  assert.equal(html, sw, 'index.html 的 data-v 要和 sw.js 一致');
});

test('sw.js 的 ASSETS 檔案都存在', () => {
  const list = /const ASSETS = \[([\s\S]*?)\];/.exec(read('sw.js'))[1];
  const assets = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(assets.length > 10);
  for (const a of assets) if (a !== './') assert.ok(existsSync(join(root, a)), `ASSETS 裡的 ${a} 不存在`);
});

test('app.js 直接或間接匯入的檔案都在 ASSETS 裡（否則離線時會壞）', () => {
  const list = /const ASSETS = \[([\s\S]*?)\];/.exec(read('sw.js'))[1];
  const assets = new Set([...list.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of read(file).matchAll(/from\s+'(\.[^']+)'/g)) walk(normalize(join(dirname(file), m[1])));
  };
  walk('js/app.js');
  assert.ok(seen.size >= 6);
  for (const f of seen) assert.ok(assets.has(f), `${f} 被匯入但不在 sw.js 的 ASSETS 裡`);
});

test('index.html 引用的本地檔案都在 ASSETS 裡', () => {
  const list = /const ASSETS = \[([\s\S]*?)\];/.exec(read('sw.js'))[1];
  const assets = new Set([...list.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const html = read('index.html');
  for (const m of html.matchAll(/(?:href|src)="([^"#:]+\.[a-z0-9]+)"/gi)) assert.ok(assets.has(m[1]), `${m[1]} 不在 ASSETS 裡`);
});

test('首頁不放「最新更新」：沒有面板、沒有更新紀錄檔、不在離線清單', () => {
  const html = read('index.html');
  assert.ok(!html.includes('最新更新') && !html.includes('id="updates"'));
  assert.ok(!existsSync(join(root, 'updates.json')), 'updates.json 應已移除');
  assert.ok(!read('sw.js').includes('updates.json'));
  assert.ok(!/updates\.json|updBody|updDate/.test(read('js/app.js')));
});

test('js/、lib/ 底下的每個檔案都在 ASSETS 裡（動態 import 的檔案也要能離線）', async () => {
  const { readdirSync } = await import('node:fs');
  const list = /const ASSETS = \[([\s\S]*?)\];/.exec(read('sw.js'))[1];
  const assets = new Set([...list.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  for (const dir of ['js', 'lib']) for (const f of readdirSync(join(root, dir))) {
    if (f.endsWith('.js')) assert.ok(assets.has(`${dir}/${f}`), `${dir}/${f} 不在 sw.js 的 ASSETS 裡`);
  }
});
