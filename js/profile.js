/**
 * profile.js — Module Profil étendu des utilisateurs
 *
 * Gère les champs supplémentaires du profil :
 *   - Photo de profil & photo de famille (base64)
 *   - Date de naissance, téléphone, adresse, lieu de travail
 *   - Membres de la famille [{nom, prenom, dateNaissance, relation}]
 *   - Préférences de notifications {anniversaires, evenements, conventions, delaiJours}
 *   - Partage de profil avec la famille (accès invité)
 *   - Historique des événements auxquels l'utilisateur a participé
 *   - Code de partage famille (généré automatiquement)
 *
 * Stockage : étend l'objet utilisateur dans attt_users (via AUTH)
 * Clé supplémentaire : attt_participation_history [{userId, eventId, date}]
 */

'use strict';

const PROFILE = (() => {

  const K_HISTORY  = 'attt_participation_history';
  const K_NOTIF    = 'attt_pending_notifs';

  /* Liste prédéfinie des wilayas (Tunisie / DZ selon contexte) */
  const VILLES = [
    'Alger','Oran','Constantine','Annaba','Blida','Batna','Djelfa',
    'Sétif','Sidi Bel Abbès','Biskra','Tébessa','El Oued','Skikda',
    'Tiaret','Béjaïa','Tlemcen','Ouargla','Jijel','Souk Ahras',
    'Mostaganem','Médéa','Mascara','Boumerdès','Chlef','Msila',
    'Guelma','Bejaia','Tizi Ouzou','Khenchela','Tissot','Mila',
    'Relizane','Saïda','Laghouat','Bouira','Bouikerdane','Adrar',
    'Ghardaïa','Béchar','Illizi','Tamanrasset','Tindouf',
    /* Tunisie */
    'Tunis','Ariana','Ben Arous','La Manouba','La Marsa','Carthage',
    'Bizerte','Béja','Jendouba','Le Kef','Siliana','Tabarka',
    'Sousse','Monastir','Mahdia','Sfax',
    'Kairouan','Kasserine','Sidi Bouzid',
    'Gabès','Médenine','Houmt Souk','Zarzis','Tataouine',
    'Gafsa','Tozeur','Kébili',
    'Nabeul','Zaghouan'
  ].sort();

  /* ── Helpers stockage participation ──────────────────────── */
  function _getHistory()  { try { return JSON.parse(localStorage.getItem(K_HISTORY) || '[]'); } catch { return []; } }
  function _saveHistory(h){ localStorage.setItem(K_HISTORY, JSON.stringify(h)); if (typeof DB !== 'undefined') DB.push(K_HISTORY, h); }

  /* ── Lire/sauver le profil étendu d'un user ─────────────── */
  function getProfile(userId) {
    const users = AUTH.getUsers();
    return users.find(u => u.id === userId) || null;
  }

  /**
   * Met à jour les champs de profil étendu d'un utilisateur
   * @param {string} userId
   * @param {object} changes — champs à mettre à jour
   */
  function updateProfile(userId, changes) {
    /* Champs interdits à modifier via ce module */
    const FORBIDDEN = ['id','login','role','statut','validateurId','passwordHash'];
    const safe = Object.fromEntries(
      Object.entries(changes).filter(([k]) => !FORBIDDEN.includes(k))
    );
    return AUTH.updateUser(userId, safe);
  }

  /* ── Photo de profil ─────────────────────────────────────── */
  /**
   * Charge une image en base64 avec redimensionnement (max 300×300)
   * @returns {Promise<string>} base64 data URL
   */
  function resizeImageToBase64(file, maxSize = 300) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Lecture impossible'));
      reader.onload = e => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image invalide'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ratio  = Math.min(maxSize / img.width, maxSize / img.height, 1);
          canvas.width  = Math.round(img.width  * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── Membres de famille ──────────────────────────────────── */
  /**
   * Ajoute un membre de famille à l'utilisateur
   * @param {string} userId
   * @param {{nom, prenom, dateNaissance, relation}} membre
   */
  function addFamilyMember(userId, membre) {
    const user = getProfile(userId);
    if (!user) return false;
    const famille = Array.isArray(user.famille) ? [...user.famille] : [];
    famille.push({
      id:             'fm_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
      nom:            (membre.nom   || '').trim().toUpperCase(),
      prenom:         (membre.prenom || '').trim(),
      dateNaissance:  membre.dateNaissance || '',
      relation:       membre.relation || 'autre'
    });
    return updateProfile(userId, { famille });
  }

  function removeFamilyMember(userId, membreId) {
    const user = getProfile(userId);
    if (!user) return false;
    const famille = (user.famille || []).filter(m => m.id !== membreId);
    return updateProfile(userId, { famille });
  }

  function updateFamilyMember(userId, membreId, changes) {
    const user = getProfile(userId);
    if (!user) return false;
    const famille = (user.famille || []).map(m =>
      m.id === membreId ? { ...m, ...changes } : m
    );
    return updateProfile(userId, { famille });
  }

  /* ── Code de partage famille ─────────────────────────────── */
  /**
   * Génère un code unique pour permettre aux membres de famille de s'inscrire
   * et d'être automatiquement liés au profil principal
   */
  function generateFamilyShareCode(userId) {
    const code = 'FAM-' + userId.slice(-4).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
    updateProfile(userId, { familyShareCode: code, familyShareCodeDate: new Date().toISOString().split('T')[0] });
    return code;
  }

  function getFamilyShareCode(userId) {
    const user = getProfile(userId);
    return user?.familyShareCode || null;
  }

  /**
   * Inscription d'un membre de famille via code de partage
   * Le nouveau compte a le rôle 'famille' (lecture seule événements/conventions)
   */
  function registerViaFamilyCode(code, data) {
    const users = AUTH.getUsers();
    const parent = users.find(u => u.familyShareCode === code && u.statut === 'actif');
    if (!parent) return { ok: false, msg: 'Code de partage invalide ou expiré.' };
    /* data contient : nom, prenom, email, login, password */
    const result = AUTH.register({ ...data, role_override: 'famille', linkedTo: parent.id });
    if (result.ok) {
      /* Ajouter la référence dans les deux sens */
      const linkedInvites = parent.linkedInvites || [];
      linkedInvites.push(result.userId);
      updateProfile(parent.id, { linkedInvites });
    }
    return result;
  }

  /* ── Historique de participation ─────────────────────────── */
  function recordParticipation(userId, eventId) {
    const h = _getHistory();
    const existing = h.find(r => r.userId === userId && r.eventId === eventId);
    if (existing) return; /* déjà enregistré */
    h.push({ id: 'p_' + Date.now(), userId, eventId, date: new Date().toISOString() });
    _saveHistory(h);
  }

  function cancelParticipation(userId, eventId) {
    _saveHistory(_getHistory().filter(r => !(r.userId === userId && r.eventId === eventId)));
  }

  function getUserParticipations(userId) {
    return _getHistory().filter(r => r.userId === userId);
  }

  function getEventParticipants(eventId) {
    return _getHistory().filter(r => r.eventId === eventId);
  }

  /* ── Anniver saires et notifications ─────────────────────── */
  /**
   * Retourne les prochains anniversaires (membres famille + autres users si activé)
   * @param {string} userId  — utilisateur courant
   * @param {number} delai   — nombre de jours à l'avance (défaut: préférence user)
   */
  function getUpcomingAnniversaries(userId) {
    const user   = getProfile(userId);
    const delai  = user?.notifications?.delaiJours ?? 7;
    const today  = new Date();
    const notifs = [];

    function _check(nom, prenom, dateNaissance, type) {
      if (!dateNaissance) return;
      const bday = new Date(dateNaissance);
      const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
      const diff = Math.ceil((thisYear - today) / (1000 * 60 * 60 * 24));
      const age  = thisYear.getFullYear() - bday.getFullYear();
      if (diff <= delai) {
        notifs.push({ nom, prenom, dateNaissance, type, dansJours: diff, age });
      }
    }

    /* Propre anniversaire */
    if (user?.dateNaissance) _check(user.nom, user.prenom, user.dateNaissance, 'self');

    /* Anniversaires famille */
    (user?.famille || []).forEach(m => _check(m.nom, m.prenom, m.dateNaissance, 'famille'));

    /* Anniversaires autres utilisateurs (si activé) */
    if (user?.notifications?.autresUsers !== false) {
      AUTH.getUsers()
        .filter(u => u.id !== userId && u.statut === 'actif' && u.dateNaissance)
        .forEach(u => _check(u.nom, u.prenom, u.dateNaissance, 'membre'));
    }

    return notifs.sort((a, b) => a.dansJours - b.dansJours);
  }

  /* ── Prefs de notification ────────────────────────────────── */
  function getDefaultNotifPrefs() {
    return {
      anniversaires: true,
      autresUsers:   true,
      evenements:    true,
      conventions:   true,
      delaiJours:    7     /* jours à l'avance */
    };
  }

  function getNotifPrefs(userId) {
    const user = getProfile(userId);
    return { ...getDefaultNotifPrefs(), ...(user?.notifications || {}) };
  }

  function setNotifPrefs(userId, prefs) {
    return updateProfile(userId, { notifications: { ...getDefaultNotifPrefs(), ...prefs } });
  }

  /* ── API publique ────────────────────────────────────────── */
  return {
    VILLES,
    getProfile,
    updateProfile,
    resizeImageToBase64,
    addFamilyMember, removeFamilyMember, updateFamilyMember,
    generateFamilyShareCode, getFamilyShareCode, registerViaFamilyCode,
    recordParticipation, cancelParticipation, getUserParticipations, getEventParticipants,
    getUpcomingAnniversaries,
    getNotifPrefs, setNotifPrefs, getDefaultNotifPrefs
  };
})();
