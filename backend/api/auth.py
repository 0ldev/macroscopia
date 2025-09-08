"""
Rotas de autenticação
"""
from datetime import datetime, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from core.database import get_database_session
from core.security import hash_senha, verificar_senha, criar_token_acesso, verificar_token
from models.schemas import UserResponse, TokenResponse, LoginRequest
from models.user import User
from services.user_service import UserService
from services.log_service import LogService


router = APIRouter(prefix="/auth", tags=["autenticação"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)], 
    db: Session = Depends(get_database_session)
) -> User:
    """Obtém o usuário atual baseado no token"""
    payload = verificar_token(token)
    username: str = payload.get("sub")
    
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
    payload = verificar_token(token)
    username: str = payload.get("sub")
    
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
    """Endpoint de login"""
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
    
    # Atualizar último login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Criar token
    access_token_expires = timedelta(minutes=1440)  # 24 horas
    access_token = criar_token_acesso(
        data={"sub": user.username}, 
        expires_delta=access_token_expires
    )
    
    # Log do login bem-sucedido
    await LogService.create_log(
        db,
        action="login_success",
        details=f"Login bem-sucedido",
        user_id=user.id
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Obtém informações do usuário atual"""
    return current_user


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(current_user: User = Depends(get_current_user)):
    """Renova o token de acesso"""
    access_token_expires = timedelta(minutes=1440)
    access_token = criar_token_acesso(
        data={"sub": current_user.username}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}