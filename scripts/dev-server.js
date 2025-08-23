/*
  Simple static file server for development
  - Serves files from project root
  - Defaults to index.html for '/'
  - Prevents path traversal
  - Listens on PORT env var or 3000
*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(process.cwd());

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

function safeResolve(requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^\\|^\//, '');
  const abs = path.join(ROOT, normalized);
  if (!abs.startsWith(ROOT)) return null; // path traversal guard
  return abs;
}

function send(res, status, headers, bodyStream) {
  res.writeHead(status, headers);
  if (bodyStream) bodyStream.pipe(res); else res.end();
}

function serveFile(res, absPath) {
  fs.stat(absPath, (err, stats) => {
    if (err) return notFound(res);
    if (stats.isDirectory()) {
      const indexPath = path.join(absPath, 'index.html');
      return fs.access(indexPath, fs.constants.F_OK, (e) => {
        if (e) return notFound(res);
        serveFile(res, indexPath);
      });
    }
    const ext = path.extname(absPath).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(absPath);
    stream.on('error', () => notFound(res));
    send(res, 200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
    }, stream);
  });
}

function notFound(res) {
  send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, null);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let reqPath = parsed.pathname || '/';

  // Default to index.html at root
  if (reqPath === '/') reqPath = '/index.html';

  const absPath = safeResolve(reqPath);
  if (!absPath) return send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, null);

  serveFile(res, absPath);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

