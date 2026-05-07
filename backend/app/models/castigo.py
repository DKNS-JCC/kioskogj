from __future__ import annotations

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CastigoActivo(Base):
    """Castigo en curso de un niño. Como mucho uno por niño (PK = nino_id)."""

    __tablename__ = "castigos_activos"

    nino_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ninos.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # Epoch en milisegundos (compat con la versión anterior y con `Date.now()`
    # en JavaScript del frontend).
    hasta: Mapped[int] = mapped_column(BigInteger, nullable=False)


class CastigoHistorico(Base):
    """Cada vez que un niño es castigado, se inserta una fila aquí.

    No se borra al expirar; sirve para contar cuántas veces ha sido castigado
    cada niño. Si se revoca antes de tiempo, marcamos `revocado=True`.
    """

    __tablename__ = "castigos_historico"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nino_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ninos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fecha: Mapped[int] = mapped_column(BigInteger, nullable=False)  # epoch ms
    hasta: Mapped[int] = mapped_column(BigInteger, nullable=False)  # epoch ms
    revocado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
