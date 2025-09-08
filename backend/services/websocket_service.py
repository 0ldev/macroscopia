"""
Serviço de WebSocket para comunicação em tempo real
"""
import json
import asyncio
from typing import  List, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Gerenciador de conexões WebSocket para análise em tempo real"""
    
    def __init__(self):
        # Conexões ativas por usuário
        self.active_connections: dict[str, List[WebSocket]] = {}
        # Sessões de análise ativas
        self.active_sessions: dict[str, dict[str, Any]] = {}
        # Lock para operações thread-safe
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: str, session_id: str):
        """Conecta um cliente WebSocket"""
        await websocket.accept()
        
        async with self._lock:
            # Adicionar conexão à lista de conexões do usuário
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
            
            # Criar sessão de análise se não existir
            if session_id not in self.active_sessions:
                self.active_sessions[session_id] = {
                    "session_id": session_id,
                    "user_id": user_id,
                    "created_at": datetime.now().isoformat(),
                    "status": "connected",
                    "progress": {
                        "vision_analysis": {"status": "pending", "progress": 0},
                        "transcription": {"status": "pending", "progress": 0},
                        "data_extraction": {"status": "pending", "progress": 0},
                        "report_generation": {"status": "pending", "progress": 0}
                    },
                    "results": {}
                }
        
        logger.info(f"WebSocket conectado - Usuário: {user_id}, Sessão: {session_id}")
        
        # Enviar mensagem de boas-vindas
        await self.send_personal_message(websocket, {
            "type": "connection_established",
            "session_id": session_id,
            "message": "Conexão WebSocket estabelecida com sucesso",
            "timestamp": datetime.now().isoformat()
        })
    
    async def disconnect(self, websocket: WebSocket, user_id: str):
        """Desconecta um cliente WebSocket"""
        async with self._lock:
            if user_id in self.active_connections:
                if websocket in self.active_connections[user_id]:
                    self.active_connections[user_id].remove(websocket)
                
                # Remover usuário se não há mais conexões
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
        
        logger.info(f"WebSocket desconectado - Usuário: {user_id}")
    
    async def send_personal_message(self, websocket: WebSocket, message: dict):
        """Envia mensagem para uma conexão específica"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Erro ao enviar mensagem WebSocket: {e}")
    
    async def send_to_user(self, user_id: str, message: dict):
        """Envia mensagem para todas as conexões de um usuário"""
        async with self._lock:
            if user_id in self.active_connections:
                connections = self.active_connections[user_id].copy()
        
        if connections:
            message["timestamp"] = datetime.now().isoformat()
            disconnected = []
            
            for connection in connections:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Erro ao enviar para usuário {user_id}: {e}")
                    disconnected.append(connection)
            
            # Remover conexões desconectadas
            if disconnected:
                async with self._lock:
                    if user_id in self.active_connections:
                        for conn in disconnected:
                            if conn in self.active_connections[user_id]:
                                self.active_connections[user_id].remove(conn)
    
    async def broadcast(self, message: dict):
        """Envia mensagem para todas as conexões ativas"""
        message["timestamp"] = datetime.now().isoformat()
        
        async with self._lock:
            all_connections = []
            for connections in self.active_connections.values():
                all_connections.extend(connections)
        
        if all_connections:
            disconnected = []
            for connection in all_connections:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Erro no broadcast: {e}")
                    disconnected.append(connection)
            
            # Limpar conexões desconectadas
            if disconnected:
                await self._cleanup_disconnected_connections(disconnected)
    
    async def _cleanup_disconnected_connections(self, disconnected: List[WebSocket]):
        """Remove conexões desconectadas do registro"""
        async with self._lock:
            for user_id, connections in self.active_connections.items():
                for conn in disconnected:
                    if conn in connections:
                        connections.remove(conn)
            
            # Remover usuários sem conexões
            empty_users = [uid for uid, conns in self.active_connections.items() if not conns]
            for uid in empty_users:
                del self.active_connections[uid]
    
    async def update_progress(self, session_id: str, step: str, progress: int, status: str = "in_progress", data: Optional[dict] = None):
        """Atualiza o progresso de uma análise"""
        async with self._lock:
            if session_id in self.active_sessions:
                session = self.active_sessions[session_id]
                session["progress"][step] = {
                    "status": status,
                    "progress": progress,
                    "updated_at": datetime.now().isoformat()
                }
                
                if data:
                    session["results"][step] = data
                
                user_id = session["user_id"]
        
        # Enviar atualização para o usuário
        await self.send_to_user(user_id, {
            "type": "progress_update",
            "session_id": session_id,
            "step": step,
            "progress": progress,
            "status": status,
            "data": data
        })
    
    async def complete_step(self, session_id: str, step: str, result: dict):
        """Marca uma etapa como completa e envia resultado"""
        await self.update_progress(session_id, step, 100, "completed", result)
    
    async def error_step(self, session_id: str, step: str, error: str):
        """Marca uma etapa como erro"""
        await self.update_progress(session_id, step, 0, "error", {"error": error})
    
    async def get_session_status(self, session_id: str) -> Optional[dict]:
        """Retorna o status atual de uma sessão"""
        async with self._lock:
            return self.active_sessions.get(session_id)
    
    async def close_session(self, session_id: str):
        """Fecha uma sessão de análise"""
        async with self._lock:
            if session_id in self.active_sessions:
                session = self.active_sessions[session_id]
                user_id = session["user_id"]
                del self.active_sessions[session_id]
                
                # Notificar usuário sobre fechamento da sessão
                await self.send_to_user(user_id, {
                    "type": "session_closed",
                    "session_id": session_id,
                    "message": "Sessão de análise finalizada"
                })
    
    def get_active_connections_count(self) -> int:
        """Retorna número total de conexões ativas"""
        return sum(len(connections) for connections in self.active_connections.values())
    
    def get_active_users_count(self) -> int:
        """Retorna número de usuários conectados"""
        return len(self.active_connections)
    
    def get_active_sessions_count(self) -> int:
        """Retorna número de sessões ativas"""
        return len(self.active_sessions)


