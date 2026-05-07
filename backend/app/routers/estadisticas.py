from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas import EstadisticasOut
from app.services import estadisticas as stats

router = APIRouter(prefix="/api/estadisticas", tags=["estadisticas"])


@router.get("", response_model=EstadisticasOut)
def calcular(sesion: Session = Depends(get_session)) -> EstadisticasOut:
    return stats.calcular(sesion)
