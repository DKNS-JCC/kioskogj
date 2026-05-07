"""Sembrado de la tabla `configuracion` al arranque.

Garantiza que las claves obligatorias (`cota_diaria`, `pin_admin`) tienen un
valor antes de que llegue el primer request. Idempotente: si ya existen, no
las toca.
"""

from __future__ import annotations

from loguru import logger
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.services import configuracion as cfg


def sembrar_defaults() -> None:
    sesion: Session = SessionLocal()
    try:
        if cfg.get_str(sesion, "cota_diaria") is None:
            cfg.set_str(sesion, "cota_diaria", str(settings.cota_diaria_default))
            logger.info("Seed: cota_diaria = {}", settings.cota_diaria_default)

        if cfg.get_str(sesion, "pin_admin") is None:
            cfg.set_str(sesion, "pin_admin", settings.pin_admin_default)
            logger.warning(
                "Seed: pin_admin se ha puesto al valor por defecto ({}). "
                "Cámbialo desde Ajustes en cuanto puedas.",
                settings.pin_admin_default,
            )

        sesion.commit()
    finally:
        sesion.close()
