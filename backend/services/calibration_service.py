"""
Serviço de calibração
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from models.calibration import Calibration
from models.schemas import CalibrationCreate, CalibrationUpdate


class CalibrationService:
    """Serviço para operações com calibrações"""
    
    @staticmethod
    def get_calibration_by_id(db: Session, calibration_id: int) -> Optional[Calibration]:
        """Busca calibração por ID"""
        return db.query(Calibration).filter(Calibration.id == calibration_id).first()
    
    @staticmethod
    def get_user_calibrations(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[Calibration]:
        """Lista calibrações de um usuário específico"""
        return (
            db.query(Calibration)
            .filter(Calibration.user_id == user_id)
            .order_by(Calibration.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    @staticmethod
    def get_latest_calibration(db: Session, user_id: int) -> Optional[Calibration]:
        """Obtém a calibração mais recente de um usuário"""
        return (
            db.query(Calibration)
            .filter(Calibration.user_id == user_id)
            .order_by(Calibration.created_at.desc())
            .first()
        )
    
    @staticmethod
    def create_calibration(db: Session, calibration: CalibrationCreate, user_id: int) -> Calibration:
        """Cria nova calibração"""
        
        # Validar dados de entrada
        if calibration.grid_size_mm <= 0:
            raise ValueError("Tamanho da grade deve ser maior que zero")
        
        if calibration.grid_size_mm > 50:  # Limite máximo razoável
            raise ValueError("Tamanho da grade muito grande (máximo 50mm)")
        
        # Criar calibração
        db_calibration = Calibration(
            user_id=user_id,
            grid_size_mm=calibration.grid_size_mm,
            camera_settings=calibration.camera_settings,
            audio_settings=calibration.audio_settings
        )
        
        try:
            db.add(db_calibration)
            db.commit()
            db.refresh(db_calibration)
            return db_calibration
        except IntegrityError:
            db.rollback()
            raise ValueError("Erro ao criar calibração")
    
    @staticmethod
    def update_calibration(
        db: Session, 
        calibration_id: int, 
        calibration_update: CalibrationUpdate
    ) -> Optional[Calibration]:
        """Atualiza calibração existente"""
        
        db_calibration = CalibrationService.get_calibration_by_id(db, calibration_id)
        if not db_calibration:
            return None
        
        update_data = calibration_update.model_dump(exclude_unset=True)
        
        # Validar grid_size_mm se estiver sendo atualizado
        if "grid_size_mm" in update_data:
            if update_data["grid_size_mm"] <= 0:
                raise ValueError("Tamanho da grade deve ser maior que zero")
            if update_data["grid_size_mm"] > 50:
                raise ValueError("Tamanho da grade muito grande (máximo 50mm)")
        
        # Atualizar campos
        for field, value in update_data.items():
            setattr(db_calibration, field, value)
        
        try:
            db.commit()
            db.refresh(db_calibration)
            return db_calibration
        except IntegrityError:
            db.rollback()
            raise ValueError("Erro ao atualizar calibração")
    
    @staticmethod
    def delete_calibration(db: Session, calibration_id: int) -> bool:
        """Remove calibração"""
        db_calibration = CalibrationService.get_calibration_by_id(db, calibration_id)
        if not db_calibration:
            return False
        
        try:
            db.delete(db_calibration)
            db.commit()
            return True
        except IntegrityError:
            db.rollback()
            return False
    
    @staticmethod
    def get_default_camera_settings() -> dict:
        """Retorna configurações padrão da câmera"""
        return {
            "resolution": {"width": 1920, "height": 1080},
            "fps": 30,
            "brightness": 50,
            "contrast": 50,
            "saturation": 50,
            "auto_focus": True,
            "auto_white_balance": True
        }
    
    @staticmethod
    def get_default_audio_settings() -> dict:
        """Retorna configurações padrão do áudio"""
        return {
            "sample_rate": 44100,
            "channels": 1,
            "bit_depth": 16,
            "buffer_size": 1024,
            "input_device": -1,  # -1 para dispositivo padrão
            "noise_suppression": True,
            "auto_gain": True,
            "volume": 75
        }
    
    @staticmethod
    def validate_camera_settings(settings: dict) -> bool:
        """Valida configurações da câmera"""
        required_fields = ["resolution", "fps", "brightness", "contrast", "saturation"]
        
        for field in required_fields:
            if field not in settings:
                return False
        
        # Validar resolução
        resolution = settings.get("resolution", {})
        if not isinstance(resolution, dict) or "width" not in resolution or "height" not in resolution:
            return False
        
        # Validar valores numéricos
        if not (1 <= settings.get("fps", 0) <= 120):
            return False
        
        if not (0 <= settings.get("brightness", -1) <= 100):
            return False
        
        if not (0 <= settings.get("contrast", -1) <= 100):
            return False
        
        if not (0 <= settings.get("saturation", -1) <= 100):
            return False
        
        return True
    
    @staticmethod
    def validate_audio_settings(settings: dict) -> bool:
        """Valida configurações do áudio"""
        required_fields = ["sample_rate", "channels", "bit_depth", "buffer_size"]
        
        for field in required_fields:
            if field not in settings:
                return False
        
        # Validar valores
        valid_sample_rates = [8000, 16000, 22050, 44100, 48000, 96000]
        if settings.get("sample_rate") not in valid_sample_rates:
            return False
        
        if not (1 <= settings.get("channels", 0) <= 2):
            return False
        
        valid_bit_depths = [8, 16, 24, 32]
        if settings.get("bit_depth") not in valid_bit_depths:
            return False
        
        if not (64 <= settings.get("buffer_size", 0) <= 8192):
            return False
        
        return True