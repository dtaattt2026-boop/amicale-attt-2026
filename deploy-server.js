/**
 * deploy-server.js — Serveur local de déploiement Amicale ATTT
 *
 * Lance : node deploy-server.js
 * Port  : 8081 (localhost uniquement — aucun accès externe)
 *
 * Endpoints :
 *   GET  /api/status          → état du serveur
 *   POST /api/deploy          → déploie sur Firebase Hosting (SSE)
 *   GET  /api/files           → liste des fichiers du projet
 *   GET  /api/file?path=xxx   → contenu binaire d'un fichier
 */

'use strict';

const http   = require('http');
const { spawn } = require('child_process');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

const PORT     = 8081;
const SITE_DIR = __dirname;

/* ── Fichiers/dossiers exclus du ZIP et de la liste ─────────── */
const EXCLUDE = new Set([
  '.venv', 'node_modules', '.git', '.github', 'amicale attt',
  'firebase.json', '.firebaserc', '.gitignore',
  'deploy-server.js', 'demarrer.bat', 'demarrer.ps1',
  'check.js', 'check-links.js', 'google-drive-setup.md',
  'client_secret_778227653817-sl5v7fatk6jq3fdovrvn823vkbjda444.apps.googleusercontent.com.json'
]);

/* ── Localisation de Firebase CLI ───────────────────────────── */
function findFirebase() {
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'firebase.cmd'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'firebase'),
    '/usr/local/bin/firebase',
    '/usr/bin/firebase',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'firebase'; // espère qu'il est dans PATH
}
const FIREBASE_CMD = findFirebase();

/* ── Lister tous les fichiers (récursif) ────────────────────── */
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

/* ── Serveur HTTP ────────────────────────────────────────────── */
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      firebase: FIREBASE_CMD,
      project: 'amicale-attt',
      time: new Date().toISOString()
    }));
    return;
  }

  /* ── DEPLOY (Server-Sent Events) ── */
  if (url.pathname === '/api/deploy' && req.method === 'POST') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    const send = (type, data) => {
      try { res.write(`data: ${JSON.stringify({ type, data })}\n\n`); }
      catch {}
    };

    const now = new Date().toLocaleTimeString('fr-TN');
    send('start', `[${now}] Déploiement démarré…`);
    send('log',   `Firebase CLI : ${FIREBASE_CMD}`);
    send('log',   `Projet       : amicale-attt`);
    send('log',   '─'.repeat(55));

    const proc = spawn(FIREBASE_CMD, ['deploy', '--only', 'hosting'], {
      cwd:   SITE_DIR,
      env:   { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      shell: true
    });

    proc.stdout.on('data', d => {
      d.toString().split('\n').forEach(l => { if (l.trim()) send('log', l); });
    });
    proc.stderr.on('data', d => {
      d.toString().split('\n').forEach(l => { if (l.trim()) send('log', l); });
    });
    proc.on('close', code => {
      send('log', '─'.repeat(55));
      if (code === 0) {
        send('done', '✔ Déploiement réussi → https://amicale-attt.web.app');
      } else {
        send('error', `✖ Échec du déploiement (code ${code})`);
        send('error', 'Vérifiez que "firebase login" a bien été effectué.');
      }
      res.end();
    });
    proc.on('error', err => {
      send('error', `Impossible de lancer Firebase CLI : ${err.message}`);
      send('error', `Chemin testé : ${FIREBASE_CMD}`);
      res.end();
    });
    return;
  }

  /* ── LISTE DES FICHIERS ── */
  if (url.pathname === '/api/files' && req.method === 'GET') {
    try {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getAllFiles(SITE_DIR)));
    } catch (e) {
      res.writeHead(500); res.end(e.message);
    }
    return;
  }

  /* ── CONTENU D'UN FICHIER ── */
  if (url.pathname === '/api/file' && req.method === 'GET') {
    const p = url.searchParams.get('path') || '';
    if (!p || p.includes('..') || path.isAbsolute(p)) {
      res.writeHead(400); res.end('Chemin invalide'); return;
    }
    const full = path.resolve(SITE_DIR, p);
    if (!full.startsWith(SITE_DIR + path.sep) && full !== SITE_DIR) {
      res.writeHead(403); res.end('Accès interdit'); return;
    }
    try {
      const data = fs.readFileSync(full);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('Fichier introuvable');
    }
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  Amicale ATTT — Serveur de déploiement       ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log(`║  Adresse  : http://127.0.0.1:${PORT}             ║`);
  console.log(`║  Firebase : ${FIREBASE_CMD.slice(-30).padEnd(30)} ║`);
  console.log('║  Projet   : amicale-attt                      ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('En attente de commandes...');
});
