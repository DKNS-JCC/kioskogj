"""Carga datos de prueba en la base de datos para desarrollo / demo.

Genera:
- Productos variados con distintas categorías.
- Niños repartidos en varios grupos, con saldo aleatorio.
- Algunos pedidos en cada una de las tres fases (pendiente, preparado, completado),
  para poder ver la UI de las tres pestañas inmediatamente.

Es **idempotente por defecto**: si ya hay productos o niños no hace nada.
Usa `--reset` para vaciar las tablas afectadas y empezar de cero.

Uso:
    cd backend
    python -m scripts.seed_demo            # añade datos si no hay
    python -m scripts.seed_demo --reset    # borra y vuelve a cargar

No toca `Configuracion` (cota_diaria, pin_admin) — eso lo gestiona `app.seed`.
"""
from __future__ import annotations

import argparse
import random
from datetime import timedelta

from sqlalchemy import select

from app.db import SessionLocal
from app.models import (
    Nino,
    Pedido,
    PedidoLinea,
    PedidoNino,
    Producto,
    Transaccion,
)
from app.schemas.transaccion import LineaCompra
from app.services import compra as compra_service
from app.tiempo import ahora_utc

# ─── Catálogos de prueba ───────────────────────────────────────────────────

PRODUCTOS_DEMO: list[tuple[str, float, str]] = [
    ("Cola-Cao frío", 1.20, "bebida"),
    ("Agua 0.5L", 0.60, "bebida"),
    ("Zumo piña", 1.10, "bebida"),
    ("Gusanitos", 0.80, "snack"),
    ("Patatas fritas", 1.00, "snack"),
    ("Galletas María", 0.50, "snack"),
    ("Calippo limón", 1.30, "helado"),
    ("Cornetto", 1.80, "helado"),
    ("Manzana", 0.40, "fruta"),
    ("Plátano", 0.40, "fruta"),
    ("Chupa Chups", 0.30, "chuche"),
    ("Regaliz rojo", 0.20, "chuche"),
]

# Cada grupo (= cabaña/edad) con sus niños. Saldo inicial generoso.
GRUPOS_DEMO: dict[int, list[tuple[str, str]]] = {
    1: [
        ("Lucía", "García"),
        ("Mateo", "Pérez"),
        ("Sofía", "Ruiz"),
        ("Daniel", "López"),
        ("Valeria", "Sánchez"),
    ],
    2: [
        ("Hugo", "Martín"),
        ("Martina", "Gómez"),
        ("Pablo", "Jiménez"),
        ("Emma", "Hernández"),
        ("Adrián", "Díaz"),
        ("Carla", "Moreno"),
    ],
    3: [
        ("Leo", "Álvarez"),
        ("Olivia", "Torres"),
        ("Diego", "Domínguez"),
        ("Noa", "Vázquez"),
        ("Bruno", "Ramos"),
    ],
    4: [
        ("Vega", "Iglesias"),
        ("Marcos", "Castro"),
        ("Aitana", "Reyes"),
        ("Iván", "Núñez"),
        ("Julia", "Crespo"),
        ("Álvaro", "Suárez"),
        ("Inés", "Ortega"),
    ],
}


def _resetear(s) -> None:
    """Vacía tablas que vamos a regenerar (respeta los CASCADE)."""
    # Orden importante por FK.
    s.query(PedidoLinea).delete()
    s.query(PedidoNino).delete()
    s.query(Pedido).delete()
    s.query(Transaccion).delete()
    s.query(Nino).delete()
    s.query(Producto).delete()
    s.commit()


def _crear_productos(s) -> dict[str, Producto]:
    productos: dict[str, Producto] = {}
    for nombre, precio, categoria in PRODUCTOS_DEMO:
        p = Producto(nombre=nombre, precio=precio, activo=True, categoria=categoria)
        s.add(p)
        productos[nombre] = p
    s.flush()
    return productos


def _crear_ninos(s, rng: random.Random) -> dict[int, list[Nino]]:
    """Devuelve {grupo: [Nino, ...]}."""
    por_grupo: dict[int, list[Nino]] = {}
    for grupo, lista in GRUPOS_DEMO.items():
        creados: list[Nino] = []
        for nombre, apellidos in lista:
            n = Nino(
                nombre=nombre,
                apellidos=apellidos,
                grupo=grupo,
                # Saldos variados para que se vean distintos casos en UI.
                dinero=round(rng.uniform(8.0, 25.0), 2),
            )
            s.add(n)
            creados.append(n)
        por_grupo[grupo] = creados
    s.flush()
    return por_grupo


def _añadir_lineas_random(
    p_nino: PedidoNino,
    productos: list[Producto],
    rng: random.Random,
    *,
    estado_lineas: str = "pendiente",
) -> None:
    """Añade 1-3 líneas aleatorias a un PedidoNino."""
    cuantas = rng.randint(1, 3)
    elegidos = rng.sample(productos, k=min(cuantas, len(productos)))
    for prod in elegidos:
        p_nino.lineas.append(
            PedidoLinea(
                producto_id=prod.id,
                producto_nombre=prod.nombre,
                producto_precio=prod.precio,
                cantidad=rng.randint(1, 2),
                estado=estado_lineas,
            )
        )


