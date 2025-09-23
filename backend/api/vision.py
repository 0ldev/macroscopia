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
import traceback
from services.calibration_service import CalibrationService
from services.log_service import LogService
from api.auth import get_current_user
import io
from PIL import Image


router = APIRouter(prefix="/vision", tags=["visão computacional"])


@router.post("/analyze-image")
async def analyze_image(
    image_file: UploadFile = File(...),
    grid_size_mm: float = 10.0,
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
        
        # Executar análise completa com tratamento de erro
        try:
            result = VisionService.analyze_biopsy_complete(
                image,
                grid_size_mm,
                calibration_data
            )
        except ImportError as ie:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro de dependência no VisionService: {str(ie)}. Verifique se todas as dependências estão instaladas."
            )
        except AttributeError as ae:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro de método no VisionService: {str(ae)}. Método pode não existir."
            )
        
        # Log da análise
        success_str = "sucesso" if result['success'] else "falha"
        await LogService.create_log(
            db,
            action="analyze_biopsy_image",
            details=f"Análise de imagem - {success_str} - {result.get('processing_time_ms', 0):.1f}ms",
            user_id=current_user.id
        )

        # Verificar serialização antes de retornar
        try:
            import json
            json.dumps(result, default=str)  # Teste de serialização
        except Exception as e:
            print(f"Erro de serialização detectado: {e}")
            # Forçar conversão adicional se necessário
            from services.vision_service import convert_numpy_types
            result = convert_numpy_types(result)

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
    grid_size_mm: float = 10.0,
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
        
        # Executar análise com tratamento de erro
        try:
            result = VisionService.analyze_biopsy_complete(
                frame,
                grid_size_mm,
                calibration_data
            )
        except ImportError as ie:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro de dependência: {str(ie)}"
            )
        except Exception as ve:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro na análise: {str(ve)}"
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
    grid_size_mm: float = 10.0,
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
        
        # Detectar grade com tratamento de erro
        try:
            grid_result = VisionService.detect_grid_advanced(image, grid_size_mm)
        except Exception as ge:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro na detecção de grade: {str(ge)}"
            )
        
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
        
        # Segmentar biópsia com tratamento de erro
        try:
            segmentation_result = VisionService.segment_biopsy(image, {})
        except Exception as se:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro na segmentação: {str(se)}"
            )
        
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
        try:
            test_image = VisionService.create_synthetic_test_image()

            # Executar análise completa
            result = VisionService.analyze_biopsy_complete(test_image, 5.0)
        except Exception as te:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro no teste do pipeline: {str(te)}"
            )
        
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


