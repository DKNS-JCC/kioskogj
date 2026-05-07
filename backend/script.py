
with open('app/models/pedido.py', 'w', encoding='utf-8') as f:
    f.write('''"""Modelo de Pedidos (por Grupo).

Un pedido engloba a TODO un grupo, con múltiples niños y cada uno con sus respectivas
líneas de productos. A nivel de kiosko, se completa de golpe (generando N transacciones).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Pedido(Base):
    __tablename__ = \"pedidos\
