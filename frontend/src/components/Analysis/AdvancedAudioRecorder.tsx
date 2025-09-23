/**
 * Componente avançado de gravação de áudio com controles push-to-talk
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  CardActions,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Mic,
  MicOff,
  PlayArrow,
  Pause,
  Stop,
  Delete,
  Send,
  VolumeUp,
  RadioButtonChecked,
  FiberManualRecord,
  Schedule,
} from '@mui/icons-material';

interface AdvancedAudioRecorderProps {
  onTranscriptionComplete?: (transcription: string) => void;
  onTranscriptionUpdate?: (partialText: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  maxDurationSeconds?: number;
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'completed';
type TranscriptionState = 'idle' | 'processing' | 'streaming' | 'completed' | 'error';

const AdvancedAudioRecorder: React.FC<AdvancedAudioRecorderProps> = ({
  onTranscriptionComplete,
  onTranscriptionUpdate,
  onError,
  disabled = false,
  maxDurationSeconds = 300 // 5 minutos padrão
}) => {
  // Estados principais
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcriptionState, setTranscriptionState] = useState<TranscriptionState>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Estados de progresso e duração
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcriptionText, setTranscriptionText] = useState('');
  
  // Refs para recursos do browser
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const durationIntervalRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();
  
  // Estados de erro
  const [error, setError] = useState<string | null>(null);

  // Cleanup na desmontagem
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  const cleanupResources = useCallback(() => {
    // Parar gravação se ativa
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Limpar stream de áudio
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    // Limpar contextos de áudio
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Limpar timers
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Abortar requisições pendentes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [recordingState]);

  const setupAudioAnalyzer = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Animar nível de áudio
      const updateAudioLevel = () => {
        if (analyserRef.current && recordingState === 'recording') {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          setAudioLevel(average / 255);
          
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      
      updateAudioLevel();
    } catch (err) {
      console.warn('Não foi possível configurar analisador de áudio:', err);
    }
  }, [recordingState]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Solicitar permissão de microfone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      
      audioStreamRef.current = stream;
      setupAudioAnalyzer(stream);
      
      // Configurar MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Event listeners
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        setRecordingState('completed');
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
      
      // Iniciar gravação
      mediaRecorder.start(100); // Chunk a cada 100ms
      setRecordingState('recording');
      setDuration(0);
      
      // Timer de duração
      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxDurationSeconds) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
      
    } catch (err: any) {
      const errorMsg = err.name === 'NotAllowedError' 
        ? 'Permissão de microfone negada. Verifique as configurações do navegador.'
        : `Erro ao acessar microfone: ${err.message}`;
      
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [maxDurationSeconds, onError, setupAudioAnalyzer]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
  }, [recordingState]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      
      // Retomar timer
      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxDurationSeconds) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
    }
  }, [recordingState, maxDurationSeconds]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && ['recording', 'paused'].includes(recordingState)) {
      mediaRecorderRef.current.stop();
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      
      // Parar stream
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  }, [recordingState]);

  const deleteRecording = useCallback(() => {
    cleanupResources();
    audioChunksRef.current = [];
    setRecordingState('idle');
    setTranscriptionState('idle');
    setDuration(0);
    setAudioLevel(0);
    setTranscriptionText('');
    setError(null);
  }, [cleanupResources]);

  const playRecording = useCallback(() => {
    if (audioChunksRef.current.length === 0) return;
    
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      
      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => setIsPlaying(false);
      
      audio.play();
    } catch (err: any) {
      setError(`Erro ao reproduzir áudio: ${err.message}`);
    }
  }, []);

  const pausePlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
  }, []);

  const sendToTranscription = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      setError('Nenhuma gravação disponível para transcrever');
      return;
    }
    
    try {
      setTranscriptionState('processing');
      setTranscriptionText('');
      
      // Criar blob do áudio
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Preparar FormData
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');
      
      // Controller para abortar se necessário
      abortControllerRef.current = new AbortController();
      
      // Chamar API de streaming transcription
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/ai/transcribe-audio-streaming', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`Erro na transcrição: ${response.status}`);
      }
      
      setTranscriptionState('streaming');
      
      // Processar stream de resposta
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        let fullText = '';
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'transcript.text.delta') {
                  fullText = data.full_text;
                  setTranscriptionText(fullText);
                  onTranscriptionUpdate?.(fullText);
                  
                } else if (data.type === 'transcript.text.done') {
                  fullText = data.full_text;
                  setTranscriptionText(fullText);
                  setTranscriptionState('completed');
                  onTranscriptionComplete?.(fullText);
                  
                } else if (data.type === 'transcript.error') {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.warn('Erro ao parsear chunk:', parseError);
              }
            }
          }
        }
      }
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setTranscriptionState('idle');
      } else {
        setTranscriptionState('error');
        const errorMsg = `Erro na transcrição: ${err.message}`;
        setError(errorMsg);
        onError?.(errorMsg);
      }
    }
  }, [onTranscriptionComplete, onTranscriptionUpdate, onError]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRecordingStateColor = () => {
    switch (recordingState) {
      case 'recording': return 'error';
      case 'paused': return 'warning';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  const getRecordingStateText = () => {
    switch (recordingState) {
      case 'recording': return 'Gravando...';
      case 'paused': return 'Pausado';
      case 'completed': return 'Gravação Concluída';
      default: return 'Pronto para Gravar';
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Mic color="primary" />
        <Typography variant="h6">
          Gravação de Áudio Avançada
        </Typography>
        <Box sx={{ ml: 'auto' }}>
          <Chip 
            icon={recordingState === 'recording' ? <FiberManualRecord /> : <MicOff />}
            label={getRecordingStateText()}
            color={getRecordingStateColor()}
            size="small"
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Controles de Gravação */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule fontSize="small" />
              <Typography variant="body2">
                {formatDuration(duration)} / {formatDuration(maxDurationSeconds)}
              </Typography>
            </Box>
            
            {/* Indicador de nível de áudio */}
            {recordingState === 'recording' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <VolumeUp fontSize="small" />
                <LinearProgress 
                  variant="determinate" 
                  value={audioLevel * 100} 
                  sx={{ flex: 1, height: 6, borderRadius: 3 }}
                  color="secondary"
                />
              </Box>
            )}
          </Box>

          {/* Barra de progresso de duração */}
          <LinearProgress 
            variant="determinate" 
            value={(duration / maxDurationSeconds) * 100}
            sx={{ mb: 2, height: 4, borderRadius: 2 }}
          />
        </CardContent>

        <CardActions sx={{ justifyContent: 'center', gap: 1 }}>
          {/* Botão Push-to-Talk principal */}
          {recordingState === 'idle' && (
            <Tooltip title="Clique e segure para gravar (Push-to-Talk)">
              <Button
                variant="contained"
                size="large"
                startIcon={<RadioButtonChecked />}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={disabled}
                color="error"
                sx={{ minWidth: 200 }}
              >
                Push-to-Talk
              </Button>
            </Tooltip>
          )}

          {/* Controles durante gravação */}
          {recordingState === 'recording' && (
            <>
              <Button
                variant="contained"
                startIcon={<Pause />}
                onClick={pauseRecording}
                color="warning"
              >
                Pausar
              </Button>
              <Button
                variant="outlined"
                startIcon={<Stop />}
                onClick={stopRecording}
                color="error"
              >
                Parar
              </Button>
            </>
          )}

          {/* Controles quando pausado */}
          {recordingState === 'paused' && (
            <>
              <Button
                variant="contained"
                startIcon={<Mic />}
                onClick={resumeRecording}
                color="error"
              >
                Retomar
              </Button>
              <Button
                variant="outlined"
                startIcon={<Stop />}
                onClick={stopRecording}
                color="error"
              >
                Finalizar
              </Button>
            </>
          )}

          {/* Controles após gravação */}
          {recordingState === 'completed' && (
            <>
              <Button
                variant="outlined"
                startIcon={isPlaying ? <Pause /> : <PlayArrow />}
                onClick={isPlaying ? pausePlayback : playRecording}
                disabled={disabled}
              >
                {isPlaying ? 'Pausar' : 'Reproduzir'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<Delete />}
                onClick={deleteRecording}
                disabled={disabled}
                color="error"
              >
                Excluir
              </Button>
              <Button
                variant="contained"
                startIcon={transcriptionState === 'processing' || transcriptionState === 'streaming' ? 
                  <CircularProgress size={20} color="inherit" /> : <Send />
                }
                onClick={sendToTranscription}
                disabled={disabled || transcriptionState === 'processing' || transcriptionState === 'streaming'}
                color="primary"
              >
                {transcriptionState === 'processing' ? 'Processando...' : 
                 transcriptionState === 'streaming' ? 'Transcrevendo...' : 'Enviar para IA'}
              </Button>
            </>
          )}
        </CardActions>
      </Card>

      {/* Resultado da Transcrição */}
      {(transcriptionState !== 'idle' || transcriptionText) && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Transcrição
            </Typography>
            
            {transcriptionState === 'streaming' && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress />
                <Typography variant="caption" color="textSecondary">
                  Transcrevendo em tempo real...
                </Typography>
              </Box>
            )}
            
            {transcriptionText ? (
              <Typography 
                variant="body1" 
                sx={{ 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 1,
                  minHeight: 60,
                  border: '1px solid',
                  borderColor: 'grey.300'
                }}
              >
                {transcriptionText}
              </Typography>
            ) : (
              <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                {transcriptionState === 'processing' ? 'Processando áudio...' :
                 transcriptionState === 'streaming' ? 'Recebendo transcrição...' :
                 transcriptionState === 'error' ? 'Erro na transcrição' :
                 'Nenhuma transcrição disponível'}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}
    </Paper>
  );
};

export default AdvancedAudioRecorder;