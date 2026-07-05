'use strict';
/* =========================================================
   麻雀成績記録 - Service Worker
   - シンプルなオフラインキャッシュ用途のみ。
   - google系API (Identity Toolkit / Firestore など) への
     リクエストは一切触らず、素通りさせる。
========================================================= */

const CACHE_NAME = 'mahjong-v3';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // googleapis.com（Identity Toolkit / Firestore / securetoken等）は
  // Service Workerで一切ハンドリングしない。素通りさせる。
  if (url.hostname.endsWith('googleapis.com')) {
    return;
  }

  // 同一オリジン以外（他のクロスオリジンリクエスト）も触らない。
  if (url.origin !== self.location.origin) {
    return;
  }

  // ナビゲーション（画面遷移）やHTML取得はネットワーク優先、失敗時にキャッシュ。
  const isNavigation = req.mode === 'navigate' ||
    (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // それ以外の同一オリジンリクエストはキャッシュ優先。
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      }).catch(() => cached);
    })
  );
});
