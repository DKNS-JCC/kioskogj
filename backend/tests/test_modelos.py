"""Tests mínimos de Fase 2: validar que los modelos crean tabla, persisten y
que las constraints (FKs, checks) están activas con los pragmas de SQLite.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import CastigoActivo, Nino, Producto, Transaccion


def test_crear_nino(session: Session) -> None:
    n = Nino(nombre="Ana", apellidos="López", grupo=3, dinero=10.0)
    session.add(n)
    session.commit()
    assert n.id is not None
    assert n.creado_en.tzinfo is not None


def test_constraint_dinero_no_negativo(session: Session) -> None:
    session.add(Nino(nombre="A", apellidos="B", grupo=1, dinero=-1))
    with pytest.raises(IntegrityError):
        session.commit()


def test_constraint_grupo_positivo(session: Session) -> None:
    session.add(Nino(nombre="A", apellidos="B", grupo=0, dinero=0))
    with pytest.raises(IntegrityError):
        session.commit()


def test_producto_precio_positivo(session: Session) -> None:
    session.add(Producto(nombre="Chuche", precio=0))
    with pytest.raises(IntegrityError):
        session.commit()


def test_fk_castigo_cascade_al_borrar_nino(session: Session) -> None:
    """Borrar un niño debe arrastrar su castigo activo (ON DELETE CASCADE).

    Esto solo pasa si `PRAGMA foreign_keys=ON` está realmente aplicado.
    """
    n = Nino(nombre="A", apellidos="B", grupo=1, dinero=0)
    session.add(n)
    session.commit()

    session.add(CastigoActivo(nino_id=n.id, hasta=9999999999999))
    session.commit()

    session.delete(n)
    session.commit()

    assert session.query(CastigoActivo).count() == 0


def test_fk_transaccion_set_null_al_borrar_nino(session: Session) -> None:
    """Borrar un niño no borra sus transacciones; deja `nino_id=NULL`."""
    n = Nino(nombre="A", apellidos="B", grupo=1, dinero=0)
    session.add(n)
    session.commit()

    tx = Transaccion(
        nino_id=n.id,
        nino_nombre="A B",
        productos_json="[]",
        total=0.0,
        fecha_hora=datetime.now(UTC),
    )
    session.add(tx)
    session.commit()

    session.delete(n)
    session.commit()

    session.refresh(tx)
    assert tx.nino_id is None
    assert tx.nino_nombre == "A B"
