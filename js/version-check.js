/**
 * version-check.js — Systeme de mise a jour centralise via Firestore
 *
 * Fonctionnement :
 *   1. Attend DB_READY (sync Firestore -> localStorage terminee)
 *   2. Lit attt_master_settings { version, publishedAt, showUpdateBanner }
 *   3. Compare publishedAt avec attt_seen_publish_time (horodatage local)
 *   4. Si publishedAt > seen ET banniere activee -> affiche la banniere
 *   5. 100% automatique : aucune action utilisateur requise
 *
 * Cles localStorage utilisees :
 *   - attt_master_settings   : { version, publishedAt, showUpdateBanner } - ecrit par le maitre
 *   - attt_seen_publish_time : horodatage de la derniere publication vue par cet appareil
 *   - attt_seen_site_version : version vue (pour afficher la progression)
 */

'use strict';

const VERSION_CHECK = (() => {

  const KEY_INSTALLED  = 'attt_installed_versions';
  const KEY_SEEN       = 'attt_seen_site_version';
  const KEY_SEEN_TIME  = 'attt_seen_publish_time';
  const KEY_MASTER     = 'attt_master_settings';
  const KEY_VER_JSON   = 'attt_version_json';

  function _cmp(v1, v2) {
    const a = String(v1 || '0').split('.').map(Number);
    const b = String(v2 || '0').split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const diff = (a[i] || 0) - (b[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  function _getPublishedInfo() {
    var version = null, showBanner = false, changelog = '';
    var forceUpdate = false, publishedAt = null;

    try {
      var ms = JSON.parse(localStorage.getItem(KEY_MASTER) || '{}');
      if (ms.version) {
        version     = ms.version;
        showBanner  = ms.showUpdateBanner === true;
        publishedAt = ms.publishedAt || null;
        changelog   = ms.changelog || '';
        forceUpdate = ms.forceUpdate === true;
      }
    } catch (e) {}

    if (!version) {
      try {
        var vj = JSON.parse(localStorage.getItem(KEY_VER_JSON) || '{}');
        if (vj.version) {
          version     = vj.version;
          showBanner  = true;
          publishedAt = vj.publishedAt || vj.datePublication || null;
          changelog   = vj.changelog || '';
          forceUpdate = vj.forceUpdate === true;
        }
      } catch (e) {}
    }

    if (!version) return null;
    return { version: version, showBanner: showBanner, publishedAt: publishedAt, changelog: changelog, forceUpdate: forceUpdate };
  }

  function getInstalled() {
    try { return JSON.parse(localStorage.getItem(KEY_INSTALLED) || '{}'); }
    catch (e) { return {}; }
  }

  function recordInstall(platform, version) {
    var inst = getInstalled();
    inst[platform]           = version;
    inst[platform + '_date'] = new Date().toISOString().split('T')[0];
    localStorage.setItem(KEY_INSTALLED, JSON.stringify(inst));
  }

  function _esc(s) {
    var d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }

  function _showUpdateBanner(fromVersion, toVersion, info) {
    var old = document.getElementById('update-banner');
    if (old) old.remove();

    var forced = info && info.forceUpdate === true;
    var pubAt  = (info && info.publishedAt) || '';

    var banner = document.createElement('div');
    banner.id = 'update-banner';
    Object.assign(banner.style, {
      position: 'sticky', top: '0', zIndex: '2100',
      background: forced ? '#dc3545' : '#ffc107',
      color: forced ? '#fff' : '#212529',
      padding: '0.75rem 1rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      boxShadow: '0 2px 8px rgba(0,0,0,.18)', flexWrap: 'wrap'
    });

    var iconEl = document.createElement('i');
    iconEl.className = forced
      ? 'bi bi-exclamation-triangle-fill fs-5 flex-shrink-0'
      : 'bi bi-arrow-up-circle-fill fs-5 flex-shrink-0';
    banner.appendChild(iconEl);

    var msg = document.createElement('div');
    msg.style.flexGrow = '1';

    var progressText = fromVersion && fromVersion !== toVersion
      ? '<strong>v' + _esc(fromVersion) + '</strong> \u2192 <strong>v' + _esc(toVersion) + '</strong>'
      : '<strong>v' + _esc(toVersion) + '</strong>';

    if (forced) {
      msg.innerHTML = '<strong>Mise \u00e0 jour obligatoire</strong> \u2014 ' + progressText + '. Votre version n\'est plus support\u00e9e.';
    } else {
      msg.innerHTML = '<strong>Nouvelle version disponible</strong> \u2014 ' + progressText
        + '. Mise \u00e0 jour pour <strong>Windows (.exe)</strong>, <strong>Android (.apk)</strong>.'
        + (info && info.changelog ? '<br><span style="font-size:.85rem;opacity:.8;">' + _esc(info.changelog) + '</span>' : '');
    }
    banner.appendChild(msg);

    var btn = document.createElement('a');
    btn.href = 'telechargements.html';
    btn.className = 'btn btn-sm fw-semibold flex-shrink-0';
    btn.style.background = forced ? '#fff' : '#003DA6';
    btn.style.color = forced ? '#dc3545' : '#fff';
    btn.style.borderRadius = '8px';
    btn.style.textDecoration = 'none';
    btn.innerHTML = '<i class="bi bi-download me-1"></i>Mettre \u00e0 jour';
    btn.onclick = function() { _acknowledge(toVersion, pubAt); };
    banner.appendChild(btn);

    if (!forced) {
      var close = document.createElement('button');
      close.type = 'button';
      close.setAttribute('aria-label', 'Fermer');
      close.style.cssText = 'background:none;border:none;font-size:1.3rem;cursor:pointer;color:inherit;padding:0 .25rem;line-height:1;';
      close.innerHTML = '&times;';
      close.onclick = function() {
        banner.remove();
        _acknowledge(toVersion, pubAt);
      };
      banner.appendChild(close);
    }

    document.body.prepend(banner);
    console.log('[VERSION] Banni\u00e8re affich\u00e9e : ' + (fromVersion || '?') + ' \u2192 ' + toVersion);
  }

  function _acknowledge(version, publishedAt) {
    localStorage.setItem(KEY_SEEN, version);
    if (publishedAt) localStorage.setItem(KEY_SEEN_TIME, publishedAt);
    sessionStorage.setItem('update-dismissed-' + version, '1');
  }

  async function checkAndNotify() {
    if (typeof DB_READY !== 'undefined') {
      try { await DB_READY; } catch (e) {}
    }

    var published = _getPublishedInfo();
    if (!published) {
      console.log('[VERSION] Aucune version publi\u00e9e trouv\u00e9e');
      return;
    }

    var publishedVersion = published.version;

    if (published.showBanner === false) {
      console.log('[VERSION] Banni\u00e8re d\u00e9sactiv\u00e9e par le ma\u00eetre');
      return;
    }

    if (sessionStorage.getItem('update-dismissed-' + publishedVersion)) {
      return;
    }

    /* ── Comparer par horodatage de publication (prioritaire) ── */
    var pubAt  = published.publishedAt || '';
    var seenAt = localStorage.getItem(KEY_SEEN_TIME) || '';

    if (pubAt && pubAt > seenAt) {
      var seenVer = localStorage.getItem(KEY_SEEN) || null;
      _showUpdateBanner(seenVer, publishedVersion, published);
      return;
    }

    /* ── Fallback : comparer par numero de version ── */
    var seenVersion = localStorage.getItem(KEY_SEEN) || null;
    if (!seenVersion || _cmp(publishedVersion, seenVersion) > 0) {
      _showUpdateBanner(seenVersion, publishedVersion, published);
      return;
    }

    console.log('[VERSION] D\u00e9j\u00e0 \u00e0 jour : v' + publishedVersion);
  }

  function acknowledgeVersion(version) {
    var pub = _getPublishedInfo();
    localStorage.setItem(KEY_SEEN, version || (pub ? pub.version : '0'));
    if (pub && pub.publishedAt) localStorage.setItem(KEY_SEEN_TIME, pub.publishedAt);
    var old = document.getElementById('update-banner');
    if (old) old.remove();
  }

  return {
    checkAndNotify: checkAndNotify,
    getInstalled: getInstalled,
    recordInstall: recordInstall,
    acknowledgeVersion: acknowledgeVersion,
    clearCache: function() {},
    _cmp: _cmp
  };
})();

