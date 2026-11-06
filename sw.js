// 離線快取（整包版本一致）：
//  - 安裝時用 cache:'reload' 繞過瀏覽器 HTTP 快取（GitHub Pages 預設 max-age=600），一次抓齊新版所有檔案
//  - 全部抓完才啟用；執行期只從「當前版本」的快取取檔，所以不會出現「新 HTML 配舊 JS」的混版
//  - 改了任何檔案後：把 VERSION 加 1，並同步改 js/app.js 的 VERSION 與 index.html 的 <html data-v>
//    （tests/version.test.js 會檢查三處一致，以及 app.js 匯入的檔案都在 ASSETS 裡）
const VERSION = 33;
const CACHE = `mokusaku-v${VERSION}`;
const ASSETS = [
  './', 'index.html', 'css/style.css',
  'js/app.js', 'js/units.js', 'js/calc.js', 'js/section.js', 'js/keypad.js',
  'js/dom.js', 'js/figures.js', 'js/luban.js', 'js/luban-ui.js', 'js/four.js',
  'js/glossary.js', 'js/glossary-search.js', 'js/glossary-ui.js', 'js/diagrams.js',
  'js/joints.js', 'js/joint-ui.js', 'js/install-ui.js', 'js/joint3d.js', 'js/joint3d-geom.js', 'lib/three.module.min.js', 'js/orbit.js',
  'js/kiku.js', 'js/calc-log.js', 'js/calc-ui.js', 'js/figures-kiku.js',
  'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async (url) => {
      const res = await fetch(new Request(url, { cache: 'reload' }));
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      await cache.put(url, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch {
      return (req.mode === 'navigate' && (await cache.match('./'))) || Response.error();
    }
  })());
});
