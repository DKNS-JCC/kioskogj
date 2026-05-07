from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Transaccion(Base):
    __tablename__ = "transacciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Si se borra el niño, conservamos la transacción para auditoría.
    nino_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("ninos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Desnormalizado: si el niño se borra, el nombre persiste en el histórico.
    nino_nombre: Mapped[str] = mapped_column(String, nullable=False)

    # Snapshot de los productos comprados al momento de la compra.
    # Guardamos JSON serializado en TEXT (SQLite no tiene tipo JSON real).
    # Formato: [{"id": int, "nombre": str, "precio": float, "cantidad": int}, ...]
    productos_json: Mapped[str] = mapped_column(Text, nullable=False)

    total: Mapped[float] = mapped_column(Float, nullable=False)

    fecha_hora: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
    )

    # En lugar de borrar transacciones reembolsadas, las marcamos.
    reembolsada: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
