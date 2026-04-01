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
import sys
from app.workers.mqtt_listener import start_mqtt_background, stop_mqtt_background
from app.workers.command_processor import (
    start_command_background,
    stop_command_background,
)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import get_db, close_db
from app.api.routes import auth, admins, revendas, clientes, pivos, alerts, commands, webhooks
from app.services.setup_indexes import setup_indexes
from app.services.zapi_voice_retry import (
    configure_zapi_webhook_if_enabled,
    resume_scheduled_voice_retries,
    start_voice_retry_reconciler,
)


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

    if settings.START_PARSED_WORKER_IN_API:
        print("🚀 Iniciando background MQTT Listener legado...")
        if not start_mqtt_background():
            print("⚠️  MQTT Listener não pôde ser iniciado. API rodando sem MQTT.")
            # TODO: reverter para fatal antes do deploy:
            # raise RuntimeError("ERRO FATAL: O listener MQTT não pôde ser iniciado.")
        else:
            print("✅ Background MQTT Listener iniciado com sucesso!")
    else:
        print("ℹ️  Background MQTT Listener desabilitado na API (service dedicado esperado).")

    if settings.START_COMMAND_WORKER_IN_API:
        print("🚀 Iniciando background Command Processor legado...")
        if not start_command_background():
            print("⚠️  Command Processor não pôde ser iniciado. API rodando sem bridge de comandos.")
        else:
            print("✅ Background Command Processor iniciado com sucesso!")
    else:
        print("ℹ️  Background Command Processor desabilitado na API (service dedicado esperado).")

    resumed_voice_retries = resume_scheduled_voice_retries()
    if resumed_voice_retries:
        print(f"✅ Retries de ligação retomados: {resumed_voice_retries}")

    if start_voice_retry_reconciler():
        print("✅ Reconciliador de retries de ligação iniciado")

    if configure_zapi_webhook_if_enabled():
        print("✅ Webhook da Z-API configurado/atualizado")

    yield

    print("🛑 Desligando serviços...")

    if settings.START_PARSED_WORKER_IN_API:
        stop_mqtt_background()
    if settings.START_COMMAND_WORKER_IN_API:
        stop_command_background()

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
app.include_router(webhooks.router, prefix=settings.API_PREFIX)


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
