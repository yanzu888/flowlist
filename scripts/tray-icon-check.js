const { _electron: electron } = require('playwright-core');
const path = require('path');
const assert = require('node:assert/strict');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${path.join(projectRoot, 'artifacts', `tray-profile-${Date.now()}`)}`],
    cwd: projectRoot,
    env: { ...process.env, FLOWLIST_TEST: '1' }
  });

  try {
    await electronApp.firstWindow();
    const page = await electronApp.firstWindow();
    const tray = await page.evaluate(() => window.flowlist.getTrayIconStatus());
    assert.ok(tray, 'No Tray instance was created');
    assert.equal(tray.empty, false);
    assert.ok(tray.size.width >= 16 && tray.size.height >= 16);
    console.log(`Tray icon check passed: ${tray.size.width}x${tray.size.height}`);
  } finally {
    await electronApp.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
