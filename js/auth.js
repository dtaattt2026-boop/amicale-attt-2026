/**
 * ATTT Amicale — Module d'authentification & gestion des rôles
 *
 * Hiérarchie :
 *   membre      → Membre   : consulter événements & offres (après validation)
 *   admin       → Délégué  : valider inscriptions + gérer contenu
 *   superviseur → Direction: gérer Délégués + promouvoir membres
 *   master      → Maître   : accès total
 *
 * Statuts :
 *   en_attente → inscrit, en attente de validation par un Délégué
 *   actif      → validé, peut se connecter
 *   suspendu   → compte désactivé
 *
 * ⚠️  Stockage localStorage : usage intranet/démo uniquement.
 */

'use strict';

const AUTH = (() => {

  /* ── Constantes ────────────────────────────────────────────── */
  const K_USERS   = 'attt_users';
  const K_SESSION = 'attt_session';
  const ROLES     = { famille: 0, membre: 1, admin: 2, superviseur: 3, master: 4 };

  const ROLE_LABELS = {
    famille:     'Famille',
    membre:      'Membre',
    admin:       'Délégué',
    superviseur: 'Direction',
    master:      'Maître'
  };

  /* ── Hash FNV-1a (non cryptographique — usage démo uniquement) */
  function _hash(str) {
    const salt = 'ATTT_AMICALE_DZ_2026';
    const s = str + salt;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  /* ── Helpers stockage ──────────────────────────────────────── */
  function _getUsers()       { return JSON.parse(localStorage.getItem(K_USERS) || '[]'); }
  function _saveUsers(u)     { localStorage.setItem(K_USERS, JSON.stringify(u)); if (typeof DB !== 'undefined') DB.push(K_USERS, u); }
  function _setSession(u)    { sessionStorage.setItem(K_SESSION, JSON.stringify(u)); }
  function getCurrentUser()  { const s = sessionStorage.getItem(K_SESSION); return s ? JSON.parse(s) : null; }

  /* ── Sanitisation XSS ─────────────────────────────────────── */
  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Initialisation ───────────────────────────────────────────── */
  function init() {
    const users = _getUsers();
    /* Compte de secours — créé une seule fois */
    if (!users.find(u => u.login === '347')) {
      users.push({
        id:           'secours-001',
        login:        '347',
        passwordHash: _hash('90134111'),
        nom:          'SECOURS',
        prenom:       'Compte',
        email:        '',
        role:         'master',
        statut:       'actif',
        validateurId: null,
        dateInscription: '2026-03-24'
      });
      _saveUsers(users);
    }
    _updateNavbar();
  }

  /* ── Connexion ────────────────────────────────────────────── */
  function login(loginVal, password) {
    const users = _getUsers();
    const hash  = _hash(password);
    const user  = users.find(u => u.login === loginVal && u.passwordHash === hash);
    if (!user) return { ok: false, msg: 'Identifiant ou mot de passe incorrect.' };
    if (user.statut === 'en_attente')
      return { ok: false, pending: true, msg: 'Votre inscription est en attente de validation par un Délégué de l\'Amicale. Vous serez contacté dès l\'activation de votre compte.' };
    if (user.statut !== 'actif')
      return { ok: false, msg: 'Compte suspendu. Contactez un Délégué ou la Direction.' };
    _setSession(user);
    if (typeof LOG !== 'undefined') LOG.add('LOGIN', {
      acteurId: user.id, acteurLogin: user.login, acteurRole: user.role
    });
    return { ok: true, user };
  }

  /* ── Déconnexion ──────────────────────────────────────────── */
  function logout() {
    const u = getCurrentUser();
    if (u && typeof LOG !== 'undefined') LOG.add('LOGOUT', {
      acteurId: u.id, acteurLogin: u.login, acteurRole: u.role
    });
    sessionStorage.removeItem(K_SESSION);
    window.location.href = 'index.html';
  }

  /* ── Inscription ──────────────────────────────────────────── */
  function register(data) {
    const users = _getUsers();
    const login = data.login.trim();
    const email = (data.email || '').trim();
    if (users.find(u => u.login === login))
      return { ok: false, msg: 'Ce login est déjà utilisé.' };
    if (email && users.find(u => u.email === email))
      return { ok: false, msg: 'Cet e-mail est déjà enregistré.' };
    const user = {
      id:           'u_' + Date.now(),
      login,
      passwordHash: _hash(data.password),
      nom:          data.nom.trim().toUpperCase(),
      prenom:       data.prenom.trim(),
      email,
      role:         data.role_override || 'membre',
      statut:       data.statut_override || 'en_attente',
      validateurId: data.validateurId || null,
      dateInscription: new Date().toISOString().split('T')[0],
      /* Champs profil étendus (optionnels à l'inscription) */
      telephone:    (data.telephone    || '').trim(),
      adresse:      (data.adresse      || '').trim(),
      lieuTravail:  (data.lieuTravail  || '').trim(),
      dateNaissance:(data.dateNaissance|| ''),
      famille:      [],
      notifications: { anniversaires: true, autresUsers: true, evenements: true, conventions: true, delaiJours: 7 },
      linkedTo:     data.linkedTo      || null,
      linkedInvites:[]
    };
    users.push(user);
    _saveUsers(users);
    if (typeof LOG !== 'undefined') LOG.add('REGISTER', {
      cibleId: user.id, cibleLogin: user.login, detail: user.prenom + ' ' + user.nom
    });
    return { ok: true, userId: user.id, user };
  }

  /* ── Validation d'une inscription (Délégué ou Maître) ─────── */
  function validateMember(memberId, validateurId) {
    const users   = _getUsers();
    const cible   = users.find(x => x.id === memberId);
    const acteur  = users.find(x => x.id === validateurId);
    const ok      = updateUser(memberId, { statut: 'actif', validateurId });
    if (ok && typeof LOG !== 'undefined') LOG.add('VALIDATE_MEMBER', {
      acteurId:    acteur?.id,    acteurLogin: acteur?.login,  acteurRole: acteur?.role,
      cibleId:     cible?.id,    cibleLogin:  cible?.login,
      detail: cible ? cible.prenom + ' ' + cible.nom : memberId
    });
    return ok;
  }

  /* ── Rejet d'une inscription ──────────────────────────────── */
  function rejectMember(memberId) {
    const users = _getUsers();
    const u     = users.find(x => x.id === memberId);
    if (!u || u.statut !== 'en_attente') return false;
    _saveUsers(users.filter(x => x.id !== memberId));
    if (typeof LOG !== 'undefined') LOG.add('REJECT_MEMBER', {
      cibleId: u.id, cibleLogin: u.login, detail: u.prenom + ' ' + u.nom
    });
    return true;
  }

  /* ── Membres en attente ───────────────────────────────────── */
  function getPendingMembers() {
    return _getUsers().filter(u => u.statut === 'en_attente');
  }

  /* ── Membres validés par un Délégué spécifique ────────────── */
  function getMembersByValidateur(validateurId) {
    return _getUsers().filter(u =>
      u.validateurId === validateurId && u.role === 'membre'
    );
  }

  /* ── Garde d'accès ────────────────────────────────────────── */
  function requireAuth(minRole) {
    const user = getCurrentUser();
    if (!user) { window.location.href = 'login.html'; return null; }
    if (minRole && (ROLES[user.role] || 0) < (ROLES[minRole] || 0)) {
      alert('Accès refusé : droits insuffisants.');
      history.back();
      return null;
    }
    return user;
  }

  function hasRole(role) {
    const u = getCurrentUser();
    return u ? (ROLES[u.role] || 0) >= (ROLES[role] || 0) : false;
  }

  /* ── Lecture utilisateurs (renvoi copie) ──────────────────── */
  function getUsers() { return _getUsers(); }

  /* ── Modification utilisateur ─────────────────────────────── */
  function updateUser(userId, changes) {
    const users = _getUsers();
    const idx   = users.findIndex(u => u.id === userId);
    if (idx === -1) return false;
    /* Protège le compte de secours : rôle et statut non modifiables */
    if (users[idx].login === '347' && (changes.role !== undefined || changes.statut !== undefined)) return false;
    const before = { role: users[idx].role, statut: users[idx].statut };
    Object.assign(users[idx], changes);
    _saveUsers(users);
    const curr = getCurrentUser();
    if (curr && curr.id === userId) _setSession(users[idx]);
    /* ── Journal ── */
    if (typeof LOG !== 'undefined') {
      const acteur = getCurrentUser();
      if (changes.role !== undefined && changes.role !== before.role) {
        LOG.add('ROLE_CHANGE', {
          acteurId: acteur?.id, acteurLogin: acteur?.login, acteurRole: acteur?.role,
          cibleId: users[idx].id, cibleLogin: users[idx].login,
          detail: (ROLE_LABELS[before.role]||before.role) + ' → ' + (ROLE_LABELS[changes.role]||changes.role)
        });
      }
      if (changes.statut === 'suspendu' && before.statut !== 'suspendu') {
        LOG.add('SUSPEND_MEMBER', {
          acteurId: acteur?.id, acteurLogin: acteur?.login, acteurRole: acteur?.role,
          cibleId: users[idx].id, cibleLogin: users[idx].login,
          detail: users[idx].prenom + ' ' + users[idx].nom
        });
      }
      if (changes.statut === 'actif' && before.statut === 'suspendu') {
        LOG.add('REACTIVATE_MEMBER', {
          acteurId: acteur?.id, acteurLogin: acteur?.login, acteurRole: acteur?.role,
          cibleId: users[idx].id, cibleLogin: users[idx].login,
          detail: users[idx].prenom + ' ' + users[idx].nom
        });
      }
    }
    return true;
  }

  /* ── Suppression utilisateur ──────────────────────────────── */
  function deleteUser(userId) {
    const users = _getUsers();
    const u     = users.find(x => x.id === userId);
    if (!u || u.login === '347') return false; /* compte de secours indestructible */
    _saveUsers(users.filter(x => x.id !== userId));
    if (typeof LOG !== 'undefined') {
      const acteur = getCurrentUser();
      LOG.add('ACCOUNT_DELETE', {
        acteurId: acteur?.id, acteurLogin: acteur?.login, acteurRole: acteur?.role,
        cibleId: u.id, cibleLogin: u.login, detail: u.prenom + ' ' + u.nom
      });
    }
    return true;
  }

  /* ── URL tableau de bord selon rôle ──────────────────────── */
  function dashUrl(role) {
    const map = { master: 'master.html', superviseur: 'superviseur.html', admin: 'admin.html' };
    return map[role] || 'espace-membre.html';
  }

  /* ── Injection bouton auth dans la navbar ─────────────────── */
  function _updateNavbar() {
    const nav = document.querySelector('.navbar-nav');
    if (!nav) return;
    nav.querySelectorAll('.attt-auth-nav').forEach(el => el.remove());

    const user = getCurrentUser();
    const li   = document.createElement('li');
    li.className = 'nav-item attt-auth-nav ms-lg-2 mt-2 mt-lg-0';

    if (user) {
      const label = ROLE_LABELS[user.role] || user.role;
      /* Badge "demandes en attente" pour Délégués et Maître */
      let pendingBadge = '';
      if (user.role === 'admin' || user.role === 'master') {
        const cnt = _getUsers().filter(u => u.statut === 'en_attente').length;
        if (cnt > 0) pendingBadge = `<span class="badge bg-danger ms-1">${cnt}</span>`;
      }
      li.innerHTML = `
        <div class="d-flex align-items-center gap-1">
          <a href="${esc(dashUrl(user.role))}" class="btn btn-outline-light btn-sm">
            <i class="bi bi-person-circle me-1"></i>${esc(user.prenom)}
            <span class="badge bg-warning text-dark ms-1">${esc(label)}</span>${pendingBadge}
          </a>
          <a href="#" class="btn btn-sm btn-danger" title="Déconnexion"
             onclick="AUTH.logout();return false;">
            <i class="bi bi-box-arrow-right"></i>
          </a>
        </div>`;
    } else {
      li.innerHTML = `<a href="login.html" class="btn btn-attt btn-sm px-3">
        <i class="bi bi-person-fill me-1"></i>Se connecter</a>`;
    }
    nav.appendChild(li);
  }

  /* ── API publique ─────────────────────────────────────────── */
  return {
    init, login, logout, register,
    getCurrentUser, getUsers,
    getPendingMembers, getMembersByValidateur,
    validateMember, rejectMember,
    hasRole, requireAuth,
    updateUser, deleteUser, dashUrl,
    ROLE_LABELS, esc
  };

})();

/* Attendre que Firestore soit synchronisé avant d'initialiser l'auth */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof DB_READY !== 'undefined') {
    DB_READY.then(() => AUTH.init());
  } else {
    AUTH.init();
  }
});
