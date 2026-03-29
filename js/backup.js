/**
 * backup.js — Export / Import complet des données du site
 *
 * Les données sont stockées dans localStorage (par navigateur/appareil).
 * Ce module permet d'exporter toutes les données dans un fichier JSON
 * et de les restaurer sur un autre appareil ou après une réinitialisation.
 *
 * Clés gérées :
 *   attt_users    → Comptes membres (auth.js)
 *   attt_events   → Événements (data.js)
 *   attt_offers   → Offres (data.js)
 *   attt_articles → Articles / Actualités (contenu.js)
 *   attt_log      → Journal d'audit (log.js)
 */

'use strict';

const BACKUP = (() => {
  const KEYS = ['attt_users', 'attt_events', 'attt_offers', 'attt_articles', 'attt_log',
                 'attt_conventions', 'attt_messages', 'attt_payments',
                 'attt_rentals', 'attt_bookings', 'attt_participation_history', 'attt_galerie',
                 'attt_special_event_registrations', 'attt_role_defs', 'attt_permission_catalog', 'attt_site_settings', 'attt_home_ads'];
  const VERSION = '1.0';

  /* ── Statistiques de la sauvegarde actuelle ── */
  function getStats() {
    const stats = {};
    KEYS.forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) { stats[k] = 0; return; }
        const parsed = JSON.parse(raw);
        stats[k] = Array.isArray(parsed) ? parsed.length : 1;
      } catch {
        stats[k] = null;
      }
    });
    /* Taille totale en Ko */
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('attt_')) {
        totalBytes += (localStorage.getItem(key) || '').length;
      }
    }
    stats._totalKo = Math.round(totalBytes / 1024 * 10) / 10;
    return stats;
  }

  /* ── Export toutes les données → fichier .json ── */
  function exportAll() {
    const backup = {
      _version:    VERSION,
      _site:       'Amicale ATTT',
      _exportedAt: new Date().toISOString(),
      data: {}
    };
    KEYS.forEach(k => {
      const raw = localStorage.getItem(k);
      backup.data[k] = raw ? JSON.parse(raw) : null;
    });

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = `amicale-attt-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return backup._exportedAt;
  }

  /* ── Valider et analyser un fichier de sauvegarde ── */
  function parseBackupFile(jsonText) {
    let backup;
    try { backup = JSON.parse(jsonText); }
    catch { throw new Error('Fichier JSON invalide ou corrompu.'); }

    if (!backup.data || typeof backup.data !== 'object') {
      throw new Error('Format de sauvegarde non reconnu.');
    }
    /* Statistiques du fichier */
    const summary = { exportedAt: backup._exportedAt || 'inconnu', counts: {} };
    KEYS.forEach(k => {
      const val = backup.data[k];
      summary.counts[k] = Array.isArray(val) ? val.length : (val ? 1 : 0);
    });
    return { backup, summary };
  }

  /* ── Importer (avec protection du compte secours) ── */
  function importAll(backup, options = {}) {
    const { mergeUsers = false } = options;

    KEYS.forEach(k => {
      if (backup.data[k] === null || backup.data[k] === undefined) return;

      if (k === 'attt_users') {
        /* Protection absolue du compte secours */
        const secours     = JSON.parse(localStorage.getItem('attt_users') || '[]')
                              .find(u => u.login === '347');
        let newUsers      = Array.isArray(backup.data[k]) ? backup.data[k] : [];
        /* Exclure le compte secours importé (on garde le local) */
        newUsers = newUsers.filter(u => u.login !== '347');
        if (secours) newUsers.push(secours);

        if (mergeUsers) {
          /* Fusion : ne pas écraser les comptes existants */
          const existing = JSON.parse(localStorage.getItem('attt_users') || '[]');
          const existIds = new Set(existing.map(u => u.id));
          const toAdd    = newUsers.filter(u => !existIds.has(u.id));
          const merged   = [...existing, ...toAdd];
          localStorage.setItem(k, JSON.stringify(merged));
          if (typeof DB !== 'undefined') DB.push(k, merged);
        } else {
          localStorage.setItem(k, JSON.stringify(newUsers));
          if (typeof DB !== 'undefined') DB.push(k, newUsers);
        }
      } else {
        const val = backup.data[k];
        localStorage.setItem(k, JSON.stringify(val));
        if (typeof DB !== 'undefined') DB.push(k, val);
      }
    });
  }

  /* ── Effacer toutes les données (sauf compte secours) ── */
  function clearAll() {
    const secours = JSON.parse(localStorage.getItem('attt_users') || '[]')
                      .find(u => u.login === '347');
    KEYS.forEach(k => localStorage.removeItem(k));
    if (secours) localStorage.setItem('attt_users', JSON.stringify([secours]));
  }

  return { getStats, exportAll, parseBackupFile, importAll, clearAll, KEYS };
})();
