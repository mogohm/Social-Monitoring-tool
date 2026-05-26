from pathlib import Path
from pydantic_settings import BaseSettings

_HERE = Path(__file__).parent


class Settings(BaseSettings):
    DATABASE_URL: str
    SYNC_DATABASE_URL: str = ""
    OPENAI_API_KEY: str = ""
    SECRET_KEY: str = "changeme"
    REDIS_URL: str = "redis://localhost:6379"
    LINE_CHANNEL_ACCESS_TOKEN: str = ""
    LINE_CHANNEL_SECRET: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    class Config:
        env_file = [str(_HERE / ".env"), ".env", "backend/.env"]


settings = Settings()
