"""Migrador desde la base SQLite de la versión anterior (Node/Express).

Uso:

    python -m app.migrate_legacy /ruta/al/database.db.viejo

Pre-requisito: la base nueva ya debe existir con `alembic upgrade head`.

Estrategia (defensiva):

- Abrimos la base vieja en **modo solo lectura** (`mode=ro`) para no
  estropearla por accidente.
- Introspectamos los nombres de columna de cada tabla con `PRAGMA table_info`
  antes de leer. No asumimos un esquema rígido: leemos lo que haya.
- Saltamos filas que no validan (logueando el por qué) en vez de abortar la
  migración entera. Al final imprimimos un resumen.
- Los IDs de la base vieja se **conservan** para no romper FKs existentes
  (`nino_id` en transacciones, etc.).
- El campo `tokens` del modelo viejo, si existe, se ignora (decisión del
  usuario en 2026-05-06: ya no existen tokens).
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path

from loguru import logger
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import (
    CastigoActivo,
    CastigoHistorico,
    Configuracion,
    Nino,
    Producto,
    Transaccion,
)


# --- Utilidades de introspección ---


def _columnas(con: sqlite3.Connection, tabla: str) -> set[str]:
    """Devuelve el conjunto de columnas de una tabla, o vacío si no existe."""
    cur = con.execute(f"PRAGMA table_info({tabla})")
    return {row[1] for row in cur.fetchall()}


def _filas(con: sqlite3.Connection, tabla: str, columnas: set[str]) -> Iterable[dict]:
    """Itera filas de una tabla como dicts. Solo lee las columnas pedidas que
    existan realmente en la base de origen."""
    if not columnas:
        return
    seleccion = ", ".join(sorted(columnas))
    for row in con.execute(f"SELECT {seleccion} FROM {tabla}"):
        yield dict(zip(sorted(columnas), row, strict=True))


def _parse_fecha(valor) -> datetime:
    """Convierte fechas legacy a datetime tz-aware UTC.

    Acepta: ISO 8601 string, epoch ms (int), epoch s (int), o datetime.
    """
    if isinstance(valor, datetime):
        return valor if valor.tzinfo else valor.replace(tzinfo=timezone.utc)
    if isinstance(valor, (int, float)):
        # Heurística: si parece milisegundos (>10^12), dividir.
        ts = valor / 1000 if valor > 1e12 else valor
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(valor, str):
        try:
            dt = datetime.fromisoformat(valor.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    raise ValueError(f"Fecha no reconocida: {valor!r}")


# --- Migradores por tabla ---


def migrar_ninos(legacy: sqlite3.Connection, sesion: Session) -> int:
    columnas_legacy = _columnas(legacy, "ninos")
    if not columnas_legacy:
        logger.warning("Tabla 'ninos' no existe en la base legacy; salto.")
        return 0

    pedimos = {"id", "nombre", "apellidos", "grupo", "dinero", "creado_en"} & columnas_legacy
    insertados = 0
    for fila in _filas(legacy, "ninos", pedimos):
        try:
            nino = Nino(
                id=fila["id"],
                nombre=fila.get("nombre", "").strip() or "Sin nombre",
                apellidos=fila.get("apellidos", "").strip() or "",
                grupo=int(fila.get("grupo") or 1),
                dinero=float(fila.get("dinero") or 0.0),
                creado_en=_parse_fecha(fila["creado_en"]) if fila.get("creado_en") else datetime.now(timezone.utc),
            )
            sesion.add(nino)
            insertados += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("Niño legacy id={} saltado: {}", fila.get("id"), exc)
    sesion.flush()
    return insertados


def migrar_productos(legacy: sqlite3.Connection, sesion: Session) -> int:
    columnas_legacy = _columnas(legacy, "productos")
    if not columnas_legacy:
        logger.warning("Tabla 'productos' no existe en la base legacy; salto.")
        return 0

    pedimos = {"id", "nombre", "precio", "activo", "creado_en"} & columnas_legacy
    insertados = 0
    for fila in _filas(legacy, "productos", pedimos):
        try:
            producto = Producto(
                id=fila["id"],
                nombre=fila.get("nombre", "").strip() or "Sin nombre",
                precio=float(fila["precio"]),
                activo=bool(fila.get("activo", True)),
                creado_en=_parse_fecha(fila["creado_en"]) if fila.get("creado_en") else datetime.now(timezone.utc),
            )
            sesion.add(producto)
            insertados += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("Producto legacy id={} saltado: {}", fila.get("id"), exc)
    sesion.flush()
    return insertados


def migrar_transacciones(legacy: sqlite3.Connection, sesion: Session) -> int:
    columnas_legacy = _columnas(legacy, "transacciones")
    if not columnas_legacy:
        logger.warning("Tabla 'transacciones' no existe en la base legacy; salto.")
        return 0

    # En la versión vieja el campo de productos podía llamarse 'productos' o
    # 'productos_json'; admitimos ambos.
    nombre_col_productos = "productos_json" if "productos_json" in columnas_legacy else "productos"
    pedimos = {
        "id", "nino_id", "nino_nombre", nombre_col_productos,
        "total", "fecha_hora", "reembolsada",
    } & columnas_legacy

    insertados = 0
    for fila in _filas(legacy, "transacciones", pedimos):
        try:
            productos_raw = fila.get(nombre_col_productos) or "[]"
            # Validamos que parsea como JSON; si no, lo guardamos como lista vacía.
            try:
                json.loads(productos_raw)
                productos_json = productos_raw
            except json.JSONDecodeError:
                logger.warning(
                    "Transacción legacy id={}: productos no es JSON válido; se guarda '[]'.",
                    fila.get("id"),
                )
                productos_json = "[]"

            tx = Transaccion(
                id=fila["id"],
                nino_id=fila.get("nino_id"),
                nino_nombre=(fila.get("nino_nombre") or "").strip() or "Desconocido",
                productos_json=productos_json,
                total=float(fila["total"]),
                fecha_hora=_parse_fecha(fila["fecha_hora"]) if fila.get("fecha_hora") else datetime.now(timezone.utc),
                reembolsada=bool(fila.get("reembolsada", False)),
            )
            sesion.add(tx)
            insertados += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("Transacción legacy id={} saltada: {}", fila.get("id"), exc)
    sesion.flush()
    return insertados


def migrar_castigos(legacy: sqlite3.Connection, sesion: Session) -> tuple[int, int]:
    activos = 0
    historico = 0

    cols_act = _columnas(legacy, "castigos_activos")
    if cols_act:
        for fila in _filas(legacy, "castigos_activos", {"nino_id", "hasta"} & cols_act):
            try:
                sesion.add(CastigoActivo(nino_id=fila["nino_id"], hasta=int(fila["hasta"])))
                activos += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("Castigo activo nino_id={} saltado: {}", fila.get("nino_id"), exc)

    cols_hist = _columnas(legacy, "castigos_historico")
    if cols_hist:
        pedimos = {"id", "nino_id", "fecha", "hasta", "revocado"} & cols_hist
        for fila in _filas(legacy, "castigos_historico", pedimos):
            try:
                sesion.add(CastigoHistorico(
                    id=fila.get("id"),
                    nino_id=fila["nino_id"],
                    fecha=int(fila["fecha"]),
                    hasta=int(fila["hasta"]),
                    revocado=bool(fila.get("revocado", False)),
                ))
                historico += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("Castigo histórico id={} saltado: {}", fila.get("id"), exc)

    sesion.flush()
    return activos, historico


def migrar_configuracion(legacy: sqlite3.Connection, sesion: Session) -> int:
    cols = _columnas(legacy, "configuracion")
    if not cols:
        return 0
    insertados = 0
    for fila in _filas(legacy, "configuracion", {"clave", "valor"} & cols):
        try:
            sesion.merge(Configuracion(clave=fila["clave"], valor=str(fila["valor"])))
            insertados += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("Configuracion clave={} saltada: {}", fila.get("clave"), exc)
    sesion.flush()
    return insertados


# --- Entrada CLI ---


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Migra la base SQLite legacy al nuevo esquema.")
    parser.add_argument("origen", type=Path, help="Ruta al database.db de la versión anterior.")
    parser.add_argument(
        "--seco",
        action="store_true",
        help="Hace todo el trabajo pero no commitea (útil para previsualizar).",
    )
    args = parser.parse_args(argv)

    if not args.origen.exists():
        logger.error("No encuentro {}", args.origen)
        return 1

    # Solo lectura, así no podemos romper la base vieja.
    uri = f"file:{args.origen.resolve().as_posix()}?mode=ro"
    legacy = sqlite3.connect(uri, uri=True)

    sesion = SessionLocal()
    try:
        logger.info("Migrando ninos…")
        n = migrar_ninos(legacy, sesion)
        logger.info("Migrando productos…")
        p = migrar_productos(legacy, sesion)
        logger.info("Migrando transacciones…")
        t = migrar_transacciones(legacy, sesion)
        logger.info("Migrando castigos…")
        ca, ch = migrar_castigos(legacy, sesion)
        logger.info("Migrando configuracion…")
        c = migrar_configuracion(legacy, sesion)

        if args.seco:
            sesion.rollback()
            logger.info("[modo seco] Cambios revertidos.")
        else:
            sesion.commit()
            logger.info("Commit hecho.")

        logger.info(
            "Resumen: {} niños, {} productos, {} transacciones, "
            "{} castigos activos, {} castigos histórico, {} claves de config.",
            n, p, t, ca, ch, c,
        )
        return 0
    except Exception:
        sesion.rollback()
        logger.exception("Migración abortada por error.")
        return 2
    finally:
        sesion.close()
        legacy.close()


if __name__ == "__main__":
    sys.exit(main())
