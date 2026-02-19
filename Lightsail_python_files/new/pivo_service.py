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
from permissions import PermissionChecker, Role

BR_TZ = ZoneInfo("America/Sao_Paulo")

# =============================================================================
# Models
# =============================================================================

class PivoModel(BaseModel):
    """Modelo de Pivô"""
    codigo: str
    nome: str
    owner_id: str  # Email do cliente que é dono
    gerente_id: str  # Email do gerente (revenda) do owner
    ativo: bool = True
    location: Optional[Dict] = None  # {"lat": -15.79, "lng": -48.10}

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
        self,
        user: Dict,
        pivo_data: Dict,
        checker: PermissionChecker
    ) -> Optional[Dict]:
        """
        Criar novo pivô

        Permissões:
        - Cliente: Pode criar seus próprios pivôs
        - Gerente: PODE ajudar cliente a criar (futura feature)
        - Admin: Pode criar para qualquer cliente

        Args:
            user: Usuário autenticado
            pivo_data: Dados do pivô (codigo, nome, location, etc)
            checker: PermissionChecker para validação

        Returns:
            Pivô criado ou None se erro/sem permissão
        """
        # Verificar permissão
        if not (checker.can_create_pivo() or checker.is_admin()):
            raise PermissionError("Usuário não tem permissão para criar pivôs")

        # Validar dados
        try:
            pivo_model = PivoModel(**pivo_data)
        except ValidationError as e:
            raise ValueError(f"Dados inválidos: {e}")

        # Verificar se cliente tenta criar pivô de outro
        if checker.is_cliente() and pivo_model.owner_id != user.get("email"):
            raise PermissionError("Cliente não pode criar pivô de outro cliente")

        # Gerar IDs
        pivo_id = f"pivo:{pivo_model.owner_id}:{pivo_model.codigo}:{uuid.uuid4().hex[:8]}"
        now = datetime.now(tz=BR_TZ).isoformat()

        # Criar documento
        doc = {
            "_id": pivo_id,
            "type": "pivo",
            "codigo": pivo_model.codigo,
            "nome": pivo_model.nome,
            "owner_id": pivo_model.owner_id,  # Cliente que cria
            "gerente_id": pivo_model.gerente_id,  # Gerente do cliente
            "ativo": pivo_model.ativo,
            "location": pivo_model.location,
            "created_at": now,
            "updated_at": now,
            "created_by": user.get("email"),
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

    def list_pivos(
        self,
        user: Dict,
        checker: PermissionChecker
    ) -> List[Dict]:
        """
        Listar pivôs com base nas permissões do usuário

        Regras:
        - Admin: Vê TODOS os pivôs
        - Gerente: Vê pivôs dos seus clientes (gerente_id == email)
        - Cliente: Vê apenas seus próprios pivôs (owner_id == email)

        Args:
            user: Usuário autenticado
            checker: PermissionChecker para validação

        Returns:
            Lista de pivôs que o usuário pode ver
        """
        user_email = user.get("email")

        try:
            if checker.is_admin():
                # Admin: todos os pivôs
                return self._find_pivos({"type": "pivo"})

            elif checker.is_revenda():
                # Gerente: pivôs dos seus clientes
                # onde gerente_id == email do gerente
                return self._find_pivos({
                    "type": "pivo",
                    "gerente_id": user_email
                })

            elif checker.is_cliente():
                # Cliente: apenas seus pivôs
                return self._find_pivos({
                    "type": "pivo",
                    "owner_id": user_email
                })

            return []

        except Exception as e:
            print(f"❌ Erro ao listar pivôs: {e}")
            return []

    def get_pivo(
        self,
        user: Dict,
        pivo_id: str,
        checker: PermissionChecker
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
        self,
        user: Dict,
        pivo_id: str,
        pivo_data: Dict,
        checker: PermissionChecker
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
        can_edit = (
            checker.is_admin() or
            (checker.is_cliente() and pivo.get("owner_id") == user.get("email"))
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

    def delete_pivo(
        self,
        user: Dict,
        pivo_id: str,
        checker: PermissionChecker
    ) -> bool:
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
        """Buscar pivôs no CouchDB"""
        try:
            result = self.db.find({"selector": selector})
            return list(result)
        except Exception as e:
            print(f"❌ Erro ao buscar pivôs: {e}")
            return []

    def _can_view_pivo(self, user: Dict, pivo: Dict, checker: PermissionChecker) -> bool:
        """Verificar se usuário pode visualizar um pivô"""
        user_email = user.get("email")

        if checker.is_admin():
            return True

        if checker.is_revenda():
            # Gerente pode ver pivôs onde é gerente_id
            return pivo.get("gerente_id") == user_email

        if checker.is_cliente():
            # Cliente pode ver apenas seus pivôs
            return pivo.get("owner_id") == user_email

        return False

    # =====================================================================
    # Statistics
    # =====================================================================

    def get_pivos_stats(
        self,
        user: Dict,
        checker: PermissionChecker
    ) -> Dict:
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
