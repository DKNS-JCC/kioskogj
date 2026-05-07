#!/usr/bin/env bash
# Script para instalar/actualizar el entorno en la Raspberry Pi.
# Ejecutar localmente en la Pi:
#   cd /home/pi/kiosko
#   bash deploy/install_on_pi.sh

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER=$(whoami)
WEB_ROOT="/var/www/kiosko"

echo "=== Configurando Kiosko GJ en Raspberry Pi ==="
echo "Directorio de la app: $APP_DIR"
echo "Usuario actual: $USER"

# 1. Instalar dependencias del sistema operativo (Nginx, curl, python3-venv)
echo ">> Actualizando repositorios e instalando dependencias base (nginx, python3-venv)..."
sudo apt-get update
sudo apt-get install -y nginx python3-venv python3-pip curl git

# 2. Instalar Node.js y pnpm (para construir el frontend en la Pi si aplica)
if ! command -v node &> /dev/null; then
    echo ">> Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
if ! command -v pnpm &> /dev/null; then
    echo ">> Instalando pnpm..."
    sudo npm install -g pnpm
fi

# 3. Instalar `uv` si no existe
if ! command -v uv &> /dev/null; then
    echo ">> Instalando 'uv' para gestión ultrarrápida de Python..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# 4. Construir frontend si se clonó el repo completo
if [ -d "$APP_DIR/frontend" ]; then
    echo ">> Construyendo el frontend PWA (esto puede tardar unos minutos)..."
    cd "$APP_DIR/frontend"
    pnpm install
    pnpm build
    sudo mkdir -p $WEB_ROOT
    sudo chown -R $USER: $WEB_ROOT
    rsync -a --delete dist/ $WEB_ROOT/
fi

# 5. Configurar Backend (crear DB, migrar y sincronizar dependencias)
echo ">> Configurando backend..."
cd "$APP_DIR/backend"
# uv sync creará el `.venv` y descargará las dependencias exactamente según pyproject.toml
$HOME/.cargo/bin/uv sync
# Aplicar migraciones si las hay
$HOME/.cargo/bin/uv run alembic upgrade head

# 6. Configurar Nginx (Frontend y Proxy Inverso)
echo ">> Configurando Nginx para servir el frontend y hacer proxy a FastAPI..."
NGINX_CONF="/etc/nginx/sites-available/kioskogj"

sudo bash -c "cat > $NGINX_CONF" <<EOF
server {
    listen 80;
    server_name _;
    root $WEB_ROOT;
    index index.html;

    # Frontend (React Router PWA)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API Backend (FastAPI)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Directorio de imágenes subidas
    location /static/ {
        proxy_pass http://127.0.0.1:8000/static/;
    }
}
EOF

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# 7. Configurar el servicio systemd del backend
echo ">> Creando servicio systemd para la API (kiosko-api.service)..."
SERVICE_FILE="/etc/systemd/system/kiosko-api.service"
sudo bash -c "cat > $SERVICE_FILE" <<EOF
[Unit]
Description=Kiosko GJ Backend (FastAPI)
After=network.target

[Service]
User=$USER
WorkingDirectory=$APP_DIR/backend
# Usa uvicorn a través del entorno de uv
ExecStart=$HOME/.cargo/bin/uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info
Restart=always
RestartSec=5
Environment=KIOSKO_DB_PATH=$APP_DIR/backend/database.db

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable kiosko-api
sudo systemctl restart kiosko-api

echo ""
echo "=== ¡Instalación Completada! ==="
echo "La API está corriendo (systemctl status kiosko-api)."
echo "El servidor web está sirviendo en el puerto 80 (systemctl status nginx)."
echo ">> Para ver los logs del backend: sudo journalctl -u kiosko-api -f"
