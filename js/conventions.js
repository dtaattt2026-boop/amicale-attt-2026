/**
 * conventions.js — Module Conventions de l'Amicale
 *
 * Structure d'une convention :
 *   { id, titre, partenaire, description, dateDebut, dateFin,
 *     acces ('tous'|'membres'|'famille'),
 *     categorie ('reduction'|'loisir'|'sante'|'logement'|'autre'),
 *     conditions, contact, photo|null, actif }
 *
 * Stockage : attt_conventions (localStorage + Firestore)
 */

'use strict';

const CONVENTIONS = (() => {

  const KEY = 'attt_conventions';

  const DEFAULTS = [
    {
      id: 'c1',
      titre: 'Réduction centre sportif municipal',
      partenaire: 'Centre Sportif Alger Centre',
      description: 'Accès illimité à la salle de musculation et piscine pour les membres de l\'Amicale et leurs familles.',
      dateDebut: '2026-01-01', dateFin: '2026-12-31',
      acces: 'famille', categorie: 'loisir',
      conditions: 'Présenter la carte d\'adhésion Amicale ATTT. Tarif : 1500 DA/mois au lieu de 3000 DA.',
      contact: 'Tel: 023 XX XX XX', photo: null, actif: true
    },
    {
      id: 'c2',
      titre: 'Convention médicale — Clinique Al Shifa',
      partenaire: 'Clinique Al Shifa',
      description: 'Consultations médicales et analyses à tarifs préférentiels pour les agents et leurs familles.',
      dateDebut: '2026-01-01', dateFin: '2026-12-31',
      acces: 'famille', categorie: 'sante',
      conditions: '30% de réduction sur consultations, 20% sur analyses. Présenter attestation de travail.',
      contact: 'Tel: 021 XX XX XX', photo: null, actif: true
    }
  ];

  /* ── Persistance ──────────────────────────────────────────── */
  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; }
    catch { return null; }
  }
  function _save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    if (typeof DB !== 'undefined') DB.push(KEY, list);
  }
  function _bootstrap() {
    if (!_load()) _save(DEFAULTS);
  }

  /* ── CRUD ─────────────────────────────────────────────────── */
  function getConventions(filters = {}) {
    _bootstrap();
    let list = _load();
    const now = new Date().toISOString().split('T')[0];

    if (filters.actif !== undefined) list = list.filter(c => c.actif === filters.actif);
    if (filters.acces)               list = list.filter(c => c.acces === filters.acces || c.acces === 'tous');
    if (filters.categorie)           list = list.filter(c => c.categorie === filters.categorie);
    if (filters.enCours)             list = list.filter(c => c.dateDebut <= now && (!c.dateFin || c.dateFin >= now));
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(c =>
        c.titre.toLowerCase().includes(q) ||
        c.partenaire.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      if (a.actif !== b.actif) return a.actif ? -1 : 1;
      return a.dateDebut.localeCompare(b.dateDebut);
    });
  }

  function getConvention(id) {
    _bootstrap();
    return _load().find(c => c.id === id) || null;
  }

  function addConvention(data) {
    _bootstrap();
    const list = _load();
    const conv = {
      id:          'c_' + Date.now(),
      titre:       (data.titre || '').trim(),
      partenaire:  (data.partenaire || '').trim(),
      description: (data.description || '').trim(),
      dateDebut:   data.dateDebut || '',
      dateFin:     data.dateFin   || '',
      acces:       data.acces     || 'membres',
      categorie:   data.categorie || 'autre',
      conditions:  (data.conditions || '').trim(),
      contact:     (data.contact   || '').trim(),
      photo:       data.photo      || null,
      actif:       data.actif !== false
    };
    list.push(conv);
    _save(list);
    return conv;
  }

  function updateConvention(id, changes) {
    const list = _load();
    if (!list) return false;
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return false;
    Object.assign(list[idx], changes);
    _save(list);
    return true;
  }

  function deleteConvention(id) {
    const list = _load();
    if (!list) return false;
    _save(list.filter(c => c.id !== id));
    return true;
  }

  /* ── Labels ────────────────────────────────────────────────── */
  const CAT_LABELS = {
    reduction: 'Réduction', loisir: 'Loisirs', sante: 'Santé',
    logement: 'Logement', autre: 'Autre'
  };
  const CAT_COLORS = {
    reduction: 'warning', loisir: 'primary', sante: 'success',
    logement: 'info', autre: 'secondary'
  };
  const ACCES_LABELS = { tous: 'Tous', membres: 'Membres', famille: 'Membres & Famille' };

  /* ── API publique ─────────────────────────────────────────── */
  return {
    getConventions, getConvention, addConvention, updateConvention, deleteConvention,
    CAT_LABELS, CAT_COLORS, ACCES_LABELS, KEY
  };
})();
