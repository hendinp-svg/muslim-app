// service-worker.js — cangkang offline Sahabat Muslim
// Strategi: cache-first untuk shell & data surah (tidak berubah),
// network-first untuk navigasi, offline.html sebagai fallback.
const CACHE_VERSION = 'v3';
const CACHE_NAME = 'sahabat-muslim-' + CACHE_VERSION;
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './offline.html',
  './manifest.webmanifest',
  './fonts/LPMQ-Isep-Misbah.woff2',
  './data/surah-index.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Navigasi: coba jaringan, jatuh ke cache, lalu halaman offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(req).then((r) => r || caches.match('./offline.html'))
      )
    );
    return;
  }

  // Hanya cache permintaan same-origin (shell, font, data surah).
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // reverse-geocode dll: langsung ke jaringan

  // Data surah & font tidak pernah berubah: cache-first murni.
  const immutable = url.pathname.includes('/data/surah/') || url.pathname.includes('/fonts/');

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached && immutable) return cached;
      const ambil = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      // stale-while-revalidate: sajikan cache, pembaruan berjalan di latar
      return cached || ambil;
    })
  );
});
