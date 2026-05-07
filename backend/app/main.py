"""Punto de entrada FastAPI.

- Configura logging con loguru y redirige stdlib logging a loguru.
- Hace seed de la configuración por defecto en el lifespan startup.
- Registra todos los routers.
- CORS abierto a los orígenes definidos en `KIOSKO_CORS_ORIGINS`.

Arrancar en desarrollo:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

from app.config import settings
from app.routers import (
    backup,
    castigos,
    configuracion,
    estadisticas,
    ninos,
    productos,
    transacciones,
)
from app.seed import sembrar_defaults


def _configurar_logs() -> None:
    """Loguru único sumidero, redirigiendo logs de uvicorn / sqlalchemy."""
    logger.remove()
    logger.add(
        sys.stderr,
        level=settings.log_level,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> "
            "<level>{level:<7}</level> "
            "<cyan>{name}</cyan>:<cyan>{line}</cyan> {message}"
        ),
        backtrace=False,
        diagnose=False,
    )

    class _InterceptHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:  # noqa: D401
            try:
                level = logger.level(record.levelname).name
            except ValueError:
                level = record.levelno
            logger.opt(depth=6, exception=record.exc_info).log(level, record.getMessage())

    logging.basicConfig(handlers=[_InterceptHandler()], level=0, force=True)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    _configurar_logs()
    logger.info("Arrancando Kiosko GJ — DB: {}", settings.database_url)
    sembrar_defaults()
    yield
    logger.info("Cerrando Kiosko GJ.")


app = FastAPI(
    title="Kiosko GJ API",
    version="2.0.0",
    description="API del kiosko de campamento. Pensada para Raspberry Pi 3B+.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"ok": True}


app.include_router(ninos.router)
app.include_router(productos.router)
app.include_router(transacciones.router)
app.include_router(castigos.router)
app.include_router(configuracion.router)
app.include_router(estadisticas.router)
app.include_router(backup.router)

import os
os.makedirs("static/productos", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

def run_dev() -> None:
    """Atajo para `kiosko-dev` (definido en pyproject.toml)."""
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
