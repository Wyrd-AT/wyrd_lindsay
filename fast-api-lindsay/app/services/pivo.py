#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço de Gerenciamento de Pivôs (FASE 2)

Implementa CRUD de pivôs com verificações de permissão baseadas em role:
- Admin: Vê TODOS os pivôs
- Gerente (Revenda): Vê pivôs dos seus clientes
- Cliente: Vê e cria seus próprios pivôs

Uso:
    from pivo_service import PivoService
    from permissions import PermissionChecker

    service = PivoService(db)
    user = {"type": "cliente", "email": "user@example.com"}
    checker = PermissionChecker(user)

    pivos = service.list_pivos(user, checker)
"""

import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Dict, List, Optional
from dataclasses import dataclass
from pydantic import BaseModel, ValidationError
from app.services.permissions import PermissionChecker, Role

BR_TZ = ZoneInfo("America/Sao_Paulo")

# =============================================================================
# Models
# =============================================================================


class PivoModel(BaseModel):
    """Modelo de Pivô"""

    codigo: str
    nome: str
    owner_id: str  # Email do cliente que é dono
    cnpj_cliente: Optional[str] = None
    nome_cliente: Optional[str] = (
        None  # Nome do cliente (guardado no doc para exibição)
    )
    cnpj_revenda: Optional[str] = None
    nome_revenda: Optional[str] = (
        None  # Nome da revenda (guardado no doc para exibição)
    )
    cnpj_admin: Optional[str] = None
    nome_admin: Optional[str] = None  # Nome do admin (guardado no doc para exibição)
    revenda_id: Optional[str] = None  # doc_id da revenda (ex: "revenda:uuid")
    gerente_id: str = ""  # Email do gerente (revenda) do owner
    equipamentos: List[str] = []  # ["Painel 1", "Torre 1", ...]
    ativo: bool = True
    location: Optional[Dict] = None  # {"lat": -15.79, "lng": -48.10}

    whatsapp: Optional[str] = None
    sms: Optional[str] = None
    email: Optional[str] = None


class PivoDocument(PivoModel):
    """Documento completo do pivô no CouchDB"""

    _id: str
    _rev: Optional[str] = None
    type: str = "pivo"
    created_at: str
    updated_at: str


# =============================================================================
# PivoService
# =============================================================================


class PivoService:
    """Serviço de gerenciamento de pivôs com controle de acesso"""

    def __init__(self, db):
        """
        Inicializar serviço

        Args:
            db: Conexão com CouchDB
        """
        self.db = db

    # =====================================================================
    # CREATE
    # =====================================================================

    def create_pivo(
        self, user: Dict, pivo_data: Dict, checker: PermissionChecker
    ) -> Optional[Dict]:
        """
        Criar novo pivô. Apenas admin; hierarquia vem de pivo_data (resolvida na rota a partir do cliente).

        Args:
            user: Usuário autenticado
            pivo_data: Dados do pivô (codigo, nome, location, etc)
            checker: PermissionChecker para validação

        Returns:
            Pivô criado ou None se erro/sem permissão
        """
        if not checker.can_create_pivo():
            raise PermissionError("Apenas administradores podem criar pivôs")

        # Validar dados
        try:
            pivo_model = PivoModel(**pivo_data)
        except ValidationError as e:
            raise ValueError(f"Dados inválidos: {e}")

        # Gerar ID no formato: irrigador:{uuid}
        pivo_id = f"irrigador:{uuid.uuid4().hex}"

        # Criar documento (formato compatível com dados existentes)
        doc = {
            "_id": pivo_id,
            "origin": "app",
            "table": "irrigadores",
            "codigo": pivo_model.codigo,
            "irrigador": pivo_model.nome,
            "equipamentos": pivo_model.equipamentos,
            "contacts": {
                "whatsapp": pivo_data.get("contacts", {}).get("whatsapp"),
                "sms": pivo_data.get("contacts", {}).get("sms"),
                "email": pivo_data.get("contacts", {}).get("email"),
            },
            "cnpj_cliente": pivo_model.cnpj_cliente,
            "nome_cliente": pivo_model.nome_cliente,
            "cnpj_revenda": pivo_model.cnpj_revenda,
            "nome_revenda": pivo_model.nome_revenda,
            "cnpj_admin": pivo_model.cnpj_admin,
            "nome_admin": pivo_model.nome_admin,
        }

        # Salvar
        try:
            self.db.save(doc)
            print(f"✅ Pivô criado: {pivo_id}")
            return doc
        except Exception as e:
            raise Exception(f"Erro ao salvar pivô: {e}")

    # =====================================================================
    # READ / LIST
    # =====================================================================

    def list_pivos(self, user: Dict, checker: PermissionChecker) -> List[Dict]:
        """
        Listar pivôs/irrigadores com base nas permissões do usuário

        Regras:
        - Admin: Vê TODOS os pivôs/irrigadores
        - Gerente: Vê pivôs dos seus clientes (gerente_id == email ou companyId)
        - Cliente: Vê apenas seus próprios pivôs (owner_id == email ou companyId)

        Args:
            user: Usuário autenticado
            checker: PermissionChecker para validação

        Returns:
            Lista de pivôs normalizados que o usuário pode ver
        """
        user_cnpj = user.get("cnpj", "")

        try:
            if checker.is_admin():
                # Admin: irrigadores filtrados por cnpj_admin
                if user_cnpj:
                    pivos = self._find_pivos(
                        {"table": "irrigadores", "cnpj_admin": user_cnpj}
                    )
                else:
                    # Admin root sem CNPJ: vê todos
                    pivos = self._find_pivos({"table": "irrigadores"})
                return [self._normalize_pivo(p) for p in pivos]

            elif checker.is_revenda():
                # Revenda: irrigadores filtrados por cnpj_revenda
                pivos = []
                if user_cnpj:
                    pivos = self._find_pivos(
                        {"table": "irrigadores", "cnpj_revenda": user_cnpj}
                    )
                return [self._normalize_pivo(p) for p in pivos]

            elif checker.is_cliente():
                # Cliente: irrigadores filtrados por cnpj_cliente
                pivos = []
                if user_cnpj:
                    pivos = self._find_pivos(
                        {"table": "irrigadores", "cnpj_cliente": user_cnpj}
                    )
                return [self._normalize_pivo(p) for p in pivos]

            return []

        except Exception as e:
            print(f"❌ Erro ao listar pivôs: {e}")
            return []

    def get_pivo(
        self, user: Dict, pivo_id: str, checker: PermissionChecker
    ) -> Optional[Dict]:
        """
        Buscar pivô específico com verificação de permissão

        Args:
            user: Usuário autenticado
            pivo_id: ID do pivô
            checker: PermissionChecker para validação

        Returns:
            Pivô se acesso permitido, None caso contrário
        """
        try:
            pivo = self.db[pivo_id]
        except Exception:
            return None

        # Verificar se usuário pode ver este pivô
        if not self._can_view_pivo(user, pivo, checker):
            raise PermissionError(f"Acesso negado ao pivô {pivo_id}")

        return pivo

    # =====================================================================
    # UPDATE
    # =====================================================================

    def update_pivo(
        self, user: Dict, pivo_id: str, pivo_data: Dict, checker: PermissionChecker
    ) -> Optional[Dict]:
        """
        Atualizar pivô

        Permissões:
        - Cliente: Pode atualizar seus próprios pivôs
        - Admin: Pode atualizar qualquer pivô

        Args:
            user: Usuário autenticado
            pivo_id: ID do pivô
            pivo_data: Dados a atualizar
            checker: PermissionChecker para validação

        Returns:
            Pivô atualizado ou None
        """
        # Buscar pivô existente
        pivo = self.get_pivo(user, pivo_id, checker)
        if not pivo:
            raise ValueError(f"Pivô não encontrado: {pivo_id}")

        # Verificar permissão de edição
        can_edit = checker.is_admin() or (
            checker.is_cliente() and pivo.get("owner_id") == user.get("email")
        )

        if not can_edit:
            raise PermissionError("Sem permissão para editar este pivô")

        # Atualizar campos permitidos
        allowed_fields = {"nome", "ativo", "location"}
        for field, value in pivo_data.items():
            if field in allowed_fields:
                pivo[field] = value

        pivo["updated_at"] = datetime.now(tz=BR_TZ).isoformat()
        pivo["updated_by"] = user.get("email")

        try:
            self.db.save(pivo)
            print(f"✅ Pivô atualizado: {pivo_id}")
            return pivo
        except Exception as e:
            raise Exception(f"Erro ao atualizar pivô: {e}")

    # =====================================================================
    # DELETE
    # =====================================================================

    def delete_pivo(self, user: Dict, pivo_id: str, checker: PermissionChecker) -> bool:
        """
        Deletar pivô

        Permissões:
        - Admin: Pode deletar qualquer pivô

        Args:
            user: Usuário autenticado
            pivo_id: ID do pivô
            checker: PermissionChecker para validação

        Returns:
            True se deletado, False caso contrário
        """
        # Apenas admin pode deletar
        if not checker.is_admin():
            raise PermissionError("Apenas admin pode deletar pivôs")

        try:
            pivo = self.db[pivo_id]
            self.db.delete(pivo)
            print(f"✅ Pivô deletado: {pivo_id}")
            return True
        except Exception as e:
            print(f"❌ Erro ao deletar pivô: {e}")
            return False

    # =====================================================================
    # Helpers
    # =====================================================================

    def _find_pivos(self, selector: Dict) -> List[Dict]:
        """
        Buscar pivôs/irrigadores no CouchDB usando query Mango

        Args:
            selector: Seletor Mango (ex: {"table": "irrigadores"} ou {"type": "pivo"})

        Returns:
            Lista de documentos de pivôs/irrigadores
        """
        try:
            # Tentar query Mango
            result = self.db.find({"selector": selector})
            pivos = list(result)

            # Se não encontrou nada, tentar método alternativo
            if not pivos:
                print(
                    f"⚠️  Query Mango não retornou resultados, tentando método alternativo..."
                )
                # Buscar por _all_docs como fallback
                try:
                    all_docs = self.db.view("_all_docs", include_docs=True, limit=1000)
                    pivos = [
                        row.doc
                        for row in all_docs
                        if row.doc
                        and all(row.doc.get(k) == v for k, v in selector.items())
                    ]
                    if pivos:
                        print(
                            f"✅ Encontrados {len(pivos)} pivô(s) usando método alternativo"
                        )
                except Exception as e2:
                    print(f"⚠️  Método alternativo também falhou: {e2}")

            return pivos

        except Exception as e:
            print(f"❌ Erro ao buscar pivôs: {e}")
            print(f"   Selector usado: {selector}")

            # Tentar criar índice se o erro for relacionado a índice
            if "index" in str(e).lower() or "no_usable_index" in str(e).lower():
                print(f"⚠️  Parece que falta um índice. Tentando criar...")
                try:
                    # Criar índice para os campos usados
                    if "table" in selector:
                        self.db.create_index(["table"])
                    if "type" in selector:
                        self.db.create_index(["type"])
                    print(f"✅ Índice criado. Tente novamente.")
                except Exception as e3:
                    print(f"❌ Erro ao criar índice: {e3}")

            return []

    def _normalize_pivo(self, pivo: Dict) -> Dict:
        """
        Normalizar documento de pivô/irrigador para formato padrão

        Args:
            pivo: Documento do CouchDB

        Returns:
            Documento normalizado
        """
        # Documentos antigos do CouchDB podem não ter created_at/updated_at
        created_at = pivo.get("created_at") or ""
        updated_at = pivo.get("updated_at")

        normalized = {
            "_id": pivo.get("_id", ""),
            "codigo": pivo.get("codigo", ""),
            "nome": pivo.get("nome")
            or pivo.get("name")
            or pivo.get("irrigador")
            or pivo.get("codigo", "Sem nome"),
            "owner_id": pivo.get("owner_id") or pivo.get("companyId") or "",
            "gerente_id": pivo.get("gerente_id") or "",
            "ativo": pivo.get("ativo", True),
            "created_at": created_at,
            "updated_at": updated_at,
            "location": pivo.get("location"),
            "table": pivo.get("table", "irrigadores"),
            "type": pivo.get("type", "pivo"),
            "nome_cliente": pivo.get("nome_cliente"),
            "nome_revenda": pivo.get("nome_revenda"),
            "nome_admin": pivo.get("nome_admin"),
        }

        # Preservar outros campos úteis
        if "equipamentos" in pivo:
            normalized["equipamentos"] = pivo["equipamentos"]
        if "contacts" in pivo:
            normalized["contacts"] = pivo["contacts"]

        return normalized

    def _can_view_pivo(
        self, user: Dict, pivo: Dict, checker: PermissionChecker
    ) -> bool:
        """
        Verificar se usuário pode visualizar um pivô

        Args:
            user: Usuário autenticado
            pivo: Documento do pivô
            checker: PermissionChecker

        Returns:
            True se pode visualizar, False caso contrário
        """
        user_cnpj = user.get("cnpj", "")

        if checker.is_admin():
            # Admin vê irrigadores do seu cnpj_admin (ou todos se root)
            if not user_cnpj:
                return True
            return pivo.get("cnpj_admin") == user_cnpj

        if checker.is_revenda():
            return pivo.get("cnpj_revenda") == user_cnpj

        if checker.is_cliente():
            return pivo.get("cnpj_cliente") == user_cnpj

        return False

    # =====================================================================
    # Statistics
    # =====================================================================

    def get_pivos_stats(self, user: Dict, checker: PermissionChecker) -> Dict:
        """
        Obter estatísticas de pivôs para dashboard

        Returns:
            {
                "total": int,
                "ativos": int,
                "inativos": int,
                "por_cliente": int  # Para gerente
            }
        """
        pivos = self.list_pivos(user, checker)

        stats = {
            "total": len(pivos),
            "ativos": sum(1 for p in pivos if p.get("ativo")),
            "inativos": sum(1 for p in pivos if not p.get("ativo")),
        }

        # Estatísticas específicas por role
        if checker.is_revenda():
            # Contar clientes únicos
            clientes = set(p.get("owner_id") for p in pivos)
            stats["total_clientes"] = len(clientes)

        return stats
