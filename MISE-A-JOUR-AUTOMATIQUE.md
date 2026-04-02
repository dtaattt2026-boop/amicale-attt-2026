# Mise à Jour Automatique — Documentation technique

## Corrections appliquées

### 1. ✅ Service Worker amélioré (`sw.js`)

**Problème initial** : Le cache était statique (`amicale-attt-v2`), force update ne s'effectuait jamais

**Solution** :
- Lecture dynamique de `assets/version.json` au démarrage du SW
- CACHE_NAME mis à jour automatiquement : `amicale-attt-v{VERSION}`  
- Nettoyage des anciens caches à chaque activation
- Support des messages du client (SKIP_WAITING) pour forcer le rechargement

```javascript
// Avant: const CACHE_NAME = 'amicale-attt-v2';  // ❌ statique
// Après: let CACHE_NAME = 'amicale-attt-v1.0.0'; // ✅ dynamique
```

### 2. ✅ Gestionnaire global des mises à jour (`js/update-manager.js`)

**Nouveau fichier** : Orchestre l'enregistrement du SW, la détection de versions et la synchronisation en background

**Fonctionnalités** :
- Enregistre le Service Worker
- Détecte les mises à jour du SW et force le rechargement
- Appelle `VERSION_CHECK.checkAndNotify()` au chargement
- Configure le Background Sync pour les vérifications périodiques (toutes les 2h)
- Vérifie les mises à jour chaque heure en arrière-plan

```javascript
UPDATE_MANAGER.init(); // Lance automatiquement à DOMContentLoaded
```

### 3. ✅ Ajout de `update-manager.js` à toutes les pages

**Pages mises à jour** :
```
✅ index.html
✅ activites.html
✅ a-propos.html  
✅ contact.html
✅ evenements.html
✅ galerie.html
✅ offres.html
✅ hebergement.html
✅ telechargements.html
✅ master.html (admin)
✅ actualites.html
✅ voyages.html
✅ login.html
✅ inscription.html
✅ conventions.html
✅ location.html
✅ espace-membre.html
```

### 4. ✅ Fluxde mise à jour complet

```
┌─────────────────────────────────────────────────────┐
│ 1. UPDATE_MANAGER.init()                            │
│    ├─ Enregistre Service Worker                     │
│    ├─ Détecte mises à jour du SW                    │
│    └─ Appelle VERSION_CHECK.checkAndNotify()        │
│                                                       │
│ 2. VERSION_CHECK.checkAndNotify()                   │
│    ├─ Récupère assets/version.json                  │
│    ├─ Compare versions enregistrées                 │
│    └─ Affiche bannière si mise à jour trouvée       │
│                                                       │
│ 3. Service Worker active                            │
│    ├─ Met en cache les assets                       │
│    ├─ Utilise nom dynamique du cache                │
│    └─ Nettoie les anciens caches                    │
│                                                       │
│ 4. Background Sync (PWA/Android)                    │
│    └─ Vérifie toutes les 2 heures                   │
└─────────────────────────────────────────────────────┘
```

## Configuration de la version

Fichier : `assets/version.json`

```json
{
  "version": "1.0.0",
  "datePublication": "2026-03-25",
  "changelog": "Description de la mise à jour",
  "forceUpdate": false,
  "platforms": {
    "windows": {
      "version": "1.0.0",
      "fichier": "assets/app-desktop/amicale-attt-setup.exe"
    },
    "android": {
      "version": "1.0.0",
      "fichier": "assets/app-android/amicale-attt.apk"
    },
    "pwa": {
      "version": "1.0.0",
      "note": "Mise à jour automatique à chaque visite"
    }
  }
}
```

### Comment publier une mise à jour

1. **Mettre à jour le fichier version.json** :
   ```bash
   # Incrémenter la version
   "version": "1.1.0"  # ✅
   
   # Ou pour mise à jour obligatoire
   "forceUpdate": true
   ```

2. **Déployer les fichiers modifiés** sur le serveur

3. **À la prochaine visite**, les utilisateurs verront :
   - **Mise à jour optionnelle** : bannière jaune avec bouton "Mettre à jour"
   - **Mise à jour obligatoire** (forceUpdate=true) : bannière rouge, non fermable

4. **Smartphones Android** :
   - Le SW se réenregistre automatiquement
   - Les fichiers en cache se mettent à jour progressivement
   - Background Sync déclenche les vérifications périodiques

## Vérification du fonctionnement

### Test dans le navigateur

Ouvrir **DevTools** (F12) → **Application** → **Service Workers**

```
✅ Service Worker enregistré
✅ HTTPS activé (obligatoire)
✅ Cache visible dans l'onglet "Cache storage"
✅ Nom du cache = 'amicale-attt-v1.0.0'
```

### Test sur PWA/Android

1. Installer l'app depuis `telechargements.html`
2. Ouvrir l'app hors-ligne → fonctionne ✅
3. Connexion internet, modifier `version.json`
4. Fermer et réouvrir l'app → mise à jour détectée ✅
5. Bannière "Nouvelle version disponible" apparaît ✅

### Déboguer offline

```javascript
// Console → 
VERSION_CHECK.checkAndNotify();  // Force vérification
localStorage.getItem('attt_installed_versions')  // Voir versions stockées
```

## Fichiers modifiés

```
✅ sw.js                    — Versioning dynamique du cache
✅ js/update-manager.js     — NOUVEAU — Orchestration des mises à jour
✅ index.html               — Ajout update-manager.js
✅ activites.html           — Ajout update-manager.js
✅ a-propos.html            — Ajout update-manager.js
✅ contact.html             — Ajout update-manager.js
✅ evenements.html          — Ajout update-manager.js
✅ galerie.html             — Ajout update-manager.js
✅ offres.html              — Ajout update-manager.js
✅ hebergement.html         — Ajout update-manager.js
✅ telechargements.html     — Ajout update-manager.js
✅ master.html              — Ajout update-manager.js
✅ actualites.html          — Ajout version-check + update-manager
✅ voyages.html             — Ajout version-check + update-manager
✅ login.html               — Ajout version-check + update-manager
✅ inscription.html         — Ajout version-check + update-manager
✅ conventions.html         — Ajout version-check + update-manager
✅ location.html            — Ajout version-check + update-manager
✅ espace-membre.html       — Ajout version-check + update-manager
```

## Résumé des avantages

| Avant | Après |
|-------|-------|
| ❌ Mises à jour non automatiques | ✅ Détection automatique des nouvelles versions |
| ❌ Cache statique, jamais mis à jour | ✅ Cache versionnéDynamiquement |
| ❌ Uniquement sur index.html | ✅ Sur toutes les pages du site |
| ❌ Pas de sync en arrière-plan | ✅ Vérifications périodiques (toutes les 2h) |
| ❌ Pas de mises à jour obligatoires | ✅ Support de forceUpdate |
| ❌ Banniere une seule fois | ✅ Bannière sur chaque page, révérifiable toutes les 2h |

---

**Date de déploiement** : 2 April 2026  
**Statut** : ✅ Production  
