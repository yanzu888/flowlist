$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Keep signing secrets out of source files and child-process command lines.
$signingPasswordEnvName = 'FLOWLIST_ANDROID_STORE_PASSWORD'
if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($signingPasswordEnvName))) {
    throw 'Set FLOWLIST_ANDROID_STORE_PASSWORD in the current session before building. See the Android APK instructions in README.md.'
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $projectRoot '.android-cache'
$sdkRoot = Join-Path $cacheRoot 'android-sdk'
$buildTools = Join-Path $sdkRoot 'build-tools\35.0.0'
$androidJar = Join-Path $sdkRoot 'platforms\android-35\android.jar'
$aapt2 = Join-Path $buildTools 'aapt2.exe'
$d8 = Join-Path $buildTools 'd8.bat'
$zipalign = Join-Path $buildTools 'zipalign.exe'
$apksigner = Join-Path $buildTools 'apksigner.bat'
$javacCommand = Get-Command javac.exe -ErrorAction Stop
$javaHome = Split-Path -Parent (Split-Path -Parent $javacCommand.Source)
$keytool = Join-Path $javaHome 'bin\keytool.exe'

foreach ($required in @($androidJar, $aapt2, $d8, $zipalign, $apksigner, $keytool)) {
    if (-not (Test-Path $required)) { throw "Missing Android build tool: $required" }
}

$buildRoot = Join-Path $projectRoot 'android\manual-build'
$assetsRoot = Join-Path $buildRoot 'assets'
$resZip = Join-Path $buildRoot 'res.zip'
$unsignedApk = Join-Path $buildRoot 'Flowlist-unsigned.apk'
$alignedApk = Join-Path $buildRoot 'Flowlist-aligned.apk'
$classesDir = Join-Path $buildRoot 'classes'
$dexDir = Join-Path $buildRoot 'dex'
$generatedDir = Join-Path $buildRoot 'generated'
$keystore = Join-Path $cacheRoot 'flowlist-debug.keystore'
$apkTarget = Join-Path $projectRoot 'dist\Flowlist-Android-1.1.0.apk'

New-Item -ItemType Directory -Force -Path $buildRoot,$assetsRoot,$classesDir,$dexDir,$generatedDir | Out-Null
Get-ChildItem -LiteralPath $assetsRoot -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'src\index.html') -Destination $assetsRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'src\styles.css') -Destination $assetsRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'src\renderer.js') -Destination $assetsRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'src\task-core.js') -Destination $assetsRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'src\platform-bridge.js') -Destination $assetsRoot -Force
New-Item -ItemType Directory -Force -Path (Join-Path $assetsRoot 'vendor') | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'src\vendor\lucide.js') -Destination (Join-Path $assetsRoot 'vendor\lucide.js') -Force

& $aapt2 compile --dir (Join-Path $projectRoot 'android\app\src\main\res') -o $resZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 resource compilation failed with exit code $LASTEXITCODE" }

$manifest = Join-Path $projectRoot 'android\app\src\main\AndroidManifest.xml'
$linkArgs = @(
    'link', '-o', $unsignedApk, '-I', $androidJar, '--manifest', $manifest,
    '--java', $generatedDir, '--auto-add-overlay', '--min-sdk-version', '26',
    '--target-sdk-version', '35', '--version-code', '11', '--version-name', '1.1.0',
    '-A', $assetsRoot, $resZip
)
& $aapt2 @linkArgs
if ($LASTEXITCODE -ne 0) { throw "aapt2 resource linking failed with exit code $LASTEXITCODE" }

$javaFiles = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'android\app\src\main\java') -Recurse -Filter '*.java' | Select-Object -ExpandProperty FullName)
$javaFiles += Get-ChildItem -LiteralPath $generatedDir -Recurse -Filter 'R.java' | Select-Object -ExpandProperty FullName
$javac = Join-Path $javaHome 'bin\javac.exe'
& $javac '-encoding' 'UTF-8' '-source' '17' '-target' '17' '-classpath' $androidJar '-d' $classesDir @javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed with exit code $LASTEXITCODE" }

$classFiles = @(Get-ChildItem -LiteralPath $classesDir -Recurse -Filter '*.class' | Select-Object -ExpandProperty FullName)
& $d8 '--lib' $androidJar '--output' $dexDir @classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed with exit code $LASTEXITCODE" }

if (-not (Test-Path $keystore)) {
    $keytoolOutput = & $keytool '-genkeypair' '-keystore' $keystore '-storepass:env' $signingPasswordEnvName '-keypass:env' $signingPasswordEnvName '-alias' 'flowlist' '-keyalg' 'RSA' '-keysize' '2048' '-validity' '10000' '-dname' 'CN=Flowlist,OU=Flowlist,O=Flowlist,C=CN' '-noprompt' 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Could not create signing keystore: $keytoolOutput" }
}
if (-not (Test-Path $keystore)) { throw "Could not create signing keystore: $keystore" }

& jar uf $unsignedApk -C $dexDir classes.dex
if ($LASTEXITCODE -ne 0) { throw "Could not add classes.dex to APK" }
& $zipalign '-f' '-p' '4' $unsignedApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "zipalign failed with exit code $LASTEXITCODE" }
& $apksigner 'sign' '--ks' $keystore '--ks-pass' "env:$signingPasswordEnvName" '--key-pass' "env:$signingPasswordEnvName" '--out' $apkTarget $alignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner failed with exit code $LASTEXITCODE" }
& $apksigner 'verify' '--verbose' $apkTarget
if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed with exit code $LASTEXITCODE" }

Get-Item $apkTarget | Select-Object FullName,Length,LastWriteTime
