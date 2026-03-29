/**
 * payments.js — Module Gestion des paiements événements
 *
 * Structure d'un paiement :
 *   { id, userId, eventId, echeanceId, montant, datePrev, datePaiement|null,
 *     statut ('en_attente'|'paye'|'retard'), note, valideurId|null }
 *
 * Structure d'une modalité de paiement (champ d'un événement) :
 *   { id, label, pourcentage, dateEcheance, description }
 *
 * Stockage : attt_payments (localStorage + Firestore)
 */

'use strict';

const PAYMENTS = (() => {

  const KEY = 'attt_payments';

  function _load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function _save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    if (typeof DB !== 'undefined') DB.push(KEY, list);
  }

  /* ── Créer les échéances d'un utilisateur pour un événement ── */
  /**
   * Génère les lignes de paiement à partir des modalités de l'événement
   * @param {string} userId
   * @param {object} event — l'événement complet
   * @param {number} montantTotal — montant total à payer par l'utilisateur
   */
  function createPaymentSchedule(userId, event, montantTotal) {
    const list = _load();
    /* Supprimer d'éventuels anciens paiements pour ce couple user/event */
    const cleaned = list.filter(p => !(p.userId === userId && p.eventId === event.id));

    const modalites = Array.isArray(event.modalitesPaiement) ? event.modalitesPaiement : [];
    let   reste     = montantTotal;

    if (modalites.length === 0) {
      /* Paiement unique */
      cleaned.push({
        id:          'pay_' + Date.now() + '_0',
        userId, eventId: event.id,
        echeanceId:  'e0', label: 'Paiement intégral',
        montant:     montantTotal,
        datePrev:    event.dateLimitPaiement || event.date || '',
        datePaiement: null, statut: 'en_attente', note: '', valideurId: null
      });
    } else {
      modalites.forEach((m, i) => {
        const montant = i < modalites.length - 1
          ? Math.round(montantTotal * (m.pourcentage / 100) * 100) / 100
          : reste;
        reste -= montant;
        cleaned.push({
          id:           'pay_' + Date.now() + '_' + i,
          userId, eventId: event.id,
          echeanceId:   m.id || ('e' + i),
          label:        m.label || ('Échéance ' + (i + 1)),
          montant,
          datePrev:     m.dateEcheance || '',
          datePaiement: null,
          statut:       'en_attente',
          note:         m.description || '',
          valideurId:   null
        });
      });
    }
    _save(cleaned);
    return cleaned.filter(p => p.userId === userId && p.eventId === event.id);
  }

  /* ── Marquer une échéance comme payée ─────────────────────── */
  function markPaid(paymentId, valideurId, note = '') {
    const list = _load();
    const p    = list.find(x => x.id === paymentId);
    if (!p) return false;
    p.statut       = 'paye';
    p.datePaiement = new Date().toISOString().split('T')[0];
    p.valideurId   = valideurId;
    if (note) p.note = note;
    _save(list);
    return true;
  }

  function markUnpaid(paymentId) {
    const list = _load();
    const p    = list.find(x => x.id === paymentId);
    if (!p) return false;
    p.statut       = 'en_attente';
    p.datePaiement = null;
    p.valideurId   = null;
    _save(list);
    return true;
  }

  /* ── Calcul des retards ───────────────────────────────────── */
  function refreshStatuts() {
    const list = _load();
    const now  = new Date().toISOString().split('T')[0];
    list.forEach(p => {
      if (p.statut === 'en_attente' && p.datePrev && p.datePrev < now) {
        p.statut = 'retard';
      } else if (p.statut === 'retard' && (!p.datePrev || p.datePrev >= now)) {
        p.statut = 'en_attente';
      }
    });
    _save(list);
  }

  /* ── Lecture ──────────────────────────────────────────────── */
  function getUserPayments(userId) {
    refreshStatuts();
    return _load().filter(p => p.userId === userId).sort((a, b) => a.datePrev.localeCompare(b.datePrev));
  }

  function getEventPayments(eventId) {
    refreshStatuts();
    return _load().filter(p => p.eventId === eventId);
  }

  function getUserEventPayments(userId, eventId) {
    refreshStatuts();
    return _load().filter(p => p.userId === userId && p.eventId === eventId);
  }

  function clearUserEventPayments(userId, eventId) {
    const filtered = _load().filter(p => !(p.userId === userId && p.eventId === eventId));
    _save(filtered);
    return true;
  }

  /** Solde restant à payer pour un user/event */
  function getBalance(userId, eventId) {
    const payments = getUserEventPayments(userId, eventId);
    const total    = payments.reduce((s, p) => s + p.montant, 0);
    const paye     = payments.filter(p => p.statut === 'paye').reduce((s, p) => s + p.montant, 0);
    return { total: Math.round(total * 100) / 100, paye: Math.round(paye * 100) / 100, reste: Math.round((total - paye) * 100) / 100 };
  }

  /* ── API publique ─────────────────────────────────────────── */
  return {
    createPaymentSchedule, markPaid, markUnpaid, refreshStatuts,
    getUserPayments, getEventPayments, getUserEventPayments, clearUserEventPayments, getBalance,
    KEY
  };
})();
