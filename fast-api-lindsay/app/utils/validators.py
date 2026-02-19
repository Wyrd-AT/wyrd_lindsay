#!/usr/bin/env python3
"""
Validadores para dados de entrada do sistema Lindsay
- CNPJ
- Email
- Domínio
- Senha
- Telefone
"""

import re
from typing import Tuple


class ValidationError(Exception):
    """Exceção para erros de validação"""
    pass


def validate_cpf(cpf: str) -> Tuple[bool, str]:
    """
    Valida CPF brasileiro conforme algoritmo oficial

    Args:
        cpf: CPF no formato "XXX.XXX.XXX-XX" ou apenas dígitos

    Returns:
        Tuple[bool, str]: (válido, mensagem_erro)

    Examples:
        >>> validate_cpf("123.456.789-99")
        (True, "")
        >>> validate_cpf("000.000.000-00")
        (False, "CPF inválido: todos os dígitos iguais")
    """
    # Remove caracteres especiais
    cpf_clean = ''.join(filter(str.isdigit, cpf))

    # Verifica comprimento
    if len(cpf_clean) != 11:
        return False, "CPF deve conter 11 dígitos"

    # Verifica se todos os dígitos são iguais (inválido por lei)
    if cpf_clean == cpf_clean[0] * 11:
        return False, "CPF inválido: todos os dígitos iguais"

    # Cálculo do primeiro dígito verificador
    mult = [10, 9, 8, 7, 6, 5, 4, 3, 2]
    result = sum(int(cpf_clean[i]) * mult[i] for i in range(9))
    digit1 = 11 - (result % 11)
    digit1 = 0 if digit1 >= 10 else digit1

    if int(cpf_clean[9]) != digit1:
        return False, "CPF inválido: primeiro dígito verificador incorreto"

    # Cálculo do segundo dígito verificador
    mult = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
    result = sum(int(cpf_clean[i]) * mult[i] for i in range(10))
    digit2 = 11 - (result % 11)
    digit2 = 0 if digit2 >= 10 else digit2

    if int(cpf_clean[10]) != digit2:
        return False, "CPF inválido: segundo dígito verificador incorreto"

    return True, ""


def validate_cnpj(cnpj: str) -> Tuple[bool, str]:
    """
    Valida CNPJ brasileiro conforme algoritmo oficial

    Args:
        cnpj: CNPJ no formato "XX.XXX.XXX/0001-XX" ou apenas dígitos

    Returns:
        Tuple[bool, str]: (válido, mensagem_erro)

    Examples:
        >>> validate_cnpj("12.345.678/0001-99")
        (True, "")
        >>> validate_cnpj("00.000.000/0000-00")
        (False, "CNPJ inválido: todos os dígitos iguais")
    """
    # Remove caracteres especiais
    cnpj_clean = ''.join(filter(str.isdigit, cnpj))

    # Verifica comprimento
    if len(cnpj_clean) != 14:
        return False, "CNPJ deve conter 14 dígitos"

    # Verifica se todos os dígitos são iguais (inválido por lei)
    if cnpj_clean == cnpj_clean[0] * 14:
        return False, "CNPJ inválido: todos os dígitos iguais"

    # Cálculo do primeiro dígito verificador
    mult = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    result = sum(int(cnpj_clean[i]) * mult[i] for i in range(12))
    digit1 = 11 - (result % 11)
    digit1 = 0 if digit1 >= 10 else digit1

    if int(cnpj_clean[12]) != digit1:
        return False, "CNPJ inválido: primeiro dígito verificador incorreto"

    # Cálculo do segundo dígito verificador
    mult = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    result = sum(int(cnpj_clean[i]) * mult[i] for i in range(13))
    digit2 = 11 - (result % 11)
    digit2 = 0 if digit2 >= 10 else digit2

    if int(cnpj_clean[13]) != digit2:
        return False, "CNPJ inválido: segundo dígito verificador incorreto"

    return True, ""


def format_cnpj(cnpj: str) -> str:
    """
    Formata CNPJ para padrão brasileiro: XX.XXX.XXX/0001-XX

    Args:
        cnpj: CNPJ em qualquer formato

    Returns:
        str: CNPJ formatado

    Example:
        >>> format_cnpj("12345678000199")
        "12.345.678/0001-99"
    """
    cnpj_clean = ''.join(filter(str.isdigit, cnpj))

    if len(cnpj_clean) != 14:
        return cnpj  # Retorna original se inválido

    return f"{cnpj_clean[:2]}.{cnpj_clean[2:5]}.{cnpj_clean[5:8]}/{cnpj_clean[8:12]}-{cnpj_clean[12:14]}"


def validate_email(email: str) -> Tuple[bool, str]:
    """
    Valida endereço de email

    Args:
        email: Endereço de email

    Returns:
        Tuple[bool, str]: (válido, mensagem_erro)
    """
    # Padrão RFC 5322 simplificado
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

    if not email or len(email) > 254:
        return False, "Email deve ter entre 1 e 254 caracteres"

    if not re.match(pattern, email):
        return False, "Email inválido"

    return True, ""


