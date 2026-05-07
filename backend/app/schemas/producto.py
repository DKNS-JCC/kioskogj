from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProductoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=80)
    precio: float = Field(..., gt=0)
    activo: bool = True
    categoria: str | None = Field(default=None, max_length=20)
    imagen: str | None = None


class ProductoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=80)
    precio: float | None = Field(default=None, gt=0)
    activo: bool | None = None
    categoria: str | None = Field(default=None, max_length=20)
    imagen: str | None = None


class ProductoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    precio: float
    activo: bool
    categoria: str | None
    imagen: str | None
    creado_en: datetime
