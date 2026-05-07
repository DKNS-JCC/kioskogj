"""Construcción del historial expandido por línea (una fila por (transacción,
producto). El spec lo pide así para que el front lo pinte tal cual."""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Transaccion
from app.schemas.transaccion import HistorialLinea


def historial_de_nino(sesion: Session, nino_id: int) -> list[HistorialLinea]:
    txs = sesion.scalars(
        select(Transaccion)
        .where(Transaccion.nino_id == nino_id)
        .order_by(Transaccion.fecha_hora.desc())
    ).all()

    lineas: list[HistorialLinea] = []
    for tx in txs:
        try:
            productos = json.loads(tx.productos_json or "[]")
        except json.JSONDecodeError:
            productos = []
        for p in productos:
            try:
                precio = float(p.get("precio", 0))
                cantidad = int(p.get("cantidad", 0))
                lineas.append(HistorialLinea(
                    transaccion_id=tx.id,
                    fecha_hora=tx.fecha_hora,
                    producto_id=int(p.get("id", 0)),
                    nombre=str(p.get("nombre", "?")),
                    precio_unitario=precio,
                    cantidad=cantidad,
                    subtotal=round(precio * cantidad, 2),
                    reembolsada=tx.reembolsada,
                ))
            except (TypeError, ValueError):
                # Línea corrupta en el JSON: la saltamos sin abortar.
                continue
    return lineas


def transaccion_a_dict(tx: Transaccion) -> dict:
    """Convierte una `Transaccion` ORM al formato que espera `TransaccionOut`,
    con `productos` ya parseado en lugar de `productos_json`."""
    try:
        productos = json.loads(tx.productos_json or "[]")
    except json.JSONDecodeError:
        productos = []
    return {
        "id": tx.id,
        "nino_id": tx.nino_id,
        "nino_nombre": tx.nino_nombre,
        "productos": productos,
        "total": tx.total,
        "fecha_hora": tx.fecha_hora,
        "reembolsada": tx.reembolsada,
    }
