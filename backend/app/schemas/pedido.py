from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# Estados como Literal: tipo seguro y se ven en el OpenAPI.
EstadoPedido = Literal["pendiente", "completado"]
EstadoLinea = Literal["pendiente", "entregado", "reemplazado", "descartado"]


class PedidoLineaCreate(BaseModel):
    """Lo que el monitor envía al crear el pedido (1 producto del catálogo)."""

    producto_id: int
    cantidad: int = Field(..., gt=0, le=99)


class PedidoCreate(BaseModel):
    nino_id: int
    lineas: list[PedidoLineaCreate] = Field(..., min_length=1)
    nota: str | None = Field(default=None, max_length=200)


class PedidoLineaUpdate(BaseModel):
    estado: EstadoLinea
    # Solo se usa cuando estado == 'reemplazado'.
    reemplazo_texto: str | None = Field(default=None, max_length=120)


class PedidoLineaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    producto_id: int | None
    producto_nombre: str
    producto_precio: float
    cantidad: int
    estado: EstadoLinea
    reemplazo_texto: str | None


class PedidoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nino_id: int | None
    nino_nombre: str
    grupo: int
    estado: EstadoPedido
    nota: str | None
    creado_en: datetime
    completado_en: datetime | None
    transaccion_id: int | None
    lineas: list[PedidoLineaOut]
