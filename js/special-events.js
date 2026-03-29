'use strict';

const SPECIAL_EVENT = (() => {
  const KEY = 'attt_special_event_registrations';
  const TYPE = 'journee-savoir';
  const STATUS = {
    pending: 'en_attente',
    approved: 'valide',
    rejected: 'rejete'
  };
  const DEFAULT_PAYMENT_MODES = ['Retenue sur salaire', 'Espèces', 'Virement'];
  const STUDY_LEVELS = [
    { value: 'primaire6', label: '6ème année Primaire' },
    { value: 'base9', label: '9ème année de Base' },
    { value: 'bac', label: 'Baccalauréat' },
    { value: 'licence', label: 'Licence' },
    { value: 'master', label: 'Master' },
    { value: 'doctorat', label: 'Doctorat' }
  ];
  const RULES = {
    primaire6: { label: '6ème année Primaire', successRequired: true, minAverage: 15 },
    base9: { label: '9ème année de Base', successRequired: true, minAverage: 13 },
    bac: { label: 'Baccalauréat', successRequired: true, minAverage: null },
    licence: { label: 'Licence', successRequired: true, minAverage: null },
    master: { label: 'Master', successRequired: true, minAverage: null },
    doctorat: { label: 'Doctorat', successRequired: true, minAverage: null }
  };

  function _load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  }

  function _save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    if (typeof DB !== 'undefined') DB.push(KEY, list);
  }

  function parseNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
  }

  function normalizePaymentModes(value) {
    if (Array.isArray(value)) {
      const cleaned = value.map(item => String(item || '').trim()).filter(Boolean);
      return cleaned.length ? cleaned : [...DEFAULT_PAYMENT_MODES];
    }
    const text = String(value || '').trim();
    if (!text) return [...DEFAULT_PAYMENT_MODES];
    const parts = text.split(/[\n,;|]/).map(item => item.trim()).filter(Boolean);
    return parts.length ? parts : [...DEFAULT_PAYMENT_MODES];
  }

  function normalizeConfig(config = {}) {
    const paymentModes = normalizePaymentModes(config.paymentModes || config.modePaiementOptions);
    const defaultPaymentMode = paymentModes.includes(config.defaultPaymentMode)
      ? config.defaultPaymentMode
      : paymentModes[0] || DEFAULT_PAYMENT_MODES[0];
    return {
      beneficiaryPrice: parseNumber(config.beneficiaryPrice ?? config.prixBeneficiaire),
      adherentPrice: parseNumber(config.adherentPrice ?? config.prixAdherent),
      nonAdherentPrice: parseNumber(config.nonAdherentPrice ?? config.prixNonAdherent),
      directionPrice: parseNumber(config.directionPrice ?? config.prixDirection),
      delegatePrice: parseNumber(config.delegatePrice ?? config.prixDelegue),
      familyPrice: parseNumber(config.familyPrice ?? config.prixFamille ?? config.adherentPrice ?? config.prixAdherent),
      paymentModes,
      defaultPaymentMode,
      diplomaFolder: String(config.diplomaFolder || config.dossierDiplome || 'diplome').trim() || 'diplome'
    };
  }

  function isSpecialEvent(event) {
    return String(event?.eventType || '').trim().toLowerCase() === TYPE;
  }

  function getRules() {
    return RULES;
  }

  function getStudyLevels() {
    return STUDY_LEVELS.map(item => ({ ...item }));
  }

  function evaluateBeneficiary(beneficiary) {
    const level = String(beneficiary?.studyLevel || '').trim();
    const rule = RULES[level];
    if (!rule) {
      return { eligible: false, reason: 'Niveau d\'études invalide.', rule: null };
    }
    const success = beneficiary?.success === true;
    const average = beneficiary?.average === '' || beneficiary?.average === null || beneficiary?.average === undefined
      ? null
      : parseNumber(beneficiary.average);
    if (rule.successRequired && !success) {
      return { eligible: false, reason: 'Succès requis.', rule };
    }
    if (rule.minAverage !== null && average === null) {
      return { eligible: false, reason: 'Moyenne requise.', rule };
    }
    if (rule.minAverage !== null && average < rule.minAverage) {
      return { eligible: false, reason: `Moyenne minimale ${rule.minAverage}/20 requise.`, rule };
    }
    return { eligible: true, reason: '', rule, average };
  }

  function getRolePricingCategory(user) {
    if (!user) return 'non_adherent';
    if (typeof AUTH !== 'undefined') {
      if (AUTH.hasRole(user, 'master') || AUTH.hasRole(user, 'superviseur')) return 'direction';
      if (AUTH.hasRole(user, 'admin')) return 'delegue';
    }
    return 'adherent';
  }

  function getPriceForCategory(event, category) {
    const config = normalizeConfig(event?.specialConfig || {});
    switch (category) {
      case 'beneficiaire':
        return config.beneficiaryPrice;
      case 'direction':
        return config.directionPrice;
      case 'delegue':
        return config.delegatePrice;
      case 'famille':
        return config.familyPrice;
      case 'non_adherent':
        return config.nonAdherentPrice;
      case 'adherent':
      default:
        return config.adherentPrice;
    }
  }

  function _normalizeBeneficiary(item, event) {
    const review = evaluateBeneficiary(item);
    const present = item?.present !== false;
    const amount = present && review.eligible ? getPriceForCategory(event, 'beneficiaire') : 0;
    return {
      id: item?.id || ('ben_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
      nom: String(item?.nom || '').trim().toUpperCase(),
      prenom: String(item?.prenom || '').trim(),
      studyLevel: String(item?.studyLevel || '').trim(),
      success: item?.success === true,
      average: item?.average === '' || item?.average === null || item?.average === undefined ? null : parseNumber(item.average),
      present,
      qualifies: review.eligible,
      reason: review.reason,
      documentUrl: String(item?.documentUrl || '').trim(),
      documentPath: String(item?.documentPath || '').trim(),
      documentProvider: String(item?.documentProvider || '').trim(),
      documentName: String(item?.documentName || '').trim(),
      amount
    };
  }

  function _normalizeCompanion(item, event) {
    const baseCategory = String(item?.category || 'externe').trim();
    const defaultPricingCategory = baseCategory === 'externe'
      ? 'non_adherent'
      : (baseCategory === 'famille' ? 'famille' : baseCategory);
    const pricingCategory = String(item?.pricingCategory || defaultPricingCategory).trim();
    const present = item?.present !== false;
    return {
      id: item?.id || ('acc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
      category: baseCategory,
      pricingCategory,
      linkedUserId: String(item?.linkedUserId || '').trim(),
      linkedFamilyId: String(item?.linkedFamilyId || '').trim(),
      nom: String(item?.nom || '').trim().toUpperCase(),
      prenom: String(item?.prenom || '').trim(),
      present,
      amount: present ? getPriceForCategory(event, pricingCategory) : 0
    };
  }

  function calculateTotals(event, user, payload) {
    const applicantCategory = getRolePricingCategory(user);
    const applicantPresent = payload?.applicantPresent === true;
    const beneficiaries = (payload?.beneficiaries || []).map(item => _normalizeBeneficiary(item, event));
    const companions = (payload?.companions || []).map(item => _normalizeCompanion(item, event));
    const beneficiariesPresent = beneficiaries.filter(item => item.present && item.qualifies).length;
    const applicantAmount = applicantPresent ? getPriceForCategory(event, applicantCategory) : 0;
    const beneficiariesAmount = beneficiaries.reduce((sum, item) => sum + item.amount, 0);
    const companionsAmount = companions.reduce((sum, item) => sum + item.amount, 0);
    return {
      applicantCategory,
      applicantPresent,
      applicantAmount,
      beneficiaries,
      beneficiariesPresent,
      beneficiariesAmount,
      companions,
      companionsAmount,
      total: Math.round((applicantAmount + beneficiariesAmount + companionsAmount) * 100) / 100
    };
  }

  function validateRegistration(event, user, payload) {
    if (!isSpecialEvent(event)) throw new Error('Cet événement n\'est pas configuré comme événement spécial.');
    const config = normalizeConfig(event.specialConfig || {});
    const totals = calculateTotals(event, user, payload);
    if (!totals.beneficiaries.length) throw new Error('Ajoutez au moins un bénéficiaire.');
    const invalid = totals.beneficiaries.find(item => !item.nom || !item.prenom || !item.studyLevel || !item.documentUrl || !item.qualifies);
    if (invalid) {
      if (!invalid.nom || !invalid.prenom || !invalid.studyLevel) throw new Error('Tous les bénéficiaires doivent être complètement renseignés.');
      if (!invalid.documentUrl) throw new Error('Chaque bénéficiaire doit avoir un diplôme ou relevé téléversé.');
      if (!invalid.qualifies) throw new Error(`Le bénéficiaire ${invalid.prenom} ${invalid.nom} n\'est pas éligible : ${invalid.reason}`);
    }
    if (!payload?.paymentMode || !config.paymentModes.includes(payload.paymentMode)) {
      throw new Error('Choisissez un mode de paiement valide.');
    }
    return totals;
  }

  function getRegistrations() {
    return _load().slice().sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  }

  function getEventRegistrations(eventId) {
    return getRegistrations().filter(item => item.eventId === eventId);
  }

  function getUserRegistration(eventId, userId) {
    return getRegistrations().find(item => item.eventId === eventId && item.userId === userId) || null;
  }

  function saveRegistration(event, user, payload) {
    const totals = validateRegistration(event, user, payload);
    const list = _load();
    const now = new Date().toISOString();
    const existingIndex = list.findIndex(item => item.eventId === event.id && item.userId === user.id);
    const current = existingIndex >= 0 ? list[existingIndex] : null;
    const record = {
      id: current?.id || ('se_' + Date.now()),
      eventId: event.id,
      eventTitle: event.titre,
      userId: user.id,
      userName: [user.prenom, user.nom].filter(Boolean).join(' ').trim(),
      userLogin: user.login,
      status: current?.status === STATUS.approved ? STATUS.approved : STATUS.pending,
      paymentMode: payload.paymentMode,
      notes: String(payload?.notes || '').trim(),
      applicantPresent: totals.applicantPresent,
      applicantCategory: totals.applicantCategory,
      applicantAmount: totals.applicantAmount,
      beneficiaries: totals.beneficiaries,
      companions: totals.companions,
      totals: {
        beneficiariesPresent: totals.beneficiariesPresent,
        beneficiariesAmount: totals.beneficiariesAmount,
        companionsAmount: totals.companionsAmount,
        total: totals.total
      },
      createdAt: current?.createdAt || now,
      updatedAt: now,
      reviewedAt: current?.reviewedAt || '',
      reviewedBy: current?.reviewedBy || '',
      reviewedByName: current?.reviewedByName || '',
      adminNote: current?.adminNote || ''
    };
    if (existingIndex >= 0) list.splice(existingIndex, 1, record);
    else list.push(record);
    _save(list);
    if (typeof PAYMENTS !== 'undefined') {
      if (record.totals.total > 0) PAYMENTS.createPaymentSchedule(user.id, event, record.totals.total);
      else if (typeof PAYMENTS.clearUserEventPayments === 'function') PAYMENTS.clearUserEventPayments(user.id, event.id);
    }
    return record;
  }

  function setRegistrationStatus(registrationId, status, actor, note = '') {
    const list = _load();
    const index = list.findIndex(item => item.id === registrationId);
    if (index === -1) return false;
    const current = list[index];
    current.status = status;
    current.reviewedAt = new Date().toISOString();
    current.reviewedBy = actor?.id || '';
    current.reviewedByName = actor ? [actor.prenom, actor.nom].filter(Boolean).join(' ').trim() : '';
    current.adminNote = String(note || '').trim();
    list[index] = current;
    _save(list);
    if (typeof PAYMENTS !== 'undefined' && typeof PAYMENTS.clearUserEventPayments === 'function' && status === STATUS.rejected) {
      PAYMENTS.clearUserEventPayments(current.userId, current.eventId);
    }
    return true;
  }

  function getStatusMeta(status) {
    switch (status) {
      case STATUS.approved:
        return { label: 'Validé', badge: 'bg-success' };
      case STATUS.rejected:
        return { label: 'Rejeté', badge: 'bg-danger' };
      case STATUS.pending:
      default:
        return { label: 'En attente', badge: 'bg-warning text-dark' };
    }
  }

  return {
    KEY,
    TYPE,
    STATUS,
    DEFAULT_PAYMENT_MODES,
    normalizeConfig,
    isSpecialEvent,
    getRules,
    getStudyLevels,
    evaluateBeneficiary,
    getRolePricingCategory,
    getPriceForCategory,
    calculateTotals,
    getRegistrations,
    getEventRegistrations,
    getUserRegistration,
    saveRegistration,
    setRegistrationStatus,
    getStatusMeta
  };
})();