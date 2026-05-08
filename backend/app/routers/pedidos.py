"""Pedidos: lo que pide cada monitor para los niños de su grupo.

Ciclo de vida (tres fases):
  1. **pendiente** — El monitor crea el pedido para los niños de su grupo
     (algunos pueden no tener líneas). Si ya hay un pedido pendiente o
     preparado para ese grupo, se exige confirmación.
  2. **preparado** — El encargado del kiosko revisa cada línea y la marca
     como `listo`, `reemplazado` (con texto) o `descartado`. Cuando ya no
     queda ninguna línea en `pendiente`, marca el pedido como preparado.
  3. **completado** — El monitor recoge el pedido y reparte: para cada línea
     decide `entregado` o `descartado`. Al completar se generan las
     transacciones de compra (cobro de saldo) solo de las líneas entregadas.
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
def crear(
    payload: PedidoCreate,
    confirmar_duplicado: bool = Query(default=False),
    sesion: Session = Depends(get_session),
) -> Pedido:
    # 0. Si ya hay un pedido abierto para ese grupo, requerimos confirmación.
    if not confirmar_duplicado:
        abiertos = sesion.scalars(
            select(Pedido.id)
            .where(Pedido.grupo == payload.grupo)
            .where(Pedido.estado.in_(("pendiente", "preparado")))
        ).all()
        if abiertos:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "duplicado": True,
                    "pedidos_existentes": list(abiertos),
                },
            )

    # 1. Cargar todos los niños implicados
    nino_ids = {n.nino_id for n in payload.ninos}
    ninos = sesion.scalars(select(Nino).where(Nino.id.in_(nino_ids))).all()
    ninos_por_id = {n.id: n for n in ninos}

    for nid in nino_ids:
        if nid not in ninos_por_id:
            raise HTTPException(status_code=404, detail=f"Niño {nid} no encontrado.")

    # 2. Cargar todos los productos implicados
    prod_ids = {linea.producto_id for n in payload.ninos for linea in n.lineas}
    productos = sesion.scalars(select(Producto).where(Producto.id.in_(prod_ids))).all()
    prods_por_id = {p.id: p for p in productos}

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


# Estados de línea válidos según el estado del pedido. Cualquier otro intento → 409.
_LINEAS_ACEPTADAS_POR_PEDIDO: dict[str, frozenset[str]] = {
    "pendiente": frozenset({"pendiente", "listo", "reemplazado", "descartado"}),
    "preparado": frozenset({"listo", "reemplazado", "entregado", "descartado"}),
}


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
    linea = sesion.get(PedidoLinea, linea_id)
    if linea is None:
        raise HTTPException(status_code=404, detail="Línea no encontrada.")

    p_nino = linea.pedido_nino
    if p_nino.pedido_id != pedido_id:
        raise HTTPException(status_code=400, detail="La línea no pertenece a este pedido.")

    pedido = p_nino.pedido
    aceptados = _LINEAS_ACEPTADAS_POR_PEDIDO.get(pedido.estado)
    if aceptados is None:
        raise HTTPException(status_code=409, detail="El pedido ya está completado.")
    if payload.estado not in aceptados:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede pasar la línea a '{payload.estado}' "
                f"con el pedido en estado '{pedido.estado}'."
            ),
        )

    if payload.estado == "reemplazado" and not (payload.reemplazo_texto or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Indica con qué se reemplazó el producto.",
        )

    linea.estado = payload.estado
    linea.reemplazo_texto = (
        payload.reemplazo_texto.strip()
        if payload.estado == "reemplazado" and payload.reemplazo_texto
        else None
    )

    sesion.commit()
    sesion.refresh(linea)
    return linea


# ─── Marcar preparado (kiosko → monitor) ──────────────────────────────────


@router.post("/{pedido_id}/preparar", response_model=PedidoOut)
def preparar(pedido_id: int, sesion: Session = Depends(get_session)) -> Pedido:
    pedido = sesion.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if pedido.estado != "pendiente":
        raise HTTPException(
            status_code=409,
            detail="Solo se pueden preparar pedidos pendientes.",
        )

    for p_nino in pedido.ninos:
        for linea in p_nino.lineas:
            if linea.estado == "pendiente":
                raise HTTPException(
                    status_code=409,
                    detail=f"Faltan líneas por resolver para {p_nino.nino_nombre}.",
                )

    pedido.estado = "preparado"
    pedido.preparado_en = ahora_utc()
    sesion.commit()
    sesion.refresh(pedido)
    return pedido


# ─── Completar (monitor reparte y se cobra) ───────────────────────────────


@router.post("/{pedido_id}/completar", response_model=PedidoOut)
def completar(pedido_id: int, sesion: Session = Depends(get_session)) -> Pedido:
    pedido = sesion.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if pedido.estado != "preparado":
        raise HTTPException(
            status_code=409,
            detail="El pedido debe estar 'preparado' antes de completarlo.",
        )

    # Tras la fase de reparto, ninguna línea debería seguir en estado intermedio.
    for p_nino in pedido.ninos:
        for linea in p_nino.lineas:
            if linea.estado in ("pendiente", "listo", "reemplazado"):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Líneas sin repartir para {p_nino.nino_nombre} "
                        f"(estado '{linea.estado}')."
                    ),
                )

    # Procesar cada niño: solo las líneas entregadas se cobran.
    for p_nino in pedido.ninos:
        entregadas = [linea for linea in p_nino.lineas if linea.estado == "entregado"]
        if not entregadas:
            continue

        if p_nino.nino_id is None:
            raise HTTPException(
                status_code=409,
                detail=f"El niño {p_nino.nino_nombre} fue borrado; no se pueden cobrar sus entregas.",
            )

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


# ─── Borrar (pendiente o preparado: aún no se ha cobrado) ─────────────────


@router.delete("/{pedido_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def borrar(pedido_id: int, sesion: Session = Depends(get_session)) -> None:
    pedido = sesion.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if pedido.estado == "completado":
        raise HTTPException(
            status_code=409,
            detail="No se puede borrar un pedido completado (auditoría).",
        )
    sesion.delete(pedido)
    sesion.commit()
