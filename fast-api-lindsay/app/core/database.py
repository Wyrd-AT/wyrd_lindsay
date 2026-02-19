"""
Gerenciamento de conexão com CouchDB
"""

import couchdb
from typing import Optional
from app.core.config import settings

_db: Optional[couchdb.Database] = None
_users_db: Optional[couchdb.Database] = None


def get_db() -> couchdb.Database:
    """Obter conexão com CouchDB (banco de dados principal)"""
    global _db

    if _db is None:
        try:
            server = couchdb.Server(settings.COUCHDB_URL)
            try:
                _db = server[settings.COUCHDB_DB]
                print(f"✅ Conectado ao CouchDB: {settings.COUCHDB_DB}")
            except couchdb.http.ResourceNotFound:
                print(f"⚠️ Database não encontrado. Criando...")
                _db = server.create(settings.COUCHDB_DB)
                print(f"✅ Database criado: {settings.COUCHDB_DB}")
        except Exception as e:
            print(f"❌ Erro ao conectar ao CouchDB: {e}")
            raise

    return _db


def get_users_db() -> couchdb.Database:
    """Obter conexão com CouchDB (banco de usuários)"""
    global _users_db

    if _users_db is None:
        try:
            server = couchdb.Server(settings.COUCHDB_URL)
            try:
                _users_db = server[settings.COUCHDB_USERS_DB]
                print(f"✅ Conectado ao CouchDB Users: {settings.COUCHDB_USERS_DB}")
            except couchdb.http.ResourceNotFound:
                print(f"⚠️ Database não encontrado. Criando...")
                _users_db = server.create(settings.COUCHDB_USERS_DB)
                print(f"✅ Database criado: {settings.COUCHDB_USERS_DB}")
        except Exception as e:
            print(f"❌ Erro ao conectar ao CouchDB Users: {e}")
            raise

    return _users_db


def close_db():
    """Fechar conexão com CouchDB"""
    global _db, _users_db
    if _db:
        _db = None
        print("✅ Conexão com CouchDB fechada")
    if _users_db:
        _users_db = None
        print("✅ Conexão com CouchDB Users fechada")
