#!/usr/bin/env bash
# Instala/actualiza el entorno completo en una Raspberry Pi (3B+ o superior).
# Idempotente: re-ejecutar es seguro.
#
#   cd ~/kiosko && bash deploy/install_on_pi.sh
#
# Estrategia de portabilidad:
#  - Node viene de `fnm` (no de apt) -> Node 20 garantizado en armv7.
#  - Python viene de `uv` (no de apt) -> aislado del sistema, 1 comando.
#  - Frontend se compila a `dist/` y lo sirve nginx.
#  - Backend corre como systemd unit con uv como launcher.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_NAME="$(whoami)"
HOME_DIR="$HOME"
WEB_ROOT="/var/www/kiosko"
UV_BIN="$HOME_DIR/.local/bin/uv"

echo "=== Kiosko GJ — instalación en Raspberry Pi ==="
echo "Directorio app : $APP_DIR"
echo "Usuario        : $USER_NAME"

# ─── 0. Comprobaciones previas ───────────────────────────────────────────
# OctoPi (HAProxy + OctoPrint) usa el puerto 80. Si está activo, abortamos
# antes de tocar nada para no dejar la Pi en estado inconsistente.
if systemctl is-active --quiet haproxy 2>/dev/null \
   || systemctl is-active --quiet octoprint 2>/dev/null; then
    cat <<'EOF'
⚠ Detectado OctoPi corriendo (HAProxy/OctoPrint en el puerto 80).
   La instalación de Kiosko entraría en conflicto. Ejecuta primero:

       bash deploy/uninstall_octopi.sh

   y vuelve a lanzar este script.
EOF
    exit 1
fi

# ─── 1. Paquetes del sistema (sólo lo imprescindible) ────────────────────
echo ">> Instalando dependencias base del sistema (nginx, curl, unzip, rsync, git)..."
sudo apt-get update
sudo apt-get install -y nginx curl unzip rsync git

# Asegurarnos de que ~/.local/bin existe y está en el PATH para esta sesión.
mkdir -p "$HOME_DIR/.local/bin"
export PATH="$HOME_DIR/.local/bin:$PATH"

# ─── 2. fnm + Node 20 ────────────────────────────────────────────────────
# La versión de Node de apt en Raspberry Pi OS suele ser 18, y pnpm@9+
# necesita Node 20+ (por regex `/v`). Usamos fnm (armv7 soportado) para
# instalar la versión exacta declarada en frontend/.nvmrc.
if ! command -v fnm >/dev/null 2>&1; then
    echo ">> Instalando fnm (Fast Node Manager)..."
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
fi
# El instalador deja fnm en ~/.local/share/fnm/fnm; lo enlazamos en
# ~/.local/bin para que esté en el PATH sin tocar .bashrc.
if [ ! -x "$HOME_DIR/.local/bin/fnm" ] && [ -x "$HOME_DIR/.local/share/fnm/fnm" ]; then
    ln -sf "$HOME_DIR/.local/share/fnm/fnm" "$HOME_DIR/.local/bin/fnm"
fi

eval "$(fnm env --shell bash)"

cd "$APP_DIR/frontend"
NVMRC_VERSION="$(cat .nvmrc)"
echo ">> Instalando Node $NVMRC_VERSION via fnm..."
fnm install
fnm use

echo ">> Activando corepack (pnpm via packageManager)..."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable

# ─── 3. uv (Python) ──────────────────────────────────────────────────────
if [ ! -x "$UV_BIN" ]; then
    echo ">> Instalando uv (Astral)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# ─── 4. Build del frontend ───────────────────────────────────────────────
echo ">> Construyendo el frontend (esto puede tardar varios minutos en la Pi)..."
cd "$APP_DIR/frontend"
pnpm install
pnpm build
sudo mkdir -p "$WEB_ROOT"
sudo chown -R "$USER_NAME":"$USER_NAME" "$WEB_ROOT"
rsync -a --delete dist/ "$WEB_ROOT/"

# ─── 5. Backend (Python + Alembic) ───────────────────────────────────────
echo ">> Sincronizando backend con uv y aplicando migraciones..."
cd "$APP_DIR/backend"
"$UV_BIN" sync
"$UV_BIN" run alembic upgrade head

# Crear el directorio de imágenes subidas si la app lo usa.
mkdir -p "$APP_DIR/backend/static/productos"

# ─── 6. Nginx ────────────────────────────────────────────────────────────
echo ">> Configurando Nginx (frontend + proxy /api/ y /static/)..."
NGINX_CONF="/etc/nginx/sites-available/kioskogj"
sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    root $WEB_ROOT;
    index index.html;

    # Frontend SPA (React Router): cualquier ruta que no sea archivo cae en index.html.
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # Subidas de imagen pueden pesar varios MB.
        client_max_body_size 10M;
    }

    # Imágenes subidas (servidas por FastAPI/StaticFiles).
    location /static/ {
        proxy_pass http://127.0.0.1:8000/static/;
    }
}
EOF

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/kioskogj
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# ─── 7. systemd unit del backend ─────────────────────────────────────────
echo ">> Creando servicio systemd kiosko-api..."
SERVICE_FILE="/etc/systemd/system/kiosko-api.service"
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Kiosko GJ Backend (FastAPI)
After=network.target

[Service]
User=$USER_NAME
WorkingDirectory=$APP_DIR/backend
# uv corre uvicorn dentro del .venv que sincronizamos en el paso 5.
ExecStart=$UV_BIN run uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info
Restart=always
RestartSec=5
Environment=KIOSKO_DB_PATH=$APP_DIR/backend/database.db
# uv y los binarios del .venv resuelven desde aquí en sistemas restringidos.
Environment=PATH=$HOME_DIR/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=HOME=$HOME_DIR

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable kiosko-api
sudo systemctl restart kiosko-api

echo
echo "=== Instalación completada ==="
echo "  Frontend  : http://$(hostname -I | awk '{print $1}')/"
echo "  API       : sudo systemctl status kiosko-api"
echo "  Logs      : sudo journalctl -u kiosko-api -f"
