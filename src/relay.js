const http = require('http');
const { Readable } = require('stream');

const SAFE_HEADERS = ['user-agent', 'accept', 'referer', 'origin', 'cookie', 'authorization'];

function headerValue(headers, key) {
  const found = Object.keys(headers || {}).find((name) => name.toLowerCase() === key);
  const value = found ? headers[found] : '';
  return Array.isArray(value) ? value.join('; ') : String(value || '');
}

function createRelay({ getCookies, onError = () => {} }) {
  const entries = new Map();
  let listenPromise;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const match = url.pathname.match(/^\/play\/([a-f0-9]{24})(?:\.(?:mp4|webm|mov|m4v|ogv|m3u8|mpd))?$/);
    if (!match) return respond(res, 404, 'Link de reprodução inválido.');
    const entry = entries.get(match[1]);
    if (!entry) return respond(res, 410, 'Link expirado. Gere outro pelo navegador.');
    const targetText = url.searchParams.get('u') || entry.source;
    let target;
    try { target = new URL(targetText); } catch { return respond(res, 400, 'URL de mídia inválida.'); }
    if (!['http:', 'https:'].includes(target.protocol) || !entry.allowedHosts.has(target.hostname)) {
      return respond(res, 403, 'A origem não pertence ao vídeo selecionado.');
    }

    try {
      const headers = {};
      const captured = entry.headersByUrl.get(target.href) || entry.baseHeaders;
      for (const key of SAFE_HEADERS) {
        const value = headerValue(captured, key);
        if (value) headers[key] = value;
      }
      const cookies = await getCookies(target.href);
      if (cookies && cookies.length) headers.cookie = cookies.map((item) => `${item.name}=${item.value}`).join('; ');
      headers.referer = entry.lastReferer || headers.referer || entry.pageUrl;
      if (req.headers.range) headers.range = req.headers.range;
      const controller = new AbortController();
      const connectTimer = setTimeout(() => controller.abort(), 45000);
      let upstream;
      try {
        upstream = await fetch(target.href, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers, redirect: 'follow', signal: controller.signal });
      } finally {
        clearTimeout(connectTimer);
      }
      if (upstream.url) entry.allowedHosts.add(new URL(upstream.url).hostname);
      const contentType = upstream.headers.get('content-type') || '';
      const isPlaylist = /mpegurl|m3u8/i.test(contentType) || /\.m3u8(?:$|[?#])/i.test(target.href);

      res.statusCode = upstream.status;
      res.setHeader('access-control-allow-origin', '*');
      res.setHeader('access-control-allow-methods', 'GET, HEAD, OPTIONS');
      res.setHeader('access-control-allow-headers', 'Range');
      res.setHeader('accept-ranges', upstream.headers.get('accept-ranges') || 'bytes');
      for (const name of ['content-length', 'content-range', 'last-modified', 'etag']) {
        const value = upstream.headers.get(name);
        if (value) res.setHeader(name, value);
      }
      res.setHeader('content-type', isPlaylist ? 'application/vnd.apple.mpegurl' : contentType || entry.contentType || 'application/octet-stream');
      if (req.method === 'HEAD' || !upstream.body) return res.end();

      if (isPlaylist && upstream.ok) {
        const playlist = await upstream.text();
        const proxyUrl = (raw) => {
          let absolute;
          try { absolute = new URL(raw, upstream.url || target.href); } catch { return raw; }
          if (!['http:', 'https:'].includes(absolute.protocol)) return raw;
          entry.allowedHosts.add(absolute.hostname);
          entry.headersByUrl.set(absolute.href, { ...captured, referer: upstream.url || target.href });
          return `/play/${match[1]}?u=${encodeURIComponent(absolute.href)}`;
        };
        const rewritten = playlist.split(/\r?\n/).map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_all, uri) => `URI="${proxyUrl(uri)}"`);
          return proxyUrl(trimmed);
        }).join('\n');
        res.removeHeader('content-length');
        res.end(rewritten);
        return;
      }
      Readable.fromWeb(upstream.body).pipe(res);
    } catch (error) {
      onError(error);
      if (!res.headersSent) respond(res, 502, `A fonte não respondeu: ${error.message}`);
      else res.destroy(error);
    }
  });
  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));

  return {
    listen: () => listenPromise || (listenPromise = new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve(server.address().port);
      });
    })),
    create: ({ source, contentType, requestHeaders, pageUrl }) => {
      const crypto = require('crypto');
      const id = crypto.randomBytes(12).toString('hex');
      const origin = new URL(source);
      entries.set(id, {
        source,
        contentType: contentType || '',
        pageUrl: pageUrl || origin.href,
        lastReferer: headerValue(requestHeaders, 'referer') || pageUrl || origin.href,
        baseHeaders: requestHeaders || {},
        headersByUrl: new Map([[source, requestHeaders || {}]]),
        allowedHosts: new Set([origin.hostname]),
        created: Date.now()
      });
      for (const [key, entry] of entries) if (Date.now() - entry.created > 3 * 60 * 60 * 1000) entries.delete(key);
      const fromPath = new URL(source).pathname.match(/\.(mp4|webm|mov|m4v|ogv|m3u8|mpd)$/i)?.[1]?.toLowerCase();
      const type = String(contentType || '').toLowerCase();
      const extension = fromPath || (type.includes('mpegurl') ? 'm3u8' : type.includes('dash+xml') ? 'mpd' : type.includes('webm') ? 'webm' : type.includes('quicktime') ? 'mov' : type.startsWith('video/') ? 'mp4' : '');
      return `http://127.0.0.1:${server.address().port}/play/${id}${extension ? `.${extension}` : ''}`;
    },
    close: () => server.close()
  };
}

function respond(res, status, text) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.end(text);
}

module.exports = { createRelay };
