import functools
from typing import List

import email_validator
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
    EMAIL_VALIDATOR_TEST_ENVIRONMENT: bool = True
    EMAIL_VALIDATOR_CHECK_DELIVERABILITY: bool = False

    # -----------------------------------------------------------------------
    # AI Corner — Ollama local server configuration
    # -----------------------------------------------------------------------
    # URL of the running Ollama server. Backend and Ollama run on the same
    # machine in local mode. Never expose Ollama's port publicly.
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # Model to use. Run `ollama pull <model>` before starting.
    # Verified models: llama3:latest, qwen2.5-coder:7b
    OLLAMA_MODEL: str = "llama3:latest"

    # Maximum seconds to wait for a generation response.
    # Increase if using a large model on slow hardware.
    OLLAMA_TIMEOUT_SECONDS: float = 120.0

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
email_validator.TEST_ENVIRONMENT = settings.EMAIL_VALIDATOR_TEST_ENVIRONMENT
email_validator.CHECK_DELIVERABILITY = settings.EMAIL_VALIDATOR_CHECK_DELIVERABILITY
