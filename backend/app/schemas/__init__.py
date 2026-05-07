"""Schemas Pydantic. Importables como `from app.schemas import NinoOut, ...`."""

from app.schemas.castigo import (
    CastigoActivoMap,
    CastigoHistoricoMap,
)
from app.schemas.configuracion import (
    ConfiguracionOut,
    ConfiguracionUpdate,
)
from app.schemas.estadisticas import (
    EstadisticasOut,
    TopNino,
    VentasDia,
)
from app.schemas.nino import (
    NinoCreate,
    NinoInfo,
    NinoOut,
    NinoUpdate,
)
from app.schemas.producto import (
    ProductoCreate,
    ProductoOut,
    ProductoUpdate,
)
from app.schemas.transaccion import (
    HistorialLinea,
    LineaCompra,
    TransaccionCreate,
    TransaccionCreada,
    TransaccionOut,
)

__all__ = [
    "NinoCreate", "NinoUpdate", "NinoOut", "NinoInfo",
    "ProductoCreate", "ProductoUpdate", "ProductoOut",
    "LineaCompra", "TransaccionCreate", "TransaccionCreada",
    "TransaccionOut", "HistorialLinea",
    "CastigoActivoMap", "CastigoHistoricoMap",
    "ConfiguracionOut", "ConfiguracionUpdate",
    "EstadisticasOut", "TopNino", "VentasDia",
]
