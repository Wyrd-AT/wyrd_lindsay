#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lindsay API - FastAPI v2.0
Sistema Multi-Nível: Admin → Revenda → Cliente → Pivôs

Estrutura:
  app/
    core/          - Configuração, database, security
    models/        - Pydantic schemas
    services/      - Business logic (auth, permissions, pivos)
    api/routes/    - Endpoint routes

Rodar:
  python main.py

Docs:
  http://localhost:8000/docs
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import get_db, close_db
from app.api.routes import auth, admins, revendas, clientes, pivos, alerts, commands
from app.services.setup_indexes import setup_indexes


# ============================================================================
# Lifespan Management
# ============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerenciar lifecycle da aplicação"""
    # Startup
    print(f"""
    ╔═══════════════════════════════════════════════════════════╗
    ║         Lindsay API - FastAPI v{settings.APP_VERSION}                    ║
    ║  Sistema Multi-Nível: Admin → Revenda → Cliente → Pivôs   ║
    ║  Environment: {settings.ENVIRONMENT:<45} ║
    ║  CouchDB: {settings.COUCHDB_URL:<51} ║
    ╚═══════════════════════════════════════════════════════════╝
    """)

    # Conectar ao CouchDB
    try:
        db = get_db()
        print(f"✅ CouchDB conectado: {settings.COUCHDB_DB}")

        # Configurar índices Mango necessários para queries eficientes
        print("🔧 Configurando índices CouchDB...")
        success, msg = setup_indexes(settings.COUCHDB_URL, settings.COUCHDB_DB)
        if success:
            print(f"✅ Índices configurados: {msg}")
        else:
            print(f"⚠️  Aviso ao configurar índices: {msg}")

    except Exception as e:
        print(f"❌ Erro ao conectar CouchDB: {e}")

    yield

    # Shutdown
    close_db()
    print("✅ API finalizada com sucesso")


# ============================================================================
# Criar App
# ============================================================================

app = FastAPI(
    title=settings.APP_NAME,
    description="Sistema de Gerenciamento Hierárquico de Pivôs",
    version=settings.APP_VERSION,
    docs_url=settings.DOCS_URL,
    redoc_url=settings.REDOC_URL,
    openapi_url=settings.OPENAPI_URL,
    lifespan=lifespan,
)

# ============================================================================
# CORS Middleware
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, usar lista específica
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Routes
# ============================================================================


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "app": settings.APP_NAME}


# API routes
app.include_router(auth.router, prefix=settings.API_PREFIX, tags=["auth"])
app.include_router(admins.router, prefix=settings.API_PREFIX, tags=["admins"])
app.include_router(revendas.router, prefix=settings.API_PREFIX, tags=["revendas"])
app.include_router(clientes.router, prefix=settings.API_PREFIX, tags=["clientes"])
app.include_router(pivos.router, prefix=settings.API_PREFIX, tags=["pivos"])
app.include_router(alerts.router, prefix=settings.API_PREFIX, tags=["alerts"])
app.include_router(commands.router, prefix=settings.API_PREFIX, tags=["commands"])


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level=settings.LOG_LEVEL.lower(),
        reload=settings.DEBUG,
        reload_dirs=["app"] if settings.DEBUG else None,
    )
