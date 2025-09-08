"""
Modelo de calibração
"""
from sqlalchemy import Column, Integer, String, Float, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.database import Base


class Calibration(Base):
    """Modelo de configurações de calibração por usuário"""
    __tablename__ = "calibrations"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    grid_size_mm = Column(Float, nullable=False)  # Tamanho do quadriculado em mm
    camera_settings = Column(JSON)  # Configurações da câmera
    audio_settings = Column(JSON)   # Configurações do áudio
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relacionamento com User
    user = relationship("User", back_populates="calibrations")
    
    def __repr__(self):
        return f"<Calibration(user_id={self.user_id}, grid_size={self.grid_size_mm}mm)>"


# Adicionar relacionamento ao modelo User
from models.user import User
User.calibrations = relationship("Calibration", back_populates="user")