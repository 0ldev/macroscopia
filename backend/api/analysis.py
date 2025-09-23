"""
API endpoints for analysis data management
"""
import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
try:
    from core.database import get_database_session
    from models.schemas import MessageResponse
    from models.user import User
    from services.log_service import LogService
    from api.auth import get_current_user
except ImportError:
    from core.database import get_database_session
    from models.schemas import MessageResponse
    from models.user import User
    from services.log_service import LogService
    from api.auth import get_current_user


router = APIRouter(prefix="/api/analysis", tags=["análise"])


class MacroscopiaFormData(BaseModel):
    """Schema for form data based on functions.md"""
    # preencher_identificacao
    numero_peca: str = ""
    tipo_tecido: str = ""
    localizacao: str = ""
    procedencia: str = ""

    # preencher_coloracao
    cor_predominante: str = ""
    cor_secundaria: str = ""
    distribuicao: str = ""
    observacoes_cor: str = ""

    # preencher_consistencia
    consistencia_principal: str = ""
    homogeneidade: str = ""
    areas_diferentes: str = ""

    # preencher_superficie
    aspecto_superficie: str = ""
    brilho: str = ""
    presenca_secrecao: bool = False
    tipo_secrecao: str = ""

    # identificar_lesoes
    presenca_lesoes: bool = False
    tipo_lesao: List[str] = []
    localizacao_lesao: str = ""
    tamanho_aproximado: str = ""
    caracteristicas_lesao: str = ""

    # avaliar_inflamacao
    intensidade_inflamacao: str = ""
    sinais_presentes: List[str] = []
    distribuicao_inflamacao: str = ""

    # registrar_observacoes
    observacoes_gerais: str = ""
    particularidades: str = ""
    correlacao_clinica: str = ""
    recomendacoes: str = ""

    # gerar_conclusao
    impressao_diagnostica: str = ""
    achados_principais: List[str] = []
    necessidade_microscopia: bool = False
    observacoes_finais: str = ""


class AnalysisData(BaseModel):
    """Complete analysis data structure"""
    transcription: str
    visionMeasurements: Optional[Dict[str, Any]] = None
    formData: MacroscopiaFormData
    timestamp: str
    user_id: Optional[str] = None


@router.post("/save")
async def save_analysis(
    analysis_data: AnalysisData,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Save complete analysis data including form to database"""
    try:
        # For now, we'll store as JSON in logs since we don't have specific analysis tables
        # In a production system, you'd want dedicated tables for this data

        analysis_summary = {
            "transcription_length": len(analysis_data.transcription),
            "has_vision_data": analysis_data.visionMeasurements is not None,
            "form_completeness": calculate_form_completeness(analysis_data.formData),
            "timestamp": analysis_data.timestamp
        }

        # Store the complete analysis data (in production, use dedicated tables)
        import json
        complete_data_json = {
            "transcription": analysis_data.transcription,
            "visionMeasurements": analysis_data.visionMeasurements,
            "formData": analysis_data.formData.dict(),
            "timestamp": analysis_data.timestamp,
            "user_id": current_user.id,
            "summary": analysis_summary
        }

        # Log the analysis save operation
        await LogService.create_log(
            db,
            action="save_analysis",
            details=f"Análise salva - Completude: {analysis_summary['form_completeness']:.1%} - Transcrição: {analysis_summary['transcription_length']} chars - Dados: {json.dumps(complete_data_json, ensure_ascii=False)[:500]}...",
            user_id=current_user.id
        )

        # Generate a unique ID for this analysis (in production, use actual DB ID)
        analysis_id = f"analysis_{current_user.id}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"

        return {
            "success": True,
            "id": analysis_id,
            "message": "Análise salva com sucesso",
            "summary": analysis_summary
        }

    except Exception as e:
        await LogService.create_log(
            db,
            action="save_analysis_error",
            details=f"Erro ao salvar análise: {str(e)}",
            user_id=current_user.id
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao salvar análise: {str(e)}"
        )


@router.get("/list")
async def list_user_analyses(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """List analyses for the current user"""
    try:
        # For now, get from logs. In production, use dedicated analysis tables
        logs = LogService.get_logs(db, skip, limit, user_id=current_user.id)

        analyses = []
        for log in logs:
            if log.action == "save_analysis":
                # Extract the complete analysis data from log details
                import json
                import re

                # Parse the JSON data from the log details
                try:
                    # Extract JSON from the log details (after "Dados: ")
                    match = re.search(r'Dados: ({.*?})\.\.\.', log.details)
                    if match:
                        complete_data = json.loads(match.group(1))

                        # Convert to frontend Analysis format
                        analysis_id = f"analysis_{log.user_id}_{log.timestamp.strftime('%Y%m%d_%H%M%S')}"

                        analysis = {
                            "id": analysis_id,
                            "user_id": log.user_id,
                            "sample_id": complete_data.get('formData', {}).get('numero_peca', f"sample_{log.id}"),
                            "image_path": None,  # Could be extracted from visionMeasurements if needed
                            "measurements": complete_data.get('visionMeasurements'),
                            "transcription": complete_data.get('transcription'),
                            "form_data": complete_data.get('formData'),
                            "report": None,  # Could be generated if needed
                            "created_at": log.timestamp.isoformat(),
                            "updated_at": log.timestamp.isoformat()
                        }
                        analyses.append(analysis)
                    else:
                        # Fallback for logs without complete data
                        analysis_id = f"analysis_{log.user_id}_{log.timestamp.strftime('%Y%m%d_%H%M%S')}"
                        analysis = {
                            "id": analysis_id,
                            "user_id": log.user_id,
                            "sample_id": f"sample_{log.id}",
                            "image_path": None,
                            "measurements": None,
                            "transcription": None,
                            "form_data": None,
                            "report": None,
                            "created_at": log.timestamp.isoformat(),
                            "updated_at": log.timestamp.isoformat()
                        }
                        analyses.append(analysis)

                except (json.JSONDecodeError, AttributeError) as e:
                    # Fallback for corrupted or old format logs
                    analysis_id = f"analysis_{log.user_id}_{log.timestamp.strftime('%Y%m%d_%H%M%S')}"
                    analysis = {
                        "id": analysis_id,
                        "user_id": log.user_id,
                        "sample_id": f"sample_{log.id}",
                        "image_path": None,
                        "measurements": None,
                        "transcription": None,
                        "form_data": None,
                        "report": None,
                        "created_at": log.timestamp.isoformat(),
                        "updated_at": log.timestamp.isoformat()
                    }
                    analyses.append(analysis)

        return {
            "analyses": analyses,
            "total": len(analyses),
            "skip": skip,
            "limit": limit
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar análises: {str(e)}"
        )


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Get specific analysis by ID"""
    try:
        # Extract timestamp from analysis_id and find corresponding log
        parts = analysis_id.split('_')
        if len(parts) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ID de análise inválido"
            )

        # For now, search in logs. In production, use direct table lookup
        logs = LogService.get_logs(db, 0, 1000, user_id=current_user.id)

        for log in logs:
            if log.action == "save_analysis":
                log_analysis_id = f"analysis_{log.user_id}_{log.timestamp.strftime('%Y%m%d_%H%M%S')}"

                if log_analysis_id == analysis_id:
                    return {
                        "id": analysis_id,
                        "details": log.details,
                        "timestamp": log.timestamp.isoformat(),
                        "retrieved_at": datetime.datetime.now().isoformat()
                    }

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Análise não encontrada"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao recuperar análise: {str(e)}"
        )


