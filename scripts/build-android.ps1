$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $projectRoot '.android-cache'
$sdkRoot = Join-Path $cacheRoot 'android-sdk'
$gradle = Join-Path $cacheRoot 'gradle-8.10.2\bin\gradle.bat'

if (-not (Test-Path $gradle) -or -not (Test-Path (Join-Path $sdkRoot 'platforms\android-35\android.jar'))) {
    throw 'Android toolchain is not initialized. Run scripts/bootstrap-android.ps1 first.'
}

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:GRADLE_USER_HOME = Join-Path $cacheRoot 'gradle-user-home'
$env:Path = "$(Join-Path $sdkRoot 'platform-tools');$env:Path"

Push-Location (Join-Path $projectRoot 'android')
try {
    & $gradle --no-daemon --stacktrace assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "Gradle failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}

$apkSource = Join-Path $projectRoot 'android\app\build\outputs\apk\release\app-release.apk'
$apkTarget = Join-Path $projectRoot 'dist\Flowlist-Android-1.1.0.apk'
if (-not (Test-Path $apkSource)) { throw "APK was not created: $apkSource" }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $apkTarget) | Out-Null
Copy-Item -LiteralPath $apkSource -Destination $apkTarget -Force
Get-Item $apkTarget | Select-Object FullName,Length,LastWriteTime
