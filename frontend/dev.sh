#!/usr/bin/env bash
# Arranque portable del frontend en desarrollo (Linux / macOS).
#   ./dev.sh
#
# Si no hay Node, descarga `fnm` (Fast Node Manager) y con el la version
# pineada en .nvmrc. Luego activa corepack y arranca pnpm dev.

set -euo pipefail
cd "$(dirname "$0")"

find_fnm() {
    if command -v fnm >/dev/null 2>&1; then command -v fnm; return 0; fi
    for p in "$HOME/.local/share/fnm/fnm" "$HOME/.local/bin/fnm" "$HOME/.fnm/fnm"; do
        if [ -x "$p" ]; then echo "$p"; return 0; fi
    done
    return 1
}

if ! FNM="$(find_fnm)"; then
    echo ">> fnm no detectado. Instalando..."
    curl -fsSL https://fnm.vercel.app/install | bash
    if ! FNM="$(find_fnm)"; then
        echo "Fallo al instalar fnm. Revisa la conexion." >&2
        exit 1
    fi
    export PATH="$(dirname "$FNM"):$PATH"
fi

echo ">> fnm: $FNM"

# Cargar entorno de fnm (PATH al multishell, etc.).
eval "$("$FNM" env --shell bash)"

echo ">> Instalando Node segun .nvmrc..."
"$FNM" install
"$FNM" use

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

echo ">> Activando corepack..."
corepack enable

echo ">> Instalando dependencias..."
pnpm install

echo ">> Arrancando Vite (http://localhost:5173) ..."
exec pnpm dev
