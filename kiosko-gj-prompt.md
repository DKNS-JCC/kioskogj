# Contexto del proyecto: Kiosko GJ v2

Vas a ayudarme a reconstruir desde cero una aplicación web que ya existió en una versión anterior (Node/Express + SQLite servida desde AWS, con HTML estático multipágina). La nueva versión debe correr **autoalojada en una Raspberry Pi 3B+** fuera de la red local del campamento, ser usable principalmente desde **móvil (iOS y Android)** como **PWA instalable**, y mantener la lógica de negocio probada de la versión anterior pero modernizando arquitectura, UX y mantenibilidad.

---

## 1. Qué es el proyecto

**Kiosko GJ** es la aplicación de gestión de un kiosko de campamento infantil. Cada niño tiene un saldo monetario (€). Los monitores registran las compras del kiosko desde el móvil: seleccionan al niño, añaden productos del catálogo, confirman, y se descuenta automáticamente del saldo. Sustituye al Excel manual que se usaba antes.

Además del kiosko, gestiona un sistema de **castigos** (un niño castigado no puede comprar durante 12 h)

El uso es **típicamente en RED** (Raspi remota conectados por datos moviles).

---

## 2. Stack obligatorio

- **Backend:** FastAPI (Python 3.11+) + SQLite con WAL mode habilitado.
- **ORM:** SQLAlchemy 2.x (estilo declarativo moderno) + Alembic para migraciones.
- **Frontend:** PWA con **Vite + React + TypeScript**. Tailwind CSS para estilos. Zustand o TanStack Query para estado/cache de servidor.
- **Servidor web:** Caddy delante de FastAPI (reverse proxy + HTTPS automático con certificado autofirmado o Tailscale cert para LAN).
- **Proceso:** systemd para arrancar FastAPI al boot. La PWA se compila a estáticos servidos por Caddy (no por FastAPI).
- **Acceso remoto opcional:** Tailscale (no implementar, solo dejar documentado) u otras alternativas que reduzcan la carga de usuarios no experimentados a conectarse.
- **Backups:** script cron que copia `database.db` cada noche a un pendrive USB y opcionalmente a una carpeta sincronizada (rclone a Drive si se desea).

**Por qué este stack:** SQLite va a sobrarle a una Raspi 3B+ con la carga real de 1-3 monitores concurrentes y unos cientos de transacciones diarias. FastAPI da OpenAPI autogenerado, validación Pydantic, y rendimiento muy superior a Express en la Pi

---

## 3. Modelo de datos

Estas son las entidades de la versión anterior. Mantener nombres de campos en español por consistencia con el dominio, pero los **nombres de tablas en plural y minúsculas**.

### `ninos`
- `id` (PK, autoincrement)
- `nombre` (text, requerido)
- `apellidos` (text, requerido)
- `grupo` (int, requerido — número de grupo del campamento)
- `dinero` (real, requerido — saldo en €)
- `creado_en` (timestamp ISO, automático)

### `productos`
- `id` (PK, autoincrement)
- `nombre` (text, requerido)
- `precio` (real, requerido, > 0)
- `activo` (bool, default true) — *campo nuevo, para retirar productos sin borrarlos*
- `creado_en` (timestamp)

### `transacciones`
- `id` (PK, autoincrement)
- `nino_id` (FK → ninos.id, ON DELETE SET NULL)
- `nino_nombre` (text — desnormalizado, persiste si se borra el niño)
- `productos_json` (text — array JSON de `{id, nombre, precio, cantidad}`)
- `total` (real, requerido)
- `fecha_hora` (timestamp ISO, automático)
- `reembolsada` (bool, default false) — *en lugar de borrar, marcar como reembolsada para auditoría*

### `castigos_activos`
- `nino_id` (PK, FK → ninos.id ON DELETE CASCADE)
- `hasta` (int — timestamp epoch ms hasta cuándo dura el castigo)

