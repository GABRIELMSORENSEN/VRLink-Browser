const { app, BrowserWindow, BrowserView, ipcMain, session, shell, clipboard, Menu } = require('electron');
const path = require('path');
const { shouldBlock, directMediaUrl } = require('./rules');

const HOME = 'https://www.google.com/webhp?hl=pt-BR';
let mainWindow;
let pageView;
let blocked = 0;
let latestMedia = [];

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) app.quit();
app.on('second-instance', () => {
  if (!mainWindow) return;
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
  pageView.webContents.on('page-title-updated', publishState);
  pageView.webContents.on('did-fail-load', (_event, code, description, url) => {
    if (code !== -3) mainWindow.webContents.send('browser:error', { description, url });
  });
}

function resizeView() {
  if (!mainWindow || !pageView) return;
  const [width, height] = mainWindow.getContentSize();
  pageView.setBounds({ x: 0, y: 62, width, height: Math.max(0, height - 62) });
  pageView.setAutoResize({ width: true, height: true });
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
    media: latestMedia
  });
}

function receiveMedia(payload) {
  const unique = [...new Set((payload || []).filter(directMediaUrl))].slice(0, 12);
  if (JSON.stringify(unique) === JSON.stringify(latestMedia)) return;
  latestMedia = unique;
  publishState();
}

function installProtection() {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeRequest((details, callback) => {
    if (shouldBlock(details.url)) { blocked += 1; publishState(); return callback({ cancel: true }); }
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
  mainWindow.webContents.once('did-finish-load', () => { createPageView(); navigate(HOME); });
}

if (hasSingleInstance) app.whenReady().then(() => {
  installProtection();
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
ipcMain.handle('browser:copy-media', (_event, value) => { if (directMediaUrl(value)) clipboard.writeText(value); });
ipcMain.handle('browser:open-vrchat', (_event, value) => { if (directMediaUrl(value)) shell.openExternal(`vrchat://launch?ref=vrlink&url=${encodeURIComponent(value)}`); });
ipcMain.on('media-found', (event, payload) => {
  if (pageView && event.sender === pageView.webContents) receiveMedia(payload);
});
