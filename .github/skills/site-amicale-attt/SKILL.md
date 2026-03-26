---
name: site-amicale-attt
description: "Créer un site web professionnel et responsive pour l'Amicale de l'ATTT (Agence Technique des Transports Terrestres). Use when: créer ou modifier le site web de l'amicale, ajouter des pages, générer du HTML/CSS, créer une section téléchargement d'application desktop ou Android, structure Bootstrap, responsive design, site association du personnel."
argument-hint: "Décrivez la page ou la section à créer (ex: page Accueil, section Événements, page Téléchargements...)"
---

# Site Web — Amicale de l'ATTT

Skill pour générer et maintenir un site web **professionnel, responsive et complet** pour l'Amicale de l'Agence Technique des Transports Terrestres (association du personnel).

## Contexte

L'Amicale de l'ATTT est une association du personnel dont le but est de créer du lien entre les salariés en dehors du cadre purement productif. Le site regroupe les activités de loisirs, les événements, et met à disposition les applications téléchargeables (PC desktop + Android).

## Stack technique recommandée

- **HTML5 + CSS3** (fichiers statiques, hébergement simple)
- **Bootstrap 5** (grille responsive, composants UI professionnels)
- **Vanilla JavaScript** (interactivité légère, aucune dépendance lourde)
- Compatible : PC, tablette, smartphone (responsive-first)

---

## Structure du projet

```
site-amicale-attt/
├── index.html              ← Accueil
├── a-propos.html           ← L'association
├── activites.html          ← Activités & loisirs
├── evenements.html         ← Agenda / événements
├── galerie.html            ← Photos / galerie
├── telechargements.html    ← Apps PC & Android
├── contact.html            ← Formulaire de contact
├── css/
│   ├── style.css           ← Styles personnalisés
│   └── couleurs.css        ← Palette de couleurs ATTT
├── js/
│   └── main.js             ← Scripts communs
├── img/
│   ├── logo-attt.png
│   └── ...
└── assets/
    ├── app-desktop/        ← Fichier .exe ou .msi à télécharger
    └── app-android/        ← Fichier .apk à télécharger
```

---

## Procédure de création

### Étape 1 — Initialiser le projet

1. Créer la structure de dossiers ci-dessus
2. Télécharger Bootstrap 5 via CDN (pas de build nécessaire)
3. Créer `css/style.css` avec les variables CSS de couleur de l'association
4. Créer le template de base `_template.html` ([voir template](./references/template-base.md))

### Étape 2 — Palette de couleurs & identité visuelle

Utiliser ces couleurs par défaut (à ajuster selon la charte graphique ATTT) :
```css
:root {
  --couleur-principale: #003DA6;   /* Bleu institution */
  --couleur-secondaire: #E8A020;   /* Jaune/orange accent */
  --couleur-fond: #F5F5F5;
  --couleur-texte: #1A1A1A;
  --couleur-blanc: #FFFFFF;
}
```

### Étape 3 — Générer les pages

Pour chaque page demandée, suivre le modèle :
1. Copier `_template.html`
2. Remplacer `<!-- CONTENU -->` par le contenu spécifique
3. Activer le lien actif dans la navbar (`class="nav-link active"`)
4. Voir [références des pages](./references/pages.md) pour le contenu de chaque section

### Étape 4 — Page Téléchargements (priorité)

La page `telechargements.html` doit contenir :
- **Bloc Application PC** : bouton de téléchargement `.exe`/`.msi`, guide d'installation, configuration requise
- **Bloc Application Android** : bouton `.apk`, lien Google Play si disponible, QR code
- Icônes distinctes (Windows logo, Android logo)
- Avertissements de sécurité si l'app n'est pas signée

Voir [template téléchargements](./references/page-telechargements.md).

### Étape 5 — Responsive & accessibilité

- Tester sur 3 breakpoints Bootstrap : `sm` (576px), `md` (768px), `lg` (992px)
- Navigation mobile : navbar Bootstrap avec hamburger menu
- Images : attribut `alt` obligatoire
- Contraste couleur : ratio minimum 4.5:1 (WCAG AA)

### Étape 6 — Formulaire de contact

- Validation HTML5 (`required`, `type="email"`)
- Pas de backend requis : utiliser [Formspree](https://formspree.io) ou `mailto:`
- Champs : Nom, Prénom, Email, Sujet, Message

### Étape 7 — Vérifications finales

- [ ] Site s'affiche correctement sur mobile (outil DevTools Chrome)
- [ ] Tous les liens internes fonctionnent
- [ ] Images optimisées (< 500 Ko chacune)
- [ ] La page Téléchargements liste bien les deux applications
- [ ] Formulaire de contact envoie correctement
- [ ] Pas d'erreur console JavaScript

---

## Points de décision

| Situation | Action |
|-----------|--------|
| Hébergement gratuit souhaité | Utiliser GitHub Pages ou Netlify |
| Nom de domaine personnalisé | Configurer DNS sur l'hébergeur |
| Galerie photos dynamique | Utiliser Lightbox2 (librairie légère) |
| App non encore disponible | Afficher section "Bientôt disponible" |
| Formulaire avec serveur mail | Intégrer Formspree (gratuit jusqu'à 50 envois/mois) |

---

## Ressources

- [Template HTML de base](./references/template-base.md)
- [Contenu des pages](./references/pages.md)
- [Page Téléchargements](./references/page-telechargements.md)
- Bootstrap 5 docs : https://getbootstrap.com/docs/5.3/
