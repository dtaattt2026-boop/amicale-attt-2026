/**
 * ATTT Amicale — Gestion des données (événements & offres)
 * Stockage : localStorage
 */

'use strict';

const DATA = (() => {

  const K_EVENTS = 'attt_events';
  const K_OFFERS = 'attt_offers';
  const DEFAULT_SPECIAL_PAYMENT_MODES = ['Retenue sur salaire', 'Espèces', 'Virement'];
  const ACCESS_LABELS = {
    tous: 'Tous',
    famille: 'Famille+',
    membres: 'Membres uniquement'
  };

  /* ── Helpers persistance (localStorage + Firestore) ─────── */
  function _saveEvents(list) { localStorage.setItem(K_EVENTS, JSON.stringify(list)); if (typeof DB !== 'undefined') DB.push(K_EVENTS, list); }
  function _saveOffers(list) { localStorage.setItem(K_OFFERS, JSON.stringify(list)); if (typeof DB !== 'undefined') DB.push(K_OFFERS, list); }

  function _directDriveUrl(url) {
    const value = String(url || '').trim();
    const match = value.match(/\/d\/([a-zA-Z0-9_-]+)/) || value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!match) return value;
    return 'https://drive.google.com/uc?export=download&id=' + match[1];
  }

  function normalizePhotoUrl(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    if (!/drive\.google\.com/.test(value)) return value;
    return _directDriveUrl(value);
  }

  function normalizeAccess(access, fallback = 'tous') {
    const value = String(access || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(ACCESS_LABELS, value) ? value : fallback;
  }

  function getAccessLabel(access) {
    return ACCESS_LABELS[normalizeAccess(access)] || ACCESS_LABELS.tous;
  }

  function normalizeSpecialPaymentModes(value) {
    if (Array.isArray(value)) {
      const cleaned = value.map(item => String(item || '').trim()).filter(Boolean);
      return cleaned.length ? cleaned : [...DEFAULT_SPECIAL_PAYMENT_MODES];
    }
    const text = String(value || '').trim();
    if (!text) return [...DEFAULT_SPECIAL_PAYMENT_MODES];
    const parts = text.split(/[\n,;|]/).map(item => item.trim()).filter(Boolean);
    return parts.length ? parts : [...DEFAULT_SPECIAL_PAYMENT_MODES];
  }

  function normalizeSpecialConfig(config = {}) {
    const paymentModes = normalizeSpecialPaymentModes(config.paymentModes || config.modePaiementOptions);
    const defaultPaymentMode = paymentModes.includes(config.defaultPaymentMode)
      ? config.defaultPaymentMode
      : paymentModes[0] || DEFAULT_SPECIAL_PAYMENT_MODES[0];
    return {
      beneficiaryPrice: Number(config.beneficiaryPrice ?? config.prixBeneficiaire) || 0,
      adherentPrice: Number(config.adherentPrice ?? config.prixAdherent) || 0,
      nonAdherentPrice: Number(config.nonAdherentPrice ?? config.prixNonAdherent) || 0,
      directionPrice: Number(config.directionPrice ?? config.prixDirection) || 0,
      delegatePrice: Number(config.delegatePrice ?? config.prixDelegue) || 0,
      familyPrice: Number(config.familyPrice ?? config.prixFamille ?? config.adherentPrice ?? config.prixAdherent) || 0,
      paymentModes,
      defaultPaymentMode,
      diplomaFolder: String(config.diplomaFolder || config.dossierDiplome || 'diplome').trim() || 'diplome'
    };
  }

  function canUserAccess(access, user) {
    const normalized = normalizeAccess(access);
    if (normalized === 'tous') return true;
    if (!user) return false;
    if (normalized === 'famille') return typeof AUTH !== 'undefined' ? AUTH.hasRole(user, 'famille') : user.role === 'famille';
    if (normalized === 'membres') return typeof AUTH !== 'undefined' ? AUTH.hasRole(user, 'membre') : user.role === 'membre';
    return true;
  }

  function _normalizeEvent(evt) {
    return {
      ...evt,
      acces: normalizeAccess(evt?.acces, 'tous'),
      photo: normalizePhotoUrl(evt?.photo),
      eventType: String(evt?.eventType || 'standard').trim().toLowerCase() || 'standard',
      dateFin: evt?.dateFin || evt?.date || '',
      dateLimitConfirmation: evt?.dateLimitConfirmation || evt?.dateLimitParticipation || '',
      specialConfig: normalizeSpecialConfig(evt?.specialConfig || {})
    };
  }

  function _normalizeOffer(offer) {
    return {
      ...offer,
      acces: normalizeAccess(offer?.acces, 'membres'),
      photo: normalizePhotoUrl(offer?.photo)
    };
  }

  /* ── Données initiales ───────────────────────────────────── */
  const DEFAULTS_EVENTS = [
    {
      id: 'e1', titre: 'Tournoi de football inter-services',
      date: '2026-04-15', heure: '09:00',
      lieu: 'Stade municipal — Alger',
      description: 'Tournoi annuel opposant les différents services de l\'ATTT. Inscriptions ouvertes jusqu\'au 10 avril.',
      categorie: 'sport', acces: 'tous',
      photo: '',
      /* Champs étendus */
      dateLimitParticipation: '2026-04-10',
      nbMinParticipants: 10, nbMaxParticipants: 60,
      quotaMin: 1, quotaMax: 1,
      prixParticipant: 0,
      modalitesPaiement: [],
      dateLimitPaiement: '',
      locationConfig: null
    },
    {
      id: 'e2', titre: 'Excursion à Tipaza',
      date: '2026-05-03', heure: '07:00',
      lieu: 'Tipaza — Départ siège ATTT',
      description: 'Journée découverte des sites archéologiques de Tipaza. Transport organisé, pique-nique partagé. Places limitées.',
      categorie: 'culture', acces: 'membres',
      photo: '',
      dateLimitParticipation: '2026-04-25',
      nbMinParticipants: 20, nbMaxParticipants: 45,
      quotaMin: 1, quotaMax: 4,
      prixParticipant: 1500,
      modalitesPaiement: [
        { id: 'mp1', label: 'Acompte 30%', pourcentage: 30, dateEcheance: '2026-04-25', description: 'Acompte à verser lors de l\'inscription' },
        { id: 'mp2', label: 'Solde 70%', pourcentage: 70, dateEcheance: '2026-05-01', description: 'Solde dû 2 jours avant l\'excursion' }
      ],
      dateLimitPaiement: '2026-05-01',
      locationConfig: null
    },
    {
      id: 'e3', titre: 'Fête des enfants — Kermesse de fin d\'année',
      date: '2026-06-20', heure: '10:00',
      lieu: 'Jardin de l\'ATTT',
      description: 'Grande fête annuelle pour les enfants des salariés. Jeux, animations, spectacle et repas partagé.',
      categorie: 'famille', acces: 'tous',
      photo: '',
      dateLimitParticipation: '2026-06-10',
      nbMinParticipants: 0, nbMaxParticipants: 200,
      quotaMin: 1, quotaMax: 8,
      prixParticipant: 0,
      modalitesPaiement: [],
      dateLimitPaiement: '',
      locationConfig: null
    },
    {
      id: 'e4', titre: 'Journée du Savoir / يوم العلم',
      date: '2026-07-25', dateFin: '2026-07-25', heure: '09:30',
      lieu: 'Siège ATTT — Salle polyvalente',
      description: 'Cérémonie dédiée aux lauréats des familles ATTT avec confirmation, dépôt des diplômes et gestion des accompagnateurs.',
      categorie: 'famille', acces: 'membres',
      eventType: 'journee-savoir',
      photo: '',
      dateLimitParticipation: '2026-07-10',
      dateLimitConfirmation: '2026-07-10',
      nbMinParticipants: 0, nbMaxParticipants: 250,
      quotaMin: 1, quotaMax: 20,
      prixParticipant: 0,
      modalitesPaiement: [],
      dateLimitPaiement: '2026-07-15',
      locationConfig: null,
      specialConfig: {
        beneficiaryPrice: 0,
        adherentPrice: 30,
        nonAdherentPrice: 50,
        directionPrice: 20,
        delegatePrice: 25,
        familyPrice: 30,
        paymentModes: ['Retenue sur salaire', 'Espèces', 'Virement'],
        defaultPaymentMode: 'Retenue sur salaire',
        diplomaFolder: 'diplome'
      }
    }
  ];

  const DEFAULTS_OFFERS = [
    {
      id: 'o1', titre: 'Réduction cinéma — 30% de remise',
      partenaire: 'Cinéma Cosmos Alger',
      description: 'Bénéficiez de 30 % de réduction sur toutes les séances en présentant votre carte Amicale.',
      reduction: '30%', dateExpiration: '2026-12-31', code: 'ATTT2026', acces: 'famille', photo: ''
    },
    {
      id: 'o2', titre: 'Abonnement salle de sport',
      partenaire: 'Olympic Fitness Center',
      description: 'Abonnement mensuel à 2 000 TND au lieu de 3 500 TND (tarif préférentiel membres).',
      reduction: '43%', dateExpiration: '2026-09-30', code: 'ATTT-FIT', acces: 'membres', photo: ''
    },
    {
      id: 'o3', titre: 'Séjour Tlemcen 3J/2N',
      partenaire: 'Agence Horizon Travel',
      description: 'Séjour 3 jours / 2 nuits à Tlemcen en pension complète, tarif exclusif pour les membres de l\'Amicale.',
      reduction: '25%', dateExpiration: '2026-08-31', code: 'VACATTT', acces: 'membres', photo: ''
    }
  ];

  /* ── Init si première fois ───────────────────────────────── */
  function _bootstrap() {
    if (!localStorage.getItem(K_EVENTS)) _saveEvents(DEFAULTS_EVENTS);
    if (!localStorage.getItem(K_OFFERS)) _saveOffers(DEFAULTS_OFFERS);
  }

  /* ── Événements ──────────────────────────────────────────── */
  function getEvents() {
    _bootstrap();
    const list = JSON.parse(localStorage.getItem(K_EVENTS));
    const normalized = list.map(_normalizeEvent);
    if (JSON.stringify(list) !== JSON.stringify(normalized)) _saveEvents(normalized);
    return normalized;
  }

  function addEvent(evt) {
    const list = getEvents();
    evt.id = 'e_' + Date.now();
    /* S'assurer que les nouveaux champs ont leurs valeurs par défaut */
    evt.dateLimitParticipation = evt.dateLimitParticipation || '';
    evt.dateLimitConfirmation   = evt.dateLimitConfirmation   || evt.dateLimitParticipation || '';
    evt.nbMinParticipants      = evt.nbMinParticipants      ?? 0;
    evt.nbMaxParticipants      = evt.nbMaxParticipants      ?? 0;
    evt.quotaMin               = evt.quotaMin               ?? 1;
    evt.quotaMax               = evt.quotaMax               ?? 1;
    evt.prixParticipant        = evt.prixParticipant        ?? 0;
    evt.modalitesPaiement      = evt.modalitesPaiement      || [];
    evt.dateLimitPaiement      = evt.dateLimitPaiement      || '';
    evt.locationConfig         = evt.locationConfig         || null;
    evt.eventType              = String(evt.eventType || 'standard').trim().toLowerCase() || 'standard';
    evt.dateFin                = evt.dateFin || evt.date || '';
    evt.acces                  = normalizeAccess(evt.acces, 'tous');
    evt.photo                  = normalizePhotoUrl(evt.photo);
    evt.specialConfig          = normalizeSpecialConfig(evt.specialConfig || {});
    list.push(evt);
    _saveEvents(list);
    return evt;
  }

  function updateEvent(id, changes) {
    const list = getEvents();
    const idx  = list.findIndex(e => e.id === id);
    if (idx === -1) return false;
    Object.assign(list[idx], {
      ...changes,
      acces: normalizeAccess(changes.acces ?? list[idx].acces, 'tous'),
      photo: normalizePhotoUrl(changes.photo ?? list[idx].photo),
      eventType: String(changes.eventType ?? list[idx].eventType ?? 'standard').trim().toLowerCase() || 'standard',
      dateFin: changes.dateFin ?? list[idx].dateFin ?? list[idx].date,
      dateLimitConfirmation: changes.dateLimitConfirmation ?? list[idx].dateLimitConfirmation ?? changes.dateLimitParticipation ?? list[idx].dateLimitParticipation ?? '',
      specialConfig: normalizeSpecialConfig(changes.specialConfig ?? list[idx].specialConfig ?? {})
    });
    _saveEvents(list);
    return true;
  }

  function deleteEvent(id) {
    _saveEvents(getEvents().filter(e => e.id !== id));
  }

  /* ── Offres ──────────────────────────────────────────────── */
  function getOffers() {
    _bootstrap();
    const list = JSON.parse(localStorage.getItem(K_OFFERS));
    const normalized = list.map(_normalizeOffer);
    if (JSON.stringify(list) !== JSON.stringify(normalized)) _saveOffers(normalized);
    return normalized;
  }

  function addOffer(offer) {
    const list = getOffers();
    offer.id = 'o_' + Date.now();
    offer.acces = normalizeAccess(offer.acces, 'membres');
    offer.photo = normalizePhotoUrl(offer.photo);
    list.push(offer);
    _saveOffers(list);
    return offer;
  }

  function updateOffer(id, changes) {
    const list = getOffers();
    const idx  = list.findIndex(o => o.id === id);
    if (idx === -1) return false;
    Object.assign(list[idx], {
      ...changes,
      acces: normalizeAccess(changes.acces ?? list[idx].acces, 'membres'),
      photo: normalizePhotoUrl(changes.photo ?? list[idx].photo)
    });
    _saveOffers(list);
    return true;
  }

  function deleteOffer(id) {
    _saveOffers(getOffers().filter(o => o.id !== id));
  }

  /* ── API publique ─────────────────────────────────────────── */
  return {
    ACCESS_LABELS,
    normalizeAccess, getAccessLabel, canUserAccess, normalizePhotoUrl,
    getEvents, addEvent, updateEvent, deleteEvent,
    getOffers, addOffer, updateOffer, deleteOffer
  };

})();
