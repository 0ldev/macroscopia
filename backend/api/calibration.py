"""
Rotas de calibração do sistema
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_database_session
from models.schemas import CalibrationResponse, CalibrationCreate, CalibrationUpdate, MessageResponse
from models.user import User
from models.calibration import Calibration
from services.calibration_service import CalibrationService
from services.log_service import LogService
from api.auth import get_current_user


router = APIRouter(prefix="/calibration", tags=["calibração"])


@router.get("/", response_model=List[CalibrationResponse])
async def get_user_calibrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Obtém calibrações do usuário atual"""
    calibrations = CalibrationService.get_user_calibrations(db, current_user.id)
    
    # Log da consulta
    await LogService.create_log(
        db,
        action="get_calibrations",
        details="Consulta de calibrações do usuário",
        user_id=current_user.id
    )
    
    return calibrations


@router.get("/current", response_model=Optional[CalibrationResponse])
async def get_current_calibration(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Obtém a calibração mais recente do usuário"""
    calibration = CalibrationService.get_latest_calibration(db, current_user.id)
    
    if not calibration:
        return None
    
    return calibration


@router.post("/", response_model=CalibrationResponse)
async def create_calibration(
    calibration: CalibrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Cria nova calibração para o usuário"""
    try:
        new_calibration = CalibrationService.create_calibration(
            db, 
            calibration, 
            current_user.id
        )
        
        # Log da criação
        await LogService.create_log(
            db,
            action="create_calibration",
            details=f"Nova calibração criada - Grid: {calibration.grid_size_mm}mm",
            user_id=current_user.id
        )
        
        return new_calibration
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/current", response_model=CalibrationResponse)
async def update_current_calibration(
    updates: CalibrationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Atualiza a calibração mais recente do usuário"""
    current_calibration = CalibrationService.get_latest_calibration(db, current_user.id)
    
    if not current_calibration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma calibração encontrada. Crie uma calibração primeiro."
        )
    
    try:
        updated_calibration = CalibrationService.update_calibration(
            db, 
            current_calibration.id, 
            updates
        )
        
        # Log da atualização
        await LogService.create_log(
            db,
            action="update_calibration",
            details=f"Calibração atualizada - ID: {current_calibration.id}",
            user_id=current_user.id
        )
        
        return updated_calibration
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{calibration_id}", response_model=MessageResponse)
async def delete_calibration(
    calibration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Remove uma calibração específica"""
    calibration = CalibrationService.get_calibration_by_id(db, calibration_id)
    
    if not calibration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calibração não encontrada"
        )
    
    # Verificar se a calibração pertence ao usuário
    if calibration.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: esta calibração não pertence a você"
        )
    
    if CalibrationService.delete_calibration(db, calibration_id):
        # Log da exclusão
        await LogService.create_log(
            db,
            action="delete_calibration",
            details=f"Calibração removida - ID: {calibration_id}",
            user_id=current_user.id
        )
        
        return {"message": "Calibração removida com sucesso"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Erro ao remover calibração"
        )


@router.get("/cameras")
async def list_cameras(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Lista câmeras disponíveis no sistema"""
    try:
        from services.camera_service import CameraService
        
        cameras = CameraService.get_available_cameras()
        
        # Log da consulta
        await LogService.create_log(
            db,
            action="list_cameras",
            details=f"Listagem de câmeras - {len(cameras)} encontradas",
            user_id=current_user.id
        )
        
        return {
            "status": "success",
            "cameras": cameras,
            "count": len(cameras)
        }
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OpenCV não está instalado no servidor"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao listar câmeras: {str(e)}"
        )


@router.post("/test-camera")
async def test_camera(
    camera_index: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Testa uma câmera específica"""
    try:
        from services.camera_service import CameraService
        
        result = CameraService.test_camera(camera_index)
        
        # Log do teste
        await LogService.create_log(
            db,
            action="test_camera",
            details=f"Teste de câmera {camera_index} - {'Sucesso' if result['available'] else 'Falha'}",
            user_id=current_user.id
        )
        
        if result["available"]:
            return {
                "status": "success",
                "message": "Câmera funcionando corretamente",
                "camera_info": result
            }
        else:
            return {
                "status": "error",
                "message": result.get("error", "Câmera não disponível"),
                "camera_info": result
            }
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OpenCV não está instalado no servidor"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao testar câmera: {str(e)}"
        )


