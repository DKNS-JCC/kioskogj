from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class TopNino(BaseModel):
    nino_id: int | None
    nino_nombre: str
    total: float


class VentasDia(BaseModel):
    fecha: date
    total: float


class EstadisticasOut(BaseModel):
    total_ventas: float
    ventas_hoy: float
    top_ninos: list[TopNino]
    ventas_por_dia: list[VentasDia]
