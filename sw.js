/* =========================================================
   Service Worker â€” Amicale ATTT
   StratÃ©gie : Network-first avec fallback cache
   ========================================================= */
const CACHE_NAME  = 'amicale-attt-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './actualites.html',
  './evenements.html',
  './activites.html',
  './a-propos.html',
  './contact.html',
  './galerie.html',
  './telechargements.html',
  './login.html',
  './inscription.html',
  './css/style.css',
  './js/main.js',
  './js/auth.js',
  './js/data.js',
  './js/contenu.js',
  './js/log.js'
];

/* â”€â”€ Installation : mise en cache initiale â”€â”€ */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .catch(() => { /* silencieux si une ressource manque */ })
  );
  self.skipWaiting();
});

/* â”€â”€ Activation : nettoyage des anciens caches â”€â”€ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* â”€â”€ RÃ©cupÃ©ration : Network-first, Cache fallback â”€â”€ */
self.addEventListener('fetch', event => {
  /* Ignorer les requÃªtes non-GET et cross-origin */
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        /* Mettre en cache si valide */
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          /* Page de repli si vraiment hors-ligne */
          return new Response(
            '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Hors-ligne</title></head>' +
            '<body style="font-family:sans-serif;text-align:center;padding:3rem">' +
            '<h1>&#128296; Hors connexion</h1>' +
            '<p>Impossible de charger cette page. VÃ©rifiez votre connexion puis <a href="./">retournez Ã  l\'accueil</a>.</p>' +
            '</body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
      )
  );
});

