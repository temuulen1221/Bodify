# copy_lib.ps1
$source = 'C:\Users\store\.gradle\caches\transforms-4\3a68f04fc5c483fe4363533a9c21f9c9\transformed\react-android-0.73.3-debug\prefab\modules\react_render_core\libs\android.arm64-v8a\libreact_render_core.so'
$destDir = 'C:\Users\store\Bodify\android\app\src\main\jniLibs\arm64-v8a'

if (-not (Test-Path $source)) {
    Write-Host "SOURCE_NOT_FOUND: $source"
    exit 1
}

# ensure destination exists
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

# copy and show result
Copy-Item -Path $source -Destination $destDir -Force
Write-Host "COPIED -> $destDir"
Get-ChildItem -Path $destDir | Select-Object Name,Length | Format-Table -AutoSize