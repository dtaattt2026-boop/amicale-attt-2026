/**
 * db.js — Couche de persistance Firestore (Firebase)
 *
 * Fonctionnement :
 *   1. DB.init() lit TOUTES les données Firestore → localStorage (sync down)
 *   2. Chaque écriture localStorage est aussi poussée à Firestore (push)
 *   3. Si Firebase est désactivé ou inaccessible → mode localStorage pur
 *
 * API publique :
 *   DB.init()          → Promise (se résout quand la sync cloud est terminée)
 *   DB.push(key, data) → envoie data à Firestore (fire-and-forget, sans bloquer)
 *   DB.isEnabled()     → boolean — true si Firebase est connecté
 *
 * Promesse globale : DB_READY
 *   → Se résout quand les données sont disponibles dans localStorage.
 *   → Attendez DB_READY avant tout premier rendu de données.
 *   → Exemple : DB_READY.then(() => renderKPI());
 */

'use strict';

const DB = (() => {

  /* Clés localStorage synchronisées avec Firestore */
  const KEYS = ['attt_users', 'attt_events', 'attt_offers', 'attt_articles', 'attt_log',
                 'attt_conventions', 'attt_messages', 'attt_payments',
                 'attt_rentals', 'attt_bookings', 'attt_participation_history', 'attt_galerie',
                 'attt_special_event_registrations', 'attt_droits_matrix', 'attt_role_defs', 'attt_permission_catalog', 'attt_site_settings', 'attt_home_ads',
                 'attt_vote_subjects', 'attt_vote_ballots',
                 'attt_contact_messages'];

  /* Nom de la collection Firestore */
  const COLL = 'site_data';

  let _enabled = false;
  let _db      = null;

  function _normalizeRightsMatrixValue(value) {
    if (!Array.isArray(value) || !value.some(Array.isArray)) return value;
    const roleIds = ['superviseur', 'admin', 'membre', 'famille'];
    return value
      .filter(row => Array.isArray(row) && row[0])
      .map(row => {
        const values = {};
        roleIds.forEach((roleId, index) => { values[roleId] = row[index + 1] || '—'; });
        return { label: row[0], values };
      });
  }

  function _sanitizeForKey(key, value) {
    if (key === 'attt_droits_matrix') return _normalizeRightsMatrixValue(value);
    return value;
  }

  /* ── Initialisation ────────────────────────────────────────── */
  async function init() {
    /* Mode localStorage pur si Firebase non configuré */
    if (!FIREBASE_ENABLED) return;

    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === 'VOTRE_API_KEY') {
      console.warn('[DB] Firebase non configuré — fonctionnement en mode localStorage uniquement.');
      return;
    }

    if (typeof firebase === 'undefined') {
      console.warn('[DB] SDK Firebase non chargé (pas de connexion internet ?) — mode localStorage.');
      return;
    }

    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      _db      = firebase.firestore();
      _enabled = true;
      await _syncDown();
      console.info('[DB] ✓ Firebase connecté — données synchronisées depuis le cloud.');
    } catch (err) {
      console.warn('[DB] Erreur Firebase (fallback localStorage) :', err.message);
      _enabled = false;
    }
  }

  /* ── Synchronisation Firestore → localStorage ──────────────── */
  async function _syncDown() {
    const snapshot = await _db.collection(COLL).get();
    snapshot.forEach(doc => {
      if (KEYS.includes(doc.id)) {
        const val = _sanitizeForKey(doc.id, doc.data().value);
        if (val !== undefined && val !== null) {
          localStorage.setItem(doc.id, JSON.stringify(val));
        }
      }
    });
  }

  /* ── Push localStorage → Firestore (fire-and-forget) ──────── */
  function push(key, data) {
    if (!_db || !_enabled) return;
    const safeData = _sanitizeForKey(key, data);
    _db.collection(COLL).doc(key)
      .set({ value: safeData, updatedAt: new Date().toISOString() })
      .catch(err => console.warn('[DB] Erreur push Firestore :', err.message));
  }

  /* ── Accesseur état ────────────────────────────────────────── */
  function isEnabled() { return _enabled; }

  return { init, push, isEnabled, KEYS };
})();

/* ─── Promesse globale — attendez DB_READY avant tout rendu ─── */
const DB_READY = DB.init();
