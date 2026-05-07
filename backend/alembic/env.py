"""Entorno Alembic.

Diferencias con la plantilla por defecto:
- La URL viene de `app.config.settings`, no de `alembic.ini`.
- Importamos `app.models` para que el autogenerate detecte todas las tablas.
- En modo online activamos `render_as_batch=True`: SQLite no soporta `ALTER
  TABLE` para muchos cambios (drop column, alter type), y Alembic lo emula
  recreando la tabla. Sin esto, la mayoría de migraciones no pasarían.
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.db import Base

# Importar para que los metadatos contengan todas las tablas.
import app.models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Genera SQL sin conectar — útil para revisar la migración antes de aplicarla."""
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Aplica migraciones contra la base real."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