@router.get("/camera/{camera_index}/capabilities")
async def get_camera_capabilities(
    camera_index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Obtém as capacidades de uma câmera específica"""
    try:
        from services.camera_service import CameraService
        
        capabilities = CameraService.get_camera_capabilities(camera_index)
        
        return {
            "status": "success",
            "camera_index": camera_index,
            "capabilities": capabilities
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao obter capacidades da câmera: {str(e)}"
        )


@router.post("/capture-frame")
async def capture_frame(
    camera_index: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Captura um frame da câmera"""
    try:
        from services.camera_service import CameraService
        
        frame_data = CameraService.capture_frame(camera_index)
        
        if frame_data:
            return {
                "status": "success",
                "frame": frame_data
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro ao capturar frame da câmera"
            )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao capturar frame: {str(e)}"
        )


@router.get("/audio-devices")
async def list_audio_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Lista dispositivos de áudio disponíveis"""
    try:
        from services.audio_service import AudioService
        
        devices = AudioService.get_audio_devices()
        
        # Log da consulta
        await LogService.create_log(
            db,
            action="list_audio_devices",
            details=f"Listagem de dispositivos de áudio - {len(devices)} encontrados",
            user_id=current_user.id
        )
        
        return {
            "status": "success",
            "devices": devices,
            "count": len(devices)
        }
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PyAudio não está instalado no servidor"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao listar dispositivos de áudio: {str(e)}"
        )


@router.post("/test-microphone")
async def test_microphone(
    device_index: Optional[int] = None,
    duration: float = 1.0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Testa um microfone específico"""
    try:
        from services.audio_service import AudioService
        
        result = AudioService.test_microphone(device_index, duration)
        
        # Log do teste
        device_str = str(device_index) if device_index is not None else "padrão"
        await LogService.create_log(
            db,
            action="test_microphone",
            details=f"Teste de microfone {device_str} - {'Sucesso' if result['available'] else 'Falha'}",
            user_id=current_user.id
        )
        
        if result["available"]:
            return {
                "status": "success",
                "message": "Microfone funcionando corretamente",
                "microphone_info": result
            }
        else:
            return {
                "status": "error", 
                "message": result.get("error", "Microfone não disponível"),
                "microphone_info": result
            }
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PyAudio não está instalado no servidor"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao testar microfone: {str(e)}"
        )


