/**
 * Simple Camera Capture Component for Analysis Workflow
 * Focuses on reliable image capture without complex backend integration
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
  FormControlLabel,
  Switch,
  Fab,
} from '@mui/material';
import {
  CameraAlt,
  PhotoCamera,
  Videocam,
  VideocamOff,
  GridOn,
  Refresh,
  FlashOn,
  FlashOff,
} from '@mui/icons-material';

interface SimpleCameraCaptureProps {
  onCapture?: (imageData: string) => void;
  onError?: (error: string) => void;
  showGrid?: boolean;
  width?: number;
  height?: number;
}

const SimpleCameraCapture: React.FC<SimpleCameraCaptureProps> = ({
  onCapture,
  onError,
  showGrid = true,
  width = 640,
  height = 480
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [gridOverlay, setGridOverlay] = useState(showGrid);
  const [captureCount, setCaptureCount] = useState(0);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
          facingMode: 'environment' // Use back camera on mobile
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setIsStreaming(true);
      
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
  }, [width, height, onError]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsStreaming(false);
  }, []);

  // Capture photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) {
      return;
    }
    
    setIsCapturing(true);
    
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) return;
      
      // Set canvas size to match video
      canvas.width = video.videoWidth || width;
      canvas.height = video.videoHeight || height;
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0);
      
      // Add grid overlay if enabled
      if (gridOverlay) {
        drawGridOverlay(context, canvas.width, canvas.height);
      }
      
      // Flash effect
      if (flashEnabled && videoRef.current) {
        videoRef.current.style.filter = 'brightness(2)';
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.style.filter = '';
          }
        }, 200);
      }
      
      // Convert to base64
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      
      if (onCapture) {
        onCapture(imageData);
      }
      
      setCaptureCount(prev => prev + 1);
      
    } catch (error) {
      console.error('Error capturing photo:', error);
      const errorMessage = 'Erro ao capturar imagem';
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setIsCapturing(false);
    }
  }, [isStreaming, gridOverlay, flashEnabled, width, height, onCapture, onError]);

  // Draw grid overlay
  const drawGridOverlay = (context: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 20; // pixels between lines
    
    // Grid lines
    context.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    context.lineWidth = 1;
    context.setLineDash([3, 3]);
    
    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    
    // Center lines
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
          <CameraAlt />
          Captura de Imagem da Biópsia
          {captureCount > 0 && (
            <Chip label={`${captureCount} capturada(s)`} size="small" color="success" />
          )}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
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
          
          {/* Grid Overlay (CSS-based for performance) */}
          {isStreaming && gridOverlay && (
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
                  rgba(0,255,0,0.4) 25%, 
                  rgba(0,255,0,0.4) 25.5%, 
                  transparent 26%
                ), 
                linear-gradient(
                  to bottom, 
                  transparent 24%, 
                  rgba(0,255,0,0.4) 25%, 
                  rgba(0,255,0,0.4) 25.5%, 
                  transparent 26%
                )`,
                backgroundSize: '20px 20px'
              }}
            />
          )}
          
          {/* Center cross for positioning */}
          {isStreaming && gridOverlay && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 40,
                height: 40,
                '&::before, &::after': {
                  content: '""',
                  position: 'absolute',
                  backgroundColor: 'rgba(255, 0, 0, 0.8)',
                },
                '&::before': {
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: 2,
                  transform: 'translateY(-50%)',
                },
                '&::after': {
                  left: '50%',
                  top: 0,
                  bottom: 0,
                  width: 2,
                  transform: 'translateX(-50%)',
                }
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
          
          {/* Capture Button */}
          {isStreaming && (
            <Fab
              color="primary"
              size="large"
              onClick={capturePhoto}
              disabled={isCapturing}
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)'
              }}
            >
              {isCapturing ? <CircularProgress size={24} /> : <PhotoCamera />}
            </Fab>
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
                {isStreaming ? 'Parar Câmera' : 'Iniciar Câmera'}
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<PhotoCamera />}
                onClick={capturePhoto}
                disabled={!isStreaming || isCapturing}
                size="small"
              >
                {isCapturing ? 'Capturando...' : 'Capturar'}
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={gridOverlay}
                    onChange={(e) => setGridOverlay(e.target.checked)}
                    size="small"
                  />
                }
                label="Grade"
              />
              
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

        {/* Status */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={isStreaming ? 'Câmera Ativa' : 'Câmera Parada'}
            size="small"
            color={isStreaming ? 'success' : 'default'}
            icon={isStreaming ? <Videocam /> : <VideocamOff />}
          />
          <Chip
            label={gridOverlay ? 'Grade Habilitada' : 'Grade Desabilitada'}
            size="small"
            color={gridOverlay ? 'info' : 'default'}
            icon={<GridOn />}
          />
          {captureCount > 0 && (
            <Chip
              label={`${captureCount} imagem(ns) capturada(s)`}
              size="small"
              color="success"
              icon={<PhotoCamera />}
            />
          )}
        </Box>

        {/* Instructions */}
        <Paper sx={{ p: 2, mt: 2, backgroundColor: 'info.light' }}>
          <Typography variant="body2" color="info.contrastText">
            <strong>🔬 Posicione a biópsia no centro da imagem sobre papel quadriculado</strong>
          </Typography>
          <Typography variant="caption" color="info.contrastText" sx={{ mt: 1, display: 'block' }}>
            • Use a cruz vermelha como referência para centralizar a amostra<br/>
            • Grade verde fornece escala para medições<br/>
            • Mantenha boa iluminação e câmera estável
          </Typography>
        </Paper>
      </CardContent>
    </Card>
  );
};

export default SimpleCameraCapture;