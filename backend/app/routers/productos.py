import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Producto
from app.schemas import ProductoCreate, ProductoOut, ProductoUpdate

router = APIRouter(prefix="/api/productos", tags=["productos"])


@router.get("", response_model=list[ProductoOut])
def listar(
    activo: bool | None = Query(default=None),
    sesion: Session = Depends(get_session),
) -> list[Producto]:
    stmt = select(Producto).order_by(Producto.nombre)
    if activo is not None:
        stmt = stmt.where(Producto.activo.is_(activo))
    return list(sesion.scalars(stmt).all())


@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
def crear(payload: ProductoCreate, sesion: Session = Depends(get_session)) -> Producto:
    producto = Producto(**payload.model_dump())
    sesion.add(producto)
    sesion.commit()
    sesion.refresh(producto)
    return producto


@router.put("/{producto_id}", response_model=ProductoOut)
def actualizar(
    producto_id: int,
    payload: ProductoUpdate,
    sesion: Session = Depends(get_session),
) -> Producto:
    producto = sesion.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    for campo, valor in payload.model_dump(exclude_unset=True).items():
        setattr(producto, campo, valor)
    sesion.commit()
    sesion.refresh(producto)
    return producto


@router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def borrar(producto_id: int, sesion: Session = Depends(get_session)) -> None:
    """Borrado físico. Si el producto se ha vendido alguna vez, considera
    pasarlo a `activo=false` en lugar de borrarlo, para no perder histórico."""
    producto = sesion.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    sesion.delete(producto)
    sesion.commit()
@router.post("/{producto_id}/imagen", response_model=ProductoOut)
def subir_imagen(
    producto_id: int,
    file: UploadFile = File(...),
    sesion: Session = Depends(get_session)
) -> Producto:
    producto = sesion.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    static_dir = Path("static/productos")
    static_dir.mkdir(parents=True, exist_ok=True)
    
    file_extension = file.filename.split('.')[-1] if file.filename else 'jpg'
    filename = f"prod_{producto_id}.{file_extension}"
    file_path = static_dir / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    producto.imagen = f"/static/productos/{filename}"
    sesion.commit()
    sesion.refresh(producto)
    return producto