import boto3
import os
from app.core.config import settings


def get_cognito_client():
    """Fornece cliente Cognito com fallback para a cadeia padrão de credenciais da AWS.

    Evita enviar token/chaves vazios para o boto3, pois isso pode gerar
    UnrecognizedClientException mesmo quando existe perfil/role válido no ambiente.
    """
    profile_name = (os.getenv("AWS_PROFILE") or "").strip()
    client_kwargs = {"region_name": settings.AWS_REGION}

    access_key = (settings.AWS_ACCESS_KEY_ID or "").strip()
    secret_key = (settings.AWS_SECRET_ACCESS_KEY or "").strip()
    session_token = (settings.AWS_SESSION_TOKEN or "").strip()

    # Prioridade 1: profile explícito (útil para AWS SSO).
    if profile_name:
        session = boto3.session.Session(
            profile_name=profile_name, region_name=settings.AWS_REGION
        )
        return session.client("cognito-idp")

    # Prioridade 2: credenciais explícitas quando o par access/secret estiver completo.
    # Caso contrário, boto3 resolve via cadeia padrão (default profile/role/metadata).
    if access_key and secret_key:
        client_kwargs["aws_access_key_id"] = access_key
        client_kwargs["aws_secret_access_key"] = secret_key
        if session_token:
            client_kwargs["aws_session_token"] = session_token

    return boto3.client("cognito-idp", **client_kwargs)
