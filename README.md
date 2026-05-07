# Kiosko GJ v2

Aplicación de gestión del kiosko de un campamento infantil. Reescritura desde cero
de la versión Node/Express anterior. Pensada para correr **autoalojada en una
Raspberry Pi 3B+** y ser usada principalmente como **PWA instalable** desde el
móvil de los monitores.

> **Estado:** en desarrollo por fases. Esta es la **Fase 1** (estructura + dependencias).
> El despliegue en la Pi y la guía de instalación detallada llegan en la Fase 8.

## Stack

- **Backend** — FastAPI + SQLAlchemy 2 + Alembic + SQLite (modo WAL).
- **Frontend** — Vite + React + TypeScript + Tailwind + TanStack Query + Zustand.
- **Servidor** — Caddy delante de Uvicorn (1 worker), todo nativo (sin Docker).

## Estructura del repo

```
kioskogj/
├── backend/                # API FastAPI (Python 3.11+)
│   ├── app/                # Código de la app (modelos, routers, services...)
│   ├── tests/              # Tests pytest
│   ├── alembic/            # Migraciones (se añadirá en Fase 2)
│   ├── pyproject.toml      # Dependencias y herramientas Python
│   └── .env.example
├── frontend/               # PWA React + TS
│   ├── src/                # Código fuente (se añadirá en Fase 4)
│   ├── public/             # Estáticos + manifest PWA (Fase 4)
│   └── package.json
├── deploy/                 # Caddyfile, systemd unit, backup.sh (Fase 8)
└── README.md
```

## Desarrollo (resumen rápido — la guía detallada llega en fases siguientes)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env

# Frontend
cd ../frontend
pnpm install
pnpm dev
```

## Roadmap por fases

1. ✅ Estructura del repo + manifestos (`pyproject.toml`, `package.json`).
2. ⏳ Modelos SQLAlchemy + Alembic + migrador desde la DB legacy.
3. ⏳ Routers FastAPI + schemas + tests del flujo de compra.
4. ⏳ Esqueleto del frontend (routing, layout, manifest PWA).
5. ⏳ Pantalla de Pedido.
6. ⏳ Ajustes, Stats, Castigos.
7. ⏳ Service worker + cola offline.
8. ⏳ Despliegue en la Pi (Caddyfile, systemd, backups).
