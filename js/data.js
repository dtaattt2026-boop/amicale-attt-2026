/**
 * ATTT Amicale — Gestion des données (événements & offres)
 * Stockage : localStorage
 */

'use strict';

const DATA = (() => {

  const K_EVENTS = 'attt_events';
  const K_OFFERS = 'attt_offers';

  /* ── Helpers persistance (localStorage + Firestore) ─────── */
  function _saveEvents(list) { localStorage.setItem(K_EVENTS, JSON.stringify(list)); if (typeof DB !== 'undefined') DB.push(K_EVENTS, list); }
  function _saveOffers(list) { localStorage.setItem(K_OFFERS, JSON.stringify(list)); if (typeof DB !== 'undefined') DB.push(K_OFFERS, list); }

  /* ── Données initiales ───────────────────────────────────── */
  const DEFAULTS_EVENTS = [
    {
      id: 'e1', titre: 'Tournoi de football inter-services',
      date: '2026-04-15', heure: '09:00',
      lieu: 'Stade municipal — Alger',
      description: 'Tournoi annuel opposant les différents services de l\'ATTT. Inscriptions ouvertes jusqu\'au 10 avril.',
      categorie: 'sport', acces: 'tous',
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
      dateLimitParticipation: '2026-06-10',
      nbMinParticipants: 0, nbMaxParticipants: 200,
      quotaMin: 1, quotaMax: 8,
      prixParticipant: 0,
      modalitesPaiement: [],
      dateLimitPaiement: '',
      locationConfig: null
    }
  ];

  const DEFAULTS_OFFERS = [
    {
      id: 'o1', titre: 'Réduction cinéma — 30% de remise',
      partenaire: 'Cinéma Cosmos Alger',
      description: 'Bénéficiez de 30 % de réduction sur toutes les séances en présentant votre carte Amicale.',
      reduction: '30%', dateExpiration: '2026-12-31', code: 'ATTT2026'
    },
    {
      id: 'o2', titre: 'Abonnement salle de sport',
      partenaire: 'Olympic Fitness Center',
      description: 'Abonnement mensuel à 2 000 DA au lieu de 3 500 DA (tarif préférentiel membres).',
      reduction: '43%', dateExpiration: '2026-09-30', code: 'ATTT-FIT'
    },
    {
      id: 'o3', titre: 'Séjour Tlemcen 3J/2N',
      partenaire: 'Agence Horizon Travel',
      description: 'Séjour 3 jours / 2 nuits à Tlemcen en pension complète, tarif exclusif pour les membres de l\'Amicale.',
      reduction: '25%', dateExpiration: '2026-08-31', code: 'VACATTT'
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
    return JSON.parse(localStorage.getItem(K_EVENTS));
  }

  function addEvent(evt) {
    const list = getEvents();
    evt.id = 'e_' + Date.now();
    /* S'assurer que les nouveaux champs ont leurs valeurs par défaut */
    evt.dateLimitParticipation = evt.dateLimitParticipation || '';
    evt.nbMinParticipants      = evt.nbMinParticipants      ?? 0;
    evt.nbMaxParticipants      = evt.nbMaxParticipants      ?? 0;
    evt.quotaMin               = evt.quotaMin               ?? 1;
    evt.quotaMax               = evt.quotaMax               ?? 1;
    evt.prixParticipant        = evt.prixParticipant        ?? 0;
    evt.modalitesPaiement      = evt.modalitesPaiement      || [];
    evt.dateLimitPaiement      = evt.dateLimitPaiement      || '';
    evt.locationConfig         = evt.locationConfig         || null;
    list.push(evt);
    _saveEvents(list);
    return evt;
  }

  function updateEvent(id, changes) {
    const list = getEvents();
    const idx  = list.findIndex(e => e.id === id);
    if (idx === -1) return false;
    Object.assign(list[idx], changes);
    _saveEvents(list);
    return true;
  }

  function deleteEvent(id) {
    _saveEvents(getEvents().filter(e => e.id !== id));
  }

  /* ── Offres ──────────────────────────────────────────────── */
  function getOffers() {
    _bootstrap();
    return JSON.parse(localStorage.getItem(K_OFFERS));
  }

  function addOffer(offer) {
    const list = getOffers();
    offer.id = 'o_' + Date.now();
    list.push(offer);
    _saveOffers(list);
    return offer;
  }

  function updateOffer(id, changes) {
    const list = getOffers();
    const idx  = list.findIndex(o => o.id === id);
    if (idx === -1) return false;
    Object.assign(list[idx], changes);
    _saveOffers(list);
    return true;
  }

  function deleteOffer(id) {
    _saveOffers(getOffers().filter(o => o.id !== id));
  }

  /* ── API publique ─────────────────────────────────────────── */
  return {
    getEvents, addEvent, updateEvent, deleteEvent,
    getOffers, addOffer, updateOffer, deleteOffer
  };

})();
