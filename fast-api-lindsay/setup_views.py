#!/usr/bin/env python3
"""
Setup de Views do CouchDB para queries otimizadas
Cria design documents com views para:
- Listar revendas por status
- Listar clientes pendentes de uma revenda
"""

import couchdb
import os
from datetime import datetime

COUCHDB_URL = os.getenv("COUCHDB_URL", "http://localhost:5984")
USERS_DB = os.getenv("COUCHDB_USERS_DB", "lindsay-users")

def setup_views():
    """Criar design documents e views"""
    try:
        server = couchdb.Server(COUCHDB_URL)
        db = server[USERS_DB]
        print(f"✅ Conectado ao banco '{USERS_DB}'")

        # Design document para app
        design_doc_id = "_design/app"
        try:
            design_doc = db.get(design_doc_id)
            print(f"📝 Design doc '{design_doc_id}' já existe, atualizando...")
        except couchdb.http.ResourceNotFound:
            design_doc = {"_id": design_doc_id}
            print(f"📝 Criando design doc '{design_doc_id}'...")

        # View: revendas_by_status
        design_doc["views"] = design_doc.get("views", {})
        design_doc["views"]["revendas_by_status"] = {
            "map": """
function(doc) {
  if (doc.type === 'revenda' && doc.status) {
    emit(doc.status, {
      _id: doc._id,
      _rev: doc._rev,
      type: doc.type,
      email: doc.email,
      name: doc.name,
      domain: doc.domain,
      status: doc.status,
      created_at: doc.created_at,
      cnpj_revenda: doc.cnpj_revenda
    });
  }
}
            """
        }
        print("   ✓ View 'revendas_by_status' configurada")

        # View: clientes_pending_approval
        design_doc["views"]["clientes_pending_approval"] = {
            "map": """
function(doc) {
  if (doc.type === 'cliente' && doc.status === 'pending' && doc.revenda_id) {
    emit(doc.revenda_id, {
      _id: doc._id,
      _rev: doc._rev,
      type: doc.type,
      email: doc.email,
      name: doc.name,
      status: doc.status,
      created_at: doc.created_at,
      revenda_id: doc.revenda_id
    });
  }
}
            """
        }
        print("   ✓ View 'clientes_pending_approval' configurada")

        # View: revendas_by_email
        design_doc["views"]["revendas_by_email"] = {
            "map": """
function(doc) {
  if (doc.type === 'revenda' && doc.email) {
    emit(doc.email, {
      _id: doc._id,
      _rev: doc._rev,
      type: doc.type,
      email: doc.email,
      name: doc.name,
      status: doc.status,
      created_at: doc.created_at
    });
  }
}
            """
        }
        print("   ✓ View 'revendas_by_email' configurada")

        # Salvar design document
        db.save(design_doc)
        print(f"✅ Design document '{design_doc_id}' salvo com sucesso!")
        print(f"   Views criadas/atualizadas em: {datetime.now().isoformat()}")

    except Exception as e:
        print(f"❌ Erro ao criar views: {e}")
        import traceback
        traceback.print_exc()
        return False

    return True

if __name__ == "__main__":
    success = setup_views()
    exit(0 if success else 1)
