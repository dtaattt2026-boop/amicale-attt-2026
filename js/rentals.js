/**
 * rentals.js — Module Location / Hébergement de vacances
 *
 * L'Amicale loue des maisons/villas pour une période globale, puis les
 * sous-loue aux membres par tranches de durée définies par période.
 *
 * ─── Structure d'une location (rental) ───
 * {
 *   id, titre, description, adresse, capacite, photo|null,
 *   periodeGlobale: { debut, fin },
 *   tranches: [
 *     {
 *       id, libelle, debut, fin,
 *       unite: 'semaine'|'3jours'|'nuit'|'personnalise',
 *       dureeUnite: 7,        // nombre de jours de l'unité
 *       prixUnite: 450,       // prix d'une unité (en DA)
 *       minUnites: 1,         // min unités qu'un user peut réserver
 *       maxUnites: 1,         // max unités qu'un user peut réserver
 *       placesTotal: 8        // nombre total d'unités disponibles
 *     }
 *   ],
 *   actif: true
 * }
 *
 * ─── Structure d'une réservation (booking) ───
 * {
 *   id, rentalId, trancheId, userId,
 *   nbUnites, dateDebut, dateFin,
 *   montantTotal, statut ('en_attente'|'confirmee'|'annulee'|'terminee'),
 *   dateReservation, note
 * }
 *
 * Stockage : attt_rentals, attt_bookings
 */

'use strict';

