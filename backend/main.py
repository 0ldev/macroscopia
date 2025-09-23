"""
Aplicação principal FastAPI - Sistema de Macroscopia
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from core.config import settings
from core.database import database, connect_db, disconnect_db, create_tables, SessionLocal
from api.auth import router as auth_router
from api.admin import router as admin_router
from api.calibration import router as calibration_router
from api.vision import router as vision_router
from api.ai import router as ai_router
from api.analysis import router as analysis_router
from api.websocket import router as websocket_router
from api.monitoring import router as monitoring_router
from services.user_service import UserService
from services.log_service import LogService


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerenciamento do ciclo de vida da aplicação"""
    # Startup
    await connect_db()
    create_tables()
    
    # Criar usuário admin padrão se não existir
    db = SessionLocal()
    try:
        admin_user = UserService.create_admin_user(db)
        await LogService.create_log(
            db,
            action="system_startup",
            details=f"Sistema iniciado. Usuário admin: {admin_user.username}"
        )
    except Exception as e:
        print(f"Erro ao criar usuário admin: {e}")
    finally:
        db.close()
    
    # Criar diretórios necessários
    os.makedirs(settings.upload_path, exist_ok=True)
    os.makedirs(settings.backup_path, exist_ok=True) 
    os.makedirs(settings.log_path, exist_ok=True)
    os.makedirs("database", exist_ok=True)
    
    print(f"🚀 Sistema de Macroscopia iniciado!")
    print(f"📊 Swagger UI: http://{settings.host}:{settings.port}/docs")
    print(f"👤 Login padrão: admin / admin")
    
    yield
    
    # Shutdown
    await disconnect_db()
    print("Sistema encerrado!")


# Criar aplicação FastAPI
app = FastAPI(
    title="Sistema de Macroscopia",
    description="""
    ## Sistema de Macroscopia Biomédica
    
    Plataforma que combina visão computacional para medição de biópsias 
    com preenchimento automático de formulários via IA.
    
    ### Funcionalidades Principais:
    - 🔐 **Autenticação** com níveis hierárquicos (admin/usuário)
    - 📷 **Visão computacional** para medição de amostras
    - 🎤 **Transcrição de áudio** em tempo real
    - 🤖 **IA** para preenchimento automático de formulários
    - 📝 **Relatórios** estruturados de análise
    - 👥 **Gestão de usuários** (apenas admins)
    - 📊 **Logs de auditoria** do sistema
    
    ### Credenciais Padrão:
    - **Usuário:** admin
    - **Senha:** admin
    """,
    version="1.0.0",
    contact={
        "name": "Sistema de Macroscopia",
        "email": "suporte@macroscopia.com"
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://0.0.0.0:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rotas
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(calibration_router)
app.include_router(vision_router)
app.include_router(ai_router)
app.include_router(analysis_router)
app.include_router(websocket_router)
app.include_router(monitoring_router)

# Servir uploads
if os.path.exists(settings.upload_path):
    app.mount("/uploads", StaticFiles(directory=settings.upload_path), name="uploads")

# Servir frontend build (React) se existir
FRONTEND_BUILD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'build')
if os.path.exists(FRONTEND_BUILD_DIR):
    # Arquivos estáticos (CSS/JS)
    static_dir = os.path.join(FRONTEND_BUILD_DIR, 'static')
    if os.path.exists(static_dir):
        app.mount('/static', StaticFiles(directory=static_dir), name='static')
else:
    print("⚠️  Frontend build não encontrado. Execute 'npm install && npm run build' em ./frontend")


@app.get('/', include_in_schema=False)
async def serve_frontend_root():
    """Serve index.html do frontend ou fallback JSON"""
    index_path = os.path.join(FRONTEND_BUILD_DIR, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type='text/html')
    return JSONResponse({
        "message": "Frontend build não encontrado",
        "hint": "Execute 'npm install && npm run build' no diretório frontend",
        "api_docs": "/docs"
    })

@app.get("/api", tags=["sistema"])
async def api_root():
    return {
        "message": "Sistema de Macroscopia - API",
        "version": "1.0.0",
        "status": "ativo",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["sistema"])
async def health_check():
    """Endpoint de verificação de saúde do sistema"""
    try:
        # Testar conexão com banco de dados
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": "2024-01-01T00:00:00Z"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Sistema indisponível: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower()
    )