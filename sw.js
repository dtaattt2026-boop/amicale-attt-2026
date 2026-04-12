/* =========================================================
   Service Worker — Amicale ATTT
   Stratégie : Network-first avec fallback cache + versioning
   ========================================================= */
let CACHE_NAME = 'amicale-attt-v2.2.12';  // mis à jour dynamiquement depuis version.json
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

/* ── Récupère la version depuis version.json et met à jour CACHE_NAME ── */
async function updateCacheName() {
  try {
    const r = await fetch('assets/version.json?_=' + Date.now(), { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      const version = data.version || data.platforms?.pwa?.version || '1.0.0';
      CACHE_NAME = 'amicale-attt-v' + version;
    }
  } catch (err) {
    console.warn('[SW] Erreur mise à jour version:', err.message);
  }
}

/* ── Installation : mise en cache initiale + récupération version ── */
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      await updateCacheName();
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS).catch(() => {});
    })()
  );
  self.skipWaiting();
});

/* ── Activation : nettoyage des anciens caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      await updateCacheName();
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })()
  );
  self.clients.claim();
});

/* ── Récupération : Network-first, Cache fallback + mise à jour ── */
self.addEventListener('fetch', event => {
  /* Ignorer les requêtes non-GET et cross-origin */
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
            '<p>Impossible de charger cette page. Vérifiez votre connexion puis <a href="./">retournez à l\'accueil</a>.</p>' +
            '</body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
      )
  );
});

/* ── Message depuis le client pour forcer une mise à jour ── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});