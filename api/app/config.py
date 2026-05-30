import logging

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

INSECURE_JWT_PLACEHOLDER = "dev_jwt_secret_change_in_production"


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://bp_user:bp_secret@postgres:5432/business_plan"
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    jwt_secret: str = INSECURE_JWT_PLACEHOLDER
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    discount_rate: float = 0.10
    # Step 1 security: admin key for creating expert accounts (header X-Admin-Key)
    admin_api_key: str | None = None
    # Expert auto-assigned when a client submits a plan
    assign_expert_email: str | None = None
    app_env: str = "development"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    run_migrations: bool = False
    export_storage_path: str = "/app/exports"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()


def validate_security_settings() -> None:
    if settings.jwt_secret == INSECURE_JWT_PLACEHOLDER:
        if settings.app_env.lower() in ("production", "prod"):
            raise RuntimeError(
                "JWT_SECRET must be set to a strong random value in production (APP_ENV=production)"
            )
        logger.warning(
            "SECURITY: default JWT_SECRET in use — set JWT_SECRET in .env before deploying"
        )
    if not settings.admin_api_key and settings.app_env.lower() in ("production", "prod"):
        logger.warning(
            "SECURITY: ADMIN_API_KEY not set — expert accounts cannot be provisioned via API"
        )
