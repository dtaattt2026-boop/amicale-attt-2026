/**
 * update-manager.js — Gestionnaire global des mises à jour
 * 
 * Gère:
 *   1. Enregistrement du Service Worker
 *   2. Détection des nouvelles versions du SW
 *   3. Synchronisation de version-check.js
 *   4. Background Sync pour les smartphones
 */

'use strict';

const UPDATE_MANAGER = (() => {

  let _swRegistration = null;
  let _updateCheckInterval = null;

  /* ── Enregistrer le Service Worker ── */
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.log('[UPDATE] Service Workers non supportés');
      return null;
    }
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
      console.log('[UPDATE] Service Worker enregistré ✓');
      _swRegistration = reg;
      setupUpdateListener(reg);
      return reg;
    } catch (err) {
      console.warn('[UPDATE] Erreur enregistrement SW:', err.message);
      return null;
    }
  }

  /* ── Écouter les mises à jour du SW ── */
  function setupUpdateListener(reg) {
    if (!reg) return;

    /* Vérifier si une nouvelle version du SW est prête */
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      console.log('[UPDATE] Nouvelle version du SW trouvée');
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Ne PAS reload automatiquement — ça cause une boucle infinie sur smartphone
          // La mise à jour sera effective au prochain reload naturel de la page
          console.log('[UPDATE] Nouvelle version du SW prête — sera active au prochain rechargement');
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    /* Vérifier les mises à jour du SW toutes les heures */
    setInterval(() => {
      reg.update().catch(err => console.warn('[UPDATE] Erreur vérification SW:', err.message));
    }, 60 * 60 * 1000);
  }

  /* ── Initialisation globale ── */
  async function init() {
    console.log('[UPDATE] Démarrage du gestionnaire de mises à jour');

    // 1. Enregistrer le Service Worker
    await registerServiceWorker();

    // 2. Attendre la synchronisation Firestore AVANT de vérifier les versions
    if (typeof DB_READY !== 'undefined') {
      try { await DB_READY; } catch {}
    }

    // 3. Appeler version-check si disponible
    if (typeof VERSION_CHECK !== 'undefined' && VERSION_CHECK.checkAndNotify) {
      console.log('[UPDATE] Vérification des versions d\'application');
      await VERSION_CHECK.checkAndNotify();
    }

    // 4. Vérifier les mises à jour en arrière-plan (Background Sync)
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      setupBackgroundSync();
    }

    // 5. Vérifier les mises à jour régulièrement (toutes les 30 min)
    _updateCheckInterval = setInterval(async () => {
      if (typeof VERSION_CHECK !== 'undefined' && VERSION_CHECK.checkAndNotify) {
        console.log('[UPDATE] Vérification périodique des versions');
        // Forcer le clear cache pour relire Firestore
        if (VERSION_CHECK.clearCache) VERSION_CHECK.clearCache();
        await VERSION_CHECK.checkAndNotify();
      }
    }, 30 * 60 * 1000);
  }

  /* ── Synchronisation en arrière-plan (PWA/Android) ── */
  async function setupBackgroundSync() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.sync) {
        console.log('[UPDATE] Background Sync non supporté');
        return;
      }
      
      // Enregistrer une tâche de synchronisation
      await reg.sync.register('check-updates');
      console.log('[UPDATE] Background Sync activé ✓');
    } catch (err) {
      console.warn('[UPDATE] Erreur Background Sync:', err.message);
    }
  }

  /* ── Enregistrer l'écouteur de sync ── (dans le SW) */
  function registerSyncHandler() {
    if (typeof self === 'undefined') return; // Non dans le SW
    
    self.addEventListener('sync', event => {
      if (event.tag === 'check-updates') {
        console.log('[UPDATE] Background Sync déclenché');
        event.waitUntil(
          fetch('assets/version.json?_=' + Date.now(), { cache: 'no-store' })
            .then(r => r.json())
            .catch(err => console.warn('[UPDATE] Erreur vérification sync:', err.message))
        );
      }
    });
  }

  /* ── API publique ── */
  return {
    init,
    registerServiceWorker,
    setupBackgroundSync
  };
})();

/* ── Point d'entrée : lancer l'initialisation au chargement du document ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => UPDATE_MANAGER.init());
} else {
  UPDATE_MANAGER.init();
}
