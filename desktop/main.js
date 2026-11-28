const { app, BrowserWindow, Tray, Menu, ipcMain, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Allow Web Audio alert chimes and ringtones in background/desktop toast and sidebar windows
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const CONFIG_PATH = () => path.join(app.getPath('userData'), 'desktop-config.json');
const BOUNDS_PATH = () => path.join(app.getPath('userData'), 'window-bounds.json');
const BUBBLE_CONFIG_PATH = () => path.join(app.getPath('userData'), 'bubble-config.json');
const LAST_SNAPSHOT_PATH = () => path.join(app.getPath('userData'), 'last-snapshot.json');
const startedAtLogin = process.argv.includes('--autostart');

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
let startupBriefingDone = false;
const alertCooldowns = new Map();
let blinkPausedForCurrentWork = false;
let blinkAcknowledgedKeys = new Set();
let lastSnapshotCache = null;
let currentBubbleWorkState = {
  hasWork: false,
  isBlinking: false,
  blinkMuted: false,
  blinkPaused: false,
  workTone: 'neutral',
  pillText: 'Sariling Mundo',
  workKeys: [],
};

function getAlertSoundEnabled() {
  const cfg = readJson(CONFIG_PATH(), {});
  return cfg.alertSoundEnabled !== false;
}

function setAlertSoundEnabled(enabled) {
  const cfg = readJson(CONFIG_PATH(), {});
  const next = { ...cfg, alertSoundEnabled: Boolean(enabled) };
  writeJson(CONFIG_PATH(), next);
  if (tray) tray.setContextMenu(buildTrayMenu());
  void refreshPopover();
  return Boolean(enabled);
}

function getEdgeBlinkEnabled() {
  const cfg = readJson(CONFIG_PATH(), {});
  return cfg.edgeBlinkEnabled !== false;
}

function syncBubbleWorkFromSnapshot(snap) {
  if (snap && snap.ready) {
    lastSnapshotCache = snap;
  }
  const source = snap && snap.ready ? snap : lastSnapshotCache;
  const hasWork = Boolean(source && source.ready && source.hasWork);
  const workKeys = Array.isArray(source && source.workItemKeys)
    ? source.workItemKeys.map((k) => String(k))
    : [];

  if (!hasWork) {
    blinkAcknowledgedKeys.clear();
    blinkPausedForCurrentWork = false;
  } else if (blinkPausedForCurrentWork) {
    const hasNewUnacked = workKeys.some((k) => !blinkAcknowledgedKeys.has(k));
    if (hasNewUnacked) {
      blinkPausedForCurrentWork = false;
      blinkAcknowledgedKeys.clear();
    }
  }

  const blinkMuted = !getEdgeBlinkEnabled();
  const isBlinking = Boolean(hasWork && !blinkMuted && !blinkPausedForCurrentWork);
  const workTone = !hasWork
    ? 'neutral'
    : source && (source.hasUrgentWork || (source.primary && source.primary.tone === 'urgent'))
    ? 'urgent'
    : 'work';

  const pillText = source && source.primary
    ? (source.primary.kind === 'routine' ? 'Work Time' : 'Task Time')
    : 'Sariling Mundo';

  const changed =
    currentBubbleWorkState.hasWork !== hasWork ||
    currentBubbleWorkState.isBlinking !== isBlinking ||
    currentBubbleWorkState.blinkMuted !== blinkMuted ||
    currentBubbleWorkState.blinkPaused !== blinkPausedForCurrentWork ||
    currentBubbleWorkState.workTone !== workTone ||
    currentBubbleWorkState.pillText !== pillText;

  currentBubbleWorkState = {
    hasWork,
    isBlinking,
    blinkMuted,
    blinkPaused: blinkPausedForCurrentWork,
    workTone,
    pillText,
    workKeys,
  };

  if (changed) {
    sendBubbleState();
    if (tray) tray.setContextMenu(buildTrayMenu());
  }
}

function setEdgeBlinkEnabled(enabled) {
  const flag = Boolean(enabled);
  const cfg = readJson(CONFIG_PATH(), {});
  writeJson(CONFIG_PATH(), { ...cfg, edgeBlinkEnabled: flag });
  if (flag) {
    blinkAcknowledgedKeys.clear();
    blinkPausedForCurrentWork = false;
  }
  syncBubbleWorkFromSnapshot(lastSnapshotCache);
  sendBubbleState();
  if (tray) tray.setContextMenu(buildTrayMenu());
  void refreshPopover();
  return flag;
}

function stopEdgeBlink() {
  blinkPausedForCurrentWork = true;
  blinkAcknowledgedKeys = new Set(currentBubbleWorkState.workKeys || []);
  syncBubbleWorkFromSnapshot(lastSnapshotCache);
  sendBubbleState();
  if (tray) tray.setContextMenu(buildTrayMenu());
  void refreshPopover();
  return { ...currentBubbleWorkState, edgeBlinkEnabled: getEdgeBlinkEnabled() };
}

function resumeEdgeBlink() {
  blinkPausedForCurrentWork = false;
  blinkAcknowledgedKeys.clear();
  syncBubbleWorkFromSnapshot(lastSnapshotCache);
  sendBubbleState();
  if (tray) tray.setContextMenu(buildTrayMenu());
  void refreshPopover();
  return { ...currentBubbleWorkState, edgeBlinkEnabled: getEdgeBlinkEnabled() };
}

function setStartupLaunchEnabled(enabled) {
  const flag = Boolean(enabled);
  app.setLoginItemSettings({
    openAtLogin: flag,
    args: flag ? ['--autostart'] : [],
  });
  const cfg = readJson(CONFIG_PATH(), {});
  writeJson(CONFIG_PATH(), { ...cfg, autoStartConfigured: true, openAtLogin: flag });
  if (tray) tray.setContextMenu(buildTrayMenu());
  return flag;
}

function ensureDefaultAutoStart() {
  const cfg = readJson(CONFIG_PATH(), {});
  if (cfg.autoStartConfigured !== true) {
    setStartupLaunchEnabled(true);
  } else if (cfg.openAtLogin === true) {
    app.setLoginItemSettings({ openAtLogin: true, args: ['--autostart'] });
  }
}

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

function isValidWorkspaceUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol === 'https:') return true;
    if (parsed.protocol === 'http:' && isLocal) return true;
    return false;
  } catch {
    return false;
  }
}

