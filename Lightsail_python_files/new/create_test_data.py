#!/usr/bin/env python3
"""
Create test data: Pivôs, Irrigadores, Tensões, Alertas
Para testar o fluxo completo: Admin → Revenda → Cliente

Usage:
    python create_test_data.py
"""

import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import couchdb
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

COUCHDB_URL = os.getenv("COUCHDB_URL", "http://localhost:5984")
DATABASE = os.getenv("COUCHDB_DB", "lindsay-data")

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
# 1. Criar Pivôs
# ============================================================================
# FASE 2: Pivôs agora com owner_id (cliente que cria) e gerente_id (revenda/gerente)
PIVOS = [
    {
        "_id": "pivo:cliente@empresa.com:P001:xyz123",
        "type": "pivo",
        "codigo": "P001",
        "nome": "Pivô Centro-Oeste",
        "owner_id": "cliente@empresa.com",  # Cliente que é dono
        "gerente_id": "revenda@empresa.com",  # Gerente (revenda) do cliente
        "ativo": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": "cliente@empresa.com",
        "location": {"lat": -15.7942, "lng": -48.1000}
    },
    {
        "_id": "pivo:cliente@empresa.com:P002:xyz124",
        "type": "pivo",
        "codigo": "P002",
        "nome": "Pivô Nordeste",
        "owner_id": "cliente@empresa.com",
        "gerente_id": "revenda@empresa.com",
        "ativo": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": "cliente@empresa.com",
        "location": {"lat": -15.7700, "lng": -48.0850}
    },
    {
        "_id": "pivo:cliente@empresa.com:P003:xyz125",
        "type": "pivo",
        "codigo": "P003",
        "nome": "Pivô Sul",
        "owner_id": "cliente@empresa.com",
        "gerente_id": "revenda@empresa.com",
        "ativo": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": "cliente@empresa.com",
        "location": {"lat": -15.8200, "lng": -48.1150}
    }
]

print("\n📍 Criando Pivôs...")
for pivo in PIVOS:
    try:
        db.save(pivo)
        print(f"  ✅ {pivo['nome']}")
    except Exception as e:
        print(f"  ⚠️  {pivo['nome']}: {e}")

# ============================================================================
# 2. Criar Irrigadores (Sensores/Monitores)
# ============================================================================
IRRIGADORES_PER_PIVO = 5

