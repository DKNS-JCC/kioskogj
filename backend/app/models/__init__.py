"""Re-exporta los modelos para que Alembic los detecte importando un solo módulo."""

from app.models.castigo import CastigoActivo, CastigoHistorico
from app.models.configuracion import Configuracion
from app.models.nino import Nino
from app.models.pedido import Pedido, PedidoLinea
from app.models.producto import Producto
from app.models.transaccion import Transaccion

__all__ = [
    "Nino",
    "Producto",
    "Transaccion",
    "CastigoActivo",
    "CastigoHistorico",
    "Configuracion",
    "Pedido",
    "PedidoLinea",
]
