#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para adicionar campos faltantes aos pivôs/irrigadores no CouchDB

Este script:
1. Busca todos os usuários cadastrados (admin, revenda, cliente) do CouchDB
2. Busca todos os irrigadores com table="irrigadores"
3. Mapeia os pivôs aos usuários corretos baseado nos dados reais:
   - owner_id → email do cliente cadastrado
   - gerente_id → email da revenda do cliente
4. Adiciona campos faltantes (nome, owner_id, gerente_id, ativo, type)
5. Atualiza os documentos no CouchDB

Uso:
    python scripts/update_pivos_fields.py
    python scripts/update_pivos_fields.py --dry-run  # Apenas visualizar
    python scripts/update_pivos_fields.py --default-owner admin@company.com  # Owner padrão (fallback)
"""

import sys
import os
from datetime import datetime
from typing import List, Dict, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import couchdb
from app.core.config import settings

# =============================================================================
# Cores
# =============================================================================

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{text:^80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}\n")


def infer_nome(pivo: Dict) -> str:
    """Inferir nome do pivô a partir dos dados disponíveis"""
    # Tentar nome existente
    nome = pivo.get("nome") or pivo.get("name")
    if nome:
        return nome
    
    # Usar código como nome
    codigo = pivo.get("codigo", "")
    if codigo:
        return f"Pivô {codigo}"
    
    # Usar ID como último recurso
    pivo_id = pivo.get("_id", "")
    if "irrigador:" in pivo_id:
        parts = pivo_id.split(":")
        if len(parts) >= 2:
            return f"Irrigador {parts[-1][:8]}"
    
    return "Pivô sem nome"


def get_users_from_db(db) -> Dict[str, Dict]:
    """
    Buscar todos os usuários (admin, revenda, cliente) do CouchDB
    
    Returns:
        Dicionário com {email: user_data} para cada tipo
    """
    users = {
        "admins": {},
        "revendas": {},
        "clientes": {}
    }
    
    try:
        # Buscar admins
        try:
            result = db.find({"selector": {"type": "admin"}, "limit": 1000})
            for admin in result:
                email = admin.get("email")
                if email:
                    users["admins"][email] = admin
        except:
            pass
        
        # Buscar revendas
        try:
            result = db.find({"selector": {"type": "revenda"}, "limit": 1000})
            for revenda in result:
                email = revenda.get("email")
                if email:
                    users["revendas"][email] = revenda
        except:
            pass
        
        # Buscar clientes
        try:
            result = db.find({"selector": {"type": "cliente"}, "limit": 1000})
            for cliente in result:
                email = cliente.get("email")
                if email:
                    users["clientes"][email] = cliente
        except:
            pass
        
        # Se não encontrou com query Mango, tentar _all_docs
        if not any(users.values()):
            try:
                all_docs = db.view('_all_docs', include_docs=True, limit=1000)
                for row in all_docs:
                    doc = row.doc
                    doc_type = doc.get("type", "")
                    email = doc.get("email")
                    
                    if email:
                        if doc_type == "admin":
                            users["admins"][email] = doc
                        elif doc_type == "revenda":
                            users["revendas"][email] = doc
                        elif doc_type == "cliente":
                            users["clientes"][email] = doc
            except:
                pass
        
    except Exception as e:
        print(f"{Colors.WARNING}⚠️  Erro ao buscar usuários: {e}{Colors.ENDC}")
    
    return users


def infer_owner_id(pivo: Dict, users: Dict[str, Dict], default_owner: Optional[str] = None) -> tuple:
    """
    Inferir owner_id e gerente_id do pivô baseado nos usuários cadastrados
    
    Returns:
        (owner_id, gerente_id)
    """
    # Tentar owner_id existente
    owner_id = pivo.get("owner_id") or pivo.get("companyId")
    gerente_id = pivo.get("gerente_id")
    
    if owner_id and owner_id in users["clientes"]:
        # Se owner_id é um cliente válido, buscar gerente_id dele
        cliente = users["clientes"][owner_id]
        revenda_id = cliente.get("revenda_id", "")
        
        # Tentar encontrar revenda pelo revenda_id
        if revenda_id:
            # revenda_id pode ser "revenda:example.com" ou email
            if revenda_id.startswith("revenda:"):
                domain = revenda_id.replace("revenda:", "")
                # Buscar revenda pelo domain
                for email, revenda in users["revendas"].items():
                    if revenda.get("domain") == domain:
                        gerente_id = email
                        break
            else:
                # Pode ser email direto
                if revenda_id in users["revendas"]:
                    gerente_id = revenda_id
        
        return (owner_id, gerente_id)
    
    # Tentar extrair do _id
    pivo_id = pivo.get("_id", "")
    if "irrigador:" in pivo_id:
        parts = pivo_id.split(":")
        if len(parts) >= 2:
            # Formato: irrigador:companyId:timestamp:random
            potential_owner = parts[1]
            if potential_owner and potential_owner in users["clientes"]:
                cliente = users["clientes"][potential_owner]
                revenda_id = cliente.get("revenda_id", "")
                if revenda_id and revenda_id.startswith("revenda:"):
                    domain = revenda_id.replace("revenda:", "")
                    for email, revenda in users["revendas"].items():
                        if revenda.get("domain") == domain:
                            gerente_id = email
                            break
                return (potential_owner, gerente_id)
    
    # Se não conseguiu inferir, distribuir entre clientes disponíveis
    if users["clientes"]:
        # Pegar primeiro cliente ativo
        for email, cliente in users["clientes"].items():
            if cliente.get("status") == "active":
                revenda_id = cliente.get("revenda_id", "")
                gerente_id = ""
                if revenda_id and revenda_id.startswith("revenda:"):
                    domain = revenda_id.replace("revenda:", "")
                    for rev_email, revenda in users["revendas"].items():
                        if revenda.get("domain") == domain:
                            gerente_id = rev_email
                            break
                return (email, gerente_id)
    
    # Usar default se fornecido (será admin)
    if default_owner:
        return (default_owner, "")
    
    # Se tem admins, usar primeiro admin como fallback
    if users["admins"]:
        first_admin = list(users["admins"].keys())[0]
        return (first_admin, "")
    
    return ("", "")




def update_pivo_fields(db, pivo: Dict, users: Dict[str, Dict], default_owner: Optional[str] = None, dry_run: bool = False) -> Dict:
    """
    Atualizar campos faltantes do pivô
    
    Args:
        db: Conexão com CouchDB
        pivo: Documento do pivô
        default_owner: Owner padrão se não conseguir inferir
        dry_run: Se True, apenas simula
    
    Returns:
        Resultado da atualização
    """
    pivo_id = pivo.get("_id")
    updates = {}
    
    # Verificar e adicionar campos faltantes
    if not pivo.get("nome") and not pivo.get("name"):
        updates["nome"] = infer_nome(pivo)
    
    # Inferir owner_id e gerente_id usando dados reais dos usuários
    if not pivo.get("owner_id") and not pivo.get("companyId"):
        owner_id, gerente_id = infer_owner_id(pivo, users, default_owner)
        if owner_id:
            updates["owner_id"] = owner_id
            # Se conseguiu inferir gerente_id junto, usar
            if gerente_id and not pivo.get("gerente_id"):
                updates["gerente_id"] = gerente_id
    
    # Se ainda não tem gerente_id, tentar inferir separadamente
    if not pivo.get("gerente_id") and not updates.get("gerente_id"):
        # Tentar buscar gerente_id do owner_id
        owner_id = updates.get("owner_id") or pivo.get("owner_id")
        if owner_id and owner_id in users["clientes"]:
            cliente = users["clientes"][owner_id]
            revenda_id = cliente.get("revenda_id", "")
            if revenda_id and revenda_id.startswith("revenda:"):
                domain = revenda_id.replace("revenda:", "")
                for email, revenda in users["revendas"].items():
                    if revenda.get("domain") == domain:
                        updates["gerente_id"] = email
                        break
    
    if "ativo" not in pivo:
        updates["ativo"] = True  # Padrão: ativo
    
    if not pivo.get("type"):
        updates["type"] = "pivo"  # Adicionar type para compatibilidade
    
    if not pivo.get("table"):
        updates["table"] = "irrigadores"  # Garantir que tem table
    
    # Adicionar timestamps se não existirem
    if "created_at" not in pivo:
        updates["created_at"] = datetime.now().isoformat()
    
    if "updated_at" not in pivo:
        updates["updated_at"] = datetime.now().isoformat()
    
    if not updates:
        return {
            "success": True,
            "action": "sem mudanças",
            "pivo_id": pivo_id
        }
    
    if dry_run:
        return {
            "success": True,
            "action": "atualizado (simulado)",
            "pivo_id": pivo_id,
            "updates": updates
        }
    
    try:
        # Atualizar documento
        pivo.update(updates)
        db.save(pivo)
        
        return {
            "success": True,
            "action": "atualizado",
            "pivo_id": pivo_id,
            "updates": updates
        }
    except Exception as e:
        return {
            "success": False,
            "action": "erro",
            "pivo_id": pivo_id,
            "error": str(e)
        }


def main():
    """Função principal"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Adicionar campos faltantes aos pivôs/irrigadores",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python scripts/update_pivos_fields.py                    # Atualizar todos
  python scripts/update_pivos_fields.py --dry-run         # Apenas visualizar
  python scripts/update_pivos_fields.py --default-owner admin@company.com
        """
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Apenas simular, não salvar no CouchDB"
    )
    
    parser.add_argument(
        "--default-owner",
        help="Email do owner padrão para pivôs sem owner_id (será usado apenas se não houver clientes cadastrados)"
    )
    
    args = parser.parse_args()
    
    title = "Atualizar Campos dos Pivôs/Irrigadores"
    if args.dry_run:
        title += " (DRY RUN)"
    print_header(title)
    
    # Conectar ao CouchDB
    print(f"{Colors.OKCYAN}Conectando ao CouchDB...{Colors.ENDC}")
    print(f"{Colors.OKCYAN}URL: {settings.COUCHDB_URL}{Colors.ENDC}")
    print(f"{Colors.OKCYAN}Database: {settings.COUCHDB_DB}{Colors.ENDC}\n")
    
    try:
        server = couchdb.Server(settings.COUCHDB_URL)
        db = server[settings.COUCHDB_DB]
        print(f"{Colors.OKGREEN}✅ Conectado com sucesso!{Colors.ENDC}\n")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao conectar: {e}{Colors.ENDC}")
        sys.exit(1)
    
    # Buscar usuários cadastrados
    print(f"{Colors.OKCYAN}Buscando usuários cadastrados (admin, revenda, cliente)...{Colors.ENDC}\n")
    
    users = get_users_from_db(db)
    total_users = len(users["admins"]) + len(users["revendas"]) + len(users["clientes"])
    
    print(f"{Colors.OKGREEN}✅ Encontrados:{Colors.ENDC}")
    print(f"   {Colors.OKCYAN}Admins:{Colors.ENDC} {len(users['admins'])}")
    print(f"   {Colors.OKCYAN}Revendas:{Colors.ENDC} {len(users['revendas'])}")
    print(f"   {Colors.OKCYAN}Clientes:{Colors.ENDC} {len(users['clientes'])}")
    print(f"   {Colors.BOLD}Total:{Colors.ENDC} {total_users}\n")
    
    if total_users == 0:
        print(f"{Colors.WARNING}⚠️  Nenhum usuário encontrado no banco{Colors.ENDC}")
        print(f"{Colors.WARNING}   Os pivôs serão atribuídos ao default-owner se fornecido{Colors.ENDC}\n")
    
    # Buscar todos os irrigadores
    print(f"{Colors.OKCYAN}Buscando irrigadores...{Colors.ENDC}\n")
    
    try:
        result = db.find({"selector": {"table": "irrigadores"}, "limit": 10000})
        pivos = list(result)
        print(f"{Colors.OKGREEN}✅ Encontrados {len(pivos)} irrigador(es){Colors.ENDC}\n")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao buscar irrigadores: {e}{Colors.ENDC}")
        sys.exit(1)
    
    if not pivos:
        print(f"{Colors.WARNING}⚠️  Nenhum irrigador encontrado{Colors.ENDC}")
        sys.exit(0)
    
    # Atualizar cada pivô
    print(f"{Colors.OKCYAN}Atualizando campos usando dados dos usuários cadastrados...{Colors.ENDC}\n")
    
    results = {
        "updated": [],
        "no_changes": [],
        "errors": []
    }
    
    for pivo in pivos:
        result = update_pivo_fields(db, pivo, users, args.default_owner, args.dry_run)
        
        if result["success"]:
            if result["action"] == "atualizado":
                results["updated"].append(result)
                updates = result.get("updates", {})
                updates_str = ", ".join(f"{k}={v}" for k, v in updates.items())
                print(f"{Colors.OKGREEN}✅ {result['pivo_id']}: {updates_str}{Colors.ENDC}")
            elif result["action"] == "atualizado (simulado)":
                results["updated"].append(result)
                updates = result.get("updates", {})
                updates_str = ", ".join(f"{k}={v}" for k, v in updates.items())
                print(f"{Colors.OKCYAN}🔍 {result['pivo_id']}: {updates_str} (simulado){Colors.ENDC}")
            else:
                results["no_changes"].append(result)
                print(f"{Colors.OKBLUE}ℹ️  {result['pivo_id']}: sem mudanças necessárias{Colors.ENDC}")
        else:
            results["errors"].append(result)
            print(f"{Colors.FAIL}❌ {result['pivo_id']}: {result.get('error', 'erro desconhecido')}{Colors.ENDC}")
    
    # Resumo
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}Resumo:{Colors.ENDC}")
    print(f"  {Colors.OKGREEN}Atualizados:{Colors.ENDC} {len(results['updated'])}")
    print(f"  {Colors.OKBLUE}Sem mudanças:{Colors.ENDC} {len(results['no_changes'])}")
    print(f"  {Colors.FAIL}Erros:{Colors.ENDC} {len(results['errors'])}")
    print(f"  {Colors.BOLD}Total:{Colors.ENDC} {len(pivos)}")
    
    if args.dry_run:
        print(f"\n{Colors.WARNING}⚠️  MODO DRY RUN - Nenhum dado foi salvo no CouchDB{Colors.ENDC}")
        print(f"{Colors.WARNING}Execute sem --dry-run para aplicar as mudanças{Colors.ENDC}")
    
    print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}\n")
    
    # Mostrar erros se houver
    if results["errors"]:
        print(f"{Colors.FAIL}Erros encontrados:{Colors.ENDC}")
        for error in results["errors"]:
            print(f"  - {error['pivo_id']}: {error.get('error', 'erro desconhecido')}")
        print()


if __name__ == "__main__":
    main()
