const { app, BrowserWindow, Tray, Menu, ipcMain, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const CONFIG_PATH = () => path.join(app.getPath('userData'), 'desktop-config.json');
const BOUNDS_PATH = () => path.join(app.getPath('userData'), 'window-bounds.json');
const BUBBLE_CONFIG_PATH = () => path.join(app.getPath('userData'), 'bubble-config.json');

let mainWindow = null;
let bubbleWindow = null;
let popoverWindow = null;
let toastWindow = null;
let tray = null;
let isQuitting = false;
let dragOrigin = null;
let lastMainBlurAt = 0;
let lastPopoverShownAt = 0;
let lastPopoverBlurAt = 0;
let popoverPollTimer = null;
let toastAutoHideTimer = null;
let toastHovered = false;
let currentAlertKey = null;
const alertCooldowns = new Map();
let currentBubbleWorkState = { hasWork: false, pillText: 'Sariling Mundo' };

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
    mode: 'line', // 'circle' | 'line' | 'pill'
    edge: 'right',
    visible: true,
    autoMorphToLine: true,
    x: wa.x + wa.width - 32,
    y: Math.round(wa.y + wa.height * 0.42),
  };
}

function getBubbleDimensions(mode) {
  if (mode === 'line') return { width: 32, height: 84 };
  if (mode === 'pill') return { width: 162, height: 50 };
  return { width: 64, height: 64 };
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
  const popoverVisible = Boolean(popoverWindow && !popoverWindow.isDestroyed() && popoverWindow.isVisible());
  bubbleWindow.webContents.send('bubble:state', {
    mode: cfg.mode,
    edge: cfg.edge,
    appVisible,
    popoverVisible,
    hasWork: currentBubbleWorkState.hasWork,
    pillText: currentBubbleWorkState.pillText,
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
  if (popoverWindow && !popoverWindow.isDestroyed() && popoverWindow.isVisible()) {
    const pb = popoverWindow.getBounds();
    positionPopoverNextToBubble(pb.width, pb.height);
  }
  if (toastWindow && !toastWindow.isDestroyed() && toastWindow.isVisible()) {
    positionWindowNextToBubble(toastWindow, 318, 124);
  }
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

// ── Compact Anchored Action Popover ────────────────────────────
async function readWorkspaceSnapshot() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ready: false, theme: 'light', upNext: [], summary: 'Workspace loading' };
  }
  try {
    const snap = await mainWindow.webContents.executeJavaScript(`
      (() => {
        try {
          const urlPath = window.location.pathname || '/';
          const isAuthPage = urlPath === '/login' || urlPath === '/register';
          const rawTasks = localStorage.getItem('life_os_tasks_v1');
          const rawPlan = localStorage.getItem('life_os_today_plan_v1');
          const rawRoutine = localStorage.getItem('life_os_daily_routine_blocks_v1');
          const rawProgress = localStorage.getItem('life_os_daily_routine_progress_v1');
          const rawSettings = localStorage.getItem('life_os_user_settings_v1');

          const settings = rawSettings ? JSON.parse(rawSettings) : null;
          const theme = settings && settings.theme === 'dark' ? 'dark' : 'light';

          if (isAuthPage && !localStorage.getItem('life_os_active_uid')) {
            return { ready: false, needsAuth: true, theme, upNext: [], summary: 'Sign in required' };
          }

          const tasks = Array.isArray(rawTasks ? JSON.parse(rawTasks) : null) ? JSON.parse(rawTasks) : [];
          const todayPlan = rawPlan ? JSON.parse(rawPlan) : null;
          const blocks = Array.isArray(rawRoutine ? JSON.parse(rawRoutine) : null) ? JSON.parse(rawRoutine) : [];
          const d = new Date();
          const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          const nowMin = d.getHours() * 60 + d.getMinutes();

          let completedBlockIds = [];
          try {
            const prog = rawProgress ? JSON.parse(rawProgress) : null;
            if (prog && prog.date === todayStr && Array.isArray(prog.completedBlockIds)) {
              completedBlockIds = prog.completedBlockIds;
            }
          } catch {}

          const pendingBlocks = blocks.filter((b) => b && b.id && !completedBlockIds.includes(b.id));
          const activeBlock = pendingBlocks.find((b) => typeof b.startMinute === 'number' && typeof b.endMinute === 'number' && nowMin >= b.startMinute && nowMin < b.endMinute) || null;
          const nextBlock = pendingBlocks.find((b) => typeof b.startMinute === 'number' && b.startMinute >= nowMin) || pendingBlocks[0] || null;

          const pendingTasks = tasks.filter((t) => t && t.id && t.status !== 'done');
          const prioRank = { urgent: 0, high: 1, medium: 2, low: 3 };
          const sortedTasks = pendingTasks.slice().sort((a, b) => {
            const aMain = todayPlan && todayPlan.mainFocusTaskId === a.id ? 0 : 1;
            const bMain = todayPlan && todayPlan.mainFocusTaskId === b.id ? 0 : 1;
            if (aMain !== bMain) return aMain - bMain;
            const aDoing = a.status === 'doing' ? 0 : 1;
            const bDoing = b.status === 'doing' ? 0 : 1;
            if (aDoing !== bDoing) return aDoing - bDoing;
            const aOver = a.dueDate && a.dueDate < todayStr ? 0 : a.dueDate === todayStr ? 1 : 2;
            const bOver = b.dueDate && b.dueDate < todayStr ? 0 : b.dueDate === todayStr ? 1 : 2;
            if (aOver !== bOver) return aOver - bOver;
            return (prioRank[a.priority] ?? 2) - (prioRank[b.priority] ?? 2);
          });

          const rawBlocks = localStorage.getItem('life_os_scheduled_blocks_v1');
          const schedBlocks = Array.isArray(rawBlocks ? JSON.parse(rawBlocks) : null) ? JSON.parse(rawBlocks) : [];

          const notifCfg = settings && settings.notifications ? settings.notifications : null;
          const notificationsEnabled = !notifCfg || notifCfg.enabled !== false;

          let activeSchedBlock = null;
          for (const sb of schedBlocks) {
            if (!sb || !sb.id || sb.date !== todayStr || !sb.startTime || !sb.endTime) continue;
            const [sh, sm] = String(sb.startTime).split(':').map(Number);
            const [eh, em] = String(sb.endTime).split(':').map(Number);
            const startMin = sh * 60 + (sm || 0);
            const endMin = eh * 60 + (em || 0);
            if (nowMin >= startMin - 10 && nowMin < endMin) {
              activeSchedBlock = { ...sb, startMin, endMin };
              break;
            }
          }

          let primary = null;
          const upNext = [];
          let alertCandidate = null;

          if (activeBlock) {
            const minsLeft = typeof activeBlock.endMinute === 'number' ? Math.max(1, activeBlock.endMinute - nowMin) : null;
            primary = {
              kind: 'routine',
              id: activeBlock.id,
              badge: minsLeft ? 'WORK TIME · ' + minsLeft + 'M LEFT' : 'WORK TIME',
              tone: 'work',
              prompt: minsLeft ? 'Hey — work time is running (' + minsLeft + 'm left)' : 'Hey — work time is running',
              title: activeBlock.title,
              meta: (activeBlock.timeRange || 'Now') + (Array.isArray(activeBlock.steps) && activeBlock.steps.length ? ' · ' + activeBlock.steps[0] : ''),
            };
            alertCandidate = {
              alertKey: 'routine:' + activeBlock.id + ':' + todayStr,
              badge: minsLeft ? 'WORK TIME · ' + minsLeft + 'M LEFT' : 'WORK TIME RUNNING',
              tone: 'work',
              headline: 'Hey — work time is running',
              sub: activeBlock.title + (activeBlock.timeRange ? ' (' + activeBlock.timeRange + ')' : ''),
            };
          } else if (activeSchedBlock) {
            const startsIn = activeSchedBlock.startMin - nowMin;
            const minsLeft = Math.max(1, activeSchedBlock.endMin - nowMin);
            alertCandidate = {
              alertKey: 'sched:' + activeSchedBlock.id + ':' + todayStr,
              badge: startsIn > 0 ? 'STARTS IN ' + startsIn + 'M' : 'TIME RUNNING · ' + minsLeft + 'M LEFT',
              tone: 'work',
              headline: startsIn > 0 ? 'Scheduled focus starting soon' : 'Hey — scheduled work time is running',
              sub: activeSchedBlock.title + ' (' + activeSchedBlock.startTime + ' – ' + activeSchedBlock.endTime + ')',
            };
          } else if (sortedTasks.length > 0) {
            const top = sortedTasks[0];
            const isOverdue = Boolean(top.dueDate && top.dueDate < todayStr);
            const isToday = Boolean(top.dueDate && top.dueDate === todayStr);
            const isMain = Boolean(todayPlan && todayPlan.mainFocusTaskId === top.id);
            primary = {
              kind: 'task',
              id: top.id,
              badge: isOverdue ? 'OVERDUE' : isMain ? 'MAIN FOCUS' : isToday ? 'TASK TIME' : 'DO IT NOW',
              tone: isOverdue || top.priority === 'urgent' ? 'urgent' : isMain || isToday ? 'work' : 'neutral',
              prompt: isOverdue ? 'Priority overdue — finish this first' : isMain ? 'Hey — do the work now' : isToday ? 'Task time — start this now' : 'Hey — do this task now',
              title: top.title,
              meta: [
                top.estimatedDuration ? top.estimatedDuration + 'm' : null,
                isOverdue ? 'Due ' + top.dueDate : isToday ? 'Due today' : top.priority ? String(top.priority).toUpperCase() : null,
              ].filter(Boolean).join(' · '),
            };
          } else if (nextBlock) {
            primary = {
              kind: 'routine',
              id: nextBlock.id,
              badge: 'ROUTINE',
              tone: 'work',
              prompt: 'Up next in your daily routine',
              title: nextBlock.title,
              meta: nextBlock.timeRange || 'Today',
            };
          }

          for (const t of sortedTasks) {
            if (primary && primary.kind === 'task' && primary.id === t.id) continue;
            if (upNext.length >= 3) break;
            upNext.push({
              kind: 'task',
              id: t.id,
              title: t.title,
              meta: [t.estimatedDuration ? t.estimatedDuration + 'm' : null, t.dueDate === todayStr ? 'Due today' : t.dueDate && t.dueDate < todayStr ? 'Overdue' : t.priority || null].filter(Boolean).join(' · ') || 'Task',
            });
          }

          if (upNext.length < 3 && nextBlock && !(primary && primary.kind === 'routine' && primary.id === nextBlock.id)) {
            upNext.push({
              kind: 'routine',
              id: nextBlock.id,
              title: nextBlock.title,
              meta: 'Routine · ' + (nextBlock.timeRange || 'Today'),
            });
          }

          if (!alertCandidate && sortedTasks.length > 0) {
            const urgentOrDue = sortedTasks.find((t) => (t.dueDate && t.dueDate <= todayStr) || t.priority === 'urgent' || (todayPlan && todayPlan.mainFocusTaskId === t.id));
            if (urgentOrDue) {
              const isOver = Boolean(urgentOrDue.dueDate && urgentOrDue.dueDate < todayStr);
              const isToday = Boolean(urgentOrDue.dueDate && urgentOrDue.dueDate === todayStr);
              alertCandidate = {
                alertKey: 'task:' + urgentOrDue.id + ':' + todayStr,
                badge: isOver ? 'OVERDUE DEADLINE' : isToday ? 'DEADLINE TODAY' : 'REMINDER',
                tone: isOver || urgentOrDue.priority === 'urgent' ? 'urgent' : 'work',
                headline: isOver ? 'Deadline passed — finish this task' : isToday ? 'Deadline today — do the work now' : 'Hey — focus task waiting',
                sub: urgentOrDue.title,
              };
            }
          }

          if (!notificationsEnabled) {
            alertCandidate = null;
          }

          const routineTotal = blocks.length;
          const routineDone = blocks.filter((b) => completedBlockIds.includes(b.id)).length;
          const parts = [];
          parts.push(pendingTasks.length + ' task' + (pendingTasks.length === 1 ? '' : 's') + ' left');
          if (routineTotal > 0) parts.push(routineDone + '/' + routineTotal + ' routine');

          return {
            ready: true,
            theme,
            primary,
            upNext,
            alertCandidate,
            hasWork: Boolean(primary),
            summary: parts.join(' · '),
          };
        } catch {
          return { ready: false, theme: 'light', upNext: [], summary: 'Workspace loading' };
        }
      })()
    `);

    const hasWork = Boolean(snap && snap.hasWork);
    const pillText = snap && snap.primary
      ? (snap.primary.kind === 'routine' ? 'Work Time' : 'Task Time')
      : 'Sariling Mundo';
    if (currentBubbleWorkState.hasWork !== hasWork || currentBubbleWorkState.pillText !== pillText) {
      currentBubbleWorkState = { hasWork, pillText };
      sendBubbleState();
    }
    return snap;
  } catch {
    return { ready: false, theme: 'light', upNext: [], summary: 'Workspace loading' };
  }
}

