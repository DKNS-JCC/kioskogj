from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Nino, Pedido, PedidoNino, PedidoLinea, Producto


def test_flujo_pedido_completo(session: Session) -> None:
    # 1. Setup: Niño y Producto
    nino = Nino(nombre="Juan", apellidos="García", grupo=5, dinero=50.0)
    prod = Producto(nombre="Refresco", precio=1.5, activo=True)
    session.add_all([nino, prod])
    session.commit()

    # 2. Crear Pedido Grupal
    pedido = Pedido(grupo=5, estado="pendiente", creado_en=datetime.now(timezone.utc))
    p_nino = PedidoNino(nino_id=nino.id, nino_nombre="Juan García")
    p_linea = PedidoLinea(
        producto_id=prod.id,
        producto_nombre="Refresco",
        producto_precio=1.5,
        cantidad=2,
        estado="pendiente"
    )
    p_nino.lineas.append(p_linea)
    pedido.ninos.append(p_nino)
    session.add(pedido)
    session.commit()

    # 3. Verificar persistencia
    assert pedido.id is not None
    assert len(pedido.ninos) == 1
    assert len(pedido.ninos[0].lineas) == 1

    # 4. Resolver líneas
    p_linea.estado = "entregado"
    session.commit()

    # 5. Borrado en cascada
    session.delete(pedido)
    session.commit()
    
    # Verificar que las líneas y ninos-del-pedido desaparecen
    assert session.scalar(select(PedidoNino).where(PedidoNino.pedido_id == pedido.id)) is None
    assert session.scalar(select(PedidoLinea).where(PedidoLinea.pedido_nino_id == p_nino.id)) is None
    
    # El niño y el producto del catálogo deben seguir existiendo
    assert session.get(Nino, nino.id) is not None
    assert session.get(Producto, prod.id) is not None

def test_pedido_nino_borrado_set_null(session: Session) -> None:
    """Si borramos a un niño del catálogo, su registro en el pedido queda con nino_id=NULL."""
    nino = Nino(nombre="Borrar", apellidos="Me", grupo=1, dinero=10.0)
    session.add(nino)
    session.commit()

    pedido = Pedido(grupo=1, estado="pendiente")
    p_nino = PedidoNino(nino_id=nino.id, nino_nombre="Borrar Me")
    pedido.ninos.append(p_nino)
    session.add(pedido)
    session.commit()

    session.delete(nino)
    session.commit()

    session.refresh(p_nino)
    assert p_nino.nino_id is None
    assert p_nino.nino_nombre == "Borrar Me"