def _crear_pedidos(
    s,
    ninos_por_grupo: dict[int, list[Nino]],
    productos: dict[str, Producto],
    rng: random.Random,
) -> None:
    lista_productos = list(productos.values())
    ahora = ahora_utc()

    # ── Grupo 1: pedido PENDIENTE (kiosko aún no ha tocado nada). ──
    g1 = ninos_por_grupo[1]
    pedido = Pedido(
        grupo=1,
        estado="pendiente",
        nota="Por preparar — todos en pendiente.",
        creado_en=ahora - timedelta(minutes=5),
    )
    # Que algún niño se quede sin pedir nada (válido: simplemente no se añade).
    for nino in g1[:-1]:
        p_nino = PedidoNino(nino_id=nino.id, nino_nombre=f"{nino.nombre} {nino.apellidos}")
        _añadir_lineas_random(p_nino, lista_productos, rng, estado_lineas="pendiente")
        pedido.ninos.append(p_nino)
    s.add(pedido)

    # ── Grupo 2: pedido PREPARADO (kiosko ya resolvió, monitor por venir). ──
    g2 = ninos_por_grupo[2]
    pedido2 = Pedido(
        grupo=2,
        estado="preparado",
        nota="Listo para repartir.",
        creado_en=ahora - timedelta(minutes=20),
        preparado_en=ahora - timedelta(minutes=2),
    )
    for nino in g2:
        p_nino = PedidoNino(nino_id=nino.id, nino_nombre=f"{nino.nombre} {nino.apellidos}")
        _añadir_lineas_random(p_nino, lista_productos, rng, estado_lineas="listo")
        # Marca alguna línea como reemplazada para variar.
        if p_nino.lineas and rng.random() < 0.3:
            p_nino.lineas[0].estado = "reemplazado"
            p_nino.lineas[0].reemplazo_texto = "Galleta digestiva"
        # O descartada.
        if len(p_nino.lineas) > 1 and rng.random() < 0.2:
            p_nino.lineas[-1].estado = "descartado"
        pedido2.ninos.append(p_nino)
    s.add(pedido2)

    # ── Grupo 3: dos pedidos abiertos (para ver el aviso de duplicado). ──
    g3 = ninos_por_grupo[3]
    for offset in (40, 8):
        ped = Pedido(
            grupo=3,
            estado="pendiente",
            creado_en=ahora - timedelta(minutes=offset),
        )
        for nino in rng.sample(g3, k=min(2, len(g3))):
            p_nino = PedidoNino(nino_id=nino.id, nino_nombre=f"{nino.nombre} {nino.apellidos}")
            _añadir_lineas_random(p_nino, lista_productos, rng, estado_lineas="pendiente")
            ped.ninos.append(p_nino)
        s.add(ped)

    s.flush()

    # ── Grupo 4: pedido COMPLETADO (con cobro real para histórico). ──
    g4 = ninos_por_grupo[4]
    pedido4 = Pedido(
        grupo=4,
        estado="pendiente",  # se promociona por las APIs reales más abajo
        nota="Histórico (completado).",
        creado_en=ahora - timedelta(hours=2),
    )
    for nino in g4[:4]:
        p_nino = PedidoNino(nino_id=nino.id, nino_nombre=f"{nino.nombre} {nino.apellidos}")
        _añadir_lineas_random(p_nino, lista_productos, rng, estado_lineas="entregado")
        pedido4.ninos.append(p_nino)
    s.add(pedido4)
    s.flush()

    # Cobrar usando el servicio real (genera transacciones legítimas).
    for p_nino in pedido4.ninos:
        if p_nino.nino_id is None:
            continue
        lineas_compra = [
            LineaCompra(id=l.producto_id, cantidad=l.cantidad)  # type: ignore[arg-type]
            for l in p_nino.lineas
            if l.estado == "entregado" and l.producto_id is not None
        ]
        if not lineas_compra:
            continue
        try:
            resultado = compra_service.crear_compra(s, p_nino.nino_id, lineas_compra)
            p_nino.transaccion_id = resultado.transaccion.id
        except compra_service.ErrorCompra as e:
            print(f"  · No se pudo cobrar a {p_nino.nino_nombre}: {e}")
    pedido4.estado = "completado"
    pedido4.completado_en = ahora - timedelta(hours=1, minutes=55)
    pedido4.preparado_en = ahora - timedelta(hours=1, minutes=58)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed de datos de prueba.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Vacía las tablas antes de poblar (¡destructivo!).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Semilla del RNG para que los datos sean reproducibles.",
    )
    args = parser.parse_args()

    rng = random.Random(args.seed)
    s = SessionLocal()
    try:
        if args.reset:
            print("🧹 Reseteando tablas…")
            _resetear(s)
        else:
            existentes = s.scalar(select(Producto.id))
            if existentes is not None:
                print(
                    "⏭️  Ya hay datos (productos detectados). Usa --reset si quieres "
                    "regenerar."
                )
                return

        print("🛒 Creando productos…")
        productos = _crear_productos(s)
        print(f"   {len(productos)} productos.")

        print("🧒 Creando niños por grupo…")
        ninos_por_grupo = _crear_ninos(s, rng)
        total_ninos = sum(len(v) for v in ninos_por_grupo.values())
        print(f"   {total_ninos} niños en {len(ninos_por_grupo)} grupos.")

        print("📦 Creando pedidos en distintas fases…")
        _crear_pedidos(s, ninos_por_grupo, productos, rng)

        s.commit()
        print("✅ Seed completado.")
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()


if __name__ == "__main__":
    main()
