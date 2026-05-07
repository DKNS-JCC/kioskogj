"""Pedidos: lo que pide cada monitor para los niños de su grupo.

Ciclo de vida:
  - Monitor del grupo crea un pedido por niño con sus líneas (productos del
    catálogo + cantidades).
  - El encargado del kiosko ve la cola pendiente. Por cada línea decide:
      * entregado    → se cobra al completar el pedido.
      * reemplazado  → texto libre con lo que dio en su lugar (no se cobra).
      * descartado   → no había, no se da nada (no se cobra).
  - Cuando todas las líneas están resueltas (ninguna pendiente), el
    encargado completa el pedido y se genera UNA transacción con las
    líneas entregadas usando la misma lógica que la compra directa
    (castigo + saldo + cota).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Nino, Pedido, PedidoLinea, Producto
from app.schemas import (
    PedidoCreate,
    PedidoLineaOut,
    PedidoLineaUpdate,
    PedidoOut,
)
from app.schemas.pedido import EstadoPedido
from app.schemas.transaccion import LineaCompra
from app.services import compra as compra_service
from app.tiempo import ahora_utc


router = APIRouter(prefix="/api/pedidos", tags=["pedidos"])


# ─── Crear ────────────────────────────────────────────────────────────────


@router.post("", response_model=PedidoOut, status_code=status.HTTP_201_CREATED)
def crear(payload: PedidoCreate, sesion: Session = Depends(get_session)) -> Pedido:
    nino = sesion.get(Nino, payload.nino_id)
    if nino is None:
        raise HTTPException(status_code=404, detail="Niño no encontrado.")

    # Cargar productos por id de una sola query para validar y snapshotear precios.
    ids = list({l.producto_id for l in payload.lineas})
    productos = sesion.scalars(select(Producto).where(Producto.id.in_(ids))).all()
    por_id = {p.id: p for p in productos}

    pedido = Pedido(
        nino_id=nino.id,
        nino_nombre=f"{nino.nombre} {nino.apellidos}".strip(),
        grupo=nino.grupo,
        estado="pendiente",
        nota=payload.nota,
        creado_en=ahora_utc(),
    )

    for linea in payload.lineas:
        prod = por_id.get(linea.producto_id)
        if prod is None:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {linea.producto_id} no encontrado.",
            )
        if not prod.activo:
            raise HTTPException(
                status_code=409,
                detail=f"Producto '{prod.nombre}' está retirado.",
            )
        pedido.lineas.append(
            PedidoLinea(
                producto_id=prod.id,
                producto_nombre=prod.nombre,
                producto_precio=prod.precio,
                cantidad=linea.cantidad,
                estado="pendiente",
            )
        )

    sesion.add(pedido)
    sesion.commit()
    sesion.refresh(pedido)
    return pedido


# ─── Listar / detalle ─────────────────────────────────────────────────────


@router.get("", response_model=list[PedidoOut])
def listar(
    estado: EstadoPedido | None = Query(default=None),
    grupo: int | None = Query(default=None),
    sesion: Session = Depends(get_session),
) -> list[Pedido]:
    stmt = select(Pedido).order_by(Pedido.creado_en.desc())
    if estado is not None:
        stmt = stmt.where(Pedido.estado == estado)
    if grupo is not None:
        stmt = stmt.where(Pedido.grupo == grupo)
    return list(sesion.scalars(stmt).all())


@router.get("/{pedido_id}", response_model=PedidoOut)
def detalle(pedido_id: int, sesion: Session = Depends(get_session)) -> Pedido:
    pedido = sesion.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    return pedido


# ─── Líneas: cambiar estado ───────────────────────────────────────────────


@router.put(
    "/{pedido_id}/lineas/{linea_id}",
    response_model=PedidoLineaOut,
)
def actualizar_linea(
    pedido_id: int,
    linea_id: int,
    payload: PedidoLineaUpdate,
    sesion: Session = Depends(get_session),
) -> PedidoLinea:
    pedido = sesion.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if pedido.estado != "pendiente":
        raise HTTPException(status_code=409, detail="El pedido ya está completado.")

    linea = sesion.get(PedidoLinea, linea_id)
    if linea is None or linea.pedido_id != pedido_id:
        raise HTTPException(status_code=404, detail="Línea no encontrada.")

    if payload.estado == "reemplazado" and not (payload.reemplazo_texto or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Indica con qué se reemplazó el producto.",
        )

    linea.estado = payload.estado
    linea.reemplazo_texto = (
        payload.reemplazo_texto.strip() if payload.estado == "reemplazado" and payload.reemplazo_texto else None
    )

    sesion.commit()
    sesion.refresh(linea)
    return linea


# ─── Completar (genera transacción) ───────────────────────────────────────


@router.post("/{pedido_id}/completar", response_model=PedidoOut)
def completar(pedido_id: int, sesion: Session = Depends(get_session)) -> Pedido:
    pedido = sesion.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if pedido.estado != "pendiente":
        raise HTTPException(status_code=409, detail="El pedido ya está completado.")
    if pedido.nino_id is None:
        raise HTTPException(
            status_code=409,
            detail="El niño del pedido fue borrado; no se puede completar.",
        )

    pendientes = [l for l in pedido.lineas if l.estado == "pendiente"]
    if pendientes:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Faltan {len(pendientes)} líneas por resolver "
                "(márcalas como entregadas, reemplazadas o descartadas)."
            ),
        )

    entregadas = [l for l in pedido.lineas if l.estado == "entregado"]
    tx_id: int | None = None

    if entregadas:
        # Si algún producto entregado fue borrado del catálogo, abortamos para
        # no cobrar a precios desactualizados o sin referencia.
        sin_producto = [l for l in entregadas if l.producto_id is None]
        if sin_producto:
            nombres = ", ".join(l.producto_nombre for l in sin_producto)
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Productos del pedido eliminados del catálogo: {nombres}. "
                    "Márcalos como reemplazados o descartados."
                ),
            )

        lineas_compra = [
            LineaCompra(id=l.producto_id, cantidad=l.cantidad)  # type: ignore[arg-type]
            for l in entregadas
        ]
        try:
            resultado = compra_service.crear_compra(
                sesion, pedido.nino_id, lineas_compra
            )
        except compra_service.ErrorCompra as e:
            sesion.rollback()
            raise HTTPException(
                status_code=e.http,
                detail={"codigo": e.codigo, "mensaje": str(e)},
            ) from e
        tx_id = resultado.transaccion.id

    pedido.estado = "completado"
    pedido.completado_en = ahora_utc()
    pedido.transaccion_id = tx_id
    sesion.commit()
    sesion.refresh(pedido)
    return pedido


# ─── Borrar (solo pendientes) ─────────────────────────────────────────────


@router.delete("/{pedido_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def borrar(pedido_id: int, sesion: Session = Depends(get_session)) -> None:
    pedido = sesion.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if pedido.estado != "pendiente":
        raise HTTPException(
            status_code=409,
            detail="No se puede borrar un pedido completado (auditoría).",
        )
    sesion.delete(pedido)
    sesion.commit()
