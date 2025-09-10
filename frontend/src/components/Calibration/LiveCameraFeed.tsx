/**
 * Componente de feed de câmera ao vivo
 * Para calibração e análise de biópsias
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Paper,
  Grid,
  Chip,
  IconButton,
  Fab,
} from '@mui/material';
import {
  CameraAlt,
  PhotoCamera,
  Videocam,
  VideocamOff,
  GridOn,
  Fullscreen,
  FullscreenExit,
  Settings,
  Refresh,
  FlashOn,
  FlashOff,
} from '@mui/icons-material';

interface LiveCameraFeedProps {
  mode: 'calibration' | 'analysis';
  onCapture?: (imageData: string) => void;
  onError?: (error: string) => void;
  gridOverlay?: boolean;
  showControls?: boolean;
  width?: number;
  height?: number;
  cameraSettings?: {
    deviceId?: string;
    width?: number;
    height?: number;
    facingMode?: 'user' | 'environment';
  };
}

interface CameraState {
  isStreaming: boolean;
  isCapturing: boolean;
  hasPermission: boolean;
  deviceId: string | null;
  error: string | null;
}

const LiveCameraFeed: React.FC<LiveCameraFeedProps> = ({
  mode,
  onCapture,
  onError,
  gridOverlay = false,
  showControls = true,
  width = 640,
  height = 480,
  cameraSettings
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [state, setState] = useState<CameraState>({
    isStreaming: false,
    isCapturing: false,
    hasPermission: false,
    deviceId: null,
    error: null
  });
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(gridOverlay);
  const [flashEnabled, setFlashEnabled] = useState(false);

  // Listar dispositivos de câmera disponíveis
  const getAvailableDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      
      // Se não há deviceId configurado, usar o primeiro dispositivo disponível
      if (!state.deviceId && videoDevices.length > 0) {
        setState(prev => ({ ...prev, deviceId: videoDevices[0].deviceId }));
      }
    } catch (error) {
      console.error('Erro ao listar dispositivos:', error);
      setState(prev => ({ ...prev, error: 'Erro ao acessar dispositivos de câmera' }));
    }
  }, [state.deviceId]);

  // Iniciar stream da câmera
  const startCamera = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null, isStreaming: true }));
      
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: cameraSettings?.deviceId || state.deviceId || undefined,
          width: { ideal: cameraSettings?.width || width },
          height: { ideal: cameraSettings?.height || height },
          facingMode: cameraSettings?.facingMode || (mode === 'analysis' ? 'environment' : 'user'),
          frameRate: { ideal: 30 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setState(prev => ({ 
        ...prev, 
        isStreaming: true, 
        hasPermission: true,
        error: null 
      }));
    } catch (error: any) {
      console.error('Erro ao iniciar câmera:', error);
      let errorMessage = 'Erro ao acessar câmera';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permissão de câmera negada. Verifique as configurações do navegador.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Nenhuma câmera encontrada no dispositivo.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Câmera está sendo usada por outro aplicativo.';
      }
      
      setState(prev => ({ ...prev, error: errorMessage, isStreaming: false }));
      if (onError) onError(errorMessage);
    }
  }, [state.deviceId, cameraSettings, width, height, mode, onError]);

  // Parar stream da câmera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  // Capturar foto
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !state.isStreaming) {
      return;
    }
    
    setState(prev => ({ ...prev, isCapturing: true }));
    
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) return;
      
      // Configurar tamanho do canvas para corresponder ao vídeo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Desenhar frame do vídeo no canvas
      context.drawImage(video, 0, 0);
      
      // Se modo análise e grid overlay habilitado, desenhar grid
      if (mode === 'analysis' && showGrid) {
        drawGridOverlay(context, canvas.width, canvas.height);
      }
      
      // Converter para base64
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      
      // Flash effect (simulado)
      if (flashEnabled && videoRef.current) {
        videoRef.current.style.filter = 'brightness(2)';
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.style.filter = '';
          }
        }, 200);
      }
      
      if (onCapture) {
        onCapture(imageData);
      }
      
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      setState(prev => ({ ...prev, error: 'Erro ao capturar imagem' }));
    } finally {
      setState(prev => ({ ...prev, isCapturing: false }));
    }
  }, [state.isStreaming, mode, showGrid, flashEnabled, onCapture]);

  // Desenhar overlay de grid para referência
  const drawGridOverlay = (context: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 20; // pixels entre linhas da grade
    
    context.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    context.lineWidth = 1;
    context.setLineDash([5, 5]);
    
    // Linhas verticais
    for (let x = 0; x <= width; x += gridSize) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    
    // Linhas horizontais
    for (let y = 0; y <= height; y += gridSize) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    
    // Linha central
    context.setLineDash([]);
    context.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height);
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.stroke();
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Solicitar permissões e iniciar câmera quando componente é montado
  useEffect(() => {
    getAvailableDevices();
    
    return () => {
      stopCamera();
    };
  }, [getAvailableDevices, stopCamera]);

  // Iniciar câmera automaticamente se há permissão
  useEffect(() => {
    if (state.hasPermission && !state.isStreaming && state.deviceId) {
      startCamera();
    }
  }, [state.hasPermission, state.isStreaming, state.deviceId, startCamera]);

  return (
    <Card sx={{ width: '100%', maxWidth: isFullscreen ? '100vw' : 800 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraAlt />
            {mode === 'calibration' ? 'Calibração da Câmera' : 'Captura de Biópsia'}
          </Typography>
          
          {showControls && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton onClick={toggleFullscreen} size="small">
                {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
              <IconButton onClick={getAvailableDevices} size="small">
                <Refresh />
              </IconButton>
            </Box>
          )}
        </Box>

        {state.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {state.error}
          </Alert>
        )}

        <Box sx={{ position: 'relative', textAlign: 'center' }}>
          {/* Video Element */}
          <video
            ref={videoRef}
            style={{
              width: '100%',
              maxWidth: width,
              height: 'auto',
              borderRadius: 8,
              backgroundColor: '#000',
              objectFit: 'cover'
            }}
            playsInline
            muted
          />
          
          {/* Grid Overlay (Live) */}
          {mode === 'analysis' && showGrid && state.isStreaming && (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
              viewBox={`0 0 ${width} ${height}`}
            >
              <defs>
                <pattern
                  id="grid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="rgba(0, 255, 0, 0.5)"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* Linhas centrais */}
              <line
                x1={width / 2}
                y1="0"
                x2={width / 2}
                y2={height}
                stroke="rgba(255, 0, 0, 0.7)"
                strokeWidth="2"
              />
              <line
                x1="0"
                y1={height / 2}
                x2={width}
                y2={height / 2}
                stroke="rgba(255, 0, 0, 0.7)"
                strokeWidth="2"
              />
            </svg>
          )}
          
          {/* Loading Indicator */}
          {!state.isStreaming && !state.error && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center'
              }}
            >
              <CircularProgress size={40} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Iniciando câmera...
              </Typography>
            </Box>
          )}
          
          {/* Capture Button */}
          {state.isStreaming && mode === 'analysis' && (
            <Fab
              color="primary"
              size="large"
              onClick={capturePhoto}
              disabled={state.isCapturing}
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)'
              }}
            >
              {state.isCapturing ? <CircularProgress size={24} /> : <PhotoCamera />}
            </Fab>
          )}
        </Box>

        {/* Canvas escondido para captura */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Controls */}
        {showControls && (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2} alignItems="center">
              {/* Camera Controls */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Button
                    variant={state.isStreaming ? "outlined" : "contained"}
                    startIcon={state.isStreaming ? <VideocamOff /> : <Videocam />}
                    onClick={state.isStreaming ? stopCamera : startCamera}
                    size="small"
                  >
                    {state.isStreaming ? 'Parar' : 'Iniciar'}
                  </Button>
                  
                  {mode === 'calibration' && state.isStreaming && (
                    <Button
                      variant="outlined"
                      startIcon={<PhotoCamera />}
                      onClick={capturePhoto}
                      disabled={state.isCapturing}
                      size="small"
                    >
                      {state.isCapturing ? 'Capturando...' : 'Capturar'}
                    </Button>
                  )}
                </Box>
              </Grid>

              {/* Settings */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                  {mode === 'analysis' && (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showGrid}
                          onChange={(e) => setShowGrid(e.target.checked)}
                          size="small"
                        />
                      }
                      label="Grid"
                      sx={{ fontSize: '0.8rem' }}
                    />
                  )}
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={flashEnabled}
                        onChange={(e) => setFlashEnabled(e.target.checked)}
                        size="small"
                      />
                    }
                    label={<FlashOn />}
                  />
                </Box>
              </Grid>
            </Grid>

            {/* Status Indicators */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={`${devices.length} câmeras`}
                size="small"
                color="info"
                icon={<CameraAlt />}
              />
              <Chip
                label={state.isStreaming ? 'Ativo' : 'Parado'}
                size="small"
                color={state.isStreaming ? 'success' : 'default'}
                icon={state.isStreaming ? <Videocam /> : <VideocamOff />}
              />
              {mode === 'analysis' && (
                <Chip
                  label={showGrid ? 'Grid ON' : 'Grid OFF'}
                  size="small"
                  color={showGrid ? 'success' : 'default'}
                  icon={<GridOn />}
                />
              )}
            </Box>

            {/* Instructions */}
            <Paper sx={{ p: 2, mt: 2, backgroundColor: 'info.light' }}>
              <Typography variant="body2" color="info.contrastText">
                <strong>
                  {mode === 'calibration' 
                    ? '📏 Posicione papel quadriculado na frente da câmera para calibração'
                    : '🔬 Posicione a amostra sobre papel quadriculado e clique para capturar'
                  }
                </strong>
              </Typography>
              {mode === 'analysis' && (
                <Typography variant="caption" color="info.contrastText" sx={{ mt: 1, display: 'block' }}>
                  • Grid vermelho indica centro da imagem<br/>
                  • Grid verde fornece escala de referência<br/>
                  • Mantenha câmera fixa durante captura
                </Typography>
              )}
            </Paper>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveCameraFeed;