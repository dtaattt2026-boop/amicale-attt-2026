# Contenu des pages — Amicale ATTT

## Page Accueil (`index.html`)

Sections à inclure :
1. **Hero banner** : photo de groupe ou logo, slogan de l'amicale, bouton CTA "Découvrir l'association"
2. **Chiffres clés** : nombre de membres, années d'existence, activités proposées
3. **Activités en vedette** : 3 cards avec icônes (sport, culture, sorties)
4. **Prochain événement** : carte mise en avant avec date et lieu
5. **Télécharger nos apps** : bandeau avec bouttons PC + Android
6. **Call-to-action** : "Rejoignez-nous" ou "Contactez-nous"

## Page À propos (`a-propos.html`)

- Présentation de l'Amicale ATTT
- Mission : créer du lien entre les salariés de l'ATTT en dehors du travail
- Différence avec le CSE (Comité Social et Économique)
- Bureau et membres du conseil
- Statuts de l'association (lien vers PDF si disponible)

## Page Activités (`activites.html`)

Exemples de catégories :
- Sports (football, handball, randonnée, tennis...)
- Culture & loisirs (sorties cinéma, théâtre, voyages)
- Famille (fête des enfants, arbre de Noël)
- Solidarité

Format : grille de cards Bootstrap, une card par activité avec icône, titre, description courte.

## Page Événements (`evenements.html`)

- Tableau ou liste d'événements à venir
- Pour chaque événement : titre, date, lieu, description, bouton "En savoir plus"
- Eventos passés archivés en bas de page

## Page Galerie (`galerie.html`)

- Grille d'images responsive (Bootstrap `col-6 col-md-4 col-lg-3`)
- Lightbox au clic (utiliser [Lightbox2](https://lokeshdhakar.com/projects/lightbox2/))
- Organiser par album / événement

## Page Contact (`contact.html`)

```html
<form action="https://formspree.io/f/VOTRE_ID" method="POST">
  <div class="mb-3">
    <label for="nom" class="form-label">Nom *</label>
    <input type="text" class="form-control" id="nom" name="nom" required />
  </div>
  <div class="mb-3">
    <label for="email" class="form-label">Email *</label>
    <input type="email" class="form-control" id="email" name="email" required />
  </div>
  <div class="mb-3">
    <label for="sujet" class="form-label">Sujet</label>
    <input type="text" class="form-control" id="sujet" name="sujet" />
  </div>
  <div class="mb-3">
    <label for="message" class="form-label">Message *</label>
    <textarea class="form-control" id="message" name="message" rows="5" required></textarea>
  </div>
  <button type="submit" class="btn btn-attt">Envoyer</button>
</form>
```

Ajouter également : adresse physique de l'ATTT, email de contact, liens réseaux sociaux.
