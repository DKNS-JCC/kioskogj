"""Tablas pedidos y pedido_lineas.

Permiten que monitores de grupo envíen al kiosko una lista de productos
solicitados por niño. El encargado los completa, y al finalizar se genera
una transacción con las líneas entregadas (las reemplazadas/descartadas no
se cobran).

Revision ID: 0003_pedidos
Revises: 57bd92671284
Create Date: 2026-05-08
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_pedidos"
down_revision: Union[str, None] = "57bd92671284"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pedidos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "nino_id",
            sa.Integer(),
            sa.ForeignKey("ninos.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("nino_nombre", sa.String(), nullable=False),
        sa.Column("grupo", sa.Integer(), nullable=False),
        sa.Column("estado", sa.String(), nullable=False, server_default="pendiente"),
        sa.Column("nota", sa.String(), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transaccion_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_pedidos_nino_id", "pedidos", ["nino_id"])
    op.create_index("ix_pedidos_grupo", "pedidos", ["grupo"])
    op.create_index("ix_pedidos_creado_en", "pedidos", ["creado_en"])
    op.create_index("ix_pedidos_estado", "pedidos", ["estado"])

    op.create_table(
        "pedido_lineas",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "pedido_id",
            sa.Integer(),
            sa.ForeignKey("pedidos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "producto_id",
            sa.Integer(),
            sa.ForeignKey("productos.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("producto_nombre", sa.String(), nullable=False),
        sa.Column("producto_precio", sa.Float(), nullable=False),
        sa.Column("cantidad", sa.Integer(), nullable=False),
        sa.Column("estado", sa.String(), nullable=False, server_default="pendiente"),
        sa.Column("reemplazo_texto", sa.String(), nullable=True),
    )
    op.create_index("ix_pedido_lineas_pedido_id", "pedido_lineas", ["pedido_id"])


def downgrade() -> None:
    op.drop_index("ix_pedido_lineas_pedido_id", table_name="pedido_lineas")
    op.drop_table("pedido_lineas")
    op.drop_index("ix_pedidos_estado", table_name="pedidos")
    op.drop_index("ix_pedidos_creado_en", table_name="pedidos")
    op.drop_index("ix_pedidos_grupo", table_name="pedidos")
    op.drop_index("ix_pedidos_nino_id", table_name="pedidos")
    op.drop_table("pedidos")
