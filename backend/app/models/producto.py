from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Producto(Base):
    __tablename__ = "productos"
    __table_args__ = (
        CheckConstraint("precio > 0", name="ck_productos_precio_positivo"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    precio: Mapped[float] = mapped_column(Float, nullable=False)

    # `activo=False` retira el producto del catálogo sin borrarlo, para que
    # las transacciones históricas que lo referencian sigan teniendo sentido.
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Categoria visual (bebida/snack/helado/fruta/chuche/otro). El frontend la
    # mapea a un icono y color para que el monitor reconozca el producto sin
    # leer. Sin enum SQL para evitar migraciones cuando aniadamos categorias.
    categoria: Mapped[str | None] = mapped_column(String, nullable=True)

    # Ruta a la imagen subida del producto, opcional
    imagen: Mapped[str | None] = mapped_column(String, nullable=True)

    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
