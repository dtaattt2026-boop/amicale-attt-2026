/**
 * ATTT Amicale — Module Journal des opérations
 *
 * Enregistre toutes les actions importantes (qui, quand, quoi, détail).
 * Stockage localStorage — usage intranet/démo uniquement.
 *
 * Catégories d'action :
 *   auth     → connexion, déconnexion, inscription
 *   membre   → validation, rejet, suspension, réactivation
 *   role     → changement de rôle
 *   data     → ajout/modif/suppression événement ou offre
 *   compte   → suppression de compte
 */

'use strict';

const LOG = (() => {

  const K_LOG     = 'attt_log';
  const MAX_LINES = 2000;   /* limite anti-saturation */

  /* ── Types d'actions ─────────────────────────────────────── */
  const ACTIONS = {
    /* Auth */
    LOGIN            : 'Connexion',
    LOGOUT           : 'Déconnexion',
    REGISTER         : 'Inscription',
    /* Membres */
    VALIDATE_MEMBER  : 'Validation inscription',
    REJECT_MEMBER    : 'Rejet inscription',
    SUSPEND_MEMBER   : 'Suspension membre',
    REACTIVATE_MEMBER: 'Réactivation membre',
    /* Rôles */
    ROLE_CHANGE      : 'Changement de rôle',
    /* Données */
    EVENT_ADD        : 'Ajout événement',
    EVENT_EDIT       : 'Modification événement',
    EVENT_DEL        : 'Suppression événement',
    OFFER_ADD        : 'Ajout offre',
    OFFER_EDIT       : 'Modification offre',
    OFFER_DEL        : 'Suppression offre',    /* Articles */
    ARTICLE_ADD:       'Publication article',
    ARTICLE_EDIT:      'Modification article',
    ARTICLE_DEL:       'Suppression article',    /* Comptes */
    ACCOUNT_DELETE   : 'Suppression compte',
  };

  /* ── Helpers ─────────────────────────────────────────────── */
  function _getLog()    { return JSON.parse(localStorage.getItem(K_LOG) || '[]'); }
  function _saveLog(l)  { localStorage.setItem(K_LOG, JSON.stringify(l)); if (typeof DB !== 'undefined') DB.push(K_LOG, l); }

  function _now() {
    return new Date().toISOString();          /* ex: 2026-03-24T10:42:07.123Z */
  }

  /* ── Écriture ─────────────────────────────────────────────── */
  /**
   * @param {string} action  — clé ACTIONS
   * @param {object} opts    — { acteurId, acteurLogin, acteurRole, cibleId, cibleLogin, detail }
   */
  function add(action, opts = {}) {
    const log = _getLog();
    log.unshift({
      id:           'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      ts:           _now(),
      action,
      actionLabel:  ACTIONS[action] || action,
      acteurId:     opts.acteurId    || null,
      acteurLogin:  opts.acteurLogin || 'système',
      acteurRole:   opts.acteurRole  || null,
      cibleId:      opts.cibleId     || null,
      cibleLogin:   opts.cibleLogin  || null,
      detail:       opts.detail      || null,
    });
    /* Trim si dépassement */
    if (log.length > MAX_LINES) log.length = MAX_LINES;
    _saveLog(log);
  }

  /* ── Lecture avec filtres ─────────────────────────────────── */
  /**
   * @param {object} filters — { action, acteurLogin, cibleLogin, dateFrom, dateTo, q }
   * @returns {Array}
   */
  function getLog(filters = {}) {
    let log = _getLog();
    const { action, acteurLogin, cibleLogin, dateFrom, dateTo, q } = filters;

    if (action)       log = log.filter(l => l.action === action);
    if (acteurLogin)  log = log.filter(l => (l.acteurLogin||'').toLowerCase().includes(acteurLogin.toLowerCase()));
    if (cibleLogin)   log = log.filter(l => (l.cibleLogin||'').toLowerCase().includes(cibleLogin.toLowerCase()));
    if (dateFrom)     log = log.filter(l => l.ts >= dateFrom);
    if (dateTo)       log = log.filter(l => l.ts <= dateTo + 'T23:59:59Z');
    if (q) {
      const ql = q.toLowerCase();
      log = log.filter(l =>
        (l.acteurLogin||'').toLowerCase().includes(ql) ||
        (l.cibleLogin ||'').toLowerCase().includes(ql) ||
        (l.detail     ||'').toLowerCase().includes(ql) ||
        (l.actionLabel||'').toLowerCase().includes(ql)
      );
    }
    return log;
  }

  /* ── Effacer tout (Maître uniquement, protection côté UI) ─── */
  function clearAll() { _saveLog([]); }

  /* ── API publique ─────────────────────────────────────────── */
  return { add, getLog, clearAll, ACTIONS };

})();
