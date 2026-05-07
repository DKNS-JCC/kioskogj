from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NinoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=80)
    apellidos: str = Field(..., min_length=1, max_length=120)
    grupo: int = Field(..., gt=0)
    dinero: float = Field(default=0.0, ge=0)


class NinoUpdate(BaseModel):
    """Todos los campos opcionales: solo se actualiza lo que llegue."""

    nombre: str | None = Field(default=None, min_length=1, max_length=80)
    apellidos: str | None = Field(default=None, min_length=1, max_length=120)
    grupo: int | None = Field(default=None, gt=0)
    dinero: float | None = Field(default=None, ge=0)


class NinoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    apellidos: str
    grupo: int
    dinero: float
    creado_en: datetime


class NinoInfo(BaseModel):
    """Lo que el front necesita para pintar la ficha rápida del niño:
    saldo, si ya compró hoy (badge azul), y cuánto ha gastado hoy (cota)."""

    saldo: float
    comprado_hoy: bool
    gastado_hoy: float
