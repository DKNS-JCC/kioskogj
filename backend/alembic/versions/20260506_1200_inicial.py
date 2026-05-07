"""Esquema inicial.

Revision ID: 0001_inicial
Revises:
Create Date: 2026-05-06
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_inicial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ninos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("nombre", sa.String(), nullable=False),
        sa.Column("apellidos", sa.String(), nullable=False),
        sa.Column("grupo", sa.Integer(), nullable=False),
        sa.Column("dinero", sa.Float(), nullable=False, server_default="0"),
        sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("grupo > 0", name="ck_ninos_grupo_positivo"),
        sa.CheckConstraint("dinero >= 0", name="ck_ninos_dinero_no_negativo"),
    )

    op.create_table(
        "productos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("nombre", sa.String(), nullable=False),
        sa.Column("precio", sa.Float(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("precio > 0", name="ck_productos_precio_positivo"),
    )

    op.create_table(
        "transacciones",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "nino_id",
            sa.Integer(),
            sa.ForeignKey("ninos.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("nino_nombre", sa.String(), nullable=False),
        sa.Column("productos_json", sa.Text(), nullable=False),
        sa.Column("total", sa.Float(), nullable=False),
        sa.Column("fecha_hora", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reembolsada", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_transacciones_nino_id", "transacciones", ["nino_id"])
    op.create_index("ix_transacciones_fecha_hora", "transacciones", ["fecha_hora"])

    op.create_table(
        "castigos_activos",
        sa.Column(
            "nino_id",
            sa.Integer(),
            sa.ForeignKey("ninos.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("hasta", sa.BigInteger(), nullable=False),
    )

    op.create_table(
        "castigos_historico",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "nino_id",
            sa.Integer(),
            sa.ForeignKey("ninos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fecha", sa.BigInteger(), nullable=False),
        sa.Column("hasta", sa.BigInteger(), nullable=False),
        sa.Column("revocado", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_castigos_historico_nino_id", "castigos_historico", ["nino_id"])

    op.create_table(
        "configuracion",
        sa.Column("clave", sa.String(), primary_key=True),
        sa.Column("valor", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("configuracion")
    op.drop_index("ix_castigos_historico_nino_id", table_name="castigos_historico")
    op.drop_table("castigos_historico")
    op.drop_table("castigos_activos")
    op.drop_index("ix_transacciones_fecha_hora", table_name="transacciones")
    op.drop_index("ix_transacciones_nino_id", table_name="transacciones")
    op.drop_table("transacciones")
    op.drop_table("productos")
    op.drop_table("ninos")
