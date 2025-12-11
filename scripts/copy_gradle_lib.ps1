param(
    [string]$Source = "C:\Users\store\\.gradle\\caches\\transforms-4\\3a68f04fc5c483fe4363533a9c21f9c9\\transformed\\react-android-0.73.3-debug\\prefab\\modules\\react_render_core\\libs\\android.arm64-v8a\\libreact_render_core.so",
    [string]$Dest = "c:\Users\store\Bodify\android\app\src\main\jniLibs\arm64-v8a\libreact_render_core.so"
)

Write-Host "Copy helper: verifying source exists..."
if (-Not (Test-Path $Source)) {
    Write-Error "Source file not found: $Source"
    exit 2
}

Write-Host "Creating destination directory if needed..."
$destDir = Split-Path $Dest -Parent
if (-Not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }

Write-Host "Copying $Source -> $Dest"
Copy-Item -Path $Source -Destination $Dest -Force
if ($?) { Write-Host "Copy completed."; exit 0 } else { Write-Error "Copy failed."; exit 3 }