@router.post("/test-audio-levels")
async def test_audio_levels(
    device_index: Optional[int] = None,
    duration: float = 3.0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Testa níveis de áudio em tempo real"""
    try:
        from services.audio_service import AudioService
        
        result = AudioService.test_audio_levels(device_index, duration)
        
        return {
            "status": "success" if result["success"] else "error",
            "audio_levels": result
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao testar níveis de áudio: {str(e)}"
        )


@router.post("/detect-silence-threshold")
async def detect_silence_threshold(
    device_index: Optional[int] = None,
    duration: float = 3.0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Detecta threshold de silêncio para um dispositivo"""
    try:
        from services.audio_service import AudioService
        
        result = AudioService.detect_silence_threshold(device_index, duration)
        
        return {
            "status": "success" if result["success"] else "error",
            "threshold_info": result
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao detectar threshold de silêncio: {str(e)}"
        )


@router.post("/detect-grid")
async def detect_grid(
    camera_index: int = 0,
    known_grid_size_mm: float = 5.0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Detecta automaticamente o papel quadriculado usando a câmera"""
    try:
        from services.camera_service import CameraService
        
        # Capturar frame da câmera
        frame_data = CameraService.capture_frame(camera_index)
        if not frame_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro ao capturar frame da câmera"
            )
        
        # Decodificar imagem base64
        import base64
        import cv2
        import numpy as np
        
        img_data = base64.b64decode(frame_data["image_base64"])
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Detectar grade
        grid_info = CameraService.detect_grid_lines(frame)
        
        # Estimar tamanho da grade se detectada
        size_info = {"estimated": False}
        if grid_info["grid_detected"]:
            size_info = CameraService.estimate_grid_size(frame, known_grid_size_mm)
        
        # Log da detecção
        await LogService.create_log(
            db,
            action="detect_grid",
            details=f"Detecção de grade na câmera {camera_index} - Grade detectada: {grid_info['grid_detected']}",
            user_id=current_user.id
        )
        
        return {
            "status": "success",
            "grid_detected": grid_info["grid_detected"],
            "grid_info": grid_info,
            "size_estimation": size_info,
            "camera_index": camera_index,
            "known_grid_size_mm": known_grid_size_mm
        }
        
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OpenCV não está instalado no servidor"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro na detecção de grade: {str(e)}"
        )


@router.post("/validate-settings")
async def validate_calibration_settings(
    camera_settings: Optional[dict] = None,
    audio_settings: Optional[dict] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Valida configurações de calibração"""
    try:
        from services.calibration_service import CalibrationService
        
        validation_results = {
            "camera_valid": True,
            "audio_valid": True,
            "camera_errors": [],
            "audio_errors": []
        }
        
        # Validar configurações da câmera se fornecidas
        if camera_settings:
            camera_valid = CalibrationService.validate_camera_settings(camera_settings)
            validation_results["camera_valid"] = camera_valid
            if not camera_valid:
                validation_results["camera_errors"].append("Configurações de câmera inválidas")
        
        # Validar configurações de áudio se fornecidas
        if audio_settings:
            from services.audio_service import AudioService
            audio_valid, error_msg = AudioService.validate_audio_settings(audio_settings)
            validation_results["audio_valid"] = audio_valid
            if not audio_valid:
                validation_results["audio_errors"].append(error_msg)
        
        overall_valid = validation_results["camera_valid"] and validation_results["audio_valid"]
        
        return {
            "status": "success",
            "valid": overall_valid,
            "validation_results": validation_results
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao validar configurações: {str(e)}"
        )


@router.get("/default-settings")
async def get_default_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Obtém configurações padrão para câmera e áudio"""
    try:
        from services.calibration_service import CalibrationService
        
        default_camera = CalibrationService.get_default_camera_settings()
        default_audio = CalibrationService.get_default_audio_settings()
        
        return {
            "status": "success",
            "default_settings": {
                "camera": default_camera,
                "audio": default_audio,
                "grid_size_mm": 5.0
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao obter configurações padrão: {str(e)}"
        )


@router.get("/system-status")
async def get_system_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Obtém o status atual do sistema de calibração para o dashboard"""
    try:
        # Obter a calibração mais recente do usuário
        current_calibration = CalibrationService.get_latest_calibration(db, current_user.id)
        
        status = {
            "camera": {
                "configured": False,
                "label": "Configurar"
            },
            "audio": {
                "configured": False,
                "label": "Configurar"
            },
            "grid": {
                "configured": False,
                "label": "Configurar"
            },
            "overall": {
                "configured": False,
                "ready": False
            }
        }
        
        if current_calibration:
            # Verificar se a câmera está configurada
            if current_calibration.camera_settings:
                status["camera"]["configured"] = True
                status["camera"]["label"] = "Configurado"
            
            # Verificar se o áudio está configurado
            if current_calibration.audio_settings:
                status["audio"]["configured"] = True
                status["audio"]["label"] = "Configurado"
            
            # Verificar se a grade está configurada
            if current_calibration.grid_size_mm:
                status["grid"]["configured"] = True
                status["grid"]["label"] = "Configurado"
            
            # Status geral
            all_configured = (
                status["camera"]["configured"] and 
                status["audio"]["configured"] and 
                status["grid"]["configured"]
            )
            
            status["overall"]["configured"] = all_configured
            status["overall"]["ready"] = all_configured
        
        return {
            "status": "success",
            "calibration_status": status,
            "last_updated": current_calibration.created_at.isoformat() if current_calibration else None
        }
        
    except Exception as e:
        from fastapi import status as http_status
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao obter status do sistema: {str(e)}"
        )