#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lindsay API - FastAPI
Sistema Multi-Nível: Admin → Revenda → Cliente → Pivôs

Endpoints:
- POST /api/auth/register - Registrar novo usuário
- POST /api/auth/login - Login
- GET /api/auth/me - Dados do usuário atual
- GET /api/revendas - Listar revendas (admin)
- POST /api/revendas/{email}/approve - Aprovar revenda (admin)
- GET /api/clientes - Listar clientes
- POST /api/clientes/{email}/approve - Aprovar cliente (revenda)
- GET /api/pivos - Listar pivôs (filtrado por role)
- POST /api/pivos - Criar pivô (cliente)
- GET /api/pivos/{pivo_id} - Get pivô específico
- PUT /api/pivos/{pivo_id} - Atualizar pivô
- DELETE /api/pivos/{pivo_id} - Deletar pivô (admin)

Uso:
    python main.py
    # Acesse: http://localhost:8000/docs
"""

import os
from typing import List, Optional
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import couchdb
from dotenv import load_dotenv

# Importar serviços
from auth_service import AuthService
from permissions import PermissionChecker, Role
from pivo_service import PivoService, PivoModel

# ============================================================================
# Setup
# ============================================================================
load_dotenv()

COUCHDB_URL = os.getenv("COUCHDB_URL", "http://localhost:5984")
DATABASE = os.getenv("COUCHDB_DB", "lindsay-data")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-key-change-in-prod")

BR_TZ = ZoneInfo("America/Sao_Paulo")

# Inicializar FastAPI
app = FastAPI(
    title="Lindsay API",
    description="Sistema de Gerenciamento Hierárquico de Pivôs",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conectar ao CouchDB
try:
    server = couchdb.Server(COUCHDB_URL)
    db = server[DATABASE]
    print(f"✅ Conectado ao CouchDB: {DATABASE}")
except Exception as e:
    print(f"❌ Erro ao conectar ao CouchDB: {e}")
    db = None

# Inicializar serviços
auth_service = AuthService(db) if db else None
pivo_service = PivoService(db) if db else None

# ============================================================================
# Modelos Pydantic
# ============================================================================

class UserRegisterRequest(BaseModel):
    """Requisição de registro"""
    email: EmailStr
    password: str
    name: str
    type: str  # "admin", "revenda", "cliente"
    domain: Optional[str] = None  # Para revendas

class UserLoginRequest(BaseModel):
    """Requisição de login"""
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    """Resposta com dados do usuário"""
    email: str
    name: str
    type: str
    status: str
    doc_id: Optional[str] = None

class ApprovalRequest(BaseModel):
    """Requisição de aprovação"""
    email: str

class CreatePivoRequest(BaseModel):
    """Requisição para criar pivô"""
    codigo: str
    nome: str
    location: Optional[dict] = None

class UpdatePivoRequest(BaseModel):
    """Requisição para atualizar pivô"""
    nome: Optional[str] = None
    ativo: Optional[bool] = None
    location: Optional[dict] = None

class PivoResponse(BaseModel):
    """Resposta com dados do pivô"""
    _id: str
    codigo: str
    nome: str
    owner_id: str
    gerente_id: str
    ativo: bool
    created_at: str

# ============================================================================
# Dependências
# ============================================================================

def get_current_user(credentials: Optional[HTTPAuthCredentials] = Depends(HTTPBearer(auto_error=False))) -> dict:
    """Obter usuário atual do token"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais não fornecidas"
        )

    # Em produção, validar JWT aqui
    # Por enquanto, simular baseado no token
    token = credentials.credentials

    # Simular extração do usuário do token
    # Format: "email:type" em base64
    try:
        import base64
        decoded = base64.b64decode(token).decode()
        email, user_type = decoded.split(":")

        # Buscar usuário no CouchDB
        try:
            user_doc = db[f"user:{email}"]
            return {
                "email": user_doc.get("email"),
                "type": user_doc.get("type"),
                "status": user_doc.get("status"),
                "name": user_doc.get("name"),
                "doc_id": user_doc.get("_id"),
                "gerente_id": user_doc.get("gerente_id")
            }
        except:
            # User não encontrado
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário não encontrado"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido: {str(e)}"
        )

