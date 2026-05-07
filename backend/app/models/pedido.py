"""Modelo de Pedidos (por Grupo).

Un pedido engloba a TODO un grupo, con múltiples niños y cada uno con sus respectivas
líneas de productos. A nivel de kiosko, se completa de golpe (generando N transacciones).
"""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Pedido(Base):
    __tablename__ = "pedidos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    grupo: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # "pendiente" o "completado".
    estado: Mapped[str] = mapped_column(String, nullable=False, default="pendiente", index=True)

    nota: Mapped[str | None] = mapped_column(String, nullable=True)

    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
    )
    completado_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    ninos: Mapped[list[PedidoNino]] = relationship(
        "PedidoNino",
        back_populates="pedido",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PedidoNino(Base):
    __tablename__ = "pedido_ninos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pedido_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pedidos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    nino_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("ninos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    nino_nombre: Mapped[str] = mapped_column(String, nullable=False)

    transaccion_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("transacciones.id", ondelete="SET NULL"), nullable=True
    )

    pedido: Mapped[Pedido] = relationship("Pedido", back_populates="ninos")
    lineas: Mapped[list[PedidoLinea]] = relationship(
        "PedidoLinea",
        back_populates="pedido_nino",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PedidoLinea(Base):
    __tablename__ = "pedido_lineas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pedido_nino_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pedido_ninos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    producto_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("productos.id", ondelete="SET NULL"),
        nullable=True,
    )
    producto_nombre: Mapped[str] = mapped_column(String, nullable=False)
    producto_precio: Mapped[float] = mapped_column(Float, nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)

    estado: Mapped[str] = mapped_column(String, nullable=False, default="pendiente")
    reemplazo_texto: Mapped[str | None] = mapped_column(String, nullable=True)

    pedido_nino: Mapped[PedidoNino] = relationship("PedidoNino", back_populates="lineas")
