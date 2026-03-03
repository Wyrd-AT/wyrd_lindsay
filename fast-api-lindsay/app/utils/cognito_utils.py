"""
Utilidades para autenticação com AWS Cognito
"""

import hmac
import hashlib
import base64
from app.core.config import settings


def get_secret_hash(username: str) -> str:
    """
    Calcula o SECRET_HASH para Cognito quando o cliente tem um secret configurado.

    Fórmula: HMAC-SHA256(client_secret, username + client_id)
    Encoded: base64(resultado)

    Args:
        username: Email ou username do usuário

    Returns:
        O SECRET_HASH codificado em base64
    """
    # Verificar se há um client secret configurado
    client_secret = getattr(
        settings,
        "COGNITO_CLIENT_SECRET",
        "1jeh2l3f1uf4pjaqcf77i7a2rccucjlg7cnc3lu89n9hhc25qcv6",
    )

    if not client_secret:
        # Se não há secret, retorna None
        return None

    message = bytes(username + settings.COGNITO_CLIENT_ID, "utf-8")
    secret = bytes(client_secret, "utf-8")

    dig = hmac.new(secret, msg=message, digestmod=hashlib.sha256).digest()
    return base64.b64encode(dig).decode()
