# kiosko-gj-backend

API del kiosko de campamento (FastAPI + SQLite). Pensada para Raspberry Pi 3B+.

## Arranque rápido (portable)

No necesitas tener Python instalado. El script descarga `uv` (gestor de Astral) y
con él el intérprete correcto, crea el venv y resuelve dependencias.

- **Windows**: doble clic en `dev.bat`, o `.\dev.ps1` desde PowerShell.
- **Linux / macOS**: `./dev.sh`.

Primer arranque requiere internet. Posteriores quedan en caché de `uv`.

## Variables de entorno

Se leen de `.env` (se copia automáticamente desde `.env.example` la primera vez).
Todas las claves van prefijadas con `KIOSKO_`.
