"""Anade columna `categoria` a la tabla productos.

La categoria es opcional (nullable). El frontend la mapea a icono + color
para reconocimiento visual en el catalogo. Mantenida como string en lugar
de enum SQL para anadir nuevas categorias sin migracion.

Revision ID: 0002_categoria_producto
Revises: 0001_inicial
Create Date: 2026-05-07
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_categoria_producto"
down_revision: str | None = "0001_inicial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "productos",
        sa.Column("categoria", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("productos", "categoria")