const RENTALS = (() => {

  const K_RENTALS  = 'attt_rentals';
  const K_BOOKINGS = 'attt_bookings';

  /* Exemple de location préremplie */
  const DEFAULTS_RENTALS = [
    {
      id: 'r1',
      titre: 'Villa Côte Est — Annaba',
      description: 'Villa de 4 chambres avec jardin et piscine, à 500 m de la plage. Réservée par l\'Amicale pour les membres et leurs familles.',
      adresse: 'Route de la Corniche, Annaba',
      capacite: 8,
      photo: null,
      periodeGlobale: { debut: '2026-08-01', fin: '2026-08-31' },
      tranches: [
        {
          id: 't1_1',
          libelle: '1ère quinzaine — locations à la semaine',
          debut: '2026-08-01', fin: '2026-08-15',
          unite: 'semaine', dureeUnite: 7,
          prixUnite: 450, minUnites: 1, maxUnites: 1,
          placesTotal: 2
        },
        {
          id: 't1_2',
          libelle: '2ème quinzaine — locations par 3 jours',
          debut: '2026-08-16', fin: '2026-08-31',
          unite: '3jours', dureeUnite: 3,
          prixUnite: 120, minUnites: 2, maxUnites: 4,
          placesTotal: 16
        }
      ],
      actif: true
    }
  ];

  /* ── Persistance ──────────────────────────────────────────── */
  function _loadRentals()   { try { return JSON.parse(localStorage.getItem(K_RENTALS)  || 'null'); } catch { return null; } }
  function _loadBookings()  { try { return JSON.parse(localStorage.getItem(K_BOOKINGS) || '[]');   } catch { return []; }   }
  function _saveRentals(l)  { localStorage.setItem(K_RENTALS,  JSON.stringify(l)); if (typeof DB !== 'undefined') DB.push(K_RENTALS,  l); }
  function _saveBookings(l) { localStorage.setItem(K_BOOKINGS, JSON.stringify(l)); if (typeof DB !== 'undefined') DB.push(K_BOOKINGS, l); }

  function _bootstrap() {
    if (!_loadRentals()) _saveRentals(DEFAULTS_RENTALS);
  }

  /* ── CRUD Locations ─────────────────────────────────────────── */
  function getRentals(filters = {}) {
    _bootstrap();
    let list = _loadRentals();
    if (filters.actif !== undefined) list = list.filter(r => r.actif === filters.actif);
    return list;
  }

  function getRental(id) {
    _bootstrap();
    return _loadRentals().find(r => r.id === id) || null;
  }

  function addRental(data) {
    _bootstrap();
    const list   = _loadRentals();
    const rental = { id: 'r_' + Date.now(), ...data, actif: data.actif !== false };
    list.push(rental);
    _saveRentals(list);
    return rental;
  }

  function updateRental(id, changes) {
    const list = _loadRentals(); if (!list) return false;
    const idx  = list.findIndex(r => r.id === id);
    if (idx === -1) return false;
    Object.assign(list[idx], changes);
    _saveRentals(list);
    return true;
  }

  function deleteRental(id) {
    const list = _loadRentals(); if (!list) return false;
    _saveRentals(list.filter(r => r.id !== id));
    return true;
  }

  /* ── Disponibilité d'une tranche ─────────────────────────── */
  /**
   * Retourne les unités déjà réservées dans une tranche
   */
  function getBookedUnits(rentalId, trancheId) {
    return _loadBookings()
      .filter(b => b.rentalId === rentalId && b.trancheId === trancheId && b.statut !== 'annulee')
      .reduce((s, b) => s + (b.nbUnites || 0), 0);
  }

  function getAvailableUnits(rentalId, trancheId) {
    const rental  = getRental(rentalId);
    if (!rental) return 0;
    const tranche = rental.tranches.find(t => t.id === trancheId);
    if (!tranche) return 0;
    return Math.max(0, tranche.placesTotal - getBookedUnits(rentalId, trancheId));
  }

  /* ── Vérifier si un user a déjà réservé (quota) ──────────── */
  function getUserBookingsForTranche(userId, rentalId, trancheId) {
    return _loadBookings().filter(b =>
      b.userId === userId && b.rentalId === rentalId &&
      b.trancheId === trancheId && b.statut !== 'annulee'
    );
  }

  /* ── Réservation ─────────────────────────────────────────── */
  /**
   * @param {string} userId
   * @param {string} rentalId
   * @param {string} trancheId
   * @param {number} nbUnites — nombre d'unités demandées
   */
  function book(userId, rentalId, trancheId, nbUnites) {
    const rental = getRental(rentalId);
    if (!rental || !rental.actif) return { ok: false, msg: 'Location non disponible.' };

    const tranche = rental.tranches.find(t => t.id === trancheId);
    if (!tranche) return { ok: false, msg: 'Tranche introuvable.' };

    /* Vé rification quota utilisateur */
    const existingUnits = getUserBookingsForTranche(userId, rentalId, trancheId)
      .reduce((s, b) => s + b.nbUnites, 0);
    if (nbUnites + existingUnits > tranche.maxUnites) {
      return { ok: false, msg: `Quota dépassé. Vous ne pouvez réserver que ${tranche.maxUnites} unité(s) pour cette période.` };
    }
    if (nbUnites < tranche.minUnites) {
      return { ok: false, msg: `Minimum ${tranche.minUnites} unité(s) requises.` };
    }

    /* Vérification disponibilité */
    const dispo = getAvailableUnits(rentalId, trancheId);
    if (nbUnites > dispo) {
      return { ok: false, msg: `Seulement ${dispo} unité(s) disponible(s).` };
    }

    /* Calcul dates */
    const debutDate = new Date(tranche.debut);
    const dateFin   = new Date(debutDate);
    dateFin.setDate(dateFin.getDate() + nbUnites * tranche.dureeUnite - 1);
    const montantTotal = Math.round(nbUnites * tranche.prixUnite * 100) / 100;

    const booking = {
      id:               'b_' + Date.now(),
      rentalId, trancheId, userId,
      nbUnites,
      dateDebut:        tranche.debut,
      dateFin:          dateFin.toISOString().split('T')[0],
      montantTotal,
      statut:           'en_attente',
      dateReservation:  new Date().toISOString(),
      note:             ''
    };

    const list = _loadBookings();
    list.push(booking);
    _saveBookings(list);

    /* Créer l'échéancier de paiement si PAYMENTS est disponible */
    if (typeof PAYMENTS !== 'undefined') {
      const fakeEvent = {
        id:                  'rental_' + rentalId + '_' + trancheId,
        modalitesPaiement:   [],
        dateLimitPaiement:   tranche.debut,
        date:                tranche.debut
      };
      PAYMENTS.createPaymentSchedule(userId, fakeEvent, montantTotal);
    }

    return { ok: true, booking };
  }

  function cancelBooking(bookingId, userId) {
    const list    = _loadBookings();
    const booking = list.find(b => b.id === bookingId);
    if (!booking) return false;
    if (booking.userId !== userId) return false; /* sécurité */
    booking.statut = 'annulee';
    _saveBookings(list);
    return true;
  }

  function confirmBooking(bookingId, adminId) {
    const list    = _loadBookings();
    const booking = list.find(b => b.id === bookingId);
    if (!booking) return false;
    booking.statut     = 'confirmee';
    booking.confirmedBy = adminId;
    _saveBookings(list);
    return true;
  }

  /* ── Lecture ──────────────────────────────────────────────── */
  function getUserBookings(userId) {
    return _loadBookings().filter(b => b.userId === userId)
      .sort((a, b) => b.dateReservation.localeCompare(a.dateReservation));
  }

  function getRentalBookings(rentalId) {
    return _loadBookings().filter(b => b.rentalId === rentalId);
  }

  function getAllBookings() {
    return _loadBookings().sort((a, b) => b.dateReservation.localeCompare(a.dateReservation));
  }

  const UNITE_LABELS = { semaine: 'semaine', '3jours': '3 jours', nuit: 'nuit', personnalise: 'unité' };
  const STATUT_LABELS = { en_attente: 'En attente', confirmee: 'Confirmée', annulee: 'Annulée', terminee: 'Terminée' };
  const STATUT_COLORS = { en_attente: 'warning', confirmee: 'success', annulee: 'secondary', terminee: 'info' };

  /* ── API publique ─────────────────────────────────────────── */
  return {
    getRentals, getRental, addRental, updateRental, deleteRental,
    getBookedUnits, getAvailableUnits, getUserBookingsForTranche,
    book, cancelBooking, confirmBooking,
    getUserBookings, getRentalBookings, getAllBookings,
    UNITE_LABELS, STATUT_LABELS, STATUT_COLORS,
    KEY: K_RENTALS, KEY_BOOKINGS: K_BOOKINGS
  };
})();
