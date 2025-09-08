"""
Rotas de autenticação simples para MVP
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from core.database import get_database_session
from core.security import hash_senha, verificar_senha, criar_sessao, verificar_sessao, invalidar_sessao
from models.schemas import UserResponse, TokenResponse
from models.user import User
from services.user_service import UserService
from services.log_service import LogService


router = APIRouter(prefix="/auth", tags=["autenticação"])


def get_current_user(
    authorization: str = Header(None), 
    db: Session = Depends(get_database_session)
) -> User:
    """Obtém o usuário atual baseado no token de sessão"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autorização necessário",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = authorization.replace("Bearer ", "")
    username = verificar_sessao(token)
    
    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou inativo",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Verifica se o usuário atual é administrador"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: requer privilégios de administrador"
        )
    return current_user


def get_current_user_from_token(token: str, db: Session) -> User:
    """Obtém o usuário atual baseado no token (para WebSocket)"""
    username = verificar_sessao(token)
    
    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou inativo",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_database_session)
):
    """Endpoint de login simples"""
    # Buscar usuário
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user or not user.active or not verificar_senha(form_data.password, user.password_hash):
        # Log da tentativa de login falhada
        await LogService.create_log(
            db, 
            action="login_failed", 
            details=f"Tentativa de login falhada para usuário: {form_data.username}"
        )
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Criar sessão simples
    session_token = criar_sessao(user.username)
    
    # Log do login bem-sucedido
    await LogService.create_log(
        db,
        action="login_success",
        details=f"Login bem-sucedido",
        user_id=user.id
    )
    
    return {"access_token": session_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Obtém informações do usuário atual"""
    return current_user


@router.post("/logout")
async def logout(
    authorization: str = Header(None),
    current_user: User = Depends(get_current_user)
):
    """Logout simples"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        invalidar_sessao(token)
    
    return {"message": "Logout realizado com sucesso"}