"""
Serviço de usuários
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from models.user import User
from models.schemas import UserCreate, UserUpdate
from core.security import hash_senha


class UserService:
    """Serviço para operações com usuários"""
    
    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
        """Busca usuário por ID"""
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        """Busca usuário por username"""
        return db.query(User).filter(User.username == username).first()
    
    @staticmethod
    def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
        """Lista usuários com paginação"""
        return db.query(User).offset(skip).limit(limit).all()
    
    @staticmethod
    def create_user(db: Session, user: UserCreate) -> User:
        """Cria novo usuário"""
        # Verificar se usuário já existe
        if UserService.get_user_by_username(db, user.username):
            raise ValueError("Usuário já existe")
        
        # Hash da senha
        hashed_password = hash_senha(user.password)
        
        # Criar usuário
        db_user = User(
            username=user.username,
            password_hash=hashed_password,
            role=user.role
        )
        
        try:
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            return db_user
        except IntegrityError:
            db.rollback()
            raise ValueError("Erro ao criar usuário: username já existe")
    
    @staticmethod
    def update_user(db: Session, user_id: int, user_update: UserUpdate) -> Optional[User]:
        """Atualiza usuário"""
        db_user = UserService.get_user_by_id(db, user_id)
        if not db_user:
            return None
        
        update_data = user_update.model_dump(exclude_unset=True)
        
        # Hash da nova senha se fornecida
        if "password" in update_data:
            update_data["password_hash"] = hash_senha(update_data.pop("password"))
        
        for field, value in update_data.items():
            setattr(db_user, field, value)
        
        try:
            db.commit()
            db.refresh(db_user)
            return db_user
        except IntegrityError:
            db.rollback()
            raise ValueError("Erro ao atualizar usuário")
    
    @staticmethod
    def delete_user(db: Session, user_id: int) -> bool:
        """Desativa usuário (soft delete)"""
        db_user = UserService.get_user_by_id(db, user_id)
        if not db_user:
            return False
        
        db_user.active = False
        db.commit()
        return True
    
    @staticmethod
    def create_admin_user(db: Session) -> User:
        """Cria usuário administrador padrão se não existir"""
        admin_user = UserService.get_user_by_username(db, "admin")
        if admin_user:
            return admin_user
        
        admin_data = UserCreate(
            username="admin",
            password="admin",
            role="admin"
        )
        
        return UserService.create_user(db, admin_data)