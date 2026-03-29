/**
 * publicites.js — Gestion des publicites media de la page d'accueil
 *
 * Stockage : attt_home_ads
 * Structure :
 * { id, titre, description, mediaType, mediaUrl, thumbnailUrl, targetUrl,
 *   mediaSize, access, actif, ordre, createdAt, updatedAt, auteurId, auteurLogin }
 */

'use strict';

const PUBLICITES = (() => {
  const KEY = 'attt_home_ads';
  const ACCESS_LABELS = {
    tous: 'Tous',
    famille: 'Famille+',
    membres: 'Membres uniquement'
  };

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }

  function _save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    if (typeof DB !== 'undefined') DB.push(KEY, list);
  }

  function _id() {
    return 'ad_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function _directDriveUrl(url) {
    const value = String(url || '').trim();
    const match = value.match(/\/d\/([a-zA-Z0-9_-]+)/) || value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!match) return value;
    return 'https://drive.google.com/uc?export=download&id=' + match[1];
  }

  function normalizeMediaUrl(url, mediaType) {
    const value = String(url || '').trim();
    if (!value) return '';
    if (!/drive\.google\.com/.test(value)) return value;
    if (mediaType === 'video') return 'https://drive.google.com/file/d/' + ((_directDriveUrl(value).match(/id=([a-zA-Z0-9_-]+)/) || [])[1] || '') + '/preview';
    return _directDriveUrl(value);
  }

  function normalizeAccess(access) {
    const value = String(access || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(ACCESS_LABELS, value) ? value : 'tous';
  }

  function getAccessLabel(access) {
    return ACCESS_LABELS[normalizeAccess(access)] || ACCESS_LABELS.tous;
  }

  function getAds(filters = {}) {
    let list = _load();
    if (filters.activeOnly) list = list.filter(item => item.actif);
    list = list.map(item => ({ ...item, access: normalizeAccess(item.access) }));
    if (filters.access) list = list.filter(item => item.access === normalizeAccess(filters.access));
    list.sort((a, b) => (a.ordre || 999) - (b.ordre || 999) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return list;
  }

  function getAd(id) {
    return _load().find(item => item.id === id) || null;
  }

  function addAd(data) {
    const list = _load();
    const now = new Date().toISOString();
    const item = {
      id: _id(),
      titre: data.titre || '',
      description: data.description || '',
      mediaType: data.mediaType || 'image',
      mediaUrl: normalizeMediaUrl(data.mediaUrl, data.mediaType || 'image'),
      thumbnailUrl: normalizeMediaUrl(data.thumbnailUrl || '', 'image'),
      targetUrl: data.targetUrl || '',
      mediaSize: data.mediaSize || '',
      access: normalizeAccess(data.access),
      actif: data.actif !== false,
      ordre: Number(data.ordre) || 0,
      createdAt: now,
      updatedAt: now,
      auteurId: data.auteurId || '',
      auteurLogin: data.auteurLogin || ''
    };
    list.push(item);
    _save(list);
    return item;
  }

  function updateAd(id, data) {
    const list = _load();
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) return false;
    list[idx] = {
      ...list[idx],
      ...data,
      access: normalizeAccess(data.access ?? list[idx].access),
      mediaUrl: normalizeMediaUrl(data.mediaUrl ?? list[idx].mediaUrl, data.mediaType || list[idx].mediaType),
      thumbnailUrl: normalizeMediaUrl(data.thumbnailUrl ?? list[idx].thumbnailUrl, 'image'),
      updatedAt: new Date().toISOString(),
      id
    };
    _save(list);
    return true;
  }

  function deleteAd(id) {
    _save(_load().filter(item => item.id !== id));
  }

  function userCanSee(ad, user) {
    if (!ad.actif) return false;
    if (normalizeAccess(ad.access) === 'tous') return true;
    if (!user) return false;
    if (normalizeAccess(ad.access) === 'famille') return typeof AUTH !== 'undefined' ? AUTH.hasRole(user, 'famille') : user.role === 'famille';
    if (normalizeAccess(ad.access) === 'membres') return typeof AUTH !== 'undefined' ? AUTH.hasRole(user, 'membre') : user.role === 'membre';
    return true;
  }

  return { ACCESS_LABELS, getAccessLabel, getAds, getAd, addAd, updateAd, deleteAd, normalizeMediaUrl, userCanSee };
})();
