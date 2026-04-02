/**
 * site-settings.js — Parametres generaux du site
 *
 * Stockage : attt_site_settings (localStorage + Firestore)
 */

'use strict';

const SITE_SETTINGS = (() => {
  const KEY = 'attt_site_settings';

  function _escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _multilineHtml(lines) {
    return lines.filter(Boolean).map(_escapeHtml).join('<br />');
  }

  const DEFAULTS = {
    organisation: 'Agence Technique des Transports Terrestres (ATTT)',
    addressLine1: 'Siege de l\'ATTT',
    addressLine2: 'Tunis, Tunisie',
    email: 'attt.amicale.tunisie@gmail.com',
    phone: '+216 00 000 000',
    hoursWeek: 'Lundi - Vendredi : 08h00 - 16h30',
    hoursWeekend: 'Samedi & Dimanche : Ferme',
    mapEmbedUrl: 'https://www.google.com/maps?q=Agence%20Technique%20des%20Transports%20Terrestres%20Tunis&output=embed',
    facebookUrl: '',
    instagramUrl: '',
    whatsappUrl: ''
  };

  function _save(settings) {
    localStorage.setItem(KEY, JSON.stringify(settings));
    if (typeof DB !== 'undefined') DB.push(KEY, settings);
  }

  function getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      return { ...DEFAULTS, ...(saved || {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function updateSettings(changes) {
    const next = { ...getSettings(), ...changes };
    _save(next);
    return next;
  }

  function resetSettings() {
    const next = { ...DEFAULTS };
    _save(next);
    return next;
  }

  function applyContactPage(root = document) {
    const settings = getSettings();
    const addressEl = root.querySelector('[data-site-setting="address"]');
    const emailLink = root.querySelector('[data-site-setting="email-link"]');
    const phoneLink = root.querySelector('[data-site-setting="phone-link"]');
    const hoursEl = root.querySelector('[data-site-setting="hours"]');
    const mapFrame = root.querySelector('[data-site-setting="map-frame"]');
    const form = root.querySelector('[data-site-setting="contact-form"]');
    const socials = {
      facebook: root.querySelector('[data-site-setting="facebook-link"]'),
      instagram: root.querySelector('[data-site-setting="instagram-link"]'),
      whatsapp: root.querySelector('[data-site-setting="whatsapp-link"]')
    };

    if (addressEl) {
      addressEl.innerHTML = _multilineHtml([settings.organisation, settings.addressLine1, settings.addressLine2]);
    }
    if (emailLink) {
      emailLink.textContent = settings.email;
      emailLink.href = 'mailto:' + settings.email;
    }
    if (phoneLink) {
      phoneLink.textContent = settings.phone;
      phoneLink.href = 'tel:' + settings.phone.replace(/\s+/g, '');
    }
    if (hoursEl) {
      hoursEl.innerHTML = _multilineHtml([settings.hoursWeek, settings.hoursWeekend]);
    }
    if (mapFrame) mapFrame.src = settings.mapEmbedUrl;
    [
      ['facebook', settings.facebookUrl],
      ['instagram', settings.instagramUrl],
      ['whatsapp', settings.whatsappUrl]
    ].forEach(([name, value]) => {
      const link = socials[name];
      if (!link) return;
      if (value) {
        link.href = value;
        link.classList.remove('d-none');
      } else {
        link.classList.add('d-none');
      }
    });

    return settings;
  }

  return { DEFAULTS, getSettings, updateSettings, resetSettings, applyContactPage };
})();
