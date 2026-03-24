#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço de Email para Verificação e Convites

Templates HTML para:
- Código de verificação de email
- Convite de ativação de conta (clientes criados por admin/revenda)
"""

import logging
from app.core.config import settings
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


class EmailService:
    """Serviço de envio de emails de verificação e convite"""

    @staticmethod
    def send_verification_code(email: str, code: str, name: str) -> bool:
        """
        Enviar email com código de verificação

        Returns:
            True se enviado com sucesso
        """
        subject = f"Lindsay - Código de Verificação: {code}"

        body_text = (
            f"Olá {name},\n\n"
            f"Seu código de verificação é: {code}\n\n"
            f"Este código expira em {settings.VERIFICATION_CODE_EXPIRY_MINUTES} minutos.\n\n"
            f"Se você não solicitou este código, ignore este email.\n\n"
            f"Atenciosamente,\nEquipe Lindsay"
        )

        body_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #272727; color: #e5e7eb; padding: 40px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4ade80; margin: 0;">Lindsay</h1>
                <p style="color: #9ca3af; margin-top: 5px;">Sistema de Monitoramento</p>
            </div>

            <div style="background-color: #313131; padding: 30px; border-radius: 8px; text-align: center;">
                <h2 style="color: #e5e7eb; margin-top: 0;">Verificação de Email</h2>
                <p style="color: #9ca3af;">Olá <strong style="color: #e5e7eb;">{name}</strong>,</p>
                <p style="color: #9ca3af;">Use o código abaixo para verificar seu email:</p>

                <div style="background-color: #272727; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #4ade80;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4ade80;">{code}</span>
                </div>

                <p style="color: #6b7280; font-size: 14px;">
                    Este código expira em <strong>{settings.VERIFICATION_CODE_EXPIRY_MINUTES} minutos</strong>.
                </p>
            </div>

            <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #374151;">
                <p style="color: #6b7280; font-size: 12px;">
                    Se você não solicitou este código, ignore este email.
                </p>
            </div>
        </div>
        """

        result = notification_service.send_email(
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            to_emails=[email],
        )

        success = result.get("success", 0) > 0
        if success:
            logger.info(f"Email de verificação enviado para {email}")
        else:
            logger.error(f"Falha ao enviar email de verificação para {email}: {result}")

        return success

    @staticmethod
    def send_invitation(
        email: str, invitation_token: str, name: str, invited_by: str
    ) -> bool:
        """
        Enviar email de convite para ativação de conta

        Returns:
            True se enviado com sucesso
        """
        activation_url = f"{settings.FRONTEND_URL}/activate?token={invitation_token}"
        subject = "Lindsay - Você foi convidado!"

        body_text = (
            f"Olá {name},\n\n"
            f"Você foi convidado por {invited_by} para acessar o sistema Lindsay.\n\n"
            f"Clique no link abaixo para ativar sua conta e definir sua senha:\n"
            f"{activation_url}\n\n"
            f"Este link expira em {settings.INVITATION_TOKEN_EXPIRY_HOURS} horas.\n\n"
            f"Atenciosamente,\nEquipe Lindsay"
        )

        body_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #272727; color: #e5e7eb; padding: 40px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4ade80; margin: 0;">Lindsay</h1>
                <p style="color: #9ca3af; margin-top: 5px;">Sistema de Monitoramento</p>
            </div>

            <div style="background-color: #313131; padding: 30px; border-radius: 8px; text-align: center;">
                <h2 style="color: #e5e7eb; margin-top: 0;">Ative sua Conta</h2>
                <p style="color: #9ca3af;">
                    Olá <strong style="color: #e5e7eb;">{name}</strong>,
                </p>
                <p style="color: #9ca3af;">
                    Você foi convidado por <strong style="color: #4ade80;">{invited_by}</strong>
                    para acessar o sistema Lindsay.
                </p>

                <a href="{activation_url}"
                   style="display: inline-block; background-color: #4ade80; color: #1a1a1a; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 20px 0;">
                    Ativar Conta
                </a>

                <p style="color: #6b7280; font-size: 14px;">
                    Este link expira em <strong>{settings.INVITATION_TOKEN_EXPIRY_HOURS} horas</strong>.
                </p>
            </div>

            <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #374151;">
                <p style="color: #6b7280; font-size: 12px;">
                    Se você não esperava este convite, ignore este email.
                </p>
            </div>
        </div>
        """

        result = notification_service.send_email(
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            to_emails=[email],
        )

        success = result.get("success", 0) > 0
        if success:
            logger.info(f"Email de convite enviado para {email} (por {invited_by})")
        else:
            logger.error(f"Falha ao enviar email de convite para {email}: {result}")

        return success
