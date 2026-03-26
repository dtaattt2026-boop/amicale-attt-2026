/**
 * version-check.js — Gestion des mises à jour des applications installées
 *
 * Fonctionnement :
 *   1. Fetch assets/version.json depuis le serveur (pas de cache navigateur)
 *   2. Compare avec la version enregistrée au moment du téléchargement
 *   3. Si version plus récente → bannière "Mise à jour disponible"
 *   4. En cas de forceUpdate → bannière non fermable
 *
 * Clé localStorage : attt_installed_versions
 *   {
 *     windows: '1.0.0', windows_date: '2026-03-25',
 *     android: '1.0.0', android_date: '2026-03-25'
 *   }
 */

'use strict';

const VERSION_CHECK = (() => {

  const KEY       = 'attt_installed_versions';
  const PLATFORMS = ['windows', 'android'];
  let   _latest   = null;

  /* ── Compare deux versions sémantiques ("1.2.3") ───────────── */
  function _cmp(v1, v2) {
    const a = String(v1 || '0').split('.').map(Number);
    const b = String(v2 || '0').split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const diff = (a[i] || 0) - (b[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  /* ── Récupère version.json depuis le serveur (sans cache) ───── */
  async function fetchLatest() {
    if (_latest) return _latest;
    try {
      const r = await fetch('assets/version.json?_=' + Date.now(), {
        cache: 'no-store'
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      _latest = await r.json();
      return _latest;
    } catch (err) {
      console.warn('[VERSION] Impossible de récupérer version.json :', err.message);
      return null;
    }
  }

  /* ── Retourne les versions enregistrées (téléchargements passés) */
  function getInstalled() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return {}; }
  }

  /* ── Enregistre la version au moment du téléchargement ──────── */
  function recordInstall(platform, version) {
    const inst = getInstalled();
    inst[platform]              = version;
    inst[platform + '_date']    = new Date().toISOString().split('T')[0];
    localStorage.setItem(KEY, JSON.stringify(inst));
  }

  /* ── Retourne la dernière version serveur pour une plateforme── */
  function getLatestVersion(platform) {
    if (!_latest) return null;
    return _latest.platforms?.[platform]?.version || _latest.version || null;
  }

  /* ── Vérifie si une mise à jour est disponible ──────────────── */
  function hasUpdate(platform) {
    const installed = getInstalled()[platform];
    if (!installed) return false;
    const latest = getLatestVersion(platform);
    if (!latest) return false;
    return _cmp(latest, installed) > 0;
  }

  /* ── Affiche la bannière de mise à jour ─────────────────────── */
  function _showUpdateBanner(latest, platformsToUpdate) {
    if (document.getElementById('update-banner')) return;

    const labels = { windows: 'Windows (.exe)', android: 'Android (.apk)' };
    const list   = platformsToUpdate.map(p => `<strong>${labels[p] || p}</strong>`).join(', ');
    const forced = latest.forceUpdate === true;

    const banner = document.createElement('div');
    banner.id = 'update-banner';
    Object.assign(banner.style, {
      position:   'sticky',
      top:        '0',
      zIndex:     '2100',
      background: forced ? '#dc3545' : '#ffc107',
      color:      forced ? '#fff'    : '#212529',
      padding:    '0.7rem 1rem',
      display:    'flex',
      alignItems: 'center',
      gap:        '0.75rem',
      boxShadow:  '0 2px 8px rgba(0,0,0,.18)',
      flexWrap:   'wrap'
    });

    const iconEl = document.createElement('i');
    iconEl.className = forced
      ? 'bi bi-exclamation-triangle-fill fs-5 flex-shrink-0'
      : 'bi bi-arrow-up-circle-fill fs-5 flex-shrink-0';
    banner.appendChild(iconEl);

    const msg = document.createElement('div');
    msg.style.flexGrow = '1';
    msg.innerHTML = forced
      ? `<strong>Mise à jour obligatoire (v${latest.version})</strong> — Votre version n'est plus supportée. Veuillez télécharger la nouvelle version pour ${list}.`
      : `<strong>Nouvelle version disponible — v${latest.version}</strong> — Mise à jour pour ${list}.`
        + (latest.changelog ? `<span class="ms-2 opacity-75">${latest.changelog}</span>` : '');
    banner.appendChild(msg);

    const btn = document.createElement('a');
    btn.href = 'telechargements.html';
    btn.className = 'btn btn-sm fw-semibold flex-shrink-0';
    btn.style.background = forced ? '#fff' : '#003DA6';
    btn.style.color      = forced ? '#dc3545' : '#fff';
    btn.innerHTML = '<i class="bi bi-download me-1"></i>Mettre à jour';
    banner.appendChild(btn);

    if (!forced) {
      const close = document.createElement('button');
      close.type = 'button';
      close.setAttribute('aria-label', 'Fermer');
      close.style.cssText = 'background:none;border:none;font-size:1.2rem;cursor:pointer;color:inherit;padding:0 .25rem;';
      close.innerHTML = '&times;';
      close.onclick = () => { banner.remove(); sessionStorage.setItem('update-dismissed-' + latest.version, '1'); };
      banner.appendChild(close);
    }

    document.body.prepend(banner);
  }

  /* ── Point d'entrée principal : vérifie et notifie ─────────── */
  async function checkAndNotify() {
    const latest = await fetchLatest();
    if (!latest) return;

    const inst = getInstalled();
    const toUpdate = PLATFORMS.filter(p => {
      if (!inst[p]) return false;   /* pas encore installée sur cet appareil */
      /* Ne pas afficher si déjà fermée pour cette version */
      if (sessionStorage.getItem('update-dismissed-' + latest.version)) return false;
      return hasUpdate(p);
    });

    if (toUpdate.length > 0) _showUpdateBanner(latest, toUpdate);
  }

  /* ── API publique ────────────────────────────────────────────── */
  return {
    fetchLatest,
    getInstalled,
    recordInstall,
    getLatestVersion,
    hasUpdate,
    checkAndNotify,
    _cmp  /* exposé pour les tests */
  };
})();
