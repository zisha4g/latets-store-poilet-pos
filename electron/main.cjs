const { app, BrowserWindow, ipcMain, shell, protocol } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Must be called before app.whenReady() — registers app:// as a standard secure
// scheme so localStorage, sessionStorage, IndexedDB and fetch all work correctly.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: true,
    },
  },
]);

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:3000';
const DIST_DIR = path.join(__dirname, '..', 'dist');

// ---------- Kiosk credential storage (AES-256-GCM, key derived from machine identity) ----------

function getConfigPath() {
  return path.join(app.getPath('appData'), 'StorePilot', 'kiosk-config.json');
}

function getInstallerConfigDir() {
  return path.join(app.getPath('appData'), 'StorePilot');
}

function getPendingInstallerEmailPath() {
  return path.join(getInstallerConfigDir(), 'installer-email.txt');
}

function getPendingInstallerPasswordPath() {
  return path.join(getInstallerConfigDir(), 'installer-password.txt');
}

function getDerivedKey() {
  const seed = `${os.hostname()}::${os.userInfo().username}::storepilot-kiosk`;
  return crypto.createHash('sha256').update(seed).digest();
}

function encryptValue(plainText) {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted: encrypted.toString('hex'), iv: iv.toString('hex'), tag: tag.toString('hex') };
}

function decryptValue(encryptedHex, ivHex, tagHex) {
  const key = getDerivedKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encryptedHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

function readKioskConfig() {
  try {
    const configFile = getConfigPath();
    if (!fs.existsSync(configFile)) return null;
    const raw = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    const password = decryptValue(raw.encrypted, raw.iv, raw.tag);
    return { email: raw.email, password };
  } catch {
    return null;
  }
}

function saveKioskConfig(email, password) {
  const configDir = path.dirname(getConfigPath());
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  const { encrypted, iv, tag } = encryptValue(password);
  fs.writeFileSync(getConfigPath(), JSON.stringify({ email, encrypted, iv, tag }), 'utf8');
}

function clearKioskConfig() {
  const configFile = getConfigPath();
  if (fs.existsSync(configFile)) {
    fs.unlinkSync(configFile);
  }
}

function readPendingInstallerCredentials() {
  try {
    const emailPath = getPendingInstallerEmailPath();
    const passwordPath = getPendingInstallerPasswordPath();
    if (!fs.existsSync(emailPath) || !fs.existsSync(passwordPath)) return null;

    const email = fs.readFileSync(emailPath, 'utf8').trim();
    const password = fs.readFileSync(passwordPath, 'utf8').replace(/\r?\n$/, '');

    if (!email || !password) return null;
    return { email, password };
  } catch {
    return null;
  }
}

function clearPendingInstallerCredentials() {
  const emailPath = getPendingInstallerEmailPath();
  const passwordPath = getPendingInstallerPasswordPath();

  if (fs.existsSync(emailPath)) fs.unlinkSync(emailPath);
  if (fs.existsSync(passwordPath)) fs.unlinkSync(passwordPath);
}


const MIME_TYPES = {
  '.css':   'text/css; charset=utf-8',
  '.html':  'text/html; charset=utf-8',
  '.ico':   'image/x-icon',
  '.js':    'application/javascript; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.map':   'application/json; charset=utf-8',
  '.png':   'image/png',
  '.svg':   'image/svg+xml',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
};

let mainWindow;

// ---------- Custom protocol for serving dist/ in packaged mode ----------

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);

    // Strip leading slash
    if (pathname.startsWith('/')) pathname = pathname.substring(1);
    if (!pathname) pathname = 'index.html';

    const fullPath = path.normalize(path.join(DIST_DIR, pathname));

    // Security: ensure path stays inside dist
    if (!fullPath.startsWith(DIST_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }

    // If file exists, serve it; otherwise serve index.html (SPA fallback)
    const servePath = (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile())
      ? fullPath
      : path.join(DIST_DIR, 'index.html');

    const data = fs.readFileSync(servePath);
    const mimeType = MIME_TYPES[path.extname(servePath)] || 'application/octet-stream';

    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': mimeType },
    });
  });
}

// ---------- Resolve the URL to load ----------

function resolveAppUrl() {
  if (!app.isPackaged) {
    return `${DEV_SERVER_URL}/#/selfcheckout`;
  }
  return 'app://storepilot/#/selfcheckout';
}

// ---------- Create the main window ----------

async function createWindow() {
  const startUrl = resolveAppUrl();
  const startOrigin = app.isPackaged ? 'app://storepilot' : new URL(startUrl).origin;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'StorePilot',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    fullscreen: app.isPackaged,
    kiosk: app.isPackaged,
    show: false,
  });

  // Attach listener BEFORE loadURL so it can never be missed
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  await mainWindow.loadURL(startUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== startOrigin) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (new URL(targetUrl).origin !== startOrigin) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  if (app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const isReload = input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r');
      const isDevTools = input.key === 'F12' || ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i');
      if (isReload || isDevTools) event.preventDefault();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('app:get-runtime-info', () => ({
  isPackaged: app.isPackaged,
  platform: process.platform,
  kioskEntryPath: resolveAppUrl(),
}));

ipcMain.handle('app:get-kiosk-credentials', () => {
  return readKioskConfig();
});

ipcMain.handle('app:get-installer-credentials', () => {
  return readPendingInstallerCredentials();
});

ipcMain.handle('app:save-kiosk-credentials', (_event, { email, password }) => {
  try {
    saveKioskConfig(email, password);
    // Register app to auto-start on Windows login
    app.setLoginItemSettings({ openAtLogin: true, name: 'StorePilot' });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('app:clear-kiosk-credentials', () => {
  try {
    clearKioskConfig();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('app:clear-installer-credentials', () => {
  try {
    clearPendingInstallerCredentials();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('app:print-current-page', async (_event, options = {}) => {
  const window = BrowserWindow.getFocusedWindow() || mainWindow;

  if (!window) {
    return { ok: false, error: 'No active window available for printing.' };
  }

  return new Promise((resolve) => {
    window.webContents.print(
      {
        silent: false,
        printBackground: true,
        ...options,
      },
      (success, failureReason) => {
        if (!success) {
          resolve({ ok: false, error: failureReason || 'Printing failed.' });
          return;
        }

        resolve({ ok: true });
      }
    );
  });
});

app.whenReady().then(async () => {
  if (app.isPackaged) {
    registerAppProtocol();
  }
  await createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
