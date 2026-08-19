const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const helmet = require('helmet');
const compression = require('compression');

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || '/data';
const PUBLIC_DIR = path.join(__dirname, 'public');
const STORES = new Set(['items', 'locations', 'settings']);

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
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '20mb' }));

function validStore(req, res, next) {
  if (!STORES.has(req.params.store)) return res.status(404).json({ error: 'unknown_store' });
  next();
}

app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, app: 'Kiler Takip', mode: 'server', version: '1.2.0' });
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
