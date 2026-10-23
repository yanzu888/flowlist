# Flowlist

Flowlist 是一款本地待办任务清单，提供 Windows 桌面版和 Android APK 版。

## 功能

- 快速新增、编辑、完成、恢复和删除任务
- 今天、即将到来、全部任务、已完成四种视图
- 日期、时间、优先级和提醒时间设置
- Windows 原生通知栏提醒，点击通知后才打开任务
- 提醒到点时保持主窗口隐藏，不打断当前工作
- 休眠、系统延迟或应用重启后补发 24 小时内错过的提醒
- 每 15 秒校验提醒状态，并在电脑唤醒后立即重检
- 延后 10 分钟再次提醒
- 多项任务同时到点时分别发送通知
- 左下角可查看调度状态并测试提醒
- 搜索、迷你日历和今日完成进度
- 数据只保存在当前电脑的 Electron 本地存储中
- Android 版使用系统通知栏提醒，支持应用退到后台后继续提醒

## 本地运行

```powershell
npm install
npm start
```

关闭主窗口后，应用会继续停留在 Windows 系统托盘。需要完全退出时，右键托盘图标并选择“退出”。

## 验证与打包

```powershell
npm test
npm run test:visual
npm run dist
```

打包完成后，安装程序位于 `dist/Flowlist-Setup-1.1.0.exe`。

## Android APK

Android 版复用 Flowlist 的任务界面，并使用 Android `AlarmManager` 调度通知。首次启动时请允许通知权限；Android 版任务数据保存在应用本地，不会自动同步 Windows 版数据。

手工构建需要通过当前 PowerShell 会话的环境变量提供签名密码。已有 `.android-cache/flowlist-debug.keystore` 时，必须输入它原来的密码；首次创建 keystore 时，请自行设置至少 6 个字符的密码。设置环境变量只为构建提供密码，不会修改已有 keystore 的密码。

`FLOWLIST_ANDROID_STORE_PASSWORD` 必填，同时用于签名库与密钥密码。以下命令使用隐藏输入，并在构建结束后清理环境变量：

```powershell
$flowlistStorePassword = Read-Host 'Keystore 密码' -AsSecureString
try {
    $env:FLOWLIST_ANDROID_STORE_PASSWORD = [System.Net.NetworkCredential]::new('', $flowlistStorePassword).Password
    npm run android:build:manual
} finally {
    Remove-Item Env:FLOWLIST_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue
    $flowlistStorePassword.Dispose()
}
```

构建产物位于 `dist/Flowlist-Android-1.1.0.apk`。APK 使用本地 release 调试签名，适合直接安装和内部使用；公开发布前应替换为正式签名密钥。

## 发布 GitHub 源码

源码仓库通过 `.gitignore` 排除运行数据、构建产物、工具缓存和签名密钥，提交前请检查待提交文件。截图需要单独审核，确认没有个人任务、备注或其他隐私信息。Windows 安装包和 Android APK 可以通过 GitHub Releases 发布，无需提交到源码仓库。

## 提醒说明

新建任务默认在到期时间提醒，也可以选择提前 5 分钟、15 分钟、1 小时或 1 天。关闭主窗口不会退出应用；需要持续提醒时，请让 Flowlist 保留在系统托盘。左下角的“测试提醒”可以随时验证 Windows 通知栏。
