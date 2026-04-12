/**
 * deploy-server.js — Serveur local de déploiement Amicale ATTT
 *
 * Lance : node deploy-server.js
 * Port  : 8081 (localhost uniquement)
 *
 * Endpoints :
 *   GET  /api/status          → état du serveur + git info
 *   POST /api/version         → met à jour assets/version.json
 *   POST /api/deploy          → git add + commit + push (SSE)
 *   GET  /api/files           → liste des fichiers du projet
 *   GET  /api/file?path=xxx   → contenu binaire d'un fichier
 */

'use strict';

const http   = require('http');
const { spawn, execSync } = require('child_process');
const fs     = require('fs');
const path   = require('path');

const PORT     = 8081;
const SITE_DIR = __dirname;
const VERSION_FILE = path.join(SITE_DIR, 'assets', 'version.json');

const EXCLUDE = new Set([
  '.venv', 'node_modules', '.git', '.github', 'amicale attt',
  'firebase.json', '.firebaserc', '.gitignore',
  'deploy-server.js', 'demarrer.bat',
  'firebase-debug.log', 'google-drive-setup.md',
  'client_secret_778227653817-sl5v7fatk6jq3fdovrvn823vkbjda444.apps.googleusercontent.com.json'
]);

function getAllFiles(dir, base = '', result = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return result; }
  for (const e of entries) {
    if (EXCLUDE.has(e.name) || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    const rel  = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) {
      getAllFiles(full, rel, result);
    } else {
      try { result.push({ path: rel, size: fs.statSync(full).size }); }
      catch {}
    }
  }
  return result;
}

function getGitInfo() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: SITE_DIR, encoding: 'utf8', timeout: 3000 }).trim();
    const commit = execSync('git log --oneline -1', { cwd: SITE_DIR, encoding: 'utf8', timeout: 3000 }).trim();
    return { branch, commit };
  } catch { return { branch: 'master', commit: '—' }; }
}