function positionWindowNextToBubble(targetWin, width = 356, height = 320) {
  if (!targetWin || targetWin.isDestroyed()) return;
  const bubbleBounds = bubbleWindow && !bubbleWindow.isDestroyed()
    ? bubbleWindow.getBounds()
    : { x: 0, y: 200, width: 64, height: 64 };
  const display = screen.getDisplayNearestPoint({ x: bubbleBounds.x, y: bubbleBounds.y });
  const wa = display.workArea;
  const gap = 10;
  const bubbleCenterX = bubbleBounds.x + bubbleBounds.width / 2;
  const screenCenterX = wa.x + wa.width / 2;

  let targetX = bubbleCenterX < screenCenterX
    ? bubbleBounds.x + bubbleBounds.width + gap
    : bubbleBounds.x - width - gap;
  targetX = Math.max(wa.x + 8, Math.min(targetX, wa.x + wa.width - width - 8));

  let targetY = bubbleBounds.y - Math.round((height - bubbleBounds.height) / 2);
  targetY = Math.max(wa.y + 8, Math.min(targetY, wa.y + wa.height - height - 8));

  targetWin.setBounds({ x: Math.round(targetX), y: Math.round(targetY), width, height });
}

function positionPopoverNextToBubble(width = 356, height = 320) {
  positionWindowNextToBubble(popoverWindow, width, height);
}

