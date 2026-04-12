/**
 * version-check.js — Suivi de version (pas de banniere)
 * Les mises a jour sont automatiques via GitHub Pages + Service Worker network-first.
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
    // D'abord essayer localStorage/Firestore, puis fallback serveur
    try {
      var vj = JSON.parse(localStorage.getItem('attt_version_json') || '{}');
      if (vj && vj.version) return Promise.resolve(vj);
    } catch(e) {}
    return fetch('assets/version.json?t=' + Date.now())
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data) localStorage.setItem('attt_version_json', JSON.stringify(data));
        return data;
      })
      .catch(function() { return null; });
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