function getConfiguredUrl() {
  if (process.env.LIFE_OS_URL && isValidWorkspaceUrl(process.env.LIFE_OS_URL)) {
    return process.env.LIFE_OS_URL;
  }
  const cfg = readJson(CONFIG_PATH(), {});
  return typeof cfg.url === 'string' && isValidWorkspaceUrl(cfg.url) ? cfg.url.trim() : null;
}

function isMainWindowTrustedOrigin() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  try {
    const curUrl = mainWindow.webContents.getURL();
    if (!curUrl || curUrl.startsWith('file://')) return false;
    return isValidWorkspaceUrl(curUrl);
  } catch {
    return false;
  }
}

function matchesHostDomain(hostname, domain) {
  const h = String(hostname || '').toLowerCase();
  const d = String(domain || '').toLowerCase();
  return h === d || h.endsWith(`.${d}`);
}

function isSameAppOrAuthOrigin(targetUrl, appUrl) {
  try {
    const t = new URL(targetUrl);
    if (t.protocol !== 'http:' && t.protocol !== 'https:') return false;
    if (appUrl) {
      const a = new URL(appUrl);
      if (t.origin === a.origin) return true;
    }
    return (
      matchesHostDomain(t.hostname, 'google.com') ||
      matchesHostDomain(t.hostname, 'firebaseapp.com') ||
      matchesHostDomain(t.hostname, 'googleapis.com') ||
      matchesHostDomain(t.hostname, 'gstatic.com')
    );
  } catch {
    return false;
  }
}

