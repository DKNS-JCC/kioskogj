"""Lecturas/escrituras tipadas sobre la tabla `configuracion` (clave/valor de
strings). Aísla el casting (str <-> float) en un solo sitio para no
sembrarlo por todos los routers.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Configuracion


def get_str(sesion: Session, clave: str, *, default: str | None = None) -> str | None:
    valor = sesion.get(Configuracion, clave)
    return valor.valor if valor else default


def get_float(sesion: Session, clave: str, *, default: float) -> float:
    raw = get_str(sesion, clave)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def set_str(sesion: Session, clave: str, valor: str) -> None:
    fila = sesion.get(Configuracion, clave)
    if fila is None:
        sesion.add(Configuracion(clave=clave, valor=valor))
    else:
        fila.valor = valor


# --- Helpers específicos ---


def cota_diaria(sesion: Session) -> float:
    return get_float(sesion, "cota_diaria", default=settings.cota_diaria_default)


def pin_admin(sesion: Session) -> str:
    return get_str(sesion, "pin_admin", default=settings.pin_admin_default) or settings.pin_admin_default


def claves_publicas() -> set[str]:
    """Claves devueltas por GET /api/configuracion. `pin_admin` queda fuera."""
    return {"cota_diaria"}
