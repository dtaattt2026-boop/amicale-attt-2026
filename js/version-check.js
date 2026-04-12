/**
 * version-check.js — Suivi de version automatique
 * Toujours consulte version.json du serveur (GitHub Pages) en priorité.
 */
'use strict';
const VERSION_CHECK = {
  checkAndNotify: function() {},
  getInstalled: function() { try { return JSON.parse(localStorage.getItem('attt_installed_versions') || '{}'); } catch(e) { return {}; } },
  recordInstall: function(p, v) { var i = this.getInstalled(); i[p] = v; i[p+'_date'] = new Date().toISOString().split('T')[0]; localStorage.setItem('attt_installed_versions', JSON.stringify(i)); },
  acknowledgeVersion: function() {},
  clearCache: function() {},
  _cmp: function(a, b) { var x = String(a||'0').split('.').map(Number), y = String(b||'0').split('.').map(Number); for (var i=0;i<Math.max(x.length,y.length);i++) { var d=(x[i]||0)-(y[i]||0); if(d) return d; } return 0; },
  fetchLatest: function() {
    // Toujours aller chercher sur le serveur d'abord (pas de cache)
    return fetch('assets/version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data && data.version) {
          localStorage.setItem('attt_version_json', JSON.stringify(data));
          // Synchroniser attt_updates si serveur plus récent
          try {
            var upd = JSON.parse(localStorage.getItem('attt_updates') || '{}');
            if (VERSION_CHECK._cmp(data.version, upd.currentVersion || '') > 0) {
              if (!upd.history) upd.history = [];
              var alreadyIn = upd.history.some(function(h) { return h.version === data.version && h.action === 'publié'; });
              if (!alreadyIn) {
                upd.history.push({ version: data.version, notes: data.changelog || 'Mise à jour', action: 'publié', date: data.datePublication || new Date().toISOString(), by: 'deploy' });
              }
              upd.currentVersion = data.version;
              upd.publishedDate = data.datePublication || new Date().toISOString();
              // Seulement localStorage, PAS Firestore
              localStorage.setItem('attt_updates', JSON.stringify(upd));
            }
          } catch(e) {}
        }
        return data;
      })
      .catch(function() {
        // Fallback localStorage si hors-ligne
        try {
          var vj = JSON.parse(localStorage.getItem('attt_version_json') || '{}');
          if (vj && vj.version) return vj;
        } catch(e) {}
        return null;
      });
  },
  getCurrentVersion: function() {
    try {
      var ud = JSON.parse(localStorage.getItem('attt_updates') || '{}');
      if (ud.currentVersion) return ud.currentVersion;
    } catch(e) {}
    try {
      var vj = JSON.parse(localStorage.getItem('attt_version_json') || '{}');
      if (vj.version) return vj.version;
    } catch(e) {}
    return null;
  }
};