@router.get("/health")
async def health_check():
    """Verifica se o serviço de visão está funcionando"""
    try:
        # Teste básico de importação
        import cv2
        import numpy as np

        # Criar imagem pequena de teste
        test_img = np.zeros((100, 100, 3), dtype=np.uint8)

        # Testar operação básica do OpenCV
        gray = cv2.cvtColor(test_img, cv2.COLOR_BGR2GRAY)

        return {
            "status": "healthy",
            "opencv_version": cv2.__version__,
            "services_available": {
                "vision_service": True,
                "opencv": True,
                "numpy": True
            },
            "message": "Serviço de visão funcionando corretamente"
        }

    except ImportError as e:
        return {
            "status": "error",
            "error": f"Dependência não encontrada: {str(e)}",
            "services_available": {
                "vision_service": False,
                "opencv": False,
                "numpy": False
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": "Erro no serviço de visão"
        }

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


@router.post("/debug-analyze")
async def debug_analyze(
    image_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Análise com debug detalhado para encontrar problemas"""
    debug_info = {
        "steps": [],
        "errors": [],
        "warnings": []
    }

    try:
        # Passo 1: Validação do arquivo
        debug_info["steps"].append("1. Validando arquivo de imagem")
        if not image_file.content_type.startswith('image/'):
            debug_info["errors"].append("Arquivo não é uma imagem")
            return {"status": "error", "debug": debug_info}

        # Passo 2: Leitura da imagem
        debug_info["steps"].append("2. Lendo arquivo de imagem")
        contents = await image_file.read()
        debug_info["image_size_bytes"] = len(contents)

        # Passo 3: Decodificação
        debug_info["steps"].append("3. Decodificando imagem")
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            debug_info["errors"].append("Falha na decodificação da imagem")
            return {"status": "error", "debug": debug_info}

        debug_info["image_shape"] = image.shape
        debug_info["steps"].append(f"4. Imagem decodificada: {image.shape}")

        # Passo 4: Teste básico de processamento
        debug_info["steps"].append("5. Testando processamento básico")
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            debug_info["opencv_working"] = True
        except Exception as e:
            debug_info["errors"].append(f"Erro no OpenCV: {str(e)}")
            debug_info["opencv_working"] = False
            return {"status": "error", "debug": debug_info}

        # Passo 5: Teste do VisionService
        debug_info["steps"].append("6. Testando VisionService")
        try:
            # Tentar apenas preprocessing primeiro
            processed = VisionService.preprocess_image(image)
            debug_info["preprocessing_working"] = True
            debug_info["preprocessing_keys"] = list(processed.keys())
        except Exception as e:
            debug_info["errors"].append(f"Erro no preprocessing: {str(e)}")
            debug_info["preprocessing_working"] = False

        # Passo 6: Teste de detecção de grade simples
        debug_info["steps"].append("7. Testando detecção de grade simples")
        try:
            edges = cv2.Canny(gray, 50, 150)
            lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)
            line_count = len(lines) if lines is not None else 0
            debug_info["basic_line_detection"] = {
                "lines_found": line_count,
                "working": True
            }
        except Exception as e:
            debug_info["errors"].append(f"Erro na detecção de linhas: {str(e)}")
            debug_info["basic_line_detection"] = {"working": False}

        # Passo 7: Teste de análise completa
        debug_info["steps"].append("8. Testando análise completa")
        try:
            result = VisionService.analyze_biopsy_complete(image, 10.0, None)
            debug_info["full_analysis_working"] = True
            debug_info["analysis_result"] = {
                "success": result.get("success", False),
                "grid_detected": result.get("grid_detection", {}).get("grid_detected", False),
                "confidence": result.get("confidence_overall", 0),
                "errors": result.get("errors", []),
                "warnings": result.get("warnings", [])
            }
        except Exception as e:
            debug_info["errors"].append(f"Erro na análise completa: {str(e)}")
            debug_info["full_analysis_working"] = False
            import traceback
            debug_info["traceback"] = traceback.format_exc()

        debug_info["steps"].append("9. Debug completo")

        return {
            "status": "success" if not debug_info["errors"] else "error",
            "debug": debug_info
        }

    except Exception as e:
        debug_info["errors"].append(f"Erro geral: {str(e)}")
        import traceback
        debug_info["traceback"] = traceback.format_exc()

        return {
            "status": "error",
            "debug": debug_info
        }


@router.get("/test-numpy-conversion")
async def test_numpy_conversion():
    """Testa conversão de tipos NumPy para diagnóstico"""
    try:
        import numpy as np
        from services.vision_service import convert_numpy_types

        # Criar diferentes tipos numpy para teste
        test_data = {
            "numpy_int": np.int32(42),
            "numpy_float": np.float64(3.14),
            "numpy_bool": np.bool_(True),
            "numpy_array": np.array([1, 2, 3]),
            "nested": {
                "inner_float": np.float32(2.71),
                "inner_array": np.array([[1, 2], [3, 4]])
            }
        }

        print(f"Dados originais: {test_data}")
        print(f"Tipos originais: {[(k, type(v)) for k, v in test_data.items()]}")

        # Converter
        converted = convert_numpy_types(test_data)
        print(f"Dados convertidos: {converted}")
        print(f"Tipos convertidos: {[(k, type(v)) for k, v in converted.items()]}")

        # Testar serialização JSON
        import json
        json_str = json.dumps(converted)
        print(f"JSON serializado com sucesso: {len(json_str)} caracteres")

        return {
            "status": "success",
            "numpy_version": np.__version__,
            "original_types": {k: str(type(v)) for k, v in test_data.items()},
            "converted_types": {k: str(type(v)) for k, v in converted.items()},
            "conversion_successful": True,
            "json_serializable": True,
            "converted_data": converted
        }

    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
            "numpy_version": np.__version__ if 'np' in locals() else "unknown"
        }