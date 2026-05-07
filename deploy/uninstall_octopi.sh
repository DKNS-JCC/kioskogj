#!/usr/bin/env bash
# Desinstala OctoPi (OctoPrint + HAProxy + mjpg-streamer/webcamd) de la Pi
# para liberar el puerto 80 y la RAM, antes de instalar Kiosko GJ.
#
# Hace una copia de seguridad de ~/.octoprint en ~/octoprint-backup-*.tar.gz
# por si decides recuperar tus perfiles de impresora más adelante.
#
# Uso:
#   bash deploy/uninstall_octopi.sh

set -euo pipefail

HOME_DIR="$HOME"
USER_NAME="$(whoami)"

cat <<EOF
=== Desinstalación de OctoPi ===

Esto va a:
  1. Parar y enmascarar los servicios: octoprint, haproxy, webcamd
  2. Hacer un backup de ~/.octoprint en $HOME_DIR/
  3. Borrar ~/.octoprint y ~/oprint
  4. Purgar el paquete apt 'haproxy'
  5. Borrar configuración custom de OctoPi (webcamd, haproxy.cfg)

La instalación de OctoPi NO se restaura sin reflashear el SD.
Backup de configs (perfiles, plugins, settings) sí se conserva.

EOF

read -rp ">> ¿Continuar? (escribe 'si' para confirmar): " RESP
if [ "$RESP" != "si" ]; then
    echo "Cancelado."
    exit 0
fi

# ─── 1. Parar servicios ──────────────────────────────────────────────────
echo
echo ">> Parando servicios de OctoPi..."
for svc in octoprint haproxy webcamd; do
    if systemctl list-unit-files | grep -q "^${svc}\.service"; then
        sudo systemctl stop "$svc" 2>/dev/null || true
        sudo systemctl disable "$svc" 2>/dev/null || true
        sudo systemctl mask "$svc" 2>/dev/null || true
        echo "   - $svc detenido y enmascarado"
    else
        echo "   - $svc no estaba instalado"
    fi
done

# ─── 2. Backup de configs de OctoPrint ───────────────────────────────────
if [ -d "$HOME_DIR/.octoprint" ]; then
    STAMP="$(date +%Y%m%d-%H%M%S)"
    BACKUP="$HOME_DIR/octoprint-backup-$STAMP.tar.gz"
    echo
    echo ">> Haciendo backup de ~/.octoprint en $BACKUP ..."
    tar -czf "$BACKUP" -C "$HOME_DIR" .octoprint
    echo "   Tamaño: $(du -h "$BACKUP" | cut -f1)"
fi

# ─── 3. Borrar instalación de OctoPrint ──────────────────────────────────
echo
echo ">> Borrando ~/oprint y ~/.octoprint..."
rm -rf "$HOME_DIR/oprint" "$HOME_DIR/.octoprint"

# ─── 4. Purgar HAProxy ───────────────────────────────────────────────────
echo
echo ">> Desinstalando HAProxy del sistema..."
sudo apt-get purge -y haproxy || true
sudo apt-get autoremove -y

# ─── 5. Borrar bits residuales de OctoPi ────────────────────────────────
echo
echo ">> Limpiando ficheros residuales de OctoPi..."
sudo rm -f /etc/systemd/system/webcamd.service
sudo rm -f /etc/systemd/system/octoprint.service
sudo rm -f /usr/local/bin/webcamd
sudo rm -f /etc/haproxy/haproxy.cfg
sudo rm -rf /etc/haproxy
# Página de error de "OctoPrint not running" servida por HAProxy.
sudo rm -rf /var/www/html/octoprint*

sudo systemctl daemon-reload

echo
echo "=== OctoPi desinstalado ==="
echo "Puerto 80 libre. Ahora puedes correr:"
echo "    bash deploy/install_on_pi.sh"
[ -f "$HOME_DIR"/octoprint-backup-*.tar.gz ] && \
    echo "Backup de tus configs OctoPrint: $HOME_DIR/octoprint-backup-*.tar.gz"
