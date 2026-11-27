const { app, BrowserWindow, Tray, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const CONFIG_PATH = () => path.join(app.getPath('userData'), 'desktop-config.json');
const BOUNDS_PATH = () => path.join(app.getPath('userData'), 'window-bounds.json');

let mainWindow = null;
let tray = null;
let isQuitting = false;

function readJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {}
  return fallback;
}

function writeJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

function checkLocalhostAlive(url = 'http://localhost:3000') {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.setTimeout(900, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function getConfiguredUrl() {
  if (process.env.LIFE_OS_URL) return process.env.LIFE_OS_URL;
  const cfg = readJson(CONFIG_PATH(), {});
  return typeof cfg.url === 'string' && cfg.url.trim() ? cfg.url.trim() : null;
}

function isSameAppOrAuthOrigin(targetUrl, appUrl) {
  try {
    const t = new URL(targetUrl);
    if (appUrl) {
      const a = new URL(appUrl);
      if (t.origin === a.origin) return true;
    }
    return (
      t.hostname.endsWith('google.com') ||
      t.hostname.endsWith('firebaseapp.com') ||
      t.hostname.endsWith('googleapis.com')
    );
  } catch {
    return false;
  }
}

async function loadWorkspace(win) {
  const savedUrl = getConfiguredUrl();
  if (savedUrl) {
    win.loadURL(savedUrl);
    return;
  }
  const localAlive = await checkLocalhostAlive('http://localhost:3000');
  if (localAlive) {
    win.loadURL('http://localhost:3000');
    return;
  }
  win.loadFile(path.join(__dirname, 'setup.html'));
}

function createWindow() {
  const savedBounds = readJson(BOUNDS_PATH(), { width: 1360, height: 860 });

  mainWindow = new BrowserWindow({
    width: savedBounds.width || 1360,
    height: savedBounds.height || 860,
    x: typeof savedBounds.x === 'number' ? savedBounds.x : undefined,
    y: typeof savedBounds.y === 'number' ? savedBounds.y : undefined,
    minWidth: 420,
    minHeight: 560,
    title: 'Sariling Mundo',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (savedBounds.isMaximized) {
    mainWindow.maximize();
  }

  const persistBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const isMaximized = mainWindow.isMaximized();
    const bounds = isMaximized ? savedBounds : mainWindow.getBounds();
    writeJson(BOUNDS_PATH(), { ...bounds, isMaximized });
  };

  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);

  mainWindow.on('close', (e) => {
    persistBounds();
    if (!isQuitting && tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const activeUrl = getConfiguredUrl() || mainWindow.webContents.getURL();
    if (isSameAppOrAuthOrigin(url, activeUrl)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  void loadWorkspace(mainWindow);
}

function buildTrayMenu() {
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  return Menu.buildFromTemplate([
    {
      label: 'Open Sariling Mundo',
      click: () => {
        if (!mainWindow) createWindow();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: 'Change Live Web URL',
      click: () => {
        if (!mainWindow) createWindow();
        mainWindow.show();
        mainWindow.loadFile(path.join(__dirname, 'setup.html'));
      },
    },
    { type: 'separator' },
    {
      label: 'Launch at Windows Startup',
      type: 'checkbox',
      checked: openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        if (tray) tray.setContextMenu(buildTrayMenu());
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Sariling Mundo',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.ico'));
  tray.setToolTip('Sariling Mundo — Synced Desktop App');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
    }
  });
}

const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.sarilingmundo.lifeos');

    ipcMain.handle('desktop:get-url', () => getConfiguredUrl() || '');
    ipcMain.handle('desktop:save-url', (_event, rawUrl) => {
      const cleaned = String(rawUrl || '').trim();
      if (!/^https?:\/\//i.test(cleaned)) {
        throw new Error('URL must start with http:// or https://');
      }
      writeJson(CONFIG_PATH(), { url: cleaned });
      if (mainWindow) mainWindow.loadURL(cleaned);
      return cleaned;
    });

    createWindow();
    createTray();
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !tray) {
      app.quit();
    }
  });
}
