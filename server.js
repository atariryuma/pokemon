/*
  Dev server with JSON CRUD for cards-master.json
  - Serves static files from project root
  - API under /api/cards supports GET/POST/PUT/DELETE
  - Persists to data/cards-master.json (creates if missing)
  - No external deps
*/

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const url = require('url');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(process.cwd());
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'cards-master.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
};

// Ensure data directory and file exist
async function ensureDataFile() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    await fsp.access(DATA_FILE, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(DATA_FILE, JSON.stringify({ cards: [] }, null, 2), 'utf8');
  }
}

async function readCards() {
  await ensureDataFile();
  const raw = await fsp.readFile(DATA_FILE, 'utf8');
  try {
    const json = JSON.parse(raw || '{}');
    // Accept either array or {cards: []}
    if (Array.isArray(json)) return { cards: json };
    if (Array.isArray(json.cards)) return { cards: json.cards };
    return { cards: [] };
  } catch (e) {
    console.error('Failed to parse cards-master.json:', e.message);
    throw createHttpError(500, 'Invalid cards-master.json');
  }
}

async function writeCards(cards) {
  // Atomic-ish write: write to temp then rename
  const tmp = DATA_FILE + '.tmp';
  const payload = JSON.stringify({ cards }, null, 2);
  await fsp.writeFile(tmp, payload, 'utf8');
  await fsp.rename(tmp, DATA_FILE);
}

// Simple in-process write queue to prevent concurrent writes
let writeQueue = Promise.resolve();
function enqueueWrite(fn) {
  writeQueue = writeQueue.then(fn, fn);
  return writeQueue;
}

function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  if (body !== undefined) res.end(body); else res.end();
}

function json(res, status, data) {
  send(res, status, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(data));
}

function notFound(res) { json(res, 404, { error: 'Not Found' }); }

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) { // 5MB limit
        reject(createHttpError(413, 'Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve(null);
      try { resolve(JSON.parse(data)); }
      catch { reject(createHttpError(400, 'Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function handleApi(req, res, pathname) {
  setCors(res);
  if (req.method === 'OPTIONS') return send(res, 204, {}, undefined);

  // Routes:
  // GET    /api/cards
  // POST   /api/cards
  // PUT    /api/cards         (replace all)
  // GET    /api/cards/:id
  // PUT    /api/cards/:id
  // DELETE /api/cards/:id

  const parts = pathname.split('/').filter(Boolean); // ['api','cards',':id?']
  const id = parts[2];

  try {
    if (parts[1] !== 'cards') return notFound(res);
    if (req.method === 'GET' && !id) {
      const { cards } = await readCards();
      return json(res, 200, { cards });
    }
    if (req.method === 'GET' && id) {
      const { cards } = await readCards();
      const card = cards.find(c => String(c.id) === String(id));
      if (!card) return notFound(res);
      return json(res, 200, card);
    }
    if (req.method === 'POST' && !id) {
      const body = await parseBody(req);
      if (!body || typeof body !== 'object') throw createHttpError(400, 'Card object required');
      const { cards } = await readCards();
      let newId = body.id != null ? String(body.id) : undefined;
      if (!newId) {
        const maxId = cards.reduce((m, c) => {
          const n = Number(c.id);
          return Number.isFinite(n) ? Math.max(m, n) : m;
        }, 0);
        newId = String(maxId + 1);
      }
      if (cards.some(c => String(c.id) === newId)) throw createHttpError(409, 'Duplicate id');
      const now = new Date().toISOString();
      const card = { ...body, id: newId, updated_at: now, created_at: now };
      cards.push(card);
      await enqueueWrite(() => writeCards(cards));
      return json(res, 201, card);
    }
    if (req.method === 'PUT' && !id) {
      const body = await parseBody(req);
      const list = Array.isArray(body) ? body : (body && Array.isArray(body.cards) ? body.cards : null);
      if (!list) throw createHttpError(400, 'Expected an array or {cards: []}');
      // Normalize ids to strings, add timestamps if missing
      const now = new Date().toISOString();
      const normalized = list.map((c, i) => {
        const idv = c.id != null ? String(c.id) : String(i + 1);
        return { created_at: now, updated_at: now, ...c, id: idv };
      });
      await enqueueWrite(() => writeCards(normalized));
      return json(res, 200, { ok: true, count: normalized.length });
    }
    if (req.method === 'PUT' && id) {
      const body = await parseBody(req);
      if (!body || typeof body !== 'object') throw createHttpError(400, 'Card object required');
      const { cards } = await readCards();
      const idx = cards.findIndex(c => String(c.id) === String(id));
      if (idx === -1) return notFound(res);
      const now = new Date().toISOString();
      const updated = { ...cards[idx], ...body, id: String(id), updated_at: now };
      cards[idx] = updated;
      await enqueueWrite(() => writeCards(cards));
      return json(res, 200, updated);
    }
    if (req.method === 'DELETE' && id) {
      const { cards } = await readCards();
      const idx = cards.findIndex(c => String(c.id) === String(id));
      if (idx === -1) return notFound(res);
      const removed = cards.splice(idx, 1)[0];
      await enqueueWrite(() => writeCards(cards));
      return json(res, 200, { ok: true, removed });
    }
    return notFound(res);
  } catch (err) {
    const status = err.status || 500;
    return json(res, status, { error: err.message || 'Server error' });
  }
}

function safeResolve(requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^\\|^\//, '');
  const abs = path.join(ROOT, normalized);
  if (!abs.startsWith(ROOT)) return null; // path traversal guard
  return abs;
}

function serveStatic(req, res, pathname) {
  let reqPath = pathname;
  if (reqPath === '/') reqPath = '/index.html';
  const absPath = safeResolve(reqPath);
  if (!absPath) return send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Bad path');
  fs.stat(absPath, (err, stats) => {
    if (err) return notFound(res);
    if (stats.isDirectory()) {
      const indexPath = path.join(absPath, 'index.html');
      return fs.access(indexPath, fs.constants.F_OK, (e) => {
        if (e) return notFound(res);
        serveStatic({ ...req, url: indexPath }, res, indexPath);
      });
    }
    const ext = path.extname(absPath).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    fs.createReadStream(absPath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);
  if (!pathname) return notFound(res);

  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname);
  }

  // Compatibility: allow direct writes to data/cards-master.json
  if (pathname === '/data/cards-master.json' && req.method !== 'GET') {
    try {
      setCors(res);
      if (req.method === 'OPTIONS') return send(res, 204, {}, undefined);
      if (req.method === 'DELETE') {
        await enqueueWrite(() => writeCards([]));
        return json(res, 200, { ok: true });
      }
      const body = await parseBody(req);
      const list = Array.isArray(body) ? body : (body && Array.isArray(body.cards) ? body.cards : null);
      if (!list) return json(res, 400, { error: 'Expected array or {cards: []}' });
      await enqueueWrite(() => writeCards(list));
      return json(res, 200, { ok: true, count: list.length });
    } catch (err) {
      const status = err.status || 500;
      return json(res, status, { error: err.message || 'Server error' });
    }
  }

  // Serve static assets and data files
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('API: GET/POST /api/cards, GET/PUT/DELETE /api/cards/:id');
});
