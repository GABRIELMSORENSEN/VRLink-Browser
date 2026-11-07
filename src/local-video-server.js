'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Serves an explicitly selected local MP4. Does not proxy websites, credentials or DRM.
function createLocalVideoServer() {
  const videos = new Map();
  const server = http.createServer(async (req, res) => {
    const id = /^\/video\/([a-f0-9]{48})\.mp4$/.exec(new URL(req.url, 'http://localhost').pathname)?.[1];
    const item = id && videos.get(id);
    if (!item) { res.writeHead(404); return res.end(); }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
    try {
      const stat = await fs.promises.stat(item.file);
      if (!stat.isFile()) throw new Error('Not a file');
      const size = stat.size;
      const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
      let start = 0, end = size - 1, status = 200;
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!match || (!match[1] && !match[2])) {
          res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }); return res.end();
        }
        if (!match[1]) {
          const suffix = Number(match[2]);
          if (!Number.isSafeInteger(suffix) || suffix <= 0) {
            res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }); return res.end();
          }
          start = Math.max(0, size - suffix);
        } else {
          start = Number(match[1]);
          if (match[2]) end = Number(match[2]);
        }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
          res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }); return res.end();
        }
        end = Math.min(end, size - 1);
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      }
      headers['Content-Length'] = Math.max(0, end - start + 1);
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || size === 0) return res.end();
      const stream = fs.createReadStream(item.file, { start, end });
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(404);
      res.end();
    }
  });
  let port;
  return {
    async listen() {
      if (port) return port;
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
      port = server.address().port;
      return port;
    },
    add(file) {
      if (!port) throw new Error('Server not listening');
      if (path.extname(file).toLowerCase() !== '.mp4') throw new Error('Only MP4 supported');
      const id = crypto.randomBytes(24).toString('hex');
      videos.set(id, { file: path.resolve(file) });
      return `http://127.0.0.1:${port}/video/${id}.mp4`;
    },
    revokeAll() { videos.clear(); },
    async close() {
      videos.clear();
      if (server.listening) await new Promise(resolve => server.close(resolve));
      port = undefined;
    }
  };
}
module.exports = { createLocalVideoServer };
