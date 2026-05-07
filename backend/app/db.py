"""Motor SQLAlchemy y sesión.

Notas sobre SQLite en la Pi 3B+:

- Activamos **WAL** en cada conexión nueva. WAL permite que un lector y un
  escritor concurran sin bloquearse y reduce drásticamente los `database is
  locked` en una SD card lenta. Es el primer pragma que recomienda el spec.

- `foreign_keys=ON` es necesario para que SQLite respete las FKs. Por defecto
  vienen desactivadas por compatibilidad histórica, así que lo forzamos por
  conexión.

- `synchronous=NORMAL` con WAL es seguro y mucho más rápido que `FULL` en
  tarjetas SD. Una caída de corriente como mucho pierde la última transacción
  no flushed, no corrompe la base. Aceptable para este caso.

- `connect_args={"check_same_thread": False}` porque FastAPI ejecuta endpoints
  sync en un threadpool: la misma conexión puede ver hilos distintos. La
  protección real la da el pool + nuestras sesiones por request.
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    """Base declarativa común a todos los modelos."""


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    # `future=True` ya es default en 2.x, lo dejamos explícito por claridad.
    future=True,
)


@event.listens_for(Engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, connection_record) -> None:  # noqa: ARG001
    """Aplica los pragmas necesarios cada vez que el pool abre una conexión."""
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA synchronous=NORMAL")
        # Cache de 20 MB en memoria por conexión (negativo = KiB).
        cursor.execute("PRAGMA cache_size=-20000")
    finally:
        cursor.close()


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_session() -> Iterator[Session]:
    """Dependencia de FastAPI: una sesión por request, cerrada al terminar."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
