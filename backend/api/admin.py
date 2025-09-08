"""
Rotas administrativas
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_database_session
from models.schemas import UserResponse, UserCreate, UserUpdate, LogResponse, MessageResponse
from models.user import User
from services.user_service import UserService
from services.log_service import LogService
from api.auth import get_current_admin_user


router = APIRouter(prefix="/admin", tags=["administração"])


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_database_session)
):
    """Lista todos os usuários (apenas admin)"""
    users = UserService.get_users(db, skip=skip, limit=limit)
    
    # Log da ação
    await LogService.create_log(
        db,
        action="list_users",
        details=f"Listagem de usuários (skip={skip}, limit={limit})",
        user_id=current_user.id
    )
    
    return users


@router.post("/users", response_model=UserResponse)
async def create_user(
    user: UserCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_database_session)
):
    """Cria novo usuário (apenas admin)"""
    try:
        new_user = UserService.create_user(db, user)
        
        # Log da criação
        await LogService.create_log(
            db,
            action="create_user",
            details=f"Usuário '{new_user.username}' criado com role '{new_user.role}'",
            user_id=current_user.id
        )
        
        return new_user
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_database_session)
):
    """Busca usuário por ID (apenas admin)"""
    user = UserService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_database_session)
):
    """Atualiza usuário (apenas admin)"""
    try:
        updated_user = UserService.update_user(db, user_id, user_update)
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado"
            )
        
        # Log da atualização
        await LogService.create_log(
            db,
            action="update_user",
            details=f"Usuário '{updated_user.username}' (ID: {user_id}) atualizado",
            user_id=current_user.id
        )
        
        return updated_user
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_database_session)
):
    """Desativa usuário (apenas admin)"""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível desativar seu próprio usuário"
        )
    
    user_to_delete = UserService.get_user_by_id(db, user_id)
    if not user_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    if UserService.delete_user(db, user_id):
        # Log da desativação
        await LogService.create_log(
            db,
            action="delete_user",
            details=f"Usuário '{user_to_delete.username}' (ID: {user_id}) desativado",
            user_id=current_user.id
        )
        
        return {"message": "Usuário desativado com sucesso"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Erro ao desativar usuário"
        )


@router.get("/logs", response_model=List[LogResponse])
async def list_logs(
    skip: int = 0,
    limit: int = 100,
    user_id: int = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_database_session)
):
    """Lista logs do sistema (apenas admin)"""
    logs = LogService.get_logs(db, skip=skip, limit=limit, user_id=user_id)
    
    # Log da consulta
    await LogService.create_log(
        db,
        action="list_logs",
        details=f"Consulta de logs (skip={skip}, limit={limit}, user_id={user_id})",
        user_id=current_user.id
    )
    
    return logs