# ============================================================================
# ROTAS: Health Check
# ============================================================================

@app.get("/health")
def health_check():
    """Verificar saúde da API"""
    return {
        "status": "ok",
        "database": "connected" if db else "disconnected",
        "timestamp": datetime.now(tz=BR_TZ).isoformat()
    }

# ============================================================================
# ROTAS: Autenticação
# ============================================================================

@app.post("/api/auth/register", response_model=UserResponse)
def register(request: UserRegisterRequest):
    """Registrar novo usuário"""
    if not auth_service:
        raise HTTPException(status_code=500, detail="Serviço de autenticação indisponível")

    try:
        if request.type == "admin":
            user = auth_service.register_admin(
                email=request.email,
                password=request.password,
                name=request.name
            )
        elif request.type == "revenda":
            user = auth_service.register_revenda(
                email=request.email,
                password=request.password,
                name=request.name,
                domain=request.domain or request.email.split("@")[1]
            )
        elif request.type == "cliente":
            user = auth_service.register_cliente(
                email=request.email,
                password=request.password,
                name=request.name,
                revenda_id=request.domain  # Domain contém revenda_id
            )
        else:
            raise ValueError(f"Tipo de usuário inválido: {request.type}")

        return UserResponse(
            email=user["email"],
            name=user["name"],
            type=user["type"],
            status=user["status"],
            doc_id=user.get("_id")
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/login")
def login(request: UserLoginRequest):
    """Fazer login"""
    if not auth_service:
        raise HTTPException(status_code=500, detail="Serviço de autenticação indisponível")

    try:
        user = auth_service.authenticate(request.email, request.password)
        if not user:
            raise HTTPException(status_code=401, detail="Email ou senha inválidos")

        # Gerar token (simples para desenvolvimento)
        import base64
        token = base64.b64encode(f"{user['email']}:{user['type']}".encode()).decode()

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "email": user["email"],
                "name": user["name"],
                "type": user["type"],
                "status": user["status"],
                "doc_id": user.get("_id")
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/auth/me", response_model=UserResponse)
def get_current_user_info(user: dict = Depends(get_current_user)):
    """Obter dados do usuário atual"""
    return UserResponse(
        email=user["email"],
        name=user["name"],
        type=user["type"],
        status=user["status"],
        doc_id=user.get("doc_id")
    )

# ============================================================================
# ROTAS: Revendas (Admin)
# ============================================================================

@app.get("/api/revendas")
def list_revendas(user: dict = Depends(get_current_user)):
    """Listar revendas (admin only)"""
    checker = PermissionChecker(user)
    if not checker.can_manage_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    try:
        result = db.view("_design/app/_view/all_revendas")
        revendas = [
            {
                "email": row.value.get("email"),
                "name": row.value.get("name"),
                "status": row.value.get("status"),
                "created_at": row.value.get("created_at")
            }
            for row in result
        ]
        return {"total": len(revendas), "revendas": revendas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/revendas/pending")
def get_pending_revendas(user: dict = Depends(get_current_user)):
    """Listar revendas pendentes de aprovação (admin only)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    try:
        pending = auth_service.get_pending_revendas()
        return {"total": len(pending), "revendas": pending}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/revendas/{email}/approve")
def approve_revenda(email: str, user: dict = Depends(get_current_user)):
    """Aprovar revenda (admin only)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    try:
        revenda = auth_service.approve_revenda(email)
        return {"status": "approved", "revenda": revenda}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/revendas/{email}/reject")
def reject_revenda(email: str, user: dict = Depends(get_current_user)):
    """Rejeitar revenda (admin only)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    try:
        revenda = auth_service.reject_revenda(email)
        return {"status": "rejected", "revenda": revenda}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================================
# ROTAS: Clientes (Revenda)
# ============================================================================

@app.get("/api/clientes")
def list_clientes(user: dict = Depends(get_current_user)):
    """Listar clientes"""
    checker = PermissionChecker(user)
    if not checker.can_view_clientes():
        raise HTTPException(status_code=403, detail="Acesso negado")

    try:
        clientes = auth_service.get_revenda_clientes(user["email"])
        return {"total": len(clientes), "clientes": clientes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clientes/pending")
def get_pending_clientes(user: dict = Depends(get_current_user)):
    """Listar clientes pendentes de aprovação (revenda only)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_clientes():
        raise HTTPException(status_code=403, detail="Acesso negado")

    try:
        pending = auth_service.get_pending_clientes(user["email"])
        return {"total": len(pending), "clientes": pending}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clientes/{email}/approve")
def approve_cliente(email: str, user: dict = Depends(get_current_user)):
    """Aprovar cliente (revenda only)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_clientes():
        raise HTTPException(status_code=403, detail="Acesso negado")

    try:
        cliente = auth_service.approve_cliente(email, user["email"])
        return {"status": "approved", "cliente": cliente}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/clientes/{email}/reject")
def reject_cliente(email: str, user: dict = Depends(get_current_user)):
    """Rejeitar cliente (revenda only)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_clientes():
        raise HTTPException(status_code=403, detail="Acesso negado")

    try:
        cliente = auth_service.reject_cliente(email, user["email"])
        return {"status": "rejected", "cliente": cliente}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================================
# ROTAS: Pivôs (FASE 2)
# ============================================================================

@app.get("/api/pivos")
def list_pivos(user: dict = Depends(get_current_user)):
    """Listar pivôs (filtrado por role)"""
    checker = PermissionChecker(user)

    try:
        pivos = pivo_service.list_pivos(user, checker)
        return {
            "total": len(pivos),
            "role": user["type"],
            "pivos": pivos
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pivos", response_model=dict)
def create_pivo(
    request: CreatePivoRequest,
    user: dict = Depends(get_current_user)
):
    """Criar novo pivô (cliente only)"""
    checker = PermissionChecker(user)

    try:
        pivo = pivo_service.create_pivo(
            user=user,
            pivo_data={
                "codigo": request.codigo,
                "nome": request.nome,
                "owner_id": user["email"],
                "gerente_id": user.get("gerente_id", ""),
                "ativo": True,
                "location": request.location
            },
            checker=checker
        )
        return {"status": "created", "pivo": pivo}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/pivos/{pivo_id}")
def get_pivo(pivo_id: str, user: dict = Depends(get_current_user)):
    """Obter pivô específico"""
    checker = PermissionChecker(user)

    try:
        pivo = pivo_service.get_pivo(user, pivo_id, checker)
        return {"pivo": pivo}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Acesso negado")
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.put("/api/pivos/{pivo_id}")
def update_pivo(
    pivo_id: str,
    request: UpdatePivoRequest,
    user: dict = Depends(get_current_user)
):
    """Atualizar pivô"""
    checker = PermissionChecker(user)

    try:
        pivo_data = {}
        if request.nome:
            pivo_data["nome"] = request.nome
        if request.ativo is not None:
            pivo_data["ativo"] = request.ativo
        if request.location:
            pivo_data["location"] = request.location

        pivo = pivo_service.update_pivo(user, pivo_id, pivo_data, checker)
        return {"status": "updated", "pivo": pivo}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Acesso negado")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/pivos/{pivo_id}")
def delete_pivo(pivo_id: str, user: dict = Depends(get_current_user)):
    """Deletar pivô (admin only)"""
    checker = PermissionChecker(user)

    try:
        success = pivo_service.delete_pivo(user, pivo_id, checker)
        return {"status": "deleted" if success else "error"}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Acesso negado")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/pivos-stats")
def get_pivos_stats(user: dict = Depends(get_current_user)):
    """Obter estatísticas de pivôs"""
    checker = PermissionChecker(user)

    try:
        stats = pivo_service.get_pivos_stats(user, checker)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    print("""
    ╔════════════════════════════════════════════╗
    ║        Lindsay API - FastAPI v2.0          ║
    ║  Sistema Multi-Nível: Admin → Revenda → Cliente → Pivôs  ║
    ╚════════════════════════════════════════════╝
    """)

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=True  # Hot reload em desenvolvimento
    )
