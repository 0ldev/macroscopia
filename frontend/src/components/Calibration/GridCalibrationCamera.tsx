/**
 * Simple Camera Component for Grid Calibration
 * Shows live camera feed with grid detection overlay
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
  Paper,
  Grid,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  CameraAlt,
  PhotoCamera,
  Videocam,
  VideocamOff,
  GridOn,
  CheckCircle,
  Warning,
  Refresh,
} from '@mui/icons-material';

interface GridCalibrationCameraProps {
  onGridDetected?: (calibrationData: {
    pixels_per_mm: number;
    confidence: number;
    grid_size_mm: number;
  }) => void;
  onError?: (error: string) => void;
  gridSizeMm?: number;
  cameraIndex?: number;
}

interface GridDetectionResult {
  grid_detected: boolean;
  confidence: number;
  horizontal_lines: number;
  vertical_lines: number;
  line_count: number;
  pixels_per_mm?: number;
}

const GridCalibrationCamera: React.FC<GridCalibrationCameraProps> = ({
  onGridDetected,
  onError,
  gridSizeMm = 5.0,
  cameraIndex = 0
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout>();
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gridDetection, setGridDetection] = useState<GridDetectionResult>({
    grid_detected: false,
    confidence: 0,
    horizontal_lines: 0,
    vertical_lines: 0,
    line_count: 0
  });
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'environment'
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setIsStreaming(true);
      startGridAnalysis();
      
    } catch (error: any) {
      console.error('Error starting camera:', error);
      let errorMessage = 'Erro ao acessar câmera';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permissão de câmera negada. Verifique as configurações do navegador.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Nenhuma câmera encontrada no dispositivo.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Câmera está sendo usada por outro aplicativo.';
      }
      
      setError(errorMessage);
      if (onError) onError(errorMessage);
    }
  }, [onError]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }
    
    setIsStreaming(false);
    setIsAnalyzing(false);
  }, []);

  // Capture current frame as base64
  const captureCurrentFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return null;
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    context.drawImage(video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  // Analyze grid in real-time using backend
  const analyzeGrid = useCallback(async () => {
    if (!isStreaming || isAnalyzing) return;
    
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(25);
      
      const frameData = captureCurrentFrame();
      if (!frameData) return;
      
      setAnalysisProgress(50);
      
      // Create FormData for backend API
      const formData = new FormData();
      const byteString = atob(frameData.split(',')[1]);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
      formData.append('image_file', blob, 'grid_detection.jpg');
      formData.append('grid_size_mm', gridSizeMm.toString());
      
      setAnalysisProgress(75);
      
      const response = await fetch('/api/vision/detect-grid-only', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.grid_detection) {
          setGridDetection(result.grid_detection);
          
          if (result.grid_detection.grid_detected && 
              result.grid_detection.confidence > 0.7 &&
              result.grid_detection.pixels_per_mm &&
              onGridDetected) {
            onGridDetected({
              pixels_per_mm: result.grid_detection.pixels_per_mm,
              confidence: result.grid_detection.confidence,
              grid_size_mm: gridSizeMm
            });
          }
        }
      }
      
      setAnalysisProgress(100);
      setLastAnalysisTime(new Date());
      
      // Reset progress after delay
      setTimeout(() => setAnalysisProgress(0), 1000);
      
    } catch (error) {
      console.error('Error in grid analysis:', error);
      setError('Erro na análise da grade');
    } finally {
      setIsAnalyzing(false);
    }
  }, [isStreaming, isAnalyzing, captureCurrentFrame, gridSizeMm, onGridDetected]);

  // Start continuous grid analysis
  const startGridAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }
    
    // Analyze every 2 seconds
    analysisIntervalRef.current = setInterval(analyzeGrid, 2000);
  }, [analyzeGrid]);

  // Manual capture for testing
  const manualCapture = useCallback(async () => {
    await analyzeGrid();
  }, [analyzeGrid]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GridOn />
          Câmera para Calibração de Grade
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {analysisProgress > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Analisando grade...
            </Typography>
            <LinearProgress variant="determinate" value={analysisProgress} />
          </Box>
        )}

        <Box sx={{ position: 'relative', textAlign: 'center', mb: 2 }}>
          {/* Video Element */}
          <video
            ref={videoRef}
            style={{
              width: '100%',
              maxWidth: 480,
              height: 'auto',
              borderRadius: 8,
              backgroundColor: '#000',
              objectFit: 'cover'
            }}
            playsInline
            muted
          />
          
          {/* Grid Overlay */}
          {isStreaming && gridDetection.grid_detected && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                borderRadius: 1,
                background: `linear-gradient(
                  to right, 
                  transparent 24%, 
                  rgba(0,255,0,0.3) 25%, 
                  rgba(0,255,0,0.3) 26%, 
                  transparent 27%
                ), 
                linear-gradient(
                  to bottom, 
                  transparent 24%, 
                  rgba(0,255,0,0.3) 25%, 
                  rgba(0,255,0,0.3) 26%, 
                  transparent 27%
                )`,
                backgroundSize: '20px 20px'
              }}
            />
          )}
          
          {/* Loading Indicator */}
          {!isStreaming && !error && (
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
        </Box>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Controls */}
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant={isStreaming ? "outlined" : "contained"}
                startIcon={isStreaming ? <VideocamOff /> : <Videocam />}
                onClick={isStreaming ? stopCamera : startCamera}
                size="small"
              >
                {isStreaming ? 'Parar' : 'Iniciar'}
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<PhotoCamera />}
                onClick={manualCapture}
                disabled={!isStreaming || isAnalyzing}
                size="small"
              >
                Testar
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                size="small"
                startIcon={<Refresh />}
                onClick={() => window.location.reload()}
              >
                Reiniciar
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Status Indicators */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={isStreaming ? 'Câmera Ativa' : 'Câmera Parada'}
            size="small"
            color={isStreaming ? 'success' : 'default'}
            icon={isStreaming ? <Videocam /> : <VideocamOff />}
          />
          <Chip
            label={gridDetection.grid_detected ? 'Grade Detectada' : 'Buscando Grade'}
            size="small"
            color={gridDetection.grid_detected ? 'success' : 'default'}
            icon={gridDetection.grid_detected ? <CheckCircle /> : <Warning />}
          />
          {gridDetection.grid_detected && (
            <Chip
              label={`Confiança: ${Math.round(gridDetection.confidence * 100)}%`}
              size="small"
              color={gridDetection.confidence > 0.7 ? 'success' : 'warning'}
            />
          )}
        </Box>

        {/* Grid Detection Info */}
        {gridDetection.grid_detected && (
          <Paper sx={{ p: 2, mt: 2, backgroundColor: 'success.light' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle color="success" />
              Grade Detectada com Sucesso
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="caption">
                  Linhas H: {gridDetection.horizontal_lines}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption">
                  Linhas V: {gridDetection.vertical_lines}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption">
                  Total: {gridDetection.line_count}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption">
                  Confiança: {Math.round(gridDetection.confidence * 100)}%
                </Typography>
              </Grid>
              {gridDetection.pixels_per_mm && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="success.main">
                    ✓ Calibração: {gridDetection.pixels_per_mm.toFixed(2)} pixels/mm
                  </Typography>
                </Grid>
              )}
            </Grid>
            {lastAnalysisTime && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                Última análise: {lastAnalysisTime.toLocaleTimeString()}
              </Typography>
            )}
          </Paper>
        )}

        {/* Instructions */}
        <Paper sx={{ p: 2, mt: 2, backgroundColor: 'info.light' }}>
          <Typography variant="body2" color="info.contrastText">
            <strong>📐 Posicione papel quadriculado de {gridSizeMm}mm na frente da câmera</strong>
          </Typography>
          <Typography variant="caption" color="info.contrastText" sx={{ mt: 1, display: 'block' }}>
            • Mantenha a câmera estável<br/>
            • Certifique-se de que o papel está bem iluminado<br/>
            • A grade será detectada automaticamente a cada 2 segundos
          </Typography>
        </Paper>
      </CardContent>
    </Card>
  );
};

export default GridCalibrationCamera;