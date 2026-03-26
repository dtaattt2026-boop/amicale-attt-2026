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
