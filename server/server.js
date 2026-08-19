const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const helmet = require('helmet');
const compression = require('compression');

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || '/data';
const PUBLIC_DIR = path.join(__dirname, 'public');
const STORES = new Set(['items', 'locations', 'settings']);
const SESSION_SECRET = process.env.KILER_SESSION_SECRET || '';
const SESSION_DAYS = Math.max(1, Number(process.env.KILER_SESSION_DAYS || 180));
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

const USERS = {
  emre: { displayName: 'Emre', hash: process.env.KILER_PASSWORD_HASH || '' },
  betul: { displayName: 'Betül', hash: process.env.KILER_BETUL_PASSWORD_HASH || '' }
};

if (!USERS.emre.hash || !SESSION_SECRET) {
  console.error('KILER_PASSWORD_HASH and KILER_SESSION_SECRET are required.');
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'kiler-takip.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    store TEXT NOT NULL,
    key TEXT NOT NULL,
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (store, key)
  );
  CREATE INDEX IF NOT EXISTS idx_records_store ON records(store);
`);

const getAll = db.prepare('SELECT json FROM records WHERE store = ? ORDER BY updated_at DESC');
const getOne = db.prepare('SELECT json FROM records WHERE store = ? AND key = ?');
const putOne = db.prepare(`
  INSERT INTO records(store, key, json, updated_at)
  VALUES(?, ?, ?, ?)
  ON CONFLICT(store, key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at
`);
const deleteOne = db.prepare('DELETE FROM records WHERE store = ? AND key = ?');
const clearStore = db.prepare('DELETE FROM records WHERE store = ?');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '20mb' }));

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.user || !payload?.exp || Date.now() > payload.exp) return null;
    if (!USERS[payload.user]?.hash) return null;
    return payload;
  } catch {
    return null;
  }
}

function setSessionCookie(res, user) {
  const token = signToken({ user, iat: Date.now(), exp: Date.now() + SESSION_MS });
  res.cookie('kiler_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_MS,
    path: '/'
  });
}

function currentSession(req) {
  return verifyToken(parseCookies(req).kiler_session);
}

function requireAuth(req, res, next) {
  const session = currentSession(req);
  if (!session) return res.status(401).json({ error: 'auth_required' });
  req.sessionUser = session.user;
  next();
}

function validStore(req, res, next) {
  if (!STORES.has(req.params.store)) return res.status(404).json({ error: 'unknown_store' });
  next();
}

function publicUser(user) {
  const account = USERS[user];
  return account ? { user, displayName: account.displayName } : null;
}

app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, app: 'Kiler Takip', mode: 'server', version: '1.4.0' });
});

app.get('/api/auth/me', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = currentSession(req);
  if (!session) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, ...publicUser(session.user) });
});

app.post('/api/auth/login', async (req, res) => {
  const user = String(req.body?.user || '').trim().toLocaleLowerCase('tr-TR');
  const password = String(req.body?.password || '');
  const account = USERS[user];
  if (!account?.hash || !(await bcrypt.compare(password, account.hash))) {
    await new Promise(r => setTimeout(r, 450));
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  setSessionCookie(res, user);
  res.json({ ok: true, ...publicUser(user), sessionDays: SESSION_DAYS });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('kiler_session', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  res.status(204).end();
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/auth/')) return next();
  return requireAuth(req, res, next);
});

app.get('/api/:store', validStore, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const rows = getAll.all(req.params.store).map(r => JSON.parse(r.json));
  res.json(rows);
});

app.get('/api/:store/:key', validStore, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const row = getOne.get(req.params.store, req.params.key);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(JSON.parse(row.json));
});

app.put('/api/:store/:key', validStore, (req, res) => {
  const value = req.body;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return res.status(400).json({ error: 'invalid_json' });
  }
  if (req.params.store === 'items') {
    value.owner = USERS[req.sessionUser]?.displayName || req.sessionUser;
  }
  putOne.run(req.params.store, req.params.key, JSON.stringify(value), Date.now());
  res.json(value);
});

app.delete('/api/:store/:key', validStore, (req, res) => {
  deleteOne.run(req.params.store, req.params.key);
  res.status(204).end();
});

app.delete('/api/:store', validStore, (req, res) => {
  clearStore.run(req.params.store);
  res.status(204).end();
});

app.use(express.static(PUBLIC_DIR, {
  maxAge: 0,
  etag: true,
  setHeaders(res, filePath) {
    if (/\.(html|js|css|webmanifest)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

app.use((_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kiler Takip server listening on :${PORT}`);
});
