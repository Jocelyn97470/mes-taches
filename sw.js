/* Service worker : permet d'utiliser l'appli même sans connexion.
   Stratégie « réseau d'abord » : les mises à jour arrivent dès qu'on est en ligne. */

'use strict';

const CACHE = 'taches-chantier-v1';
const FICHIERS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (cles) {
      return Promise.all(
        cles.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (reponse) {
      const copie = reponse.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
      return reponse;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
