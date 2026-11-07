const { app, BrowserWindow, BrowserView, ipcMain, session, clipboard, Menu } = require('electron');
const path = require('path');
const { shouldBlock, directMediaUrl } = require('./rules');
const { createRelay } = require('./relay');

const HOME = 'https://www.google.com/webhp?hl=pt-BR';
const START_URL = process.argv.slice(1).find(isSafeUrl) || HOME;
let mainWindow;
let pageView;
let blocked = 0;
let latestMedia = [];
const mediaCandidates = new Map();
let panelOpen = false;
const PANEL_WIDTH = 410;
let mediaRelay;

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) app.quit();
app.on('second-instance', (_event, commandLine) => {
  if (!mainWindow) return;
  const requestedUrl = commandLine.find(isSafeUrl);
  if (requestedUrl && pageView) navigate(requestedUrl);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

function isSafeUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

function createPageView() {
  pageView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload-page.js')
    }
  });
  mainWindow.setBrowserView(pageView);
  resizeView();
  pageView.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeUrl(url)) navigate(url);
    return { action: 'deny' };
  });
  pageView.webContents.on('did-navigate', publishState);
  pageView.webContents.on('did-navigate-in-page', publishState);
  pageView.webContents.on('did-frame-finish-load', () => { scanFrames(); });
  pageView.webContents.on('page-title-updated', publishState);
  pageView.webContents.on('did-fail-load', (_event, code, description, url) => {
    if (code !== -3) mainWindow.webContents.send('browser:error', { description, url });
  });
  setInterval(() => { if (pageView && panelOpen) scanFrames(); }, 2500).unref();
}

function resizeView() {
  if (!mainWindow || !pageView) return;
  const [width, height] = mainWindow.getContentSize();
  pageView.setBounds({ x: 0, y: 62, width: Math.max(320, width - (panelOpen ? PANEL_WIDTH : 0)), height: Math.max(0, height - 62) });
  pageView.setAutoResize({ height: true });
}