function updateVersionFile(nextVersion, changelog) {
  if (!/^\d+\.\d+\.\d+$/.test(String(nextVersion || '').trim())) {
    throw new Error('Version invalide (attendu: X.Y.Z)');
  }

  const raw = fs.readFileSync(VERSION_FILE, 'utf8');
  const json = JSON.parse(raw);
  const now = new Date().toISOString().slice(0, 10);

  json.version = nextVersion;
  json.datePublication = now;
  if (typeof changelog === 'string' && changelog.trim()) {
    json.changelog = changelog.trim();
  }
  if (!json.platforms) json.platforms = {};
  if (!json.platforms.windows) json.platforms.windows = {};
  if (!json.platforms.android) json.platforms.android = {};
  if (!json.platforms.pwa) json.platforms.pwa = {};
  json.platforms.windows.version = nextVersion;
  json.platforms.android.version = nextVersion;
  json.platforms.pwa.version = nextVersion;

  fs.writeFileSync(VERSION_FILE, JSON.stringify(json, null, 2) + '\n', 'utf8');

  // Mettre à jour aussi la version par défaut dans sw.js
  const swPath = path.join(SITE_DIR, 'sw.js');
  try {
    let sw = fs.readFileSync(swPath, 'utf8');
    sw = sw.replace(/let CACHE_NAME = 'amicale-attt-v[^']*'/, "let CACHE_NAME = 'amicale-attt-v" + nextVersion + "'");
    fs.writeFileSync(swPath, sw, 'utf8');
  } catch {}

  return json;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  let url;
  try { url = new URL(req.url, `http://127.0.0.1:${PORT}`); }
  catch { res.writeHead(400); res.end('Bad request'); return; }

  /* ── STATUS ── */
  if (url.pathname === '/api/status') {
    const git = getGitInfo();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, time: new Date().toISOString(), git }));
    return;
  }

  /* ── UPDATE VERSION FILE ── */
  if (url.pathname === '/api/version' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const version = String(payload.version || '').trim();
        const changelog = String(payload.changelog || '').trim();
        const updated = updateVersionFile(version, changelog);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, version: updated.version, datePublication: updated.datePublication }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message || 'Erreur mise à jour version.json' }));
      }
    });
    return;
  }

  /* ── DEPLOY via git push (SSE) ── */
  if (url.pathname === '/api/deploy' && req.method === 'POST') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const send = (type, data) => {
      try { res.write(`data: ${JSON.stringify({ type, data })}\n\n`); } catch {}
    };

    // Lire le commentaire de version depuis le body POST
    let body = '';
    req.on('data', d => body += d.toString());
    req.on('end', () => {
      let comment = 'Mise a jour depuis guide.html';
      try { const p = JSON.parse(body); if (p.comment) comment = p.comment; } catch {}

      const now = new Date().toLocaleString('fr-TN');
      send('start', `[${now}] Déploiement démarré → GitHub Pages`);
      send('log',   `Branche : master`);
      send('log',   `URL     : https://dtaattt2026-boop.github.io/amicale-attt-2026/`);
      send('log',   '─'.repeat(55));

      // Étape 1 : git add
      send('log', '1/3 – git add -A ...');
      const add = spawn('git', ['add', '-A'], { cwd: SITE_DIR });
      add.on('close', addCode => {
        if (addCode !== 0) { send('error', 'Échec de git add'); res.end(); return; }
        send('log', '    ✔ Tous les fichiers ajoutés.');

        // Étape 2 : git commit
        send('log', '2/3 – git commit ...');
        const commit = spawn('git', ['commit', '-m', comment, '--allow-empty'], { cwd: SITE_DIR });
        let commitOut = '';
        commit.stdout.on('data', d => commitOut += d.toString());
        commit.stderr.on('data', d => commitOut += d.toString());
        commit.on('close', commitCode => {
          const line = commitOut.split('\n').find(l => l.trim()) || 'Commit effectué';
          send('log', '    ' + line.trim());

          // Étape 3 : git push
          send('log', '3/3 – git push origin master ...');
          const push = spawn('git', ['push', 'origin', 'master'], { cwd: SITE_DIR });
          push.stdout.on('data', d => d.toString().split('\n').forEach(l => { if(l.trim()) send('log', '    ' + l.trim()); }));
          push.stderr.on('data', d => d.toString().split('\n').forEach(l => { if(l.trim()) send('log', '    ' + l.trim()); }));
          push.on('close', pushCode => {
            send('log', '─'.repeat(55));
            if (pushCode === 0) {
              send('done', '✔ Publié ! Site accessible dans ~1 minute sur :');
              send('done', '   https://dtaattt2026-boop.github.io/amicale-attt-2026/');
            } else {
              send('error', `✖ Échec du push (code ${pushCode})`);
              send('error', 'Vérifiez votre connexion internet et les credentials git.');
            }
            res.end();
          });
          push.on('error', err => { send('error', 'git push introuvable : ' + err.message); res.end(); });
        });
        commit.on('error', err => { send('error', 'git commit introuvable : ' + err.message); res.end(); });
      });
      add.on('error', err => { send('error', 'git add introuvable : ' + err.message); res.end(); });
    });
    return;
  }

  /* ── LISTE DES FICHIERS ── */
  if (url.pathname === '/api/files' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getAllFiles(SITE_DIR)));
    return;
  }

  /* ── CONTENU D'UN FICHIER ── */
  if (url.pathname === '/api/file' && req.method === 'GET') {
    const p = url.searchParams.get('path') || '';
    if (!p || p.includes('..') || path.isAbsolute(p)) { res.writeHead(400); res.end('Chemin invalide'); return; }
    const full = path.resolve(SITE_DIR, p);
    if (!full.startsWith(SITE_DIR + path.sep) && full !== SITE_DIR) { res.writeHead(403); res.end('Accès interdit'); return; }
    try {
      const data = fs.readFileSync(full);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('Fichier introuvable'); }
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  Amicale ATTT — Serveur de déploiement           ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  Adresse  : http://127.0.0.1:${PORT}                 ║`);
  console.log('║  Méthode  : git push → GitHub Pages              ║');
  console.log('║  URL publique :                                   ║');
  console.log('║  dtaattt2026-boop.github.io/amicale-attt-2026/   ║');
  console.log('╚═══════════════════════════════════════════════════╝');
});