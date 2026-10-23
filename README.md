# Flowlist

简体中文 | [English](README.en.md)

**把今天理清楚。** Flowlist 是一款轻量的本地待办清单，提供 Windows 桌面版和 Android APK 版。它把任务、日期、优先级和系统提醒放在一起，适合记录个人工作与日常事项。

应用无需注册账号，不依赖后端服务；任务保存在设备本地。当前应用界面为简体中文，中英文说明文档不代表应用已支持语言切换。

## 功能概览

- 新增、编辑、完成、恢复和删除任务，支持标题、备注、日期、时间与优先级。
- Windows 界面提供今天、即将到来、全部任务、已完成四种视图，以及搜索、迷你日历和今日完成进度。
- 提醒可设为到期时、提前 5 分钟、15 分钟、1 小时、1 天，或关闭提醒。
- Windows 使用原生通知；主窗口隐藏时，提醒不会主动打开窗口，点击通知后才显示对应任务。
- Windows 支持托盘常驻、每 15 秒检查提醒，并在电脑唤醒后重新检查；多项任务同时到点时分别通知。
- Android 复用任务界面，通过系统 `AlarmManager` 调度通知，支持应用退到后台后提醒。

## 平台与数据

| 平台 | 实现方式 | 数据保存 |
| --- | --- | --- |
| Windows | Electron 桌面应用 | Electron 用户数据目录中的 localStorage |
| Android 8.0 及以上 | WebView + Java 原生桥接 | WebView 本地存储与 SharedPreferences |

两端的数据独立保存，目前没有账号系统、云端备份或跨设备同步。卸载应用或清理应用数据前，请自行保留需要的任务信息。

## 在 Windows 上运行

先安装 Node.js 和 npm，在 PowerShell 中执行：

```powershell
git clone https://github.com/yanzu888/flowlist.git
cd flowlist
npm install
npm start
```

关闭主窗口后，Flowlist 会继续留在系统托盘。需要完全退出时，右键托盘图标并选择“退出”。

## 提醒如何工作

新建任务默认在到期时间提醒，也可以提前提醒或选择“不提醒”。Windows 版需要保持应用运行，关闭主窗口并不会退出应用；Android 版首次启动时需要允许通知权限，实际提醒时间也会受到系统权限和省电设置影响。

电脑休眠、系统延迟或应用重启后，调度器会重新检查尚未完成、尚未记录为已提醒的任务。已到点的提醒可在**任务到期时间之后 24 小时内**补发，补发窗口以任务到期时间为基准。Windows 左下角提供调度状态和“测试提醒”入口。

## 验证与 Windows 打包

运行核心逻辑测试并构建 Windows 安装程序：

```powershell
npm test
npm run dist
```

安装程序输出到 `dist/Flowlist-Setup-1.1.0.exe`。

项目还提供 `test:reminder`、`test:tray`、`test:package` 和 `test:visual` 检查脚本。其中 `test:visual` 当前会向默认桌面配置写入演示任务，可能覆盖已有任务；完成测试数据隔离前，请勿在保存个人任务的环境中运行它。

## 构建 Android APK

以下步骤使用仓库提供的 Windows 手工构建脚本。需要先执行 `npm install`，并安装 JDK 17，确保 `java`、`javac` 和 `jar` 可通过命令行调用。

工具链使用 Android SDK Platform 35、Build Tools 35.0.0 和 Gradle 8.10.2。首次配置时，将 Gradle 8.10.2 的二进制发行 ZIP 和 Android 命令行工具的 Windows ZIP 分别放到以下位置：

```text
.android-cache/gradle-8.10.2-bin.zip
.android-cache/commandlinetools-win.zip
```

然后在项目根目录初始化工具链，并创建安装包输出目录：

```powershell
npm run android:bootstrap
New-Item -ItemType Directory -Force -Path dist | Out-Null
```

手工构建通过当前 PowerShell 会话的 `FLOWLIST_ANDROID_STORE_PASSWORD` 环境变量读取签名库与密钥密码。已有 `.android-cache/flowlist-debug.keystore` 时，必须使用原密码；首次创建时，请自行设置至少 6 个字符的密码。设置环境变量不会修改已有 keystore 的密码。

以下示例隐藏密码输入，并在构建结束后清理环境变量：

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

安装包输出到 `dist/Flowlist-Android-1.1.0.apk`。当前构建使用本地开发签名，适合自用和内部测试；正式分发前应配置并妥善保管正式签名密钥。

## 项目结构

```text
src/         任务界面、核心逻辑、Electron 主进程与平台桥接
android/     Android 原生壳、存储和提醒调度
scripts/     构建、图标生成与集成检查脚本
tests/       任务与提醒核心逻辑测试
assets/      应用图标
```

前端使用原生 HTML、CSS、JavaScript 和 Lucide 图标；Windows 端使用 Electron 与 electron-builder，Android 端使用 Java 和系统通知能力。

## 当前限制与源码发布

- Android 手机窄屏布局目前隐藏了侧栏，尚缺少切换全部、未来和已完成任务的替代导航入口。
- 系统通知的可用性取决于系统权限与设置；界面的“提醒正在运行”状态不等于系统已成功展示通知。
- `.gitignore` 已排除运行数据、构建产物、工具缓存、环境配置和签名密钥；这些文件应留在本机。
- 公开截图前请检查任务标题、备注和其他个人信息。Windows 安装包和 Android APK 可通过 [GitHub Releases](https://github.com/yanzu888/flowlist/releases) 分发。
