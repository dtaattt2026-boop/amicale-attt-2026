# Template HTML de base — Amicale ATTT

Copier-coller ce template pour toute nouvelle page du site.

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Amicale ATTT — [TITRE DE LA PAGE]</title>
  <meta name="description" content="Site officiel de l'Amicale de l'ATTT" />
  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
  <!-- Bootstrap Icons -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet" />
  <!-- Styles personnalisés -->
  <link href="css/style.css" rel="stylesheet" />
</head>
<body>

  <!-- NAVBAR -->
  <nav class="navbar navbar-expand-lg navbar-dark" style="background-color: var(--couleur-principale);">
    <div class="container">
      <a class="navbar-brand fw-bold" href="index.html">
        <img src="img/logo-attt.png" alt="Logo ATTT" height="40" class="me-2" />
        Amicale ATTT
      </a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navMenu">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item"><a class="nav-link" href="index.html">Accueil</a></li>
          <li class="nav-item"><a class="nav-link" href="a-propos.html">L'association</a></li>
          <li class="nav-item"><a class="nav-link" href="activites.html">Activités</a></li>
          <li class="nav-item"><a class="nav-link" href="evenements.html">Événements</a></li>
          <li class="nav-item"><a class="nav-link" href="galerie.html">Galerie</a></li>
          <li class="nav-item"><a class="nav-link" href="telechargements.html">Téléchargements</a></li>
          <li class="nav-item"><a class="nav-link" href="contact.html">Contact</a></li>
        </ul>
      </div>
    </div>
  </nav>

  <!-- CONTENU PRINCIPAL -->
  <main class="py-5">
    <div class="container">

      <!-- REMPLACER CE BLOC PAR LE CONTENU DE LA PAGE -->
      <!-- CONTENU -->

    </div>
  </main>

  <!-- FOOTER -->
  <footer class="py-4 text-white text-center" style="background-color: var(--couleur-principale);">
    <div class="container">
      <p class="mb-1">&copy; 2026 Amicale de l'ATTT — Agence Technique des Transports Terrestres</p>
      <p class="mb-0 small opacity-75">Association du personnel — Tous droits réservés</p>
    </div>
  </footer>

  <!-- Bootstrap 5 JS -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

## CSS de base (`css/style.css`)

```css
:root {
  --couleur-principale: #003DA6;
  --couleur-secondaire: #E8A020;
  --couleur-fond: #F5F5F5;
  --couleur-texte: #1A1A1A;
  --couleur-blanc: #FFFFFF;
}

body {
  background-color: var(--couleur-fond);
  color: var(--couleur-texte);
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.btn-attt {
  background-color: var(--couleur-secondaire);
  color: var(--couleur-texte);
  font-weight: 600;
  border: none;
}

.btn-attt:hover {
  background-color: #c8880f;
  color: var(--couleur-blanc);
}

.section-titre {
  border-left: 4px solid var(--couleur-secondaire);
  padding-left: 12px;
  margin-bottom: 2rem;
}

.card {
  border: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: transform 0.2s;
}

.card:hover {
  transform: translateY(-3px);
}
```
