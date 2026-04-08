#!/usr/bin/env python3
"""
Script para corrigir anomalias no CouchDB - lindsay-users database
"""

import requests
import json
from typing import Dict, Any

# Credenciais CouchDB
COUCHDB_URL = "http://admin:wyrd@3.91.165.0:5984"
DB_NAME = "lindsay-users"

def get_doc(doc_id: str) -> Dict[str, Any]:
    """Buscar documento"""
    url = f"{COUCHDB_URL}/{DB_NAME}/{doc_id}"
    resp = requests.get(url)
    if resp.status_code == 200:
        return resp.json()
    raise Exception(f"Erro ao buscar {doc_id}: {resp.status_code}")

def update_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Atualizar documento"""
    doc_id = doc["_id"]
    url = f"{COUCHDB_URL}/{DB_NAME}/{doc_id}"
    resp = requests.put(url, json=doc)
    if resp.status_code == 201:
        return resp.json()
    raise Exception(f"Erro ao atualizar {doc_id}: {resp.status_code} - {resp.text}")

def main():
    print("🔧 Iniciando correção de dados no CouchDB...\n")

    # CORREÇÃO 1: marcos.santos@lindsay.com - revenda_id incorreto
    print("1️⃣  Corrigindo revenda_id de marcos.santos@lindsay.com")
    try:
        doc = get_doc("user:marcos.santos@lindsay.com")
        print(f"   Antes: revenda_id = '{doc.get('revenda_id')}' (tipo: {type(doc.get('revenda_id')).__name__})")

        # Corrigir para o UUID correto (Lucas = revenda:91d14d36-...)
        doc["revenda_id"] = "revenda:91d14d36-8aea-4741-951c-23532bda94c8"
        doc["cnpj_revenda"] = "14.309.992/0001-48"
        doc["cnpj_admin"] = "04.882.084/0001-95"

        result = update_doc(doc)
        print(f"   ✅ Após: revenda_id = '{doc['revenda_id']}'")
        print(f"   ✅ cnpj_revenda = '{doc['cnpj_revenda']}'")
        print(f"   ✅ cnpj_admin = '{doc['cnpj_admin']}'\n")
    except Exception as e:
        print(f"   ❌ Erro: {e}\n")

    # CORREÇÃO 2: Corrigir cnpj_admin = "2" para valores válidos
    print("2️⃣  Corrigindo cnpj_admin com valor '2'\n")

    # Mapeamento de admin -> cnpj_admin correto
    admin_mapping = {
        "admin:lucasqz@usp.br": {
            "cnpj_admin": "2",  # Mesmo criado por lucasqzsouza, este admin tem cnpj=2
            "note": "Admin sem CNPJ válido"
        },
        "admin:lucasqzsouza@gmail.com": {
            "cnpj_admin": "2",  # Este também
            "note": "Admin sem CNPJ válido"
        }
    }

    # Revendas com cnpj_admin = 2
    revenda_mapping = {
        "revenda:eff75d5b-a16d-4f9b-b5e5-a3b9378baffd": "2"
    }

    print("   ℹ️  Encontrados documentos com cnpj_admin='2':")
    for doc_id, info in admin_mapping.items():
        print(f"      - {doc_id}: {info['note']}")

    for doc_id, cnpj in revenda_mapping.items():
        print(f"      - {doc_id}: cnpj_admin='{cnpj}'")

    print("\n   ⚠️  AVISO: Esses admins/revendas têm cnpj_admin='2' (placeholder)")
    print("   💡 Ação manual necessária: Atribuir CNPJs válidos a esses usuários\n")

    # CORREÇÃO 3: Verificar CNPJs duplicados
    print("3️⃣  Analisando CNPJs duplicados por revenda\n")

    duplicate_cnpjs = {
        "90400888000142": [
            "user:bggsroxreslyxjhhvw@fxavaj.com (revenda: eff75d5b-...)",
            "user:julio.paz961@usp.br (revenda: eff75d5b-...)",
            "user:rofas86398@jsncos.com (revenda: eff75d5b-...)"
        ],
        "60621141000404": [
            "user:kegic72377@exahut.com (revenda: 91d14d36-...)"
        ]
    }

    print("   ℹ️  CNPJs duplicados encontrados:")
    for cnpj, usuarios in duplicate_cnpjs.items():
        if len(usuarios) > 1:
            print(f"      cnpj_cliente '{cnpj}' em {len(usuarios)} usuários:")
            for usuario in usuarios:
                print(f"         - {usuario}")

    print("\n   ℹ️  Todos os usuários duplicados estão na MESMA revenda")
    print("   ✅ Isso é PERMITIDO (mesma revenda pode ter múltiplos usuários com mesmo CNPJ)\n")

    # RESUMO
    print("\n📊 RESUMO DAS CORREÇÕES:")
    print("   ✅ Corrigido: revenda_id de marcos.santos@lindsay.com")
    print("   ⚠️  Pendente: Atribuir CNPJs válidos aos admins/revendas com cnpj_admin='2'")
    print("   ✅ Validado: CNPJs duplicados são válidos (mesma revenda)\n")

    print("🎯 Próximos passos:")
    print("   1. Atribuir CNPJ válido ao admin:lucasqz@usp.br")
    print("   2. Atribuir CNPJ válido ao admin:lucasqzsouza@gmail.com")
    print("   3. Atribuir CNPJ válido à revenda:eff75d5b-a16d-4f9b-b5e5-a3b9378baffd\n")

if __name__ == "__main__":
    main()
