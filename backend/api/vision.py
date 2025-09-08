"""
Rotas da API de visão computacional
"""
import cv2
import numpy as np
import base64
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from core.database import get_database_session
from models.schemas import MessageResponse
from models.user import User
from services.vision_service import VisionService
from services.calibration_service import CalibrationService
from services.log_service import LogService
from api.auth import get_current_user
import io
from PIL import Image


router = APIRouter(prefix="/vision", tags=["visão computacional"])


@router.post("/analyze-image")
async def analyze_image(
    image_file: UploadFile = File(...),
    grid_size_mm: float = 5.0,
    use_calibration: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Análise completa de imagem de biópsia"""
    try:
        # Validar formato do arquivo
        if not image_file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Arquivo deve ser uma imagem"
            )
        
        # Ler imagem
        contents = await image_file.read()
        
        # Converter para array numpy
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível decodificar a imagem"
            )
        
        # Obter dados de calibração se solicitado
        calibration_data = None
        if use_calibration:
            calibration = CalibrationService.get_latest_calibration(db, current_user.id)
            if calibration and calibration.camera_settings:
                # Extrair pixels_per_mm da calibração se disponível
                camera_settings = calibration.camera_settings
                if isinstance(camera_settings, dict) and 'pixels_per_mm' in camera_settings:
                    calibration_data = {
                        'pixels_per_mm': camera_settings['pixels_per_mm']
                    }
        
        # Executar análise completa
        result = VisionService.analyze_biopsy_complete(
            image, 
            grid_size_mm, 
            calibration_data
        )
        
        # Log da análise
        success_str = "sucesso" if result['success'] else "falha"
        await LogService.create_log(
            db,
            action="analyze_biopsy_image",
            details=f"Análise de imagem - {success_str} - {result.get('processing_time_ms', 0):.1f}ms",
            user_id=current_user.id
        )
        
        return result
        
    except Exception as e:
        await LogService.create_log(
            db,
            action="analyze_biopsy_image_error",
            details=f"Erro na análise: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro durante análise da imagem: {str(e)}"
        )


@router.post("/analyze-from-camera")
async def analyze_from_camera(
    camera_index: int = 0,
    grid_size_mm: float = 5.0,
    use_calibration: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Análise em tempo real da câmera"""
    try:
        # Capturar imagem da câmera
        cap = cv2.VideoCapture(camera_index)
        
        if not cap.isOpened():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Não foi possível abrir câmera {camera_index}"
            )
        
        # Capturar frame
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro ao capturar frame da câmera"
            )
        
        # Obter calibração do usuário
        calibration_data = None
        if use_calibration:
            calibration = CalibrationService.get_latest_calibration(db, current_user.id)
            if calibration:
                calibration_data = {
                    'pixels_per_mm': calibration.grid_size_mm,  # Usar como fallback
                    'grid_size_mm': calibration.grid_size_mm
                }
        
        # Executar análise
        result = VisionService.analyze_biopsy_complete(
            frame, 
            grid_size_mm, 
            calibration_data
        )
        
        # Log da análise
        success_str = "sucesso" if result['success'] else "falha"
        await LogService.create_log(
            db,
            action="analyze_biopsy_camera",
            details=f"Análise da câmera {camera_index} - {success_str}",
            user_id=current_user.id
        )
        
        return result
        
    except Exception as e:
        await LogService.create_log(
            db,
            action="analyze_biopsy_camera_error",
            details=f"Erro na análise da câmera: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro durante análise da câmera: {str(e)}"
        )