### `castigos_historico`
- `id` (PK, autoincrement)
- `nino_id` (FK)
- `fecha` (int — epoch ms)
- `hasta` (int — epoch ms)
- `revocado` (bool, default false)

### `configuracion`
- `clave` (PK, text — ej. `cota_diaria`, `pin_admin`)
- `valor` (text — JSON o string según clave)
---

## 4. Funcionalidad — endpoints y flujos

Mantener la **paridad funcional** con la versión anterior. Lista exhaustiva:

### Niños
- `GET /api/ninos` — listar todos.
- `POST /api/ninos` — crear (validación: grupo > 0, dinero ≥ 0).
- `PUT /api/ninos/{id}` — actualizar.
- `DELETE /api/ninos/{id}`.
- `POST /api/ninos/limpiar` — borrar todos (al cerrar campamento). **Requiere PIN admin.**
- `GET /api/ninos/{id}/info` — devuelve `{ saldo, tokens, comprado_hoy: bool }`.
- `GET /api/ninos/{id}/historial` — historial de compras del niño (productos expandidos uno a uno por línea).

### Productos
- `GET /api/productos` (filtro `?activo=true`).
- `POST /api/productos`, `PUT /api/productos/{id}`, `DELETE /api/productos/{id}`.

### Compras
- `POST /api/transacciones` — body: `{ nino_id, productos: [{id, cantidad}], }`. El backend:
  1. Verifica que el niño no esté castigado (consulta `castigos_activos`).
  2. Calcula el total con precios actuales del catálogo (no fiarse del cliente).
  3. Verifica saldo suficiente.
  4. Avisa si supera la `cota_diaria` configurada (no bloquea, solo marca `aviso_cota` en respuesta).
  5. Descuenta saldo y registra transacción de forma atómica (transacción SQL).
- `GET /api/transacciones?fecha_inicio&fecha_fin&nino_id&grupo&busqueda`.
- `POST /api/transacciones/{id}/reembolsar` — devuelve dinero al niño y marca `reembolsada=true` (no borra).

### Castigos
- `POST /api/ninos/{id}/castigar` — castiga 12 h. Inserta en `castigos_activos` (upsert) y en `castigos_historico`.
- `DELETE /api/ninos/{id}/castigar` — revoca el castigo activo y marca el histórico como `revocado=true`.
- `GET /api/castigos` — diccionario `{ nino_id: hasta_ms }` de castigos activos. Limpiar expirados al consultar.
- `GET /api/castigos/historico` — `{ nino_id: total_veces_castigado }`.

### Configuración
- `GET /api/configuracion` — devuelve `{ cota_diaria }` (default 2.50) y demás claves públicas.
- `POST /api/configuracion` — actualiza claves. **Requiere PIN admin** para cambios sensibles.

### Estadísticas
- `GET /api/estadisticas` — `{ total_ventas, ventas_hoy, top_ninos (5), ventas_por_dia (últimos 10 días) }`.

---

## 6. UX / Pantallas (PWA)

Diseño **mobile-first**, light mode por defecto (uso en exterior con mucha luz), botones grandes, gestos cómodos.

### Pantalla principal: **Pedido**
- Buscador prominente arriba (busca por nombre/apellidos del niño).
- Filtro rápido por grupo (chips).
- Grid de niños con foto + nombre. Si tiene compra hoy: badge azul. Si está castigado: overlay rojo y no clickable.
- Al tocar un niño → modal/pantalla con:
  - Saldo actual y tokens.
  - Lista de productos activos con `+`/`-` para cantidad.
  - Sección tokens con `+`/`-`.
  - Botón grande **Confirmar**.
  - Aviso si supera cota diaria (modal de confirmación, no bloqueante).

### Ajustes (`/ajustes`) — protegido con PIN
- Tabs: Niños | Productos | Configuración.
- CRUD completo. Importación masiva por CSV opcional (nombre, apellidos, grupo, dinero, tokens).

