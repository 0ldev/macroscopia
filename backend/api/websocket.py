"""
Rotas da API de WebSocket para comunicação em tempo real
"""
import json
import uuid
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
try:
    from core.database import get_database_session
    from models.user import User
    from services.websocket_service import connection_manager, WebSocketService
    from services.log_service import LogService
    from api.auth import get_current_user_from_token, get_current_user
except ImportError:
    from core.database import get_database_session
    from models.user import User
    from services.websocket_service import connection_manager, WebSocketService
    from services.log_service import LogService
    from api.auth import get_current_user_from_token, get_current_user

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/analysis/{session_id}")
async def websocket_analysis(websocket: WebSocket, session_id: str, token: Optional[str] = Query(None)):
    """
    Endpoint WebSocket para análise em tempo real
    
    Parâmetros:
    - session_id: ID único da sessão de análise
    - token: Token JWT de autenticação (query parameter)
    """
    user_id = None
    
    try:
        # Autenticar usuário via token
        if not token:
            await websocket.close(code=1008, reason="Token de autenticação necessário")
            return
        
        # Validar token (implementação simplificada)
        # Em produção, usar a função get_current_user_from_token apropriadamente
        user_id = "user_from_token"  # Placeholder
        
        # Conectar WebSocket
        await connection_manager.connect(websocket, user_id, session_id)
        
        try:
            while True:
                # Receber mensagem do cliente
                data = await websocket.receive_text()
                message = json.loads(data)
                
                message_type = message.get("type")
                
                if message_type == "start_vision_analysis":
                    # Iniciar análise de visão
                    await WebSocketService.handle_vision_stream(
                        websocket, user_id, session_id, 
                        message.get("image_data", b"")
                    )
                
                elif message_type == "start_transcription":
                    # Iniciar transcrição de áudio
                    await WebSocketService.handle_transcription_stream(
                        websocket, user_id, session_id,
                        message.get("audio_data", b"")
                    )
                
                elif message_type == "start_complete_analysis":
                    # Iniciar análise completa
                    await WebSocketService.handle_complete_analysis_stream(
                        websocket, user_id, session_id,
                        message.get("transcription_text", ""),
                        message.get("vision_data")
                    )
                
                elif message_type == "get_session_status":
                    # Retornar status da sessão
                    status = await connection_manager.get_session_status(session_id)
                    await connection_manager.send_personal_message(websocket, {
                        "type": "session_status",
                        "session_id": session_id,
                        "status": status
                    })
                
                elif message_type == "ping":
                    # Responder ping para manter conexão viva
                    await connection_manager.send_personal_message(websocket, {
                        "type": "pong",
                        "timestamp": message.get("timestamp")
                    })
                
                else:
                    await connection_manager.send_personal_message(websocket, {
                        "type": "error",
                        "message": f"Tipo de mensagem não reconhecido: {message_type}"
                    })
        
        except WebSocketDisconnect:
            logger.info(f"Cliente desconectado - Sessão: {session_id}")
        except Exception as e:
            logger.error(f"Erro no WebSocket - Sessão {session_id}: {e}")
            await connection_manager.send_personal_message(websocket, {
                "type": "error", 
                "message": f"Erro interno: {str(e)}"
            })
    
    except Exception as e:
        logger.error(f"Erro ao estabelecer conexão WebSocket: {e}")
        try:
            await websocket.close(code=1011, reason=f"Erro interno: {str(e)}")
        except:
            pass
    
    finally:
        if user_id:
            await connection_manager.disconnect(websocket, user_id)
            await connection_manager.close_session(session_id)


@router.get("/sessions/active")
async def get_active_sessions(current_user: User = Depends(get_current_user)):
    """Lista todas as sessões WebSocket ativas"""
    return {
        "active_connections": connection_manager.get_active_connections_count(),
        "active_users": connection_manager.get_active_users_count(), 
        "active_sessions": connection_manager.get_active_sessions_count()
    }


@router.post("/sessions/{session_id}/close")
async def close_session(session_id: str, current_user: User = Depends(get_current_user)):
    """Força o fechamento de uma sessão específica"""
    await connection_manager.close_session(session_id)
    return {"message": f"Sessão {session_id} fechada"}


@router.post("/broadcast")
async def broadcast_message(
    message: dict,
    current_user: User = Depends(get_current_user)
):
    """Envia mensagem broadcast para todos os clientes conectados (apenas admins)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    await connection_manager.broadcast({
        "type": "broadcast",
        "from": "admin",
        "message": message
    })
    
    return {"message": "Broadcast enviado com sucesso"}


@router.get("/health")
async def websocket_health():
    """Endpoint de saúde do serviço WebSocket"""
    return {
        "status": "healthy",
        "service": "websocket",
        "active_connections": connection_manager.get_active_connections_count(),
        "active_users": connection_manager.get_active_users_count(),
        "active_sessions": connection_manager.get_active_sessions_count()
    }


# Função helper para autenticação WebSocket
async def get_current_user_from_token(token: str) -> Optional[User]:
    """
    Valida token JWT e retorna usuário (implementação simplificada)
    Em produção, implementar validação completa do token
    """
    try:
        # Aqui seria feita a validação do token JWT
        # Por simplicidade, retornamos um usuário fictício
        # Em produção, usar a mesma lógica do auth.py
        
        if token == "valid_token":  # Placeholder
            # Retornar usuário válido
            return User(id=1, username="admin", is_admin=True)
        return None
    except Exception:
        return None