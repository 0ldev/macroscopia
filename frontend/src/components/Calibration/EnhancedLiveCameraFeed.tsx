/**
 * Enhanced Live Camera Feed with real-time grid detection and measurement overlays
 * Integrates with backend vision service for automatic calibration and measurements
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
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
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
  AutoAwesome,
  CheckCircle,
  Warning,
  ExpandMore,
  Visibility,
} from '@mui/icons-material';
import VisionService from '../../services/visionService';

interface EnhancedLiveCameraFeedProps {
  mode: 'calibration' | 'analysis';
  onCapture?: (imageData: string) => void;
  onMeasurement?: (measurements: any) => void;
  onGridCalibration?: (calibrationData: any) => void;
  onError?: (error: string) => void;
  gridOverlay?: boolean;
  measurementOverlay?: boolean;
  realTimeAnalysis?: boolean;
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

interface GridDetectionResult {
  grid_detected: boolean;
  confidence: number;
  horizontal_lines: number;
  vertical_lines: number;
  line_count: number;
  pixels_per_mm?: number;
}

interface MeasurementResult {
  success: boolean;
  measurements?: {
    area_mm2: number;
    perimeter_mm: number;
    length_max_mm: number;
    width_max_mm: number;
    equivalent_diameter_mm: number;
    circularity: number;
    aspect_ratio: number;
    solidity: number;
    extent: number;
    confidence_overall?: number;
    pixels_per_mm: number;
  };
  overlay_image?: string;
}

interface CameraState {
  isStreaming: boolean;
  isCapturing: boolean;
  hasPermission: boolean;
  deviceId: string | null;
  error: string | null;
}

const EnhancedLiveCameraFeed: React.FC<EnhancedLiveCameraFeedProps> = ({
  mode,
  onCapture,
  onMeasurement,
  onGridCalibration,
  onError,
  gridOverlay = true,
  measurementOverlay = false,
  realTimeAnalysis = false,
  showControls = true,
  width = 640,
  height = 480,
  cameraSettings
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout>(null);
  
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
  const [showMeasurements, setShowMeasurements] = useState(measurementOverlay);
  const [autoAnalysis, setAutoAnalysis] = useState(realTimeAnalysis);
  const [flashEnabled, setFlashEnabled] = useState(false);
  
  // Real-time analysis state
  const [gridDetection, setGridDetection] = useState<GridDetectionResult>({
    grid_detected: false,
    confidence: 0,
    horizontal_lines: 0,
    vertical_lines: 0,
    line_count: 0
  });
  const [currentMeasurements, setCurrentMeasurements] = useState<MeasurementResult['measurements']>();
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);

  // Listar dispositivos de câmera disponíveis
  const getAvailableDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      
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
        await videoRef.current.play();
        
        // Configurar canvas de overlay
        if (overlayCanvasRef.current && videoRef.current) {
          const canvas = overlayCanvasRef.current;
          canvas.width = videoRef.current.videoWidth || width;
          canvas.height = videoRef.current.videoHeight || height;
        }
      }
      
      setState(prev => ({ 
        ...prev, 
        isStreaming: true, 
        hasPermission: true,
        error: null 
      }));
      
      // Iniciar análise em tempo real se habilitada
      if (autoAnalysis) {
        startRealTimeAnalysis();
      }
      
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
  }, [state.deviceId, cameraSettings, width, height, mode, autoAnalysis, onError]);

  // Parar stream da câmera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Parar análise em tempo real
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }
    
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  // Capturar frame atual como base64
  const captureCurrentFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return null;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.9);
  }, []);

  // Análise em tempo real via backend
  const performRealTimeAnalysis = useCallback(async () => {
    if (!videoRef.current || !state.isStreaming) return;
    
    try {
      setAnalysisProgress(25);
      
      const frameData = captureCurrentFrame();
      if (!frameData) return;
      
      setAnalysisProgress(50);
      
      // Detectar grade
      if (showGrid) {
        const gridResult = await VisionService.detectGrid(frameData, 5.0);
        if (gridResult.grid_detection) {
          setGridDetection(gridResult.grid_detection);
          
          if (gridResult.grid_detection.grid_detected && onGridCalibration) {
            onGridCalibration({
              pixels_per_mm: gridResult.grid_detection.pixels_per_mm || 0,
              confidence: gridResult.grid_detection.confidence,
              grid_size_mm: 5.0
            });
          }
        }
      }
      
      setAnalysisProgress(75);
      
      // Medir biópsia se habilitado
      if (showMeasurements && mode === 'analysis') {
        const measureResult = await VisionService.analyzeBiopsy(frameData, 5.0, true);
        if (measureResult.success && measureResult.measurements) {
          setCurrentMeasurements(measureResult.measurements);
          
          if (onMeasurement) {
            onMeasurement(measureResult.measurements);
          }
        }
      }
      
      setAnalysisProgress(100);
      setLastAnalysisTime(new Date());
      
      // Reset progress after delay
      setTimeout(() => setAnalysisProgress(0), 1000);
      
    } catch (error) {
      console.error('Erro na análise em tempo real:', error);
      setAnalysisProgress(0);
    }
  }, [captureCurrentFrame, state.isStreaming, showGrid, showMeasurements, mode, onGridCalibration, onMeasurement]);

  // Iniciar análise em tempo real
  const startRealTimeAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }
    
    // Analisar a cada 3 segundos
    analysisIntervalRef.current = setInterval(performRealTimeAnalysis, 3000);
  }, [performRealTimeAnalysis]);

  // Capturar foto com análise completa
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !state.isStreaming) {
      return;
    }
    
    setState(prev => ({ ...prev, isCapturing: true }));
    
    try {
      const frameData = captureCurrentFrame();
      if (!frameData) return;
      
      // Flash effect
      if (flashEnabled && videoRef.current) {
        videoRef.current.style.filter = 'brightness(2)';
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.style.filter = '';
          }
        }, 200);
      }
      
      // Análise completa no backend
      const result = await VisionService.analyzeBiopsy(frameData, 5.0, true);
      
      if (result.success) {
        // Usar overlay processado pelo backend se disponível
        const finalImage = result.overlay_image ? 
          `data:image/jpeg;base64,${result.overlay_image}` : 
          frameData;
        
        if (onCapture) {
          onCapture(finalImage);
        }
        
        if (result.measurements && onMeasurement) {
          onMeasurement(result.measurements);
        }
        
        // Atualizar estado local
        if (result.grid_detection) {
          setGridDetection(result.grid_detection);
        }
        if (result.measurements) {
          setCurrentMeasurements(result.measurements);
        }
      } else {
        throw new Error('Falha na análise da imagem: ' + result.errors.join(', '));
      }
      
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      setState(prev => ({ ...prev, error: 'Erro ao capturar imagem' }));
    } finally {
      setState(prev => ({ ...prev, isCapturing: false }));
    }
  }, [state.isStreaming, flashEnabled, captureCurrentFrame, onCapture, onMeasurement]);

  // Desenhar overlays em tempo real
  const drawOverlays = useCallback(() => {
    if (!overlayCanvasRef.current || !videoRef.current) return;
    
    const canvas = overlayCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Limpar canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Grid overlay
    if (showGrid && gridDetection.grid_detected) {
      const gridSize = 20; // pixels aproximado entre linhas
      context.strokeStyle = gridDetection.confidence > 0.7 ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 255, 0, 0.6)';
      context.lineWidth = 1;
      context.setLineDash([3, 3]);
      
      // Linhas verticais
      for (let x = 0; x <= canvas.width; x += gridSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
      }
      
      // Linhas horizontais
      for (let y = 0; y <= canvas.height; y += gridSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
      }
      
      // Linha central
      context.setLineDash([]);
      context.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(canvas.width / 2, 0);
      context.lineTo(canvas.width / 2, canvas.height);
      context.moveTo(0, canvas.height / 2);
      context.lineTo(canvas.width, canvas.height / 2);
      context.stroke();
    }
    
    // Measurement overlay
    if (showMeasurements && currentMeasurements && mode === 'analysis') {
      // Simular posição da biópsia no centro
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 50; // Placeholder para visualização
      
      // Desenhar contorno da biópsia
      context.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      context.lineWidth = 3;
      context.setLineDash([]);
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      context.stroke();
      
      // Texto com medições
      context.fillStyle = 'rgba(0, 0, 0, 0.7)';
      context.fillRect(10, 10, 250, 120);
      
      context.fillStyle = 'white';
      context.font = '14px Arial';
      const measurements = [
        `Área: ${currentMeasurements.area_mm2} mm²`,
        `Comp.: ${currentMeasurements.length_max_mm} mm`,
        `Larg.: ${currentMeasurements.width_max_mm} mm`,
        `Perímetro: ${currentMeasurements.perimeter_mm} mm`,
        `Circularidade: ${currentMeasurements.circularity.toFixed(3)}`
      ];
      
      measurements.forEach((text, index) => {
        context.fillText(text, 15, 30 + index * 20);
      });
    }
  }, [showGrid, showMeasurements, gridDetection, currentMeasurements, mode]);

  // Redesenhar overlays quando necessário
  useEffect(() => {
    const interval = setInterval(drawOverlays, 100); // 10 FPS para overlays
    return () => clearInterval(interval);
  }, [drawOverlays]);

  // Toggle análise automática
  const toggleAutoAnalysis = useCallback(() => {
    setAutoAnalysis(prev => {
      const newValue = !prev;
      if (newValue && state.isStreaming) {
        startRealTimeAnalysis();
      } else if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
      return newValue;
    });
  }, [state.isStreaming, startRealTimeAnalysis]);

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
    <Card sx={{ width: '100%', maxWidth: isFullscreen ? '100vw' : 900 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraAlt />
            {mode === 'calibration' ? 'Calibração com Detecção Automática' : 'Análise com Medição em Tempo Real'}
            {autoAnalysis && (
              <Badge color="success" variant="dot">
                <AutoAwesome sx={{ ml: 1, fontSize: 20 }} />
              </Badge>
            )}
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

        {analysisProgress > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Analisando em tempo real...
            </Typography>
            <LinearProgress variant="determinate" value={analysisProgress} />
          </Box>
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
          
          {/* Overlay Canvas */}
          <canvas
            ref={overlayCanvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              borderRadius: 8
            }}
          />
          
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
          {state.isStreaming && (
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

        {/* Enhanced Controls */}
        {showControls && (
          <Box sx={{ mt: 2 }}>
            {/* Main Controls */}
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
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
                  
                  <Button
                    variant="outlined"
                    startIcon={<PhotoCamera />}
                    onClick={capturePhoto}
                    disabled={state.isCapturing || !state.isStreaming}
                    size="small"
                  >
                    {state.isCapturing ? 'Capturando...' : 'Capturar'}
                  </Button>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        size="small"
                      />
                    }
                    label="Grade"
                    sx={{ fontSize: '0.8rem' }}
                  />
                  
                  {mode === 'analysis' && (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showMeasurements}
                          onChange={(e) => setShowMeasurements(e.target.checked)}
                          size="small"
                        />
                      }
                      label="Medições"
                      sx={{ fontSize: '0.8rem' }}
                    />
                  )}
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoAnalysis}
                        onChange={toggleAutoAnalysis}
                        size="small"
                        color="success"
                      />
                    }
                    label="Auto"
                    sx={{ fontSize: '0.8rem' }}
                  />
                  
                  <IconButton onClick={() => setFlashEnabled(!flashEnabled)} size="small">
                    {flashEnabled ? <FlashOn color="warning" /> : <FlashOff />}
                  </IconButton>
                </Box>
              </Grid>
            </Grid>

            {/* Real-time Status */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Visibility />
                  Status da Análise em Tempo Real
                  {lastAnalysisTime && (
                    <Typography variant="caption" color="textSecondary">
                      (última: {lastAnalysisTime.toLocaleTimeString()})
                    </Typography>
                  )}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {/* Grid Detection Status */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, backgroundColor: gridDetection.grid_detected ? 'success.light' : 'grey.100' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {gridDetection.grid_detected ? <CheckCircle color="success" /> : <Warning color="warning" />}
                        Detecção de Grade
                      </Typography>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="caption">
                            Confiança: {Math.round(gridDetection.confidence * 100)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption">
                            Linhas: {gridDetection.line_count}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption">
                            H: {gridDetection.horizontal_lines}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption">
                            V: {gridDetection.vertical_lines}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>

                  {/* Measurements Status */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, backgroundColor: currentMeasurements ? 'info.light' : 'grey.100' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {currentMeasurements ? <CheckCircle color="success" /> : <Warning color="warning" />}
                        Medições da Biópsia
                      </Typography>
                      {currentMeasurements ? (
                        <Grid container spacing={1}>
                          <Grid item xs={12}>
                            <Typography variant="caption">
                              Área: {currentMeasurements.area_mm2} mm²
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="caption">
                              Dim: {currentMeasurements.length_max_mm}×{currentMeasurements.width_max_mm} mm
                            </Typography>
                          </Grid>
                        </Grid>
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          Aguardando detecção...
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

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
              <Chip
                label={showGrid ? 'Grade ON' : 'Grade OFF'}
                size="small"
                color={showGrid && gridDetection.grid_detected ? 'success' : 'default'}
                icon={<GridOn />}
              />
              {mode === 'analysis' && (
                <Chip
                  label={showMeasurements ? 'Medições ON' : 'Medições OFF'}
                  size="small"
                  color={showMeasurements && currentMeasurements ? 'success' : 'default'}
                  icon={<Visibility />}
                />
              )}
              <Chip
                label={autoAnalysis ? 'Auto Análise' : 'Manual'}
                size="small"
                color={autoAnalysis ? 'success' : 'default'}
                icon={<AutoAwesome />}
              />
            </Box>

            {/* Instructions */}
            <Paper sx={{ p: 2, mt: 2, backgroundColor: 'info.light' }}>
              <Typography variant="body2" color="info.contrastText">
                <strong>
                  {mode === 'calibration' 
                    ? '📏 Posicione papel quadriculado na frente da câmera. Grade será detectada automaticamente.'
                    : '🔬 Posicione a amostra sobre papel quadriculado. Medições em tempo real quando "Auto" estiver ativo.'
                  }
                </strong>
              </Typography>
              {mode === 'analysis' && (
                <Typography variant="caption" color="info.contrastText" sx={{ mt: 1, display: 'block' }}>
                  • Grade vermelha: linha central para posicionamento<br/>
                  • Grade verde: calibração detectada com sucesso<br/>
                  • Contorno verde: biópsia detectada automaticamente<br/>
                  • Análise automática a cada 3 segundos quando ativa
                </Typography>
              )}
            </Paper>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedLiveCameraFeed;