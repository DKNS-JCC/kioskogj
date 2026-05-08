from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import db as db_module
from app.main import app
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


# ─── Tests HTTP del flujo en tres fases ───────────────────────────────────


@pytest.fixture
def cliente(session: Session) -> TestClient:
    """TestClient que usa la sesión de prueba como dependencia get_session."""
    from app.db import get_session

    def _override() -> Session:
        return session

    app.dependency_overrides[get_session] = _override
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_session, None)


def _crear_setup(session: Session) -> tuple[Nino, Nino, Producto, Producto]:
    n1 = Nino(nombre="Ana", apellidos="López", grupo=3, dinero=20.0)
    n2 = Nino(nombre="Luis", apellidos="Pérez", grupo=3, dinero=10.0)
    p_galleta = Producto(nombre="Galleta", precio=1.0, activo=True)
    p_zumo = Producto(nombre="Zumo", precio=2.0, activo=True)
    session.add_all([n1, n2, p_galleta, p_zumo])
    session.commit()
    return n1, n2, p_galleta, p_zumo


def test_flujo_tres_fases(cliente: TestClient, session: Session) -> None:
    n1, n2, p_galleta, p_zumo = _crear_setup(session)

    # 1. Monitor crea pedido (n1: 1 galleta + 1 zumo, n2: 2 galletas).
    r = cliente.post(
        "/api/pedidos",
        json={
            "grupo": 3,
            "ninos": [
                {"nino_id": n1.id, "lineas": [
                    {"producto_id": p_galleta.id, "cantidad": 1},
                    {"producto_id": p_zumo.id, "cantidad": 1},
                ]},
                {"nino_id": n2.id, "lineas": [
                    {"producto_id": p_galleta.id, "cantidad": 2},
                ]},
            ],
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    pedido_id = data["id"]
    assert data["estado"] == "pendiente"

    # Recoger ids de líneas para los siguientes pasos.
    n1_data = next(n for n in data["ninos"] if n["nino_id"] == n1.id)
    n2_data = next(n for n in data["ninos"] if n["nino_id"] == n2.id)
    linea_galleta_n1 = next(l for l in n1_data["lineas"] if l["producto_nombre"] == "Galleta")
    linea_zumo_n1 = next(l for l in n1_data["lineas"] if l["producto_nombre"] == "Zumo")
    linea_galleta_n2 = n2_data["lineas"][0]

    # 2. Kiosko marca: galleta de n1 → listo, zumo de n1 → reemplazado, galleta de n2 → descartado.
    def _put_linea(linea_id: int, body: dict) -> None:
        r = cliente.put(f"/api/pedidos/{pedido_id}/lineas/{linea_id}", json=body)
        assert r.status_code == 200, r.text

    _put_linea(linea_galleta_n1["id"], {"estado": "listo"})
    _put_linea(linea_zumo_n1["id"], {"estado": "reemplazado", "reemplazo_texto": "Agua"})
    _put_linea(linea_galleta_n2["id"], {"estado": "descartado"})

    # 3. Marcar preparado.
    r = cliente.post(f"/api/pedidos/{pedido_id}/preparar")
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "preparado"
    assert r.json()["preparado_en"] is not None

    # 4. Monitor reparte: ambas líneas vivas de n1 → entregado.
    _put_linea(linea_galleta_n1["id"], {"estado": "entregado"})
    _put_linea(linea_zumo_n1["id"], {"estado": "entregado"})
    # n2 ya estaba descartado, no se toca.

    # 5. Completar y cobrar.
    r = cliente.post(f"/api/pedidos/{pedido_id}/completar")
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "completado"

    # 6. Saldos: n1 paga galleta (1.0) + zumo cobrado a precio snapshot (2.0) = 3.0 → 17.0
    #            n2 no paga nada (descartado) → sigue en 10.0
    session.expire_all()
    n1_db = session.get(Nino, n1.id)
    n2_db = session.get(Nino, n2.id)
    assert n1_db.dinero == pytest.approx(17.0)
    assert n2_db.dinero == pytest.approx(10.0)

    # n1 tiene transaccion_id, n2 no.
    pedido = session.get(Pedido, pedido_id)
    pn_n1 = next(pn for pn in pedido.ninos if pn.nino_id == n1.id)
    pn_n2 = next(pn for pn in pedido.ninos if pn.nino_id == n2.id)
    assert pn_n1.transaccion_id is not None
    assert pn_n2.transaccion_id is None


def test_no_se_puede_preparar_con_lineas_pendientes(cliente: TestClient, session: Session) -> None:
    n1, _n2, p_galleta, _p_zumo = _crear_setup(session)
    r = cliente.post(
        "/api/pedidos",
        json={"grupo": 3, "ninos": [
            {"nino_id": n1.id, "lineas": [{"producto_id": p_galleta.id, "cantidad": 1}]},
        ]},
    )
    assert r.status_code == 201
    pedido_id = r.json()["id"]

    r = cliente.post(f"/api/pedidos/{pedido_id}/preparar")
    assert r.status_code == 409
    assert "Faltan líneas" in r.json()["detail"]


def test_no_se_puede_completar_sin_preparar(cliente: TestClient, session: Session) -> None:
    n1, _n2, p_galleta, _p_zumo = _crear_setup(session)
    r = cliente.post(
        "/api/pedidos",
        json={"grupo": 3, "ninos": [
            {"nino_id": n1.id, "lineas": [{"producto_id": p_galleta.id, "cantidad": 1}]},
        ]},
    )
    pedido_id = r.json()["id"]

    r = cliente.post(f"/api/pedidos/{pedido_id}/completar")
    assert r.status_code == 409
    assert "preparado" in r.json()["detail"]


def test_duplicado_grupo_requiere_confirmacion(cliente: TestClient, session: Session) -> None:
    n1, _n2, p_galleta, _p_zumo = _crear_setup(session)
    payload = {
        "grupo": 3,
        "ninos": [{"nino_id": n1.id, "lineas": [{"producto_id": p_galleta.id, "cantidad": 1}]}],
    }

    r1 = cliente.post("/api/pedidos", json=payload)
    assert r1.status_code == 201
    primer_id = r1.json()["id"]

    # Segundo intento sin confirmación → 409 con payload de duplicado.
    r2 = cliente.post("/api/pedidos", json=payload)
    assert r2.status_code == 409
    detalle = r2.json()["detail"]
    assert detalle["duplicado"] is True
    assert primer_id in detalle["pedidos_existentes"]

    # Reintentar con confirmar_duplicado=true.
    r3 = cliente.post("/api/pedidos?confirmar_duplicado=true", json=payload)
    assert r3.status_code == 201
    assert r3.json()["id"] != primer_id


def test_borrado_permitido_en_preparado(cliente: TestClient, session: Session) -> None:
    n1, _n2, p_galleta, _p_zumo = _crear_setup(session)
    r = cliente.post(
        "/api/pedidos",
        json={"grupo": 3, "ninos": [
            {"nino_id": n1.id, "lineas": [{"producto_id": p_galleta.id, "cantidad": 1}]},
        ]},
    )
    pedido_id = r.json()["id"]
    linea_id = r.json()["ninos"][0]["lineas"][0]["id"]

    # Resolver línea y preparar.
    cliente.put(f"/api/pedidos/{pedido_id}/lineas/{linea_id}", json={"estado": "listo"})
    r = cliente.post(f"/api/pedidos/{pedido_id}/preparar")
    assert r.status_code == 200

    # Borrar pedido en estado preparado debe funcionar.
    r = cliente.delete(f"/api/pedidos/{pedido_id}")
    assert r.status_code == 204
    assert session.get(Pedido, pedido_id) is None
