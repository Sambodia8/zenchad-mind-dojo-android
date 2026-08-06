param(
    [string]$BuildDirectory = "tmp\qwen-android-build"
)

$ErrorActionPreference = "Stop"
$ndk = "C:\Users\Sam\AppData\Local\Android\Sdk\ndk\27.0.12077973"
$toolchain = Join-Path $ndk "build\cmake\android.toolchain.cmake"
$ninja = "C:\Users\Sam\AppData\Local\Android\Sdk\cmake\3.22.1\bin\ninja.exe"
$strip = Join-Path $ndk "toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-strip.exe"
if (-not (Test-Path -LiteralPath $toolchain)) { throw "Android NDK 27.0.12077973 was not found at $ndk" }
if (-not (Test-Path -LiteralPath $ninja)) { throw "Android CMake Ninja was not found at $ninja" }

cmake -S scripts/qwen-android -B $BuildDirectory `
    -G Ninja `
    -DCMAKE_BUILD_TYPE=Release `
    "-DCMAKE_TOOLCHAIN_FILE=$toolchain" `
    "-DCMAKE_MAKE_PROGRAM=$ninja" `
    -DANDROID_ABI=arm64-v8a `
    -DANDROID_PLATFORM=android-23
if ($LASTEXITCODE -ne 0) { throw "Qwen CMake configuration failed." }

cmake --build $BuildDirectory --config Release --target zenchad_qwen --parallel 4
if ($LASTEXITCODE -ne 0) { throw "Qwen native build failed." }

$destination = "android\app\src\main\jniLibs\arm64-v8a"
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Copy-Item -LiteralPath (Join-Path $BuildDirectory "libzenchad_qwen.so") -Destination (Join-Path $destination "libzenchad_qwen.so") -Force
& $strip -x (Join-Path $destination "libzenchad_qwen.so")
if ($LASTEXITCODE -ne 0) { throw "The Qwen native library could not be stripped." }
Write-Host "Built android/app/src/main/jniLibs/arm64-v8a/libzenchad_qwen.so"
