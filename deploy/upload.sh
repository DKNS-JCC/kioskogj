#!/usr/bin/env bash
# Sube el código al Raspberry Pi (versión bash equivalente a upload.ps1).
#
# Uso:
#   ./deploy/upload.sh --host 192.168.1.50
#   KIOSKO_PI_HOST=kiosko.local ./deploy/upload.sh --build-frontend --restart
#
# Variables de entorno usadas como default:
#   KIOSKO_PI_HOST, KIOSKO_PI_USER (default: pi), KIOSKO_REMOTE_PATH

set -euo pipefail

PI_HOST="${KIOSKO_PI_HOST:-}"
PI_USER="${KIOSKO_PI_USER:-pi}"
REMOTE_PATH="${KIOSKO_REMOTE_PATH:-}"
WEB_ROOT="/var/www/kiosko"
SKIP_FRONTEND=0
SKIP_BACKEND=0
BUILD_FRONTEND=0
RESTART_SERVICE=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --host) PI_HOST="$2"; shift 2;;
        --user) PI_USER="$2"; shift 2;;
        --remote-path) REMOTE_PATH="$2"; shift 2;;
        --web-root) WEB_ROOT="$2"; shift 2;;
        --skip-frontend) SKIP_FRONTEND=1; shift;;
        --skip-backend)  SKIP_BACKEND=1;  shift;;
        --build-frontend) BUILD_FRONTEND=1; shift;;
        --restart) RESTART_SERVICE=1; shift;;
        -h|--help)
            grep '^#' "$0" | sed 's/^# \?//'
            exit 0;;
        *) echo "Argumento no reconocido: $1" >&2; exit 1;;
    esac
done

if [[ -z "$PI_HOST" ]]; then
    echo "Falta --host (o \$KIOSKO_PI_HOST). Ej: --host 192.168.1.50" >&2
    exit 1
fi
REMOTE_PATH="${REMOTE_PATH:-/home/$PI_USER/kiosko}"

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
target="${PI_USER}@${PI_HOST}"

echo
echo "=== Kiosko GJ — subida a Raspberry Pi ==="
echo "Destino : $target"
echo "Backend : $REMOTE_PATH/backend"
echo "Frontend: $WEB_ROOT"
echo

ssh "$target" "mkdir -p $REMOTE_PATH/backend $REMOTE_PATH/deploy"

if [[ $SKIP_BACKEND -eq 0 ]]; then
    echo ">> Subiendo backend..."
    tar -czf - \
        --exclude='backend/.venv' \
        --exclude='backend/__pycache__' \
        --exclude='backend/**/__pycache__' \
        --exclude='backend/.pytest_cache' \
        --exclude='backend/.ruff_cache' \
        --exclude='backend/*.db' \
        --exclude='backend/*.db-wal' \
        --exclude='backend/*.db-shm' \
        -C "$repo_root" backend \
        | ssh "$target" "tar -xzf - -C $REMOTE_PATH --overwrite"

    if [[ -d "$repo_root/deploy" ]]; then
        echo ">> Subiendo deploy/..."
        tar -czf - -C "$repo_root" deploy \
            | ssh "$target" "tar -xzf - -C $REMOTE_PATH --overwrite"
    fi
fi

if [[ $SKIP_FRONTEND -eq 0 ]]; then
    if [[ $BUILD_FRONTEND -eq 1 && -f "$repo_root/frontend/package.json" ]]; then
        echo ">> Compilando frontend..."
        ( cd "$repo_root/frontend" && pnpm install --frozen-lockfile && pnpm build )
    fi
    if [[ -d "$repo_root/frontend/dist" ]]; then
        echo ">> Subiendo frontend a $WEB_ROOT..."
        ssh "$target" "sudo mkdir -p $WEB_ROOT && sudo chown -R ${PI_USER}: $WEB_ROOT"
        tar -czf - -C "$repo_root/frontend" dist \
            | ssh "$target" "tar -xzf - -C $WEB_ROOT --strip-components=1 --overwrite"
    else
        echo "   (No hay frontend/dist/. Salto. Usa --build-frontend para compilar.)"
    fi
fi

if [[ $RESTART_SERVICE -eq 1 ]]; then
    echo ">> Reiniciando systemd kiosko-api..."
    ssh "$target" "sudo systemctl restart kiosko-api && sudo systemctl status kiosko-api --no-pager -l | head -n 12"
fi

echo
echo "Hecho."
echo "Siguiente paso (primera vez en la Pi): cd $REMOTE_PATH && bash deploy/install_on_pi.sh"
