from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Nino(Base):
    __tablename__ = "ninos"
    __table_args__ = (
        CheckConstraint("grupo > 0", name="ck_ninos_grupo_positivo"),
        CheckConstraint("dinero >= 0", name="ck_ninos_dinero_no_negativo"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    apellidos: Mapped[str] = mapped_column(String, nullable=False)
    grupo: Mapped[int] = mapped_column(Integer, nullable=False)
    dinero: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
