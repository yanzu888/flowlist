# Flowlist

[简体中文](README.md) | English

**Bring clarity to your day.** Flowlist is a lightweight local to-do app for Windows and Android. It brings tasks, dates, priorities, and system reminders together to help you organize personal work and everyday activities.

The app requires no account or backend service; tasks are stored locally on your device. The current app interface is in Simplified Chinese. Bilingual documentation does not mean the app supports switching languages.

## Features

- Create, edit, complete, reopen, and delete tasks with titles, notes, dates, times, and priorities.
- The Windows interface offers Today, Upcoming, All Tasks, and Completed views, along with search, a mini calendar, and daily completion progress.
- Set reminders for the due time, 5 minutes, 15 minutes, 1 hour, or 1 day beforehand, or turn them off.
- Windows uses native notifications. When the main window is hidden, a reminder leaves it hidden; clicking the notification opens the corresponding task.
- On Windows, the app stays in the system tray, checks reminders every 15 seconds, and checks again when the computer wakes. Tasks due at the same time receive separate notifications.
- Android reuses the task interface and schedules notifications through the system `AlarmManager`, including when the app is in the background.

## Platforms and Data

| Platform | Implementation | Data storage |
| --- | --- | --- |
| Windows | Electron desktop app | localStorage in Electron's user data directory |
| Android 8.0 and later | WebView + native Java bridge | WebView local storage and SharedPreferences |

Each platform stores its data independently. There is currently no account system, cloud backup, or cross-device sync. Keep a copy of any task information you need before uninstalling the app or clearing its data.

## Run on Windows

Install Node.js and npm, then run the following in PowerShell:

```powershell
git clone https://github.com/yanzu888/flowlist.git
cd flowlist
npm install
npm start
```

Closing the main window leaves Flowlist running in the system tray. To quit completely, right-click the tray icon and select “退出” (Quit).

## How Reminders Work

New tasks default to a reminder at their due time. You can also choose an earlier reminder or disable it. The Windows app must remain running; closing its main window does not quit the app. On Android, allow notifications when you first launch the app. Actual reminder timing also depends on system permissions and battery-saving settings.

After the computer sleeps, a system delay, or an app restart, the scheduler rechecks incomplete tasks that have not yet been marked as notified. Reminders whose scheduled time has passed can be sent **until 24 hours after the task's due time**; this window is based on the task's due time. The lower-left corner of the Windows interface shows the scheduling status and a “测试提醒” (Test Reminder) button.

## Tests and Windows Packaging

Run the core logic tests and build the Windows installer:

```powershell
npm test
npm run dist
```

The installer is written to `dist/Flowlist-Setup-1.1.0.exe`.

The project also provides `test:reminder`, `test:tray`, `test:package`, and `test:visual` check scripts. Currently, `test:visual` writes demo tasks to the default desktop profile and may overwrite existing tasks. Until test data is isolated, do not run it in an environment that stores your personal tasks.

## Build the Android APK

These steps use the repository's manual Windows build script. Run `npm install` first and install JDK 17, making sure `java`, `javac`, and `jar` are available on the command line.

The toolchain uses Android SDK Platform 35, Build Tools 35.0.0, and Gradle 8.10.2. For the initial setup, place the Gradle 8.10.2 binary distribution ZIP and the Android command-line tools Windows ZIP at these respective paths:

```text
.android-cache/gradle-8.10.2-bin.zip
.android-cache/commandlinetools-win.zip
```

Then initialize the toolchain from the project root and create the installer output directory:

```powershell
npm run android:bootstrap
New-Item -ItemType Directory -Force -Path dist | Out-Null
```

The manual build reads the keystore and key password from the `FLOWLIST_ANDROID_STORE_PASSWORD` environment variable in the current PowerShell session. If `.android-cache/flowlist-debug.keystore` already exists, use its original password. When creating it for the first time, choose a password with at least 6 characters. Setting the environment variable does not change an existing keystore's password.

The following example hides password input and clears the environment variable after the build:

```powershell
$flowlistStorePassword = Read-Host 'Keystore password' -AsSecureString
try {
    $env:FLOWLIST_ANDROID_STORE_PASSWORD = [System.Net.NetworkCredential]::new('', $flowlistStorePassword).Password
    npm run android:build:manual
} finally {
    Remove-Item Env:FLOWLIST_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue
    $flowlistStorePassword.Dispose()
}
```

The APK is written to `dist/Flowlist-Android-1.1.0.apk`. The current build uses a local development signing key, suitable for personal use and internal testing. Configure and securely store a production signing key before formal distribution.

## Project Structure

```text
src/         Task UI, core logic, Electron main process, and platform bridge
android/     Android native shell, storage, and reminder scheduling
scripts/     Build, icon generation, and integration check scripts
tests/       Task and reminder core logic tests
assets/      App icons
```

The frontend uses plain HTML, CSS, JavaScript, and Lucide icons. Windows uses Electron and electron-builder; Android uses Java and system notifications.

## Current Limitations and Source Publication

- The narrow-screen Android phone layout currently hides the sidebar and has no alternative navigation for switching to All Tasks, Upcoming, or Completed views.
- System notifications depend on system permissions and settings. The “提醒正在运行” (Reminders Are Running) status in the interface does not confirm that a system notification was successfully displayed.
- `.gitignore` excludes runtime data, build artifacts, tool caches, environment configuration, and signing keys. Keep these files on your local machine.
- Before publishing screenshots, check task titles, notes, and other personal information. Windows installers and Android APKs can be distributed through [GitHub Releases](https://github.com/yanzu888/flowlist/releases).