# Instância global do gerenciador de conexões
connection_manager = ConnectionManager()


class WebSocketService:
    """Serviço de WebSocket com funcionalidades específicas para análise"""
    
    @staticmethod
    async def handle_transcription_stream(websocket: WebSocket, user_id: str, session_id: str, audio_data: bytes):
        """Processa transcrição de áudio em streaming"""
        try:
            # Simular processamento em tempo real
            await connection_manager.update_progress(session_id, "transcription", 10, "in_progress")
            
            # Aqui seria integrada a transcrição em tempo real
            # Por simplicidade, simulamos o processo
            import asyncio
            for progress in range(20, 101, 20):
                await asyncio.sleep(1)  # Simular processamento
                await connection_manager.update_progress(session_id, "transcription", progress, "in_progress")
            
            # Resultado final (seria obtido do OpenAI Whisper)
            result = {
                "text": "Amostra apresenta coloração rosada, consistência firme, superfície lisa.",
                "confidence": 0.95,
                "duration": 5.2
            }
            
            await connection_manager.complete_step(session_id, "transcription", result)
            
        except Exception as e:
            await connection_manager.error_step(session_id, "transcription", str(e))
    
    @staticmethod
    async def handle_vision_stream(websocket: WebSocket, user_id: str, session_id: str, image_data: bytes):
        """Processa análise de visão em streaming"""
        try:
            # Simular análise de visão em tempo real
            steps = [
                (20, "Detectando grid de referência..."),
                (40, "Identificando contornos da amostra..."),
                (60, "Calculando dimensões..."),
                (80, "Aplicando calibração..."),
                (100, "Análise completa!")
            ]
            
            for progress, message in steps:
                await connection_manager.update_progress(
                    session_id, 
                    "vision_analysis", 
                    progress, 
                    "in_progress",
                    {"message": message}
                )
                await asyncio.sleep(0.5)  # Simular processamento
            
            # Resultado final
            result = {
                "area_mm2": 156.7,
                "perimeter_mm": 45.3,
                "length_max_mm": 18.2,
                "width_max_mm": 12.4,
                "confidence": 0.92
            }
            
            await connection_manager.complete_step(session_id, "vision_analysis", result)
            
        except Exception as e:
            await connection_manager.error_step(session_id, "vision_analysis", str(e))
    
    @staticmethod
    async def handle_complete_analysis_stream(websocket: WebSocket, user_id: str, session_id: str, 
                                            transcription_text: str, vision_data: Optional[dict] = None):
        """Processa análise completa com as 8 funções estruturadas em streaming"""
        try:
            # Simular processamento das 8 funções estruturadas
            functions = [
                "preencher_identificacao",
                "preencher_coloracao",
                "preencher_consistencia",
                "preencher_superficie", 
                "identificar_lesoes",
                "avaliar_inflamacao",
                "registrar_observacoes",
                "gerar_conclusao"
            ]
            
            results = {}
            
            for i, func in enumerate(functions):
                progress = int((i + 1) / len(functions) * 100)
                
                await connection_manager.update_progress(
                    session_id,
                    "data_extraction",
                    progress,
                    "in_progress",
                    {"current_function": func, "functions_completed": i}
                )
                
                await asyncio.sleep(0.8)  # Simular processamento de cada função
                
                # Simular resultado de cada função
                results[func] = {"status": "completed", "data": f"Resultado da {func}"}
            
            await connection_manager.complete_step(session_id, "data_extraction", results)
            
            # Gerar relatório final
            await connection_manager.update_progress(session_id, "report_generation", 50, "in_progress")
            await asyncio.sleep(1)
            
            final_report = """
RELATÓRIO DE ANÁLISE DE BIÓPSIA
===============================

IDENTIFICAÇÃO DO PACIENTE:
Nome: [Conforme transcrição]
Registro: [Conforme transcrição]

DADOS DA AMOSTRA:
Tipo de tecido: [Extraído da análise]
Local de coleta: [Conforme descrição]

ANÁLISE MACROSCÓPICA:
Coloração: rosada
Consistência: firme
Superfície: lisa

MEDIÇÕES QUANTITATIVAS:
Área: 156.7 mm²
Perímetro: 45.3 mm
Dimensões: 18.2 x 12.4 mm

CONCLUSÃO:
Amostra dentro dos padrões normais para análise histopatológica.

🤖 Gerado automaticamente com IA
            """
            
            await connection_manager.complete_step(session_id, "report_generation", {
                "report": final_report,
                "tokens_used": 450,
                "model": "gpt-4o-mini"
            })
            
        except Exception as e:
            await connection_manager.error_step(session_id, "data_extraction", str(e))