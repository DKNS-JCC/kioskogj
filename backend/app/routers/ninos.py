from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_admin_pin
from app.db import get_session
from app.models import Nino
from app.schemas import HistorialLinea, NinoCreate, NinoInfo, NinoOut, NinoUpdate
from app.services import compra as compra_service
from app.services import historial as historial_service

router = APIRouter(prefix="/api/ninos", tags=["ninos"])


@router.get("", response_model=list[NinoOut])
def listar(sesion: Session = Depends(get_session)) -> list[Nino]:
    return list(sesion.scalars(select(Nino).order_by(Nino.grupo, Nino.nombre)).all())


@router.post("", response_model=NinoOut, status_code=status.HTTP_201_CREATED)
def crear(payload: NinoCreate, sesion: Session = Depends(get_session)) -> Nino:
    nino = Nino(**payload.model_dump())
    sesion.add(nino)
    sesion.commit()
    sesion.refresh(nino)
    return nino


@router.put("/{nino_id}", response_model=NinoOut)
def actualizar(
    nino_id: int,
    payload: NinoUpdate,
    sesion: Session = Depends(get_session),
) -> Nino:
    nino = sesion.get(Nino, nino_id)
    if nino is None:
        raise HTTPException(status_code=404, detail="Niño no encontrado.")
    for campo, valor in payload.model_dump(exclude_unset=True).items():
        setattr(nino, campo, valor)
    sesion.commit()
    sesion.refresh(nino)
    return nino


@router.delete("/{nino_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def borrar(nino_id: int, sesion: Session = Depends(get_session)) -> None:
    nino = sesion.get(Nino, nino_id)
    if nino is None:
        raise HTTPException(status_code=404, detail="Niño no encontrado.")
    sesion.delete(nino)
    sesion.commit()


@router.post(
    "/limpiar",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    dependencies=[Depends(require_admin_pin)],
)
def limpiar_todos(sesion: Session = Depends(get_session)) -> None:
    """Borra todos los niños (cierre de campamento). Requiere PIN admin."""
    sesion.query(Nino).delete()
    sesion.commit()


@router.get("/{nino_id}/info", response_model=NinoInfo)
def info(nino_id: int, sesion: Session = Depends(get_session)) -> NinoInfo:
    resultado = compra_service.info_nino(sesion, nino_id)
    if resultado is None:
        raise HTTPException(status_code=404, detail="Niño no encontrado.")
    saldo, comprado_hoy, gastado_hoy = resultado
    return NinoInfo(saldo=saldo, comprado_hoy=comprado_hoy, gastado_hoy=gastado_hoy)


@router.get("/{nino_id}/historial", response_model=list[HistorialLinea])
def historial(nino_id: int, sesion: Session = Depends(get_session)) -> list[HistorialLinea]:
    if sesion.get(Nino, nino_id) is None:
        raise HTTPException(status_code=404, detail="Niño no encontrado.")
    return historial_service.historial_de_nino(sesion, nino_id)
