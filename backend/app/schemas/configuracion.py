from __future__ import annotations

from pydantic import BaseModel, Field


class ConfiguracionOut(BaseModel):
    """Sólo claves públicas. `pin_admin` NO se devuelve nunca."""

    cota_diaria: float


class ConfiguracionUpdate(BaseModel):
    """Cambios. Cualquier clave aquí presente se actualiza; el resto no se toca."""

    cota_diaria: float | None = Field(default=None, ge=0)
    pin_admin: str | None = Field(default=None, min_length=4, max_length=12)
