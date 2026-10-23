const { _electron: electron } = require('playwright-core');
const path = require('path');
const assert = require('node:assert/strict');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const executablePath = path.join(projectRoot, 'dist', 'win-unpacked', 'Flowlist.exe');
  const electronApp = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${path.join(projectRoot, 'artifacts', 'package-profile')}`],
    env: { ...process.env, FLOWLIST_TEST: '1' }
  });

  try {
    const page = await electronApp.firstWindow();
    await page.waitForSelector('#quickTitle');
    assert.equal(await page.title(), 'Flowlist');
    assert.equal(await page.locator('#openCreateButton').isVisible(), true);
    assert.equal(await page.evaluate(() => Boolean(window.flowlist?.syncTasks)), true);
    const trayIcon = await page.evaluate(() => window.flowlist.getTrayIconStatus());
    assert.equal(trayIcon.empty, false);
    assert.ok(trayIcon.size.width >= 16 && trayIcon.size.height >= 16);
    console.log('Packaged app smoke test passed.');
  } finally {
    await electronApp.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
