const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:3000';
const KIOSK_ENTRY_PATH = '/selfcheckout';
const DIST_DIR = path.join(__dirname, '..', 'dist');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

let mainWindow;
let rendererServer;
let rendererOrigin;

async function startRendererServer() {
  if (rendererOrigin) {
    return rendererOrigin;
  }

  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`Missing renderer build output at ${DIST_DIR}. Run "npm run build" before packaging Electron.`);
  }

  rendererServer = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const candidatePath = path.normalize(path.join(DIST_DIR, relativePath));
    const isInsideDist = candidatePath.startsWith(DIST_DIR);

    if (!isInsideDist) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const filePath = fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()
      ? candidatePath
      : path.join(DIST_DIR, 'index.html');

    const contentType = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });

    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve, reject) => {
    rendererServer.once('error', reject);
    rendererServer.listen(0, '127.0.0.1', () => {
      const address = rendererServer.address();
      rendererOrigin = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });

  return rendererOrigin;
}

async function resolveAppUrl() {
  if (!app.isPackaged) {
    return `${DEV_SERVER_URL}${KIOSK_ENTRY_PATH}`;
  }

  const origin = await startRendererServer();
  return `${origin}${KIOSK_ENTRY_PATH}`;
}

async function createWindow() {
  const startUrl = await resolveAppUrl();
  const startOrigin = new URL(startUrl).origin;

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
    show: false,
  });

  await mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

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

      if (isReload || isDevTools) {
        event.preventDefault();
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('app:get-runtime-info', () => ({
  isPackaged: app.isPackaged,
  platform: process.platform,
  kioskEntryPath: KIOSK_ENTRY_PATH,
}));

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
  await createWindow();
});

app.on('window-all-closed', () => {
  if (rendererServer) {
    rendererServer.close();
    rendererServer = null;
    rendererOrigin = null;
  }
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
