from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_admin_pin
from app.db import get_session
from app.schemas import ConfiguracionOut, ConfiguracionUpdate
from app.services import configuracion as cfg

router = APIRouter(prefix="/api/configuracion", tags=["configuracion"])


@router.get("", response_model=ConfiguracionOut)
def leer(sesion: Session = Depends(get_session)) -> ConfiguracionOut:
    return ConfiguracionOut(cota_diaria=cfg.cota_diaria(sesion))


@router.post("", response_model=ConfiguracionOut, dependencies=[Depends(require_admin_pin)])
def actualizar(payload: ConfiguracionUpdate, sesion: Session = Depends(get_session)) -> ConfiguracionOut:
    """Cambia la configuración. Requiere PIN admin (incluso para `cota_diaria`,
    porque editar la cota afecta a la operación; mejor evitar ediciones
    accidentales)."""
    if payload.cota_diaria is not None:
        cfg.set_str(sesion, "cota_diaria", str(payload.cota_diaria))
    if payload.pin_admin is not None:
        cfg.set_str(sesion, "pin_admin", payload.pin_admin)
    sesion.commit()
    return ConfiguracionOut(cota_diaria=cfg.cota_diaria(sesion))
