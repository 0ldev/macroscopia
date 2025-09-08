"""
Modelo de logs do sistema
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.database import Base


class Log(Base):
    """Modelo de logs de auditoria do sistema"""
    __tablename__ = "logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Pode ser null para logs do sistema
    action = Column(String(100), nullable=False)  # Ação realizada
    details = Column(Text)  # Detalhes da ação
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relacionamento com User
    user = relationship("User", back_populates="logs")
    
    def __repr__(self):
        return f"<Log(action='{self.action}', user_id={self.user_id})>"


# Adicionar relacionamento ao modelo User  
from models.user import User
User.logs = relationship("Log", back_populates="user")