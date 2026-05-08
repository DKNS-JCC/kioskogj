from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Estados como Literal: tipo seguro y se ven en el OpenAPI.
EstadoPedido = Literal["pendiente", "preparado", "completado"]
EstadoLinea = Literal["pendiente", "listo", "entregado", "reemplazado", "descartado"]


class PedidoLineaCreate(BaseModel):
    """Lo que el monitor envía al crear el pedido (1 producto del catálogo)."""

    producto_id: int
    cantidad: int = Field(..., gt=0, le=99)


class PedidoNinoCreate(BaseModel):
    """Líneas asignadas a un niño específico dentro de un pedido de grupo."""

    nino_id: int
    lineas: list[PedidoLineaCreate] = Field(..., min_length=1)


class PedidoCreate(BaseModel):
    """Creación de un pedido para un grupo entero (varios niños)."""

    grupo: int
    ninos: list[PedidoNinoCreate] = Field(..., min_length=1)
    nota: str | None = Field(default=None, max_length=200)


class PedidoDuplicadoError(BaseModel):
    """Respuesta 409 cuando ya existe un pedido abierto para el grupo."""

    duplicado: bool = True
    pedidos_existentes: list[int]


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


class PedidoNinoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nino_id: int | None
    nino_nombre: str
    transaccion_id: int | None
    lineas: list[PedidoLineaOut]


class PedidoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    grupo: int
    estado: EstadoPedido
    nota: str | None
    creado_en: datetime
    preparado_en: datetime | None
    completado_en: datetime | None
    ninos: list[PedidoNinoOut]
