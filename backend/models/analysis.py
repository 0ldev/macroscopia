"""
Modelo de análise
"""
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.database import Base


class Analysis(Base):
    """Modelo de análises realizadas"""
    __tablename__ = "analyses"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sample_id = Column(String(100), nullable=False)  # ID da amostra
    image_path = Column(String(255))  # Caminho da imagem capturada
    measurements = Column(JSON)  # Dados das medições (visão computacional)
    transcription = Column(Text)  # Transcrição completa do áudio
    form_data = Column(JSON)  # Dados estruturados do formulário
    report = Column(Text)  # Relatório final gerado
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relacionamento com User
    user = relationship("User", back_populates="analyses")
    
    def __repr__(self):
        return f"<Analysis(sample_id='{self.sample_id}', user_id={self.user_id})>"


# Adicionar relacionamento ao modelo User
from models.user import User
User.analyses = relationship("Analysis", back_populates="user")