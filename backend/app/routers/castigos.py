from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import CastigoActivo, CastigoHistorico, Nino
from app.tiempo import ahora_ms

router = APIRouter(tags=["castigos"])


_CASTIGO_HORAS = 12
_CASTIGO_MS = _CASTIGO_HORAS * 60 * 60 * 1000


@router.post("/api/ninos/{nino_id}/castigar", status_code=status.HTTP_201_CREATED)
def castigar(nino_id: int, sesion: Session = Depends(get_session)) -> dict:
    if sesion.get(Nino, nino_id) is None:
        raise HTTPException(status_code=404, detail="Niño no encontrado.")

    inicio = ahora_ms()
    fin = inicio + _CASTIGO_MS

    # Upsert manual (SQLite admite ON CONFLICT pero esto es más portable y legible).
    activo = sesion.get(CastigoActivo, nino_id)
    if activo is None:
        sesion.add(CastigoActivo(nino_id=nino_id, hasta=fin))
    else:
        activo.hasta = fin

    # Histórico siempre se inserta (queremos contar cada vez que se castiga).
    sesion.add(CastigoHistorico(nino_id=nino_id, fecha=inicio, hasta=fin, revocado=False))

    sesion.commit()
    return {"nino_id": nino_id, "hasta": fin}


@router.delete(
    "/api/ninos/{nino_id}/castigar",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
def revocar(nino_id: int, sesion: Session = Depends(get_session)) -> None:
    activo = sesion.get(CastigoActivo, nino_id)
    if activo is None:
        raise HTTPException(status_code=404, detail="No hay castigo activo para ese niño.")

    sesion.delete(activo)

    # Marcamos como revocado el último histórico no revocado del niño.
    ultimo = sesion.scalar(
        select(CastigoHistorico)
        .where(CastigoHistorico.nino_id == nino_id)
        .where(CastigoHistorico.revocado.is_(False))
        .order_by(CastigoHistorico.fecha.desc())
    )
    if ultimo is not None:
        ultimo.revocado = True

    sesion.commit()


@router.get("/api/castigos", response_model=dict[int, int])
def listar_activos(sesion: Session = Depends(get_session)) -> dict[int, int]:
    """Devuelve `{ nino_id: hasta_ms }`. Limpia los expirados sobre la marcha."""
    ahora = ahora_ms()
    sesion.execute(delete(CastigoActivo).where(CastigoActivo.hasta <= ahora))
    sesion.commit()

    filas = sesion.scalars(select(CastigoActivo)).all()
    return {f.nino_id: f.hasta for f in filas}


@router.get("/api/castigos/historico", response_model=dict[int, int])
def listar_historico(sesion: Session = Depends(get_session)) -> dict[int, int]:
    """Devuelve `{ nino_id: total_veces_castigado }` (sin contar revocados)."""
    filas = sesion.execute(
        select(CastigoHistorico.nino_id, func.count())
        .where(CastigoHistorico.revocado.is_(False))
        .group_by(CastigoHistorico.nino_id)
    ).all()
    return {nino_id: total for nino_id, total in filas}
