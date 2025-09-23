"""
Rotas da API de inteligência artificial (OpenAI)
"""
import base64
import time
import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
try:
    from core.database import get_database_session
    from models.schemas import MessageResponse
    from models.user import User
    from services.openai_service import OpenAIService
    from services.vision_service import VisionService
    from services.log_service import LogService
    from api.auth import get_current_user
except ImportError:
    from core.database import get_database_session
    from models.schemas import MessageResponse
    from models.user import User
    from services.openai_service import OpenAIService
    from services.vision_service import VisionService
    from services.log_service import LogService
    from api.auth import get_current_user


router = APIRouter(prefix="/ai", tags=["inteligência artificial"])


@router.post("/transcribe-audio")
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Transcreve áudio usando OpenAI Whisper"""
    try:
        # Validar arquivo de áudio
        if not audio_file.content_type.startswith('audio/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Arquivo deve ser um áudio válido"
            )
        
        # Ler dados do áudio
        audio_data = await audio_file.read()
        
        if len(audio_data) > 25 * 1024 * 1024:  # 25MB limite do Whisper
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Arquivo de áudio muito grande (máximo 25MB)"
            )
        
        # Determinar formato do áudio
        audio_format = audio_file.content_type.split('/')[-1]
        if audio_format in ['mpeg', 'mp3']:
            audio_format = 'mp3'
        elif audio_format in ['wav', 'wave']:
            audio_format = 'wav'
        elif audio_format == 'ogg':
            audio_format = 'ogg'
        elif audio_format == 'webm':
            audio_format = 'webm'  # OpenAI Whisper suporta webm
        elif audio_format == 'm4a':
            audio_format = 'm4a'
        elif audio_format == 'flac':
            audio_format = 'flac'
        else:
            audio_format = 'wav'  # fallback
        
        # Transcrever usando Whisper
        transcription_result = OpenAIService.transcribe_audio(audio_data, audio_format)
        
        # Log da operação
        success_str = "sucesso" if transcription_result['success'] else "falha"
        await LogService.create_log(
            db,
            action="transcribe_audio",
            details=f"Transcrição de áudio - {success_str} - {transcription_result.get('duration', 0):.1f}s",
            user_id=current_user.id
        )
        
        if not transcription_result['success']:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro na transcrição: {transcription_result['error']}"
            )
        
        return transcription_result
        
    except HTTPException:
        raise
    except Exception as e:
        await LogService.create_log(
            db,
            action="transcribe_audio_error",
            details=f"Erro na transcrição de áudio: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno na transcrição: {str(e)}"
        )


@router.post("/transcribe-audio-streaming")
async def transcribe_audio_streaming(
    audio_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Transcreve áudio usando OpenAI com streaming para feedback em tempo real"""
    try:
        # Validar arquivo de áudio
        if not audio_file.content_type.startswith('audio/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Arquivo deve ser um áudio válido"
            )
        
        # Ler dados do áudio
        audio_data = await audio_file.read()
        
        if len(audio_data) > 25 * 1024 * 1024:  # 25MB limite do OpenAI
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Arquivo de áudio muito grande (máximo 25MB)"
            )
        
        # Determinar formato do áudio
        audio_format = audio_file.content_type.split('/')[-1]
        if audio_format in ['mpeg', 'mp3']:
            audio_format = 'mp3'
        elif audio_format in ['wav', 'wave']:
            audio_format = 'wav'
        elif audio_format == 'ogg':
            audio_format = 'ogg'
        elif audio_format == 'webm':
            audio_format = 'webm'  # OpenAI Whisper suporta webm
        elif audio_format == 'm4a':
            audio_format = 'm4a'
        elif audio_format == 'flac':
            audio_format = 'flac'
        else:
            audio_format = 'wav'  # fallback
        
        # Função geradora para streaming
        async def generate_transcription():
            try:
                for chunk in OpenAIService.transcribe_audio_streaming(audio_data, audio_format):
                    yield f"data: {json.dumps(chunk)}\n\n"
                    
                # Log da operação (apenas ao final)
                await LogService.create_log(
                    db,
                    action="transcribe_audio_streaming",
                    details="Transcrição de áudio com streaming concluída",
                    user_id=current_user.id
                )
                    
            except Exception as e:
                error_chunk = {
                    "type": "transcript.error",
                    "error": str(e),
                    "timestamp": time.time()
                }
                yield f"data: {json.dumps(error_chunk)}\n\n"
        
        return StreamingResponse(
            generate_transcription(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"  # Nginx directive for immediate streaming
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await LogService.create_log(
            db,
            action="transcribe_audio_streaming_error",
            details=f"Erro na transcrição streaming: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno na transcrição streaming: {str(e)}"
        )


@router.post("/extract-biopsy-data")
async def extract_biopsy_data(
    transcription_text: str = Form(...),
    vision_measurements: Optional[str] = Form(None),  # JSON string
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Extrai dados estruturados de biópsia da transcrição usando GPT-4"""
    try:
        # Parselear medições de visão se fornecidas
        vision_data = None
        if vision_measurements:
            import json
            try:
                vision_data = json.loads(vision_measurements)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Dados de visão em formato JSON inválido"
                )
        
        # Extrair dados estruturados
        extraction_result = OpenAIService.extract_biopsy_data(
            transcription_text, 
            vision_data
        )
        
        # Log da operação
        success_str = "sucesso" if extraction_result['success'] else "falha"
        await LogService.create_log(
            db,
            action="extract_biopsy_data",
            details=f"Extração de dados - {success_str} - tokens: {extraction_result.get('tokens_used', 0)}",
            user_id=current_user.id
        )
        
        if not extraction_result['success']:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro na extração: {extraction_result['error']}"
            )
        
        return extraction_result
        
    except HTTPException:
        raise
    except Exception as e:
        await LogService.create_log(
            db,
            action="extract_biopsy_data_error",
            details=f"Erro na extração de dados: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno na extração: {str(e)}"
        )


@router.post("/generate-report")
async def generate_biopsy_report(
    structured_data: dict,
    vision_measurements: Optional[dict] = None,
    transcription_text: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Gera relatório estruturado de biópsia usando GPT-4"""
    try:
        # Gerar relatório
        report_result = OpenAIService.generate_biopsy_report(
            structured_data,
            vision_measurements,
            transcription_text
        )
        
        # Log da operação
        success_str = "sucesso" if report_result['success'] else "falha"
        await LogService.create_log(
            db,
            action="generate_biopsy_report",
            details=f"Geração de relatório - {success_str} - tokens: {report_result.get('tokens_used', 0)}",
            user_id=current_user.id
        )
        
        if not report_result['success']:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro na geração do relatório: {report_result['error']}"
            )
        
        return report_result
        
    except HTTPException:
        raise
    except Exception as e:
        await LogService.create_log(
            db,
            action="generate_biopsy_report_error",
            details=f"Erro na geração de relatório: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno na geração: {str(e)}"
        )


@router.post("/complete-analysis")
async def complete_ai_analysis(
    audio_file: Optional[UploadFile] = File(None),
    image_file: Optional[UploadFile] = File(None),
    transcription_text: Optional[str] = Form(None),
    grid_size_mm: float = Form(10.0),
    use_calibration: bool = Form(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Análise completa integrando visão computacional + IA"""
    try:
        analysis_results = {
            "transcription": None,
            "vision_analysis": None,
            "structured_data": None,
            "final_report": None,
            "success": False,
            "errors": []
        }
        
        # Etapa 1: Transcrição de áudio (se fornecido)
        if audio_file:
            audio_data = await audio_file.read()
            audio_format = audio_file.content_type.split('/')[-1]
            
            transcription_result = OpenAIService.transcribe_audio(audio_data, audio_format)
            analysis_results["transcription"] = transcription_result
            
            if transcription_result['success']:
                transcription_text = transcription_result['text']
            else:
                analysis_results["errors"].append("Falha na transcrição de áudio")
        
        # Etapa 2: Análise de visão computacional (se imagem fornecida)
        vision_measurements = None
        if image_file:
            import cv2
            import numpy as np
            
            # Ler e processar imagem
            contents = await image_file.read()
            nparr = np.frombuffer(contents, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is not None:
                # Executar análise de visão
                vision_result = VisionService.analyze_biopsy_complete(
                    image, 
                    grid_size_mm
                )
                analysis_results["vision_analysis"] = vision_result
                
                if vision_result['success']:
                    vision_measurements = vision_result['measurements']
                else:
                    analysis_results["errors"].append("Falha na análise de visão")
            else:
                analysis_results["errors"].append("Imagem inválida")
        
        # Etapa 3: Extração de dados estruturados (se transcrição disponível)
        if transcription_text:
            extraction_result = OpenAIService.extract_biopsy_data(
                transcription_text,
                vision_measurements
            )
            analysis_results["structured_data"] = extraction_result
            
            if not extraction_result['success']:
                analysis_results["errors"].append("Falha na extração de dados")
            
            # Etapa 4: Geração do relatório final
            if extraction_result['success']:
                report_result = OpenAIService.generate_biopsy_report(
                    extraction_result['structured_data'],
                    vision_measurements,
                    transcription_text
                )
                analysis_results["final_report"] = report_result
                
                if not report_result['success']:
                    analysis_results["errors"].append("Falha na geração do relatório")
        else:
            analysis_results["errors"].append("Nenhuma transcrição disponível para análise")
        
        # Determinar sucesso geral
        analysis_results["success"] = (
            len(analysis_results["errors"]) == 0 and
            (analysis_results["final_report"] and analysis_results["final_report"]["success"])
        )
        
        # Log da análise completa
        await LogService.create_log(
            db,
            action="complete_ai_analysis",
            details=f"Análise completa - Sucesso: {analysis_results['success']} - Erros: {len(analysis_results['errors'])}",
            user_id=current_user.id
        )
        
        return analysis_results
        
    except Exception as e:
        await LogService.create_log(
            db,
            action="complete_ai_analysis_error",
            details=f"Erro na análise completa: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno na análise completa: {str(e)}"
        )


@router.post("/validate-transcription-quality")
async def validate_transcription_quality(
    transcription_text: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Valida a qualidade da transcrição usando GPT-4"""
    try:
        validation_result = OpenAIService.validate_transcription_quality(transcription_text)
        
        # Log da operação
        success_str = "sucesso" if validation_result['success'] else "falha"
        await LogService.create_log(
            db,
            action="validate_transcription_quality",
            details=f"Validação de qualidade - {success_str}",
            user_id=current_user.id
        )
        
        return validation_result
        
    except Exception as e:
        await LogService.create_log(
            db,
            action="validate_transcription_quality_error",
            details=f"Erro na validação de qualidade: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro na validação: {str(e)}"
        )


@router.get("/test-openai-integration")
async def test_openai_integration(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Testa a integração com OpenAI usando dados sintéticos"""
    try:
        test_results = OpenAIService.test_openai_integration()
        
        # Log do teste
        await LogService.create_log(
            db,
            action="test_openai_integration",
            details=f"Teste de integração OpenAI - Sucesso geral: {test_results['overall_success']}",
            user_id=current_user.id
        )
        
        return {
            "status": "completed",
            "results": test_results,
            "message": "Teste de integração OpenAI executado"
        }
        
    except Exception as e:
        await LogService.create_log(
            db,
            action="test_openai_integration_error",
            details=f"Erro no teste de integração: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro no teste de integração: {str(e)}"
        )


@router.post("/process-with-structured-functions")
async def process_with_structured_functions(
    transcription_text: str = Form(...),
    vision_measurements: Optional[str] = Form(None),  # JSON string
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Processa transcrição usando as 8 funções estruturadas especificadas"""
    try:
        # Parselear medições de visão se fornecidas
        vision_data = None
        if vision_measurements:
            import json
            try:
                vision_data = json.loads(vision_measurements)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Dados de visão em formato JSON inválido"
                )
        
        # Processar com funções estruturadas
        processing_result = OpenAIService.process_transcription_with_functions(
            transcription_text, 
            vision_data
        )
        
        # Log da operação
        success_str = "sucesso" if processing_result['success'] else "falha"
        await LogService.create_log(
            db,
            action="process_structured_functions",
            details=f"Processamento com funções estruturadas - {success_str} - tokens: {processing_result.get('tokens_used', 0)}",
            user_id=current_user.id
        )
        
        if not processing_result['success']:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro no processamento: {processing_result['error']}"
            )
        
        return processing_result
        
    except HTTPException:
        raise
    except Exception as e:
        await LogService.create_log(
            db,
            action="process_structured_functions_error",
            details=f"Erro no processamento com funções estruturadas: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno no processamento: {str(e)}"
        )


@router.post("/complete-structured-analysis")
async def complete_structured_analysis(
    transcription_text: str = Form(...),
    vision_measurements: Optional[str] = Form(None),  # JSON string
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Processa análise completa chamando todas as 8 funções em sequência"""
    try:
        # Parselear medições de visão se fornecidas
        vision_data = None
        if vision_measurements:
            import json
            try:
                vision_data = json.loads(vision_measurements)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Dados de visão em formato JSON inválido"
                )
        
        # Processar análise completa
        analysis_result = OpenAIService.process_complete_analysis(
            transcription_text, 
            vision_data
        )
        
        # Log da operação
        success_str = "sucesso" if analysis_result['success'] else "falha"
        functions_completed = analysis_result.get('functions_completed', 0)
        functions_total = analysis_result.get('functions_total', 8)
        
        await LogService.create_log(
            db,
            action="complete_structured_analysis",
            details=f"Análise completa estruturada - {success_str} - funções: {functions_completed}/{functions_total} - tokens: {analysis_result.get('total_tokens_used', 0)}",
            user_id=current_user.id
        )
        
        if not analysis_result['success']:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro na análise completa: {analysis_result['error']}"
            )
        
        return analysis_result
        
    except HTTPException:
        raise
    except Exception as e:
        await LogService.create_log(
            db,
            action="complete_structured_analysis_error",
            details=f"Erro na análise completa estruturada: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno na análise completa: {str(e)}"
        )


@router.post("/full-pipeline-analysis")
async def full_pipeline_analysis(
    audio_file: Optional[UploadFile] = File(None),
    image_file: Optional[UploadFile] = File(None),
    transcription_text: Optional[str] = Form(None),
    grid_size_mm: float = Form(10.0),
    use_structured_functions: bool = Form(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Análise completa do pipeline integrando visão computacional + IA com funções estruturadas"""
    try:
        pipeline_results = {
            "transcription": None,
            "vision_analysis": None,
            "structured_analysis": None,
            "legacy_extraction": None,
            "final_report": None,
            "success": False,
            "errors": [],
            "processing_summary": {
                "functions_used": "structured" if use_structured_functions else "legacy",
                "total_tokens": 0,
                "processing_time_ms": 0
            }
        }
        
        start_time = time.time()
        
        # Etapa 1: Transcrição de áudio (se fornecido)
        if audio_file:
            audio_data = await audio_file.read()
            audio_format = audio_file.content_type.split('/')[-1]
            if audio_format in ['mpeg', 'mp3']:
                audio_format = 'mp3'
            elif audio_format in ['wav', 'wave']:
                audio_format = 'wav'
            
            transcription_result = OpenAIService.transcribe_audio(audio_data, audio_format)
            pipeline_results["transcription"] = transcription_result
            
            if transcription_result['success']:
                transcription_text = transcription_result['text']
            else:
                pipeline_results["errors"].append("Falha na transcrição de áudio")
        
        # Etapa 2: Análise de visão computacional (se imagem fornecida)
        vision_measurements = None
        if image_file:
            import cv2
            import numpy as np
            import time
            
            # Ler e processar imagem
            contents = await image_file.read()
            nparr = np.frombuffer(contents, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is not None:
                # Executar análise de visão
                vision_result = VisionService.analyze_biopsy_complete(
                    image, 
                    grid_size_mm
                )
                pipeline_results["vision_analysis"] = vision_result
                
                if vision_result['success']:
                    vision_measurements = vision_result['measurements']
                else:
                    pipeline_results["errors"].append("Falha na análise de visão")
            else:
                pipeline_results["errors"].append("Imagem inválida")
        
        # Etapa 3: Processamento da transcrição
        if transcription_text:
            if use_structured_functions:
                # Nova abordagem com 8 funções estruturadas
                structured_result = OpenAIService.process_complete_analysis(
                    transcription_text,
                    vision_measurements
                )
                pipeline_results["structured_analysis"] = structured_result
                
                if structured_result['success']:
                    pipeline_results["processing_summary"]["total_tokens"] += structured_result.get('total_tokens_used', 0)
                else:
                    pipeline_results["errors"].append("Falha na análise estruturada")
            else:
                # Abordagem legada
                extraction_result = OpenAIService.extract_biopsy_data(
                    transcription_text,
                    vision_measurements
                )
                pipeline_results["legacy_extraction"] = extraction_result
                
                if extraction_result['success']:
                    pipeline_results["processing_summary"]["total_tokens"] += extraction_result.get('tokens_used', 0)
                else:
                    pipeline_results["errors"].append("Falha na extração de dados legada")
            
            # Etapa 4: Geração do relatório final
            if use_structured_functions and pipeline_results["structured_analysis"] and pipeline_results["structured_analysis"]['success']:
                # Gerar relatório baseado nas funções estruturadas
                structured_data = pipeline_results["structured_analysis"]['results']
                report_result = OpenAIService.generate_biopsy_report(
                    structured_data,
                    vision_measurements,
                    transcription_text
                )
                pipeline_results["final_report"] = report_result
                
                if report_result['success']:
                    pipeline_results["processing_summary"]["total_tokens"] += report_result.get('tokens_used', 0)
                else:
                    pipeline_results["errors"].append("Falha na geração do relatório estruturado")
                    
            elif not use_structured_functions and pipeline_results["legacy_extraction"] and pipeline_results["legacy_extraction"]['success']:
                # Gerar relatório baseado na extração legada
                report_result = OpenAIService.generate_biopsy_report(
                    pipeline_results["legacy_extraction"]['structured_data'],
                    vision_measurements,
                    transcription_text
                )
                pipeline_results["final_report"] = report_result
                
                if report_result['success']:
                    pipeline_results["processing_summary"]["total_tokens"] += report_result.get('tokens_used', 0)
                else:
                    pipeline_results["errors"].append("Falha na geração do relatório legado")
        else:
            pipeline_results["errors"].append("Nenhuma transcrição disponível para análise")
        
        # Calcular tempo de processamento
        end_time = time.time()
        pipeline_results["processing_summary"]["processing_time_ms"] = int((end_time - start_time) * 1000)
        
        # Determinar sucesso geral
        pipeline_results["success"] = (
            len(pipeline_results["errors"]) == 0 and
            (pipeline_results["final_report"] and pipeline_results["final_report"]["success"])
        )
        
        # Log da análise completa do pipeline
        await LogService.create_log(
            db,
            action="full_pipeline_analysis",
            details=f"Pipeline completo - Sucesso: {pipeline_results['success']} - Função: {pipeline_results['processing_summary']['functions_used']} - Tokens: {pipeline_results['processing_summary']['total_tokens']} - Tempo: {pipeline_results['processing_summary']['processing_time_ms']}ms",
            user_id=current_user.id
        )
        
        return pipeline_results
        
    except Exception as e:
        await LogService.create_log(
            db,
            action="full_pipeline_analysis_error",
            details=f"Erro no pipeline completo: {str(e)}",
            user_id=current_user.id
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno no pipeline: {str(e)}"
        )


@router.get("/ai-capabilities")
async def get_ai_capabilities():
    """Lista as capacidades de IA disponíveis"""
    return {
        "whisper": {
            "available": True,
            "supported_formats": ["mp3", "wav", "ogg", "webm", "m4a", "flac"],
            "max_file_size": "25MB",
            "languages": ["pt", "en", "es", "auto"],
            "model": "whisper-1"
        },
        "gpt4": {
            "available": True,
            "model": "gpt-4o-mini",
            "capabilities": [
                "structured_data_extraction",
                "medical_report_generation", 
                "transcription_quality_validation",
                "clinical_data_analysis",
                "structured_function_processing"
            ],
            "context_window": "128k tokens",
            "structured_functions": {
                "total": 8,
                "functions": [
                    "preencher_identificacao",
                    "preencher_coloracao",
                    "preencher_consistencia", 
                    "preencher_superficie",
                    "identificar_lesoes",
                    "avaliar_inflamacao",
                    "registrar_observacoes",
                    "gerar_conclusao"
                ]
            }
        },
        "integration": {
            "vision_ai_workflow": True,
            "complete_analysis_pipeline": True,
            "multi_modal_processing": True,
            "automated_reporting": True,
            "structured_form_filling": True,
            "real_time_processing": True
        }
    }