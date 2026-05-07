"""Configuración cargada desde variables de entorno o `.env`.

Usamos pydantic-settings para tener validación y tipado fuerte. Las claves
están prefijadas con `KIOSKO_` para no chocar con otras variables del sistema
en la Pi (que comparte espacio con cron, systemd, etc.).
"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="KIOSKO_",
        extra="ignore",
        case_sensitive=False,
    )

    # Ruta al fichero SQLite. Por defecto, en la raíz del backend.
    db_path: Path = Field(default=Path("./database.db"))

    # Orígenes permitidos para CORS (lista separada por comas).
    cors_origins: str = Field(default="http://localhost:5173")

    log_level: str = Field(default="INFO")

    # Zona horaria del campamento. Determina la frontera de "hoy" para la
    # cota diaria y el badge de "compró hoy". La Pi puede tener su reloj en
    # UTC, así que nos hacemos independientes del sistema.
    tz: str = Field(default="Europe/Madrid")

    # PIN sembrado al primer arranque si la tabla `configuracion` aún no tiene
    # la clave `pin_admin`. Solo es un default conveniente; lo correcto es
    # cambiarlo desde Ajustes en la PWA.
    pin_admin_default: str = Field(default="0000")

    # Cota diaria por defecto en € (también se puede cambiar desde Ajustes).
    cota_diaria_default: float = Field(default=2.50)

    @property
    def database_url(self) -> str:
        # SQLAlchemy + sqlite quiere URL absoluta para evitar sorpresas con cwd.
        return f"sqlite:///{self.db_path.resolve()}"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


# Instancia global. Importar como `from app.config import settings`.
settings = Settings()
