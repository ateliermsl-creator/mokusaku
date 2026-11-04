import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const MASCOT_ORANGE = '#fdc672';     // 吉祥物圖示的底色（253,198,114）
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
  ['ink', 'bg'], ['ink', 'surface'], ['ink', 'surface-2'], ['ink', 'hero'],
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'], ['muted', 'hero'],
  ['accent', 'bg'], ['accent', 'surface'], ['accent', 'surface-2'], ['accent', 'hero'],
  ['accent-ink', 'accent'],
  ['accent-2', 'bg'], ['accent-2', 'surface'], ['accent-2', 'surface-2'], ['accent-2', 'hero'],
  ['bar-ink', 'bar'],
  ['on-highlight', 'highlight'],     // 選取中的分頁
];

for (const [name, P] of [['淺色', light], ['深色', dark]]) {
  test(`${name}：文字與底色的對比度 ≥ 4.5（WCAG AA）`, () => {
    for (const [fg, bg] of PAIRS) {
      assert.ok(P[fg] && P[bg], `${name}缺少色票 ${fg} 或 ${bg}`);
      const c = contrast(P[fg], P[bg]);
      assert.ok(c >= 4.5, `${name} ${fg}(${P[fg]}) on ${bg}(${P[bg]}) = ${c.toFixed(2)} < 4.5`);
    }
  });
  test(`${name}：圖形色塊（組成條、圖示線條）對底色 ≥ 3`, () => {
    for (const k of ['s0', 's1', 's2', 's3', 'fig-line']) {
      const c = contrast(P[k], P.surface);
      assert.ok(c >= 3, `${name} ${k}(${P[k]}) on surface(${P.surface}) = ${c.toFixed(2)} < 3`);
    }
  });
}

// 半透明文字：把前景色以不透明度疊在底色上，再算對比度
const blend = (fg, bg, a) => '#' + [1, 3, 5].map((i) => Math.round(a * parseInt(fg.slice(i, i + 2), 16) + (1 - a) * parseInt(bg.slice(i, i + 2), 16)).toString(16).padStart(2, '0')).join('');
const opacityOf = (re) => parseFloat(re.exec(css)[1]);
for (const [name, P] of [['淺色', light], ['深色', dark]]) {
  test(`${name}：標題列與分頁列上的半透明日文輔助小字，對比度 ≥ 4.5`, () => {
    const topbar = opacityOf(/#topbar \.jp \{[^}]*opacity: ([\d.]+)/);
    const tab = opacityOf(/#subtabs a \.jp \{[^}]*opacity: ([\d.]+)/);
    const tabOn = opacityOf(/#subtabs a\[aria-current="page"\] \.jp \{[^}]*opacity: ([\d.]+)/);
    // 分頁底色是白色半透明疊在標題列上（.10），用標題列色近似
    const checks = [
      ['標題上的小字', blend(P['bar-ink'], P.bar, topbar), P.bar],
      ['分頁小字', blend(P['bar-ink'], P.bar, tab), P.bar],
      ['選取分頁小字', blend(P['on-highlight'], P.highlight, tabOn), P.highlight],
    ];
    for (const [label, fg, bg] of checks) {
      const c = contrast(fg, bg);
      assert.ok(c >= 4.5, `${name} ${label} ${fg} on ${bg} = ${c.toFixed(2)} < 4.5`);
    }
  });
}

test('三個原色與配色表一致（#b5a199、#e3e0ca、#c6cbd0）', () => {
  assert.equal(light.mauve.toLowerCase(), '#b5a199');
  assert.equal(light.cream.toLowerCase(), '#e3e0ca');
  assert.equal(light.mist.toLowerCase(), '#c6cbd0');
  // 原色確實有被用到：選取狀態＝玫瑰褐、首頁標題區＝米黃、深色模式的次要強調＝藍灰
  assert.equal(light.highlight.toLowerCase(), light.mauve.toLowerCase());
  assert.equal(light.hero.toLowerCase(), light.cream.toLowerCase());
  assert.equal(dark['accent-2'].toLowerCase(), light.mist.toLowerCase());
  assert.equal(dark.accent.toLowerCase(), light.mauve.toLowerCase());
});

test('色彩關係：主色是調暗的玫瑰褐、標題列是調暗的藍灰、底色是調亮的米黃', () => {
  const hue = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return ((x * 60) + 360) % 360; };
  assert.ok(lum(light.accent) < lum(light.mauve), '主色要比原色暗');
  assert.ok(Math.abs(hue(light.accent) - hue(light.mauve)) < 25, '主色色相要接近玫瑰褐');
  assert.ok(lum(light.bar) < lum(light.mist), '標題列要比藍灰原色暗');
  assert.ok(Math.abs(hue(light.bar) - hue(light.mist)) < 25, '標題列色相要接近藍灰');
  assert.ok(lum(light.bg) > lum(light.cream), '頁面底色要比米黃原色亮');
  assert.ok(Math.abs(hue(light.bg) - hue(light.cream)) < 25, '底色色相要接近米黃');
  assert.ok(lum(dark.bg) < 0.03 && lum(light.bg) > 0.85, '淺色底很亮、深色底很暗');
});

test('舊的主題色不再殘留（木色、令和紫粉）', () => {
  const OLD = ['#8a4f1a', '#e0a45e', '#2a2118', '#f6f1e8', '#efe7d8', '#f1e6d2', '#d9a05b', '#1b1610',
    '#5f3f99', '#38284f', '#fbf5f7', '#f3a6bb', '#b83a63', '#f6c3d1', '#f9e1e8', '#c9afee', '#17121d', '#ee8aa8'];
  for (const f of ['css/style.css', 'index.html', 'manifest.webmanifest']) {
    const txt = read(f).toLowerCase();
    for (const hex of OLD) assert.ok(!txt.includes(hex), `${f} 仍含舊色 ${hex}`);
  }
  assert.ok(!/--ume|--sakura|reiwa|令和/.test(css + read('index.html')), '令和三色的名稱與樣式不應殘留');
});

test('瀏覽器與安裝後的主題色與標題列色一致', () => {
  const meta = /<meta name="theme-color" content="(#[0-9a-f]{6})"/i.exec(read('index.html'))[1].toLowerCase();
  const man = JSON.parse(read('manifest.webmanifest'));
  // 手機狀態列／安裝後的標題列／啟動畫面用吉祥物圖示的橘色底（與網站內部三色配色各自獨立）
  assert.equal(meta, MASCOT_ORANGE);
  assert.equal(man.theme_color.toLowerCase(), MASCOT_ORANGE);
  assert.equal(man.background_color.toLowerCase(), MASCOT_ORANGE);
});

test('首頁不放配色說明卡片', () => {
  const html = read('index.html');
  assert.ok(!html.includes('palette') && !html.includes('本站配色'));
  assert.ok(!/\.palette|\.r-list|\.r-lead/.test(css));
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

// 圖示是吉祥物插圖（橘色底），與網站三色配色各自獨立；這裡只檢查尺寸、透明度與四角
function pngInfo(buf) {
  assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], '不是 PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), ctype: buf[25] };
}
function pngAlpha(buf, px, py) {
  const { w, h, ctype } = pngInfo(buf);
  assert.equal(ctype, 6, '需要 RGBA');
  let off = 8, idat = [];
  while (off < buf.length) { const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8); if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len)); off += 12 + len; }
  const stride = w * 4, raw = inflateSync(Buffer.concat(idat)), out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? out[y * stride + i - 4] : 0, b = y ? out[(y - 1) * stride + i] : 0, c = i >= 4 && y ? out[(y - 1) * stride + i - 4] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + i] = v & 255;
    }
  }
  return out[py * stride + px * 4 + 3];
}

