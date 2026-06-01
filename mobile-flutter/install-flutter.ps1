# Install Flutter SDK (stable) on Windows. Safe + idempotent.
# Clones the stable channel via git, adds bin to the user PATH, then runs doctor.
#
# Run:
#   powershell -ExecutionPolicy Bypass -File mobile-flutter\install-flutter.ps1
#
# Uninstall later: delete C:\src\flutter and remove its bin from PATH.
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 misreads UTF-8 .ps1 files).

$ErrorActionPreference = 'Stop'
$dest = 'C:\src\flutter'
$binPath = "$dest\bin"

Write-Host '== Installing Flutter ==' -ForegroundColor Cyan

if (-not (Test-Path "$binPath\flutter.bat")) {
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  Write-Host "Cloning stable channel into $dest (may take several minutes)..." -ForegroundColor Yellow
  git clone --depth 1 -b stable https://github.com/flutter/flutter.git $dest
} else {
  Write-Host "Flutter already present at $dest" -ForegroundColor Green
}

# Add bin to user PATH if missing
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$binPath*") {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;$binPath", 'User')
  Write-Host "Added $binPath to user PATH (open a NEW terminal to use it)." -ForegroundColor Green
}
$env:Path = "$env:Path;$binPath"

Write-Host ''
Write-Host '== Version + doctor (first run downloads the Dart SDK, can be slow) ==' -ForegroundColor Cyan
& "$binPath\flutter.bat" --version
& "$binPath\flutter.bat" doctor
Write-Host ''
Write-Host '== DONE ==' -ForegroundColor Green
