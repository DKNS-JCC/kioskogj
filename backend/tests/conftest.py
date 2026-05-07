"""Fixtures comunes a todos los tests.

Decisiones:
- DB temporal en disco (no `:memory:`) porque queremos verificar que los
  pragmas WAL/foreign_keys del `db.py` real se aplican y se respetan.
- Cada test arranca con esquema limpio creado a partir de `Base.metadata`,
  no de Alembic. Es más rápido y los tests no son el sitio para validar las
  migraciones (eso lo hace el propio Alembic).
- Cerramos el engine al final del test para soltar el fichero en Windows.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app import db as db_module
from app.db import Base


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.db"


@pytest.fixture
def session(monkeypatch: pytest.MonkeyPatch, db_path: Path) -> Iterator[Session]:
    """Sesión SQLAlchemy contra una DB temporal recién creada."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    # Reaprovecha el listener de pragmas registrado en `app.db`.
    Base.metadata.create_all(engine)

    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

    # Hacemos que cualquier código que importe `SessionLocal` desde `app.db`
    # use esta sesión de test. Útil para `migrate_legacy` y futuros services.
    monkeypatch.setattr(db_module, "SessionLocal", TestingSession)
    monkeypatch.setattr(db_module, "engine", engine)

    s = TestingSession()
    try:
        yield s
    finally:
        s.close()
        engine.dispose()
