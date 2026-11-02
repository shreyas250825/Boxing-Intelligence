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

    # AI Corner — OpenAI-compatible settings
    # Set OPENAI_API_KEY to enable the AI Corner. Required for all LLM features.
    OPENAI_API_KEY: str = ""
    # Override base URL to use an alternative OpenAI-compatible provider
    OPENAI_BASE_URL: str = ""
    # Model to use — default gpt-4o-mini for cost efficiency
    AI_MODEL: str = "gpt-4o-mini"

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
