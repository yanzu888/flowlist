const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/task-core');
const reminders = require('../src/reminder-core');

test('calculates reminder time before due date', () => {
  assert.equal(
    core.calculateReminderAt('2026-08-21T10:00:00.000Z', 15),
    '2026-08-21T09:45:00.000Z'
  );
});

test('returns no reminder when reminders are disabled', () => {
  assert.equal(core.calculateReminderAt('2026-08-21T10:00:00.000Z', 'none'), null);
  assert.equal(core.calculateReminderAt(null, 15), null);
});

test('filters today tasks and excludes completed tasks', () => {
  const tasks = [
    core.normalizeTask({ id: 1, title: 'Today', dueAt: '2026-08-21T08:00:00.000Z' }),
    core.normalizeTask({ id: 2, title: 'Tomorrow', dueAt: '2026-08-22T08:00:00.000Z' }),
    core.normalizeTask({ id: 3, title: 'Done', dueAt: '2026-08-21T08:00:00.000Z', completed: true })
  ];
  const result = core.filterTasks(tasks, 'today', '', '2026-08-21T12:00:00.000Z');
  assert.deepEqual(result.map((task) => task.id), ['1']);
});

test('sorts by completion, due date, then priority', () => {
  const tasks = [
    core.normalizeTask({ id: 1, title: 'Low', dueAt: '2026-08-21T09:00:00.000Z', priority: 'low' }),
    core.normalizeTask({ id: 2, title: 'High', dueAt: '2026-08-21T09:00:00.000Z', priority: 'high' }),
    core.normalizeTask({ id: 3, title: 'Later', dueAt: '2026-08-22T09:00:00.000Z', priority: 'high' })
  ];
  assert.deepEqual(core.sortTasks(tasks).map((task) => task.id), ['2', '1', '3']);
});

test('groups undated tasks separately', () => {
  const groups = core.groupTasks([
    core.normalizeTask({ id: 1, title: 'Dated', dueAt: '2026-08-21T09:00:00.000Z' }),
    core.normalizeTask({ id: 2, title: 'Undated' })
  ]);
  assert.equal(groups['2026-08-21'].length, 1);
  assert.equal(groups['no-date'].length, 1);
});

test('fires a reminder that was missed while the computer was sleeping', () => {
  const now = new Date('2026-08-21T10:20:00.000Z').getTime();
  const task = core.normalizeTask({
    id: 1,
    title: 'Missed reminder',
    dueAt: '2026-08-21T10:30:00.000Z',
    reminderAt: '2026-08-21T10:15:00.000Z'
  });
  assert.equal(reminders.shouldFireReminder(task, now), true);
});

test('does not repeat a reminder already recorded as delivered', () => {
  const reminderAt = '2026-08-21T10:15:00.000Z';
  const task = core.normalizeTask({
    id: 1,
    title: 'Delivered reminder',
    dueAt: '2026-08-21T10:30:00.000Z',
    reminderAt,
    notifiedReminderAt: reminderAt
  });
  assert.equal(reminders.shouldFireReminder(task, new Date('2026-08-21T10:20:00.000Z').getTime()), false);
});

test('ignores reminders older than the useful overdue window', () => {
  const task = core.normalizeTask({
    id: 1,
    title: 'Old reminder',
    dueAt: '2026-08-18T10:30:00.000Z',
    reminderAt: '2026-08-18T10:15:00.000Z'
  });
  assert.equal(reminders.shouldFireReminder(task, new Date('2026-08-21T10:20:00.000Z').getTime()), false);
});

test('finds the nearest future reminder', () => {
  const tasks = [
    { id: 1, reminderAt: '2026-08-21T11:00:00.000Z' },
    { id: 2, reminderAt: '2026-08-21T10:30:00.000Z' },
    { id: 3, reminderAt: '2026-08-21T10:10:00.000Z' }
  ];
  assert.equal(
    reminders.getNextReminderTimestamp(tasks, new Date('2026-08-21T10:20:00.000Z').getTime()),
    new Date('2026-08-21T10:30:00.000Z').getTime()
  );
});
