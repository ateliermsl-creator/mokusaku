import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const css = read('css/style.css');

// ── 取出淺色與深色的色票 ──
function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2];
  return out;
}
const lightBlock = /:root \{([^}]*)\}/.exec(css)[1];
const darkBlock = /@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}/.exec(css)[1];
const light = tokens(lightBlock);
const dark = { ...light, ...tokens(darkBlock) };    // 深色沒覆寫的沿用淺色

function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// 文字色 on 底色：一般文字至少 4.5
const PAIRS = [
  ['ink', 'bg'], ['ink', 'surface'], ['ink', 'surface-2'],
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'], ['muted', 'hero'],
  ['accent', 'bg'], ['accent', 'surface'], ['accent', 'surface-2'], ['accent', 'hero'],
  ['accent-ink', 'accent'],
  ['bar-ink', 'bar'],
  ['ume', 'bg'], ['ume', 'surface'],
  ['bar', 'ume-soft'],            // 選取中的分頁：深色字 on 梅色底
];

for (const [name, P] of [['淺色', light], ['深色', dark]]) {
  test(`${name}：文字與底色的對比度 ≥ 4.5（WCAG AA）`, () => {
    for (const [fg, bg] of PAIRS) {
      assert.ok(P[fg] && P[bg], `${name}缺少色票 ${fg} 或 ${bg}`);
      const c = contrast(P[fg], P[bg]);
      assert.ok(c >= 4.5, `${name} ${fg}(${P[fg]}) on ${bg}(${P[bg]}) = ${c.toFixed(2)} < 4.5`);
    }
  });
}

test('三個令和色名都有對應的色票：櫻、堇（主色）、梅', () => {
  for (const k of ['sakura', 'accent', 'ume', 'ume-soft', 'hero', 'bar']) assert.ok(light[k], `缺少 ${k}`);
  // 主色是紫（藍分量 > 紅分量 > 綠分量），梅是偏紅的粉，櫻是淡粉
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = rgb(light.accent); assert.ok(ab > ag && ar > ag, '堇應為紫色');
  const [ur, ug, ub] = rgb(light.ume); assert.ok(ur > ub && ur > ug, '梅應偏紅');
  const [sr, sg, sb] = rgb(light.sakura); assert.ok(sr > 230 && sg > 170 && sb > 190, '櫻應為淡粉');
  assert.ok(lum(light.bg) > 0.9, '淺色底應很亮');
  assert.ok(lum(dark.bg) < 0.03, '深色底應很暗');
});

test('舊的木色主題不再殘留（樣式、網頁、manifest、圖示）', () => {
  const OLD = ['#8a4f1a', '#e0a45e', '#2a2118', '#f6f1e8', '#efe7d8', '#f1e6d2', '#d9a05b', '#1b1610'];
  for (const f of ['css/style.css', 'index.html', 'manifest.webmanifest', 'icons/icon.svg']) {
    const txt = read(f).toLowerCase();
    for (const hex of OLD) assert.ok(!txt.includes(hex), `${f} 仍含舊色 ${hex}`);
  }
});

test('瀏覽器與安裝後的主題色與標題列色一致', () => {
  const meta = /<meta name="theme-color" content="(#[0-9a-f]{6})"/i.exec(read('index.html'))[1].toLowerCase();
  const man = JSON.parse(read('manifest.webmanifest'));
  assert.equal(meta, light.bar.toLowerCase());
  assert.equal(man.theme_color.toLowerCase(), light.bar.toLowerCase());
  assert.equal(man.background_color.toLowerCase(), light.bar.toLowerCase());
  assert.ok(read('icons/icon.svg').includes(light.bar), '圖示底色應與標題列色一致');
});

test('色彩物語：只寫查得到的事實', () => {
  const html = read('index.html');
  const story = /<details class="panel reiwa"[\s\S]*?<\/details>/.exec(html)[0];
  assert.ok(story.includes('萬葉集') && story.includes('梅花之歌') && story.includes('大伴旅人') && story.includes('梅花之宴'));
  assert.ok(story.includes('初春令月，氣淑風和，梅披鏡前之粉，蘭薰珮後之香'));
  for (const w of ['櫻', '堇', '梅']) assert.ok(story.includes(w));
  assert.ok(story.includes('不是官方色票'), '要註明不是官方色票');
});

// ── 讀 PNG 像素（8-bit RGB/RGBA、非交錯）：確認手機桌面圖示也是新配色 ──
function pngPixel(buf, px, py) {
  assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], '不是 PNG');
  let off = 8, width, height, depth, ctype, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; assert.equal(data[12], 0, '不支援交錯 PNG'); }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  assert.equal(depth, 8); assert.ok(ctype === 2 || ctype === 6, `不支援的色彩型態 ${ctype}`);
  const bpp = ctype === 6 ? 4 : 3, stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat)), out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[y * stride + i - bpp] : 0, b = y ? out[(y - 1) * stride + i] : 0, c = i >= bpp && y ? out[(y - 1) * stride + i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + i] = v & 255;
    }
  }
  const o = py * stride + px * bpp;
  return '#' + [out[o], out[o + 1], out[o + 2]].map((x) => x.toString(16).padStart(2, '0')).join('');
}

test('手機桌面圖示（PNG）的底色是新的標題列色，且不是舊木色', () => {
  for (const f of ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']) {
    const corner = pngPixel(readFileSync(join(root, f)), 3, 3);
    assert.equal(corner.toLowerCase(), light.bar.toLowerCase(), `${f} 左上角像素 ${corner} 應為 ${light.bar}`);
  }
});

test('讀 PNG 的測試本身有效：能分辨不同顏色', () => {
  const png = readFileSync(join(root, 'icons/icon-512.png'));
  const center = pngPixel(png, 256, 330);              // 尺身中央偏下（淡粉的尺身）
  assert.notEqual(center.toLowerCase(), light.bar.toLowerCase(), '中央不該是底色，代表真的有讀到不同像素');
});
