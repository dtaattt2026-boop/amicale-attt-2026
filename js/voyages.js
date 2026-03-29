'use strict';

/**
 * ATTT Amicale — Module Voyages
 * CRUD voyages + gestion des inscriptions + statistiques
 */
const VOYAGES = (() => {
  const K_VOYAGES = 'attt_voyages';
  const K_REGS    = 'attt_voyages_regs';

  const STATUS = {
    pending:  'en_attente',
    approved: 'valide',
    rejected: 'rejete'
  };

  const TYPES = {
    interne:  { label: 'Voyage intérieur',  icon: 'bi-map',            color: '#17a2b8' },
    etranger: { label: 'Voyage à l\'étranger', icon: 'bi-globe2',     color: '#6f42c1' },
    culturel: { label: 'Sortie culturelle',  icon: 'bi-building',      color: '#fd7e14' },
    detente:  { label: 'Détente & loisirs',  icon: 'bi-sun',           color: '#28a745' }
  };

  const DEFAULT_PAYMENT_MODES = ['Retenue sur salaire', 'Espèces', 'Virement bancaire', 'Chèque'];

  /* ────────────── Persistance ────────────── */
  function _loadVoyages() {
    try { return JSON.parse(localStorage.getItem(K_VOYAGES) || '[]'); } catch { return []; }
  }
  function _saveVoyages(list) {
    localStorage.setItem(K_VOYAGES, JSON.stringify(list));
    if (typeof DB !== 'undefined') DB.push(K_VOYAGES, list);
  }
  function _loadRegs() {
    try { return JSON.parse(localStorage.getItem(K_REGS) || '[]'); } catch { return []; }
  }
  function _saveRegs(list) {
    localStorage.setItem(K_REGS, JSON.stringify(list));
    if (typeof DB !== 'undefined') DB.push(K_REGS, list);
  }

  /* ────────────── Utilitaires ────────────── */
  function _uid() { return 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function _rid() { return 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

  function _parseNum(v) {
    const n = Number(String(v || '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
  }

  function _normalizeVoyage(data) {
    return {
      id:              data.id              || _uid(),
      titre:           (data.titre          || '').trim(),
      destination:     (data.destination    || '').trim(),
      type:            TYPES[data.type]      ? data.type : 'interne',
      dateDepart:      data.dateDepart       || '',
      dateRetour:      data.dateRetour       || '',
      prixAdherent:    _parseNum(data.prixAdherent),
      prixNonAdherent: _parseNum(data.prixNonAdherent),
      prixFamille:     _parseNum(data.prixFamille),
      prixDirection:   _parseNum(data.prixDirection),
      prixDelegue:     _parseNum(data.prixDelegue),
      nbPlaces:        Math.max(0, parseInt(data.nbPlaces) || 0),
      description:     (data.description    || '').trim(),
      photo:           (data.photo          || '').trim(),
      acces:           ['tous','membres','famille'].includes(data.acces) ? data.acces : 'membres',
      programme:       Array.isArray(data.programme) ? data.programme : [],
      responsable:     (data.responsable    || '').trim(),
      contact:         (data.contact        || '').trim(),
      paymentModes:    Array.isArray(data.paymentModes) && data.paymentModes.length
                         ? data.paymentModes
                         : [...DEFAULT_PAYMENT_MODES],
      statut:          ['actif','complet','annule','archive'].includes(data.statut) ? data.statut : 'actif',
      createdAt:       data.createdAt       || Date.now()
    };
  }

  function _normalizeReg(data) {
    return {
      id:          data.id          || _rid(),
      voyageId:    data.voyageId    || '',
      userId:      data.userId      || '',
      userName:    (data.userName   || '').trim(),
      userLogin:   (data.userLogin  || '').trim(),
      status:      [STATUS.pending, STATUS.approved, STATUS.rejected].includes(data.status)
                     ? data.status : STATUS.pending,
      nbPersonnes: Math.max(1, parseInt(data.nbPersonnes) || 1),
      companions:  Array.isArray(data.companions) ? data.companions : [],
      montant:     _parseNum(data.montant),
      paymentMode: (data.paymentMode || '').trim(),
      note:        (data.note        || '').trim(),
      adminNote:   (data.adminNote   || '').trim(),
      createdAt:   data.createdAt    || Date.now()
    };
  }

  /* ────────────── API Voyages ────────────── */
  function getVoyages() {
    return _loadVoyages().map(_normalizeVoyage);
  }

  function getVoyage(id) {
    return getVoyages().find(v => v.id === id) || null;
  }

  function addVoyage(data) {
    const list = _loadVoyages();
    const voyage = _normalizeVoyage({ ...data, id: _uid(), createdAt: Date.now() });
    list.push(voyage);
    _saveVoyages(list);
    return voyage;
  }

  function updateVoyage(id, data) {
    const list = _loadVoyages();
    const idx  = list.findIndex(v => v.id === id);
    if (idx < 0) return null;
    const updated = _normalizeVoyage({ ...list[idx], ...data, id });
    list[idx] = updated;
    _saveVoyages(list);
    return updated;
  }

  function deleteVoyage(id) {
    const list = _loadVoyages().filter(v => v.id !== id);
    _saveVoyages(list);
    // Supprimer aussi les inscriptions liées
    const regs = _loadRegs().filter(r => r.voyageId !== id);
    _saveRegs(regs);
  }

  /* ────────────── API Inscriptions ────────────── */
  function getRegistrations(voyageId) {
    const all = _loadRegs().map(_normalizeReg);
    return voyageId ? all.filter(r => r.voyageId === voyageId) : all;
  }

  function getUserRegistration(voyageId, userId) {
    return _loadRegs().map(_normalizeReg)
      .find(r => r.voyageId === voyageId && r.userId === userId) || null;
  }

  function saveRegistration(data) {
    const regs = _loadRegs();
    // Empêcher double inscription
    const exists = regs.findIndex(r => r.voyageId === data.voyageId && r.userId === data.userId);
    const reg = _normalizeReg(data);
    if (exists >= 0) {
      reg.id = regs[exists].id;
      reg.createdAt = regs[exists].createdAt;
      regs[exists] = reg;
    } else {
      reg.id = _rid();
      reg.createdAt = Date.now();
      regs.push(reg);
    }
    _saveRegs(regs);
    return reg;
  }

  function setRegistrationStatus(regId, status, adminNote = '') {
    if (![STATUS.pending, STATUS.approved, STATUS.rejected].includes(status)) return null;
    const regs = _loadRegs();
    const idx  = regs.findIndex(r => r.id === regId);
    if (idx < 0) return null;
    regs[idx].status    = status;
    regs[idx].adminNote = adminNote;
    _saveRegs(regs);
    return _normalizeReg(regs[idx]);
  }

  /* ────────────── Places restantes ────────────── */
  function getPlacesRestantes(voyageId) {
    const voyage = getVoyage(voyageId);
    if (!voyage) return 0;
    if (voyage.nbPlaces <= 0) return Infinity; // illimité
    const inscrits = getRegistrations(voyageId)
      .filter(r => r.status !== STATUS.rejected)
      .reduce((sum, r) => sum + r.nbPersonnes, 0);
    return Math.max(0, voyage.nbPlaces - inscrits);
  }

  function isAvailable(voyageId) {
    const voyage = getVoyage(voyageId);
    if (!voyage || voyage.statut === 'annule' || voyage.statut === 'archive') return false;
    if (voyage.statut === 'complet') return false;
    return getPlacesRestantes(voyageId) > 0 || voyage.nbPlaces <= 0;
  }

  /* ────────────── Statistiques ────────────── */
  function getStats(voyageId) {
    const regs = getRegistrations(voyageId);
    const approved = regs.filter(r => r.status === STATUS.approved);
    const pending  = regs.filter(r => r.status === STATUS.pending);
    const rejected = regs.filter(r => r.status === STATUS.rejected);
    return {
      total:          regs.length,
      approuves:      approved.length,
      enAttente:      pending.length,
      rejetes:        rejected.length,
      nbPersonnes:    approved.reduce((s, r) => s + r.nbPersonnes, 0),
      montantTotal:   approved.reduce((s, r) => s + r.montant, 0)
    };
  }

  function getGlobalStats() {
    const voyages = getVoyages();
    const allRegs = getRegistrations();
    return {
      nbVoyages:      voyages.length,
      nbActifs:       voyages.filter(v => v.statut === 'actif').length,
      nbInscrits:     allRegs.filter(r => r.status === STATUS.approved).length,
      montantTotal:   allRegs
                        .filter(r => r.status === STATUS.approved)
                        .reduce((s, r) => s + r.montant, 0)
    };
  }

  /* ────────────── Métadonnées ────────────── */
  function getTypes()         { return { ...TYPES }; }
  function getStatusMeta(s)   {
    return {
      en_attente: { label: 'En attente', cls: 'warning',  icon: 'bi-clock' },
      valide:     { label: 'Validé',     cls: 'success',  icon: 'bi-check-circle-fill' },
      rejete:     { label: 'Rejeté',     cls: 'danger',   icon: 'bi-x-circle-fill' }
    }[s] || { label: s, cls: 'secondary', icon: 'bi-question' };
  }
  function getStatutMeta(s)   {
    return {
      actif:   { label: 'Ouvert',    cls: 'success', icon: 'bi-check-circle' },
      complet: { label: 'Complet',   cls: 'warning', icon: 'bi-people-fill' },
      annule:  { label: 'Annulé',    cls: 'danger',  icon: 'bi-x-circle' },
      archive: { label: 'Archivé',   cls: 'secondary',icon: 'bi-archive' }
    }[s] || { label: s, cls: 'secondary', icon: 'bi-question' };
  }
  function getPaymentModes()  { return [...DEFAULT_PAYMENT_MODES]; }

  /* ────────────── Init données démo ────────────── */
  function _initDefaults() {
    if (localStorage.getItem(K_VOYAGES)) return;
    const now = Date.now();
    _saveVoyages([
      _normalizeVoyage({
        id: 'v_demo1', titre: 'Découverte de Tabarka', destination: 'Tabarka, Jendouba',
        type: 'interne', dateDepart: '2025-07-15', dateRetour: '2025-07-18',
        prixAdherent: 180, prixNonAdherent: 220, prixFamille: 320, prixDirection: 150, prixDelegue: 160,
        nbPlaces: 40, description: 'Séjour balnéaire à Tabarka avec visites culturelles, plongée et détente.',
        acces: 'membres', responsable: 'Direction ATTT', contact: 'contact@attt.tn',
        statut: 'actif', createdAt: now - 86400000 * 3
      }),
      _normalizeVoyage({
        id: 'v_demo2', titre: 'Escapade à Djerba', destination: 'Djerba, Médenine',
        type: 'interne', dateDepart: '2025-08-20', dateRetour: '2025-08-24',
        prixAdherent: 250, prixNonAdherent: 300, prixFamille: 420, prixDirection: 200, prixDelegue: 220,
        nbPlaces: 50, description: 'Découvrez la perle de la Méditerranée : plages, artisanat et cuisine locale.',
        acces: 'tous', responsable: 'Direction ATTT', contact: 'contact@attt.tn',
        statut: 'actif', createdAt: now - 86400000
      })
    ]);
  }

  _initDefaults();

  return {
    getVoyages, getVoyage,
    addVoyage, updateVoyage, deleteVoyage,
    getRegistrations, getUserRegistration,
    saveRegistration, setRegistrationStatus,
    getPlacesRestantes, isAvailable,
    getStats, getGlobalStats,
    getTypes, getStatusMeta, getStatutMeta, getPaymentModes,
    STATUS
  };
})();
