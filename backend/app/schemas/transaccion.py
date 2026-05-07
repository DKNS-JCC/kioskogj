from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LineaCompra(BaseModel):
    """Lo que el cliente envía al confirmar una compra."""

    id: int  # producto_id
    cantidad: int = Field(..., gt=0, le=99)


class TransaccionCreate(BaseModel):
    nino_id: int
    productos: list[LineaCompra] = Field(..., min_length=1)


class TransaccionCreada(BaseModel):
    """Respuesta del POST de compra: incluye `aviso_cota` para que el front
    pueda mostrar un mensaje no bloqueante si se ha pasado de la cota."""

    id: int
    total: float
    saldo_restante: float
    aviso_cota: bool


class _ProductoEnTx(BaseModel):
    """Snapshot de un producto dentro de `productos_json` de una transacción."""

    id: int
    nombre: str
    precio: float
    cantidad: int


class TransaccionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nino_id: int | None
    nino_nombre: str
    productos: list[_ProductoEnTx]
    total: float
    fecha_hora: datetime
    reembolsada: bool


class HistorialLinea(BaseModel):
    """Fila del historial de un niño: una línea por entrada de producto.

    El spec pide "productos expandidos uno a uno por línea". Esto permite a
    Stats / pantalla de historial mostrarlo en una tabla legible sin que el
    front tenga que parsear el JSON.
    """

    transaccion_id: int
    fecha_hora: datetime
    producto_id: int
    nombre: str
    precio_unitario: float
    cantidad: int
    subtotal: float
    reembolsada: bool
