/**
 * messages.js — Module Messagerie interne
 *
 * Structure d'un message :
 *   { id, de (userId), a ('all'|userId[]), sujet, corps, dateEnvoi,
 *     lu: {userId: boolean} }
 *
 * Stockage : attt_messages (localStorage + Firestore)
 */

'use strict';

const MESSAGES = (() => {

  const KEY = 'attt_messages';

  function _load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function _save(list) {
    /* Limite à 2000 messages pour éviter la saturation */
    const trimmed = list.slice(-2000);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    if (typeof DB !== 'undefined') DB.push(KEY, trimmed);
  }

  /* ── Envoi ────────────────────────────────────────────────── */
  /**
   * @param {object} opts — { deId, deNom, a ('all'|string[]), sujet, corps }
   */
  function send(opts) {
    const msg = {
      id:        'm_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
      de:        opts.deId,
      deNom:     opts.deNom  || '',
      a:         opts.a === 'all' ? 'all' : (Array.isArray(opts.a) ? opts.a : [opts.a]),
      sujet:     (opts.sujet || '').trim(),
      corps:     (opts.corps || '').trim(),
      dateEnvoi: new Date().toISOString(),
      lu:        {}
    };
    if (!msg.sujet) return { ok: false, msg: 'Le sujet est requis.' };
    if (!msg.corps) return { ok: false, msg: 'Le message ne peut pas être vide.' };
    const list = _load();
    list.push(msg);
    _save(list);
    return { ok: true, id: msg.id };
  }

  /* ── Lecture ──────────────────────────────────────────────── */
  /**
   * Retourne les messages reçus par un utilisateur
   * @param {string} userId
   * @param {boolean} unreadOnly
   */
  function getReceived(userId, unreadOnly = false) {
    return _load()
      .filter(m => {
        const dest = m.a === 'all' || (Array.isArray(m.a) && m.a.includes(userId));
        const notSelf = m.de !== userId;
        const unread  = !m.lu?.[userId];
        return dest && notSelf && (!unreadOnly || unread);
      })
      .sort((a, b) => b.dateEnvoi.localeCompare(a.dateEnvoi));
  }

  /** Retourne les messages envoyés par un utilisateur */
  function getSent(userId) {
    return _load()
      .filter(m => m.de === userId)
      .sort((a, b) => b.dateEnvoi.localeCompare(a.dateEnvoi));
  }

  /** Marque un message comme lu */
  function markRead(messageId, userId) {
    const list = _load();
    const msg  = list.find(m => m.id === messageId);
    if (!msg) return;
    if (!msg.lu) msg.lu = {};
    msg.lu[userId] = true;
    _save(list);
  }

  /** Nombre de messages non lus */
  function unreadCount(userId) {
    return getReceived(userId, true).length;
  }

  /** Supprime un message (expéditeur uniquement) */
  function deleteMessage(messageId, userId) {
    const list = _load();
    const msg  = list.find(m => m.id === messageId);
    if (!msg || msg.de !== userId) return false;
    _save(list.filter(m => m.id !== messageId));
    return true;
  }

  /* ── API publique ─────────────────────────────────────────── */
  return { send, getReceived, getSent, markRead, unreadCount, deleteMessage, KEY };
})();