### Estadísticas (`/stats`)
- Resumen de actividad, top 5 niños, ventas por día (gráfico simple con Recharts), tabla de transacciones con filtros (fecha, niño, grupo, búsqueda).
- Botón reembolsar por transacción.
- Exportar a CSV el rango filtrado.

### Castigos (`/castigos`)
- Lista de niños agrupados por grupo, con su número de castigos histórico.
- Botón castigar / revocar castigo.
- Cuenta atrás visual del castigo activo.

### Tutorial in-app
- Primer arranque: tour guiado paso a paso (la versión anterior lo tenía).
- Persistir en localStorage que ya se completó.

---

## 7. Despliegue en Raspberry Pi 3B+

Producir un `README.md` con pasos exactos:

3. Instalar dependencias: Python 3.11, Node 20 (solo para build de frontend), Caddy.
4. Clonar repo, crear venv, `pip install -e .`.
5. `npm ci && npm run build` en `/frontend`, copiar `dist/` a `/var/www/kiosko`.
6. Configurar `Caddyfile` para servir estáticos y proxy a `localhost:8000`.
7. `systemctl enable kiosko-api.service`.
8. Configurar cron de backups.
9. Anotar IP fija del router para la Pi y mDNS (`kiosko.local`).

Optimizaciones específicas para Pi 3B+:
- Habilitar SQLite WAL.
- `uvicorn --workers 1` (la 3B+ con 1 GB RAM no aguanta más con el frontend en memoria).
- Logs rotativos con `logrotate` para no llenar la SD.
- Considerar mover `/var/log` y `/tmp` a tmpfs para alargar vida de la SD.

---

## 8. Estructura del repo

```
kiosko-gj/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── db.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routers/  (ninos, productos, transacciones, castigos, tokens, config, stats)
│   │   ├── services/  (lógica de negocio fuera de routers)
│   │   ├── auth.py
│   │   └── migrate_legacy.py
│   ├── alembic/
│   ├── tests/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── pages/  (Pedido, Ajustes, Stats, Castigos)
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── api/  (cliente generado desde OpenAPI o tipado a mano)
│   │   └── pwa/  (service worker, sync queue)
│   ├── public/
│   │   ├── manifest.webmanifest
│   │   └── icons/
│   └── package.json
├── deploy/
│   ├── Caddyfile
│   ├── kiosko-api.service
│   └── backup.sh
└── README.md
```

---

## 9. Cómo proceder

**Itera por fases, no me devuelvas todo de golpe.** Ve mostrándome y pidiéndome confirmación entre fases:

1. Estructura del repo y `pyproject.toml` + `package.json` con dependencias justificadas.
2. Modelos SQLAlchemy + migración Alembic inicial + script de migración desde el `database.db` legacy.
3. Routers FastAPI con todos los endpoints, schemas Pydantic, tests pytest del flujo de compra.
4. Esqueleto del frontend con routing, layout, dark mode, manifest PWA.
5. Pantalla de Pedido completa.
6. Ajustes, Stats, Castigos.
7. Service worker + cola offline.
8. Despliegue: Caddyfile, systemd, scripts de backup, README.

En cada fase, devuelve solo el código de esa fase, explicando decisiones de diseño no obvias.

---

## 10. Restricciones y preferencias mías

- Hablamos en español, comentarios de código en español.
- Yo voy a mantener esto: prioriza **legibilidad sobre cleverness**.
- Logs claros con `loguru` o `structlog`.
- Nada de Docker. La Pi 3B+ con Docker se ahoga; correr nativo.
- Nada de bases de datos en la nube. SQLite local.
- Nada de frameworks pesados de UI (no Material UI, no Ant). Tailwind + componentes propios o shadcn/ui.
- Si alguna decisión técnica te parece dudosa para mi caso (Raspi 3B+, ~150 niños, ~15 productos, ~1-3 monitores concurrentes), dímelo antes de implementarla.