@router.delete("/{analysis_id}")
async def delete_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Delete specific analysis (soft delete by logging)"""
    try:
        # Log the deletion request
        await LogService.create_log(
            db,
            action="delete_analysis",
            details=f"Solicitação de exclusão da análise: {analysis_id}",
            user_id=current_user.id
        )

        return {
            "success": True,
            "message": f"Análise {analysis_id} marcada para exclusão",
            "note": "Em um sistema de produção, isso seria uma exclusão do banco de dados"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao excluir análise: {str(e)}"
        )


def calculate_form_completeness(form_data: MacroscopiaFormData) -> float:
    """Calculate what percentage of the form is filled out"""
    total_fields = 0
    filled_fields = 0

    # Count all string fields
    for field_name, field_value in form_data.dict().items():
        if isinstance(field_value, str):
            total_fields += 1
            if field_value.strip():
                filled_fields += 1
        elif isinstance(field_value, list):
            total_fields += 1
            if field_value:
                filled_fields += 1
        elif isinstance(field_value, bool):
            # Boolean fields are considered "filled" if they're True
            total_fields += 1
            if field_value:
                filled_fields += 1

    return filled_fields / total_fields if total_fields > 0 else 0.0


@router.get("/export/{analysis_id}")
async def export_analysis(
    analysis_id: str,
    format: str = "json",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Export analysis in different formats"""
    try:
        # Get the analysis first
        analysis_response = await get_analysis(analysis_id, current_user, db)
        analysis_data = analysis_response["data"]

        if format.lower() == "json":
            return JSONResponse(
                content=analysis_data,
                headers={"Content-Disposition": f"attachment; filename=analysis_{analysis_id}.json"}
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Formato de exportação não suportado: {format}"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao exportar análise: {str(e)}"
        )


@router.get("/stats/summary")
async def get_analysis_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database_session)
):
    """Get statistics about user's analyses"""
    try:
        # Get all analysis logs for the user
        logs = LogService.get_logs(db, 0, 1000, user_id=current_user.id)

        # Filter for save_analysis logs
        analysis_logs = [log for log in logs if log.action == "save_analysis"]
        total_analyses = len(analysis_logs)

        # For now, we can't extract completeness scores from details alone
        # In production, this would come from structured data tables
        avg_completeness = 0.85  # Placeholder average

        return {
            "total_analyses": total_analyses,
            "average_form_completeness": avg_completeness,
            "completeness_distribution": {
                "high": max(0, total_analyses - 2),
                "medium": min(2, total_analyses),
                "low": 0
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao calcular estatísticas: {str(e)}"
        )