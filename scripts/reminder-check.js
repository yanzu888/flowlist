const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const assert = require('node:assert/strict');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const profileDir = path.join(projectRoot, 'artifacts', `reminder-profile-${Date.now()}`);
  fs.mkdirSync(profileDir, { recursive: true });

  const electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${profileDir}`],
    cwd: projectRoot,
    env: { ...process.env, FLOWLIST_TEST: '1' }
  });

  try {
    const page = await electronApp.firstWindow();
    await page.waitForSelector('#quickTitle');
    const reminderAt = new Date(Date.now() + 8000).toISOString();
    await page.evaluate((timestamp) => {
      localStorage.setItem('flowlist.tasks.v1', JSON.stringify([{
        id: 'timing-check',
        title: '第一项定时提醒',
        notes: '验证托盘隐藏状态下仍会弹出提醒',
        dueAt: timestamp,
        reminderAt: timestamp,
        reminderMinutes: '0',
        notifiedReminderAt: null,
        priority: 'high',
        completed: false,
        createdAt: new Date().toISOString()
      }, {
        id: 'queue-check',
        title: '第二项队列提醒',
        notes: '验证同时到点的任务不会互相覆盖',
        dueAt: timestamp,
        reminderAt: timestamp,
        reminderMinutes: '0',
        notifiedReminderAt: null,
        priority: 'medium',
        completed: false,
        createdAt: new Date().toISOString()
      }]));
    }, reminderAt);
    await page.reload();
    await page.waitForSelector('[data-task-id="timing-check"]');
    assert.equal(await page.locator('#reminderDialog').count(), 0);

    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    assert.equal(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);

    let tasksAfterReminder = [];
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      tasksAfterReminder = JSON.parse(await page.evaluate(() => localStorage.getItem('flowlist.tasks.v1')));
      if (tasksAfterReminder.every((task) => task.notifiedReminderAt === task.reminderAt)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(tasksAfterReminder.every((task) => task.notifiedReminderAt === task.reminderAt), true);
    assert.equal(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    assert.equal(await page.locator('#reminderDialog').count(), 0);
    console.log('Timed reminder check passed: notification sent without restoring the window.');
  } finally {
    await electronApp.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
