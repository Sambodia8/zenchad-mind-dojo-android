param(
    [string]$Destination = "models\qwen3-4b\Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
    [switch]$PushToDevice,
    [string]$DeviceSerial = ""
)

$ErrorActionPreference = "Stop"
$url = "https://huggingface.co/mmnga/Qwen3-4B-Instruct-2507-gguf/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf?download=true"
$expectedBytes = 2497280448
$expectedSha256 = "01217501dd8c6741c544c32eb0d18b08e27b95475e1270e955da707fa2821e2c"

$parent = Split-Path -Parent $Destination
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }

Write-Host "Downloading Qwen3 4B Q4_K_M. The file is about 2.5 GB."
Write-Host "The download resumes if an incomplete file already exists."
& curl.exe -L --fail --retry 5 --retry-delay 5 -C - --progress-bar -o $Destination $url
if ($LASTEXITCODE -ne 0) { throw "curl exited with code $LASTEXITCODE. Re-run this script to resume." }

$file = Get-Item -LiteralPath $Destination
if ($file.Length -ne $expectedBytes) {
    throw "Download is incomplete: $($file.Length) of $expectedBytes bytes. Re-run to resume."
}

$hash = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne $expectedSha256) { throw "SHA-256 mismatch. Expected $expectedSha256 but got $hash." }

Write-Host "Qwen 4B downloaded and verified: $Destination"

if ($PushToDevice) {
    $adb = "C:\Users\Sam\AppData\Local\Android\Sdk\platform-tools\adb.exe"
    if (-not (Test-Path -LiteralPath $adb)) { throw "adb was not found at $adb" }
    $adbPrefix = @()
    if ($DeviceSerial) { $adbPrefix = @("-s", $DeviceSerial) }
    & $adb @adbPrefix shell "mkdir -p /sdcard/Android/data/com.zenchad.minddojo/files/models"
    if ($LASTEXITCODE -ne 0) { throw "The device model folder could not be prepared." }
    & $adb @adbPrefix push $file.FullName "/sdcard/Android/data/com.zenchad.minddojo/files/models/$($file.Name)"
    if ($LASTEXITCODE -ne 0) { throw "The verified model could not be copied to the device." }
    Write-Host "Verified model copied to the connected Zen Chad app storage."
}
