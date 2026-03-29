'use strict';

const MEDIA_UPLOAD = (() => {
  let driveScriptPromise = null;
  let driveTokenClient = null;
  let driveAccessToken = '';

  // ── Durée du token : Google impose max 60 min ; on prend 58 min pour la marge ──
  const TOKEN_TTL    = 58 * 60 * 1000; // 58 minutes
  const RENEW_BEFORE = 10 * 60 * 1000; // renouveler 10 min avant expiration
  let   _renewalTimer = null;

  // ── Cache de l'onglet courant ─────────────────────────────────────────────
  function _sessGet() {
    try {
      const raw = sessionStorage.getItem('attt_dtok');
      if (!raw) return null;
      const { t, x } = JSON.parse(raw);
      return Date.now() < x ? { tok: t, exp: x } : (sessionStorage.removeItem('attt_dtok'), null);
    } catch { return null; }
  }
  function _sessSet(tok) {
    const exp = Date.now() + TOKEN_TTL;
    try { sessionStorage.setItem('attt_dtok', JSON.stringify({ t: tok, x: exp })); } catch {}
    return exp;
  }

  // ── Token partagé via Firestore : 1 responsable connecté → tout le monde en profite ──
  async function _fsGet() {
    try {
      if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return null;
      const snap = await firebase.firestore().collection('_sys').doc('drive').get();
      if (!snap.exists) return null;
      const d = snap.data();
      return (d && d.tok && Date.now() < (d.exp || 0)) ? { tok: d.tok, exp: d.exp } : null;
    } catch { return null; }
  }
  async function _fsSet(tok) {
    const exp = Date.now() + TOKEN_TTL;
    try {
      if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return;
      await firebase.firestore().collection('_sys').doc('drive').set({ tok, exp });
    } catch {}
    return exp;
  }

  // ── Planifie le renouvellement automatique silencieux (uniquement pour les responsables) ──
  function _scheduleRenewal(expiry) {
    if (!_canTriggerOAuth()) return;
    if (_renewalTimer) clearTimeout(_renewalTimer);
    const delay = Math.max(0, expiry - Date.now() - RENEW_BEFORE);
    _renewalTimer = setTimeout(async () => {
      try { await _silentRenew(); } catch { /* échec silencieux, retentera au prochain accès */ }
    }, delay);
  }

  // ── Renouvellement sans popup (Google ne montre rien si consentement déjà accordé) ──
  async function _silentRenew() {
    const config = getDriveConfig();
    if (!config.clientId) return null;
    await ensureDriveScript();
    return new Promise(resolve => {
      const cb = async response => {
        if (response?.error || !response?.access_token) { resolve(null); return; }
        const tok = response.access_token;
        driveAccessToken = tok;
        const exp = _sessSet(tok);
        await _fsSet(tok);
        _scheduleRenewal(exp);
        resolve(tok);
      };
      if (!driveTokenClient) {
        driveTokenClient = google.accounts.oauth2.initTokenClient({
          client_id: config.clientId, scope: config.scope, callback: cb
        });
      } else {
        driveTokenClient.callback = cb;
      }
      // prompt:'' = silencieux si le consentement a déjà été accordé
      driveTokenClient.requestAccessToken({ prompt: '', login_hint: config.loginHint || undefined });
    });
  }

  // ── Vérifie si l'utilisateur peut déclencher l'autorisation du stockage ──
  // Note : AUTH est un const global — non accessible via window.AUTH (navigateurs modernes)
  function _canTriggerOAuth() {
    try {
      if (typeof AUTH === 'undefined') return false;
      const user = typeof AUTH.getCurrentUser === 'function' ? AUTH.getCurrentUser() : null;
      if (!user) return false;
      // Maître (0), Direction (1), Délégué (2) peuvent réautoriser
      const level = typeof AUTH.getHighestPrivilegeLevel === 'function'
        ? AUTH.getHighestPrivilegeLevel(user)
        : Number.MAX_SAFE_INTEGER;
      return level <= 2;
    } catch { return false; }
  }

  function isFirebaseAvailable() {
    return typeof firebase !== 'undefined' && typeof firebase.storage === 'function' && !!FIREBASE_ENABLED;
  }

  function getDriveConfig() {
    const config = (typeof GOOGLE_DRIVE_CONFIG === 'object' && GOOGLE_DRIVE_CONFIG) ? GOOGLE_DRIVE_CONFIG : {};
    return {
      clientId: String(config.clientId || '').trim(),
      loginHint: String(config.loginHint || '').trim(),
      appName: String(config.appName || 'Amicale ATTT').trim(),
      baseFolderName: String(config.baseFolderName || 'ATTT-Site-Medias').trim(),
      docsFolderName: String(config.docsFolderName || 'documents').trim(),
      mediaFolderName: String(config.mediaFolderName || 'media').trim(),
      scope: String(config.scope || 'https://www.googleapis.com/auth/drive.file').trim()
    };
  }

  function isDriveConfigured() {
    return !!getDriveConfig().clientId;
  }

  function getPreferredProvider() {
    return String(typeof MEDIA_STORAGE_PROVIDER !== 'undefined' ? MEDIA_STORAGE_PROVIDER : 'auto').trim().toLowerCase();
  }

  function getProvider() {
    const preferred = getPreferredProvider();
    if (preferred === 'google-drive') return isDriveConfigured() ? 'google-drive' : null;
    if (preferred === 'firebase') return isFirebaseAvailable() ? 'firebase' : null;
    if (isDriveConfigured()) return 'google-drive';
    if (isFirebaseAvailable()) return 'firebase';
    return null;
  }

  function isAvailable() {
    return !!getProvider();
  }

  function getProviderLabel() {
    const provider = getProvider();
    if (provider === 'google-drive') return 'Google Drive';
    if (provider === 'firebase') return 'Firebase Storage';
    return 'Aucun stockage distant';
  }

  function ensureApp() {
    if (!isFirebaseAvailable()) throw new Error('Firebase Storage n\'est pas disponible.');
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    return firebase.app();
  }

  function sanitizeName(name) {
    const value = String(name || 'media')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return value || 'media';
  }

  function escapeDriveQuery(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function splitFolder(folder) {
    const clean = String(folder || 'uploads').trim().replace(/\\+/g, '/').replace(/^\/+|\/+$/g, '');
    return clean ? clean.split('/').filter(Boolean) : ['uploads'];
  }

  function isDocumentFile(file) {
    const mime = String(file?.type || '').toLowerCase();
    const ext = (String(file?.name || '').split('.').pop() || '').toLowerCase();
    if (mime.startsWith('image/') || mime.startsWith('video/')) return false;
    return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'rar', '7z'].includes(ext) || !!mime;
  }

  function buildDriveSegments(folder, file) {
    const config = getDriveConfig();
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return [
      config.baseFolderName,
      isDocumentFile(file) ? config.docsFolderName : config.mediaFolderName,
      ...splitFolder(folder),
      year,
      month
    ].filter(Boolean);
  }

  function drivePublicUrl(fileId, mimeType) {
    if (String(mimeType || '').startsWith('video/')) return `https://drive.google.com/file/d/${fileId}/preview`;
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  function ensureDriveScript() {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (driveScriptPromise) return driveScriptPromise;
    driveScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Chargement Google Identity Services impossible.'));
      document.head.appendChild(script);
    });
    return driveScriptPromise;
  }

  async function getDriveAccessToken() {
    // 1. Cache onglet courant (zéro appel réseau)
    const sess = _sessGet();
    if (sess) {
      driveAccessToken = sess.tok;
      _scheduleRenewal(sess.exp); // planifie le renouvellement automatique
      return sess.tok;
    }

    // 2. Token partagé par un responsable (transparence totale pour les membres)
    const shared = await _fsGet();
    if (shared) {
      driveAccessToken = shared.tok;
      _sessSet(shared.tok);
      _scheduleRenewal(shared.exp);
      return shared.tok;
    }

    // 3. Aucun token valide — seul un responsable peut en obtenir un nouveau
    if (!_canTriggerOAuth()) {
      throw new Error('Connexion au stockage expirée. Demandez à un responsable de se connecter.');
    }

    // 4. Première connexion ou token expiré : pop-up Google (uniquement pour les responsables)
    const config = getDriveConfig();
    if (!config.clientId) throw new Error('Stockage non configuré.');
    await ensureDriveScript();
    return new Promise((resolve, reject) => {
      const callback = async response => {
        if (response?.error) { reject(new Error('Autorisation refusée : ' + response.error)); return; }
        const tok = response.access_token || '';
        if (!tok) { reject(new Error('Autorisation au stockage impossible.')); return; }
        driveAccessToken = tok;
        const exp = _sessSet(tok);
        await _fsSet(tok); // partagé avec tous les utilisateurs du site
        _scheduleRenewal(exp); // renouvellement automatique dans 48 min
        resolve(tok);
      };
      if (!driveTokenClient) {
        driveTokenClient = google.accounts.oauth2.initTokenClient({
          client_id: config.clientId,
          scope: config.scope,
          callback
        });
      } else {
        driveTokenClient.callback = callback;
      }
      driveTokenClient.requestAccessToken({ prompt: '', login_hint: config.loginHint || undefined });
    });
  }

  async function driveFetch(url, options = {}) {
    const token = await getDriveAccessToken();
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Erreur Google Drive (${response.status})`);
    }
    if (response.status === 204) return null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return response.json();
    return response.text();
  }

  async function findOrCreateDriveFolder(name, parentId) {
    const query = [
      `mimeType='application/vnd.google-apps.folder'`,
      `trashed=false`,
      `name='${escapeDriveQuery(name)}'`
    ];
    if (parentId) query.push(`'${escapeDriveQuery(parentId)}' in parents`);
    const search = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query.join(' and '))}&fields=files(id,name)&pageSize=1`);
    if (search.files && search.files.length) return search.files[0].id;
    const created = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined
      })
    });
    return created.id;
  }

  async function ensureDriveFolderPath(segments) {
    let parentId = 'root';
    for (const segment of segments) {
      parentId = await findOrCreateDriveFolder(segment, parentId);
    }
    return parentId;
  }

  async function setDriveFilePublic(fileId) {
    try {
      await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      });
    } catch (error) {
      throw new Error(`Impossible de publier le fichier sur Google Drive: ${error.message}`);
    }
  }

  async function uploadFileToGoogleDrive(file, folder) {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const baseName = sanitizeName(file.name.replace(/\.[^.]+$/, ''));
    const fileName = `${Date.now()}-${baseName}.${ext}`;
    const segments = buildDriveSegments(folder, file);
    const parentId = await ensureDriveFolderPath(segments);
    const boundary = 'attt-' + Math.random().toString(16).slice(2);
    const metadata = {
      name: fileName,
      parents: [parentId],
      description: `${getDriveConfig().appName} - ${segments.join(' / ')}`
    };
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`
    ]);
    const uploaded = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    });
    await setDriveFilePublic(uploaded.id);
    return {
      path: segments.concat(fileName).join('/'),
      url: drivePublicUrl(uploaded.id, uploaded.mimeType || file.type),
      webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
      contentType: uploaded.mimeType || file.type || '',
      name: uploaded.name || file.name,
      size: Number(uploaded.size || file.size || 0),
      fileId: uploaded.id,
      provider: 'google-drive'
    };
  }

  async function uploadFile(file, folder = 'uploads') {
    if (!file) throw new Error('Aucun fichier fourni.');
    const provider = getProvider();
    if (provider === 'google-drive') return uploadFileToGoogleDrive(file, folder);
    if (provider === 'firebase') {
      ensureApp();
      const storage = firebase.storage();
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = `${folder}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${sanitizeName(file.name.replace(/\.[^.]+$/, ''))}.${ext}`;
      const ref = storage.ref().child(path);
      const task = await ref.put(file, { contentType: file.type || undefined });
      const url = await task.ref.getDownloadURL();
      return { path, url, contentType: file.type || '', name: file.name, size: file.size, provider: 'firebase' };
    }
    throw new Error('Aucun stockage distant n\'est configuré.');
  }

  // Pré-chauffe silencieusement la connexion au stockage au chargement de page.
  // NE déclenche JAMAIS de popup — charge seulement depuis le cache ou Firestore.
  async function prewarmDriveToken() {
    if (getProvider() !== 'google-drive') return;
    try {
      // Cache onglet courant (zéro appel réseau)
      const sess = _sessGet();
      if (sess) {
        driveAccessToken = sess.tok;
        _scheduleRenewal(sess.exp);
        return;
      }
      // Token partagé depuis Firestore (déposé par un responsable)
      const shared = await _fsGet();
      if (shared) {
        driveAccessToken = shared.tok;
        _sessSet(shared.tok);
        _scheduleRenewal(shared.exp);
      }
      // Pas de token disponible : le popup s'affichera au premier clic sur Téléverser
    } catch { /* silencieux */ }
  }

  return { isAvailable, isFirebaseAvailable, isDriveConfigured, getProvider, getProviderLabel, uploadFile, prewarmDriveToken };
})();