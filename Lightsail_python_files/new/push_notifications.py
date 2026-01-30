# push_notifications.py
"""
Módulo para envio de notificações push via Expo Push Notification Service
"""
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import requests
from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)

BR_TZ = ZoneInfo("America/Sao_Paulo")

# Configurações do CouchDB
COUCHDB_URL = os.getenv("COUCHDB_URL", "http://admin:wyrd@3.91.165.0:5984")
DATABASE = os.getenv("COUCHDB_DB", "lindsay-data")

HTTP = requests.Session()

# Mapeamento de tipos de alarme para prioridade
ALARM_PRIORITY_MAP = {
    "A": "critical",  # Tensão < 50V
    "B": "high",      # Fim de curso 1
    "C": "high",      # Fim de curso 2
    "D": "medium",    # Memória tensão baixa
    "E": "critical",  # Torre ausente
}

# Descrições dos tipos de alarme
ALARM_TYPE_DESCRIPTIONS = {
    "A": "Tensão abaixo de 50V",
    "B": "Fim-de-curso 1 (SW1)",
    "C": "Fim-de-curso 2 (SW2)",
    "D": "Memória de Tensão baixa",
    "E": "Torre ausente",
}


def fmt_ts_iso(dt: datetime) -> str:
    """Retorna timestamp ISO com timezone BR."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BR_TZ)
    else:
        dt = dt.astimezone(BR_TZ)
    return dt.isoformat()


def ensure_device_tokens_index() -> None:
    """
    Cria índice no CouchDB para otimizar queries de device_tokens.
    Deve ser executado uma vez na inicialização.
    """
    try:
        index_def = {
            "index": {
                "fields": ["table", "irrigadorIds", "enabled"]
            },
            "name": "idx_device_tokens_irrigadores",
            "type": "json"
        }

        response = HTTP.post(f"{COUCHDB_URL}/{DATABASE}/_index", json=index_def)

        if response.status_code in (200, 201):
            print("[Push] Índice de device_tokens criado/verificado com sucesso")
        else:
            print(f"[Push] Aviso ao criar índice: {response.status_code} - {response.text}")

    except Exception as e:
        print(f"[Push] Erro ao criar índice (não crítico): {e}")


def get_device_tokens(irrigador_id: str) -> List[Dict[str, Any]]:
    """
    Busca tokens de dispositivos que monitoram o irrigador especificado.

    Args:
        irrigador_id: ID do irrigador (ex: "LIND01")

    Returns:
        Lista de dicionários com informações dos dispositivos:
        [{"token": "ExponentPushToken[...]", "userId": "user@email.com", "platform": "android"}]
    """
    try:
        # Query Mango para buscar device_tokens
        # Usa correspondência direta: CouchDB encontra se irrigador_id está no array irrigadorIds
        query = {
            "selector": {
                "table": "device_tokens",
                "irrigadorIds": irrigador_id,
                "enabled": True,
            },
            "limit": 100,
        }

        response = HTTP.post(f"{COUCHDB_URL}/{DATABASE}/_find", json=query)

        if response.status_code != 200:
            print(f"[Push] Erro ao buscar tokens: {response.status_code}")
            return []

        data = response.json()
        docs = data.get("docs", [])

        if not docs:
            print(f"[Push] Nenhum token encontrado para {irrigador_id}")
            return []

        tokens = []
        for doc in docs:
            token = doc.get("expoPushToken")
            user_id = doc.get("userId")
            platform = doc.get("platform", "unknown")

            if token and PushClient.is_exponent_push_token(token):
                tokens.append({"token": token, "userId": user_id, "platform": platform})
            else:
                print(f"[Push] Token inválido ignorado: {token}")

        print(f"[Push] Encontrados {len(tokens)} tokens válidos para {irrigador_id}")
        return tokens

    except Exception as e:
        print(f"[Push] Erro ao buscar tokens: {e}")
        return []


def send_expo_push_notification(
    tokens: List[Dict[str, Any]], alert_data: Dict[str, Any]
) -> bool:
    """
    Envia notificações push via Expo Push Notification Service.

    Args:
        tokens: Lista de dicts com tokens e metadata
        alert_data: Dados do alerta contendo:
            - alertId: ID do documento do alerta
            - irrigadorId: ID do irrigador
            - eventType: Tipo do evento (A, B, C, D, E)
            - monitor: ID do monitor
            - timestamp: Timestamp formatado

    Returns:
        True se pelo menos uma notificação foi enviada com sucesso
    """
    if not tokens:
        print("[Push] Nenhum token para enviar notificações")
        return False

    try:
        # Cliente Expo Push
        client = PushClient()

        # Extrai dados do alerta
        alert_id = alert_data.get("alertId", "")
        irrigador_id = alert_data.get("irrigadorId", "")
        event_type = alert_data.get("eventType", "A")
        monitor = alert_data.get("monitor", "00")
        timestamp = alert_data.get("timestamp", "")

        # Prioridade baseada no tipo de alarme
        priority = ALARM_PRIORITY_MAP.get(event_type, "default")
        description = ALARM_TYPE_DESCRIPTIONS.get(event_type, "Alerta")

        # Título e corpo da notificação
        title = f"🚨 Alerta {event_type} - Monitor {monitor}"
        body = f"{irrigador_id} - {description}"

        # Monta as mensagens
        messages = []
        for token_data in tokens:
            token = token_data["token"]

            try:
                message = PushMessage(
                    to=token,
                    title=title,
                    body=body,
                    data={
                        "alertId": alert_id,
                        "irrigadorId": irrigador_id,
                        "eventType": event_type,
                        "monitor": monitor,
                        "timestamp": timestamp,
                    },
                    sound="default",
                    priority="high" if priority in ["critical", "high"] else "default",
                    badge=1,
                    channel_id=(
                        "alert-critical"
                        if priority == "critical"
                        else "alert-high" if priority == "high" else "alert-medium"
                    ),
                )
                messages.append(message)

            except Exception as e:
                print(f"[Push] Erro ao criar mensagem para {token}: {e}")
                continue

        if not messages:
            print("[Push] Nenhuma mensagem válida para enviar")
            return False

        # Envia as notificações em lote
        try:
            # Divide em chunks de 100 (limite do Expo)
            chunk_size = 100
            success_count = 0

            for i in range(0, len(messages), chunk_size):
                chunk = messages[i : i + chunk_size]
                tickets = client.publish_multiple(chunk)

                # Valida os tickets
                for ticket in tickets:
                    try:
                        ticket.validate_response()
                        success_count += 1
                    except PushTicketError as e:
                        print(f"[Push] Erro no ticket: {e.push_response}")
                    except DeviceNotRegisteredError:
                        # Token expirado/inválido - deveria remover do DB
                        print(f"[Push] Dispositivo não registrado")

            print(f"[Push] {success_count}/{len(messages)} notificações enviadas")
            return success_count > 0

        except PushServerError as e:
            print(f"[Push] Erro do servidor Expo: {e}")
            return False

    except Exception as e:
        print(f"[Push] Erro ao enviar notificações: {e}")
        return False


def save_notification_log(
    alert_id: str, tokens: List[Dict[str, Any]], success: bool, error: Optional[str] = None
) -> None:
    """
    Salva log da notificação enviada no CouchDB.

    Args:
        alert_id: ID do alerta que gerou a notificação
        tokens: Lista de tokens para os quais foi enviado
        success: Se o envio foi bem-sucedido
        error: Mensagem de erro (se houver)
    """
    try:
        log_doc = {
            "table": "notification_logs",
            "alert_id": alert_id,
            "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
            "tokens_count": len(tokens),
            "success": success,
            "error": error,
            "recipients": [t.get("userId") for t in tokens],
        }

        response = HTTP.post(f"{COUCHDB_URL}/{DATABASE}", json=log_doc)

        if response.status_code in (201, 202):
            print(f"[Push] Log salvo: {response.json().get('id')}")
        else:
            print(f"[Push] Erro ao salvar log: {response.status_code}")

    except Exception as e:
        print(f"[Push] Erro ao salvar log: {e}")


# Cache para evitar notificações duplicadas (5 minutos)
_NOTIFICATION_CACHE: Dict[str, float] = {}
_CACHE_TIMEOUT = 300  # segundos


def should_notify(alert_id: str) -> bool:
    """
    Verifica se deve enviar notificação (evita duplicatas).

    Args:
        alert_id: ID do alerta

    Returns:
        True se deve notificar, False se já foi notificado recentemente
    """
    import time

    current_time = time.time()

    # Verifica se já foi notificado recentemente
    if alert_id in _NOTIFICATION_CACHE:
        last_time = _NOTIFICATION_CACHE[alert_id]
        if current_time - last_time < _CACHE_TIMEOUT:
            return False

    # Adiciona ao cache
    _NOTIFICATION_CACHE[alert_id] = current_time

    # Limpa cache antigo
    expired_keys = [
        k for k, v in _NOTIFICATION_CACHE.items() if current_time - v > _CACHE_TIMEOUT
    ]
    for k in expired_keys:
        del _NOTIFICATION_CACHE[k]

    return True

