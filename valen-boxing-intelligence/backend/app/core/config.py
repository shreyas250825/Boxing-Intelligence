import functools
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./data/valen_boxing.db"
    SECRET_KEY: str = "change-me-in-production"
    # Store as plain string; parse with cors_origins_list property
    CORS_ORIGINS: str = "http://localhost:5173"
    STORAGE_DIR: str = "./data/videos"
    REPORTS_DIR: str = "./data/reports"
    MAX_UPLOAD_BYTES: int = 2_147_483_648  # 2 GB
    FRAME_INTERVAL_SECONDS: float = 0.5
    MAX_FRAMES: int = 500

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        env_file_encoding="utf-8",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS_ORIGINS string into a list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@functools.lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