function safeOpenExternal(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      void shell.openExternal(parsed.href);
    }
  } catch {}
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
    isBlinking: currentBubbleWorkState.isBlinking,
    blinkMuted: currentBubbleWorkState.blinkMuted,
    blinkPaused: currentBubbleWorkState.blinkPaused,
    workTone: currentBubbleWorkState.workTone,
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
      sandbox: true,
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
  const soundEnabled = getAlertSoundEnabled();
  const getCachedFallback = () => {
    const cached = readJson(LAST_SNAPSHOT_PATH(), null);
    if (cached && cached.ready) {
      return { ...cached, soundEnabled, cachedOffline: true };
    }
    return { ready: false, theme: 'light', soundEnabled, upNext: [], summary: 'Workspace loading' };
  };

  if (!mainWindow || mainWindow.isDestroyed() || !isMainWindowTrustedOrigin()) {
    return getCachedFallback();
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
          let completedStepKeys = [];
          try {
            const prog = rawProgress ? JSON.parse(rawProgress) : null;
            if (prog && prog.date === todayStr) {
              if (Array.isArray(prog.completedBlockIds)) completedBlockIds = prog.completedBlockIds;
              if (Array.isArray(prog.completedStepKeys)) completedStepKeys = prog.completedStepKeys;
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
          const rawEvents = localStorage.getItem('life_os_calendar_events_v1');
          const calEvents = Array.isArray(rawEvents ? JSON.parse(rawEvents) : null) ? JSON.parse(rawEvents) : [];
          const rawInbox = localStorage.getItem('life_os_inbox_v1');
          const inboxItems = Array.isArray(rawInbox ? JSON.parse(rawInbox) : null) ? JSON.parse(rawInbox) : [];
          const rawDocs = localStorage.getItem('life_os_knowledge_docs_v1');
          const docs = Array.isArray(rawDocs ? JSON.parse(rawDocs) : null) ? JSON.parse(rawDocs) : [];
          const rawMilestones = localStorage.getItem('life_os_milestones_v1');
          const milestones = Array.isArray(rawMilestones ? JSON.parse(rawMilestones) : null) ? JSON.parse(rawMilestones) : [];
          const rawProjects = localStorage.getItem('life_os_projects_v1');
          const projects = Array.isArray(rawProjects ? JSON.parse(rawProjects) : null) ? JSON.parse(rawProjects) : [];

          let dismissedIds = new Set();
          try {
            const rawDis = localStorage.getItem('life_os_dismissed_reminders_v1');
            const parsedDis = rawDis ? JSON.parse(rawDis) : [];
            if (Array.isArray(parsedDis)) dismissedIds = new Set(parsedDis);
          } catch {}

          let snoozedMap = {};
          try {
            const rawSnooze = localStorage.getItem('life_os_snoozed_reminders_v1');
            if (rawSnooze) snoozedMap = JSON.parse(rawSnooze) || {};
          } catch {}
          const nowIso = d.toISOString();

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
            const rawSteps = Array.isArray(activeBlock.steps) ? activeBlock.steps : [];
            const stepsDone = rawSteps.filter((_, i) => completedStepKeys.includes(activeBlock.id + ':' + i)).length;
            primary = {
              kind: 'routine',
              id: activeBlock.id,
              badge: minsLeft ? 'WORK · ' + minsLeft + 'M LEFT' : 'ACTIVE BLOCK',
              tone: 'work',
              prompt: minsLeft ? 'Active block · ' + minsLeft + 'm remaining' : 'Active routine block in progress',
              title: activeBlock.title,
              meta: [
                activeBlock.timeRange || 'Now',
                rawSteps.length ? stepsDone + '/' + rawSteps.length + ' steps' : null,
              ].filter(Boolean).join(' · '),
            };
            alertCandidate = {
              alertKey: 'routine:' + activeBlock.id + ':' + todayStr,
              badge: minsLeft ? 'WORK · ' + minsLeft + 'M LEFT' : 'WORK TIME',
              tone: 'work',
              headline: 'Work time is in progress',
              sub: activeBlock.title + (activeBlock.timeRange ? ' (' + activeBlock.timeRange + ')' : ''),
            };
          } else if (activeSchedBlock) {
            const startsIn = activeSchedBlock.startMin - nowMin;
            const minsLeft = Math.max(1, activeSchedBlock.endMin - nowMin);
            alertCandidate = {
              alertKey: 'sched:' + activeSchedBlock.id + ':' + todayStr,
              badge: startsIn > 0 ? 'IN ' + startsIn + 'M' : 'WORK · ' + minsLeft + 'M LEFT',
              tone: 'work',
              headline: startsIn > 0 ? 'Scheduled focus starting soon' : 'Scheduled focus block in progress',
              sub: activeSchedBlock.title + ' (' + activeSchedBlock.startTime + ' – ' + activeSchedBlock.endTime + ')',
            };
          } else if (sortedTasks.length > 0) {
            const top = sortedTasks[0];
            const isOverdue = Boolean(top.dueDate && top.dueDate < todayStr);
            const isToday = Boolean(top.dueDate && top.dueDate === todayStr);
            const isMain = Boolean(todayPlan && todayPlan.mainFocusTaskId === top.id);
            const topSubs = Array.isArray(top.subtasks) ? top.subtasks.filter((s) => s && s.title) : [];
            const topSubsDone = topSubs.filter((s) => s.completed).length;
            primary = {
              kind: 'task',
              id: top.id,
              badge: isOverdue ? 'OVERDUE' : isMain ? 'MAIN FOCUS' : isToday ? 'DUE TODAY' : 'QUEUED',
              tone: isOverdue || top.priority === 'urgent' ? 'urgent' : isMain || isToday ? 'work' : 'neutral',
              prompt: isOverdue
                ? 'Past due — immediate attention'
                : isMain
                ? 'Primary daily focus'
                : isToday
                ? 'Scheduled deadline today'
                : 'Next priority task',
              title: top.title,
              meta: [
                top.estimatedDuration ? top.estimatedDuration + 'm' : null,
                isOverdue ? 'Due ' + top.dueDate : isToday ? 'Due today' : top.priority ? String(top.priority).toUpperCase() : null,
                topSubs.length > 0 ? topSubsDone + '/' + topSubs.length + ' subtasks' : null,
              ].filter(Boolean).join(' · '),
            };
          } else if (nextBlock) {
            primary = {
              kind: 'routine',
              id: nextBlock.id,
              badge: 'UP NEXT',
              tone: 'work',
              prompt: 'Upcoming daily routine block',
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

          const taskItems = sortedTasks.slice(0, 12).map((t) => {
            const subs = Array.isArray(t.subtasks)
              ? t.subtasks
                  .filter((s) => s && s.id && s.title)
                  .map((s) => ({
                    id: String(s.id),
                    title: String(s.title),
                    completed: Boolean(s.completed),
                  }))
              : [];
            const subsDone = subs.filter((s) => s.completed).length;
            return {
              kind: 'task',
              id: t.id,
              title: t.title,
              subtasks: subs,
              meta: [
                t.estimatedDuration ? t.estimatedDuration + 'm' : null,
                t.dueDate === todayStr ? 'Due today' : t.dueDate && t.dueDate < todayStr ? 'Overdue (' + t.dueDate + ')' : t.priority ? String(t.priority).toUpperCase() : null,
                subs.length > 0 ? subsDone + '/' + subs.length + ' subtasks' : null,
              ].filter(Boolean).join(' · ') || 'Task',
            };
          });

          const routineItems = blocks.map((b) => {
            const isDone = completedBlockIds.includes(b.id);
            const isNow = !isDone && typeof b.startMinute === 'number' && typeof b.endMinute === 'number' && nowMin >= b.startMinute && nowMin < b.endMinute;
            const rawSteps = Array.isArray(b.steps) ? b.steps : [];
            const steps = rawSteps
              .map((label, idx) => ({
                idx,
                title: String(label || '').trim(),
                completed: isDone || completedStepKeys.includes(b.id + ':' + idx),
              }))
              .filter((st) => st.title.length > 0);
            const stepDoneCount = steps.filter((st) => st.completed).length;
            return {
              kind: 'routine',
              id: b.id,
              isDone,
              badge: isNow ? 'NOW' : null,
              tone: isNow ? 'work' : 'neutral',
              title: b.title,
              steps,
              meta: (b.timeRange || 'Today') + (steps.length > 0 ? ' · ' + stepDoneCount + '/' + steps.length + ' steps' : ''),
              href: '/routine',
            };
          });

          const reminderItems = [];
          const pushReminder = (item) => {
            if (!item || !item.id) return;
            if (dismissedIds.has(item.id)) return;
            const snUntil = snoozedMap[item.id];
            if (snUntil && snUntil > nowIso) return;
            reminderItems.push(item);
          };

          if (activeBlock) {
            pushReminder({
              kind: 'reminder',
              id: 'routine-active-' + activeBlock.id,
              badge: 'ROUTINE',
              tone: 'work',
              title: activeBlock.title,
              meta: 'Active now (' + (activeBlock.timeRange || 'Today') + ')',
              href: '/routine',
            });
          } else if (nextBlock) {
            pushReminder({
              kind: 'reminder',
              id: 'routine-next-' + nextBlock.id,
              badge: 'ROUTINE',
              tone: 'work',
              title: nextBlock.title,
              meta: 'Up next · ' + (nextBlock.timeRange || 'Today'),
              href: '/routine',
            });
          }

          sortedTasks.forEach((t) => {
            if (t.dueDate && t.dueDate < todayStr) {
              pushReminder({
                kind: 'reminder',
                id: 'task-overdue-' + t.id,
                badge: 'OVERDUE',
                tone: 'urgent',
                title: t.title,
                meta: 'Was due ' + t.dueDate,
                href: '/tasks',
              });
            } else if (t.dueDate && t.dueDate === todayStr) {
              pushReminder({
                kind: 'reminder',
                id: 'task-due-' + t.id,
                badge: 'DUE TODAY',
                tone: 'work',
                title: t.title,
                meta: t.estimatedDuration ? t.estimatedDuration + 'm · Due today' : 'Due today',
                href: '/tasks',
              });
            }
          });

          schedBlocks.forEach((sb) => {
            if (sb && sb.id && sb.date === todayStr) {
              pushReminder({
                kind: 'reminder',
                id: 'sched-' + sb.id,
                badge: 'FOCUS',
                tone: 'work',
                title: sb.taskTitle || sb.title || 'Scheduled block',
                meta: sb.startTime + ' – ' + sb.endTime,
                href: '/calendar',
              });
            }
          });

          calEvents.forEach((ev) => {
            if (ev && ev.id && ev.date === todayStr) {
              pushReminder({
                kind: 'reminder',
                id: 'event-' + ev.id,
                badge: 'EVENT',
                tone: 'neutral',
                title: ev.title || 'Calendar event',
                meta: ev.startTime || 'Today',
                href: '/calendar',
              });
            }
          });

          milestones.forEach((m) => {
            if (m && m.id && m.status !== 'completed' && m.targetDate && m.targetDate <= todayStr) {
              pushReminder({
                kind: 'reminder',
                id: 'milestone-' + m.id,
                badge: 'DEADLINE',
                tone: 'urgent',
                title: m.title,
                meta: 'Milestone · ' + m.targetDate,
                href: '/milestones',
              });
            }
          });

          projects.forEach((p) => {
            if (p && p.id && p.status !== 'completed' && p.dueDate && p.dueDate <= todayStr) {
              pushReminder({
                kind: 'reminder',
                id: 'project-' + p.id,
                badge: 'DEADLINE',
                tone: 'urgent',
                title: p.title,
                meta: 'Project · ' + p.dueDate,
                href: '/projects',
              });
            }
          });

          inboxItems.forEach((item) => {
            if (item && item.id && item.status !== 'converted' && (item.itemType === 'reminder' || item.reminderTime)) {
              pushReminder({
                kind: 'reminder',
                id: 'inbox-rem-' + item.id,
                badge: 'IDEA',
                tone: 'neutral',
                title: item.content,
                meta: item.reminderTime || 'Idea Parking reminder',
                href: '/inbox',
              });
            }
          });

          docs.forEach((docItem) => {
            if (docItem && docItem.id && docItem.status === 'active' && docItem.isReminder) {
              pushReminder({
                kind: 'reminder',
                id: 'doc-rem-' + docItem.id,
                badge: 'BOOK',
                tone: 'neutral',
                title: docItem.title || 'Book reminder',
                meta: docItem.preferredReadingTime || 'Reading reminder',
                href: '/knowledge',
              });
            }
          });

          const routineTotal = blocks.length;
          const routineDone = blocks.filter((b) => completedBlockIds.includes(b.id)).length;
          const parts = [];
          parts.push(pendingTasks.length + ' task' + (pendingTasks.length === 1 ? '' : 's'));
          parts.push(routineDone + '/' + routineTotal + ' routine');
          if (reminderItems.length > 0) parts.push(reminderItems.length + ' alert' + (reminderItems.length === 1 ? '' : 's'));

          let startupCandidate = alertCandidate;
          if (!startupCandidate && (sortedTasks.length > 0 || reminderItems.length > 0 || nextBlock)) {
            startupCandidate = {
              alertKey: 'startup:' + todayStr,
              badge: reminderItems.length > 0 ? reminderItems.length + ' ALERTS' : nextBlock ? 'UP NEXT' : 'TODAY',
              tone: sortedTasks.some((t) => (t.dueDate && t.dueDate < todayStr) || t.priority === 'urgent') ? 'urgent' : 'work',
              headline: nextBlock
                ? 'Up next: ' + nextBlock.title
                : sortedTasks[0]
                ? sortedTasks[0].title
                : reminderItems[0]
                ? reminderItems[0].title
                : 'Daily plan ready',
              sub: parts.join(' · '),
            };
          }

          const workItemKeys = [];
          sortedTasks.forEach((t) => workItemKeys.push('t:' + t.id));
          if (activeBlock) workItemKeys.push('r-active:' + activeBlock.id);
          blocks.forEach((b) => {
            if (b && b.id && !completedBlockIds.includes(b.id)) {
              workItemKeys.push('r:' + b.id);
            }
          });
          reminderItems.forEach((rem) => {
            if (rem && rem.id) workItemKeys.push('rem:' + rem.id);
          });
          const hasUrgentWork = Boolean(
            sortedTasks.some((t) => (t.dueDate && t.dueDate < todayStr) || t.priority === 'urgent') ||
            reminderItems.some((rem) => rem && rem.tone === 'urgent')
          );

          return {
            ready: true,
            theme,
            primary,
            upNext,
            taskItems,
            routineItems,
            reminderItems,
            routineSummary: { done: routineDone, total: routineTotal },
            alertCandidate,
            startupCandidate,
            workItemKeys,
            hasUrgentWork,
            hasWork: Boolean(primary || reminderItems.length > 0),
            summary: parts.join(' · '),
          };
        } catch {
          return { ready: false, theme: 'light', upNext: [], summary: 'Workspace loading' };
        }
      })()
    `);

    const enriched = snap && typeof snap === 'object' ? { ...snap, soundEnabled } : snap;
    if (enriched && enriched.ready) {
      writeJson(LAST_SNAPSHOT_PATH(), {
        ready: true,
        theme: enriched.theme,
        primary: enriched.primary,
        upNext: enriched.upNext,
        taskItems: enriched.taskItems,
        routineItems: enriched.routineItems,
        reminderItems: enriched.reminderItems,
        routineSummary: enriched.routineSummary,
        alertCandidate: enriched.alertCandidate,
        startupCandidate: enriched.startupCandidate,
        workItemKeys: enriched.workItemKeys,
        hasUrgentWork: enriched.hasUrgentWork,
        hasWork: enriched.hasWork,
        summary: enriched.summary,
      });
    } else if (enriched && !enriched.needsAuth) {
      const cached = readJson(LAST_SNAPSHOT_PATH(), null);
      if (cached && cached.ready) {
        syncBubbleWorkFromSnapshot(cached);
        return {
          ...cached,
          soundEnabled,
          edgeBlinkEnabled: getEdgeBlinkEnabled(),
          isBlinking: currentBubbleWorkState.isBlinking,
          blinkMuted: currentBubbleWorkState.blinkMuted,
          blinkPaused: currentBubbleWorkState.blinkPaused,
          workTone: currentBubbleWorkState.workTone,
          cachedOffline: true,
        };
      }
    }
    syncBubbleWorkFromSnapshot(enriched);
    return enriched && typeof enriched === 'object'
      ? {
          ...enriched,
          edgeBlinkEnabled: getEdgeBlinkEnabled(),
          isBlinking: currentBubbleWorkState.isBlinking,
          blinkMuted: currentBubbleWorkState.blinkMuted,
          blinkPaused: currentBubbleWorkState.blinkPaused,
          workTone: currentBubbleWorkState.workTone,
        }
      : enriched;
  } catch {
    return getCachedFallback();
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

function positionPopoverNextToBubble() {
  if (!popoverWindow || popoverWindow.isDestroyed()) return;
  const bubbleBounds = bubbleWindow && !bubbleWindow.isDestroyed()
    ? bubbleWindow.getBounds()
    : { x: 0, y: 200, width: 32, height: 84 };
  const display = screen.getDisplayNearestPoint({ x: bubbleBounds.x, y: bubbleBounds.y });
  const wa = display.workArea;
  const width = 364;
  const height = Math.max(420, Math.min(680, wa.height - 24));
  const gap = 8;
  const bubbleCenterX = bubbleBounds.x + bubbleBounds.width / 2;
  const screenCenterX = wa.x + wa.width / 2;

  let targetX = bubbleCenterX < screenCenterX
    ? bubbleBounds.x + bubbleBounds.width + gap
    : bubbleBounds.x - width - gap;
  targetX = Math.max(wa.x + 8, Math.min(targetX, wa.x + wa.width - width - 8));

  const targetY = Math.max(
    wa.y + 12,
    Math.min(
      Math.round(wa.y + (wa.height - height) / 2),
      wa.y + wa.height - height - 12
    )
  );

  popoverWindow.setBounds({ x: Math.round(targetX), y: Math.round(targetY), width, height });
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
      sandbox: true,
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
  const deliver = () => {
    if (toastWindow && !toastWindow.isDestroyed()) {
      toastWindow.webContents.send('toast:show', {
        ...payload,
        soundEnabled: payload.soundEnabled !== false && getAlertSoundEnabled(),
      });
    }
  };
  if (toastWindow.webContents.isLoading()) {
    toastWindow.webContents.once('did-finish-load', deliver);
  } else {
    deliver();
  }
  scheduleToastAutoHide();
}

async function evaluateAndNotifyAlerts(force = false, options = {}) {
  const snap = await readWorkspaceSnapshot();
  if (!snap || !snap.ready) return;

  const allowStartupBriefing = Boolean(options.allowStartupBriefing || force);
  let candidate = snap.alertCandidate;
  if (!candidate && allowStartupBriefing && !startupBriefingDone && snap.startupCandidate) {
    candidate = snap.startupCandidate;
  }
  if (!candidate && force && snap.startupCandidate) {
    candidate = snap.startupCandidate;
  }

  if (snap.ready && !startupBriefingDone && options.allowStartupBriefing) {
    startupBriefingDone = true;
  }

  if (!candidate) {
    if (force) {
      showOutsideToast({
        alertKey: 'manual:clear:' + Date.now(),
        badge: 'ALL CLEAR',
        tone: 'neutral',
        headline: 'You are caught up right now',
        sub: snap.summary || 'No urgent deadlines or active blocks.',
        theme: snap.theme,
        soundEnabled: snap.soundEnabled,
        ring: true,
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

  showOutsideToast({ ...candidate, theme: snap.theme, soundEnabled: snap.soundEnabled, ring: true });
}

function createPopoverWindow() {
  popoverWindow = new BrowserWindow({
    width: 364,
    height: 620,
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
      sandbox: true,
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
  positionPopoverNextToBubble();
  lastPopoverShownAt = Date.now();
  popoverWindow.show();
  popoverWindow.focus();
  const sendOpened = () => {
    if (popoverWindow && !popoverWindow.isDestroyed()) {
      popoverWindow.webContents.send('popover:snapshot', snap);
      popoverWindow.webContents.send('popover:opened', snap);
    }
  };
  if (popoverWindow.webContents.isLoading()) {
    popoverWindow.webContents.once('did-finish-load', sendOpened);
  } else {
    sendOpened();
  }
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
    ...(currentBubbleWorkState.isBlinking
      ? [
          {
            label: 'Stop Edge Blinking Now',
            click: () => stopEdgeBlink(),
          },
        ]
      : currentBubbleWorkState.hasWork && currentBubbleWorkState.blinkPaused && getEdgeBlinkEnabled()
      ? [
          {
            label: 'Resume Edge Blinking',
            click: () => resumeEdgeBlink(),
          },
        ]
      : []),
    {
      label: 'Mute Edge Line Blinking',
      type: 'checkbox',
      checked: !getEdgeBlinkEnabled(),
      click: (item) => {
        setEdgeBlinkEnabled(!item.checked);
      },
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
function createWindow(options = {}) {
  const savedBounds = readJson(BOUNDS_PATH(), { width: 1360, height: 860 });

  mainWindow = new BrowserWindow({
    width: savedBounds.width || 1360,
    height: savedBounds.height || 860,
    x: typeof savedBounds.x === 'number' ? savedBounds.x : undefined,
    y: typeof savedBounds.y === 'number' ? savedBounds.y : undefined,
    minWidth: 420,
    minHeight: 560,
    show: !options.hidden,
    title: 'Sariling Mundo',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (savedBounds.isMaximized && !options.hidden) {
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
    safeOpenExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl.startsWith('file://') && targetUrl.endsWith('setup.html')) return;
    const activeUrl = getConfiguredUrl() || mainWindow.webContents.getURL();
    if (isSameAppOrAuthOrigin(targetUrl, activeUrl)) return;
    event.preventDefault();
    safeOpenExternal(targetUrl);
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
      label: 'Check & Ring Reminders Now',
      click: () => { void evaluateAndNotifyAlerts(true, { allowStartupBriefing: true }); },
    },
    ...(currentBubbleWorkState.isBlinking
      ? [
          {
            label: 'Stop Edge Line Blinking',
            click: () => stopEdgeBlink(),
          },
        ]
      : currentBubbleWorkState.hasWork && currentBubbleWorkState.blinkPaused && getEdgeBlinkEnabled()
      ? [
          {
            label: 'Resume Edge Line Blinking',
            click: () => resumeEdgeBlink(),
          },
        ]
      : []),
    {
      label: 'Blink Edge Line for Tasks/Routine',
      type: 'checkbox',
      checked: getEdgeBlinkEnabled(),
      click: (item) => {
        setEdgeBlinkEnabled(item.checked);
      },
    },
    {
      label: 'Ring Alert Sounds',
      type: 'checkbox',
      checked: getAlertSoundEnabled(),
      click: (item) => {
        setAlertSoundEnabled(item.checked);
      },
    },
    {
      label: 'Launch at Windows Startup',
      type: 'checkbox',
      checked: openAtLogin,
      click: (item) => {
        setStartupLaunchEnabled(item.checked);
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
    ensureDefaultAutoStart();

    ipcMain.handle('desktop:get-url', () => getConfiguredUrl() || '');
    ipcMain.handle('desktop:save-url', (_event, rawUrl) => {
      const cleaned = String(rawUrl || '').trim();
      if (!isValidWorkspaceUrl(cleaned)) {
        throw new Error('URL must use https:// (or http://localhost for local development)');
      }
      writeJson(CONFIG_PATH(), { ...readJson(CONFIG_PATH(), {}), url: cleaned });
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(cleaned);
      return cleaned;
    });

    ipcMain.on('desktop:workspace-ready', () => {
      void refreshPopover();
      if (!startupBriefingDone) {
        setTimeout(() => {
          void evaluateAndNotifyAlerts(false, { allowStartupBriefing: true });
        }, 650);
      }
    });

    ipcMain.handle('desktop:get-companion-config', () => ({
      openAtLogin: Boolean(app.getLoginItemSettings().openAtLogin),
      soundEnabled: getAlertSoundEnabled(),
      edgeBlinkEnabled: getEdgeBlinkEnabled(),
      isBlinking: currentBubbleWorkState.isBlinking,
      blinkPaused: currentBubbleWorkState.blinkPaused,
    }));

    ipcMain.handle('desktop:set-startup', (_event, enabled) => ({
      openAtLogin: setStartupLaunchEnabled(enabled),
      soundEnabled: getAlertSoundEnabled(),
      edgeBlinkEnabled: getEdgeBlinkEnabled(),
      isBlinking: currentBubbleWorkState.isBlinking,
      blinkPaused: currentBubbleWorkState.blinkPaused,
    }));

    ipcMain.handle('desktop:set-sound', (_event, enabled) => ({
      openAtLogin: Boolean(app.getLoginItemSettings().openAtLogin),
      soundEnabled: setAlertSoundEnabled(enabled),
      edgeBlinkEnabled: getEdgeBlinkEnabled(),
      isBlinking: currentBubbleWorkState.isBlinking,
      blinkPaused: currentBubbleWorkState.blinkPaused,
    }));

    ipcMain.handle('desktop:set-edge-blink', (_event, enabled) => ({
      openAtLogin: Boolean(app.getLoginItemSettings().openAtLogin),
      soundEnabled: getAlertSoundEnabled(),
      edgeBlinkEnabled: setEdgeBlinkEnabled(enabled),
      isBlinking: currentBubbleWorkState.isBlinking,
      blinkPaused: currentBubbleWorkState.blinkPaused,
    }));

    ipcMain.handle('desktop:stop-edge-blink', () => {
      stopEdgeBlink();
      return {
        openAtLogin: Boolean(app.getLoginItemSettings().openAtLogin),
        soundEnabled: getAlertSoundEnabled(),
        edgeBlinkEnabled: getEdgeBlinkEnabled(),
        isBlinking: currentBubbleWorkState.isBlinking,
        blinkPaused: currentBubbleWorkState.blinkPaused,
      };
    });

    ipcMain.handle('desktop:test-ring', async () => {
      hidePopover();
      await evaluateAndNotifyAlerts(true, { allowStartupBriefing: true });
      return { ok: true };
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
        isBlinking: currentBubbleWorkState.isBlinking,
        blinkMuted: currentBubbleWorkState.blinkMuted,
        blinkPaused: currentBubbleWorkState.blinkPaused,
        workTone: currentBubbleWorkState.workTone,
        pillText: currentBubbleWorkState.pillText,
      };
    });

    ipcMain.handle('bubble:stop-blink', () => stopEdgeBlink());
    ipcMain.handle('bubble:set-blink-enabled', (_event, enabled) => ({
      edgeBlinkEnabled: setEdgeBlinkEnabled(enabled),
      ...currentBubbleWorkState,
    }));

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
      let ok = false;
      if (mainWindow && !mainWindow.isDestroyed() && isMainWindowTrustedOrigin() && taskId) {
        const safeId = JSON.stringify(String(taskId));
        ok = await mainWindow.webContents.executeJavaScript(`
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
      return { ok: Boolean(ok), completed: Boolean(ok) };
    });

    ipcMain.handle('popover:toggle-subtask', async (_event, taskId, subtaskId) => {
      let result = { ok: false, completed: false, allDone: false };
      if (mainWindow && !mainWindow.isDestroyed() && isMainWindowTrustedOrigin() && taskId && subtaskId) {
        const safeTaskId = JSON.stringify(String(taskId));
        const safeSubId = JSON.stringify(String(subtaskId));
        result = await mainWindow.webContents.executeJavaScript(`
          (() => {
            try {
              const raw = localStorage.getItem('life_os_tasks_v1');
              const list = raw ? JSON.parse(raw) : [];
              if (!Array.isArray(list)) return { ok: false, completed: false, allDone: false };
              const now = new Date().toISOString();
              let subDone = false;
              let parentDone = false;
              const next = list.map((t) => {
                if (!t || t.id !== ${safeTaskId} || !Array.isArray(t.subtasks)) return t;
                const subs = t.subtasks.map((s) => {
                  if (!s || s.id !== ${safeSubId}) return s;
                  subDone = !Boolean(s.completed);
                  return { ...s, completed: subDone };
                });
                const allDone = subs.length > 0 && subs.every((s) => Boolean(s && s.completed));
                parentDone = allDone;
                const nextStatus = allDone ? 'done' : t.status === 'done' ? 'doing' : t.status;
                return {
                  ...t,
                  subtasks: subs,
                  status: nextStatus,
                  completedAt: allDone ? now : undefined,
                  updatedAt: now,
                };
              });
              localStorage.setItem('life_os_tasks_v1', JSON.stringify(next));
              window.dispatchEvent(new CustomEvent('life_os_cloud_synced'));
              return { ok: true, completed: subDone, allDone: parentDone };
            } catch {
              return { ok: false, completed: false, allDone: false };
            }
          })()
        `);
      }
      await refreshPopover();
      return result;
    });

    ipcMain.handle('popover:toggle-routine-block', async (_event, blockId) => {
      let result = { ok: false, isDone: false };
      if (mainWindow && !mainWindow.isDestroyed() && isMainWindowTrustedOrigin() && blockId) {
        const safeId = JSON.stringify(String(blockId));
        result = await mainWindow.webContents.executeJavaScript(`
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
              const curIds = Array.isArray(prog.completedBlockIds) ? prog.completedBlockIds : [];
              const wasDone = curIds.includes(${safeId});
              const nextIds = wasDone ? curIds.filter((id) => id !== ${safeId}) : Array.from(new Set([...curIds, ${safeId}]));
              let stepKeys = Array.isArray(prog.completedStepKeys) ? [...prog.completedStepKeys] : [];
              if (wasDone) {
                stepKeys = stepKeys.filter((k) => !String(k).startsWith(${safeId} + ':'));
              } else if (block && Array.isArray(block.steps)) {
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
              return { ok: true, isDone: !wasDone };
            } catch {
              return { ok: false, isDone: false };
            }
          })()
        `);
      }
      await refreshPopover();
      return result;
    });

    ipcMain.handle('popover:toggle-routine-step', async (_event, blockId, stepIdx) => {
      let result = { ok: false, stepDone: false, blockCompleted: false };
      if (mainWindow && !mainWindow.isDestroyed() && isMainWindowTrustedOrigin() && blockId && Number.isInteger(Number(stepIdx))) {
        const safeId = JSON.stringify(String(blockId));
        const safeIdx = Number(stepIdx);
        result = await mainWindow.webContents.executeJavaScript(`
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
              const curIds = Array.isArray(prog.completedBlockIds) ? prog.completedBlockIds : [];
              const curKeys = Array.isArray(prog.completedStepKeys) ? prog.completedStepKeys : [];
              const stepKey = ${safeId} + ':' + ${safeIdx};
              const wasStepDone = curKeys.includes(stepKey);
              const nextStepKeys = wasStepDone
                ? curKeys.filter((k) => k !== stepKey)
                : [...curKeys, stepKey];
              const stepDone = !wasStepDone;
              const blockSteps = block && Array.isArray(block.steps) ? block.steps : [];
              const allStepsDone = blockSteps.length > 0 && blockSteps.every((_, i) => nextStepKeys.includes(${safeId} + ':' + i));
              let nextBlockIds = curIds;
              let blockCompleted = false;
              if (allStepsDone && !nextBlockIds.includes(${safeId})) {
                nextBlockIds = [...nextBlockIds, ${safeId}];
                blockCompleted = true;
              } else if (!allStepsDone && nextBlockIds.includes(${safeId})) {
                nextBlockIds = nextBlockIds.filter((id) => id !== ${safeId});
              }
              localStorage.setItem('life_os_daily_routine_progress_v1', JSON.stringify({
                date: todayStr,
                completedBlockIds: nextBlockIds,
                completedStepKeys: nextStepKeys,
              }));
              window.dispatchEvent(new Event('life_os_daily_routine_reminder_updated'));
              window.dispatchEvent(new CustomEvent('life_os_cloud_synced'));
              return { ok: true, stepDone, blockCompleted };
            } catch {
              return { ok: false, stepDone: false, blockCompleted: false };
            }
          })()
        `);
      }
      await refreshPopover();
      return result;
    });

    ipcMain.handle('popover:dismiss-reminder', async (_event, reminderId) => {
      if (mainWindow && !mainWindow.isDestroyed() && isMainWindowTrustedOrigin() && reminderId) {
        const safeId = JSON.stringify(String(reminderId));
        await mainWindow.webContents.executeJavaScript(`
          (() => {
            try {
              const raw = localStorage.getItem('life_os_dismissed_reminders_v1');
              const list = raw ? JSON.parse(raw) : [];
              const arr = Array.isArray(list) ? list : [];
              if (!arr.includes(${safeId})) arr.push(${safeId});
              localStorage.setItem('life_os_dismissed_reminders_v1', JSON.stringify(arr));
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

    ipcMain.handle('popover:add-task', async (_event, rawTitle) => {
      const cleanTitle = String(rawTitle || '').trim();
      if (mainWindow && !mainWindow.isDestroyed() && isMainWindowTrustedOrigin() && cleanTitle) {
        const safeTitle = JSON.stringify(cleanTitle);
        await mainWindow.webContents.executeJavaScript(`
          (() => {
            try {
              const raw = localStorage.getItem('life_os_tasks_v1');
              const list = raw ? JSON.parse(raw) : [];
              const arr = Array.isArray(list) ? list : [];
              const d = new Date();
              const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
              const now = d.toISOString();
              const newTask = {
                id: 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                title: ${safeTitle},
                status: 'todo',
                priority: 'high',
                dueDate: todayStr,
                estimatedDuration: 25,
                tags: [],
                subtasks: [],
                createdAt: now,
                updatedAt: now,
              };
              localStorage.setItem('life_os_tasks_v1', JSON.stringify([newTask, ...arr]));
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

    ipcMain.on('popover:close', () => {
      hidePopover();
    });

    ipcMain.handle('popover:set-sound', (_event, enabled) => {
      const soundEnabled = setAlertSoundEnabled(enabled);
      return { soundEnabled };
    });

    ipcMain.handle('popover:set-blink-enabled', (_event, enabled) => {
      const edgeBlinkEnabled = setEdgeBlinkEnabled(enabled);
      return {
        edgeBlinkEnabled,
        isBlinking: currentBubbleWorkState.isBlinking,
        blinkMuted: currentBubbleWorkState.blinkMuted,
        blinkPaused: currentBubbleWorkState.blinkPaused,
      };
    });

    ipcMain.handle('popover:stop-blink', () => stopEdgeBlink());
    ipcMain.handle('popover:resume-blink', () => resumeEdgeBlink());

    ipcMain.handle('popover:ring-now', async () => {
      const snap = await readWorkspaceSnapshot();
      return {
        ok: true,
        soundEnabled: Boolean(snap && snap.soundEnabled !== false),
        tone: (snap && snap.primary && snap.primary.tone) || (snap && snap.alertCandidate && snap.alertCandidate.tone) || 'work',
        alertsCount: snap && Array.isArray(snap.reminderItems) ? snap.reminderItems.length : 0,
      };
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

    createWindow({ hidden: startedAtLogin });
    createPopoverWindow();
    createToastWindow();
    createBubbleWindow();
    createTray();
    setTimeout(() => { void evaluateAndNotifyAlerts(false, { allowStartupBriefing: true }); }, 4500);
    setTimeout(() => { void evaluateAndNotifyAlerts(false, { allowStartupBriefing: true }); }, 11000);
    setInterval(() => { void readWorkspaceSnapshot(); }, 4000);
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
