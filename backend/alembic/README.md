# Migraciones (Alembic)

```bash
# Crear una migración nueva detectando cambios sobre los modelos:
alembic revision --autogenerate -m "descripcion corta"

# Aplicar todas las migraciones pendientes a la base apuntada por KIOSKO_DB_PATH:
alembic upgrade head

# Volver atrás un paso:
alembic downgrade -1

# Ver historial:
alembic history
```

> **Nota SQLite:** muchas operaciones (drop column, alter type, alter PK) no
> son soportadas nativamente. `env.py` activa `render_as_batch=True` para que
> Alembic las emule recreando la tabla. Si autogenerate produce algo raro,
> probablemente necesites envolverlo manualmente en un `with op.batch_alter_table(...)`.
