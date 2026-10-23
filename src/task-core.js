(function exposeTaskCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlowCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTaskCore() {
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, none: 3 };

  function dayKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'no-date';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function calculateReminderAt(dueAt, reminderMinutes) {
    if (!dueAt || reminderMinutes === null || reminderMinutes === undefined || reminderMinutes === 'none') return null;
    const due = new Date(dueAt).getTime();
    const minutes = Number(reminderMinutes);
    if (!Number.isFinite(due) || !Number.isFinite(minutes)) return null;
    return new Date(due - minutes * 60_000).toISOString();
  }

  function normalizeTask(task) {
    return {
      id: String(task.id),
      title: String(task.title || '').trim(),
      notes: String(task.notes || '').trim(),
      dueAt: task.dueAt || null,
      reminderAt: task.reminderAt || null,
      reminderMinutes: task.reminderMinutes ?? 'none',
      notifiedReminderAt: task.notifiedReminderAt || null,
      priority: PRIORITY_ORDER[task.priority] === undefined ? 'none' : task.priority,
      completed: Boolean(task.completed),
      createdAt: task.createdAt || new Date().toISOString(),
      completedAt: task.completedAt || null
    };
  }

  function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priority !== 0) return priority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  function filterTasks(tasks, view, query, nowValue) {
    const now = nowValue ? new Date(nowValue) : new Date();
    const today = dayKey(now);
    const needle = String(query || '').trim().toLocaleLowerCase('zh-CN');

    return sortTasks(tasks.filter((task) => {
      const matchesQuery = !needle || `${task.title} ${task.notes}`.toLocaleLowerCase('zh-CN').includes(needle);
      if (!matchesQuery) return false;
      if (view === 'completed') return task.completed;
      if (view === 'today') return !task.completed && task.dueAt && dayKey(task.dueAt) === today;
      if (view === 'upcoming') return !task.completed && task.dueAt && dayKey(task.dueAt) > today;
      return !task.completed;
    }));
  }

  function groupTasks(tasks) {
    return tasks.reduce((groups, task) => {
      const key = task.dueAt ? dayKey(task.dueAt) : 'no-date';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
      return groups;
    }, {});
  }

  return { calculateReminderAt, dayKey, filterTasks, groupTasks, normalizeTask, sortTasks };
});
