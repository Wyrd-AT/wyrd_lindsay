import boto3
from app.core.config import settings


def get_cognito_client():
    """Fornece uma instância configurada do cliente do Cognito."""

    # Em dev, usa as credenciais do .env se estiverem preenchidas
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        return boto3.client(
            "cognito-idp",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            aws_session_token=settings.AWS_SESSION_TOKEN or None,
        )

    # Em produção, usa as credenciais do aws configure (nunca expiram)
    return boto3.client(
        "cognito-idp",
        region_name=settings.AWS_REGION,
    )
