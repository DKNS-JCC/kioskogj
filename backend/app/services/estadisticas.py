"""Agregaciones para el endpoint de estadísticas."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Transaccion
from app.schemas.estadisticas import EstadisticasOut, TopNino, VentasDia
from app.tiempo import inicio_dia_local

_DIAS_GRAFICO = 10


def calcular(sesion: Session) -> EstadisticasOut:
    no_reembolsada = Transaccion.reembolsada.is_(False)

    total_ventas = sesion.scalar(
        select(func.coalesce(func.sum(Transaccion.total), 0.0))
        .where(no_reembolsada)
    ) or 0.0

    inicio_hoy = inicio_dia_local()
    ventas_hoy = sesion.scalar(
        select(func.coalesce(func.sum(Transaccion.total), 0.0))
        .where(no_reembolsada)
        .where(Transaccion.fecha_hora >= inicio_hoy)
    ) or 0.0

    # Top 5 niños por gasto. Agrupamos por (nino_id, nombre) — el nombre
    # desnormalizado nos permite seguir contando aunque el niño se haya borrado.
    top_filas = sesion.execute(
        select(
            Transaccion.nino_id,
            Transaccion.nino_nombre,
            func.sum(Transaccion.total).label("total"),
        )
        .where(no_reembolsada)
        .group_by(Transaccion.nino_id, Transaccion.nino_nombre)
        .order_by(func.sum(Transaccion.total).desc())
        .limit(5)
    ).all()
    top = [
        TopNino(nino_id=row.nino_id, nino_nombre=row.nino_nombre, total=float(row.total))
        for row in top_filas
    ]

    # Ventas por día de los últimos 10 días, rellenando huecos con 0.
    inicio_ventana = inicio_hoy - timedelta(days=_DIAS_GRAFICO - 1)
    filas_dia = sesion.execute(
        select(
            func.date(Transaccion.fecha_hora).label("fecha"),
            func.sum(Transaccion.total).label("total"),
        )
        .where(no_reembolsada)
        .where(Transaccion.fecha_hora >= inicio_ventana)
        .group_by(func.date(Transaccion.fecha_hora))
    ).all()
    por_fecha: dict[date, float] = {}
    for row in filas_dia:
        # SQLite devuelve la fecha como string YYYY-MM-DD.
        fecha = row.fecha if isinstance(row.fecha, date) else date.fromisoformat(str(row.fecha))
        por_fecha[fecha] = float(row.total)

    ventas_por_dia: list[VentasDia] = []
    hoy_local = inicio_hoy.date()
    for i in range(_DIAS_GRAFICO):
        d = hoy_local - timedelta(days=_DIAS_GRAFICO - 1 - i)
        ventas_por_dia.append(VentasDia(fecha=d, total=por_fecha.get(d, 0.0)))

    return EstadisticasOut(
        total_ventas=float(total_ventas),
        ventas_hoy=float(ventas_hoy),
        top_ninos=top,
        ventas_por_dia=ventas_por_dia,
    )
