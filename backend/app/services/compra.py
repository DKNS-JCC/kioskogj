"""Lógica del flujo de compra.

Extraída del router para que la transacción atómica (verificación de
castigo + saldo + decremento + insert) viva en un único sitio testeable.

Reglas (sección 4 del spec):
  1. El niño no puede estar castigado.
  2. El total se calcula con los precios actuales del catálogo (no fiarse
     del cliente).
  3. El saldo debe cubrirlo.
  4. Si supera la cota diaria, NO bloquea: solo marca `aviso_cota` en la
     respuesta.
  5. Decremento de saldo + insert de transacción atómicos.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CastigoActivo, Nino, Producto, Transaccion
from app.schemas.transaccion import LineaCompra
from app.services import configuracion as cfg
from app.tiempo import ahora_ms, ahora_utc, inicio_dia_local


class ErrorCompra(Exception):
    """Error de negocio en la compra. El router lo mapea a 4xx."""

    def __init__(self, codigo: str, mensaje: str, http: int = 400) -> None:
        super().__init__(mensaje)
        self.codigo = codigo
        self.http = http


@dataclass
class ResultadoCompra:
    transaccion: Transaccion
    aviso_cota: bool


def crear_compra(
    sesion: Session,
    nino_id: int,
    lineas: list[LineaCompra],
) -> ResultadoCompra:
    # 1) Niño existe y no está castigado.
    nino = sesion.get(Nino, nino_id)
    if nino is None:
        raise ErrorCompra("nino_no_encontrado", "El niño no existe.", http=404)

    castigo = sesion.get(CastigoActivo, nino_id)
    if castigo is not None:
        if castigo.hasta > ahora_ms():
            raise ErrorCompra(
                "nino_castigado",
                "El niño está castigado y no puede comprar.",
                http=409,
            )
        # Castigo expirado: limpiamos sobre la marcha.
        sesion.delete(castigo)

    # 2) Cargamos productos por ID y construimos el snapshot.
    ids = [linea.id for linea in lineas]
    productos = sesion.scalars(
        select(Producto).where(Producto.id.in_(ids))
    ).all()
    productos_por_id = {p.id: p for p in productos}

    snapshot: list[dict] = []
    total = 0.0
    for linea in lineas:
        producto = productos_por_id.get(linea.id)
        if producto is None:
            raise ErrorCompra(
                "producto_no_encontrado",
                f"El producto {linea.id} no existe.",
                http=404,
            )
        if not producto.activo:
            raise ErrorCompra(
                "producto_inactivo",
                f"El producto '{producto.nombre}' está retirado.",
                http=409,
            )
        subtotal = round(producto.precio * linea.cantidad, 2)
        total = round(total + subtotal, 2)
        snapshot.append({
            "id": producto.id,
            "nombre": producto.nombre,
            "precio": producto.precio,
            "cantidad": linea.cantidad,
        })

    if total <= 0:
        raise ErrorCompra("total_invalido", "El total debe ser positivo.")

    # 3) Saldo suficiente.
    if nino.dinero + 1e-9 < total:
        raise ErrorCompra(
            "saldo_insuficiente",
            f"Saldo insuficiente: tiene {nino.dinero:.2f}€ y la compra suma {total:.2f}€.",
            http=409,
        )

    # 4) Aviso de cota diaria (no bloquea).
    cota = cfg.cota_diaria(sesion)
    gastado_hoy = _gastado_hoy(sesion, nino_id)
    aviso_cota = (gastado_hoy + total) > cota

    # 5) Atomicidad: SQLAlchemy ya envuelve la sesión en transacción; basta
    # un único commit al final del request. Aquí solo flush para obtener id.
    nino.dinero = round(nino.dinero - total, 2)
    tx = Transaccion(
        nino_id=nino.id,
        nino_nombre=f"{nino.nombre} {nino.apellidos}".strip(),
        productos_json=json.dumps(snapshot, ensure_ascii=False),
        total=total,
        fecha_hora=ahora_utc(),
        reembolsada=False,
    )
    sesion.add(tx)
    sesion.flush()

    return ResultadoCompra(transaccion=tx, aviso_cota=aviso_cota)


def reembolsar(sesion: Session, transaccion_id: int) -> Transaccion:
    """Devuelve el dinero al niño y marca la transacción como reembolsada."""
    tx = sesion.get(Transaccion, transaccion_id)
    if tx is None:
        raise ErrorCompra("transaccion_no_encontrada", "Transacción no encontrada.", http=404)
    if tx.reembolsada:
        raise ErrorCompra("ya_reembolsada", "La transacción ya estaba reembolsada.", http=409)

    if tx.nino_id is not None:
        nino = sesion.get(Nino, tx.nino_id)
        if nino is not None:
            nino.dinero = round(nino.dinero + tx.total, 2)

    tx.reembolsada = True
    sesion.flush()
    return tx


# --- Helpers ---


def _gastado_hoy(sesion: Session, nino_id: int) -> float:
    """Suma de transacciones no reembolsadas del niño desde 00:00 hora local."""
    inicio = inicio_dia_local()
    total = sesion.scalar(
        select(func.coalesce(func.sum(Transaccion.total), 0.0))
        .where(Transaccion.nino_id == nino_id)
        .where(Transaccion.reembolsada.is_(False))
        .where(Transaccion.fecha_hora >= inicio)
    )
    return float(total or 0.0)


def info_nino(sesion: Session, nino_id: int) -> tuple[float, bool, float] | None:
    """Devuelve (saldo, comprado_hoy, gastado_hoy) o None si no existe."""
    nino = sesion.get(Nino, nino_id)
    if nino is None:
        return None
    gastado = _gastado_hoy(sesion, nino_id)
    return (nino.dinero, gastado > 0, gastado)
