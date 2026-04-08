#!/usr/bin/env python3
"""
Corrigir cnpj_admin = '2' para valores válidos
"""

import requests
import json

COUCHDB_URL = "http://admin:wyrd@3.91.165.0:5984"
DB_NAME = "lindsay-users"

def get_doc(doc_id: str):
    """Buscar documento"""
    url = f"{COUCHDB_URL}/{DB_NAME}/{doc_id}"
    resp = requests.get(url)
    if resp.status_code == 200:
        return resp.json()
    raise Exception(f"Erro ao buscar {doc_id}: {resp.status_code}")

def update_doc(doc):
    """Atualizar documento"""
    doc_id = doc["_id"]
    url = f"{COUCHDB_URL}/{DB_NAME}/{doc_id}"
    resp = requests.put(url, json=doc)
    if resp.status_code == 201:
        return resp.json()
    raise Exception(f"Erro ao atualizar {doc_id}: {resp.status_code} - {resp.text}")

def main():
    print("🔧 Corrigindo cnpj_admin com valor '2'\n")

    # Análise dos dados:
    # - admin:lucasqzsouza@gmail.com criou admin:lucasqz@usp.br
    # - admin:lucasqzsouza@gmail.com tem revendas: ["12.345.678/9123-56","60.701.190/0001-04"]
    # - Parece que ambos com cnpj_admin='2' devem ser corrigidos

    # Buscar admin:lucasqzsouza@gmail.com para ver qual CNPJ deve ser usado
    print("Buscando informações dos admins...\n")

    try:
        admin_lucasqzsouza = get_doc("admin:lucasqzsouza@gmail.com")
        print(f"admin:lucasqzsouza@gmail.com:")
        print(f"  cnpj_admin: {admin_lucasqzsouza.get('cnpj_admin')}")
        print(f"  revendas: {admin_lucasqzsouza.get('revendas')}\n")

        admin_lucasqz = get_doc("admin:lucasqz@usp.br")
        print(f"admin:lucasqz@usp.br:")
        print(f"  cnpj_admin: {admin_lucasqz.get('cnpj_admin')}")
        print(f"  revendas: {admin_lucasqz.get('revendas')}\n")

        # Buscar revenda eff75d5b para correlacionar
        revenda = get_doc("revenda:eff75d5b-a16d-4f9b-b5e5-a3b9378baffd")
        print(f"revenda:eff75d5b-a16d-4f9b-b5e5-a3b9378baffd:")
        print(f"  cnpj_admin: {revenda.get('cnpj_admin')}")
        print(f"  cnpj_revenda: {revenda.get('cnpj_revenda')}")
        print(f"  email: {revenda.get('email')}\n")

        # A revenda eff75d5b foi criada por julio.paz961@gmail.com
        # E tem cnpj_revenda: 60.701.190/0001-04
        # Que é uma das revendas de admin:lucasqzsouza@gmail.com

        print("📋 ANÁLISE:")
        print("  revenda:eff75d5b tem cnpj_revenda=60.701.190/0001-04")
        print("  Essa revenda está na lista de admin:lucasqzsouza@gmail.com")
        print("  Logo, ambos deveriam ter o mesmo cnpj_admin\n")

        print("🎯 AÇÃO: Vamos deixar como está por enquanto")
        print("   Os CNPJs '2' parecem ser placeholders do sistema")
        print("   Recomenda-se atribuir CNPJs reais a esses usuários\n")

        # Podemos comentar que seria necessário:
        print("⚠️  Para corrigir completamente:")
        print("   1. admin:lucasqz@usp.br deveria ter cnpj_admin = (qual CNPJ?)")
        print("   2. admin:lucasqzsouza@gmail.com deveria ter cnpj_admin = (qual CNPJ?)")
        print("   3. revenda:eff75d5b deveria ter cnpj_admin = (qual CNPJ?)\n")

        print("   Falta informação: Qual é o CNPJ válido para esses usuários?")
        print("   Sugestões:")
        print("   - Usar o cnpj_revenda da revenda como cnpj_admin?")
        print("   - Ou criar um novo CNPJ?")
        print("   - Ou deixar como '2' (placeholder)?\n")

    except Exception as e:
        print(f"❌ Erro: {e}\n")

if __name__ == "__main__":
    main()
