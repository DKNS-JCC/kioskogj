# Arranque portable del frontend en desarrollo (Windows / PowerShell).
#
#   .\dev.ps1
#
# Si la maquina no tiene Node, descarga `fnm` (Fast Node Manager) en
# %USERPROFILE%\.local\bin, y con el descarga la version pineada en .nvmrc.
# Luego activa corepack y arranca pnpm dev. Idempotente.

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Find-Fnm {
    $cmd = Get-Command fnm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidate = Join-Path $env:USERPROFILE ".local\bin\fnm.exe"
    if (Test-Path $candidate) { return $candidate }
    return $null
}

$fnm = Find-Fnm
if (-not $fnm) {
    Write-Host ">> fnm no detectado. Descargando ultima release de Schniz/fnm..." -ForegroundColor Cyan
    $bin = Join-Path $env:USERPROFILE ".local\bin"
    New-Item -ItemType Directory -Path $bin -Force | Out-Null
    $tmpDir = Join-Path $env:TEMP ("fnm-extract-" + [Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
    try {
        $zip = Join-Path $tmpDir "fnm.zip"
        Invoke-WebRequest -Uri "https://github.com/Schniz/fnm/releases/latest/download/fnm-windows.zip" -OutFile $zip -UseBasicParsing
        Expand-Archive -Path $zip -DestinationPath $tmpDir -Force
        $exe = Get-ChildItem -Path $tmpDir -Recurse -Filter "fnm.exe" | Select-Object -First 1
        if (-not $exe) { throw "fnm.exe no encontrado en el zip descargado." }
        Copy-Item -Path $exe.FullName -Destination (Join-Path $bin "fnm.exe") -Force
    } finally {
        Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    $fnm = Find-Fnm
    if (-not $fnm) { throw "Fallo al instalar fnm." }
    $env:Path = (Split-Path $fnm) + ";" + $env:Path
}

Write-Host ">> fnm: $fnm" -ForegroundColor DarkGray

# Cargar variables de entorno de fnm en esta sesion (PATH al multishell, etc.).
& $fnm env --shell powershell | Out-String | Invoke-Expression

Write-Host ">> Instalando Node segun .nvmrc..." -ForegroundColor Cyan
& $fnm install
if ($LASTEXITCODE -ne 0) { throw "fnm install fallo (codigo $LASTEXITCODE)" }
& $fnm use
if ($LASTEXITCODE -ne 0) { throw "fnm use fallo (codigo $LASTEXITCODE)" }

# Silenciar el prompt de corepack la primera vez que descarga pnpm.
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = "0"

Write-Host ">> Activando corepack (pnpm via packageManager)..." -ForegroundColor Cyan
corepack enable
if ($LASTEXITCODE -ne 0) { throw "corepack enable fallo (codigo $LASTEXITCODE)" }

Write-Host ">> Instalando dependencias (pnpm install)..." -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) { throw "pnpm install fallo (codigo $LASTEXITCODE)" }

Write-Host ">> Arrancando Vite (http://localhost:5173) ..." -ForegroundColor Green
pnpm dev
