# Forge614 node installer (Windows) — rendered from forge614-ai/standard/templates/install.ps1 (standard 1.0.1).
param([string]$Version = "", [string]$Archive = "", [switch]$Uninstall)
$ErrorActionPreference = "Stop"
$NodeName = "sentinel"; $Repo = "jotredev/forge614-sentinel"; $AssetPrefix = "forge614-sentinel"
$Forge614Home = if ($env:FORGE614_HOME) { $env:FORGE614_HOME } else { Join-Path $HOME ".forge614" }
$NodeHome = Join-Path $Forge614Home $NodeName
$BinDir = Join-Path $NodeHome "bin"
$Launcher = Join-Path $BinDir "forge614-$NodeName.exe"

if ($Uninstall) {
  if (Test-Path $Launcher) { & $Launcher uninstall --self; if ($LASTEXITCODE -ne 0) { throw "node refused to uninstall its integrations; nothing removed" } }
  if (Test-Path $NodeHome) { Remove-Item -Recurse -Force $NodeHome }
  Write-Host "removed $NodeHome"; exit 0
}

# Migración de instalaciones anteriores al estándar: perfil de PowerShell del usuario con un bloque PATH
# marcado. Un nodo alineado nunca edita PATH; solo forge614-ai crea el comando global. El perfil se
# respalda antes de tocarlo. No hay instalación plana que migrar en Windows: el lanzador ya es una copia,
# nunca un binario compartido con otra versión.
$MarkBegin = "# >>> forge614-$NodeName PATH >>>"
$MarkEnd = "# <<< forge614-$NodeName PATH <<<"
function Remove-LegacyPathBlock {
  param([string]$ProfilePath)
  if (-not (Test-Path $ProfilePath)) { return }
  $lines = Get-Content -LiteralPath $ProfilePath
  if (-not ($lines -contains $MarkBegin)) { return }
  $stamp = Get-Date -Format "yyyyMMddHHmmss"
  Copy-Item -LiteralPath $ProfilePath -Destination "$ProfilePath.forge614-backup-$stamp"
  $kept = @(); $skip = $false
  foreach ($line in $lines) {
    if ($line -eq $MarkBegin) { $skip = $true; continue }
    if ($line -eq $MarkEnd) { $skip = $false; continue }
    if (-not $skip) { $kept += $line }
  }
  Set-Content -LiteralPath $ProfilePath -Value $kept
  Write-Host "removed legacy PATH block from $ProfilePath (backup kept next to it)"
}
function Invoke-LegacyMigration {
  Remove-LegacyPathBlock -ProfilePath $PROFILE.CurrentUserAllHosts
  Remove-LegacyPathBlock -ProfilePath $PROFILE.CurrentUserCurrentHost
}

$Arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { throw "unsupported architecture" }
$Platform = "windows-$Arch"
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ("forge614-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $Tmp | Out-Null
try {
  if (-not $Archive) {
    if (-not $Version) {
      $Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ Accept = "application/vnd.github+json" }
      $Version = $Release.tag_name.TrimStart("v")
    }
    $Base = "https://github.com/$Repo/releases/download/v$Version"
    $Asset = "$AssetPrefix-$Platform.zip"
    Invoke-WebRequest -Uri "$Base/$Asset" -OutFile (Join-Path $Tmp $Asset)
    Invoke-WebRequest -Uri "$Base/SHA256SUMS" -OutFile (Join-Path $Tmp "SHA256SUMS")
    $Expected = (Get-Content (Join-Path $Tmp "SHA256SUMS") | Where-Object { $_ -match " $([regex]::Escape($Asset))$" }) -split "\s+" | Select-Object -First 1
    $Actual = (Get-FileHash -Algorithm SHA256 (Join-Path $Tmp $Asset)).Hash.ToLower()
    if ($Expected -ne $Actual) { throw "checksum mismatch for $Asset" }
    $Archive = Join-Path $Tmp $Asset
  } elseif (-not $Version) { throw "-Archive requires -Version" }
  Invoke-LegacyMigration
  $Dest = Join-Path $NodeHome $Version
  New-Item -ItemType Directory -Force -Path $Dest, $BinDir | Out-Null
  Expand-Archive -Path $Archive -DestinationPath $Dest -Force
  Copy-Item (Join-Path $Dest "forge614-$NodeName.exe") $Launcher -Force
  Set-Content -Path (Join-Path $NodeHome ".active-version") -Value $Version
  & $Launcher --version | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "installed binary does not run" }
  Write-Host "installed forge614-$NodeName $Version at $Dest"
} finally { Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue }
