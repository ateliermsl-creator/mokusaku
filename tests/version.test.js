import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
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
    for (const m of read(file).matchAll(/from\s+'(\.[^']+)'/g)) walk(normalize(join(dirname(file), m[1])).replaceAll('\\', '/'));
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

test('不放版權聲明頁尾', () => {
  const html = read('index.html');
  assert.ok(!html.includes('id="copyright"') && !html.includes('版權所有') && !html.includes('logo-wenzi'));
  assert.ok(!existsSync(join(root, 'icons/logo-wenzi.png')));
});

test('App 名稱統一為「柴柴木作」（網頁標題、桌面名稱、manifest）', () => {
  const html = read('index.html'), man = JSON.parse(read('manifest.webmanifest'));
  assert.equal(man.name, '柴柴木作'); assert.equal(man.short_name, '柴柴木作');
  assert.ok(/<title>柴柴木作/.test(html) && html.includes('apple-mobile-web-app-title" content="柴柴木作"'));
  assert.ok(html.includes('<h1>柴柴木作</h1>') && html.includes('id="topTitle">柴柴木作<'));
  assert.ok(!/<title>日式大木作工具箱/.test(html));
});

test('分享預覽（LINE／Facebook）：有 og 標籤，圖片是完整網址且檔案存在、為 1200×630', () => {
  const html = read('index.html');
  const get = (p) => new RegExp(`<meta property="${p}" content="([^"]+)"`).exec(html)?.[1];
  assert.equal(get('og:title'), '柴柴木作｜日式大木作工具箱');
  const img = get('og:image');
  assert.match(img, /^https:\/\/ateliermsl-creator\.github\.io\/mokusaku\/icons\/og-image\.png$/);
  const buf = readFileSync(join(root, 'icons/og-image.png'));
  assert.equal(buf.readUInt32BE(16), 1200); assert.equal(buf.readUInt32BE(20), 630);
  assert.ok(buf.length < 600 * 1024, '預覽圖不要太大（LINE 抓圖有大小限制）');
});

test('安全：有內容安全政策（CSP），不允許 eval 與外部來源；外部連結都有 noopener', () => {
  const html = read('index.html');
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];
  assert.ok(csp, '缺少 CSP');
  for (const need of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "connect-src 'self'"]) assert.ok(csp.includes(need), `CSP 缺少 ${need}`);
  assert.ok(!/unsafe-eval|unsafe-inline.*script-src|https?:\/\//.test(csp.replace(/style-src[^;]*;/, '')), 'CSP 不該允許 eval、行內腳本或外部網址');
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'index.html 不該有行內 <script>');
  assert.ok(!/\son(click|error|load|input|change)=/i.test(html), 'index.html 不該有行內事件屬性');
});

test('安全：程式裡沒有 eval／new Function，也沒有對外連線', async () => {
  const { readdirSync } = await import('node:fs');
  for (const f of readdirSync(join(root, 'js')).filter((x) => x.endsWith('.js'))) {
    const src = read(`js/${f}`);
    assert.ok(!/\beval\s*\(|new Function\s*\(/.test(src), `${f}: 不該用 eval／new Function`);
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|window\.open/.test(src), `${f}: 不該有對外連線或開新視窗的呼叫`);
  }
  for (const m of read('sw.js').matchAll(/https?:\/\/[^\s'"`]+/g)) assert.fail(`sw.js 不該有外部網址：${m[0]}`);
});

test('木作計算機的欄位都不跳手機鍵盤：一律 inputmode="none"，長度用台尺按鍵、純數字用數字按鍵', () => {
  const html = read('index.html');
  const calc = html.slice(html.indexOf('<section id="page-calc"'), html.indexOf('</section><!-- /page-calc -->'));
  const inputs = [...calc.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(inputs.length > 20);
  for (const tag of inputs) {
    const id = /id="([^"]+)"/.exec(tag)?.[1];
    assert.ok(!/type="number"/.test(tag), `${id}：不要用 type="number"（會跳手機鍵盤）`);
    assert.ok(/inputmode="none"/.test(tag), `${id}：要設 inputmode="none"`);
    assert.ok(/class="[^"]*\b(len|num)\b/.test(tag), `${id}：要是 len（台尺按鍵）或 num（數字按鍵）`);
  }
  assert.ok(!/inputMode = /.test(read('js/calc-ui.js')), 'calc-ui.js 不可把欄位改回手機鍵盤');
});
