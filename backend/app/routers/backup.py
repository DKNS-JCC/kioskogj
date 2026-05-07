"""Endpoint de backup de la base de datos.

Devuelve un .db consistente usando la API oficial de copia de SQLite
(`sqlite3.Connection.backup`). Esa API funciona aunque la base esté en
modo WAL con escrituras en curso (es la forma recomendada). Como el
volumen del kiosko es pequeño (KB), no necesitamos streaming chunked.
"""

from __future__ import annotations

import os
import sqlite3
import tempfile
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.auth import require_admin_pin
from app.config import settings

router = APIRouter(prefix="/api/backup", tags=["backup"])


@router.get("", dependencies=[Depends(require_admin_pin)])
def descargar_backup() -> FileResponse:
    db_path = str(settings.db_path.resolve())
    if not os.path.isfile(db_path):
        raise HTTPException(status_code=500, detail="La base de datos no existe.")

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
    return FileResponse(
        tmp_path,
        filename=nombre,
        media_type="application/x-sqlite3",
        # Borra el temporal despues de servirlo para no acumular ficheros en /tmp.
        background=BackgroundTask(os.unlink, tmp_path),
    )
