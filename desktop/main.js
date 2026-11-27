const { app, BrowserWindow, Tray, Menu, ipcMain, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const CONFIG_PATH = () => path.join(app.getPath('userData'), 'desktop-config.json');
const BOUNDS_PATH = () => path.join(app.getPath('userData'), 'window-bounds.json');
const BUBBLE_CONFIG_PATH = () => path.join(app.getPath('userData'), 'bubble-config.json');

let mainWindow = null;
let bubbleWindow = null;
let tray = null;
let isQuitting = false;
let dragOrigin = null;
let lastMainBlurAt = 0;

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

// ── Floating Bubble State & Helpers ───────────────────────────
function getDefaultBubbleConfig() {
  const display = screen.getPrimaryDisplay();
  const wa = display.workArea;
  return {
    mode: 'circle', // 'circle' | 'line' | 'pill'
    edge: 'right',
    visible: true,
    autoMorphToLine: true,
    x: wa.x + wa.width - 86,
    y: Math.round(wa.y + wa.height * 0.48),
  };
}

function getBubbleDimensions(mode) {
  if (mode === 'line') return { width: 34, height: 90 };
  if (mode === 'pill') return { width: 162, height: 52 };
  return { width: 70, height: 70 };
}

function getBubbleConfig() {
  const def = getDefaultBubbleConfig();
  const saved = readJson(BUBBLE_CONFIG_PATH(), {});
  return { ...def, ...saved };
}

function saveBubbleConfig(next) {
  writeJson(BUBBLE_CONFIG_PATH(), next);
}

function sendBubbleState() {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
  const cfg = getBubbleConfig();
  const appVisible = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized());
  bubbleWindow.webContents.send('bubble:state', {
    mode: cfg.mode,
    edge: cfg.edge,
    appVisible,
  });
}

function positionAndResizeBubble(cfg) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
  const { width, height } = getBubbleDimensions(cfg.mode);
  const display = screen.getDisplayNearestPoint({ x: cfg.x || 0, y: cfg.y || 0 });
  const wa = display.workArea;

  let nextX = typeof cfg.x === 'number' ? cfg.x : wa.x + wa.width - width - 16;
  let nextY = typeof cfg.y === 'number' ? cfg.y : Math.round(wa.y + wa.height * 0.48);

  if (cfg.mode === 'line') {
    nextX = cfg.edge === 'left' ? wa.x : wa.x + wa.width - width;
  } else {
    nextX = Math.max(wa.x, Math.min(nextX, wa.x + wa.width - width));
  }
  nextY = Math.max(wa.y + 8, Math.min(nextY, wa.y + wa.height - height - 8));

  bubbleWindow.setBounds({ x: Math.round(nextX), y: Math.round(nextY), width, height });
  sendBubbleState();
}

