# Sube el código al Raspberry Pi con IP/usuario parametrizables.
#
# Uso:
#   .\deploy\upload.ps1 -PiHost 192.168.1.50
#   .\deploy\upload.ps1 -PiHost kiosko.local -PiUser pi -RemotePath /home/pi/kiosko
#   .\deploy\upload.ps1 -PiHost 192.168.1.50 -SkipFrontend     # solo backend
#   .\deploy\upload.ps1 -PiHost 192.168.1.50 -RestartService    # reinicia kiosko-api
#
# También admite variables de entorno como defaults:
#   $env:KIOSKO_PI_HOST, $env:KIOSKO_PI_USER, $env:KIOSKO_REMOTE_PATH
#
# Requisitos: ssh y tar disponibles en PATH. Ambos vienen de serie en Win11.
# Para evitar pedir contraseña en cada subida, usa una clave SSH:
#   ssh-keygen -t ed25519
#   ssh-copy-id pi@<host>      (o copia ~/.ssh/id_ed25519.pub a ~/.ssh/authorized_keys del Pi)

[CmdletBinding()]
param(
    [string]$PiHost = $env:KIOSKO_PI_HOST,
    [string]$PiUser = $(if ($env:KIOSKO_PI_USER) { $env:KIOSKO_PI_USER } else { "pi" }),
    [string]$RemotePath = $env:KIOSKO_REMOTE_PATH,
    [string]$WebRoot = "/var/www/kiosko",
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [switch]$BuildFrontend,
    [switch]$RestartService
)

$ErrorActionPreference = "Stop"

if (-not $PiHost) {
    Write-Error "Falta -PiHost (o `$env:KIOSKO_PI_HOST). Ejemplo: .\deploy\upload.ps1 -PiHost 192.168.1.50"
}

if (-not $RemotePath) {
    $RemotePath = "/home/$PiUser/kiosko"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$target = "${PiUser}@${PiHost}"

Write-Host "`n=== Kiosko GJ — subida a Raspberry Pi ===" -ForegroundColor Cyan
Write-Host "Destino : $target" -ForegroundColor Cyan
Write-Host "Backend : $RemotePath/backend" -ForegroundColor Cyan
Write-Host "Frontend: $WebRoot`n" -ForegroundColor Cyan

# Asegurar carpetas remotas.
ssh $target "mkdir -p $RemotePath/backend $RemotePath/deploy"

# --- Backend ---
if (-not $SkipBackend) {
    Write-Host ">> Empaquetando backend y subiendo..." -ForegroundColor Green
    Push-Location $repoRoot
    try {
        # tar transmite por stdin a ssh; en remoto se descomprime sobre $RemotePath/backend.
        # --exclude evita .venv, __pycache__, *.db (cada Pi tiene su DB), y ficheros de tests.
        $tmp = New-TemporaryFile
        Remove-Item $tmp; $tmp = "$tmp.tar.gz"
        tar -czf $tmp `
            --exclude="backend/.venv" `
            --exclude="backend/__pycache__" `
            --exclude="backend/**/__pycache__" `
            --exclude="backend/.pytest_cache" `
            --exclude="backend/.ruff_cache" `
            --exclude="backend/*.db" `
            --exclude="backend/*.db-wal" `
            --exclude="backend/*.db-shm" `
            -C $repoRoot backend
        Get-Content $tmp -AsByteStream -Raw `
            | ssh $target "tar -xzf - -C $RemotePath --overwrite"
        Remove-Item $tmp
    } finally {
        Pop-Location
    }
    # También subimos los ficheros de deploy (Caddyfile, systemd unit, etc. — cuando existan en Fase 8).
    if (Test-Path "$repoRoot\deploy") {
        Write-Host ">> Subiendo carpeta deploy/..." -ForegroundColor Green
        $tmp = New-TemporaryFile; Remove-Item $tmp; $tmp = "$tmp.tar.gz"
        tar -czf $tmp -C $repoRoot deploy
        Get-Content $tmp -AsByteStream -Raw `
            | ssh $target "tar -xzf - -C $RemotePath --overwrite"
        Remove-Item $tmp
    }
}

# --- Frontend ---
if (-not $SkipFrontend) {
    $distPath = Join-Path $repoRoot "frontend\dist"

    if ($BuildFrontend -and (Test-Path (Join-Path $repoRoot "frontend\package.json"))) {
        Write-Host ">> Compilando frontend (pnpm build)..." -ForegroundColor Green
        Push-Location (Join-Path $repoRoot "frontend")
        try {
            pnpm install --frozen-lockfile
            pnpm build
        } finally {
            Pop-Location
        }
    }

    if (Test-Path $distPath) {
        Write-Host ">> Subiendo frontend (dist/) a $WebRoot..." -ForegroundColor Green
        ssh $target "sudo mkdir -p $WebRoot && sudo chown -R ${PiUser}: $WebRoot"
        $tmp = New-TemporaryFile; Remove-Item $tmp; $tmp = "$tmp.tar.gz"
        tar -czf $tmp -C (Join-Path $repoRoot "frontend") dist
        Get-Content $tmp -AsByteStream -Raw `
            | ssh $target "tar -xzf - -C $WebRoot --strip-components=1 --overwrite"
        Remove-Item $tmp
    } else {
        Write-Host "   (No hay frontend\dist/. Salto. Usa -BuildFrontend para compilar.)" -ForegroundColor Yellow
    }
}

# --- Reinicio opcional del servicio ---
if ($RestartService) {
    Write-Host ">> Reiniciando systemd kiosko-api..." -ForegroundColor Green
    ssh $target "sudo systemctl restart kiosko-api && sudo systemctl status kiosko-api --no-pager -l | head -n 12"
}

Write-Host "`nHecho." -ForegroundColor Green
Write-Host "Siguiente paso (en la Pi, primera vez): cd $RemotePath && bash deploy/install_on_pi.sh" -ForegroundColor DarkGray
