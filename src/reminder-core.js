const DEFAULT_GRACE_MS = 24 * 60 * 60 * 1000;

function reminderKey(task) {
  return `${task.id}:${task.reminderAt}`;
}

function parseTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function shouldFireReminder(task, now = Date.now(), graceMs = DEFAULT_GRACE_MS) {
  if (!task || task.completed || !task.reminderAt) return false;
  if (task.notifiedReminderAt === task.reminderAt) return false;

  const reminderAt = parseTimestamp(task.reminderAt);
  if (reminderAt === null || reminderAt > now) return false;

  const dueAt = parseTimestamp(task.dueAt);
  const usefulUntil = (dueAt ?? reminderAt) + graceMs;
  return now <= usefulUntil;
}

function getNextReminderTimestamp(tasks, now = Date.now()) {
  let next = null;
  for (const task of tasks) {
    if (!task || task.completed || !task.reminderAt) continue;
    if (task.notifiedReminderAt === task.reminderAt) continue;
    const timestamp = parseTimestamp(task.reminderAt);
    if (timestamp === null || timestamp <= now) continue;
    if (next === null || timestamp < next) next = timestamp;
  }
  return next;
}

module.exports = {
  DEFAULT_GRACE_MS,
  getNextReminderTimestamp,
  reminderKey,
  shouldFireReminder
};
