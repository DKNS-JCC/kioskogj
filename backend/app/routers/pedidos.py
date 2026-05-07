"""Pedidos: lo que pide cada monitor para los niños de su grupo.

Ciclo de vida:
  - Monitor del grupo crea un pedido para TODO su grupo (o parte de él).
  - Cada pedido engloba N niños, y cada niño tiene M líneas de productos.
  - El encargado del kiosko ve la cola pendiente agrupada por Pedido (grupo).
  - Por cada línea decide: entregado, reemplazado o descartado.
  - Cuando todas las líneas de TODOS los niños de un pedido están resueltas,
    el encargado completa el pedido.
  - Al completar, se genera UNA transacción por cada niño que tenga productos
    "entregados", usando la lógica estándar de compra.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Nino, Pedido, PedidoLinea, PedidoNino, Producto
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
    # 1. Cargar todos los niños implicados
    nino_ids = {n.nino_id for n in payload.ninos}
    ninos = sesion.scalars(select(Nino).where(Nino.id.in_(nino_ids))).all()
    ninos_por_id = {n.id: n for n in ninos}

    # Validar que todos los niños existen
    for nid in nino_ids:
        if nid not in ninos_por_id:
            raise HTTPException(status_code=404, detail=f"Niño {nid} no encontrado.")

    # 2. Cargar todos los productos implicados
    prod_ids = {linea.producto_id for n in payload.ninos for linea in n.lineas}
    productos = sesion.scalars(select(Producto).where(Producto.id.in_(prod_ids))).all()
    prods_por_id = {p.id: p for p in productos}

    # Validar productos
    for pid in prod_ids:
        p = prods_por_id.get(pid)
        if p is None:
            raise HTTPException(status_code=404, detail=f"Producto {pid} no encontrado.")
        if not p.activo:
            raise HTTPException(status_code=409, detail=f"Producto '{p.nombre}' está retirado.")

    # 3. Crear el Pedido (Grupo)
    pedido = Pedido(
        grupo=payload.grupo,
        estado="pendiente",
        nota=payload.nota,
        creado_en=ahora_utc(),
    )

    # 4. Añadir niños y sus líneas
    for nino_data in payload.ninos:
        nino = ninos_por_id[nino_data.nino_id]
        p_nino = PedidoNino(
            nino_id=nino.id,
            nino_nombre=f"{nino.nombre} {nino.apellidos}".strip(),
        )
        for linea_data in nino_data.lineas:
            prod = prods_por_id[linea_data.producto_id]
            p_nino.lineas.append(
                PedidoLinea(
                    producto_id=prod.id,
                    producto_nombre=prod.nombre,
                    producto_precio=prod.precio,
                    cantidad=linea_data.cantidad,
                    estado="pendiente",
                )
            )
        pedido.ninos.append(p_nino)

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
    # Verificamos que la línea existe y pertenece indirectamente al pedido
    linea = sesion.get(PedidoLinea, linea_id)
    if linea is None:
        raise HTTPException(status_code=404, detail="Línea no encontrada.")
    
    # Navegamos hacia arriba para validar el pedido
    p_nino = linea.pedido_nino
    if p_nino.pedido_id != pedido_id:
        raise HTTPException(status_code=400, detail="La línea no pertenece a este pedido.")

    pedido = p_nino.pedido
    if pedido.estado != "pendiente":
        raise HTTPException(status_code=409, detail="El pedido ya está completado.")

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


# ─── Completar (genera transacciones) ─────────────────────────────────────


@router.post("/{pedido_id}/completar", response_model=PedidoOut)
def completar(pedido_id: int, sesion: Session = Depends(get_session)) -> Pedido:
    pedido = sesion.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if pedido.estado != "pendiente":
        raise HTTPException(status_code=409, detail="El pedido ya está completado.")

    # 1. Validar que TODO está resuelto
    for p_nino in pedido.ninos:
        for linea in p_nino.lineas:
            if linea.estado == "pendiente":
                raise HTTPException(
                    status_code=409,
                    detail=f"Faltan líneas por resolver para {p_nino.nino_nombre}.",
                )

    # 2. Procesar cada niño
    for p_nino in pedido.ninos:
        if p_nino.nino_id is None:
            # Si el niño fue borrado, no podemos cobrarle.
            # Podríamos ignorarlo si no tiene entregas, pero por seguridad abortamos
            # si tiene algo que cobrar.
            entregadas = [linea for linea in p_nino.lineas if linea.estado == "entregado"]
            if entregadas:
                 raise HTTPException(
                    status_code=409,
                    detail=f"El niño {p_nino.nino_nombre} fue borrado; no se pueden cobrar sus entregas.",
                )
            continue

        entregadas = [linea for linea in p_nino.lineas if linea.estado == "entregado"]
        if not entregadas:
            continue

        # Validar productos existentes para cobrar
        sin_producto = [linea for linea in entregadas if linea.producto_id is None]
        if sin_producto:
            nombres = ", ".join(linea.producto_nombre for linea in sin_producto)
            raise HTTPException(
                status_code=409,
                detail=f"Productos eliminados del catálogo para {p_nino.nino_nombre}: {nombres}.",
            )

        lineas_compra = [
            LineaCompra(id=linea.producto_id, cantidad=linea.cantidad)  # type: ignore[arg-type]
            for linea in entregadas
        ]

        try:
            resultado = compra_service.crear_compra(
                sesion, p_nino.nino_id, lineas_compra
            )
            p_nino.transaccion_id = resultado.transaccion.id
        except compra_service.ErrorCompra as e:
            sesion.rollback()
            raise HTTPException(
                status_code=e.http,
                detail={"codigo": e.codigo, "mensaje": f"{p_nino.nino_nombre}: {str(e)}"},
            ) from e

    pedido.estado = "completado"
    pedido.completado_en = ahora_utc()
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
