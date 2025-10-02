import { useState, useEffect, useRef, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  session_id?: string;
  step?: string;
  progress?: number;
  status?: string;
  data?: any;
  message?: string;
  timestamp?: string;
  error?: string;
}

export interface ProgressState {
  vision_analysis: { status: string; progress: number; data?: any };
  transcription: { status: string; progress: number; data?: any };
  data_extraction: { status: string; progress: number; data?: any };
  report_generation: { status: string; progress: number; data?: any };
}

interface UseWebSocketReturn {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  progress: ProgressState;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: any) => void;
  startVisionAnalysis: (imageData: string) => void;
  startTranscription: (audioData: string) => void;
  startCompleteAnalysis: (transcriptionText: string, visionData?: any) => void;
  connect: () => void;
  disconnect: () => void;
  error: string | null;
}

export const useWebSocket = (sessionId: string): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [progress, setProgress] = useState<ProgressState>({
    vision_analysis: { status: 'pending', progress: 0 },
    transcription: { status: 'pending', progress: 0 },
    data_extraction: { status: 'pending', progress: 0 },
    report_generation: { status: 'pending', progress: 0 }
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Já conectado
    }

    setConnectionStatus('connecting');
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const wsUrl = `ws://localhost:8000/ws/analysis/${sessionId}?token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket conectado:', sessionId);
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);
        reconnectAttempts.current = 0;

        // Configurar ping para manter conexão viva
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ping',
              timestamp: new Date().toISOString()
            }));
          }
        }, 30000); // Ping a cada 30 segundos
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message:', message);
          
          setLastMessage(message);

          // Atualizar progresso baseado no tipo de mensagem
          if (message.type === 'progress_update' && message.step && message.progress !== undefined) {
            setProgress(prev => ({
              ...prev,
              [message.step!]: {
                status: message.status || 'in_progress',
                progress: message.progress!,
                data: message.data
              }
            }));
          }

          // Tratar erro
          if (message.type === 'error') {
            setError(message.message || 'Erro desconhecido do WebSocket');
          }

        } catch (err) {
          console.error('Erro ao processar mensagem WebSocket:', err);
          setError('Erro ao processar mensagem do servidor');
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket desconectado:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        // Limpar ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Tentar reconectar se não foi fechamento intencional
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`Tentativa de reconexão ${reconnectAttempts.current}/${maxReconnectAttempts}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 2000 * reconnectAttempts.current); // Backoff exponencial
        }
      };

      ws.onerror = (event) => {
        console.error('Erro WebSocket:', event);
        setConnectionStatus('error');
        setError('Erro de conexão WebSocket');
      };

    } catch (err) {
      console.error('Erro ao criar conexão WebSocket:', err);
      setConnectionStatus('error');
      setError('Falha ao estabelecer conexão WebSocket');
    }
  }, [sessionId]);

  const disconnect = useCallback(() => {
    reconnectAttempts.current = maxReconnectAttempts; // Prevent reconnection
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Disconnected by user');
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      setError('WebSocket não conectado');
    }
  }, []);

  const startVisionAnalysis = useCallback((imageData: string) => {
    sendMessage({
      type: 'start_vision_analysis',
      image_data: imageData,
      session_id: sessionId
    });
  }, [sendMessage, sessionId]);

  const startTranscription = useCallback((audioData: string) => {
    sendMessage({
      type: 'start_transcription',
      audio_data: audioData,
      session_id: sessionId
    });
  }, [sendMessage, sessionId]);

  const startCompleteAnalysis = useCallback((transcriptionText: string, visionData?: any) => {
    sendMessage({
      type: 'start_complete_analysis',
      transcription_text: transcriptionText,
      vision_data: visionData,
      session_id: sessionId
    });
  }, [sendMessage, sessionId]);

  // Auto conectar quando o hook é montado
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    progress,
    lastMessage,
    sendMessage,
    startVisionAnalysis,
    startTranscription,
    startCompleteAnalysis,
    connect,
    disconnect,
    error
  };
};