function createToastWindow() {
  toastWindow = new BrowserWindow({
    width: 318,
    height: 124,
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
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'toast-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  toastWindow.setAlwaysOnTop(true, 'screen-saver');
  toastWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  toastWindow.loadFile(path.join(__dirname, 'toast.html'));

  toastWindow.on('closed', () => {
    toastWindow = null;
    if (toastAutoHideTimer) {
      clearTimeout(toastAutoHideTimer);
      toastAutoHideTimer = null;
    }
  });
}

function hideToast() {
  if (toastAutoHideTimer) {
    clearTimeout(toastAutoHideTimer);
    toastAutoHideTimer = null;
  }
  toastHovered = false;
  if (toastWindow && !toastWindow.isDestroyed() && toastWindow.isVisible()) {
    toastWindow.hide();
  }
}

function scheduleToastAutoHide() {
  if (toastAutoHideTimer) clearTimeout(toastAutoHideTimer);
  toastAutoHideTimer = setTimeout(() => {
    if (!toastHovered) hideToast();
  }, 10500);
}

function showOutsideToast(payload) {
  if (!payload) return;
  if (popoverWindow && !popoverWindow.isDestroyed() && popoverWindow.isVisible()) return;
  if (!toastWindow || toastWindow.isDestroyed()) {
    createToastWindow();
  }
  currentAlertKey = payload.alertKey || null;
  positionWindowNextToBubble(toastWindow, 318, 124);
  toastWindow.showInactive();
  toastWindow.webContents.send('toast:show', payload);
  scheduleToastAutoHide();
}

async function evaluateAndNotifyAlerts(force = false) {
  const snap = await readWorkspaceSnapshot();
  if (!snap || !snap.ready) return;

  const candidate = snap.alertCandidate;
  if (!candidate) {
    if (force) {
      showOutsideToast({
        alertKey: 'manual:clear:' + Date.now(),
        badge: 'ALL CLEAR',
        tone: 'neutral',
        headline: 'You are caught up right now',
        sub: snap.summary || 'No urgent deadlines or active blocks.',
        theme: snap.theme,
      });
    }
    return;
  }

  const now = Date.now();
  const blockedUntil = alertCooldowns.get(candidate.alertKey) || 0;
  if (!force && blockedUntil > now) return;

  if (!force) {
    // Remember this alert until tomorrow unless snoozed for 15 minutes
    alertCooldowns.set(candidate.alertKey, now + 12 * 60 * 60 * 1000);
  }

  showOutsideToast({ ...candidate, theme: snap.theme });
}

function createPopoverWindow() {
  popoverWindow = new BrowserWindow({
    width: 356,
    height: 300,
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
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'popup-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  popoverWindow.setAlwaysOnTop(true, 'screen-saver');
  popoverWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  popoverWindow.loadFile(path.join(__dirname, 'popup.html'));

  popoverWindow.on('blur', () => {
    if (Date.now() - lastPopoverShownAt < 180) return;
    lastPopoverBlurAt = Date.now();
    hidePopover();
  });

  popoverWindow.on('closed', () => {
    popoverWindow = null;
    if (popoverPollTimer) {
      clearInterval(popoverPollTimer);
      popoverPollTimer = null;
    }
    sendBubbleState();
  });
}

async function refreshPopover() {
  if (!popoverWindow || popoverWindow.isDestroyed()) return;
  const snap = await readWorkspaceSnapshot();
  if (!popoverWindow || popoverWindow.isDestroyed()) return;
  popoverWindow.webContents.send('popover:snapshot', snap);
}

function hidePopover() {
  if (popoverPollTimer) {
    clearInterval(popoverPollTimer);
    popoverPollTimer = null;
  }
  if (popoverWindow && !popoverWindow.isDestroyed() && popoverWindow.isVisible()) {
    popoverWindow.hide();
  }
  sendBubbleState();
}

async function showPopover() {
  hideToast();
  if (!popoverWindow || popoverWindow.isDestroyed()) {
    createPopoverWindow();
  }
  const snap = await readWorkspaceSnapshot();
  const bounds = popoverWindow.getBounds();
  positionPopoverNextToBubble(bounds.width || 356, bounds.height || 300);
  lastPopoverShownAt = Date.now();
  popoverWindow.show();
  popoverWindow.focus();
  popoverWindow.webContents.send('popover:snapshot', snap);
  sendBubbleState();

  if (popoverPollTimer) clearInterval(popoverPollTimer);
  popoverPollTimer = setInterval(() => {
    if (popoverWindow && !popoverWindow.isDestroyed() && popoverWindow.isVisible()) {
      void refreshPopover();
    }
  }, 4000);
}

async function togglePopover() {
  if (Date.now() - lastPopoverBlurAt < 220) {
    return;
  }
  if (popoverWindow && !popoverWindow.isDestroyed() && popoverWindow.isVisible()) {
    hidePopover();
  } else {
    await showPopover();
  }
}

function showBubbleContextMenu() {
  const cfg = getBubbleConfig();
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open / Hide Sariling Mundo',
      click: () => toggleMainApp(),
    },
    {
      label: 'Check Reminders Now',
      click: () => { void evaluateAndNotifyAlerts(true); },
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
  mainWindow.webContents.on('did-finish-load', () => {
    void readWorkspaceSnapshot().then(() => {
      if (popoverWindow && !popoverWindow.isDestroyed() && popoverWindow.isVisible()) {
        void refreshPopover();
      }
    });
  });
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
      label: 'Check Reminders Now',
      click: () => { void evaluateAndNotifyAlerts(true); },
    },
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

    ipcMain.handle('desktop:get-bubble-config', () => {
      const cfg = getBubbleConfig();
      const popoverVisible = Boolean(popoverWindow && !popoverWindow.isDestroyed() && popoverWindow.isVisible());
      return {
        visible: Boolean(cfg.visible),
        mode: cfg.mode || 'circle',
        edge: cfg.edge || 'right',
        popoverVisible,
      };
    });

    ipcMain.handle('desktop:set-bubble-visible', (_event, visible) => {
      const next = { ...getBubbleConfig(), visible: Boolean(visible) };
      saveBubbleConfig(next);
      if (next.visible) {
        if (!bubbleWindow || bubbleWindow.isDestroyed()) createBubbleWindow();
        bubbleWindow.showInactive();
        positionAndResizeBubble(next);
      } else {
        hidePopover();
        bubbleWindow?.hide();
      }
      if (tray) tray.setContextMenu(buildTrayMenu());
      return next;
    });

    ipcMain.handle('desktop:set-bubble-mode', (_event, mode) => {
      const validMode = ['circle', 'line', 'pill'].includes(mode) ? mode : 'circle';
      const cur = getBubbleConfig();
      saveBubbleConfig({ ...cur, visible: true });
      if (!bubbleWindow || bubbleWindow.isDestroyed()) createBubbleWindow();
      bubbleWindow.showInactive();
      setBubbleMode(validMode);
      return getBubbleConfig();
    });

    ipcMain.handle('desktop:trigger-bubble', async () => {
      const cur = getBubbleConfig();
      if (!cur.visible) {
        const next = { ...cur, visible: true };
        saveBubbleConfig(next);
        if (!bubbleWindow || bubbleWindow.isDestroyed()) createBubbleWindow();
        bubbleWindow.showInactive();
        positionAndResizeBubble(next);
        if (tray) tray.setContextMenu(buildTrayMenu());
      }
      await showPopover();
      return getBubbleConfig();
    });

    ipcMain.handle('bubble:get-state', () => {
      const cfg = getBubbleConfig();
      const appVisible = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized());
      const popoverVisible = Boolean(popoverWindow && !popoverWindow.isDestroyed() && popoverWindow.isVisible());
      return {
        mode: cfg.mode,
        edge: cfg.edge,
        appVisible,
        popoverVisible,
        hasWork: currentBubbleWorkState.hasWork,
        pillText: currentBubbleWorkState.pillText,
      };
    });

    ipcMain.handle('bubble:toggle-popover', async () => {
      await togglePopover();
    });

    ipcMain.handle('bubble:toggle-app', () => {
      hidePopover();
      toggleMainApp();
    });

    ipcMain.handle('popover:get-snapshot', async () => {
      return await readWorkspaceSnapshot();
    });

    ipcMain.handle('popover:complete-task', async (_event, taskId) => {
      if (mainWindow && !mainWindow.isDestroyed() && taskId) {
        const safeId = JSON.stringify(String(taskId));
        await mainWindow.webContents.executeJavaScript(`
          (() => {
            try {
              const raw = localStorage.getItem('life_os_tasks_v1');
              const list = raw ? JSON.parse(raw) : [];
              if (!Array.isArray(list)) return false;
              const now = new Date().toISOString();
              const next = list.map((t) => (t && t.id === ${safeId} ? { ...t, status: 'done', completedAt: now, updatedAt: now } : t));
              localStorage.setItem('life_os_tasks_v1', JSON.stringify(next));
              window.dispatchEvent(new CustomEvent('life_os_cloud_synced'));
              return true;
            } catch {
              return false;
            }
          })()
        `);
      }
      await refreshPopover();
    });

    ipcMain.handle('popover:complete-routine-block', async (_event, blockId) => {
      if (mainWindow && !mainWindow.isDestroyed() && blockId) {
        const safeId = JSON.stringify(String(blockId));
        await mainWindow.webContents.executeJavaScript(`
          (() => {
            try {
              const d = new Date();
              const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
              const rawBlocks = localStorage.getItem('life_os_daily_routine_blocks_v1');
              const blocks = rawBlocks ? JSON.parse(rawBlocks) : [];
              const block = Array.isArray(blocks) ? blocks.find((b) => b && b.id === ${safeId}) : null;
              const rawProg = localStorage.getItem('life_os_daily_routine_progress_v1');
              const parsed = rawProg ? JSON.parse(rawProg) : null;
              const prog = parsed && parsed.date === todayStr
                ? parsed
                : { date: todayStr, completedStepKeys: [], completedBlockIds: [] };
              const nextIds = Array.from(new Set([...(prog.completedBlockIds || []), ${safeId}]));
              const stepKeys = Array.isArray(prog.completedStepKeys) ? [...prog.completedStepKeys] : [];
              if (block && Array.isArray(block.steps)) {
                block.steps.forEach((_, idx) => {
                  const k = ${safeId} + ':' + idx;
                  if (!stepKeys.includes(k)) stepKeys.push(k);
                });
              }
              localStorage.setItem('life_os_daily_routine_progress_v1', JSON.stringify({
                date: todayStr,
                completedBlockIds: nextIds,
                completedStepKeys: stepKeys,
              }));
              window.dispatchEvent(new Event('life_os_daily_routine_reminder_updated'));
              window.dispatchEvent(new CustomEvent('life_os_cloud_synced'));
              return true;
            } catch {
              return false;
            }
          })()
        `);
      }
      await refreshPopover();
    });

    ipcMain.handle('popover:open-workspace', (_event, route) => {
      hidePopover();
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
        return;
      }
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      const target = typeof route === 'string' && route.startsWith('/') ? route : '/';
      if (target !== '/') {
        try {
          const curUrl = mainWindow.webContents.getURL();
          if (curUrl && !curUrl.startsWith('file://')) {
            const nextUrl = new URL(target, curUrl).toString();
            if (curUrl !== nextUrl) {
              void mainWindow.loadURL(nextUrl);
            }
          }
        } catch {}
      }
      sendBubbleState();
    });

    ipcMain.on('popover:close', () => {
      hidePopover();
    });

    ipcMain.on('popover:resize', (_event, height) => {
      if (!popoverWindow || popoverWindow.isDestroyed()) return;
      const clampedH = Math.max(190, Math.min(Number(height) || 300, 520));
      positionPopoverNextToBubble(356, clampedH);
    });

    ipcMain.handle('toast:open-popover', async () => {
      hideToast();
      await showPopover();
    });

    ipcMain.handle('toast:snooze', (_event, alertKey) => {
      const key = alertKey || currentAlertKey;
      if (key) {
        alertCooldowns.set(key, Date.now() + 15 * 60 * 1000);
      }
      hideToast();
    });

    ipcMain.on('toast:dismiss', (_event, alertKey) => {
      const key = alertKey || currentAlertKey;
      if (key) {
        alertCooldowns.set(key, Date.now() + 12 * 60 * 60 * 1000);
      }
      hideToast();
    });

    ipcMain.on('toast:hover', (_event, hovered) => {
      toastHovered = Boolean(hovered);
      if (!toastHovered && toastWindow && !toastWindow.isDestroyed() && toastWindow.isVisible()) {
        scheduleToastAutoHide();
      } else if (toastHovered && toastAutoHideTimer) {
        clearTimeout(toastAutoHideTimer);
        toastAutoHideTimer = null;
      }
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
    createPopoverWindow();
    createToastWindow();
    createBubbleWindow();
    createTray();
    setTimeout(() => { void evaluateAndNotifyAlerts(false); }, 4000);
    setInterval(() => { void evaluateAndNotifyAlerts(false); }, 30000);
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
