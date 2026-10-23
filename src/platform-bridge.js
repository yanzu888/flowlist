(() => {
  if (window.flowlist) return;

  const native = window.FlowlistAndroid || null;
  const storageKey = 'flowlist.tasks.v1';
  const listeners = {
    reminder: [],
    focus: [],
    quickAdd: []
  };
  let browserTasks = [];
  let browserTimer = null;

  function parseJson(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function emit(type, value) {
    listeners[type].forEach((callback) => callback(value));
  }

  function nativeStatus() {
    return parseJson(native.getReminderStatus(), { nativeSupported: true, scheduledCount: 0 });
  }

  function browserReminderKey(task) {
    return `${task.id}:${task.reminderAt}`;
  }

  function checkBrowserReminders() {
    const now = Date.now();
    browserTasks.forEach((task) => {
      if (!task || task.completed || !task.reminderAt || task.notifiedReminderAt === task.reminderAt) return;
      const reminderAt = new Date(task.reminderAt).getTime();
      const dueAt = task.dueAt ? new Date(task.dueAt).getTime() : reminderAt;
      if (!Number.isFinite(reminderAt) || reminderAt > now || now > dueAt + 24 * 60 * 60 * 1000) return;
      task.notifiedReminderAt = task.reminderAt;
      localStorage.setItem(storageKey, JSON.stringify(browserTasks));
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(task.title, { body: task.notes || '任务时间到了' });
      }
      emit('reminder', task);
    });
    scheduleBrowserReminderCheck();
  }

  function scheduleBrowserReminderCheck() {
    if (browserTimer) clearTimeout(browserTimer);
    const next = browserTasks
      .filter((task) => !task.completed && task.reminderAt && task.notifiedReminderAt !== task.reminderAt)
      .map((task) => new Date(task.reminderAt).getTime())
      .filter((value) => Number.isFinite(value) && value > Date.now())
      .sort((a, b) => a - b)[0];
    if (next) browserTimer = setTimeout(checkBrowserReminders, Math.min(next - Date.now(), 2_147_000_000));
  }

  const bridge = {
    platform: native ? 'android' : 'web',
    syncTasks(tasks) {
      browserTasks = Array.isArray(tasks) ? tasks : [];
      if (native) native.syncTasks(JSON.stringify(browserTasks));
      else scheduleBrowserReminderCheck();
    },
    showNotification(task) {
      if (native) return Promise.resolve(parseJson(native.showNotification(JSON.stringify(task)), { nativeSupported: true }));
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      emit('reminder', task);
      return Promise.resolve({ nativeSupported: 'Notification' in window });
    },
    getReminderStatus() {
      if (native) return Promise.resolve(nativeStatus());
      const scheduledCount = browserTasks.filter((task) => !task.completed && task.reminderAt).length;
      return Promise.resolve({ nativeSupported: 'Notification' in window, scheduledCount });
    },
    getTasks() {
      if (native) return parseJson(native.getTasks(), []);
      return browserTasks;
    },
    getTrayIconStatus: () => Promise.resolve(null),
    onReminder(callback) {
      listeners.reminder.push(callback);
    },
    onFocusTask(callback) {
      listeners.focus.push(callback);
    },
    onQuickAdd(callback) {
      listeners.quickAdd.push(callback);
    },
    _emitReminder(task) {
      emit('reminder', task);
    },
    _focusTask(taskId) {
      emit('focus', taskId);
    },
    _quickAdd() {
      emit('quickAdd');
    }
  };

  window.flowlist = bridge;
})();
