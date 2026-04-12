/* =========================================================
   Amicale ATTT — Scripts communs
   ========================================================= */

/* ── Enregistrement du Service Worker (PWA offline) ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* silencieux */ });
  });
}

/* ── Invitation d'installation PWA ── */
let _deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstall = e;
  _showPwaBanner();
});

function _showPwaBanner() {
  if (sessionStorage.getItem('pwa-dismissed')) return;
  if (document.getElementById('pwa-install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.innerHTML = `
    <div class="d-flex align-items-center gap-2 flex-wrap">
      <i class="bi bi-phone-fill fs-5"></i>
      <span class="fw-semibold">Installez l'application Amicale ATTT sur votre appareil&nbsp;!</span>
    </div>
    <div class="d-flex gap-2 flex-shrink-0">
      <button class="btn btn-warning btn-sm fw-semibold" id="pwa-install-btn">
        <i class="bi bi-download me-1"></i>Installer
      </button>
      <button class="btn btn-outline-light btn-sm" id="pwa-dismiss-btn">Plus tard</button>
    </div>`;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('show'));
  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    if (!_deferredInstall) return;
    _deferredInstall.prompt();
    const { outcome } = await _deferredInstall.userChoice;
    if (outcome === 'accepted') banner.remove();
    _deferredInstall = null;
  });
  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    banner.classList.remove('show');
    sessionStorage.setItem('pwa-dismissed', '1');
    setTimeout(() => banner.remove(), 400);
  });
}

document.addEventListener('DOMContentLoaded', function () {

  /* ── Bouton retour en haut ── */
  const btnTop = document.createElement('button');
  btnTop.id = 'back-to-top';
  btnTop.setAttribute('aria-label', 'Retour en haut de la page');
  btnTop.innerHTML = '<i class="bi bi-arrow-up"></i>';
  document.body.appendChild(btnTop);
  window.addEventListener('scroll', () =>
    btnTop.classList.toggle('show', window.scrollY > 320)
  );
  btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* --- Vérification mise à jour application installée --- */
  if (typeof VERSION_CHECK !== 'undefined') {
    VERSION_CHECK.checkAndNotify();
  }

  /* --- Afficher le numéro de version du site --- */
  _displaySiteVersion();

  /* --- Bannière de mise à jour --- */
  _checkUpdateBanner();

  /* --- Activer le lien de navigation courant --- */
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar .nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });

  /* --- Animation d'apparition au scroll --- */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.card, .stat-block').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    observer.observe(el);
  });

  // Classe "animated" déclenche l'apparition
  const style = document.createElement('style');
  style.textContent = '.animated { opacity: 1 !important; transform: translateY(0) !important; }';
  document.head.appendChild(style);

  /* --- Formulaire de contact : confirmation d'envoi --- */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      const btn = contactForm.querySelector('[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Envoi en cours…';
      }
    });
  }

});

/* ── Affichage du numéro de version sur toutes les pages ── */
function _getSiteVersion() {
  try {
    const updates = JSON.parse(localStorage.getItem('attt_updates') || '{}');
    if (updates.currentVersion) return updates.currentVersion;
  } catch {}
  try {
    const vj = JSON.parse(localStorage.getItem('attt_version_json') || '{}');
    if (vj.version) return vj.version;
  } catch {}
  return null;
}

function _getSiteVersionDate() {
  try {
    const updates = JSON.parse(localStorage.getItem('attt_updates') || '{}');
    if (updates.publishedDate) return updates.publishedDate.slice(0,10);
  } catch {}
  try {
    const vj = JSON.parse(localStorage.getItem('attt_version_json') || '{}');
    if (vj.datePublication) return vj.datePublication;
  } catch {}
  return '';
}

function _displaySiteVersion() {
  const version = _getSiteVersion();

  // Toujours vérifier version.json du serveur pour détecter une version plus récente
  fetch('assets/version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => {
    if (!data || !data.version) return;
    localStorage.setItem('attt_version_json', JSON.stringify(data));

    // Comparer et prendre la version la plus récente
    const serverV = data.version;
    const localV = version || '';
    const best = _compareVersions(serverV, localV) >= 0 ? serverV : localV;
    const bestDate = (best === serverV) ? (data.datePublication || '') : _getSiteVersionDate();

    // Synchroniser attt_updates si le serveur a une version plus récente
    if (_compareVersions(serverV, localV) > 0) {
      try {
        const upd = JSON.parse(localStorage.getItem('attt_updates') || '{}');
        upd.currentVersion = serverV;
        upd.publishedDate = data.datePublication || new Date().toISOString();
        localStorage.setItem('attt_updates', JSON.stringify(upd));
      } catch {}
    }

    _injectVersionBadge(best, bestDate);
  }).catch(() => {
    // Pas de réseau — utiliser localStorage
    if (version) _injectVersionBadge(version, _getSiteVersionDate());
  });
}

/* Compare deux versions semver, retourne >0 si a>b, <0 si a<b, 0 si égales */
function _compareVersions(a, b) {
  if (!a) return -1; if (!b) return 1;
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

function _injectVersionBadge(version, datePublication) {
  // Affichage unique dans le pied de page — version + date (pas de doublon navbar)
  if (document.getElementById('footer-version')) return;
  const footer = document.querySelector('footer');
  if (!footer) return;
  const el = document.createElement('div');
  el.id = 'footer-version';
  el.className = 'd-flex align-items-center justify-content-center gap-2 mt-2';
  let dateStr = '';
  if (datePublication) {
    try { dateStr = new Date(datePublication + 'T00:00:00').toLocaleDateString('fr-TN', { day:'numeric', month:'long', year:'numeric' }); } catch(e) { dateStr = datePublication; }
  }
  el.innerHTML = '<span class="badge bg-primary bg-opacity-75" style="font-size:.78rem;"><i class="bi bi-tag-fill me-1"></i>v' + version + '</span>'
    + (dateStr ? '<span class="small" style="color:rgba(255,255,255,.4);">Mis à jour le ' + dateStr + '</span>' : '');
  const bottom = footer.querySelector('.footer-bottom');
  if (bottom) bottom.appendChild(el);
}

/* ── Bannière de mise à jour pour tous les utilisateurs ── */
function _checkUpdateBanner() {
  try {
    const updates = JSON.parse(localStorage.getItem('attt_updates') || '{}');
    const version = updates.currentVersion;
    if (!version) return;

    const publishedAt = updates.publishedDate || '';
    const seenVersion = localStorage.getItem('attt_seen_site_version') || '';
    const seenTime = localStorage.getItem('attt_seen_publish_time') || '';

    // Ne pas afficher si l'utilisateur a déjà vu cette version+heure
    if (seenVersion === version && seenTime === publishedAt) return;

    // Ne pas afficher sur les pages admin/login/inscription
    const page = location.pathname.split('/').pop() || '';
    if (['login.html', 'inscription.html', 'master.html', 'versions.html'].includes(page)) return;

    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#003DA6,#0056cc);color:white;padding:12px 20px;display:flex;align-items:center;gap:12px;justify-content:space-between;box-shadow:0 -2px 12px rgba(0,0,0,.2);flex-wrap:wrap;';
    const notes = updates.history?.slice().reverse().find(h => h.version === version && h.action === 'publié')?.notes || '';
    banner.innerHTML = `
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <i class="bi bi-arrow-repeat fs-5"></i>
        <div>
          <strong>Mise à jour disponible — v${version}</strong>
          ${notes ? '<br><span style="opacity:.8;font-size:.82rem;">' + notes + '</span>' : ''}
        </div>
      </div>
      <div class="d-flex gap-2 flex-shrink-0">
        <button class="btn btn-warning btn-sm fw-semibold" id="update-refresh-btn">
          <i class="bi bi-arrow-clockwise me-1"></i>Actualiser
        </button>
        <button class="btn btn-outline-light btn-sm" id="update-dismiss-btn">Plus tard</button>
      </div>`;
    document.body.appendChild(banner);

    document.getElementById('update-refresh-btn').addEventListener('click', () => {
      localStorage.setItem('attt_seen_site_version', version);
      localStorage.setItem('attt_seen_publish_time', publishedAt);
      location.reload(true);
    });
    document.getElementById('update-dismiss-btn').addEventListener('click', () => {
      localStorage.setItem('attt_seen_site_version', version);
      localStorage.setItem('attt_seen_publish_time', publishedAt);
      banner.remove();
    });
  } catch {}
}