test('App 圖示：尺寸正確，manifest 與 index.html 指向存在的檔案', () => {
  const sizes = { 'icons/icon-192.png': 192, 'icons/icon-512.png': 512, 'icons/icon-maskable-512.png': 512, 'icons/apple-touch-icon.png': 180 };
  for (const [f, n] of Object.entries(sizes)) { const i = pngInfo(readFileSync(join(root, f))); assert.equal(i.w, n, f); assert.equal(i.h, n, f); }
  const man = JSON.parse(read('manifest.webmanifest'));
  for (const ic of man.icons) assert.ok(existsSync(join(root, ic.src)), `manifest 圖示不存在：${ic.src}`);
  assert.ok(man.icons.some((i) => i.purpose === 'maskable') && man.icons.some((i) => i.purpose === 'any' && i.sizes === '512x512'));
  const html = read('index.html');
  for (const m of html.matchAll(/(?:href|src)="(icons\/[^"]+)"/g)) assert.ok(existsSync(join(root, m[1])), `index.html 引用不存在的圖示：${m[1]}`);
});

test('App 圖示：一般用途是圓角（四角透明、中央不透明）；iOS 與 maskable 是滿版不透明', () => {
  for (const f of ['icons/icon-192.png', 'icons/icon-512.png']) {
    const buf = readFileSync(join(root, f)), { w } = pngInfo(buf);
    assert.equal(pngAlpha(buf, 1, 1), 0, `${f} 左上角應透明`);
    assert.equal(pngAlpha(buf, w - 2, w - 2), 0, `${f} 右下角應透明`);
    assert.equal(pngAlpha(buf, w >> 1, w >> 1), 255, `${f} 中央應不透明`);
  }
  for (const f of ['icons/apple-touch-icon.png', 'icons/icon-maskable-512.png']) {
    const px = pngPixel(readFileSync(join(root, f)), 2, 2);
    assert.notEqual(px, '#ffffff', `${f} 角落不該是白色`);
    assert.ok(parseInt(px.slice(1, 3), 16) > 200 && parseInt(px.slice(5, 7), 16) < 160, `${f} 角落應是吉祥物的橘色底，而不是 ${px}`);
  }
});

test('讀 PNG 的測試本身有效：能分辨不同位置的顏色', () => {
  const png = readFileSync(join(root, 'icons/icon-maskable-512.png'));
  assert.notEqual(pngPixel(png, 256, 256), pngPixel(png, 3, 3), '中央與角落應是不同顏色，代表真的有讀到不同像素');
});
