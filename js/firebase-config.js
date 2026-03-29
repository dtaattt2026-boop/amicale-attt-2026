/**
 * firebase-config.js — Configuration Firebase pour la persistance des données
 *
 * COMMENT ACTIVER LA BASE DE DONNÉES CLOUD :
 * ══════════════════════════════════════════
 *
 * ÉTAPE 1 — Créer le projet Firebase
 *   → https://console.firebase.google.com
 *   → "Créer un projet" → nom : amicale-attt
 *   → Désactiver Google Analytics (inutile)
 *
 * ÉTAPE 2 — Créer la base Firestore
 *   → Build → Firestore Database → Create database
 *   → Choisir un serveur proche (europe-west1 pour l'Algérie)
 *   → Démarrer en mode "Production"
 *
 * ÉTAPE 3 — Définir les règles d'accès Firestore
 *   → Onglet "Rules" → coller les règles suivantes → Publish :
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /site_data/{document} {
 *         allow read, write: if true;
 *       }
 *       match /_sys/{document} {
 *         allow read, write: if true;
 *       }
 *     }
 *   }
 *
 * ÉTAPE 4 — Obtenir la configuration
 *   → Paramètres du projet (⚙) → Général → Vos applications
 *   → "Ajouter une application" → Web (</>)
 *   → Copier apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
 *
 * ÉTAPE 5 — Renseigner les valeurs ci-dessous et mettre FIREBASE_ENABLED = true
 */

/* ─── Activer/Désactiver Firebase ───────────────────────────── */
const FIREBASE_ENABLED = true;

/* ─── Votre configuration Firebase ─────────────────────────── */
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyAZs_Mok0RZLjqq360CNWVumLMg2Ia8pjU',
  authDomain:        'amicale-attt.firebaseapp.com',
  projectId:         'amicale-attt',
  storageBucket:     'amicale-attt.firebasestorage.app',
  messagingSenderId: '778227653817',
  appId:             '1:778227653817:web:537314a7f456ddac658f68'
};

/*
 * ─── Stockage média distant ───────────────────────────────
 * provider:
 *   - 'auto'         : Google Drive si configuré, sinon Firebase
 *   - 'google-drive' : force Google Drive
 *   - 'firebase'     : force Firebase Storage
 */
const MEDIA_STORAGE_PROVIDER = 'auto';

/*
 * Pour stocker les photos et documents dans le Drive ATTT,
 * créez un OAuth Client ID Web dans Google Cloud puis renseignez clientId.
 * Le site créera automatiquement une arborescence du type :
 *   ATTT-Site-Medias / media / events / 2026 / 03
 */
const GOOGLE_DRIVE_CONFIG = {
  clientId: '778227653817-sl5v7fatk6jq3fdovrvn823vkbjda444.apps.googleusercontent.com',
  loginHint: 'attt.amicale.tunisie@gmail.com',
  appName: 'Amicale ATTT',
  baseFolderName: 'ATTT-Site-Medias',
  docsFolderName: 'documents',
  mediaFolderName: 'media',
  scope: 'https://www.googleapis.com/auth/drive.file'
};
