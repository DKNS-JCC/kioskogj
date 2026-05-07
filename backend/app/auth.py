"""Autenticación admin: header `X-Admin-Pin`.

Diseño elegido a propósito por simplicidad (la app vive en LAN o detrás de
Tailscale): el cliente envía el PIN tal cual; el backend lo compara con la
clave `pin_admin` de la tabla `configuracion` (con un default seedado al
primer arranque desde `settings.pin_admin_default`).

Si más adelante quisiéramos endurecerlo (sesiones, expiración, hash) se
sustituye este módulo sin tocar los routers porque todos dependen del mismo
`Depends(require_admin_pin)`.
"""

from __future__ import annotations

import hmac

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.services import configuracion as cfg


def require_admin_pin(
    sesion: Session = Depends(get_session),
    x_admin_pin: str | None = Header(default=None, alias="X-Admin-Pin"),
) -> None:
    """Dependencia: rechaza con 401 si el PIN no coincide.

    Comparación con `hmac.compare_digest` para evitar timing attacks (más
    paranoia que necesidad real, pero gratis).
    """
    if not x_admin_pin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta el header X-Admin-Pin.",
        )
    esperado = cfg.pin_admin(sesion)
    if not hmac.compare_digest(x_admin_pin, esperado):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN incorrecto.",
        )
