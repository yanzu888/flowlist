$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $projectRoot '.android-cache'
$sdkRoot = Join-Path $cacheRoot 'android-sdk'
$cmdlineRoot = Join-Path $cacheRoot 'cmdline-tools'
$cmdlineLatest = Join-Path $cmdlineRoot 'latest'
$gradleRoot = Join-Path $cacheRoot 'gradle-8.10.2'

New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null

if (-not (Test-Path (Join-Path $gradleRoot 'bin\gradle.bat'))) {
    $gradleZip = Join-Path $cacheRoot 'gradle-8.10.2-bin.zip'
    if (-not (Test-Path $gradleZip)) { throw "Missing $gradleZip" }
    Expand-Archive -LiteralPath $gradleZip -DestinationPath $cacheRoot -Force
}

if (-not (Test-Path (Join-Path $cmdlineLatest 'bin\sdkmanager.bat'))) {
    $toolsZip = Join-Path $cacheRoot 'commandlinetools-win.zip'
    if (-not (Test-Path $toolsZip)) { throw "Missing $toolsZip" }
    $extractRoot = Join-Path $cacheRoot 'cmdline-tools-extracted'
    if (Test-Path $extractRoot) { Remove-Item -LiteralPath $extractRoot -Recurse -Force }
    Expand-Archive -LiteralPath $toolsZip -DestinationPath $extractRoot -Force
    New-Item -ItemType Directory -Force -Path $cmdlineRoot | Out-Null
    if (Test-Path $cmdlineLatest) { Remove-Item -LiteralPath $cmdlineLatest -Recurse -Force }
    Move-Item -LiteralPath (Join-Path $extractRoot 'cmdline-tools') -Destination $cmdlineLatest
    Remove-Item -LiteralPath $extractRoot -Recurse -Force
}

$sdkManager = Join-Path $cmdlineLatest 'bin\sdkmanager.bat'
New-Item -ItemType Directory -Force -Path $sdkRoot | Out-Null
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:Path = "$(Join-Path $cmdlineLatest 'bin');$(Join-Path $sdkRoot 'platform-tools');$env:Path"

$licenseAnswers = (1..30 | ForEach-Object { 'y' }) -join "`n"
$licenseAnswers | & $sdkManager "--sdk_root=$sdkRoot" '--licenses' | Out-Host

& $sdkManager "--sdk_root=$sdkRoot" 'platform-tools' 'platforms;android-35' 'build-tools;35.0.0'
if ($LASTEXITCODE -ne 0) { throw "sdkmanager failed with exit code $LASTEXITCODE" }

$gradle = Join-Path $gradleRoot 'bin\gradle.bat'
$env:GRADLE_USER_HOME = Join-Path $cacheRoot 'gradle-user-home'
Push-Location (Join-Path $projectRoot 'android')
try {
    & $gradle --no-daemon --version
} finally {
    Pop-Location
}

Write-Host "Android toolchain ready: $sdkRoot"
