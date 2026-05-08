"""pedido_preparado

Revision ID: 7f3a2c11d4e8
Revises: 0d06d3fed374
Create Date: 2026-05-08 14:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '7f3a2c11d4e8'
down_revision: str | None = '0d06d3fed374'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('pedidos', schema=None) as batch_op:
        batch_op.add_column(sa.Column('preparado_en', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('pedidos', schema=None) as batch_op:
        batch_op.drop_column('preparado_en')
