# find_and_copy_lib.ps1
# Searches the local Gradle transforms cache for libreact_render_core.so and copies the first match
$pattern = 'libreact_render_core.so'
$searchRoot = Join-Path $env:USERPROFILE '.gradle\caches\transforms-4'
Write-Host "Searching: $searchRoot"
if (-not (Test-Path $searchRoot)) {
    Write-Host "Search root not found: $searchRoot"
    exit 2
}
$match = Get-ChildItem -Path $searchRoot -Filter $pattern -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $match) {
    Write-Host "NOTFOUND"
    exit 3
}
# ensure destination exists
$destDir = Join-Path $PSScriptRoot '..\android\app\src\main\jniLibs\arm64-v8a' | Resolve-Path -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -ErrorAction SilentlyContinue
if (-not $destDir) {
    $destDir = Join-Path (Join-Path $PSScriptRoot '..\android\app\src\main') 'jniLibs\arm64-v8a'
}
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$destPath = Join-Path $destDir $pattern
Copy-Item -Path $match.FullName -Destination $destPath -Force
Write-Host "COPIED: $($match.FullName) -> $destPath"
Get-ChildItem -Path $destDir | Select-Object Name,Length | Format-Table -AutoSize
