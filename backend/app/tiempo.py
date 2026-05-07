"""Utilidades de tiempo. Centralizadas para no esparcir conversiones por todo
el código.

La frontera de "hoy" depende de la zona horaria configurada (Europa/Madrid por
defecto). Si la Pi tiene reloj en UTC y no convertimos, la cota diaria
empezaría a las 02:00 hora local en verano. Mal.
"""

from __future__ import annotations

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.config import settings


def tz() -> ZoneInfo:
    return ZoneInfo(settings.tz)


def ahora_utc() -> datetime:
    return datetime.now(UTC)


def ahora_ms() -> int:
    """Epoch en milisegundos (formato usado por castigos, compatible con Date.now())."""
    return int(ahora_utc().timestamp() * 1000)


def inicio_dia_local(momento: datetime | None = None) -> datetime:
    """Devuelve el datetime UTC del último 00:00 hora local."""
    momento = momento or ahora_utc()
    local = momento.astimezone(tz())
    inicio_local = datetime.combine(local.date(), time.min, tzinfo=tz())
    return inicio_local.astimezone(UTC)


def fin_dia_local(momento: datetime | None = None) -> datetime:
    return inicio_dia_local(momento) + timedelta(days=1)
