const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const assert = require('node:assert/strict');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const artifactDir = path.join(projectRoot, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });

  const electronApp = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: { ...process.env, FLOWLIST_VISUAL_TEST: '1', FLOWLIST_TEST: '1' }
  });

  try {
    const page = await electronApp.firstWindow();
    await page.waitForSelector('#quickTitle');

    await page.evaluate(() => {
      const at = (dayOffset, minuteOffset) => {
        const date = new Date();
        date.setDate(date.getDate() + dayOffset);
        date.setMinutes(date.getMinutes() + minuteOffset, 0, 0);
        return date.toISOString();
      };
      const tasks = [
        { id: 'demo-1', title: '确认发布清单', notes: '核对版本号、变更记录和回滚方案', dueAt: at(0, 60), reminderMinutes: '15', reminderAt: at(0, 45), priority: 'high', completed: false, createdAt: new Date().toISOString() },
        { id: 'demo-2', title: '回复设计评审意见', notes: '整理需要今天确认的三个问题', dueAt: at(0, 180), reminderMinutes: '15', reminderAt: at(0, 165), priority: 'medium', completed: false, createdAt: new Date().toISOString() },
        { id: 'demo-3', title: '预约下周同步会', notes: '', dueAt: at(1, 120), reminderMinutes: '60', reminderAt: at(1, 60), priority: 'low', completed: false, createdAt: new Date().toISOString() },
        { id: 'demo-4', title: '整理今日工作记录', notes: '', dueAt: at(0, -120), reminderMinutes: 'none', reminderAt: null, priority: 'none', completed: true, completedAt: new Date().toISOString(), createdAt: new Date().toISOString() }
      ];
      localStorage.setItem('flowlist.tasks.v1', JSON.stringify(tasks));
    });
    await page.reload();
    await page.waitForSelector('[data-task-id="demo-1"]');

    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(1220, 790);
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(artifactDir, 'flowlist-desktop.png') });

    assert.equal(await page.locator('[data-task-id]').count(), 2);
    assert.equal(await page.locator('#viewTitle').textContent(), '今天');
    assert.equal(await page.locator('#emptyState').isHidden(), true);
    assert.equal(await page.locator('#mobileAddButton').isHidden(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

    await page.locator('#quickTitle').fill('检查安装包');
    await page.locator('#quickTitle').press('Enter');
    await page.waitForSelector('text=检查安装包');
    assert.equal(await page.locator('[data-task-id]').count(), 3);

    await page.locator('[data-task-id="demo-1"] [data-action="edit"]').first().click();
    await page.waitForSelector('#taskDialog[open]');
    assert.equal(await page.locator('#taskTitle').inputValue(), '确认发布清单');
    await page.screenshot({ path: path.join(artifactDir, 'flowlist-edit-dialog.png') });
    await page.locator('#cancelTaskButton').click();

    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(840, 620);
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(artifactDir, 'flowlist-compact.png') });
    const compactLayout = await page.evaluate(() => ({
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      quickEntryVisible: document.querySelector('#quickEntryForm').getBoundingClientRect().width > 300,
      taskListVisible: document.querySelector('#taskList').getBoundingClientRect().height > 100
    }));
    assert.deepEqual(compactLayout, {
      noHorizontalOverflow: true,
      quickEntryVisible: true,
      taskListVisible: true
    });

    console.log('Visual checks passed:', artifactDir);
  } finally {
    await electronApp.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