@router.post("/detect-grid-only")
async def detect_grid_only(
    image_file: UploadFile = File(...),
    grid_size_mm: float = 5.0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Detecta apenas a grade na imagem"""
    try:
        # Ler e processar imagem
        contents = await image_file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Imagem inválida"
            )
        
        # Detectar grade
        grid_result = VisionService.detect_grid_advanced(image, grid_size_mm)
        
        return {
            "status": "success",
            "grid_detection": grid_result,
            "image_info": {
                "width": image.shape[1],
                "height": image.shape[0],
                "channels": len(image.shape)
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro na detecção da grade: {str(e)}"
        )


@router.post("/segment-biopsy-only")
async def segment_biopsy_only(
    image_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Segmenta apenas a biópsia na imagem"""
    try:
        # Ler e processar imagem
        contents = await image_file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Imagem inválida"
            )
        
        # Segmentar biópsia
        segmentation_result = VisionService.segment_biopsy(image, {})
        
        # Se segmentação foi bem-sucedida, criar imagem com contorno
        overlay_base64 = None
        if segmentation_result['biopsy_detected'] and segmentation_result['contour'] is not None:
            overlay = image.copy()
            cv2.drawContours(overlay, [segmentation_result['contour']], -1, (0, 255, 0), 3)
            
            # Codificar em base64
            _, buffer = cv2.imencode('.jpg', overlay)
            overlay_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return {
            "status": "success",
            "segmentation": segmentation_result,
            "overlay_image": overlay_base64,
            "image_info": {
                "width": image.shape[1],
                "height": image.shape[0],
                "channels": len(image.shape)
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro na segmentação: {str(e)}"
        )


@router.post("/test-vision-pipeline")
async def test_vision_pipeline(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Testa o pipeline de visão computacional com imagem sintética"""
    try:
        # Criar imagem sintética para teste
        test_image = VisionService.create_synthetic_test_image()
        
        # Executar análise completa
        result = VisionService.analyze_biopsy_complete(test_image, 5.0)
        
        # Log do teste
        await LogService.create_log(
            db,
            action="test_vision_pipeline",
            details=f"Teste do pipeline - Sucesso: {result['success']}",
            user_id=current_user.id
        )
        
        return {
            "status": "success",
            "test_results": result,
            "message": "Pipeline de visão testado com imagem sintética"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro no teste do pipeline: {str(e)}"
        )


@router.get("/processing-methods")
async def get_processing_methods():
    """Lista métodos de processamento disponíveis"""
    return {
        "grid_detection_methods": [
            {
                "name": "hough",
                "description": "Hough Transform para detecção de linhas",
                "best_for": "Grades com linhas bem definidas"
            },
            {
                "name": "morphological", 
                "description": "Morfologia matemática",
                "best_for": "Grades com ruído ou linhas irregulares"
            },
            {
                "name": "frequency",
                "description": "Análise de frequência (FFT)",
                "best_for": "Grades com padrão periódico regular"
            }
        ],
        "segmentation_methods": [
            {
                "name": "watershed",
                "description": "Algoritmo Watershed",
                "best_for": "Objetos bem definidos com bordas claras"
            },
            {
                "name": "adaptive_threshold",
                "description": "Threshold adaptativo",
                "best_for": "Imagens com iluminação irregular"
            },
            {
                "name": "color_based",
                "description": "Segmentação por cor",
                "best_for": "Objetos com cor distinta do fundo"
            },
            {
                "name": "edge_based",
                "description": "Baseado em detecção de bordas",
                "best_for": "Objetos com contornos bem definidos"
            }
        ],
        "measurements_available": [
            "area_mm2", "perimeter_mm", "length_max_mm", "width_max_mm",
            "equivalent_diameter_mm", "circularity", "aspect_ratio",
            "solidity", "extent"
        ]
    }


@router.get("/calibration-status")
async def get_calibration_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Verifica status da calibração para visão computacional"""
    try:
        calibration = CalibrationService.get_latest_calibration(db, current_user.id)
        
        if not calibration:
            return {
                "status": "not_calibrated",
                "message": "Nenhuma calibração encontrada",
                "has_calibration": False
            }
        
        # Verificar se a calibração tem dados necessários para visão
        has_camera_settings = bool(calibration.camera_settings)
        has_grid_size = calibration.grid_size_mm > 0
        
        calibration_quality = "good" if (has_camera_settings and has_grid_size) else "basic"
        
        return {
            "status": "calibrated",
            "has_calibration": True,
            "calibration_id": calibration.id,
            "grid_size_mm": calibration.grid_size_mm,
            "quality": calibration_quality,
            "created_at": calibration.created_at.isoformat(),
            "features_available": {
                "grid_detection": has_grid_size,
                "camera_optimized": has_camera_settings,
                "automatic_measurement": has_grid_size
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao verificar calibração: {str(e)}"
        )