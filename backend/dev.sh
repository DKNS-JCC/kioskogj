#!/usr/bin/env bash
# Arranque portable del backend en desarrollo (Linux / macOS).
#   ./dev.sh
#   PORT=9000 ./dev.sh
#
# Si la maquina no tiene Python, este script descarga `uv` (Astral) en
# ~/.local/bin y con el descarga el Python pineado en .python-version.

set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

find_uv() {
    if command -v uv >/dev/null 2>&1; then
        command -v uv
        return 0
    fi
    if [ -x "$HOME/.local/bin/uv" ]; then
        echo "$HOME/.local/bin/uv"
        return 0
    fi
    return 1
}

if ! UV="$(find_uv)"; then
    echo ">> uv no detectado. Instalando uv (Astral)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    if ! UV="$(find_uv)"; then
        echo "Fallo al instalar uv. Revisa la conexion o instalalo desde https://astral.sh/uv" >&2
        exit 1
    fi
    export PATH="$(dirname "$UV"):$PATH"
fi

echo ">> uv: $UV"

echo ">> Sincronizando entorno (uv sync)..."
"$UV" sync --extra dev

if [ ! -f .env ]; then
    echo ">> Creando .env desde .env.example"
    cp .env.example .env
fi

echo ">> Aplicando migraciones (alembic upgrade head)..."
"$UV" run alembic upgrade head

echo ">> Arrancando uvicorn en http://${HOST}:${PORT} ..."
exec "$UV" run uvicorn app.main:app --host "$HOST" --port "$PORT" --reload
