import os
import smtplib
import sqlite3
import sys
import tempfile
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path

# Añade la ruta del backend al PATH para poder importar app.config
sys.path.append(str(Path(__file__).parent.parent))

from app.config import settings

TARGET_EMAIL = os.getenv("KIOSKO_BACKUP_EMAIL", "tu_correo@ejemplo.com")
SMTP_SERVER = os.getenv("KIOSKO_SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("KIOSKO_SMTP_PORT", "587"))
SMTP_USER = os.getenv("KIOSKO_SMTP_USER", "")
SMTP_PASS = os.getenv("KIOSKO_SMTP_PASS", "")

def send_backup():
    print("Generando backup...")
    db_path = str(settings.db_path.resolve())
    if not os.path.isfile(db_path):
        print("Error: La base de datos no existe.")
        return

    fd, tmp_path = tempfile.mkstemp(suffix=".db", prefix="kiosko-backup-")
    os.close(fd)

    src = sqlite3.connect(db_path)
    try:
        dst = sqlite3.connect(tmp_path)
        try:
            src.backup(dst)
        finally:
            dst.close()
    finally:
        src.close()

    nombre = f"kiosko-backup-{datetime.now():%Y%m%d-%H%M%S}.db"

    msg = EmailMessage()
    msg['Subject'] = f'Backup Diario Kiosko - {nombre}'
    msg['From'] = SMTP_USER
    msg['To'] = TARGET_EMAIL
    msg.set_content(f'Adjunto encontrarás el backup automático de la base de datos del kiosko.\nFecha: {datetime.now():%Y-%m-%d %H:%M:%S}')

    with open(tmp_path, 'rb') as f:
        msg.add_attachment(f.read(), maintype='application', subtype='x-sqlite3', filename=nombre)

    if SMTP_USER and SMTP_PASS:
        print(f"Enviando correo a {TARGET_EMAIL}...")
        try:
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
            print("Backup enviado exitosamente.")
        except Exception as e:
            print(f"Error enviando correo: {e}")
    else:
        print("Advertencia: No se envió el correo. Configura las variables KIOSKO_SMTP_USER y KIOSKO_SMTP_PASS.")
        
    os.unlink(tmp_path)

if __name__ == "__main__":
    send_backup()