def validate_cnpj_or_cpf(value: str) -> Tuple[bool, str]:
    """
    Valida CNPJ ou CPF brasileiro

    Args:
        value: CNPJ ou CPF em qualquer formato

    Returns:
        Tuple[bool, str]: (válido, mensagem_erro)

    Examples:
        >>> validate_cnpj_or_cpf("12.345.678/0001-99")
        (True, "")
        >>> validate_cnpj_or_cpf("123.456.789-99")
        (True, "")
    """
    # Remove caracteres especiais para contar dígitos
    digits_only = ''.join(filter(str.isdigit, value))

    if len(digits_only) == 14:
        # Validar como CNPJ
        return validate_cnpj(value)
    elif len(digits_only) == 11:
        # Validar como CPF
        return validate_cpf(value)
    else:
        return False, "Documento deve conter 14 dígitos (CNPJ) ou 11 dígitos (CPF)"


def validate_domain(domain: str) -> Tuple[bool, str]:
    """
    Valida domínio de internet

    Args:
        domain: Domínio (ex: exemplo.com.br)

    Returns:
        Tuple[bool, str]: (válido, mensagem_erro)

    Examples:
        >>> validate_domain("wyrd.com.br")
        (True, "")
        >>> validate_domain("invalid..com")
        (False, "Domínio inválido")
    """
    # Padrão para validar domínios
    pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'

    if not domain or len(domain) > 255:
        return False, "Domínio deve ter entre 1 e 255 caracteres"

    # Deve ter pelo menos um ponto
    if '.' not in domain:
        return False, "Domínio deve conter pelo menos um ponto"

    if not re.match(pattern, domain):
        return False, "Domínio inválido"

    return True, ""


def validate_password(password: str) -> Tuple[bool, str]:
    """
    Valida força de senha

    Requisitos:
    - Mínimo 8 caracteres
    - Pelo menos 1 maiúscula
    - Pelo menos 1 minúscula
    - Pelo menos 1 número
    - Pelo menos 1 caractere especial (!@#$%^&*...)

    Args:
        password: Senha

    Returns:
        Tuple[bool, str]: (válido, mensagem_erro)
    """
    if not password:
        return False, "Senha não pode estar vazia"

    if len(password) < 8:
        return False, "Senha deve ter no mínimo 8 caracteres"

    if len(password) > 128:
        return False, "Senha muito longa (máximo 128 caracteres)"

    if not any(c.isupper() for c in password):
        return False, "Senha deve conter pelo menos 1 letra maiúscula"

    if not any(c.islower() for c in password):
        return False, "Senha deve conter pelo menos 1 letra minúscula"

    if not any(c.isdigit() for c in password):
        return False, "Senha deve conter pelo menos 1 número"

    special_chars = '!@#$%^&*(),.?":{}|<>[]\\-_+=`~'
    if not any(c in special_chars for c in password):
        return False, "Senha deve conter pelo menos 1 caractere especial (!@#$%^&*...)"

    return True, ""


def validate_phone(phone: str) -> Tuple[bool, str]:
    """
    Valida telefone brasileiro

    Formato aceito: +55 XX XXXXX-XXXX ou XX XXXXX-XXXX ou (XX) XXXXX-XXXX

    Args:
        phone: Número de telefone

    Returns:
        Tuple[bool, str]: (válido, mensagem_erro)
    """
    if not phone:
        return False, "Telefone não pode estar vazio"

    # Remove caracteres especiais
    phone_clean = ''.join(filter(str.isdigit, phone))

    # Deve ter 11 dígitos (com DDD) ou 10 (sem 9)
    if len(phone_clean) < 10 or len(phone_clean) > 13:
        return False, "Telefone inválido"

    # Se tem 13, verifica se começa com 55 (código do Brasil)
    if len(phone_clean) == 13 and not phone_clean.startswith('55'):
        return False, "Código de país inválido"

    return True, ""


def validate_name(name: str) -> Tuple[bool, str]:
    """
    Valida nome de usuário/revenda

    Args:
        name: Nome

    Returns:
        Tuple[bool, str]: (válido, mensagem_erro)
    """
    if not name or not name.strip():
        return False, "Nome não pode estar vazio"

    if len(name) < 2:
        return False, "Nome deve ter no mínimo 2 caracteres"

    if len(name) > 255:
        return False, "Nome muito longo (máximo 255 caracteres)"

    # Permite letras, números, espaços, hífens, apóstrofos
    pattern = r"^[a-zA-Z0-9\s\-'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ]+$"

    if not re.match(pattern, name):
        return False, "Nome contém caracteres inválidos"

    return True, ""


# Alias para compatibilidade
def is_valid_cpf(cpf: str) -> bool:
    """Compatibilidade: retorna apenas bool"""
    valid, _ = validate_cpf(cpf)
    return valid


def is_valid_cnpj(cnpj: str) -> bool:
    """Compatibilidade: retorna apenas bool"""
    valid, _ = validate_cnpj(cnpj)
    return valid


def is_valid_cnpj_or_cpf(value: str) -> bool:
    """Compatibilidade: retorna apenas bool"""
    valid, _ = validate_cnpj_or_cpf(value)
    return valid


def is_valid_email(email: str) -> bool:
    """Compatibilidade: retorna apenas bool"""
    valid, _ = validate_email(email)
    return valid


def is_valid_domain(domain: str) -> bool:
    """Compatibilidade: retorna apenas bool"""
    valid, _ = validate_domain(domain)
    return valid


def is_valid_password(password: str) -> bool:
    """Compatibilidade: retorna apenas bool"""
    valid, _ = validate_password(password)
    return valid
