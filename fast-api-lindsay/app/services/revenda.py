#!/usr/bin/env python3
"""
Serviço para gerenciar revendas no sistema Lindsay

Funcionalidades:
- Registrar nova revenda (CouchDB + Cognito)
- Validar dados de revenda
- Sincronizar com Cognito
- Verificar unicidade de domínio
"""

import boto3
from datetime import datetime
from typing import Dict, Optional, Tuple
import couchdb
import uuid
from app.core.aws import get_cognito_client
from app.utils.validators import (
    validate_cnpj,
    validate_cpf,
    validate_cnpj_or_cpf,
    validate_domain,
    validate_email,
    validate_name,
    format_cnpj,
)


class RevendaService:
    """Serviço para gerenciar revendas"""

    def __init__(
        self,
        couchdb_url: str,
        database: str,
        cognito_region: str = "us-east-1",
        cognito_pool_id: str = None,
    ):
        """
        Inicializar RevendaService

        Args:
            couchdb_url: URL do CouchDB
            database: Nome do banco de dados
            cognito_region: Região AWS do Cognito
            cognito_pool_id: ID do User Pool (obrigatório para atualizar custom attributes)
        """
        # CouchDB
        try:
            print(
                f"📝 DEBUG RevendaService: Conectando ao CouchDB URL={couchdb_url}, database={database}"
            )
            self.server = couchdb.Server(couchdb_url)
            self.db = self.server[database]
            print(
                f"✅ DEBUG RevendaService: Conectado com sucesso ao banco '{database}'"
            )
        except Exception as e:
            print(f"❌ DEBUG RevendaService: Erro ao conectar: {str(e)}")
            import traceback

            traceback.print_exc()
            raise Exception(f"Falha ao conectar ao CouchDB: {e}")

        # Cognito (opcional)
        self.cognito_client = None
        self.cognito_pool_id = cognito_pool_id

        if cognito_pool_id:
            try:
                self.cognito_client = get_cognito_client()
            except Exception as e:
                print(f"⚠️ Aviso: Cognito não disponível: {e}")

    def check_revenda_exists(self, name: str, email: str) -> Tuple[bool, Optional[str]]:
        """
        Verificar se uma revenda com este nome/email já existe (pode ter múltiplos cadastros)

        Args:
            name: Nome da revenda
            email: Email da revenda

        Returns:
            Tuple[bool, Optional[str]]: (existe, mensagem_info)
        """
        print(
            f"🔍 DEBUG: Verificando se revenda '{name}' com email '{email}' existe..."
        )

        try:
            # Procurar por nome OU email
            results = list(
                self.db.find(
                    {
                        "selector": {
                            "type": "revenda",
                            "$or": [{"name": name}, {"email": email}],
                        },
                        "limit": 10,
                    }
                )
            )

            if results:
                print(f"⚠️ DEBUG: Encontrados {len(results)} cadastro(s) da revenda")
                for doc in results:
                    status = doc.get("status", "unknown")
                    print(f"   - {doc.get('_id')} (status: {status})")
                return True, f"Revenda encontrada com {len(results)} cadastro(s)"

            print(f"✅ DEBUG: Revenda nova (não existe)")
            return False, None

        except Exception as e:
            print(f"⚠️ Aviso ao verificar revenda: {str(e)}")
            return False, None  # Continua mesmo com erro

    def create_revenda_couchdb(
        self,
        email: str,
        name: str,
        cnpj_revenda: str,
        cognito_sub: Optional[str] = None,
        initial_status: str = "pending",
        cnpj_admin: Optional[str] = None,  # CNPJ do admin que cria (para hierarquia)
        phone_number: Optional[str] = None,
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Criar documento de revenda no CouchDB (permite múltiplos cadastros)

        Args:
            email: Email da revenda
            name: Nome da revenda
            cnpj_revenda: CNPJ da revenda (formatado)
            cognito_sub: Sub do Cognito (opcional)
            initial_status: Status inicial (padrão: 'pending', admin pode usar 'active')
            cnpj_admin: CNPJ do admin que cria a revenda (para hierarquia)

        Returns:
            Tuple[bool, str, Optional[str]]: (sucesso, mensagem, doc_id)
        """
        # ID usa UUID para permitir múltiplos cadastros
        doc_id = f"revenda:{str(uuid.uuid4())}"
        print(f"📝 DEBUG: Criando revenda com ID={doc_id}")

        try:
            # Apenas informar se já existe (não bloqueia)
            exists, info_msg = self.check_revenda_exists(name, email)
            if exists:
                print(f"ℹ️ INFO: {info_msg}")

            revenda_doc = {
                "_id": doc_id,  # formato: revenda:{uuid}
                "type": "revenda",
                "email": email,
                "name": name,
                "phone_number": phone_number,
                "domain": name,  # domain = name (padrão do DB)
                "cnpj_revenda": cnpj_revenda,  # Armazenado mas não é chave
                "cnpj_admin": cnpj_admin,  # CNPJ do admin para hierarquia
                "status": initial_status,  # "pending" para self-registration, "active" para admin
                "created_at": datetime.utcnow().isoformat(),
                "clientes": [],  # Lista de clientes aprovados
                "cognito_synced": False,
                "cognito_sub": cognito_sub,  # Referência ao sub do Cognito
            }

            self.db.save(revenda_doc)
            print(f"✅ DEBUG: Revenda salva com sucesso")

            return True, f"Revenda '{name}' registrada com sucesso", doc_id

        except Exception as e:
            print(f"❌ DEBUG: Erro ao criar revenda: {str(e)}")
            return False, f"Erro ao criar revenda: {str(e)}", None

    def update_cognito_attributes(
        self, username: str, custom_attributes: Dict[str, str]
    ) -> Tuple[bool, str]:
        """
        Atualizar custom attributes da revenda no Cognito

        Args:
            username: Email do usuário no Cognito
            custom_attributes: Dicionário com custom attributes

        Returns:
            Tuple[bool, str]: (sucesso, mensagem)
        """
        if not self.cognito_client or not self.cognito_pool_id:
            return True, "Cognito não configurado (será preenchido manualmente)"

        try:
            user_attributes = [
                {"Name": key, "Value": value}
                for key, value in custom_attributes.items()
            ]

            self.cognito_client.admin_update_user_attributes(
                UserPoolId=self.cognito_pool_id,
                Username=username,
                UserAttributes=user_attributes,
            )

            return True, "Custom attributes atualizados no Cognito"

        except Exception as e:
            return False, f"Erro ao atualizar Cognito: {str(e)}"

    def register_revenda_complete(
        self,
        email: str,
        name: str,
        cnpj: str,
        cognito_sub: Optional[str] = None,
        cnpj_admin: Optional[str] = None,
        phone_number: Optional[str] = None,
    ) -> Tuple[bool, str, Optional[Dict]]:
        """
        Registrar revenda completo (CouchDB + Cognito)

        Args:
            email: Email da revenda
            name: Nome da revenda
            cnpj: CNPJ/CPF da revenda (formatado ou não)
            cognito_sub: Sub do Cognito
            cnpj_admin: CNPJ do admin (para hierarquia)

        Returns:
            Tuple[bool, str, Optional[Dict]]: (sucesso, mensagem, revenda_data)
        """
        # Validar dados
        is_valid_email, email_error = validate_email(email)
        if not is_valid_email:
            return False, email_error, None

        is_valid_name, name_error = validate_name(name)
        if not is_valid_name:
            return False, name_error, None

        # Validar e formatar CNPJ/CPF
        is_valid_doc, doc_error = validate_cnpj_or_cpf(cnpj)
        if not is_valid_doc:
            return False, doc_error, None

        # Formatar CNPJ/CPF
        cnpj_formatted = format_cnpj(cnpj)

        # Criar no CouchDB
        success, msg, doc_id = self.create_revenda_couchdb(
            email=email,
            name=name,
            cnpj_revenda=cnpj_formatted,
            cognito_sub=cognito_sub,
            cnpj_admin=cnpj_admin,
            phone_number=phone_number,
        )

        if not success:
            return False, msg, None

        # Preparar custom attributes (apenas o mínimo necessário)
        custom_attributes = {
            "custom:type": "revenda",
            "custom:status": "pending",
        }

        # Atualizar Cognito
        cognito_success, cognito_msg = self.update_cognito_attributes(
            username=email, custom_attributes=custom_attributes
        )

        if not cognito_success:
            print(f"⚠️ Aviso ao sincronizar com Cognito: {cognito_msg}")

        # Preparar dados de resposta
        revenda_data = {
            "revenda_id": doc_id,
            "email": email,
            "name": name,
            "cnpj": cnpj_formatted,
            "status": "pending",
            "message": f"Revenda registrada com sucesso! Aguarde aprovação do administrador.",
        }

        return True, "Revenda registrada com sucesso", revenda_data

    def get_revenda_by_uuid(self, revenda_uuid: str) -> Optional[Dict]:
        """
        Obter revenda específica por UUID

        Args:
            revenda_uuid: UUID da revenda

        Returns:
            Optional[Dict]: Dados da revenda ou None
        """
        doc_id = f"revenda:{revenda_uuid}"

        try:
            return dict(self.db.get(doc_id))
        except couchdb.http.ResourceNotFound:
            return None
        except Exception as e:
            print(f"Erro ao obter revenda: {e}")
            return None

    def get_revenda_by_name(self, name: str) -> list:
        """
        Obter TODOS os cadastros de revenda pelo nome

        Args:
            name: Nome da revenda

        Returns:
            list: Lista de cadastros (pode ter vários)
        """
        try:
            results = list(
                self.db.find({"selector": {"type": "revenda", "name": name}})
            )
            return [dict(doc) for doc in results]
        except Exception as e:
            print(f"Erro ao obter revenda por nome: {e}")
            return []

    def get_revenda_by_domain(self, domain: str) -> list:
        """Alias para get_revenda_by_name (compatibilidade)"""
        return self.get_revenda_by_name(domain)

    def get_revenda_by_email(self, email: str) -> list:
        """
        Obter TODOS os cadastros de revenda pelo email

        Args:
            email: Email da revenda

        Returns:
            list: Lista de cadastros (pode ter vários)
        """
        try:
            results = list(
                self.db.find({"selector": {"type": "revenda", "email": email}})
            )
            return [dict(doc) for doc in results]
        except Exception as e:
            print(f"Erro ao obter revenda por email: {e}")
            return []