function setBubbleMode(mode, snapEdge) {
  const cfg = getBubbleConfig();
  const prevDims = getBubbleDimensions(cfg.mode);
  const nextDims = getBubbleDimensions(mode);

  const curBounds = bubbleWindow && !bubbleWindow.isDestroyed()
    ? bubbleWindow.getBounds()
    : { x: cfg.x, y: cfg.y, width: prevDims.width, height: prevDims.height };

  const display = screen.getDisplayNearestPoint({ x: curBounds.x, y: curBounds.y });
  const wa = display.workArea;
  const edge = snapEdge || cfg.edge || (curBounds.x + curBounds.width / 2 < wa.x + wa.width / 2 ? 'left' : 'right');

  let nextX = curBounds.x;
  if (mode === 'line') {
    nextX = edge === 'left' ? wa.x : wa.x + wa.width - nextDims.width;
  } else if (cfg.mode === 'line') {
    // Coming back out of edge line into circle/pill cleanly
    nextX = edge === 'left' ? wa.x + 16 : wa.x + wa.width - nextDims.width - 16;
  } else {
    nextX = Math.max(wa.x + 8, Math.min(curBounds.x, wa.x + wa.width - nextDims.width - 8));
  }

  const nextCfg = {
    ...cfg,
    mode,
    edge,
    x: Math.round(nextX),
    y: Math.round(curBounds.y),
  };
  saveBubbleConfig(nextCfg);
  positionAndResizeBubble(nextCfg);
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function toggleMainApp() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  const wasActiveWindow = mainWindow.isFocused() || Date.now() - lastMainBlurAt < 350;
  if (mainWindow.isVisible() && !mainWindow.isMinimized() && wasActiveWindow) {
    mainWindow.hide();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  sendBubbleState();
}

function createBubbleWindow() {
  const cfg = getBubbleConfig();
  const dims = getBubbleDimensions(cfg.mode);

  bubbleWindow = new BrowserWindow({
    width: dims.width,
    height: dims.height,
    x: cfg.x,
    y: cfg.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: true,
    show: Boolean(cfg.visible),
    webPreferences: {
      preload: path.join(__dirname, 'bubble-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  bubbleWindow.setAlwaysOnTop(true, 'screen-saver');
  bubbleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  bubbleWindow.loadFile(path.join(__dirname, 'bubble.html'));

  bubbleWindow.webContents.on('did-finish-load', () => {
    positionAndResizeBubble(getBubbleConfig());
  });
}

function showBubbleContextMenu() {
  const cfg = getBubbleConfig();
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open / Hide Sariling Mundo',
      click: () => toggleMainApp(),
    },
    { type: 'separator' },
    {
      label: 'Design: Circle Bubble',
      type: 'radio',
      checked: cfg.mode === 'circle',
      click: () => setBubbleMode('circle'),
    },
    {
      label: 'Design: Edge Line (Swipe)',
      type: 'radio',
      checked: cfg.mode === 'line',
      click: () => setBubbleMode('line'),
    },
    {
      label: 'Design: Pill Badge',
      type: 'radio',
      checked: cfg.mode === 'pill',
      click: () => setBubbleMode('pill'),
    },
    { type: 'separator' },
    {
      label: 'Snap to Left Edge',
      click: () => {
        const display = screen.getPrimaryDisplay();
        const wa = display.workArea;
        const dims = getBubbleDimensions(cfg.mode);
        const next = { ...cfg, edge: 'left', x: cfg.mode === 'line' ? wa.x : wa.x + 14 };
        saveBubbleConfig(next);
        bubbleWindow?.setBounds({ x: next.x, y: next.y, width: dims.width, height: dims.height });
        sendBubbleState();
      },
    },
    {
      label: 'Snap to Right Edge',
      click: () => {
        const display = screen.getPrimaryDisplay();
        const wa = display.workArea;
        const dims = getBubbleDimensions(cfg.mode);
        const next = {
          ...cfg,
          edge: 'right',
          x: cfg.mode === 'line' ? wa.x + wa.width - dims.width : wa.x + wa.width - dims.width - 14,
        };
        saveBubbleConfig(next);
        bubbleWindow?.setBounds({ x: next.x, y: next.y, width: dims.width, height: dims.height });
        sendBubbleState();
      },
    },
    {
      label: 'Auto-morph to Line on Edge',
      type: 'checkbox',
      checked: cfg.autoMorphToLine !== false,
      click: (item) => {
        const next = { ...getBubbleConfig(), autoMorphToLine: item.checked };
        saveBubbleConfig(next);
      },
    },
    { type: 'separator' },
    {
      label: 'Hide Floating Bubble',
      click: () => {
        const next = { ...getBubbleConfig(), visible: false };
        saveBubbleConfig(next);
        bubbleWindow?.hide();
        if (tray) tray.setContextMenu(buildTrayMenu());
      },
    },
  ]);

  menu.popup({ window: bubbleWindow || undefined });
}

// ── Main App Window ───────────────────────────────────────────
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
  mainWindow.on('blur', () => {
    lastMainBlurAt = Date.now();
  });
  mainWindow.on('show', sendBubbleState);
  mainWindow.on('hide', sendBubbleState);
  mainWindow.on('minimize', sendBubbleState);
  mainWindow.on('restore', sendBubbleState);

  mainWindow.on('close', (e) => {
    persistBounds();
    if (!isQuitting && tray) {
      e.preventDefault();
      mainWindow.hide();
      sendBubbleState();
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
  const bubbleCfg = getBubbleConfig();

  return Menu.buildFromTemplate([
    {
      label: 'Open Sariling Mundo',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) createWindow();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: 'Change Live Web URL',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) createWindow();
        mainWindow.show();
        mainWindow.loadFile(path.join(__dirname, 'setup.html'));
      },
    },
    { type: 'separator' },
    {
      label: 'Show Floating Bubble',
      type: 'checkbox',
      checked: Boolean(bubbleCfg.visible),
      click: (item) => {
        const next = { ...getBubbleConfig(), visible: item.checked };
        saveBubbleConfig(next);
        if (item.checked) {
          if (!bubbleWindow || bubbleWindow.isDestroyed()) createBubbleWindow();
          bubbleWindow.showInactive();
          positionAndResizeBubble(next);
        } else {
          bubbleWindow?.hide();
        }
        if (tray) tray.setContextMenu(buildTrayMenu());
      },
    },
    {
      label: 'Bubble Design',
      submenu: [
        {
          label: 'Circle Bubble',
          type: 'radio',
          checked: bubbleCfg.mode === 'circle',
          click: () => {
            const next = { ...getBubbleConfig(), visible: true };
            saveBubbleConfig(next);
            if (!bubbleWindow || bubbleWindow.isDestroyed()) createBubbleWindow();
            bubbleWindow.showInactive();
            setBubbleMode('circle');
          },
        },
        {
          label: 'Edge Line (Swipe)',
          type: 'radio',
          checked: bubbleCfg.mode === 'line',
          click: () => {
            const next = { ...getBubbleConfig(), visible: true };
            saveBubbleConfig(next);
            if (!bubbleWindow || bubbleWindow.isDestroyed()) createBubbleWindow();
            bubbleWindow.showInactive();
            setBubbleMode('line');
          },
        },
        {
          label: 'Pill Badge',
          type: 'radio',
          checked: bubbleCfg.mode === 'pill',
          click: () => {
            const next = { ...getBubbleConfig(), visible: true };
            saveBubbleConfig(next);
            if (!bubbleWindow || bubbleWindow.isDestroyed()) createBubbleWindow();
            bubbleWindow.showInactive();
            setBubbleMode('pill');
          },
        },
      ],
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
  tray.on('click', () => toggleMainApp());
}

const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
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
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(cleaned);
      return cleaned;
    });

    ipcMain.handle('bubble:get-state', () => {
      const cfg = getBubbleConfig();
      const appVisible = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized());
      return { mode: cfg.mode, edge: cfg.edge, appVisible };
    });

    ipcMain.handle('bubble:toggle-app', () => {
      toggleMainApp();
    });

    ipcMain.handle('bubble:set-mode', (_event, mode) => {
      setBubbleMode(mode);
    });

    ipcMain.on('bubble:context-menu', () => {
      showBubbleContextMenu();
    });

    ipcMain.on('bubble:drag-start', (_event, { screenX, screenY }) => {
      if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
      const bounds = bubbleWindow.getBounds();
      dragOrigin = {
        startWinX: bounds.x,
        startWinY: bounds.y,
        startScreenX: screenX,
        startScreenY: screenY,
      };
    });

    ipcMain.on('bubble:drag-move', (_event, { screenX, screenY }) => {
      if (!bubbleWindow || bubbleWindow.isDestroyed() || !dragOrigin) return;
      const cfg = getBubbleConfig();
      const dims = getBubbleDimensions(cfg.mode);
      const dx = screenX - dragOrigin.startScreenX;
      const dy = screenY - dragOrigin.startScreenY;

      // If dragging out from an edge line, pop seamlessly back into circle bubble!
      if (cfg.mode === 'line' && Math.abs(dx) > 40) {
        const circleDims = getBubbleDimensions('circle');
        const poppedX = cfg.edge === 'left'
          ? dragOrigin.startWinX + Math.max(24, dx)
          : dragOrigin.startWinX + Math.min(-24, dx);
        const nextCfg = { ...cfg, mode: 'circle', x: Math.round(poppedX), y: Math.round(dragOrigin.startWinY + dy) };
        saveBubbleConfig(nextCfg);
        bubbleWindow.setBounds({ x: nextCfg.x, y: nextCfg.y, width: circleDims.width, height: circleDims.height });
        sendBubbleState();
        dragOrigin = {
          startWinX: nextCfg.x,
          startWinY: nextCfg.y,
          startScreenX: screenX,
          startScreenY: screenY,
        };
        return;
      }

      const targetX = cfg.mode === 'line' ? dragOrigin.startWinX : Math.round(dragOrigin.startWinX + dx);
      const targetY = Math.round(dragOrigin.startWinY + dy);
      bubbleWindow.setBounds({ x: targetX, y: targetY, width: dims.width, height: dims.height });
    });

    ipcMain.on('bubble:drag-end', () => {
      if (!bubbleWindow || bubbleWindow.isDestroyed() || !dragOrigin) return;
      dragOrigin = null;

      const cfg = getBubbleConfig();
      const bounds = bubbleWindow.getBounds();
      const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
      const wa = display.workArea;

      const nearLeft = bounds.x <= wa.x + 14;
      const nearRight = bounds.x + bounds.width >= wa.x + wa.width - 14;
      const edge = nearLeft ? 'left' : nearRight ? 'right' : (bounds.x + bounds.width / 2 < wa.x + wa.width / 2 ? 'left' : 'right');

      // Auto-morph to glowing edge line when dragged/swiped onto the left or right screen edge
      if ((nearLeft || nearRight) && cfg.autoMorphToLine !== false && cfg.mode !== 'line') {
        setBubbleMode('line', edge);
        return;
      }

      const clampedX = cfg.mode === 'line'
        ? (edge === 'left' ? wa.x : wa.x + wa.width - bounds.width)
        : Math.max(wa.x + 8, Math.min(bounds.x, wa.x + wa.width - bounds.width - 8));
      const clampedY = Math.max(wa.y + 8, Math.min(bounds.y, wa.y + wa.height - bounds.height - 8));

      const nextCfg = {
        ...cfg,
        edge,
        x: Math.round(clampedX),
        y: Math.round(clampedY),
      };
      saveBubbleConfig(nextCfg);
      positionAndResizeBubble(nextCfg);
    });

    createWindow();
    createBubbleWindow();
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
