const { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage, powerMonitor } = require('electron');
const path = require('path');
const { getNextReminderTimestamp, reminderKey, shouldFireReminder } = require('./reminder-core');

let mainWindow;
let tray;
let isQuitting = false;
const scheduledTasks = new Map();
const firedReminders = new Set();
let nextReminderTimer;
let reminderWatchdog;
let trayImage;

const MAX_TIMER_DELAY = 2_147_000_000;
const WATCHDOG_INTERVAL = 15_000;

const enforceSingleInstance = process.env.FLOWLIST_TEST !== '1';
if (enforceSingleInstance && !app.requestSingleInstanceLock()) app.quit();
if (enforceSingleInstance) app.on('second-instance', showWindow);

const traySvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="7" fill="#146c5d"/>
    <path d="M9 9.5h14M9 16h9M9 22.5h7" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
    <path d="m20 21 2 2 4-5" fill="none" stroke="#b9f1d8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
const iconPath = path.join(__dirname, '..', 'assets', 'app-icon.png');
let appIcon;

function getAppImage(size = 20) {
  if (!appIcon) appIcon = nativeImage.createFromPath(iconPath);
  if (!appIcon.isEmpty()) return appIcon.resize({ width: size, height: size });

  // Keep a data-URL fallback for development copies missing the generated PNG.
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(traySvg).toString('base64')}`;
  return nativeImage.createFromDataURL(dataUrl).resize({ width: size, height: size });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 790,
    minWidth: 840,
    minHeight: 620,
    backgroundColor: '#f5f7f6',
    icon: getAppImage(256),
    show: false,
    title: 'Flowlist',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function showWindow() {
  if (!mainWindow) createWindow();
  mainWindow.show();
  mainWindow.restore();
  mainWindow.focus();
}

function createTray() {
  trayImage = getAppImage();
  tray = new Tray(trayImage);
  tray.setToolTip('Flowlist - 待办清单');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 Flowlist', click: showWindow },
    {
      label: '新建任务',
      click: () => {
        showWindow();
        mainWindow.webContents.send('quick-add');
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on('double-click', showWindow);
}

function clearReminderTimer() {
  if (nextReminderTimer) clearTimeout(nextReminderTimer);
  nextReminderTimer = null;
}

function scheduleNextReminder() {
  clearReminderTimer();
  const nextTimestamp = getNextReminderTimestamp([...scheduledTasks.values()]);
  if (nextTimestamp === null) return;

  const delay = Math.max(0, nextTimestamp - Date.now());
  nextReminderTimer = setTimeout(() => {
    nextReminderTimer = null;
    checkDueReminders();
  }, Math.min(delay, MAX_TIMER_DELAY));
}

function fireReminder(task, key) {
  firedReminders.add(key);

  if (Notification.isSupported()) {
    try {
      const notification = new Notification({
        title: task.title,
        body: task.notes ? task.notes.slice(0, 120) : '任务时间到了',
        icon: getAppImage(256),
        silent: false,
        timeoutType: 'never'
      });
      notification.on('click', () => {
        showWindow();
        if (!task.isTest) mainWindow.webContents.send('focus-task', task.id);
      });
      notification.show();
    } catch (error) {
      console.error('Failed to show native notification:', error);
    }
  }

  // Keep the task window quiet. Clicking the Windows notification is the explicit open action.
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('reminder-fired', task);
}

function deliverPendingReminders() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  for (const task of scheduledTasks.values()) {
    const key = reminderKey(task);
    if (firedReminders.has(key) && task.notifiedReminderAt !== task.reminderAt) {
      // A page reload can happen between the native notification and the renderer listener.
      mainWindow.webContents.send('reminder-fired', task);
    }
  }
}

function syncTasks(tasks) {
  scheduledTasks.clear();
  for (const task of tasks) {
    if (!task.completed && task.reminderAt) {
      scheduledTasks.set(String(task.id), task);
    }
  }
  const activeKeys = new Set([...scheduledTasks.values()].map(reminderKey));
  for (const key of firedReminders) {
    if (!activeKeys.has(key)) firedReminders.delete(key);
  }
  deliverPendingReminders();
  checkDueReminders();
}

function checkDueReminders() {
  const now = Date.now();
  for (const task of scheduledTasks.values()) {
    const key = reminderKey(task);
    if (!firedReminders.has(key) && shouldFireReminder(task, now)) {
      fireReminder(task, key);
    }
  }
  scheduleNextReminder();
}

function startReminderWatchdog() {
  reminderWatchdog = setInterval(checkDueReminders, WATCHDOG_INTERVAL);
  powerMonitor.on('resume', () => setTimeout(checkDueReminders, 1000));
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.flowlist.desktop');
  createWindow();
  createTray();
  startReminderWatchdog();

  app.on('activate', showWindow);
});

app.on('before-quit', () => {
  isQuitting = true;
  clearReminderTimer();
  if (reminderWatchdog) clearInterval(reminderWatchdog);
});

// Keeping this listener registered prevents the app from quitting when its last window closes.
app.on('window-all-closed', () => {});

ipcMain.on('tasks:sync', (_event, tasks) => {
  if (Array.isArray(tasks)) syncTasks(tasks);
});

ipcMain.handle('notification:show', (_event, task) => {
  fireReminder(task, `${task.id}:manual:${Date.now()}`);
  return { nativeSupported: Notification.isSupported() };
});

ipcMain.handle('reminder:status', () => ({
  nativeSupported: Notification.isSupported(),
  scheduledCount: scheduledTasks.size
}));

ipcMain.handle('test:tray-icon', () => {
  return trayImage ? { empty: trayImage.isEmpty(), size: trayImage.getSize() } : null;
});