print("\n🌊 Criando Irrigadores...")
for pivo in PIVOS:
    pivo_codigo = pivo["codigo"]
    owner_id = pivo["owner_id"]
    for i in range(1, IRRIGADORES_PER_PIVO + 1):
        irrigador = {
            "_id": f"irrigador:{owner_id}:{pivo_codigo}_irri{i}",
            "type": "irrigador",
            "codigo": f"IRR-{pivo_codigo}-{i:02d}",
            "nome": f"Irrigador {i}",
            "pivoId": pivo["_id"],
            "owner_id": owner_id,  # FASE 2: Mesmo owner do pivô
            "posicao": i,
            "status": "ativo",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        try:
            db.save(irrigador)
            print(f"  ✅ {pivo['nome']} → {irrigador['nome']}")
        except Exception as e:
            print(f"  ⚠️  {irrigador['nome']}: {e}")

# ============================================================================
# 3. Criar Documentos de Tensão (Snapshots)
# ============================================================================
print("\n⚡ Criando Dados de Tensão...")

for pivo in PIVOS:
    pivo_codigo = pivo["codigo"]
    owner_id = pivo["owner_id"]

    # Tensão A
    tensao_a = {
        "_id": f"snap:tensao_a:{owner_id}:{pivo_codigo}",
        "type": "snapshot",
        "subtipo": "tensao_a",
        "pivoId": pivo["_id"],
        "owner_id": owner_id,  # FASE 2
        "table": "tensao_a",
        "timestamp": now.isoformat(),
        "updated_at": now.isoformat(),
        "data": {
            "monitor_1": 220.5,
            "monitor_2": 219.8,
            "monitor_3": 221.2,
            "monitor_4": 220.0,
            "monitor_5": 219.5,
        }
    }

    # Tensão B
    tensao_b = {
        "_id": f"snap:tensao_b:{owner_id}:{pivo_codigo}",
        "type": "snapshot",
        "subtipo": "tensao_b",
        "pivoId": pivo["_id"],
        "owner_id": owner_id,  # FASE 2
        "table": "tensao_b",
        "timestamp": now.isoformat(),
        "updated_at": now.isoformat(),
        "data": {
            "monitor_1": 221.0,
            "monitor_2": 220.5,
            "monitor_3": 220.8,
            "monitor_4": 221.2,
            "monitor_5": 220.0,
        }
    }

    try:
        db.save(tensao_a)
        db.save(tensao_b)
        print(f"  ✅ Tensão A/B para {pivo['nome']}")
    except Exception as e:
        print(f"  ⚠️  Tensão {pivo['nome']}: {e}")

# ============================================================================
# 4. Criar Alertas de Exemplo
# ============================================================================
print("\n🚨 Criando Alertas de Exemplo...")

ALERTS = [
    {
        "type": "evento",
        "pivoId": "pivo:cliente@empresa.com:P001:xyz123",
        "owner_id": "cliente@empresa.com",  # FASE 2
        "gerente_id": "revenda@empresa.com",  # FASE 2
        "table": "events",
        "eventType": "T01",  # Alerta de Tensão
        "monitor": 1,
        "description": "Tensão abaixo do normal (210V)",
        "timestamp": (now - timedelta(hours=2)).isoformat(),
        "status": 1,
    },
    {
        "type": "evento",
        "pivoId": "pivo:cliente@empresa.com:P001:xyz123",
        "owner_id": "cliente@empresa.com",  # FASE 2
        "gerente_id": "revenda@empresa.com",  # FASE 2
        "table": "events",
        "eventType": "A01",  # Alerta Geral
        "monitor": 0,
        "description": "Equipamento desligado",
        "timestamp": (now - timedelta(hours=1)).isoformat(),
        "status": 0,
    },
    {
        "type": "evento",
        "pivoId": "pivo:cliente@empresa.com:P002:xyz124",
        "owner_id": "cliente@empresa.com",  # FASE 2
        "gerente_id": "revenda@empresa.com",  # FASE 2
        "table": "events",
        "eventType": "M02",  # Manutenção
        "monitor": 2,
        "description": "Equipamento em manutenção",
        "timestamp": (now - timedelta(minutes=30)).isoformat(),
        "status": 2,
    }
]

for i, alert in enumerate(ALERTS):
    alert["_id"] = f"evento:{datetime.now().timestamp()}{i}"
    try:
        db.save(alert)
        print(f"  ✅ {alert['description']}")
    except Exception as e:
        print(f"  ⚠️  Alerta: {e}")

# ============================================================================
# 5. Criar Documento SW (Status Geral do Pivô)
# ============================================================================
print("\n🔧 Criando Snapshots SW...")

for pivo in PIVOS:
    pivo_codigo = pivo["codigo"]
    owner_id = pivo["owner_id"]
    sw_doc = {
        "_id": f"snap:sw:{owner_id}:{pivo_codigo}",
        "type": "snapshot",
        "subtipo": "sw",
        "pivoId": pivo["_id"],
        "owner_id": owner_id,  # FASE 2
        "table": "sw",
        "timestamp": now.isoformat(),
        "updated_at": now.isoformat(),
        "data": {
            "timestamp": now.isoformat(),
            "painel_1": "1",
            "painel_2": "1",
            "status_manutencao": "0",
            "monitores": [
                {"statusSw1": "1", "statusSw2": "1", "armadilha": "0", "statusTensao": "1"},
                {"statusSw1": "1", "statusSw2": "1", "armadilha": "0", "statusTensao": "1"},
                {"statusSw1": "1", "statusSw2": "1", "armadilha": "0", "statusTensao": "1"},
                {"statusSw1": "1", "statusSw2": "1", "armadilha": "0", "statusTensao": "1"},
                {"statusSw1": "1", "statusSw2": "1", "armadilha": "0", "statusTensao": "1"},
            ]
        }
    }
    try:
        db.save(sw_doc)
        print(f"  ✅ SW para {pivo['nome']}")
    except Exception as e:
        print(f"  ⚠️  SW {pivo['nome']}: {e}")

# ============================================================================
# 6. Imprimir Resumo
# ============================================================================
print("\n" + "="*60)
print("✅ DADOS DE TESTE CRIADOS COM SUCESSO!")
print("="*60)

print(f"""
📊 RESUMO - FASE 2: Hierarquia de Pivôs
  • Pivôs criados: {len(PIVOS)}
    └─ Owner: cliente@empresa.com
    └─ Gerente: revenda@empresa.com

  • Irrigadores: {len(PIVOS) * IRRIGADORES_PER_PIVO}
  • Dados de Tensão: {len(PIVOS) * 2}
  • Alertas: {len(ALERTS)}
  • Snapshots SW: {len(PIVOS)}

🔐 Teste Completo (Admin → Gerente → Cliente):
  1️⃣  Login Admin:
      • Email: Admin@empresa.com
      • Senha: Admin@12345
      • URL: http://localhost:5173/admin
      • Vê: TODOS os pivôs (3)

  2️⃣  Login Gerente (Revenda):
      • Email: revenda@empresa.com
      • Senha: Revenda@123
      • URL: http://localhost:5173/revenda
      • Vê: Pivôs dos clientes (3)

  3️⃣  Login Cliente:
      • Email: cliente@empresa.com
      • Senha: Cliente@123
      • URL: http://localhost:5173/cliente
      • Vê: Seus pivôs (3)
      • Pode: Criar novos pivôs

📍 Pivôs de Teste:
  • P001: Pivô Centro-Oeste (-15.7942, -48.1000)
  • P002: Pivô Nordeste (-15.7700, -48.0850)
  • P003: Pivô Sul (-15.8200, -48.1150)

🔗 Ferramentas:
  • CouchDB: http://localhost:5984/_utils
  • Frontend: http://localhost:5173
  • Backend: http://localhost:3000

📖 Documentação:
  • QUICK_START_E2E.md - Guia rápido
  • E2E_TEST_FLOW.md - Fluxo completo
  • setup_database_schema.py - Execute para recriar índices
""")
