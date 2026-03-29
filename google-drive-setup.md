# Configuration Google Drive

Ce site peut stocker les photos et documents dans le Drive du compte ATTT au lieu de les garder dans l'hébergement du site.

Objectif
- stocker les fichiers dans Google Drive
- ne conserver dans le site que les URL et métadonnées
- organiser automatiquement les fichiers par type puis par date

Arborescence créée automatiquement
- ATTT-Site-Medias
- ATTT-Site-Medias/media/events/2026/03
- ATTT-Site-Medias/media/offers/2026/03
- ATTT-Site-Medias/media/conventions/2026/03
- ATTT-Site-Medias/media/rentals/2026/03
- ATTT-Site-Medias/media/home-ads/2026/03
- ATTT-Site-Medias/documents/... si vous utilisez l'upload pour des documents

Ce que cela change
- les fichiers ne passent plus par Firebase Storage si Google Drive est configuré
- le site enregistre seulement l'URL publique du fichier dans ses données
- l'espace occupé par l'hébergement du site reste faible

Étapes de mise en service
1. Ouvrir Google Cloud Console avec le compte attt.amicale.tunisie@gmail.com
2. Créer ou sélectionner un projet Google Cloud
3. Activer l'API Google Drive
4. Aller dans Identifiants
5. Créer un identifiant OAuth 2.0 de type Application Web
6. Ajouter l'origine autorisée de votre site
7. Copier le Client ID
8. Ouvrir [js/firebase-config.js](js/firebase-config.js)
9. Renseigner GOOGLE_DRIVE_CONFIG.clientId
10. Laisser MEDIA_STORAGE_PROVIDER sur auto, ou mettre google-drive pour forcer Drive

Origines locales recommandées
- http://localhost:8080
- http://127.0.0.1:8080

Important
- ne jamais mettre le Code secret du client dans le site
- le frontend utilise uniquement le Client ID OAuth Web
- si le secret a été affiché ou partagé, il faut le régénérer ou le supprimer dans Google Cloud

Exemple

```js
const MEDIA_STORAGE_PROVIDER = 'google-drive';

const GOOGLE_DRIVE_CONFIG = {
  clientId: 'VOTRE_CLIENT_ID.apps.googleusercontent.com',
  loginHint: 'attt.amicale.tunisie@gmail.com',
  appName: 'Amicale ATTT',
  baseFolderName: 'ATTT-Site-Medias',
  docsFolderName: 'documents',
  mediaFolderName: 'media',
  scope: 'https://www.googleapis.com/auth/drive.file'
};
```

Comportement à l'utilisation
- au premier téléversement, Google demandera une autorisation OAuth
- il faut valider avec le compte Drive cible ou un compte ayant accès en écriture
- le site crée les dossiers automatiquement si besoin
- le fichier est rendu lisible publiquement pour affichage sur le site

Important
- avec le scope drive.file, le site gère correctement les fichiers et dossiers qu'il crée lui-même
- si vous voulez réutiliser des dossiers créés manuellement, il vaut mieux laisser le site créer sa propre arborescence ATTT-Site-Medias
- si Google Drive n'est pas configuré, le site retombe sur Firebase Storage quand il est disponible

Vérification rapide
1. Configurer le clientId
2. Recharger le site
3. Ouvrir une page avec téléversement, par exemple [publicites.html](publicites.html)
4. Envoyer une image
5. Vérifier qu'elle apparaît dans le dossier Drive créé automatiquement
6. Vérifier que le site stocke seulement l'URL du fichier dans ses données