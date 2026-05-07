# Arranque portable del backend en desarrollo (Windows / PowerShell).
#
#   .\dev.ps1                 -> 0.0.0.0:8000
#   .\dev.ps1 -Port 9000      -> puerto distinto
#   .\dev.ps1 -NoReload       -> sin --reload
#
# Si la maquina no tiene Python instalado, este script descarga `uv` (Astral)
# en %USERPROFILE%\.local\bin y con el descarga el Python pineado en
# .python-version. Crea el venv, instala dependencias y arranca uvicorn.
# Idempotente: se puede ejecutar tantas veces como haga falta.

[CmdletBinding()]
param(
    [int]$Port = 8000,
    [string]$Host_ = "0.0.0.0",
    [switch]$NoReload
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Find-Uv {
    $cmd = Get-Command uv -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidate = Join-Path $env:USERPROFILE ".local\bin\uv.exe"
    if (Test-Path $candidate) { return $candidate }
    return $null
}

$uv = Find-Uv
if (-not $uv) {
    Write-Host ">> uv no detectado. Instalando uv (Astral)..." -ForegroundColor Cyan
    # Instalador oficial. No requiere permisos de administrador.
    Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
    $uv = Find-Uv
    if (-not $uv) {
        throw "Fallo al instalar uv. Revisa la conexion a internet o instalalo manualmente desde https://astral.sh/uv"
    }
    # Anadir uv al PATH para esta sesion (el instalador lo persiste para futuras).
    $env:Path = (Split-Path $uv) + ";" + $env:Path
}

Write-Host ">> uv: $uv" -ForegroundColor DarkGray

# uv lee .python-version y descarga el interprete si falta.
# `uv sync` resuelve pyproject.toml + uv.lock, recrea .venv si no es compatible.
Write-Host ">> Sincronizando entorno (uv sync)..." -ForegroundColor Cyan
& $uv sync --extra dev
if ($LASTEXITCODE -ne 0) { throw "uv sync fallo (codigo $LASTEXITCODE)" }

if (-not (Test-Path ".env")) {
    Write-Host ">> Creando .env desde .env.example" -ForegroundColor Yellow
    Copy-Item .env.example .env
}

Write-Host ">> Aplicando migraciones (alembic upgrade head)..." -ForegroundColor Cyan
& $uv run alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw "alembic upgrade fallo (codigo $LASTEXITCODE)" }

Write-Host ">> Arrancando uvicorn en http://${Host_}:$Port ..." -ForegroundColor Green
if ($NoReload) {
    & $uv run uvicorn app.main:app --host $Host_ --port $Port
} else {
    & $uv run uvicorn app.main:app --host $Host_ --port $Port --reload
}
