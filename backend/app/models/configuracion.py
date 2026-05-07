from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Configuracion(Base):
    """Pares clave/valor para configuración global.

    Ejemplos de claves: `cota_diaria` (str con un float), `pin_admin` (str).
    El valor se almacena como texto; la interpretación (JSON, número, string)
    es responsabilidad del servicio que la lee.
    """

    __tablename__ = "configuracion"

    clave: Mapped[str] = mapped_column(String, primary_key=True)
    valor: Mapped[str] = mapped_column(Text, nullable=False)
