/**
 * update-manager.js — Enregistrement du Service Worker uniquement.
 * Les mises a jour sont automatiques (SW network-first + GitHub Pages).
 */
'use strict';

const UPDATE_MANAGER = (() => {
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      var reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
      console.log('[SW] Service Worker enregistré');
      return reg;
    } catch (err) {
      console.warn('[SW] Erreur:', err.message);
      return null;
    }
  }

  async function init() {
    await registerServiceWorker();
  }

  return { init: init, registerServiceWorker: registerServiceWorker };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { UPDATE_MANAGER.init(); });
} else {
  UPDATE_MANAGER.init();
}
