"""
Configurações da aplicação Lindsay FastAPI
"""

import os
from zoneinfo import ZoneInfo
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Configurações da aplicação"""

    # App
    APP_NAME: str = "Lindsay API"
    APP_VERSION: str = "2.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = ENVIRONMENT == "development"

    # API
    API_PREFIX: str = "/api"
    DOCS_URL: str = "/docs"
    REDOC_URL: str = "/redoc"
    OPENAPI_URL: str = "/openapi.json"

    # Database
    COUCHDB_URL: str = os.getenv("COUCHDB_URL", "https://admin:wyrd@db.vpn.ind.br")
    COUCHDB_DB: str = os.getenv("COUCHDB_DB", "lindsay-data")
    COUCHDB_USERS_DB: str = os.getenv(
        "COUCHDB_USERS_DB", "lindsay-users"
    )  # ← Novo banco para usuários

    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-key-change-in-prod")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = JWT_EXPIRATION_HOURS * 60

    # MQTT
    MQTT_BROKER: str = os.getenv("MQTT_BROKER", "localhost")
    MQTT_PORT: int = int(os.getenv("MQTT_PORT", "1883"))
    MQTT_TOPIC: str = os.getenv("MQTT_TOPIC", "pivo/+/dados")
    MQTT_QOS: int = int(os.getenv("MQTT_QOS", "1"))
    MQTT_CLIENT_ID: str = os.getenv("MQTT_CLIENT_ID", "lindsay-api")

    # Workers
    WORKER_COUNT: int = int(os.getenv("WORKER_COUNT", "8"))
    QUEUE_MAXSIZE: int = int(os.getenv("QUEUE_MAXSIZE", "5000"))

    # Twilio
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_WHATSAPP_FROM: str = os.getenv("TWILIO_WHATSAPP_FROM", "")

    # Z-API
    ZAPI_INSTANCE: str = os.getenv("ZAPI_INSTANCE", "")
    ZAPI_TOKEN: str = os.getenv("ZAPI_TOKEN", "")
    ZAPI_CLIENT_TOKEN: str = os.getenv("ZAPI_CLIENT_TOKEN", "")
    ZAPI_BASE_URL: str = os.getenv("ZAPI_BASE_URL", "https://api.z-api.io")

    # SendGrid
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@example.com")

    # AWS Cognito
    AWS_REGION: str = os.getenv("AWS_REGION", "sa-east-1")
    COGNITO_CLIENT_ID: str = os.getenv(
        "COGNITO_CLIENT_ID", "42qha79hpnknpksf2k1djo7eq9"
    )
    COGNITO_CLIENT_SECRET: str = os.getenv(
        "COGNITO_CLIENT_SECRET", "1jeh2l3f1uf4pjaqcf77i7a2rccucjlg7cnc3lu89n9hhc25qcv6"
    )  # Se vazio, cliente não tem secret
    COGNITO_USER_POOL_ID: str = os.getenv("COGNITO_USER_POOL_ID", "sa-east-1_bm329gdfB")

    # AWS
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_SESSION_TOKEN: str = os.getenv("AWS_SESSION_TOKEN", "")

    # Timezone
    TIMEZONE: str = "America/Sao_Paulo"
    TZ: ZoneInfo = ZoneInfo("America/Sao_Paulo")

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    class Config:
        env_file = ".env"
        case_sensitive = True


# Instância global
settings = Settings()
