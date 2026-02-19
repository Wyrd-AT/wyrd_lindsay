#!/usr/bin/env python3
"""
Migrar pivôs existentes para estrutura com hierarquia (owner_id, gerente_id, created_by)
Mantém TODOS os campos existentes e apenas adiciona os novos necessários.

Usage:
    python migrate_pivos_cnpj.py
"""

import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
import couchdb
from dotenv import load_dotenv

load_dotenv()

COUCHDB_URL = os.getenv("COUCHDB_URL", "http://localhost:5984")
DATABASE = os.getenv("COUCHDB_DB", "lindsay-data")

# CNPJs da hierarquia
OWNER_ID = "58.363.807/0001-79"      # Cliente
GERENTE_ID = "10.318.824/0001-68"    # Revenda
CREATED_BY = "84.429.695/0001-11"    # Admin

# Connect to CouchDB
try:
    server = couchdb.Server(COUCHDB_URL)
    db = server[DATABASE]
    print(f"✅ Conectado ao CouchDB: {DATABASE}")
except Exception as e:
    print(f"❌ Erro ao conectar ao CouchDB: {e}")
    sys.exit(1)

BR_TZ = ZoneInfo("America/Sao_Paulo")
now = datetime.now(tz=BR_TZ)

# ============================================================================
# Buscar todos os pivôs existentes (type == 'pivo')
# ============================================================================
print("\n📍 Buscando pivôs existentes...")

try:
    # Usar Mango Query para encontrar pivôs
    results = db.find({
        "selector": {"type": "pivo"},
        "limit": 1000
    })

    pivos = results.get("docs", [])
    print(f"  📊 Total de pivôs encontrados: {len(pivos)}")

except Exception as e:
    print(f"  ⚠️ Erro ao usar find(): {e}")
    print("  Tentando _all_docs...")

    try:
        all_docs = db.view("_all_docs", include_docs=True)
        pivos = [row.doc for row in all_docs if row.doc.get("type") == "pivo"]
        print(f"  📊 Total de pivôs encontrados: {len(pivos)}")
    except Exception as e2:
        print(f"  ❌ Erro fatal: {e2}")
        sys.exit(1)

if not pivos:
    print("\n❌ Nenhum pivô encontrado!")
    sys.exit(0)

# ============================================================================
# Migrar cada pivô
# ============================================================================
print(f"\n🔄 Migrando pivôs com hierarquia...")
print(f"   owner_id (Cliente): {OWNER_ID}")
print(f"   gerente_id (Revenda): {GERENTE_ID}")
print(f"   created_by (Admin): {CREATED_BY}\n")

migrados = 0
ja_migrados = 0
erros = 0

for pivo in pivos:
    pivo_id = pivo.get("_id", "?")
    pivo_codigo = pivo.get("codigo", "?")

    try:
        # Se já tem owner_id e gerente_id, pular
        if "owner_id" in pivo and "gerente_id" in pivo:
            print(f"  ✓ {pivo_codigo} - já migrado")
            ja_migrados += 1
            continue

        # Adicionar campos hierárquicos mantendo TUDO que existe
        pivo_atualizado = {
            **pivo,  # 👈 Preserva TODOS os campos existentes
            "owner_id": OWNER_ID,
            "gerente_id": GERENTE_ID,
            "created_by": CREATED_BY,
            "updated_at": now.isoformat(),
        }

        # Adicionar location se não existir
        if "location" not in pivo_atualizado:
            pivo_atualizado["location"] = None

        # Salvar no banco
        db.save(pivo_atualizado)

        print(f"  ✅ {pivo_codigo}")
        print(f"     └─ owner_id: {OWNER_ID}")
        print(f"     └─ gerente_id: {GERENTE_ID}")

        migrados += 1

    except Exception as e:
        print(f"  ❌ {pivo_codigo}: {e}")
        erros += 1

# ============================================================================
# Resumo
# ============================================================================
print("\n" + "="*70)
print("✅ MIGRAÇÃO CONCLUÍDA!")
print("="*70)

print(f"""
📊 RESUMO:
  • Novos pivôs migrados: {migrados}
  • Pivôs já migrados: {ja_migrados}
  • Erros: {erros}
  • Total processado: {migrados + ja_migrados + erros}

🔐 ESTRUTURA APLICADA:
  • owner_id: {OWNER_ID} (Cliente)
  • gerente_id: {GERENTE_ID} (Revenda)
  • created_by: {CREATED_BY} (Admin)
  • location: null (adicione depois se necessário)
  • updated_at: {now.isoformat()}

📌 PRÓXIMOS PASSOS:
  1. Verificar os pivôs em http://localhost:5984/_utils
  2. Criar usuários no Cognito com esses CNPJs como identificadores
  3. Atualizar authStore.ts para usar CNPJ em vez de email
  4. Fazer login e ver os pivôs aparecerem

🔗 Teste com admin (CNPJ: {CREATED_BY})
   - Deve ver TODOS os pivôs

🔗 Teste com gerente (CNPJ: {GERENTE_ID})
   - Deve ver pivôs onde gerente_id == {GERENTE_ID}

🔗 Teste com cliente (CNPJ: {OWNER_ID})
   - Deve ver pivôs onde owner_id == {OWNER_ID}
""")
