#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Setup do Schema CouchDB para Sistema Multi-Nível
(Admin > Revendas > Clientes > Pivôs)

Cria:
1. Design documents com views
2. Índices Mango para queries otimizadas
3. Exemplos de documentos

Uso:
    python setup_database_schema.py
"""
import os
import sys
import json
import couchdb
from dotenv import load_dotenv
from typing import Dict, Any

load_dotenv()

COUCHDB_URL = os.getenv("COUCHDB_URL")
DATABASE = os.getenv("COUCHDB_DB", "lindsay-data")

def log(msg: str, level: str = "INFO"):
    """Imprimir log com formatação"""
    symbols = {
        "OK": "✅",
        "ERROR": "❌",
        "WARN": "⚠️",
        "INFO": "ℹ️"
    }
    print(f"{symbols.get(level, '•')} [{level}] {msg}")

def connect_couchdb():
    """Conectar ao CouchDB"""
    try:
        server = couchdb.Server(COUCHDB_URL)
        try:
            db = server[DATABASE]
            log(f"Conectado ao database '{DATABASE}'", "OK")
            return server, db
        except couchdb.http.ResourceNotFound:
            log(f"Database '{DATABASE}' não encontrado. Criando...", "WARN")
            db = server.create(DATABASE)
            log(f"Database '{DATABASE}' criado", "OK")
            return server, db
    except Exception as e:
        log(f"Falha ao conectar ao CouchDB: {e}", "ERROR")
        return None, None

def create_design_doc(db):
    """Criar design doc com views para queries"""
    design_doc = {
        "_id": "_design/app",
        "views": {
            # ======== ADMIN QUERIES ========
            "all_admins": {
                "map": """function(doc) {
                    if (doc.type === 'admin') {
                        emit(doc.email, doc.name);
                    }
                }"""
            },

            # ======== REVENDA QUERIES ========
            "all_revendas": {
                "map": """function(doc) {
                    if (doc.type === 'revenda') {
                        emit([doc.status, doc.domain], {
                            email: doc.email,
                            name: doc.name,
                            status: doc.status,
                            created_at: doc.created_at
                        });
                    }
                }"""
            },

            "revendas_by_status": {
                "map": """function(doc) {
                    if (doc.type === 'revenda') {
                        emit(doc.status, 1);
                    }
                }""",
                "reduce": "_sum"
            },

            "revenda_by_domain": {
                "map": """function(doc) {
                    if (doc.type === 'revenda') {
                        emit(doc.domain, doc._id);
                    }
                }"""
            },

            # ======== CLIENTE QUERIES ========
            "clientes_by_revenda": {
                "map": """function(doc) {
                    if (doc.type === 'revenda' && doc.clientes) {
                        doc.clientes.forEach(function(cliente) {
                            emit([doc._id, cliente.status], {
                                email: cliente.email,
                                name: cliente.name,
                                status: cliente.status,
                                created_at: cliente.created_at
                            });
                        });
                    }
                }"""
            },

            "clientes_pending_approval": {
                "map": """function(doc) {
                    if (doc.type === 'revenda' && doc.clientes) {
                        doc.clientes.forEach(function(cliente) {
                            if (cliente.status === 'pending') {
                                emit(doc._id, {
                                    email: cliente.email,
                                    name: cliente.name,
                                    created_at: cliente.created_at
                                });
                            }
                        });
                    }
                }"""
            },

            # ======== PIVO QUERIES ========
            "pivos_by_cliente": {
                "map": """function(doc) {
                    if (doc.type === 'pivo' && doc.clienteId) {
                        emit([doc.clienteId, doc.codigo], {
                            nome: doc.nome,
                            revendaId: doc.revendaId,
                            status: doc.status
                        });
                    }
                }"""
            },

            "pivos_by_revenda": {
                "map": """function(doc) {
                    if (doc.type === 'pivo' && doc.revendaId) {
                        emit([doc.revendaId, doc.status], {
                            codigo: doc.codigo,
                            nome: doc.nome,
                            clienteId: doc.clienteId
                        });
                    }
                }"""
            },

            # FASE 2: Novas views para hierarquia atualizada (owner_id/gerente_id)
            "pivos_by_owner": {
                "map": """function(doc) {
                    if (doc.type === 'pivo' && doc.owner_id) {
                        emit([doc.owner_id, doc.codigo], {
                            nome: doc.nome,
                            gerente_id: doc.gerente_id,
                            ativo: doc.ativo,
                            created_at: doc.created_at
                        });
                    }
                }"""
            },

            "pivos_by_gerente": {
                "map": """function(doc) {
                    if (doc.type === 'pivo' && doc.gerente_id) {
                        emit([doc.gerente_id, doc.ativo], {
                            codigo: doc.codigo,
                            nome: doc.nome,
                            owner_id: doc.owner_id,
                            created_at: doc.created_at
                        });
                    }
                }"""
            },

            "all_pivos": {
                "map": """function(doc) {
                    if (doc.type === 'pivo') {
                        emit(doc.codigo, {
                            nome: doc.nome,
                            owner_id: doc.owner_id,
                            gerente_id: doc.gerente_id,
                            ativo: doc.ativo
                        });
                    }
                }"""
            },

            # ======== DADOS OPERACIONAIS ========
            "tensao_by_pivo": {
                "map": """function(doc) {
                    if (doc.table === 'tensao_raw' && doc.pivoId) {
                        emit([doc.pivoId, doc.timestamp], {
                            tipo: doc.tipo,
                            monitor_range: doc.monitor_range
                        });
                    }
                }"""
            },

            "eventos_by_pivo": {
                "map": """function(doc) {
                    if (doc.table === 'events' && doc.pivoId) {
                        emit([doc.pivoId, doc.timestamp], {
                            eventType: doc.eventType,
                            monitor: doc.monitor,
                            estado: doc.estado
                        });
                    }
                }"""
            }
        }
    }

    try:
        # Verificar se já existe
        try:
            existing = db.get("_design/app")
            if existing:
                log("Design doc '_design/app' já existe, atualizando...", "WARN")
                design_doc["_rev"] = existing.get("_rev")
        except (couchdb.http.ResourceNotFound, KeyError):
            pass

        db.save(design_doc)
        log("Design doc '_design/app' criado/atualizado com sucesso", "OK")
        return True
    except Exception as e:
        log(f"Erro ao criar design doc: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        return False

def create_indexes(db):
    """Criar índices Mango para queries otimizadas"""
    indexes = [
        {
            "index": {"fields": ["type", "email"]},
            "name": "idx_type_email",
            "ddoc": "queries"
        },
        {
            "index": {"fields": ["type", "status"]},
            "name": "idx_type_status",
            "ddoc": "queries"
        },
        {
            "index": {"fields": ["type", "domain"]},
            "name": "idx_type_domain",
            "ddoc": "queries"
        },
        {
            "index": {"fields": ["type", "pivoId", "timestamp"]},
            "name": "idx_type_pivo_timestamp",
            "ddoc": "queries"
        },
        {
            "index": {"fields": ["table", "pivoId", "timestamp"]},
            "name": "idx_table_pivo_timestamp",
            "ddoc": "queries"
        },
        # FASE 2: Índices para hierarquia atualizada
        {
            "index": {"fields": ["type", "owner_id"]},
            "name": "idx_pivo_owner",
            "ddoc": "queries"
        },
        {
            "index": {"fields": ["type", "gerente_id"]},
            "name": "idx_pivo_gerente",
            "ddoc": "queries"
        },
        {
            "index": {"fields": ["type", "gerente_id", "ativo"]},
            "name": "idx_pivo_gerente_ativo",
            "ddoc": "queries"
        }
    ]

    log(f"Criando {len(indexes)} índices Mango...", "INFO")
    success_count = 0

    for idx in indexes:
        try:
            import requests
            response = requests.post(
                f"{COUCHDB_URL}/{DATABASE}/_index",
                json=idx,
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            if response.status_code in [200, 201]:
                log(f"Índice '{idx['name']}' criado", "OK")
                success_count += 1
            elif response.status_code == 409:
                log(f"Índice '{idx['name']}' já existe", "WARN")
                success_count += 1
            else:
                log(f"Erro ao criar '{idx['name']}': HTTP {response.status_code}", "ERROR")

        except Exception as e:
            log(f"Exceção ao criar '{idx['name']}': {e}", "ERROR")

    return success_count == len(indexes)

def create_example_documents(db):
    """Criar documentos de exemplo para testes"""
    examples = [
        {
            "_id": "admin:admin@company.com",
            "type": "admin",
            "email": "admin@company.com",
            "name": "Admin Master",
            "password_hash": "hash_exemplo_123",
            "status": "active",
            "created_at": "2026-02-16T10:00:00Z"
        },
        {
            "_id": "revenda:sertaozinho.com",
            "type": "revenda",
            "domain": "sertaozinho.com",
            "email": "contato@sertaozinho.com",
            "name": "Revenda Sertãozinho",
            "password_hash": "hash_exemplo_456",
            "status": "active",
            "approved_by": "admin@company.com",
            "approved_at": "2026-02-15T10:00:00Z",
            "created_at": "2026-02-14T10:00:00Z",
            "clientes": [
                {
                    "_id": "cliente:joao@sertaozinho.com",
                    "email": "joao@sertaozinho.com",
                    "name": "João Silva",
                    "password_hash": "hash_exemplo_789",
                    "status": "active",
                    "approved_at": "2026-02-14T11:00:00Z",
                    "created_at": "2026-02-13T10:00:00Z",
                    "pivoIds": ["LIND01", "LIND02"]
                },
                {
                    "_id": "cliente:maria@sertaozinho.com",
                    "email": "maria@sertaozinho.com",
                    "name": "Maria Costa",
                    "password_hash": "hash_exemplo_999",
                    "status": "pending",
                    "created_at": "2026-02-16T09:00:00Z",
                    "pivoIds": []
                }
            ]
        }
    ]

    log(f"Criando {len(examples)} documentos de exemplo...", "INFO")
    success_count = 0

    for doc in examples:
        try:
            # Verificar se já existe
            try:
                existing = db.get(doc["_id"])
                log(f"Documento '{doc['_id']}' já existe, pulando", "WARN")
                success_count += 1
                continue
            except couchdb.http.ResourceNotFound:
                pass

            db.save(doc)
            log(f"Documento '{doc['_id']}' criado", "OK")
            success_count += 1
        except Exception as e:
            log(f"Erro ao criar documento '{doc['_id']}': {e}", "ERROR")

    return success_count == len(examples)

def main():
    """Executar setup completo"""
    print("\n" + "=" * 70)
    print("  Setup Database Schema - Sistema Multi-Nível Lindsay")
    print("=" * 70 + "\n")

    # Conectar
    server, db = connect_couchdb()
    if not server or not db:
        log("Falha ao conectar ao CouchDB", "ERROR")
        return False

    # Criar design doc
    log("\n▶ Criando Design Document com Views...", "INFO")
    if not create_design_doc(db):
        log("Falha ao criar design doc", "ERROR")
        return False

    # Criar índices
    log("\n▶ Criando Índices Mango...", "INFO")
    if not create_indexes(db):
        log("Falha ao criar alguns índices (verifique os detalhes acima)", "WARN")

    # Criar exemplos
    log("\n▶ Criando Documentos de Exemplo...", "INFO")
    if not create_example_documents(db):
        log("Falha ao criar alguns documentos", "WARN")

    # Sucesso
    print("\n" + "=" * 70)
    print("  ✅ Setup Concluído com Sucesso!")
    print("=" * 70)
    print("\nPróximos passos:")
    print("1. Verificar documentos no Fauxton: http://localhost:5984/_utils")
    print("2. Testar queries usando as views criadas")
    print("3. Implementar AuthService (Python)")
    print("4. Implementar Frontend (React)")
    print("\n")

    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
