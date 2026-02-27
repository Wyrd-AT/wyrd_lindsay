#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço de Notificações Multi-Canal
=====================================

Suporta:
- SMS via Twilio
- WhatsApp via Twilio
- WhatsApp via Z-API
- Email via SendGrid
- Ligações de voz via Twilio
- Push notifications via Expo
"""

import os
import re
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from app.core.config import settings
from twilio.rest import Client
from twilio.base.exceptions import TwilioException

# SendGrid imports (opcional)
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Email, To, Content

    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False

logger = logging.getLogger(__name__)
BR_TZ = ZoneInfo("America/Sao_Paulo")


class NotificationService:
    """Serviço centralizado de notificações"""

    def __init__(self):
        """Inicializar com credenciais de todas as provedoras"""
        # Twilio
        self.twilio_client = None
        self.twilio_account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_whatsapp_from = os.getenv("TWILIO_WHATSAPP_FROM")
        self.twilio_sms_from = os.getenv("TWILIO_SMS_FROM")
        self.twilio_voice_from = os.getenv("TWILIO_VOICE_FROM")

        if self.twilio_account_sid and self.twilio_auth_token:
            try:
                self.twilio_client = Client(
                    self.twilio_account_sid, self.twilio_auth_token
                )
                logger.info("✅ Twilio configurado")
            except Exception as e:
                logger.warning(f"⚠️ Falha ao inicializar Twilio: {e}")

        # Z-API (WhatsApp alternativo)
        self.zapi_instance = settings.ZAPI_INSTANCE
        self.zapi_token = settings.ZAPI_TOKEN
        self.zapi_client_token = settings.ZAPI_CLIENT_TOKEN
        self.zapi_base_url = settings.ZAPI_BASE_URL

        # SendGrid (Email)
        self.sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
        self.email_from = os.getenv("EMAIL_FROM", "noreply@exemplo.com")
        self.email_from_name = os.getenv(
            "EMAIL_FROM_NAME", "Sistema de Alarmes Lindsay"
        )

        # Rate limiting
        self.rate_limit_delay = float(os.getenv("RATE_LIMIT_DELAY", "0.5"))

    # =========================================================================
    # Validação
    # =========================================================================

    @staticmethod
    def validate_phone_number(phone: str) -> bool:
        """Valida formato de número de telefone"""
        cleaned = (
            phone.strip()
            .replace(" ", "")
            .replace("-", "")
            .replace("(", "")
            .replace(")", "")
        )
        pattern = r"^\+?\d{10,15}$"
        return bool(re.match(pattern, cleaned))

    @staticmethod
    def validate_email(email: str) -> bool:
        """Valida formato de email"""
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return bool(re.match(pattern, email))

    # =========================================================================
    # SMS via Twilio
    # =========================================================================

    def send_sms(
        self,
        message: str,
        to_numbers: List[str],
        from_number: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Enviar SMS via Twilio

        Args:
            message: Corpo da mensagem
            to_numbers: Lista de números para enviar
            from_number: Número de origem (default: TWILIO_SMS_FROM)

        Returns:
            Dict com status e detalhes do envio
        """
        if not self.twilio_client:
            return {"success": False, "error": "Twilio não configurado"}

        from_number = from_number or self.twilio_sms_from
        results = {"success": 0, "failed": 0, "details": []}

        for to_number in to_numbers:
            if not self.validate_phone_number(to_number):
                results["failed"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "invalid",
                        "error": "Número inválido",
                    }
                )
                continue

            try:
                msg = self.twilio_client.messages.create(
                    body=message, from_=from_number, to=to_number
                )
                results["success"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "sent",
                        "sid": msg.sid,
                    }
                )
                logger.info(f"✅ SMS enviado para {to_number}: {msg.sid}")

            except TwilioException as e:
                results["failed"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "failed",
                        "error": str(e),
                    }
                )
                logger.error(f"❌ Erro ao enviar SMS para {to_number}: {e}")

        return results

    # =========================================================================
    # WhatsApp via Twilio
    # =========================================================================

    def send_whatsapp_twilio(
        self,
        message: str,
        to_numbers: List[str],
        template_name: Optional[str] = None,
        template_params: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Enviar WhatsApp via Twilio

        Args:
            message: Corpo da mensagem
            to_numbers: Lista de números para enviar
            template_name: Nome do template (se usar)
            template_params: Parâmetros do template

        Returns:
            Dict com status e detalhes do envio
        """
        if not self.twilio_client or not self.twilio_whatsapp_from:
            return {"success": False, "error": "Twilio WhatsApp não configurado"}

        results = {"success": 0, "failed": 0, "details": []}

        for to_number in to_numbers:
            if not self.validate_phone_number(to_number):
                results["failed"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "invalid",
                        "error": "Número inválido",
                    }
                )
                continue

            try:
                # Garantir que o número tenha whatsapp:
                to_wa = (
                    f"whatsapp:{to_number}"
                    if not to_number.startswith("whatsapp:")
                    else to_number
                )

                msg = self.twilio_client.messages.create(
                    body=message,
                    from_=f"whatsapp:{self.twilio_whatsapp_from}",
                    to=to_wa,
                )

                results["success"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "sent",
                        "sid": msg.sid,
                    }
                )
                logger.info(f"✅ WhatsApp enviado para {to_number}: {msg.sid}")

            except TwilioException as e:
                results["failed"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "failed",
                        "error": str(e),
                    }
                )
                logger.error(f"❌ Erro ao enviar WhatsApp para {to_number}: {e}")

        return results

    # =========================================================================
    # WhatsApp via Z-API
    # =========================================================================

    def send_whatsapp_zapi(
        self,
        message: str,
        to_numbers: List[str],
    ) -> Dict[str, Any]:
        """
        Enviar WhatsApp via Z-API (alternativo ao Twilio)

        Args:
            message: Corpo da mensagem
            to_numbers: Lista de números para enviar

        Returns:
            Dict com status e detalhes do envio
        """
        if not self.zapi_instance or not self.zapi_token:
            return {"success": False, "error": "Z-API não configurado"}

        results = {"success": 0, "failed": 0, "details": []}
        headers = {
            "Client-Token": self.zapi_client_token,
            "Content-Type": "application/json",
        }

        for to_number in to_numbers:
            if not self.validate_phone_number(to_number):
                results["failed"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "invalid",
                        "error": "Número inválido",
                    }
                )
                continue

            try:
                # Formato Z-API: número sem +
                clean_number = re.sub(r"\D", "", to_number)

                payload = {
                    "phone": clean_number,
                    "message": message,
                }

                url = f"{self.zapi_base_url}/instances/{self.zapi_instance}/token/{self.zapi_token}/send-message"
                response = requests.post(url, json=payload, headers=headers, timeout=10)

                if response.status_code == 200:
                    data = response.json()
                    results["success"] += 1
                    results["details"].append(
                        {
                            "to": to_number,
                            "status": "sent",
                            "message_id": data.get("messageId"),
                        }
                    )
                    logger.info(f"✅ Z-API WhatsApp enviado para {to_number}")
                else:
                    results["failed"] += 1
                    results["details"].append(
                        {
                            "to": to_number,
                            "status": "failed",
                            "error": f"HTTP {response.status_code}",
                        }
                    )
                    logger.error(f"❌ Z-API erro para {to_number}: {response.text}")

            except Exception as e:
                results["failed"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "failed",
                        "error": str(e),
                    }
                )
                logger.error(f"❌ Erro Z-API para {to_number}: {e}")

        return results

    # =========================================================================
    # Ligação de Voz via Z-API
    # =========================================================================

    def send_voice_call_zapi(
        self,
        to_numbers: List[str],
        call_duration: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Enviar ligação de voz via Z-API

        Args:
            to_numbers: Lista de números para ligar
            call_duration: Duração da chamada em segundos (opcional, máx 15s segundo a doc)

        Returns:
            Dict com status e detalhes do envio
        """
        if not self.zapi_instance or not self.zapi_token:
            return {"success": False, "error": "Z-API não configurado"}

        results = {"success": 0, "failed": 0, "details": []}
        headers = {
            "Client-Token": self.zapi_client_token,
            "Content-Type": "application/json",
        }

        for to_number in to_numbers:
            if not self.validate_phone_number(to_number):
                results["failed"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "invalid",
                        "error": "Número inválido",
                    }
                )
                continue

            try:
                # Formato Z-API: apenas números, sem + ou máscaras
                clean_number = re.sub(r"\D", "", to_number)

                payload: Dict[str, Any] = {"phone": clean_number}

                # Adiciona o callDuration apenas se foi passado como argumento
                if call_duration is not None:
                    payload["callDuration"] = call_duration

                url = f"{self.zapi_base_url}/instances/{self.zapi_instance}/token/{self.zapi_token}/send-call"
                response = requests.post(url, json=payload, headers=headers, timeout=10)

                if response.status_code == 200:
                    data = response.json()
                    results["success"] += 1
                    results["details"].append(
                        {
                            "to": to_number,
                            "status": "initiated",
                            "message_id": data.get("messageId"),
                            "zaap_id": data.get("zaapId"),
                        }
                    )
                    logger.info(f"✅ Ligação Z-API iniciada para {to_number}")
                else:
                    results["failed"] += 1
                    results["details"].append(
                        {
                            "to": to_number,
                            "status": "failed",
                            "error": f"HTTP {response.status_code}",
                        }
                    )
                    logger.error(
                        f"❌ Z-API erro ao ligar para {to_number}: {response.text}"
                    )

            except Exception as e:
                results["failed"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "failed",
                        "error": str(e),
                    }
                )
                logger.error(f"❌ Erro Z-API ao ligar para {to_number}: {e}")

        return results

    # =========================================================================
    # Email via SendGrid
    # =========================================================================

    def send_email(
        self,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        to_emails: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Enviar Email via SendGrid

        Args:
            subject: Assunto do email
            body_text: Corpo em texto puro
            body_html: Corpo em HTML (opcional)
            to_emails: Lista de emails para enviar

        Returns:
            Dict com status e detalhes do envio
        """
        if not SENDGRID_AVAILABLE or not self.sendgrid_api_key:
            return {"success": False, "error": "SendGrid não configurado"}

        if not to_emails:
            return {"success": False, "error": "Nenhum email fornecido"}

        results = {"success": 0, "failed": 0, "details": []}

        try:
            sg = SendGridAPIClient(self.sendgrid_api_key)

            for to_email in to_emails:
                if not self.validate_email(to_email):
                    results["failed"] += 1
                    results["details"].append(
                        {
                            "to": to_email,
                            "status": "invalid",
                            "error": "Email inválido",
                        }
                    )
                    continue

                try:
                    message = Mail(
                        from_email=Email(self.email_from, self.email_from_name),
                        to_emails=To(to_email),
                        subject=subject,
                        plain_text_content=Content("text/plain", body_text),
                    )

                    if body_html:
                        message.add_content(Content("text/html", body_html), index=1)

                    response = sg.send(message)

                    if response.status_code in (200, 201, 202):
                        results["success"] += 1
                        results["details"].append(
                            {
                                "to": to_email,
                                "status": "sent",
                            }
                        )
                        logger.info(f"✅ Email enviado para {to_email}")
                    else:
                        results["failed"] += 1
                        results["details"].append(
                            {
                                "to": to_email,
                                "status": "failed",
                                "error": f"HTTP {response.status_code}",
                            }
                        )

                except Exception as e:
                    results["failed"] += 1
                    results["details"].append(
                        {
                            "to": to_email,
                            "status": "failed",
                            "error": str(e),
                        }
                    )
                    logger.error(f"❌ Erro ao enviar email para {to_email}: {e}")

        except Exception as e:
            return {"success": False, "error": f"Falha ao inicializar SendGrid: {e}"}

        return results

    # =========================================================================
    # Ligação de Voz via Twilio
    # =========================================================================

    def send_voice_call(
        self,
        message: str,
        to_numbers: List[str],
        twiml_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Enviar ligação de voz via Twilio

        Args:
            message: Mensagem de voz (será convertida em TTS)
            to_numbers: Lista de números para ligar
            twiml_url: URL do TwiML customizado (opcional)

        Returns:
            Dict com status e detalhes do envio
        """
        if not self.twilio_client or not self.twilio_voice_from:
            return {"success": False, "error": "Twilio Voice não configurado"}

        results = {"success": 0, "failed": 0, "details": []}

        for to_number in to_numbers:
            if not self.validate_phone_number(to_number):
                results["failed"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "invalid",
                        "error": "Número inválido",
                    }
                )
                continue

            try:
                # Se twiml_url for fornecido, usar; senão gerar TwiML simples
                twiml = twiml_url or None

                call = self.twilio_client.calls.create(
                    to=to_number,
                    from_=self.twilio_voice_from,
                    url=twiml,
                )

                results["success"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "initiated",
                        "call_sid": call.sid,
                    }
                )
                logger.info(f"✅ Ligação iniciada para {to_number}: {call.sid}")

            except TwilioException as e:
                results["failed"] += 1
                results["details"].append(
                    {
                        "to": to_number,
                        "status": "failed",
                        "error": str(e),
                    }
                )
                logger.error(f"❌ Erro ao ligar para {to_number}: {e}")

        return results

    # =========================================================================
    # Send Multiplex (SMS + WhatsApp + Email juntos)
    # =========================================================================

    def send_multi(
        self,
        message: str,
        subject: str = "",
        body_html: Optional[str] = None,
        phones: Optional[List[str]] = None,
        emails: Optional[List[str]] = None,
        channels: Optional[List[str]] = None,  # ["sms", "whatsapp", "email"]
        call_duration: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Enviar mensagem por múltiplos canais simultaneamente

        Args:
            message: Corpo da mensagem
            subject: Assunto (para email)
            body_html: HTML (para email)
            phones: Números de telefone
            emails: Endereços de email
            channels: Lista de canais ["sms", "whatsapp", "whatsapp_zapi", "email", "voice"]

        Returns:
            Dict consolidado com resultados de todos os canais
        """
        channels = channels or ["sms", "whatsapp", "email"]
        results = {"channels": {}}

        if "sms" in channels and phones:
            results["channels"]["sms"] = self.send_sms(message, phones)

        if "whatsapp" in channels and phones:
            results["channels"]["whatsapp"] = self.send_whatsapp_twilio(message, phones)

        if "whatsapp_zapi" in channels and phones:
            results["channels"]["whatsapp_zapi"] = self.send_whatsapp_zapi(
                message, phones
            )

        if "email" in channels and emails:
            results["channels"]["email"] = self.send_email(
                subject, message, body_html, emails
            )

        if "voice" in channels and phones:
            results["channels"]["voice"] = self.send_voice_call(message, phones)

        if "voice_zapi" in channels and phones:
            results["channels"]["voice_zapi"] = self.send_voice_call_zapi(
                to_numbers=phones, call_duration=call_duration
            )

        return results


# Instância global
notification_service = NotificationService()
