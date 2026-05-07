from __future__ import annotations

from pydantic import RootModel


class CastigoActivoMap(RootModel[dict[int, int]]):
    """Mapa nino_id -> hasta_ms. Solo castigos no expirados."""


class CastigoHistoricoMap(RootModel[dict[int, int]]):
    """Mapa nino_id -> total de veces castigado (sin contar revocados)."""
