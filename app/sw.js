/* Оболочка кэшируется, данные — никогда.
   Приложение открывается без сети, но брони показывает только свежие
   (или последние сохранённые — этим занимается сама страница). */
var CACHE = 'gh-app-v1';
var SHELL = ['./', './index.html', './manifest.webmanifest',
             './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL).catch(function () {});
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  /* API мимо кэша всегда: иначе увидим вчерашние брони как сегодняшние */
  if (url.pathname.indexOf('/api/') === 0) return;
  e.respondWith(
    fetch(e.request).then(function (r) {
      if (r && r.ok && url.origin === location.origin) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return r;
    }).catch(function () { return caches.match(e.request); })
  );
});