function normalize(value) {
  const typed = (value || '').trim();
  if (!typed) return HOME;
  if (/^https?:\/\//i.test(typed)) return typed;
  if (/^[\w.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(typed)) return `https://${typed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(typed)}`;
}

function navigate(value) {
  const target = normalize(value);
  latestMedia = [];
  mediaCandidates.clear();
  publishState();
  pageView.webContents.loadURL(target);
}

function publishState() {
  if (!mainWindow || !pageView) return;
  const wc = pageView.webContents;
  mainWindow.webContents.send('browser:state', {
    url: wc.getURL(),
    title: wc.getTitle(),
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
    blocked,
    media: latestMedia.map(({ url, contentType }) => ({ url, contentType }))
  });
}

function receiveMedia(payload) {
  const wc = pageView?.webContents;
  const pageUrl = wc?.getURL() || '';
  for (const item of payload || []) {
    const candidate = typeof item === 'string' ? { url: item } : item;
    if (!candidate.url || /\.(ts|m4s|aac|key)(?:$|[?#])/i.test(candidate.url)) continue;
    if (!directMediaUrl(candidate.url, candidate.contentType || '')) continue;
    mediaCandidates.set(candidate.url, {
      url: candidate.url,
      contentType: candidate.contentType || '',
      requestHeaders: candidate.requestHeaders || mediaCandidates.get(candidate.url)?.requestHeaders || {},
      pageUrl: candidate.pageUrl || pageUrl,
      updatedAt: Date.now()
    });
  }
  const incoming = [...mediaCandidates.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);
  const unique = incoming;
  if (JSON.stringify(unique) === JSON.stringify(latestMedia)) return;
  latestMedia = unique;
  publishState();
}

async function scanFrames() {
  if (!pageView || pageView.webContents.isDestroyed()) return latestMedia;
  const root = pageView.webContents.mainFrame;
  const frames = [];
  const visit = (frame) => { frames.push(frame); for (const child of frame.frames || []) visit(child); };
  visit(root);
  const results = await Promise.allSettled(frames.map((frame) => frame.executeJavaScript(`(() => {
    const found = new Set();
    for (const video of document.querySelectorAll('video')) {
      if (video.currentSrc) found.add(video.currentSrc);
      if (video.src) found.add(video.src);
      for (const source of video.querySelectorAll('source[src]')) found.add(source.src);
    }
    for (const node of document.querySelectorAll('source[src], audio[src], iframe[src], video[src], link[as="video"][href]')) found.add(node.src || node.href);
    for (const item of performance.getEntriesByType('resource')) found.add(item.name);
    return [...found].map(url => ({ url, pageUrl: location.href }));
  })()`, true)));
  for (const result of results) if (result.status === 'fulfilled') receiveMedia(result.value);
  return latestMedia;
}

function installProtection() {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeRequest((details, callback) => {
    if (shouldBlock(details.url)) { blocked += 1; publishState(); return callback({ cancel: true }); }
    if (details.resourceType === 'media') receiveMedia([{ url: details.url, contentType: 'video/detected' }]);
    callback({});
  });
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.resourceType === 'media' || directMediaUrl(details.url)) {
      receiveMedia([{ url: details.url, contentType: 'video/detected', requestHeaders: details.requestHeaders }]);
    }
    callback({ requestHeaders: details.requestHeaders });
  });
  ses.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {};
    const contentType = (headers['content-type'] || headers['Content-Type'] || [''])[0];
    if (directMediaUrl(details.url, contentType)) receiveMedia([{ url: details.url, contentType }]);
    callback({});
  });
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['clipboard-sanitized-write', 'fullscreen'].includes(permission));
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 860,
    minHeight: 560,
    title: 'VRLink Browser',
    backgroundColor: '#09090d',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: path.join(__dirname, 'preload-ui.js') }
  });
  mainWindow.loadFile(path.join(__dirname, 'ui.html'));
  mainWindow.on('resize', resizeView);
  mainWindow.on('closed', () => { mainWindow = null; pageView = null; });
  mainWindow.webContents.once('did-finish-load', () => { createPageView(); navigate(START_URL); });
}

if (hasSingleInstance) app.whenReady().then(() => {
  installProtection();
  mediaRelay = createRelay({
    getCookies: async (url) => session.defaultSession.cookies.get({ url }),
    onError: (error) => console.error('[media-relay]', error.message)
  });
  mediaRelay.listen().catch((error) => console.error('[media-relay]', error.message));
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('browser:navigate', (_event, value) => navigate(value));
ipcMain.handle('browser:back', () => { if (pageView.webContents.canGoBack()) pageView.webContents.goBack(); });
ipcMain.handle('browser:forward', () => { if (pageView.webContents.canGoForward()) pageView.webContents.goForward(); });
ipcMain.handle('browser:reload', () => pageView.webContents.reload());
ipcMain.handle('browser:home', () => navigate(HOME));
ipcMain.handle('browser:copy-media', (_event, value) => {
  if (!mediaCandidates.has(value)) return { ok: false, error: 'Fonte de vídeo não encontrada nesta página.' };
  clipboard.writeText(value);
  return { ok: true };
});
ipcMain.handle('browser:prepare-media', async (_event, value) => {
  const candidate = mediaCandidates.get(value);
  if (!candidate) return { ok: false, error: 'Fonte de vídeo expirou. Verifique a página de novo.' };
  try {
    const port = await mediaRelay.listen();
    const url = mediaRelay.create(candidate);
    clipboard.writeText(url);
    return { ok: true, url, port };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});
ipcMain.handle('browser:scan', () => {
  return scanFrames();
});
ipcMain.handle('browser:panel', (_event, visible) => {
  panelOpen = Boolean(visible);
  resizeView();
});
ipcMain.on('media-found', (event, payload) => {
  if (pageView && event.sender === pageView.webContents) receiveMedia(payload);
});
