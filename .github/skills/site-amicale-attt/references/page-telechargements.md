# Page Téléchargements — Amicale ATTT

Template complet pour la page `telechargements.html`.

```html
<!-- À insérer dans <!-- CONTENU --> du template de base -->

<h1 class="section-titre">Nos Applications</h1>
<p class="lead mb-5">Téléchargez l'application de l'Amicale ATTT sur votre ordinateur ou votre smartphone Android.</p>

<div class="row g-4">

  <!-- APPLICATION PC / WINDOWS -->
  <div class="col-md-6">
    <div class="card h-100 p-4 text-center">
      <div class="mb-3">
        <i class="bi bi-windows" style="font-size: 4rem; color: #0078D4;"></i>
      </div>
      <h2 class="h4 fw-bold">Application PC</h2>
      <p class="text-muted">Pour Windows 10 / 11</p>
      <hr />
      <ul class="list-unstyled text-start mb-4">
        <li><i class="bi bi-check-circle-fill text-success me-2"></i>Windows 10 ou 11 (64 bits)</li>
        <li><i class="bi bi-check-circle-fill text-success me-2"></i>4 Go de RAM minimum</li>
        <li><i class="bi bi-check-circle-fill text-success me-2"></i>200 Mo d'espace disque</li>
        <li><i class="bi bi-hdd-fill text-secondary me-2"></i>Version : 1.0.0</li>
      </ul>
      <a href="assets/app-desktop/amicale-attt-setup.exe" class="btn btn-attt btn-lg" download>
        <i class="bi bi-download me-2"></i>Télécharger pour PC (.exe)
      </a>
      <p class="text-muted small mt-3">
        <i class="bi bi-shield-check me-1"></i>
        Si Windows affiche un avertissement SmartScreen, cliquez sur "Informations complémentaires" puis "Exécuter quand même".
      </p>
    </div>
  </div>

  <!-- APPLICATION ANDROID -->
  <div class="col-md-6">
    <div class="card h-100 p-4 text-center">
      <div class="mb-3">
        <i class="bi bi-android2" style="font-size: 4rem; color: #3DDC84;"></i>
      </div>
      <h2 class="h4 fw-bold">Application Android</h2>
      <p class="text-muted">Pour smartphones et tablettes Android</p>
      <hr />
      <ul class="list-unstyled text-start mb-4">
        <li><i class="bi bi-check-circle-fill text-success me-2"></i>Android 8.0 (Oreo) ou supérieur</li>
        <li><i class="bi bi-check-circle-fill text-success me-2"></i>50 Mo d'espace libre</li>
        <li><i class="bi bi-wifi text-secondary me-2"></i>Connexion internet requise</li>
        <li><i class="bi bi-hdd-fill text-secondary me-2"></i>Version : 1.0.0</li>
      </ul>
      <a href="assets/app-android/amicale-attt.apk" class="btn btn-success btn-lg" download>
        <i class="bi bi-download me-2"></i>Télécharger pour Android (.apk)
      </a>
      <p class="text-muted small mt-3">
        <i class="bi bi-shield-exclamation me-1"></i>
        Pour installer un fichier .apk, activez "Sources inconnues" dans les paramètres de sécurité de votre appareil.
      </p>
    </div>
  </div>

</div>

<!-- GUIDE D'INSTALLATION -->
<div class="row mt-5">
  <div class="col-12">
    <h2 class="section-titre h4">Guide d'installation</h2>
  </div>
  <div class="col-md-6">
    <h5><i class="bi bi-windows me-2"></i>Sur PC Windows</h5>
    <ol>
      <li>Téléchargez le fichier <code>.exe</code> ci-dessus</li>
      <li>Double-cliquez sur le fichier téléchargé</li>
      <li>Suivez les étapes de l'assistant d'installation</li>
      <li>Lancez l'application depuis votre bureau</li>
    </ol>
  </div>
  <div class="col-md-6">
    <h5><i class="bi bi-android2 me-2"></i>Sur Android</h5>
    <ol>
      <li>Téléchargez le fichier <code>.apk</code> ci-dessus</li>
      <li>Ouvrez les <strong>Paramètres</strong> → <strong>Sécurité</strong></li>
      <li>Activez <strong>Sources inconnues</strong> ou <strong>Installer des apps inconnues</strong></li>
      <li>Ouvrez le fichier .apk depuis votre gestionnaire de fichiers</li>
      <li>Appuyez sur <strong>Installer</strong></li>
    </ol>
  </div>
</div>
```

## Version "Bientôt disponible"

Si l'application n'est pas encore prête, remplacer le bouton de téléchargement par :

```html
<button class="btn btn-secondary btn-lg" disabled>
  <i class="bi bi-clock me-2"></i>Bientôt disponible
</button>
<p class="text-muted small mt-2">Inscrivez-vous pour être notifié lors de la sortie.</p>
```
