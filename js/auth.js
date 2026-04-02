/**
 * ATTT Amicale — Module d'authentification & gestion des rôles
 *
 * Règles :
 * - plus le niveau est petit, plus le rôle est puissant
 * - Maître = niveau 0 = tout est permis
 * - un utilisateur peut avoir un ou plusieurs rôles
 * - user.role reste disponible comme rôle principal pour compatibilité
 */

'use strict';

const AUTH = (() => {

  const K_USERS = 'attt_users';
  const K_SESSION = 'attt_session';
  const K_RIGHTS = 'attt_droits_matrix';
  const K_ROLE_DEFS = 'attt_role_defs';
  const K_PERMISSION_CATALOG = 'attt_permission_catalog';

  const DEFAULT_ROLE_DEFS = [
    { id: 'master', label: 'Maître', level: 0, implicitAll: true, linkedToUser: false, system: true },
    { id: 'superviseur', label: 'Direction', level: 1, implicitAll: false, linkedToUser: false, system: true },
    { id: 'admin', label: 'Délégué', level: 2, implicitAll: false, linkedToUser: false, system: true },
    { id: 'membre', label: 'Membre', level: 3, implicitAll: false, linkedToUser: false, system: true },
    { id: 'famille', label: 'Famille', level: 4, implicitAll: false, linkedToUser: true, system: true }
  ];

  // Version de la matrice — incrémenter pour forcer un reset du localStorage
  const K_RIGHTS_VERSION = 'attt_droits_v3';

  // Colonnes : [label, _master(ignoré), Direction(superviseur), Délégué(admin), Membre]
  // Maître a implicitAll=true → il a tout automatiquement, n'apparaît pas dans la matrice
  // Direction (superviseur) a TOUS les droits sauf "Promouvoir → Maître"
  const LEGACY_RIGHTS_MATRIX_DEFAULT = [
    ['Se connecter',                         '✓','✓','✓','✓'],
    ['Consulter événements (publics)',        '✓','✓','✓','✓'],
    ['Consulter événements (membres)',        '✓','✓','✓','✓'],
    ['Consulter offres',                      '✓','✓','✓','✓'],
    ['Consulter articles / actualités',       '✓','✓','✓','⚠'],
    ['Ajouter / modifier événement',          '✓','✓','✓','—'],
    ['Supprimer événement',                   '✓','✓','✓','—'],
    ['Ajouter / modifier offre',              '✓','✓','✓','—'],
    ['Supprimer offre',                       '✓','✓','✓','—'],
    ['Publier article avec photo',            '✓','✓','✓','—'],
    ['Modifier / supprimer article',          '✓','✓','✓','—'],
    ['Valider inscription (en attente)',       '✓','✓','✓','—'],
    ['Rejeter inscription',                   '✓','✓','✓','—'],
    ['Suspendre / réactiver utilisateur',     '✓','✓','✓','—'],
    ['Supprimer utilisateur',                 '✓','✓','✓','—'],
    ['Promouvoir → Délégué',                  '✓','✓','—','—'],
    ['Promouvoir → Direction',                '✓','✓','—','—'],
    ['Promouvoir → Maître',                   '✓','—','—','—'],  /* Réservé Maître uniquement */
    ['Rétrograder un utilisateur',            '✓','✓','—','—'],
    ['Supprimer définitivement utilisateur',  '✓','✓','—','—'],
    ['Voir journal des opérations',           '✓','✓','—','—'],
    ['Effacer journal',                       '✓','✓','—','—'],
    ['Accéder page Droits',                   '✓','✓','—','—'],
    ['Accéder page Journal',                  '✓','✓','—','—'],
    ['Accéder page Guide technique',          '✓','✓','—','—'],
    ['Accéder page Paramètres site',          '✓','✓','—','—'],
    ['Modifier paramètres site',              '✓','✓','—','—'],
    ['Accéder page Publicités accueil',       '✓','✓','✓','—'],
    ['Ajouter / modifier publicité accueil',  '✓','✓','✓','—'],
    ['Supprimer publicité accueil',           '✓','✓','✓','—'],
    ['Voir bouton Ajouter publicité accueil', '✓','✓','✓','—'],
    ['Accéder page Actualités',               '✓','✓','✓','—'],
    ['Accéder page Superviseur',              '✓','✓','—','—'],
    ['Accéder page Admin',                    '✓','✓','✓','—'],
    ['Accéder page Master',                   '✓','—','—','—'],
    ['Accéder page Espace membre',            '✓','✓','✓','✓'],
    ['Accéder page Profil',                   '✓','✓','✓','✓'],
    ['Accéder page Messagerie',               '✓','✓','✓','✓'],
    ['Accéder page Locations',                '✓','✓','✓','✓'],
    ['Accéder page Voyages',                  '✓','✓','✓','✓'],
    ['Accéder page Votes',                    '✓','✓','✓','✓'],
    ['Accéder page Versions',                 '✓','✓','✓','—'],
    ['Réserver location vacances',            '✓','✓','✓','✓'],
    ['Voir colonne E-mail',                   '✓','✓','✓','—'],
    ['Voir colonne Inscrits',                 '✓','✓','✓','—'],
    ['Voir bouton Ajouter événement',         '✓','✓','✓','—'],
    ['Voir bouton Supprimer événement',       '✓','✓','✓','—'],
    ['Voir bouton Ajouter offre',             '✓','✓','✓','—'],
    ['Voir bouton Supprimer offre',           '✓','✓','✓','—'],
    ['Voir bouton Ajouter convention',        '✓','✓','✓','—'],
    ['Consulter conventions réservées',       '✓','✓','✓','✓'],
    ['Voir détail convention réservée',       '✓','✓','✓','✓'],
    ['Voir bouton Modifier matrice',          '✓','✓','—','—'],
    ['Ajouter photo galerie',                 '✓','✓','✓','—'],
    ['Supprimer photo galerie',               '✓','✓','✓','—'],
    ['Consulter voyages',                     '✓','✓','✓','✓'],
    ['Créer / modifier voyage',               '✓','✓','✓','—'],
    ['Supprimer voyage',                      '✓','✓','✓','—'],
    ['S\'inscrire voyage',                    '✓','✓','✓','✓'],
    ['Gérer inscriptions voyage',             '✓','✓','—','—'],
    ['Voir bouton Ajouter voyage',            '✓','✓','✓','—'],
    ['Consulter votes',                       '✓','✓','✓','✓'],
    ['Créer / modifier vote',                 '✓','✓','✓','—'],
    ['Supprimer vote',                        '✓','✓','✓','—'],
    ['Participer au vote',                    '✓','✓','✓','✓'],
    ['Voir résultats vote',                   '✓','✓','✓','✓'],
    ['Gérer votes',                           '✓','✓','✓','—'],
    ['Voir bouton Créer vote',                '✓','✓','✓','—']
  ];

  const DEFAULT_PERMISSION_PAGES = [
    {
      id: 'global',
      label: 'Global',
      path: '',
      permissions: ['Se connecter']
    },
    {
      id: 'evenements',
      label: 'Événements',
      path: 'evenements.html',
      permissions: [
        'Consulter événements (publics)',
        'Consulter événements (membres)',
        'Ajouter / modifier événement',
        'Supprimer événement',
        'Voir bouton Ajouter événement',
        'Voir bouton Supprimer événement',
        'Voir colonne Inscrits'
      ]
    },
    {
      id: 'offres',
      label: 'Offres',
      path: 'offres.html',
      permissions: [
        'Consulter offres',
        'Ajouter / modifier offre',
        'Supprimer offre',
        'Voir bouton Ajouter offre',
        'Voir bouton Supprimer offre'
      ]
    },
    {
      id: 'actualites',
      label: 'Actualités',
      path: 'contenu-admin.html',
      permissions: [
        'Accéder page Actualités',
        'Consulter articles / actualités',
        'Publier article avec photo',
        'Modifier / supprimer article'
      ]
    },
    {
      id: 'superviseur',
      label: 'Superviseur',
      path: 'superviseur.html',
      permissions: ['Accéder page Superviseur']
    },
    {
      id: 'admin-page',
      label: 'Administration',
      path: 'admin.html',
      permissions: ['Accéder page Admin']
    },
    {
      id: 'master-page',
      label: 'Panneau maître',
      path: 'master.html',
      permissions: ['Accéder page Master']
    },
    {
      id: 'espace-membre-page',
      label: 'Espace membre',
      path: 'espace-membre.html',
      permissions: ['Accéder page Espace membre']
    },
    {
      id: 'profil-page',
      label: 'Profil',
      path: 'profil.html',
      permissions: ['Accéder page Profil']
    },
    {
      id: 'messagerie-page',
      label: 'Messagerie',
      path: 'messagerie.html',
      permissions: ['Accéder page Messagerie']
    },
    {
      id: 'locations-page',
      label: 'Locations',
      path: 'location.html',
      permissions: ['Accéder page Locations', 'Réserver location vacances']
    },
    {
      id: 'voyages-page',
      label: 'Voyages',
      path: 'voyages.html',
      permissions: ['Accéder page Voyages', 'Consulter voyages', 'Créer / modifier voyage', 'Supprimer voyage', 'S\'inscrire voyage', 'Gérer inscriptions voyage', 'Voir bouton Ajouter voyage']
    },
    {
      id: 'votes-page',
      label: 'Votes',
      path: 'votes.html',
      permissions: ['Accéder page Votes', 'Consulter votes', 'Créer / modifier vote', 'Supprimer vote', 'Participer au vote', 'Voir résultats vote', 'Gérer votes', 'Voir bouton Créer vote']
    },
    {
      id: 'versions-page',
      label: 'Versions',
      path: 'versions.html',
      permissions: ['Accéder page Versions']
    },
    {
      id: 'utilisateurs',
      label: 'Utilisateurs',
      path: 'master.html',
      permissions: [
        'Valider inscription (en attente)',
        'Rejeter inscription',
        'Suspendre / réactiver utilisateur',
        'Supprimer utilisateur',
        'Supprimer définitivement utilisateur',
        'Promouvoir → Délégué',
        'Promouvoir → Direction',
        'Promouvoir → Maître',
        'Rétrograder un utilisateur',
        'Voir colonne E-mail'
      ]
    },
    {
      id: 'droits',
      label: 'Droits',
      path: 'droits.html',
      permissions: ['Accéder page Droits', 'Voir bouton Modifier matrice']
    },
    {
      id: 'journal',
      label: 'Journal',
      path: 'journal.html',
      permissions: ['Accéder page Journal', 'Voir journal des opérations', 'Effacer journal']
    },
    {
      id: 'guide',
      label: 'Guide technique',
      path: 'guide.html',
      permissions: ['Accéder page Guide technique']
    },
    {
      id: 'parametres',
      label: 'Paramètres site',
      path: 'parametres.html',
      permissions: ['Accéder page Paramètres site', 'Modifier paramètres site']
    },
    {
      id: 'publicites',
      label: 'Publicités accueil',
      path: 'publicites.html',
      permissions: [
        'Accéder page Publicités accueil',
        'Ajouter / modifier publicité accueil',
        'Supprimer publicité accueil',
        'Voir bouton Ajouter publicité accueil'
      ]
    },
    {
      id: 'conventions',
      label: 'Conventions',
      path: 'conventions.html',
      permissions: ['Voir bouton Ajouter convention', 'Consulter conventions réservées', 'Voir détail convention réservée']
    },
    {
      id: 'galerie',
      label: 'Galerie',
      path: 'galerie.html',
      permissions: ['Ajouter photo galerie', 'Supprimer photo galerie']
    },
    {
      id: 'locations',
      label: 'Locations',
      path: 'location.html',
      permissions: ['Réserver location vacances']
    },
    {
      id: 'voyages',
      label: 'Voyages',
      path: 'voyages.html',
      permissions: [
        'Consulter voyages',
        'Créer / modifier voyage',
        'Supprimer voyage',
        'S\'inscrire voyage',
        'Gérer inscriptions voyage',
        'Voir bouton Ajouter voyage'
      ]
    },
    {
      id: 'votes',
      label: 'Votes',
      path: 'votes.html',
      permissions: [
        'Consulter votes',
        'Créer / modifier vote',
        'Supprimer vote',
        'Participer au vote',
        'Voir résultats vote',
        'Gérer votes',
        'Voir bouton Créer vote'
      ]
    }
  ];

  const LEGACY_ROLE_IDS = ['superviseur', 'admin', 'membre', 'famille'];
  const SYMBOL_PRIORITY = { '—': 0, '⚠': 1, '✓': 2 };
  const PERMISSION_AXES = ['visible', 'action'];
  const PERMISSION_ALIASES = {
    'Créer vote': 'Voir bouton Créer vote',
    'Creer vote': 'Voir bouton Créer vote',
    'Acceder page Superviseur': 'Accéder page Superviseur',
    'Acceder page Admin': 'Accéder page Admin'
  };

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

  function _slugRoleId(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function _sortRoles(roleIds) {
    return [...new Set(roleIds)].sort((left, right) => getRoleLevel(left) - getRoleLevel(right));
  }

  function _normalizeRoleDef(role, index = 0) {
    const fallback = DEFAULT_ROLE_DEFS[index] || {};
    const label = String(role?.label || fallback.label || role?.id || 'Rôle').trim();
    const id = _slugRoleId(role?.id || fallback.id || label) || `role-${index + 1}`;
    return {
      id,
      label,
      level: Math.max(0, Number(role?.level ?? fallback.level ?? index)),
      implicitAll: role?.implicitAll === true || fallback.implicitAll === true,
      linkedToUser: role?.linkedToUser === true || fallback.linkedToUser === true,
      system: role?.system === true || fallback.system === true
    };
  }

  function _normalizeRoleDefs(list) {
    const saved = Array.isArray(list) ? list.map((role, index) => _normalizeRoleDef(role, index)) : [];
    const byId = new Map(saved.map(role => [role.id, role]));
    DEFAULT_ROLE_DEFS.forEach((role, index) => {
      byId.set(role.id, { ..._normalizeRoleDef(role, index), ...(byId.get(role.id) || {}), id: role.id, system: true, implicitAll: role.implicitAll, linkedToUser: role.linkedToUser });
    });
    const roles = Array.from(byId.values()).map((role, index) => _normalizeRoleDef(role, index));
    roles.sort((left, right) => left.level - right.level || left.label.localeCompare(right.label, 'fr'));
    return roles;
  }

  function _loadRoleDefs() {
    try {
      return _normalizeRoleDefs(JSON.parse(localStorage.getItem(K_ROLE_DEFS) || 'null'));
    } catch {
      return _normalizeRoleDefs(DEFAULT_ROLE_DEFS);
    }
  }

  function _normalizePermissionPage(page, index = 0) {
    const fallback = DEFAULT_PERMISSION_PAGES[index] || {};
    const label = String(page?.label || fallback.label || page?.id || 'Page').trim();
    const path = String(page?.path || fallback.path || '').trim();
    const id = _slugRoleId(page?.id || path.replace(/\.html$/i, '') || label) || `page-${index + 1}`;
    const permissions = [...new Set((Array.isArray(page?.permissions) ? page.permissions : fallback.permissions || [])
      .map(item => String(item || '').trim())
      .filter(Boolean))].sort((left, right) => left.localeCompare(right, 'fr'));
    return { id, label, path, permissions };
  }

  function _normalizePermissionCatalog(catalog) {
    const savedPages = Array.isArray(catalog?.pages) ? catalog.pages : Array.isArray(catalog) ? catalog : [];
    const byId = new Map(savedPages.map((page, index) => {
      const normalized = _normalizePermissionPage(page, index);
      return [normalized.id, normalized];
    }));
    DEFAULT_PERMISSION_PAGES.forEach((page, index) => {
      const normalized = _normalizePermissionPage(page, index);
      if (!byId.has(normalized.id)) {
        byId.set(normalized.id, normalized);
        return;
      }
      const merged = byId.get(normalized.id);
      byId.set(normalized.id, {
        ...merged,
        label: merged.label || normalized.label,
        path: merged.path || normalized.path,
        permissions: [...new Set([...(normalized.permissions || []), ...(merged.permissions || [])])].sort((left, right) => left.localeCompare(right, 'fr'))
      });
    });
    return {
      pages: Array.from(byId.values()).sort((left, right) => {
        if (left.id === 'global') return -1;
        if (right.id === 'global') return 1;
        return left.label.localeCompare(right.label, 'fr');
      })
    };
  }

  function _loadPermissionCatalog() {
    try {
      return _normalizePermissionCatalog(JSON.parse(localStorage.getItem(K_PERMISSION_CATALOG) || 'null'));
    } catch {
      return _normalizePermissionCatalog({ pages: DEFAULT_PERMISSION_PAGES });
    }
  }

  function _savePermissionCatalog(catalog) {
    const normalized = _normalizePermissionCatalog(catalog);
    localStorage.setItem(K_PERMISSION_CATALOG, JSON.stringify(normalized));
    if (typeof DB !== 'undefined') DB.push(K_PERMISSION_CATALOG, normalized);
    return normalized;
  }

  function getPermissionCatalog() {
    return _loadPermissionCatalog();
  }

  function _defaultSymbolsForDynamicPermission() {
    return Object.fromEntries(getVisibleMatrixRoles().map(role => [role.id, { visible: '—', action: '—' }]));
  }

  function _normalizePermissionSymbol(symbol) {
    return SYMBOL_PRIORITY[String(symbol || '—')] !== undefined ? String(symbol || '—') : '—';
  }

  function _normalizePermissionValue(value) {
    if (typeof value === 'string') {
      const symbol = _normalizePermissionSymbol(value);
      return { visible: symbol, action: symbol };
    }
    if (value && typeof value === 'object') {
      return {
        visible: _normalizePermissionSymbol(value.visible ?? value.vis ?? value.read ?? value.action),
        action: _normalizePermissionSymbol(value.action ?? value.write ?? value.edit ?? value.visible)
      };
    }
    return { visible: '—', action: '—' };
  }

  function registerPermissionPage(pageMeta, permissions) {
    const catalog = _loadPermissionCatalog();
    const normalizedPage = _normalizePermissionPage({
      ...pageMeta,
      permissions: [...new Set(permissions.map(item => String(item || '').trim()).filter(Boolean))]
    }, catalog.pages.length);
    const pages = catalog.pages.filter(page => page.id !== normalizedPage.id);
    const previous = catalog.pages.find(page => page.id === normalizedPage.id);
    pages.push({
      ...normalizedPage,
      permissions: [...new Set([...(previous?.permissions || []), ...normalizedPage.permissions])].sort((left, right) => left.localeCompare(right, 'fr'))
    });
    return _savePermissionCatalog({ pages });
  }

  function syncPermissionsFromDocument(doc = document, pageMeta = null) {
    const labels = [...new Set(Array.from(doc.querySelectorAll('[data-perm]'))
      .map(element => element.getAttribute('data-perm'))
      .map(label => String(label || '').trim())
      .filter(Boolean))];
    if (!labels.length) return getPermissionCatalog();
    const title = String(pageMeta?.label || doc.title || 'Page')
      .replace(/^Amicale\s+ATTT\s+[—-]\s+/i, '')
      .trim();
    const path = String(pageMeta?.path || (typeof location !== 'undefined' ? location.pathname.split('/').pop() : '') || '').trim();
    const id = _slugRoleId(pageMeta?.id || path.replace(/\.html$/i, '') || title) || 'page';
    const catalog = registerPermissionPage({ id, label: title || 'Page', path }, labels);
    _saveRightsMatrix(_getRightsMatrix());
    return catalog;
  }

  function _saveRoleDefs(roleDefs) {
    const normalized = _normalizeRoleDefs(roleDefs);
    localStorage.setItem(K_ROLE_DEFS, JSON.stringify(normalized));
    if (typeof DB !== 'undefined') DB.push(K_ROLE_DEFS, normalized);
    return normalized;
  }

  function getRoles() {
    return _loadRoleDefs();
  }

  function getRoleDefinition(roleId) {
    return getRoles().find(role => role.id === roleId) || null;
  }

  function getRoleLevel(roleId) {
    return getRoleDefinition(roleId)?.level ?? Number.MAX_SAFE_INTEGER;
  }

  function getRoleLabel(roleId) {
    return getRoleDefinition(roleId)?.label || roleId;
  }

  function getVisibleMatrixRoles() {
    return getRoles().filter(role => !role.implicitAll);
  }

  function _roleLabelsObject() {
    return Object.fromEntries(getRoles().map(role => [role.id, role.label]));
  }

  function _roleLevelsObject() {
    return Object.fromEntries(getRoles().map(role => [role.id, role.level]));
  }

  function _normalizeUser(user) {
    const rawRoles = Array.isArray(user?.roles) && user.roles.length
      ? user.roles
      : (user?.role ? [user.role] : ['membre']);
    const knownRoles = rawRoles.filter(roleId => !!getRoleDefinition(roleId));
    const roles = _sortRoles(knownRoles.length ? knownRoles : ['membre']);
    return {
      ...user,
      roles,
      role: roles[0],
      famille: Array.isArray(user?.famille) ? user.famille : [],
      linkedInvites: Array.isArray(user?.linkedInvites) ? user.linkedInvites : [],
      notifications: user?.notifications || { anniversaires: true, autresUsers: true, evenements: true, conventions: true, delaiJours: 7 }
    };
  }

  function getUserRoles(user) {
    return _normalizeUser(user).roles;
  }

  function getPrimaryRole(user) {
    return _normalizeUser(user).role;
  }

  function getHighestPrivilegeLevel(user) {
    return Math.min(...getUserRoles(user).map(roleId => getRoleLevel(roleId)));
  }

  function hasImplicitAllRole(user) {
    return getUserRoles(user).some(roleId => getRoleDefinition(roleId)?.implicitAll);
  }

  function userHasExactRole(userOrRole, maybeRole) {
    const user = maybeRole !== undefined ? userOrRole : getCurrentUser();
    const roleId = maybeRole !== undefined ? maybeRole : userOrRole;
    return !!user && getUserRoles(user).includes(roleId);
  }

  function hasRole(userOrRole, maybeRole) {
    const user = maybeRole !== undefined ? userOrRole : getCurrentUser();
    const roleId = maybeRole !== undefined ? maybeRole : userOrRole;
    if (!user || !getRoleDefinition(roleId)) return false;
    return getHighestPrivilegeLevel(user) <= getRoleLevel(roleId);
  }

  function getAssignableRoles(actorOrUser = getCurrentUser()) {
    const actor = _normalizeUser(actorOrUser || {});
    if (hasImplicitAllRole(actor)) return getRoles();
    const actorLevel = getHighestPrivilegeLevel(actor);
    return getRoles().filter(role => role.level > actorLevel);
  }

  function canManageRoleDefinitions(actorOrUser = getCurrentUser()) {
    return hasPermission('Voir bouton Modifier matrice', actorOrUser);
  }

  function _getUsers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(K_USERS) || '[]');
      return Array.isArray(parsed) ? parsed.map(_normalizeUser) : [];
    } catch {
      return [];
    }
  }

  function _saveUsers(users) {
    const normalized = users.map(_normalizeUser);
    localStorage.setItem(K_USERS, JSON.stringify(normalized));
    if (typeof DB !== 'undefined') DB.push(K_USERS, normalized);
  }

  function _setSession(user) {
    sessionStorage.setItem(K_SESSION, JSON.stringify(_normalizeUser(user)));
  }

  function getCurrentUser() {
    const raw = sessionStorage.getItem(K_SESSION);
    if (!raw) return null;
    try { return _normalizeUser(JSON.parse(raw)); }
    catch { return null; }
  }

  function _roleTemplateId(roleId) {
    const role = getRoleDefinition(roleId);
    if (!role) return 'membre';
    if (role.linkedToUser) return 'famille';
    const templates = ['superviseur', 'admin', 'membre', 'famille'];
    return templates.reduce((bestId, currentId) => {
      const bestGap = Math.abs(getRoleLevel(bestId) - role.level);
      const currentGap = Math.abs(getRoleLevel(currentId) - role.level);
      return currentGap < bestGap ? currentId : bestId;
    }, 'membre');
  }

  function _buildDefaultRightsMatrix() {
    const visibleRoles = getVisibleMatrixRoles();
    const legacyRows = LEGACY_RIGHTS_MATRIX_DEFAULT.map(([label, _master, direction, delegue, membre]) => {
      const legacyValues = { superviseur: direction, admin: delegue, membre, famille: membre };
      const values = {};
      visibleRoles.forEach(role => {
        const templateId = legacyValues[role.id] ? role.id : _roleTemplateId(role.id);
        values[role.id] = _normalizePermissionValue(legacyValues[templateId] || '—');
      });
      return { label, values };
    });
    const knownLabels = new Set(legacyRows.map(row => row.label));
    const dynamicRows = getPermissionCatalog().pages
      .flatMap(page => page.permissions)
      .filter(label => !knownLabels.has(label))
      .sort((left, right) => left.localeCompare(right, 'fr'))
      .map(label => ({ label, values: _defaultSymbolsForDynamicPermission() }));
    return [...legacyRows, ...dynamicRows];
  }

  function _normalizeRightsRow(row, legacyMode = false) {
    if (!row) return null;
    if (Array.isArray(row)) {
      const label = row[0];
      if (!label) return null;
      const values = {};
      const cols = row.slice(1);
      const roleIds = legacyMode ? LEGACY_ROLE_IDS : getVisibleMatrixRoles().map(role => role.id);
      roleIds.forEach((roleId, index) => { values[roleId] = _normalizePermissionValue(cols[index] || '—'); });
      return { label, values };
    }
    if (typeof row === 'object' && row.label) {
      const values = {};
      Object.entries(row.values || {}).forEach(([roleId, value]) => {
        values[roleId] = _normalizePermissionValue(value);
      });
      return { label: row.label, values };
    }
    return null;
  }

  function _isLegacyRightsMatrix(rows) {
    return Array.isArray(rows) && rows.some(row => Array.isArray(row) && row[0] === 'Promouvoir → Maître');
  }

  function _isAllDenied(state) {
    const normalized = _normalizePermissionValue(state);
    return normalized.visible === '—' && normalized.action === '—';
  }

  function _syncRightsMatrix(rows) {
    const visibleRoles = getVisibleMatrixRoles();
    const legacyMode = _isLegacyRightsMatrix(rows);
    const normalizedRows = Array.isArray(rows)
      ? rows.map(row => _normalizeRightsRow(row, legacyMode)).filter(Boolean)
      : [];
    const savedMap = new Map(normalizedRows.map(row => [row.label, row]));
    return _buildDefaultRightsMatrix().map(defaultRow => {
      const saved = savedMap.get(defaultRow.label);
      const values = {};
      visibleRoles.forEach(role => {
        const savedValue = _normalizePermissionValue(saved?.values?.[role.id] || '—');
        const defaultValue = _normalizePermissionValue(defaultRow.values?.[role.id] || '—');

        // Migration douce: une ancienne ligne dynamique de type "Accéder page ..."
        // pouvait être enregistrée en tout refusé. On réapplique alors le défaut système.
        const isPageAccess = String(defaultRow.label || '').startsWith('Accéder page ');
        const shouldUseDefault = isPageAccess && _isAllDenied(savedValue) && !_isAllDenied(defaultValue);

        values[role.id] = shouldUseDefault ? defaultValue :
          _normalizePermissionValue(saved?.values?.[role.id] || defaultRow.values[role.id] || '—');
      });
      return { label: defaultRow.label, values };
    });
  }

  function _getRightsMatrix() {
    try {
      // Reset automatique si la version de la matrice est obsolète
      if (localStorage.getItem('attt_droits_version') !== K_RIGHTS_VERSION) {
        localStorage.removeItem(K_RIGHTS);
        localStorage.setItem('attt_droits_version', K_RIGHTS_VERSION);
      }
      return _syncRightsMatrix(JSON.parse(localStorage.getItem(K_RIGHTS) || 'null'));
    } catch {
      return _buildDefaultRightsMatrix();
    }
  }

  function _saveRightsMatrix(rows) {
    const normalized = _syncRightsMatrix(rows);
    localStorage.setItem(K_RIGHTS, JSON.stringify(normalized));
    localStorage.setItem('attt_droits_version', K_RIGHTS_VERSION);
    if (typeof DB !== 'undefined') DB.push(K_RIGHTS, normalized);
    return normalized;
  }

  function _resolveActor(actorOrRole) {
    if (typeof actorOrRole === 'string') return { roles: [actorOrRole], role: actorOrRole };
    return actorOrRole ? _normalizeUser(actorOrRole) : (getCurrentUser() || { roles: ['membre'], role: 'membre' });
  }

  function _normalizePermissionLabel(label) {
    const raw = String(label || '').trim();
    if (!raw) return raw;

    const normalized = PERMISSION_ALIASES[raw] || raw;
    const rows = _getRightsMatrix();
    if (rows.find(item => item.label === normalized)) return normalized;

    const simplify = value => String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();

    const target = simplify(normalized);
    const match = rows.find(item => simplify(item.label) === target);
    return match ? match.label : normalized;
  }

  function _canActOnTarget(actor, targetUser) {
    if (!targetUser) return true;
    if (targetUser.login === '347') return false;
    if (actor?.id && targetUser.id === actor.id) return false;
    return getHighestPrivilegeLevel(actor) < getHighestPrivilegeLevel(targetUser);
  }

  function getPermissionState(label, actorOrRole) {
    const actor = _resolveActor(actorOrRole);
    if (hasImplicitAllRole(actor)) return { visible: '✓', action: '✓' };
    const resolvedLabel = _normalizePermissionLabel(label);
    const row = _getRightsMatrix().find(item => item.label === resolvedLabel);
    if (!row) return { visible: '—', action: '—' };
    return getUserRoles(actor).reduce((best, roleId) => {
      const current = _normalizePermissionValue(row.values?.[roleId]);
      return {
        visible: SYMBOL_PRIORITY[current.visible] > SYMBOL_PRIORITY[best.visible] ? current.visible : best.visible,
        action: SYMBOL_PRIORITY[current.action] > SYMBOL_PRIORITY[best.action] ? current.action : best.action
      };
    }, { visible: '—', action: '—' });
  }

  function getPermissionSymbol(label, actorOrRole, axis = 'action') {
    const state = getPermissionState(label, actorOrRole);
    return state[axis] || '—';
  }

  function hasPermission(label, actorOrRole, subjectUser, axis = 'action') {
    const actor = _resolveActor(actorOrRole);
    const symbol = getPermissionSymbol(label, actor, axis);
    if (symbol === '✓') return !subjectUser || _canActOnTarget(actor, subjectUser);
    if (symbol !== '⚠') return false;
    return !subjectUser || _canActOnTarget(actor, subjectUser);
  }

  function canViewPermission(label, actorOrRole, subjectUser) {
    return hasPermission(label, actorOrRole, subjectUser, 'visible');
  }

  function currentUser() {
    return getCurrentUser();
  }

  function can(label, actorOrRole, subjectUser, axis = 'action') {
    return hasPermission(label, actorOrRole, subjectUser, axis);
  }

  function _permissionAxisForElement(el) {
    const explicit = String(el.getAttribute('data-perm-mode') || '').trim().toLowerCase();
    if (explicit === 'visible' || explicit === 'action') return explicit;
    if (el.matches('th, td, [data-perm-display], [data-perm-mode="visible"]')) return 'visible';
    if (el.matches('button, a, input, select, textarea, summary, [onclick], [data-bs-toggle], [role="button"]')) return 'action';
    return 'visible';
  }

  function applyPermissions(root = document, actor = getCurrentUser()) {
    // 1. Colonnes de tableau : data-perm sur <th> → cacher th + tous les td du même index
    root.querySelectorAll('th[data-perm]').forEach(th => {
      const label = th.getAttribute('data-perm');
      const visible = getPermissionSymbol(label, actor, 'visible') !== '—';
      const colIdx = [...th.parentElement.children].indexOf(th);
      th.classList.toggle('d-none', !visible);
      const table = th.closest('table');
      if (table) {
        table.querySelectorAll('tr').forEach(tr => {
          const cell = tr.children[colIdx];
          if (cell && cell !== th) cell.classList.toggle('d-none', !visible);
        });
      }
    });

    // 2. Champs de formulaire : ✓ = éditable · ⚠ = lecture seule · — = caché
    root.querySelectorAll(
      'input[data-perm]:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]),' +
      'select[data-perm],' +
      'textarea[data-perm]'
    ).forEach(field => {
      const label = field.getAttribute('data-perm');
      const vSym  = getPermissionSymbol(label, actor, 'visible');
      const aSym  = getPermissionSymbol(label, actor, 'action');
      const hidden = vSym === '—';
      field.classList.toggle('d-none', hidden);
      if (!hidden) {
        const limited = aSym === '—' || aSym === '⚠';
        const tag = field.tagName;
        const t   = (field.type || '').toLowerCase();
        if (tag === 'SELECT' || t === 'checkbox' || t === 'radio' || t === 'file' || t === 'range' || t === 'color') {
          field.disabled = limited;
        } else {
          field.readOnly = limited;
        }
      }
      // Masquer / afficher le <label for="id"> associé
      if (field.id) {
        const lbl = root.querySelector(`label[for="${CSS.escape(field.id)}"]`);
        if (lbl) lbl.classList.toggle('d-none', hidden);
      }
    });

    // 3. Tous les autres éléments data-perm (boutons, divs, li, option…) — comportement standard
    root.querySelectorAll('[data-perm]:not(th):not(input):not(select):not(textarea)').forEach(el => {
      const mode = _permissionAxisForElement(el);
      const ok = hasPermission(el.getAttribute('data-perm'), actor, null, mode);
      el.classList.toggle('d-none', !ok);
    });
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function init() {
    _saveRoleDefs(_loadRoleDefs());
    _savePermissionCatalog(_loadPermissionCatalog());
    const users = _getUsers();
    if (!users.find(user => user.login === '347')) {
      users.push(_normalizeUser({
        id: 'secours-001',
        login: '347',
        passwordHash: _hash('90134111'),
        nom: 'SECOURS',
        prenom: 'Compte',
        email: '',
        roles: ['master'],
        statut: 'actif',
        validateurId: null,
        dateInscription: '2026-03-24'
      }));
    }
    _saveUsers(users);
    syncPermissionsFromDocument(document);
    _saveRightsMatrix(_getRightsMatrix());
    _updateNavbar();
    applyPermissions(document);
  }

  function login(loginVal, password) {
    const users = _getUsers();
    const hash = _hash(password);
    const user = users.find(item => item.login === loginVal && item.passwordHash === hash);
    if (!user) return { ok: false, msg: 'Identifiant ou mot de passe incorrect.' };
    if (user.statut === 'en_attente') return { ok: false, pending: true, msg: 'Votre inscription est en attente de validation par un Délégué de l\'Amicale. Vous serez contacté dès l\'activation de votre compte.' };
    if (user.statut === 'supprime') return { ok: false, msg: 'Compte supprimé. Contactez la Direction ou le Maître pour une réactivation.' };
    if (user.statut !== 'actif') return { ok: false, msg: 'Compte suspendu. Contactez un Délégué ou la Direction.' };
    _setSession(user);
    if (typeof LOG !== 'undefined') LOG.add('LOGIN', { acteurId: user.id, acteurLogin: user.login, acteurRole: user.role });
    return { ok: true, user };
  }

  function logout() {
    const user = getCurrentUser();
    if (user && typeof LOG !== 'undefined') LOG.add('LOGOUT', { acteurId: user.id, acteurLogin: user.login, acteurRole: user.role });
    sessionStorage.removeItem(K_SESSION);
    window.location.href = 'index.html';
  }

  function register(data) {
    const users = _getUsers();
    const loginValue = data.login.trim();
    const email = (data.email || '').trim();
    if (users.find(user => user.login === loginValue)) return { ok: false, msg: 'Ce login est déjà utilisé.' };
    if (email && users.find(user => user.email === email)) return { ok: false, msg: 'Cet e-mail est déjà enregistré.' };
    const roleId = getRoleDefinition(data.role_override) ? data.role_override : 'membre';
    const user = _normalizeUser({
      id: 'u_' + Date.now(),
      login: loginValue,
      passwordHash: _hash(data.password),
      nom: data.nom.trim().toUpperCase(),
      prenom: data.prenom.trim(),
      email,
      roles: [roleId],
      statut: data.statut_override || 'en_attente',
      validateurId: data.validateurId || null,
      dateInscription: new Date().toISOString().split('T')[0],
      telephone: (data.telephone || '').trim(),
      adresse: (data.adresse || '').trim(),
      lieuTravail: (data.lieuTravail || '').trim(),
      dateNaissance: (data.dateNaissance || ''),
      famille: [],
      notifications: { anniversaires: true, autresUsers: true, evenements: true, conventions: true, delaiJours: 7 },
      linkedTo: data.linkedTo || null,
      linkedInvites: []
    });
    users.push(user);
    _saveUsers(users);
    if (typeof LOG !== 'undefined') LOG.add('REGISTER', { cibleId: user.id, cibleLogin: user.login, detail: user.prenom + ' ' + user.nom });
    return { ok: true, userId: user.id, user };
  }

  function validateMember(memberId, validateurId) {
    const users = _getUsers();
    const cible = users.find(item => item.id === memberId);
    const acteur = users.find(item => item.id === validateurId);
    const ok = updateUser(memberId, { statut: 'actif', validateurId });
    if (ok && typeof LOG !== 'undefined') LOG.add('VALIDATE_MEMBER', {
      acteurId: acteur?.id, acteurLogin: acteur?.login, acteurRole: acteur?.role,
      cibleId: cible?.id, cibleLogin: cible?.login,
      detail: cible ? cible.prenom + ' ' + cible.nom : memberId
    });
    return ok;
  }

  function rejectMember(memberId) {
    const users = _getUsers();
    const user = users.find(item => item.id === memberId);
    if (!user || user.statut !== 'en_attente') return false;
    _saveUsers(users.filter(item => item.id !== memberId));
    if (typeof LOG !== 'undefined') LOG.add('REJECT_MEMBER', { cibleId: user.id, cibleLogin: user.login, detail: user.prenom + ' ' + user.nom });
    return true;
  }

  function getPendingMembers() {
    return _getUsers().filter(user => user.statut === 'en_attente');
  }

  function getMembersByValidateur(validateurId) {
    return _getUsers().filter(user => user.validateurId === validateurId && hasRole(user, 'membre'));
  }

  function requireAuth(minRole) {
    const user = getCurrentUser();
    if (!user) { window.location.href = 'login.html'; return null; }
    if (minRole && !hasRole(user, minRole)) {
      alert('Accès refusé : droits insuffisants.');
      history.back();
      return null;
    }
    return user;
  }

  function getUsers() {
    return _getUsers();
  }

  function updateUser(userId, changes) {
    const users = _getUsers();
    const index = users.findIndex(user => user.id === userId);
    if (index === -1) return false;
    const actor = getCurrentUser();
    const current = users[index];
    if (current.login === '347' && (changes.role !== undefined || changes.roles !== undefined || changes.statut !== undefined)) return false;
    const before = _normalizeUser(current);
    const next = { ...current, ...changes };
    if (changes.roles !== undefined) next.roles = Array.isArray(changes.roles) ? changes.roles : [changes.roles];
    else if (changes.role !== undefined) next.roles = [changes.role];
    const normalized = _normalizeUser(next);
    if (changes.statut !== undefined && changes.statut !== before.statut) {
      if (!hasPermission('Suspendre / réactiver utilisateur', actor, before)) return false;
    }
    if ((changes.role !== undefined || changes.roles !== undefined) && actor && !hasImplicitAllRole(actor)) {
      const forbidden = normalized.roles.some(roleId => getRoleLevel(roleId) <= getHighestPrivilegeLevel(actor));
      if (forbidden) return false;
    }
    users[index] = normalized;
    _saveUsers(users);
    const sessionUser = getCurrentUser();
    if (sessionUser && sessionUser.id === userId) _setSession(normalized);
    if (typeof LOG !== 'undefined') {
      const acteur = getCurrentUser();
      const beforeRoles = before.roles.map(getRoleLabel).join(', ');
      const afterRoles = normalized.roles.map(getRoleLabel).join(', ');
      if (beforeRoles !== afterRoles) {
        LOG.add('ROLE_CHANGE', {
          acteurId: acteur?.id, acteurLogin: acteur?.login, acteurRole: acteur?.role,
          cibleId: normalized.id, cibleLogin: normalized.login,
          detail: beforeRoles + ' → ' + afterRoles
        });
      }
      if (normalized.statut === 'suspendu' && before.statut !== 'suspendu') {
        LOG.add('SUSPEND_MEMBER', { acteurId: acteur?.id, acteurLogin: acteur?.login, acteurRole: acteur?.role, cibleId: normalized.id, cibleLogin: normalized.login, detail: normalized.prenom + ' ' + normalized.nom });
      }
      if (normalized.statut === 'actif' && before.statut === 'suspendu') {
        LOG.add('REACTIVATE_MEMBER', { acteurId: acteur?.id, acteurLogin: acteur?.login, acteurRole: acteur?.role, cibleId: normalized.id, cibleLogin: normalized.login, detail: normalized.prenom + ' ' + normalized.nom });
      }
      if (normalized.statut === 'supprime' && before.statut !== 'supprime') {
        LOG.add('ACCOUNT_ARCHIVE', { acteurId: acteur?.id, acteurLogin: acteur?.login, acteurRole: acteur?.role, cibleId: normalized.id, cibleLogin: normalized.login, detail: normalized.prenom + ' ' + normalized.nom });
      }
      if (normalized.statut === 'actif' && before.statut === 'supprime') {
        LOG.add('ACCOUNT_RESTORE', { acteurId: acteur?.id, acteurLogin: acteur?.login, acteurRole: acteur?.role, cibleId: normalized.id, cibleLogin: normalized.login, detail: normalized.prenom + ' ' + normalized.nom });
      }
    }
    return true;
  }

  function softDeleteUser(userId) {
    const users = _getUsers();
    const user = users.find(item => item.id === userId);
    const actor = getCurrentUser();
    if (!user || !hasPermission('Supprimer utilisateur', actor, user)) return false;
    if (user.statut === 'supprime') return true;
    return updateUser(userId, { statut: 'supprime' });
  }

  function deleteUser(userId) {
    const users = _getUsers();
    const user = users.find(item => item.id === userId);
    const actor = getCurrentUser();
    if (!user || user.login === '347') return false;
    if (!hasPermission('Supprimer définitivement utilisateur', actor, user)) return false;
    _saveUsers(users.filter(item => item.id !== userId));
    if (typeof LOG !== 'undefined') LOG.add('ACCOUNT_DELETE', { acteurId: actor?.id, acteurLogin: actor?.login, acteurRole: actor?.role, cibleId: user.id, cibleLogin: user.login, detail: user.prenom + ' ' + user.nom });
    return true;
  }

  function dashUrl(roleOrUser) {
    const roleId = typeof roleOrUser === 'string' ? roleOrUser : getPrimaryRole(roleOrUser || getCurrentUser());
    const level = getRoleLevel(roleId);
    if (level <= 0) return 'master.html';
    if (level <= 1) return 'superviseur.html';
    if (level <= 2) return 'admin.html';
    return 'espace-membre.html';
  }

  function addRole(data) {
    const actor = getCurrentUser();
    if (!canManageRoleDefinitions(actor)) return { ok: false, msg: 'Droits insuffisants pour ajouter un rôle.' };
    const id = _slugRoleId(data.id || data.label);
    if (!id) return { ok: false, msg: 'Identifiant de rôle invalide.' };
    if (getRoleDefinition(id)) return { ok: false, msg: 'Ce rôle existe déjà.' };
    const actorLevel = getHighestPrivilegeLevel(actor);
    const requestedLevel = Number(data.level);
    if (!hasImplicitAllRole(actor) && requestedLevel <= actorLevel) {
      return { ok: false, msg: 'Le niveau du rôle doit être inférieur à votre niveau.' };
    }
    const roleDefs = getRoles();
    roleDefs.push(_normalizeRoleDef({ ...data, id, system: false }, roleDefs.length));
    _saveRoleDefs(roleDefs);
    _saveRightsMatrix(_getRightsMatrix());
    return { ok: true, role: getRoleDefinition(id) };
  }

  function updateRole(roleId, changes) {
    const actor = getCurrentUser();
    if (!canManageRoleDefinitions(actor)) return false;
    const roleDefs = getRoles();
    const index = roleDefs.findIndex(role => role.id === roleId);
    if (index === -1) return false;
    const current = roleDefs[index];
    const actorLevel = getHighestPrivilegeLevel(actor);
    if (!hasImplicitAllRole(actor) && current.level <= actorLevel) return false;
    const next = _normalizeRoleDef({ ...current, ...changes, id: roleId, system: current.system }, index);
    if (!hasImplicitAllRole(actor) && next.level <= actorLevel) return false;
    if (current.id === 'master') {
      next.level = 0;
      next.implicitAll = true;
      next.linkedToUser = false;
    }
    roleDefs[index] = next;
    _saveRoleDefs(roleDefs);
    _saveUsers(_getUsers());
    _saveRightsMatrix(_getRightsMatrix());
    const currentUser = getCurrentUser();
    if (currentUser) _setSession(_normalizeUser(currentUser));
    return true;
  }

  function deleteRole(roleId) {
    const actor = getCurrentUser();
    if (!canManageRoleDefinitions(actor)) return false;
    const role = getRoleDefinition(roleId);
    if (!role || role.system) return false;
    if (!hasImplicitAllRole(actor) && role.level <= getHighestPrivilegeLevel(actor)) return false;
    const roleDefs = getRoles().filter(item => item.id !== roleId);
    _saveRoleDefs(roleDefs);
    const users = _getUsers().map(user => {
      const roles = user.roles.filter(item => item !== roleId);
      return _normalizeUser({ ...user, roles: roles.length ? roles : ['membre'] });
    });
    _saveUsers(users);
    _saveRightsMatrix(_getRightsMatrix());
    return true;
  }

  function exportRightsConfig() {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      roleDefs: getRoles(),
      permissionCatalog: getPermissionCatalog(),
      rightsMatrix: _getRightsMatrix()
    };
  }

  function importRightsConfig(config) {
    if (!config || typeof config !== 'object') return { ok: false, msg: 'Configuration invalide.' };
    try {
      if (!Array.isArray(config.roleDefs) || !config.permissionCatalog || !Array.isArray(config.rightsMatrix)) {
        return { ok: false, msg: 'Fichier de droits incomplet.' };
      }
      _saveRoleDefs(config.roleDefs);
      _savePermissionCatalog(config.permissionCatalog);
      _saveUsers(_getUsers());
      _saveRightsMatrix(config.rightsMatrix);
      const currentUser = getCurrentUser();
      if (currentUser) _setSession(_normalizeUser(currentUser));
      _updateNavbar();
      applyPermissions(document);
      return { ok: true };
    } catch (error) {
      return { ok: false, msg: error?.message || 'Import impossible.' };
    }
  }

  function _updateNavbar() {
    const nav = document.querySelector('.navbar-nav');
    if (!nav) return;
    nav.querySelectorAll('.attt-auth-nav').forEach(el => el.remove());
    const user = getCurrentUser();
    const li = document.createElement('li');
    li.className = 'nav-item attt-auth-nav ms-lg-2 mt-2 mt-lg-0';
    if (user) {
      const label = getRoleLabel(user.role);
      let pendingBadge = '';
      if (hasRole(user, 'admin')) {
        const count = _getUsers().filter(item => item.statut === 'en_attente').length;
        if (count > 0) pendingBadge = `<span class="badge bg-danger ms-1">${count}</span>`;
      }
      li.innerHTML = `
        <div class="d-flex align-items-center gap-1">
          <a href="${esc(dashUrl(user))}" class="btn btn-outline-light btn-sm">
            <i class="bi bi-person-circle me-1"></i>${esc(user.prenom)}
            <span class="badge bg-warning text-dark ms-1">${esc(label)}</span>${pendingBadge}
          </a>
          <a href="#" class="btn btn-sm btn-danger" title="Déconnexion" onclick="AUTH.logout();return false;">
            <i class="bi bi-box-arrow-right"></i>
          </a>
        </div>`;
    } else {
      li.innerHTML = `<a href="login.html" class="btn btn-attt btn-sm px-3"><i class="bi bi-person-fill me-1"></i>Se connecter</a>`;
    }
    nav.appendChild(li);
  }

  return {
    init, login, logout, register,
    getCurrentUser, currentUser, getUsers,
    getPendingMembers, getMembersByValidateur,
    validateMember, rejectMember,
    hasRole, userHasExactRole, requireAuth,
    getPermissionState, getPermissionSymbol, hasPermission, canViewPermission, can, applyPermissions,
    updateUser, softDeleteUser, deleteUser, dashUrl,
    getRoles, getRoleDefinition, getRoleLevel, getRoleLabel,
    getUserRoles, getPrimaryRole, getHighestPrivilegeLevel, getAssignableRoles,
    canManageRoleDefinitions,
    getVisibleMatrixRoles,
    getPermissionCatalog,
    registerPermissionPage,
    syncPermissionsFromDocument,
    addRole, updateRole, deleteRole,
    exportRightsConfig, importRightsConfig,
    _saveRightsMatrix,
    get ROLE_LABELS() { return _roleLabelsObject(); },
    get ROLES() { return _roleLevelsObject(); },
    get RIGHTS_MATRIX_DEFAULT() { return _buildDefaultRightsMatrix(); },
    esc
  };

})();

document.addEventListener('DOMContentLoaded', () => {
  if (typeof DB_READY !== 'undefined') DB_READY.then(() => AUTH.init());
  else AUTH.init();
});
