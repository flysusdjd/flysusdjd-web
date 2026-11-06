/*
 * Service worker —— 让记账本离线可用 / makes the ledger work offline.
 *
 * 策略 / strategy:
 *   页面导航      network-first（保证一上网就拿到新版本，断网时用缓存）
 *   静态资源      stale-while-revalidate（秒开，后台悄悄更新）
 *   /api/...      network-only（账目绝不用过期缓存，宁可报错）
 *
 * 改了前端资源记得把 VERSION 加一，否则旧缓存会一直喂老文件。
 */

const VERSION = 'v3';
const SHELL_CACHE = `ledger-shell-${VERSION}`;

const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 接口一律走网络
  if (url.pathname.startsWith('/api/')) return;

  // 页面：网络优先
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((hit) => hit || Response.error())),
    );
    return;
  }

  // 静态资源：先给缓存，再后台更新
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
