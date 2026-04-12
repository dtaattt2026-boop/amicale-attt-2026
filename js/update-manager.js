/**
 * update-manager.js — Mise à jour automatique complète
 * 1. Enregistre le Service Worker
 * 2. Détecte les nouvelles versions (version.json sur GitHub Pages)
 * 3. Force la mise à jour du SW + vide l'ancien cache
 * 4. Synchronise la version dans localStorage
 * 5. Rafraîchit la page si nécessaire
 */
'use strict';

const UPDATE_MANAGER = (() => {

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
      console.log('[SW] Service Worker enregistré');

      // Quand un nouveau SW est détecté
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'activated') {
            console.log('[SW] Nouveau Service Worker activé — rechargement…');
            window.location.reload();
          }
        });
      });

      return reg;
    } catch (err) {
      console.warn('[SW] Erreur:', err.message);
      return null;
    }
  }

  /* Vérifie la version serveur et synchronise localStorage */
  async function checkForUpdates() {
    try {
      const r = await fetch('assets/version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const serverData = r.ok ? await r.json() : null;
      if (!serverData || !serverData.version) return;

      const serverV = serverData.version;

      // Comparer avec la version locale
      let localV = '';
      try {
        const upd = JSON.parse(localStorage.getItem('attt_updates') || '{}');
        localV = upd.currentVersion || '';
      } catch {}
      if (!localV) {
        try {
          const vj = JSON.parse(localStorage.getItem('attt_version_json') || '{}');
          localV = vj.version || '';
        } catch {}
      }

      // Si le serveur a une version plus récente, synchroniser tout
      if (_cmp(serverV, localV) > 0) {
        console.info('[UPDATE] Nouvelle version détectée : ' + localV + ' → ' + serverV);

        // 1. Mettre à jour attt_version_json
        localStorage.setItem('attt_version_json', JSON.stringify(serverData));

        // 2. Mettre à jour attt_updates
        try {
          const upd = JSON.parse(localStorage.getItem('attt_updates') || '{}');
          upd.currentVersion = serverV;
          upd.publishedDate = serverData.datePublication || new Date().toISOString();
          localStorage.setItem('attt_updates', JSON.stringify(upd));
        } catch {}

        // 3. Forcer le SW à se mettre à jour
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        }

        // 4. Vider les anciens caches
        if ('caches' in window) {
          const keys = await caches.keys();
          const expected = 'amicale-attt-v' + serverV;
          await Promise.all(keys.filter(k => k !== expected).map(k => caches.delete(k)));
        }

        console.info('[UPDATE] ✓ Version synchronisée à ' + serverV);
      }
    } catch (err) {
      console.warn('[UPDATE] Erreur vérification:', err.message);
    }
  }

  function _cmp(a, b) {
    if (!a) return -1; if (!b) return 1;
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0, nb = pb[i] || 0;
      if (na !== nb) return na - nb;
    }
    return 0;
  }

  async function init() {
    await registerServiceWorker();
    // Vérifier les mises à jour immédiatement
    await checkForUpdates();
    // Re-vérifier périodiquement (toutes les 5 minutes)
    setInterval(checkForUpdates, 5 * 60 * 1000);
  }

  return { init, registerServiceWorker, checkForUpdates };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { UPDATE_MANAGER.init(); });
} else {
  UPDATE_MANAGER.init();
}
