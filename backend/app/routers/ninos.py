from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_admin_pin
from app.db import get_session
from app.models import Nino
from app.schemas import (
    FilaImportError,
    HistorialLinea,
    ImportResultado,
    NinoCreate,
    NinoInfo,
    NinoOut,
    NinoUpdate,
)
from app.services import compra as compra_service
from app.services import historial as historial_service

router = APIRouter(prefix="/api/ninos", tags=["ninos"])


@router.get("", response_model=list[NinoOut])
def listar(sesion: Session = Depends(get_session)) -> list[Nino]:
    return list(sesion.scalars(select(Nino).order_by(Nino.grupo, Nino.nombre)).all())


@router.post("", response_model=NinoOut, status_code=status.HTTP_201_CREATED)
def crear(payload: NinoCreate, sesion: Session = Depends(get_session)) -> Nino:
    nino = Nino(**payload.model_dump())
    sesion.add(nino)
    sesion.commit()
    sesion.refresh(nino)
    return nino


@router.put("/{nino_id}", response_model=NinoOut)
def actualizar(
    nino_id: int,
    payload: NinoUpdate,
    sesion: Session = Depends(get_session),
) -> Nino:
    nino = sesion.get(Nino, nino_id)
    if nino is None:
        raise HTTPException(status_code=404, detail="Niño no encontrado.")
    for campo, valor in payload.model_dump(exclude_unset=True).items():
        setattr(nino, campo, valor)
    sesion.commit()
    sesion.refresh(nino)
    return nino


@router.delete("/{nino_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def borrar(nino_id: int, sesion: Session = Depends(get_session)) -> None:
    nino = sesion.get(Nino, nino_id)
    if nino is None:
        raise HTTPException(status_code=404, detail="Niño no encontrado.")
    sesion.delete(nino)
    sesion.commit()


@router.post(
    "/limpiar",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    dependencies=[Depends(require_admin_pin)],
)
def limpiar_todos(sesion: Session = Depends(get_session)) -> None:
    """Borra todos los niños (cierre de campamento). Requiere PIN admin."""
    sesion.query(Nino).delete()
    sesion.commit()


# Aliases tolerantes para los nombres de columna del CSV. Permiten que un
# Excel real con tildes/mayúsculas/variantes funcione sin renombrar nada.
_ALIAS_COLS: dict[str, set[str]] = {
    "nombre": {"nombre", "name"},
    "apellidos": {"apellidos", "apellido", "surname", "lastname"},
    "grupo": {"grupo", "group", "equipo", "team"},
    "dinero": {"dinero", "saldo", "money", "balance", "euros", "€"},
}


def _normalizar_clave(s: str) -> str:
    return s.strip().lower().replace("ñ", "n")


def _mapear_cabeceras(fieldnames: list[str]) -> dict[str, str]:
    """Devuelve {clave_canonica: columna_real_del_csv}."""
    mapeo: dict[str, str] = {}
    for col in fieldnames:
        norm = _normalizar_clave(col)
        for canonica, alias in _ALIAS_COLS.items():
            if norm in alias:
                mapeo[canonica] = col
                break
    return mapeo


@router.post(
    "/importar",
    response_model=ImportResultado,
    dependencies=[Depends(require_admin_pin)],
)
def importar_csv(
    file: UploadFile = File(..., description="CSV UTF-8 con cabeceras: nombre, apellidos, grupo, [dinero]"),
    sesion: Session = Depends(get_session),
) -> ImportResultado:
    """Alta masiva de niños desde un CSV.

    - Primera fila: cabeceras. Acepta variantes (apellido/apellidos, dinero/saldo, ...).
    - Separador `,` o `;` autodetectado.
    - BOM UTF-8 tolerado (Excel ES suele añadirlo).
    - Filas inválidas se omiten con motivo; el resto se inserta.
    - `dinero` es opcional; vacío = 0. Acepta `1,50` o `1.50`.
    """
    raw = file.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    try:
        contenido = raw.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise HTTPException(
            status_code=400,
            detail="El archivo no está en UTF-8. Guárdalo como CSV UTF-8 desde Excel.",
        ) from e

    # Autodetectar separador (Excel ES = ';', US = ',').
    try:
        muestra = contenido[:2048]
        dialect = csv.Sniffer().sniff(muestra, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel

    reader = csv.DictReader(io.StringIO(contenido), dialect=dialect)
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="No se detectaron cabeceras en el CSV.")

    mapeo = _mapear_cabeceras(list(reader.fieldnames))
    obligatorios = {"nombre", "apellidos", "grupo"}
    faltan = obligatorios - mapeo.keys()
    if faltan:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan columnas obligatorias: {', '.join(sorted(faltan))}.",
        )

    creados = 0
    total = 0
    errores: list[FilaImportError] = []

    for i, fila in enumerate(reader, start=2):  # 1 es la cabecera
        # Saltar líneas completamente vacías sin contar.
        if not any((v or "").strip() for v in fila.values()):
            continue
        total += 1
        try:
            nombre = (fila.get(mapeo["nombre"]) or "").strip()
            apellidos = (fila.get(mapeo["apellidos"]) or "").strip()
            grupo_raw = (fila.get(mapeo["grupo"]) or "").strip()
            dinero_raw = (fila.get(mapeo.get("dinero", "")) or "").strip().replace(",", ".") if "dinero" in mapeo else "0"

            if not nombre:
                errores.append(FilaImportError(fila=i, razon="nombre vacío"))
                continue
            if not apellidos:
                errores.append(FilaImportError(fila=i, razon="apellidos vacíos"))
                continue
            try:
                grupo = int(grupo_raw)
            except ValueError:
                errores.append(FilaImportError(fila=i, razon=f"grupo no es entero: '{grupo_raw}'"))
                continue
            if grupo <= 0:
                errores.append(FilaImportError(fila=i, razon="grupo debe ser > 0"))
                continue
            try:
                dinero = float(dinero_raw) if dinero_raw else 0.0
            except ValueError:
                errores.append(FilaImportError(fila=i, razon=f"dinero no es número: '{dinero_raw}'"))
                continue
            if dinero < 0:
                errores.append(FilaImportError(fila=i, razon="dinero no puede ser negativo"))
                continue

            sesion.add(Nino(nombre=nombre, apellidos=apellidos, grupo=grupo, dinero=dinero))
            creados += 1
        except Exception as e:  # cualquier otro error, no aborta el lote
            errores.append(FilaImportError(fila=i, razon=str(e)))

    sesion.commit()

    return ImportResultado(creados=creados, total_filas=total, omitidos=errores)


@router.get("/{nino_id}/info", response_model=NinoInfo)
def info(nino_id: int, sesion: Session = Depends(get_session)) -> NinoInfo:
    resultado = compra_service.info_nino(sesion, nino_id)
    if resultado is None:
        raise HTTPException(status_code=404, detail="Niño no encontrado.")
    saldo, comprado_hoy, gastado_hoy = resultado
    return NinoInfo(saldo=saldo, comprado_hoy=comprado_hoy, gastado_hoy=gastado_hoy)


@router.get("/{nino_id}/historial", response_model=list[HistorialLinea])
def historial(nino_id: int, sesion: Session = Depends(get_session)) -> list[HistorialLinea]:
    if sesion.get(Nino, nino_id) is None:
        raise HTTPException(status_code=404, detail="Niño no encontrado.")
    return historial_service.historial_de_nino(sesion, nino_id)
