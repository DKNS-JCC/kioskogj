"""Modelo de Pedidos.

Un pedido = lista de productos que el monitor de un grupo solicita para un
niño concreto. Llega al kiosko en estado `pendiente`. El encargado revisa
cada línea y la marca como entregada / reemplazada (con texto libre) /
descartada. Al completar el pedido, las líneas `entregado` generan UNA
transacción usando la misma lógica que la compra directa (castigo + saldo
+ cota). Las reemplazadas y descartadas no se cobran.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Pedido(Base):
    __tablename__ = "pedidos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Si se borra el niño, conservamos el pedido (auditable). Por eso SET NULL.
    nino_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("ninos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    nino_nombre: Mapped[str] = mapped_column(String, nullable=False)
    grupo: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # `pendiente` o `completado`.
    estado: Mapped[str] = mapped_column(String, nullable=False, default="pendiente")

    nota: Mapped[str | None] = mapped_column(String, nullable=True)

    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    completado_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Si el pedido se completó con líneas entregadas, aquí queda el id de la
    # transacción generada (cobro). Es solo navegación entre tablas.
    transaccion_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    lineas: Mapped[list[PedidoLinea]] = relationship(
        "PedidoLinea",
        back_populates="pedido",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PedidoLinea(Base):
    __tablename__ = "pedido_lineas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pedido_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pedidos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Si el producto se borra del catálogo, conservamos el snapshot.
    producto_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("productos.id", ondelete="SET NULL"),
        nullable=True,
    )
    producto_nombre: Mapped[str] = mapped_column(String, nullable=False)
    producto_precio: Mapped[float] = mapped_column(Float, nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)

    # `pendiente`, `entregado`, `reemplazado` o `descartado`.
    estado: Mapped[str] = mapped_column(String, nullable=False, default="pendiente")

    # Texto libre que escribe el encargado al sustituir un producto que no hay.
    # Solo tiene contenido si estado == 'reemplazado'.
    reemplazo_texto: Mapped[str | None] = mapped_column(String, nullable=True)

    pedido: Mapped[Pedido] = relationship("Pedido", back_populates="lineas")
