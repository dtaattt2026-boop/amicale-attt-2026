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
  const K_RIGHTS_VERSION = 'attt_droits_v6';

  // Colonnes : [label, _master(ignoré), Direction(superviseur), Délégué(admin), Membre]
  // Maître a implicitAll=true → il a tout automatiquement, n'apparaît pas dans la matrice
  // Famille hérite de Membre par défaut (sauf si 6e colonne explicite)
  const LEGACY_RIGHTS_MATRIX_DEFAULT = [
    // ── Connexion ──
    ['Se connecter',                          '✓','✓','✓','✓'],

    // ── 1. Événements (programmer, modifier, bloquer, supprimer) ──
    ['Consulter événements',                  '✓','✓','✓','✓'],
    ['Créer événement',                       '✓','✓','✓','—'],
    ['Modifier événement',                    '✓','✓','✓','—'],
    ['Bloquer événement',                     '✓','✓','✓','—'],
    ['Supprimer événement',                   '✓','✓','✓','—'],

    // ── 1. Voyages & Sorties (programmer, modifier, bloquer, supprimer) ──
    ['Consulter voyages',                     '✓','✓','✓','✓'],
    ['Créer voyage',                          '✓','✓','✓','—'],
    ['Modifier voyage',                       '✓','✓','✓','—'],
    ['Bloquer voyage',                        '✓','✓','✓','—'],
    ['Supprimer voyage',                      '✓','✓','✓','—'],
    ['S\'inscrire à un voyage',               '✓','✓','✓','✓'],
    ['Gérer inscriptions voyage',             '✓','✓','✓','—'],

    // ── 1. Votes (programmer, modifier, bloquer, supprimer) ──
    ['Consulter votes',                       '✓','✓','✓','✓'],
    ['Créer vote',                            '✓','✓','✓','—'],
    ['Modifier vote',                         '✓','✓','✓','—'],
    ['Bloquer vote',                          '✓','✓','✓','—'],
    ['Supprimer vote',                        '✓','✓','✓','—'],
    ['Participer au vote',                    '✓','✓','✓','✓'],
    ['Voir résultats vote',                   '✓','✓','✓','✓'],

    // ── 1. Offres (programmer, modifier, bloquer, supprimer) ──
    ['Consulter offres',                      '✓','✓','✓','✓'],
    ['Créer offre',                           '✓','✓','✓','—'],
    ['Modifier offre',                        '✓','✓','✓','—'],
    ['Bloquer offre',                         '✓','✓','✓','—'],
    ['Supprimer offre',                       '✓','✓','✓','—'],

    // ── 1. Locations vacances (programmer, modifier, bloquer, supprimer) ──
    ['Consulter locations',                   '✓','✓','✓','✓'],
    ['Créer location',                        '✓','✓','✓','—'],
    ['Modifier location',                     '✓','✓','✓','—'],
    ['Bloquer location',                      '✓','✓','✓','—'],
    ['Supprimer location',                    '✓','✓','✓','—'],
    ['Réserver location vacances',            '✓','✓','✓','✓'],

    // ── 1. Conventions (programmer, modifier, bloquer, supprimer) ──
    ['Consulter conventions',                 '✓','✓','✓','✓'],
    ['Créer convention',                      '✓','✓','✓','—'],
    ['Modifier convention',                   '✓','✓','✓','—'],
    ['Bloquer convention',                    '✓','✓','✓','—'],
    ['Supprimer convention',                  '✓','✓','✓','—'],

    // ── Actualités ──
    ['Consulter articles',                    '✓','✓','✓','⚠'],
    ['Publier article',                       '✓','✓','✓','—'],
    ['Modifier article',                      '✓','✓','✓','—'],
    ['Supprimer article',                     '✓','✓','✓','—'],

    // ── Galerie ──
    ['Ajouter photo galerie',                 '✓','✓','✓','—'],
    ['Supprimer photo galerie',               '✓','✓','✓','—'],

    // ── 2. Utilisateurs (valider, affecter à un groupe) ──
    ['Valider inscription',                   '✓','✓','✓','—'],
    ['Rejeter inscription',                   '✓','✓','✓','—'],
    ['Affecter à un groupe',                  '✓','✓','—','—'],
    ['Suspendre utilisateur',                 '✓','✓','✓','—'],
    ['Réactiver utilisateur',                 '✓','✓','✓','—'],
    ['Supprimer utilisateur',                 '✓','✓','✓','—'],
    ['Supprimer définitivement',              '✓','✓','—','—'],
    ['Promouvoir → Délégué',                  '✓','✓','—','—'],
    ['Promouvoir → Direction',                '✓','✓','—','—'],
    ['Promouvoir → Administration',           '✓','—','—','—'],
    ['Rétrograder un utilisateur',            '✓','✓','—','—'],
    ['Voir colonne E-mail',                   '✓','✓','✓','—'],
    ['Voir colonne Inscrits',                 '✓','✓','✓','—'],

    // ── 3. Groupes — modifier, ajouter, supprimer, bloquer ──
    ['Consulter les groupes',                 '✓','✓','—','—'],
    ['Créer un groupe',                       '✓','✓','—','—'],
    ['Modifier un groupe',                    '✓','✓','—','—'],
    ['Bloquer un groupe',                     '✓','✓','—','—'],
    ['Supprimer un groupe',                   '✓','✓','—','—'],

    // ── 4. Droits — donner ou modifier les droits (groupes) ──
    ['Consulter les droits',                  '✓','✓','—','—'],
    ['Modifier les droits',                   '✓','✓','—','—'],

    // ── 5. Messages (modifier, bloquer, supprimer) ──
    ['Consulter messages',                    '✓','✓','✓','✓'],
    ['Envoyer message',                       '✓','✓','✓','✓'],
    ['Modifier message',                      '✓','✓','✓','—'],
    ['Bloquer messages (un utilisateur)',      '✓','✓','—','—'],
    ['Bloquer messages (tous)',               '✓','✓','—','—'],
    ['Supprimer message',                     '✓','✓','✓','—'],

    // ── 6. Publicité accueil (modifier, ajouter, supprimer) ──
    ['Consulter publicités accueil',          '✓','✓','✓','—'],
    ['Ajouter publicité accueil',             '✓','✓','✓','—'],
    ['Modifier publicité accueil',            '✓','✓','✓','—'],
    ['Supprimer publicité accueil',           '✓','✓','✓','—'],

    // ── 7. Pages & Configuration (réorganiser, modifier les noms, ordre…) ──
    ['Réorganiser les pages',                 '✓','✓','—','—'],
    ['Modifier les paramètres du site',       '✓','✓','—','—'],

    // ── 3bis. Création avancée (tables, entités, paramétrage complet) ──
    ['Créer des tables / entités',            '✓','✓','—','—'],
    ['Vider un acte',                         '✓','✓','—','—'],
    ['Supprimer un acte',                     '✓','✓','—','—'],

    // ── 8. Mises à jour (tester puis publier) ──
    ['Tester mise à jour',                    '✓','✓','—','—'],
    ['Publier mise à jour',                   '✓','—','—','—'],

    // ── Système ──
    ['Voir journal des opérations',           '✓','✓','—','—'],
    ['Effacer journal',                       '✓','✓','—','—'],

    // ── Accès pages ──
    ['Accéder Espace membre',                 '✓','✓','✓','✓'],
    ['Accéder Profil',                        '✓','✓','✓','✓'],
    ['Accéder Messagerie',                    '✓','✓','✓','✓'],
    ['Accéder Événements',                    '✓','✓','✓','✓'],
    ['Accéder Offres',                        '✓','✓','✓','✓'],
    ['Accéder Voyages',                       '✓','✓','✓','✓'],
    ['Accéder Votes',                         '✓','✓','✓','✓'],
    ['Accéder Locations',                     '✓','✓','✓','✓'],
    ['Accéder Conventions',                   '✓','✓','✓','✓'],
    ['Accéder Galerie',                       '✓','✓','✓','✓'],
    ['Accéder Actualités',                    '✓','✓','✓','—'],
    ['Accéder Administration',                '✓','✓','✓','—'],
    ['Accéder Superviseur',                   '✓','✓','—','—'],
    ['Accéder page Administration',           '✓','—','—','—'],
    ['Accéder Droits',                        '✓','✓','—','—'],
    ['Accéder Journal',                       '✓','✓','—','—'],
    ['Accéder Guide technique',               '✓','✓','—','—'],
    ['Accéder Paramètres site',               '✓','✓','—','—'],
    ['Accéder Publicités accueil',            '✓','✓','✓','—'],
    ['Accéder Versions',                      '✓','✓','✓','—'],
  ];

  const DEFAULT_PERMISSION_PAGES = [
    {
      id: 'global',
      label: 'Connexion',
      path: '',
      permissions: ['Se connecter']
    },

    // ── 1. Actes : programmer, modifier, bloquer, supprimer ──
    {
      id: 'evenements',
      label: 'Événements',
      path: 'evenements.html',
      permissions: [
        'Consulter événements', 'Créer événement', 'Modifier événement',
        'Bloquer événement', 'Supprimer événement',
        'Accéder Événements', 'Voir colonne Inscrits'
      ]
    },
    {
      id: 'voyages',
      label: 'Voyages & Sorties',
      path: 'voyages.html',
      permissions: [
        'Consulter voyages', 'Créer voyage', 'Modifier voyage',
        'Bloquer voyage', 'Supprimer voyage',
        'S\'inscrire à un voyage', 'Gérer inscriptions voyage',
        'Accéder Voyages'
      ]
    },
    {
      id: 'votes',
      label: 'Votes',
      path: 'votes.html',
      permissions: [
        'Consulter votes', 'Créer vote', 'Modifier vote',
        'Bloquer vote', 'Supprimer vote',
        'Participer au vote', 'Voir résultats vote',
        'Accéder Votes'
      ]
    },
    {
      id: 'offres',
      label: 'Offres',
      path: 'offres.html',
      permissions: [
        'Consulter offres', 'Créer offre', 'Modifier offre',
        'Bloquer offre', 'Supprimer offre',
        'Accéder Offres'
      ]
    },
    {
      id: 'locations',
      label: 'Locations vacances',
      path: 'location.html',
      permissions: [
        'Consulter locations', 'Créer location', 'Modifier location',
        'Bloquer location', 'Supprimer location',
        'Réserver location vacances',
        'Accéder Locations'
      ]
    },
    {
      id: 'conventions',
      label: 'Conventions',
      path: 'conventions.html',
      permissions: [
        'Consulter conventions', 'Créer convention', 'Modifier convention',
        'Bloquer convention', 'Supprimer convention',
        'Accéder Conventions'
      ]
    },
    {
      id: 'actualites',
      label: 'Actualités',
      path: 'contenu-admin.html',
      permissions: [
        'Consulter articles', 'Publier article', 'Modifier article', 'Supprimer article',
        'Accéder Actualités'
      ]
    },
    {
      id: 'galerie',
      label: 'Galerie',
      path: 'galerie.html',
      permissions: ['Ajouter photo galerie', 'Supprimer photo galerie', 'Accéder Galerie']
    },

    // ── 2. Utilisateurs : valider, affecter à un groupe ──
    {
      id: 'utilisateurs',
      label: 'Utilisateurs',
      path: 'admin.html',
      permissions: [
        'Valider inscription', 'Rejeter inscription', 'Affecter à un groupe',
        'Suspendre utilisateur', 'Réactiver utilisateur',
        'Supprimer utilisateur', 'Supprimer définitivement',
        'Promouvoir → Délégué', 'Promouvoir → Direction', 'Promouvoir → Administration',
        'Rétrograder un utilisateur',
        'Voir colonne E-mail',
        'Accéder Administration', 'Accéder Superviseur'
      ]
    },

    // ── 3. Groupes : modifier, ajouter, supprimer, bloquer ──
    {
      id: 'groupes',
      label: 'Groupes & Rôles',
      path: 'droits.html',
      permissions: [
        'Consulter les groupes', 'Créer un groupe', 'Modifier un groupe',
        'Bloquer un groupe', 'Supprimer un groupe'
      ]
    },

    // ── 4. Droits : donner ou modifier les droits (groupes) ──
    {
      id: 'droits',
      label: 'Droits & Permissions',
      path: 'droits.html',
      permissions: ['Consulter les droits', 'Modifier les droits', 'Accéder Droits']
    },

    // ── 5. Messages : modifier, bloquer, supprimer ──
    {
      id: 'messages',
      label: 'Messages',
      path: 'messagerie.html',
      permissions: [
        'Consulter messages', 'Envoyer message', 'Modifier message',
        'Bloquer messages (un utilisateur)', 'Bloquer messages (tous)',
        'Supprimer message',
        'Accéder Messagerie'
      ]
    },

    // ── 6. Publicité accueil (page publique avant login) ──
    {
      id: 'publicites',
      label: 'Publicité accueil',
      path: 'publicites.html',
      permissions: [
        'Consulter publicités accueil', 'Ajouter publicité accueil',
        'Modifier publicité accueil', 'Supprimer publicité accueil',
        'Accéder Publicités accueil'
      ]
    },

    // ── 7. Pages & Configuration : réorganiser, noms, ordre… ──
    {
      id: 'pages-config',
      label: 'Pages & Configuration',
      path: 'parametres.html',
      permissions: [
        'Réorganiser les pages', 'Modifier les paramètres du site',
        'Créer des tables / entités', 'Vider un acte', 'Supprimer un acte',
        'Accéder Paramètres site'
      ]
    },

    // ── 8. Mises à jour ──
    {
      id: 'mises-a-jour',
      label: 'Mises à jour',
      path: 'versions.html',
      permissions: [
        'Tester mise à jour', 'Publier mise à jour',
        'Accéder Versions'
      ]
    },

    // ── Système ──
    {
      id: 'systeme',
      label: 'Système',
      path: 'journal.html',
      permissions: [
        'Voir journal des opérations', 'Effacer journal',
        'Accéder Journal', 'Accéder Guide technique'
      ]
    },

    // ── Accès pages (navigation) ──
    {
      id: 'acces-pages',
      label: 'Accès pages',
      path: '',
      permissions: [
        'Accéder Espace membre', 'Accéder Profil',
        'Accéder page Administration'
      ]
    }
  ];

  const LEGACY_ROLE_IDS = ['superviseur', 'admin', 'membre', 'famille'];
  const SYMBOL_PRIORITY = { '—': 0, '⚠': 1, '✓': 2 };
  const PERMISSION_AXES = ['visible', 'action'];
  const PERMISSION_ALIASES = {
    // ── Événements (ancien → nouveau) ──
    'Consulter événements (publics)':         'Consulter événements',
    'Consulter événements (membres)':         'Consulter événements',
    'Ajouter / modifier événement':           'Modifier événement',
    'Voir bouton Ajouter événement':          'Créer événement',
    'Voir bouton Supprimer événement':        'Supprimer événement',

    // ── Offres ──
    'Ajouter / modifier offre':               'Modifier offre',
    'Voir bouton Ajouter offre':              'Créer offre',
    'Voir bouton Supprimer offre':            'Supprimer offre',

    // ── Voyages ──
    'Créer / modifier voyage':                'Modifier voyage',
    'S\'inscrire voyage':                     'S\'inscrire à un voyage',
    'Voir bouton Ajouter voyage':             'Créer voyage',

    // ── Votes ──
    'Créer / modifier vote':                  'Modifier vote',
    'Gérer votes':                            'Modifier vote',
    'Voir bouton Créer vote':                 'Créer vote',
    'Créer vote':                             'Créer vote',
    'Creer vote':                             'Créer vote',

    // ── Conventions ──
    'Voir bouton Ajouter convention':         'Créer convention',
    'Consulter conventions réservées':        'Consulter conventions',
    'Voir détail convention réservée':        'Consulter conventions',

    // ── Actualités ──
    'Consulter articles / actualités':        'Consulter articles',
    'Publier article avec photo':             'Publier article',
    'Modifier / supprimer article':           'Modifier article',

    // ── Publicités ──
    'Ajouter / modifier publicité accueil':   'Modifier publicité accueil',
    'Voir bouton Ajouter publicité accueil':  'Ajouter publicité accueil',

    // ── Utilisateurs ──
    'Valider inscription (en attente)':       'Valider inscription',
    'Suspendre / réactiver utilisateur':      'Suspendre utilisateur',
    'Supprimer définitivement utilisateur':   'Supprimer définitivement',

    // ── Droits ──
    'Voir bouton Modifier matrice':           'Modifier les droits',

    // ── Paramètres ──
    'Modifier paramètres site':               'Modifier les paramètres du site',

    // ── Accès pages (ancien "Accéder page X" → nouveau "Accéder X") ──
    'Accéder page Droits':                    'Accéder Droits',
    'Accéder page Journal':                   'Accéder Journal',
    'Accéder page Guide technique':           'Accéder Guide technique',
    'Accéder page Paramètres site':           'Accéder Paramètres site',
    'Accéder page Publicités accueil':        'Accéder Publicités accueil',
    'Accéder page Actualités':                'Accéder Actualités',
    'Accéder page Superviseur':               'Accéder Superviseur',
    'Accéder page Admin':                     'Accéder Administration',
    'Accéder page Espace membre':             'Accéder Espace membre',
    'Accéder page Profil':                    'Accéder Profil',
    'Accéder page Messagerie':                'Accéder Messagerie',
    'Accéder page Locations':                 'Accéder Locations',
    'Accéder page Voyages':                   'Accéder Voyages',
    'Accéder page Votes':                     'Accéder Votes',
    'Accéder page Versions':                  'Accéder Versions',

    // ── Sans accent (saisie rapide) ──
    'Acceder page Superviseur':               'Accéder Superviseur',
    'Acceder page Admin':                     'Accéder Administration',
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
    const byId = new Map();
    const byPath = new Map();  // Dédoublonnage par path

    // Insérer d'abord les DEFAULT pour qu'ils servent de référence
    DEFAULT_PERMISSION_PAGES.forEach((page, index) => {
      const normalized = _normalizePermissionPage(page, index);
      byId.set(normalized.id, normalized);
      if (normalized.path) byPath.set(normalized.path, normalized.id);
    });

    // Fusionner les pages sauvegardées
    savedPages.forEach((page, index) => {
      const normalized = _normalizePermissionPage(page, index);
      // Si une page avec le même path existe déjà sous un autre ID, fusionner
      const existingIdByPath = normalized.path && byPath.get(normalized.path);
      const targetId = (existingIdByPath && existingIdByPath !== normalized.id) ? existingIdByPath : normalized.id;

      if (byId.has(targetId)) {
        const existing = byId.get(targetId);
        byId.set(targetId, {
          ...existing,
          permissions: [...new Set([...(existing.permissions || []), ...(normalized.permissions || [])])].sort((left, right) => left.localeCompare(right, 'fr'))
        });
      } else {
        byId.set(normalized.id, normalized);
        if (normalized.path) byPath.set(normalized.path, normalized.id);
      }
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
      const raw = _normalizePermissionCatalog(JSON.parse(localStorage.getItem(K_PERMISSION_CATALOG) || 'null'));
      return _injectEntityTypePermissions(raw);
    } catch {
      return _injectEntityTypePermissions(_normalizePermissionCatalog({ pages: DEFAULT_PERMISSION_PAGES }));
    }
  }

  /* Injecte dynamiquement les permissions des actes créés via creation-actes.html */
  function _injectEntityTypePermissions(catalog) {
    let entityTypes = [];
    try { entityTypes = JSON.parse(localStorage.getItem('attt_entity_types') || '[]'); } catch { /* */ }
    if (!entityTypes.length) return catalog;

    const pages = [...catalog.pages];
    entityTypes.forEach(t => {
      const pageId = 'entity-' + (t.id || '');
      if (pages.some(p => p.id === pageId)) return; // déjà présent
      pages.push({
        id: pageId,
        label: t.name || 'Acte',
        path: 'espace-membre.html',
        permissions: [
          'Consulter ' + t.name,
          'Créer ' + t.name,
          'Modifier ' + t.name,
          'Bloquer ' + t.name,
          'Supprimer ' + t.name,
          'Vider ' + t.name,
          'Supprimer acte ' + t.name,
          'Accéder ' + t.name
        ]
      });
    });
    return { pages };
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
    return hasPermission('Modifier les droits', actorOrUser);
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
    const legacyRows = LEGACY_RIGHTS_MATRIX_DEFAULT.map(row => {
      const [label, _master, direction, delegue, membre] = row;
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
    return Array.isArray(rows) && rows.some(row => Array.isArray(row) && (row[0] === 'Promouvoir → Administration' || row[0] === 'Créer événement'));
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
        localStorage.removeItem(K_PERMISSION_CATALOG);
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
    if (user.statut === 'supprime') return { ok: false, msg: 'Compte supprimé. Contactez la Direction pour une réactivation.' };
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

  /* ─── Système d'invitations ──────────────────── */
  const K_INVITATIONS = 'attt_invitations';

  function _loadInvitations() {
    try { return JSON.parse(localStorage.getItem(K_INVITATIONS) || '[]'); } catch { return []; }
  }

  function _saveInvitations(list) {
    localStorage.setItem(K_INVITATIONS, JSON.stringify(list));
    if (typeof DB !== 'undefined') DB.push(K_INVITATIONS, list);
  }

  /**
   * Rôles autorisés pour l'invitation selon le rôle de l'inviteur :
   * - membre   → famille uniquement
   * - admin    → membre, famille
   * - superviseur → membre, famille, admin, superviseur
   * - master   → tous
   */
  function getInvitableRoles(inviter) {
    if (!inviter) return [];
    const level = getHighestPrivilegeLevel(inviter);
    if (level <= 0) return getRoles().filter(r => r.id !== 'master').map(r => r.id);           // master → tout sauf master
    if (level <= 1) return ['superviseur', 'admin', 'membre', 'famille'];                       // direction
    if (level <= 2) return ['membre', 'famille'];                                               // délégué
    return ['famille'];                                                                          // membre
  }

  function createInvitation(inviter, targetRoleId) {
    if (!inviter) return { ok: false, msg: 'Non connecté.' };
    const allowed = getInvitableRoles(inviter);
    if (!allowed.includes(targetRoleId)) return { ok: false, msg: 'Vous n\'êtes pas autorisé à inviter ce rôle.' };
    const code = 'INV-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const invitation = {
      id: 'inv_' + Date.now(),
      code,
      inviterId: inviter.id,
      inviterName: inviter.prenom + ' ' + inviter.nom,
      targetRole: targetRoleId,
      createdAt: new Date().toISOString(),
      used: false,
      usedBy: null
    };
    const list = _loadInvitations();
    list.push(invitation);
    _saveInvitations(list);
    if (typeof LOG !== 'undefined') LOG.add('INVITATION_CREATED', {
      acteurId: inviter.id, acteurLogin: inviter.login,
      detail: 'Invitation ' + code + ' pour rôle ' + getRoleLabel(targetRoleId)
    });
    return { ok: true, invitation };
  }

  function getInvitation(code) {
    return _loadInvitations().find(inv => inv.code === code && !inv.used) || null;
  }

  function getMyInvitations(userId) {
    return _loadInvitations().filter(inv => inv.inviterId === userId);
  }

  function revokeInvitation(invitationId, userId) {
    const list = _loadInvitations();
    const idx = list.findIndex(inv => inv.id === invitationId && inv.inviterId === userId && !inv.used);
    if (idx === -1) return false;
    list.splice(idx, 1);
    _saveInvitations(list);
    return true;
  }

  function registerViaInvitation(invitationCode, data) {
    const inv = getInvitation(invitationCode);
    if (!inv) return { ok: false, msg: 'Code d\'invitation invalide ou déjà utilisé.' };
    const linkedTo = (inv.targetRole === 'famille') ? inv.inviterId : null;
    const result = register({
      ...data,
      role_override: inv.targetRole,
      statut_override: 'actif',
      validateurId: inv.inviterId,
      invitationId: inv.id,
      linkedTo
    });
    if (result.ok) {
      // Marquer l'invitation comme utilisée
      const list = _loadInvitations();
      const target = list.find(item => item.id === inv.id);
      if (target) { target.used = true; target.usedBy = result.userId; target.usedAt = new Date().toISOString(); }
      _saveInvitations(list);
      // Si famille, rattacher au profil de l'inviteur
      if (inv.targetRole === 'famille') {
        const users = _getUsers();
        const inviterUser = users.find(u => u.id === inv.inviterId);
        if (inviterUser) {
          if (!Array.isArray(inviterUser.linkedInvites)) inviterUser.linkedInvites = [];
          inviterUser.linkedInvites.push(result.userId);
          _saveUsers(users);
        }
      }
      if (typeof LOG !== 'undefined') LOG.add('INVITATION_USED', {
        cibleId: result.userId, cibleLogin: data.login,
        detail: 'Via invitation ' + inv.code + ' de ' + inv.inviterName + ' → rôle ' + getRoleLabel(inv.targetRole)
      });
    }
    return result;
  }

  function buildInvitationLink(code) {
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return base + 'inscription.html?invite=' + encodeURIComponent(code);
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
      if (!hasPermission('Suspendre utilisateur', actor, before)) return false;
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
    if (!hasPermission('Supprimer définitivement', actor, user)) return false;
    _saveUsers(users.filter(item => item.id !== userId));
    if (typeof LOG !== 'undefined') LOG.add('ACCOUNT_DELETE', { acteurId: actor?.id, acteurLogin: actor?.login, acteurRole: actor?.role, cibleId: user.id, cibleLogin: user.login, detail: user.prenom + ' ' + user.nom });
    return true;
  }

  function dashUrl(roleOrUser) {
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
    getInvitableRoles, createInvitation, getInvitation, getMyInvitations,
    revokeInvitation, registerViaInvitation, buildInvitationLink,
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
