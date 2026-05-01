from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    database_url: str = Field(default="")
    database_pool_min: int = 1
    database_pool_max: int = 10
    database_pool_timeout_seconds: float = 10.0
    database_command_timeout_seconds: float = 30.0

    supabase_project_url: str = ""
    supabase_jwks_url: str = ""
    supabase_jwt_issuer: str = ""
    supabase_jwt_audience: str = "authenticated"
    supabase_jwt_secret: str = ""
    supabase_jwt_verify_mode: str = "jwks"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.env.lower() == "production"


settings = Settings()
