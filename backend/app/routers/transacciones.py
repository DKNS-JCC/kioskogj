from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Nino, Transaccion
from app.schemas import (
    TransaccionCreada,
    TransaccionCreate,
    TransaccionOut,
)
from app.services import compra as compra_service
from app.services.historial import transaccion_a_dict

router = APIRouter(prefix="/api/transacciones", tags=["transacciones"])


@router.post("", response_model=TransaccionCreada, status_code=status.HTTP_201_CREATED)
def crear(payload: TransaccionCreate, sesion: Session = Depends(get_session)) -> TransaccionCreada:
    try:
        resultado = compra_service.crear_compra(sesion, payload.nino_id, payload.productos)
    except compra_service.ErrorCompra as e:
        sesion.rollback()
        raise HTTPException(status_code=e.http, detail={"codigo": e.codigo, "mensaje": str(e)}) from e

    sesion.commit()
    sesion.refresh(resultado.transaccion)
    nino_saldo = sesion.get(Nino, payload.nino_id).dinero  # type: ignore[union-attr]
    return TransaccionCreada(
        id=resultado.transaccion.id,
        total=resultado.transaccion.total,
        saldo_restante=nino_saldo,
        aviso_cota=resultado.aviso_cota,
    )


@router.get("", response_model=list[TransaccionOut])
def listar(
    fecha_inicio: datetime | None = Query(default=None),
    fecha_fin: datetime | None = Query(default=None),
    nino_id: int | None = Query(default=None),
    grupo: int | None = Query(default=None),
    busqueda: str | None = Query(default=None, description="Coincide en nino_nombre."),
    sesion: Session = Depends(get_session),
) -> list[dict]:
    stmt = select(Transaccion).order_by(Transaccion.fecha_hora.desc())

    if fecha_inicio is not None:
        stmt = stmt.where(Transaccion.fecha_hora >= fecha_inicio)
    if fecha_fin is not None:
        stmt = stmt.where(Transaccion.fecha_hora < fecha_fin)
    if nino_id is not None:
        stmt = stmt.where(Transaccion.nino_id == nino_id)
    if grupo is not None:
        # Filtro por grupo: join opcional. Si el niño se borró (nino_id NULL)
        # no podemos saber su grupo, así que esa fila no entra en el resultado.
        stmt = stmt.join(Nino, Nino.id == Transaccion.nino_id).where(Nino.grupo == grupo)
    if busqueda:
        patron = f"%{busqueda.strip()}%"
        stmt = stmt.where(Transaccion.nino_nombre.ilike(patron))

    return [transaccion_a_dict(tx) for tx in sesion.scalars(stmt).all()]


@router.post("/{transaccion_id}/reembolsar", response_model=TransaccionOut)
def reembolsar(transaccion_id: int, sesion: Session = Depends(get_session)) -> dict:
    try:
        tx = compra_service.reembolsar(sesion, transaccion_id)
    except compra_service.ErrorCompra as e:
        sesion.rollback()
        raise HTTPException(status_code=e.http, detail={"codigo": e.codigo, "mensaje": str(e)}) from e
    sesion.commit()
    sesion.refresh(tx)
    return transaccion_a_dict(tx)
