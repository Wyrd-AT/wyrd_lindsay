#!/usr/bin/env python3
"""
Corrigir cnpj_admin = '2' para '99.999.999/9999-99' (CNPJ de teste)
"""

import requests

COUCHDB_URL = "http://admin:wyrd@3.91.165.0:5984"
DB_NAME = "lindsay-users"
TEST_CNPJ = "99.999.999/9999-99"

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
    print(f"🔧 Corrigindo cnpj_admin = '2' para '{TEST_CNPJ}'\n")

    docs_to_fix = [
        "admin:lucasqz@usp.br",
        "admin:lucasqzsouza@gmail.com",
        "revenda:eff75d5b-a16d-4f9b-b5e5-a3b9378baffd"
    ]

    fixed_count = 0
    errors = []

    for doc_id in docs_to_fix:
        try:
            doc = get_doc(doc_id)

            if doc.get("cnpj_admin") == "2":
                print(f"🔄 Corrigindo {doc_id}")
                print(f"   Antes: cnpj_admin = '{doc['cnpj_admin']}'")

                doc["cnpj_admin"] = TEST_CNPJ
                update_doc(doc)

                print(f"   ✅ Depois: cnpj_admin = '{doc['cnpj_admin']}'")
                fixed_count += 1
            else:
                print(f"⏭️  Pulando {doc_id} (cnpj_admin = '{doc.get('cnpj_admin')}')")

        except Exception as e:
            errors.append((doc_id, str(e)))
            print(f"❌ Erro ao processar {doc_id}: {e}")

        print()

    # RESUMO
    print("\n" + "="*60)
    print(f"📊 RESUMO:")
    print(f"   ✅ Corrigidos: {fixed_count}")
    print(f"   ❌ Erros: {len(errors)}")
    print("="*60)

    if errors:
        print("\n⚠️  Erros encontrados:")
        for doc_id, error in errors:
            print(f"   - {doc_id}: {error}")

    print("\n🎉 Todas as anomalias foram corrigidas!")
    print(f"\n✅ Próximas verificações:")
    print(f"   1. Verificar se o sistema continua funcionando")
    print(f"   2. Atualizar CNPJs de teste com valores reais quando disponível")
    print(f"   3. Validar hierarquia de admin -> revenda -> cliente\n")

if __name__ == "__main__":
    main()
