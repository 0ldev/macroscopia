import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Grid,
  Card,
  CardContent,
  IconButton,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  Chip,
  Divider,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  CloudUpload,
  Mic,
  MicOff,
  PlayArrow,
  Stop,
  PhotoCamera,
  Biotech,
  Description,
  ExpandMore,
  Download,
  Share,
  Visibility,
  AutoFixHigh,
  Wifi,
  WifiOff,
  Circle,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import type { 
  VisionAnalysisResult,
  BiopsyMeasurements 
} from '../types/vision';
import type {
  TranscriptionResult,
  DataExtractionResult,
  ReportGenerationResult,
  CompleteAnalysisResult
} from '../types/ai';
import { useWebSocket } from '../hooks/useWebSocket';

// Styled Components
interface UploadAreaProps { isDragging: boolean }
const UploadArea = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'isDragging'
})<UploadAreaProps>(({ theme, isDragging }) => ({
  padding: theme.spacing(4),
  textAlign: 'center',
  border: `2px dashed ${isDragging ? theme.palette.primary.main : theme.palette.grey[300]}`,
  backgroundColor: isDragging ? theme.palette.primary.light + '10' : theme.palette.background.paper,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.primary.light + '05',
  },
}));

interface RecordingButtonProps { isRecording: boolean }
const RecordingButton = styled(Fab, {
  shouldForwardProp: (prop) => prop !== 'isRecording'
})<RecordingButtonProps>(({ theme, isRecording }) => ({
  width: 80,
  height: 80,
  backgroundColor: isRecording ? theme.palette.error.main : theme.palette.primary.main,
  '&:hover': {
    backgroundColor: isRecording ? theme.palette.error.dark : theme.palette.primary.dark,
  },
  animation: isRecording ? 'pulse 1.5s infinite' : 'none',
  '@keyframes pulse': {
    '0%': {
      boxShadow: `0 0 0 0 ${theme.palette.error.main}40`,
    },
    '70%': {
      boxShadow: `0 0 0 10px ${theme.palette.error.main}00`,
    },
    '100%': {
      boxShadow: `0 0 0 0 ${theme.palette.error.main}00`,
    },
  },
}));

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
      {value === index && children}
    </div>
  );
}

interface AnalysisStep {
  label: string;
  description: string;
  completed: boolean;
  error?: string;
}

export default function Analysis() {
  // Generate unique session ID for this analysis session
  const sessionId = useMemo(() => `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, []);
  
  // WebSocket Integration
  const {
    isConnected,
    connectionStatus,
    progress: wsProgress,
    lastMessage,
    sendMessage,
    startVisionAnalysis,
    startTranscription,
    startCompleteAnalysis,
    error: wsError
  } = useWebSocket(sessionId);
  
  // State Management
  const [activeStep, setActiveStep] = useState(0);
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([
    { label: 'Preparar Amostras', description: 'Carregar imagem e/ou gravar áudio', completed: false },
    { label: 'Análise de Visão', description: 'Processamento da imagem com IA', completed: false },
    { label: 'Transcrição de Áudio', description: 'Conversão de fala para texto', completed: false },
    { label: 'Extração de Dados', description: 'Análise inteligente do conteúdo', completed: false },
    { label: 'Geração de Relatório', description: 'Criação do laudo final', completed: false },
  ]);
  
  // File Management
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout>();
  
  // Analysis Results
  const [visionResult, setVisionResult] = useState<VisionAnalysisResult | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [extractionResult, setExtractionResult] = useState<DataExtractionResult | null>(null);
  const [reportResult, setReportResult] = useState<ReportGenerationResult | null>(null);
  const [completeResult, setCompleteResult] = useState<CompleteAnalysisResult | null>(null);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [reportDialog, setReportDialog] = useState(false);
  const [realTimeMode, setRealTimeMode] = useState(true); // Toggle between WebSocket and REST
  
  // File Input References
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // File Upload Handlers
  const handleImageUpload = useCallback((file: File) => {
    if (file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      updateStepCompletion(0, true);
    } else {
      setError('Por favor, selecione um arquivo de imagem válido.');
    }
  }, []);

  const handleAudioUpload = useCallback((file: File) => {
    if (file.type.startsWith('audio/')) {
      setAudioFile(file);
      updateStepCompletion(0, true);
    } else {
      setError('Por favor, selecione um arquivo de áudio válido.');
    }
  }, []);

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(f => f.type.startsWith('image/'));
    const audioFile = files.find(f => f.type.startsWith('audio/'));
    
    if (imageFile) handleImageUpload(imageFile);
    if (audioFile) handleAudioUpload(audioFile);
  }, [handleImageUpload, handleAudioUpload]);

  // Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const file = new File([blob], 'recording.wav', { type: 'audio/wav' });
        setAudioFile(file);
        updateStepCompletion(0, true);
      };

      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      recorder.start();

      recordingInterval.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      setError('Erro ao acessar microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    }
  };

  // Step Management
  const updateStepCompletion = (stepIndex: number, completed: boolean, error?: string) => {
    setAnalysisSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, completed, error } : step
    ));
  };

  // Analysis Functions
  const runVisionAnalysis = async () => {
    if (!imageFile) return;
    
    setLoading(true);
    setActiveStep(1);
    
    try {
      const formData = new FormData();
      formData.append('image_file', imageFile);
      formData.append('grid_size_mm', '5.0');
      formData.append('use_calibration', 'true');

      const response = await fetch('/api/vision/analyze-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Erro na análise de visão');
      
      const result: VisionAnalysisResult = await response.json();
      setVisionResult(result);
      updateStepCompletion(1, result.success, result.success ? undefined : 'Análise de visão falhou');
    } catch (error) {
      updateStepCompletion(1, false, 'Erro na análise de visão');
      setError('Erro na análise de visão computacional');
    } finally {
      setLoading(false);
    }
  };

  const runAudioTranscription = async () => {
    if (!audioFile) return;
    
    setLoading(true);
    setActiveStep(2);
    
    try {
      const formData = new FormData();
      formData.append('audio_file', audioFile);

      const response = await fetch('/api/ai/transcribe-audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Erro na transcrição');
      
      const result: TranscriptionResult = await response.json();
      setTranscriptionResult(result);
      updateStepCompletion(2, result.success, result.success ? undefined : 'Transcrição falhou');
    } catch (error) {
      updateStepCompletion(2, false, 'Erro na transcrição de áudio');
      setError('Erro na transcrição de áudio');
    } finally {
      setLoading(false);
    }
  };

  const runDataExtraction = async () => {
    if (!transcriptionResult?.success) return;
    
    setLoading(true);
    setActiveStep(3);
    
    try {
      const formData = new FormData();
      formData.append('transcription_text', transcriptionResult.text);
      if (visionResult?.success && visionResult.measurements) {
        formData.append('vision_measurements', JSON.stringify(visionResult.measurements));
      }

      const response = await fetch('/api/ai/extract-biopsy-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Erro na extração de dados');
      
      const result: DataExtractionResult = await response.json();
      setExtractionResult(result);
      updateStepCompletion(3, result.success, result.success ? undefined : 'Extração de dados falhou');
    } catch (error) {
      updateStepCompletion(3, false, 'Erro na extração de dados');
      setError('Erro na extração de dados estruturados');
    } finally {
      setLoading(false);
    }
  };

  const runReportGeneration = async () => {
    if (!extractionResult?.success) return;
    
    setLoading(true);
    setActiveStep(4);
    
    try {
      const payload = {
        structured_data: extractionResult.structured_data,
        vision_measurements: visionResult?.success ? visionResult.measurements : null,
        transcription_text: transcriptionResult?.success ? transcriptionResult.text : null,
      };

      const response = await fetch('/api/ai/generate-report', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Erro na geração do relatório');
      
      const result: ReportGenerationResult = await response.json();
      setReportResult(result);
      updateStepCompletion(4, result.success, result.success ? undefined : 'Geração do relatório falhou');
    } catch (error) {
      updateStepCompletion(4, false, 'Erro na geração do relatório');
      setError('Erro na geração do relatório');
    } finally {
      setLoading(false);
    }
  };

  const runCompleteAnalysis = async () => {
    if (!imageFile && !audioFile) {
      setError('Por favor, forneça pelo menos uma imagem ou áudio para análise.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Use WebSocket for real-time analysis if connected
    if (realTimeMode && isConnected) {
      try {
        let transcriptionText = '';
        
        // If we have audio, first transcribe it
        if (audioFile) {
          const reader = new FileReader();
          reader.onload = async () => {
            const audioBase64 = reader.result as string;
            startTranscription(audioBase64);
          };
          reader.readAsDataURL(audioFile);
          
          // Wait for transcription to complete (simplified)
          await new Promise(resolve => setTimeout(resolve, 3000));
          transcriptionText = 'Transcrição simulada via WebSocket';
        }
        
        // Start vision analysis if we have an image
        if (imageFile) {
          const reader = new FileReader();
          reader.onload = async () => {
            const imageBase64 = reader.result as string;
            startVisionAnalysis(imageBase64);
          };
          reader.readAsDataURL(imageFile);
        }
        
        // Start complete analysis with structured functions
        setTimeout(() => {
          startCompleteAnalysis(
            transcriptionText || 'Análise baseada apenas em imagem',
            wsProgress.vision_analysis.data
          );
        }, 2000);
        
        setLoading(false);
        return;
      } catch (error) {
        console.error('Erro na análise WebSocket:', error);
        setError('Erro na análise em tempo real. Usando modo clássico.');
      }
    }
    
    try {
      const formData = new FormData();
      if (imageFile) formData.append('image_file', imageFile);
      if (audioFile) formData.append('audio_file', audioFile);
      formData.append('grid_size_mm', '5.0');
      formData.append('use_calibration', 'true');

      const response = await fetch('/api/ai/complete-analysis', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Erro na análise completa');
      
      const result: CompleteAnalysisResult = await response.json();
      setCompleteResult(result);
      
      // Update individual results
      if (result.vision_analysis) setVisionResult(result.vision_analysis);
      if (result.transcription) setTranscriptionResult(result.transcription);
      if (result.structured_data) setExtractionResult(result.structured_data);
      if (result.final_report) setReportResult(result.final_report);
      
      // Update step completions
      updateStepCompletion(1, result.vision_analysis?.success || false);
      updateStepCompletion(2, result.transcription?.success || false);
      updateStepCompletion(3, result.structured_data?.success || false);
      updateStepCompletion(4, result.final_report?.success || false);
      
      if (result.success) {
        setActiveStep(4);
      } else {
        setError(`Análise incompleta: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      setError('Erro na análise completa');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'primary.main', color: 'white' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              🔬 Plataforma de Macroscopia Biomédica
            </Typography>
            <Typography variant="body2">
              Análise inteligente com visão computacional + IA
            </Typography>
          </Box>
          
          {/* Connection Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isConnected ? <Wifi /> : <WifiOff />}
              <Typography variant="body2">
                {connectionStatus === 'connected' ? 'Tempo Real' :
                 connectionStatus === 'connecting' ? 'Conectando...' :
                 connectionStatus === 'error' ? 'Erro Conexão' : 'Desconectado'}
              </Typography>
              <Circle 
                sx={{ 
                  fontSize: 12,
                  color: isConnected ? 'success.light' : 
                         connectionStatus === 'connecting' ? 'warning.light' : 'error.light'
                }}
              />
            </Box>
            
            <Chip
              label={`Sessão: ${sessionId.split('_')[2]}`}
              size="small"
              sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
            
            <Button
              size="small"
              variant={realTimeMode ? "contained" : "outlined"}
              onClick={() => setRealTimeMode(!realTimeMode)}
              sx={{ 
                minWidth: 90,
                backgroundColor: realTimeMode ? 'rgba(255,255,255,0.2)' : 'transparent',
                borderColor: 'rgba(255,255,255,0.5)',
                '&:hover': {
                  backgroundColor: realTimeMode ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'
                }
              }}
            >
              {realTimeMode ? 'Tempo Real' : 'Clássico'}
            </Button>
          </Box>
        </Box>
      </Box>

      {(error || wsError) && (
        <Alert severity="error" sx={{ m: 1 }} onClose={() => { setError(null); }}>
          {error || wsError}
        </Alert>
      )}
      
      {realTimeMode && !isConnected && connectionStatus !== 'connecting' && (
        <Alert severity="warning" sx={{ m: 1 }}>
          Modo tempo real desabilitado. Usando modo clássico.
        </Alert>
      )}

      {loading && (
        <Box sx={{ px: 2 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
            Processando análise...
          </Typography>
        </Box>
      )}

      {/* 4-Quadrant Layout */}
      <Grid container sx={{ flex: 1, height: 0 }}>
        {/* Quadrante Superior Esquerdo: Webcam/Medições */}
        <Grid item xs={6} sx={{ height: '50%', borderRight: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ height: '100%', p: 2, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              📷 Webcam & Medições
            </Typography>
            
            {/* Image Upload/Display Area */}
            <UploadArea
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => imageInputRef.current?.click()}
              sx={{ mb: 2, minHeight: 200 }}
            >
              {imagePreview ? (
                <Box>
                  <img
                    src={imagePreview}
                    alt="Amostra de Biópsia"
                    style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8 }}
                  />
                  <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                    {imageFile?.name}
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <CloudUpload sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="body1" gutterBottom>
                    Posicione amostra sobre papel quadriculado
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Clique para carregar imagem
                  </Typography>
                </Box>
              )}
            </UploadArea>

            {/* Vision Analysis Results - Real-time or Static */}
            {(realTimeMode && wsProgress.vision_analysis.progress > 0) && (
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {wsProgress.vision_analysis.status === 'completed' ? '✅' : '⏳'} Análise de Visão
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={wsProgress.vision_analysis.progress} 
                  sx={{ mb: 1, height: 8, borderRadius: 1 }}
                  color={wsProgress.vision_analysis.status === 'completed' ? 'success' : 'primary'}
                />
                <Typography variant="body2" sx={{ fontSize: '0.75rem', mb: 1 }}>
                  {wsProgress.vision_analysis.data?.message || `${wsProgress.vision_analysis.progress}%`}
                </Typography>
                
                {wsProgress.vision_analysis.status === 'completed' && wsProgress.vision_analysis.data && (
                  <Paper sx={{ p: 1, backgroundColor: 'success.light', color: 'success.contrastText' }}>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                          <strong>Área:</strong> {wsProgress.vision_analysis.data.area_mm2?.toFixed(1)} mm²
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                          <strong>Perímetro:</strong> {wsProgress.vision_analysis.data.perimeter_mm?.toFixed(1)} mm
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                )}
              </Box>
            )}
            
            {/* Classic mode results */}
            {!realTimeMode && visionResult?.success && visionResult.measurements && (
              <Paper sx={{ p: 2, backgroundColor: 'success.light', color: 'success.contrastText' }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                  ✅ Medições Automáticas
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      <strong>Área:</strong> {visionResult.measurements.area_mm2.toFixed(1)} mm²
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      <strong>Perímetro:</strong> {visionResult.measurements.perimeter_mm.toFixed(1)} mm
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      <strong>Compr.:</strong> {visionResult.measurements.length_max_mm.toFixed(1)} mm
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      <strong>Larg.:</strong> {visionResult.measurements.width_max_mm.toFixed(1)} mm
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      <strong>Circular.:</strong> {visionResult.measurements.circularity.toFixed(3)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      <strong>Confiança:</strong> {(visionResult.confidence_overall * 100).toFixed(0)}%
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            )}

            {/* Status Indicators */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip 
                label="Webcam" 
                color={imageFile ? "success" : "default"} 
                size="small"
                icon={<PhotoCamera />}
              />
              <Chip 
                label="Visão IA" 
                color={visionResult?.success ? "success" : "default"} 
                size="small"
                icon={<Visibility />}
              />
              <Chip 
                label="Medições" 
                color={visionResult?.measurements ? "success" : "default"} 
                size="small"
                icon={<Biotech />}
              />
            </Box>
          </Box>
        </Grid>

        {/* Quadrante Superior Direito: Transcrição em Tempo Real */}
        <Grid item xs={6} sx={{ height: '50%', borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ height: '100%', p: 2, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              🎤 Transcrição em Tempo Real
            </Typography>
            
            {/* Recording Controls */}
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              {isRecording ? (
                <Box>
                  <RecordingButton
                    isRecording={isRecording}
                    onClick={stopRecording}
                    size="medium"
                  >
                    <Stop />
                  </RecordingButton>
                  <Typography variant="h6" sx={{ mt: 1, color: 'error.main' }}>
                    🔴 {formatTime(recordingTime)}
                  </Typography>
                  <Typography variant="body2">
                    Gravando... Descreva a amostra
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <RecordingButton
                    isRecording={false}
                    onClick={startRecording}
                    size="medium"
                  >
                    <Mic />
                  </RecordingButton>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Iniciar descrição oral
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Live Transcription Display */}
            <Paper sx={{ 
              p: 2, 
              backgroundColor: transcriptionResult?.success ? 'info.light' : 'grey.100',
              minHeight: 200,
              maxHeight: 300,
              overflow: 'auto',
              border: isRecording ? 2 : 1,
              borderColor: isRecording ? 'error.main' : 'divider',
              borderStyle: isRecording ? 'dashed' : 'solid'
            }}>
              {transcriptionResult?.success ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: 'info.main' }}>
                    ✅ Transcrição Completa
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    fontStyle: 'italic',
                    lineHeight: 1.6,
                    color: 'info.contrastText'
                  }}>
                    "{transcriptionResult.text}"
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Grid container spacing={1}>
                    <Grid item xs={4}>
                      <Typography variant="caption">
                        <strong>Idioma:</strong> {transcriptionResult.language || 'PT'}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption">
                        <strong>Duração:</strong> {transcriptionResult.duration?.toFixed(1)}s
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption">
                        <strong>Segmentos:</strong> {transcriptionResult.segments?.length || 0}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              ) : isRecording ? (
                <Box sx={{ textAlign: 'center', color: 'text.secondary', pt: 4 }}>
                  <Mic sx={{ fontSize: 48, mb: 2 }} />
                  <Typography variant="body1">
                    🎙️ Escutando...
                  </Typography>
                  <Typography variant="body2">
                    Fale sobre as características da amostra
                  </Typography>
                </Box>
              ) : audioFile ? (
                <Box sx={{ textAlign: 'center', color: 'success.main', pt: 4 }}>
                  <CloudUpload sx={{ fontSize: 48, mb: 2 }} />
                  <Typography variant="body1">
                    ✅ Áudio carregado: {audioFile.name}
                  </Typography>
                  <Typography variant="body2">
                    Clique em "Análise Completa" para processar
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', color: 'text.secondary', pt: 4 }}>
                  <MicOff sx={{ fontSize: 48, mb: 2 }} />
                  <Typography variant="body1">
                    Aguardando descrição oral
                  </Typography>
                  <Typography variant="body2">
                    Clique no microfone para começar a gravar
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CloudUpload />}
                    onClick={() => audioInputRef.current?.click()}
                    sx={{ mt: 2 }}
                  >
                    Ou carregar áudio
                  </Button>
                </Box>
              )}
            </Paper>

            {/* Audio Status */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip 
                label="Áudio" 
                color={audioFile ? "success" : isRecording ? "warning" : "default"} 
                size="small"
                icon={isRecording ? <Mic /> : <MicOff />}
              />
              <Chip 
                label="Transcrição" 
                color={transcriptionResult?.success ? "success" : "default"} 
                size="small"
                icon={<Description />}
              />
            </Box>
          </Box>
        </Grid>

        {/* Quadrante Inferior Esquerdo: Formulário Estruturado */}
        <Grid item xs={6} sx={{ height: '50%', borderRight: 1, borderColor: 'divider' }}>
          <Box sx={{ height: '100%', p: 2, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              📋 Formulário Estruturado
            </Typography>
            
            {extractionResult?.success ? (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
                  ✅ Dados extraídos automaticamente com {(extractionResult.structured_data.qualidade_extração?.confiança * 100 || 0).toFixed(0)}% de confiança
                </Alert>

                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      🏥 Identificação
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 1 }}>
                    <Grid container spacing={1}>
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          <strong>Tipo de Tecido:</strong> {extractionResult.structured_data.biópsia?.tipo_tecido || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          <strong>Local:</strong> {extractionResult.structured_data.biópsia?.local_coleta || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          <strong>Data:</strong> {extractionResult.structured_data.biópsia?.data_coleta || 'N/A'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      🎨 Características Macroscópicas
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 1 }}>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          <strong>Coloração:</strong> {extractionResult.structured_data.análise_macroscópica?.cor || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          <strong>Consistência:</strong> {extractionResult.structured_data.análise_macroscópica?.consistencia || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          <strong>Superfície:</strong> {extractionResult.structured_data.análise_macroscópica?.superfície || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          <strong>Aspecto:</strong> {extractionResult.structured_data.análise_macroscópica?.aspecto_geral || 'N/A'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      🔍 Lesões e Observações
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', mb: 1 }}>
                      <strong>Lesões Visíveis:</strong> {
                        extractionResult.structured_data.análise_macroscópica?.lesões_visíveis?.length > 0
                          ? extractionResult.structured_data.análise_macroscópica.lesões_visíveis.join(', ')
                          : 'Nenhuma identificada'
                      }
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                      <strong>Observações:</strong> {extractionResult.structured_data.observações?.achados_relevantes?.join(', ') || 'N/A'}
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`${extractionResult.structured_data.qualidade_extração?.campos_identificados || 0}/${extractionResult.structured_data.qualidade_extração?.campos_totais || 0} campos`}
                    color="info"
                    size="small"
                  />
                  <Chip 
                    label={`${extractionResult.tokens_used} tokens`}
                    color="secondary"
                    size="small"
                  />
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', color: 'text.secondary', pt: 4 }}>
                <Biotech sx={{ fontSize: 48, mb: 2 }} />
                <Typography variant="body1" gutterBottom>
                  Aguardando análise dos dados
                </Typography>
                <Typography variant="body2">
                  O formulário será preenchido automaticamente após a transcrição
                </Typography>
                
                {/* Manual Input Option */}
                <Divider sx={{ my: 2 }} />
                <Typography variant="caption" color="text.secondary">
                  Ou preencha manualmente:
                </Typography>
                
                <Box sx={{ mt: 2, textAlign: 'left' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    🏥 Dados Básicos
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 1, fontSize: '0.8rem' }}>
                    <Typography variant="body2">• Tipo de tecido: _______</Typography>
                    <Typography variant="body2">• Localização: _______</Typography>
                    <Typography variant="body2">• Coloração: _______</Typography>
                    <Typography variant="body2">• Consistência: _______</Typography>
                    <Typography variant="body2">• Superfície: _______</Typography>
                    <Typography variant="body2">• Lesões observadas: _______</Typography>
                  </Box>
                </Box>
              </Box>
            )}

            {/* Processing Status */}
            <Box sx={{ mt: 2 }}>
              <Chip 
                label="Formulário IA" 
                color={extractionResult?.success ? "success" : "default"} 
                size="small"
                icon={<AutoFixHigh />}
              />
            </Box>
          </Box>
        </Grid>

        {/* Quadrante Inferior Direito: Relatório Gerado */}
        <Grid item xs={6} sx={{ height: '50%' }}>
          <Box sx={{ height: '100%', p: 2, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                📄 Relatório Gerado
              </Typography>
              
              {reportResult?.success && (
                <Box>
                  <IconButton size="small" onClick={() => setReportDialog(true)} color="primary">
                    <Visibility />
                  </IconButton>
                  <IconButton size="small" color="primary">
                    <Download />
                  </IconButton>
                  <IconButton size="small" color="primary">
                    <Share />
                  </IconButton>
                </Box>
              )}
            </Box>
            
            {reportResult?.success ? (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
                  ✅ Relatório médico gerado automaticamente
                </Alert>
                
                <Paper sx={{ 
                  p: 2, 
                  backgroundColor: 'success.light',
                  maxHeight: 320,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'success.main'
                }}>
                  <Typography variant="body2" sx={{ 
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    lineHeight: 1.4,
                    color: 'success.contrastText'
                  }}>
                    {reportResult.report}
                  </Typography>
                </Paper>
                
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`${reportResult.tokens_used} tokens`}
                    color="info"
                    size="small"
                  />
                  <Chip 
                    label={reportResult.model_used}
                    color="secondary"
                    size="small"
                  />
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', color: 'text.secondary', pt: 4 }}>
                <Description sx={{ fontSize: 48, mb: 2 }} />
                <Typography variant="body1" gutterBottom>
                  Aguardando geração do relatório
                </Typography>
                <Typography variant="body2" sx={{ mb: 3 }}>
                  O laudo médico será criado após o processamento completo
                </Typography>
                
                {/* Status Steps */}
                <Box sx={{ textAlign: 'left', maxWidth: 300, mx: 'auto' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Etapas do Relatório:
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 0.5, fontSize: '0.8rem' }}>
                    <Typography variant="body2" sx={{ 
                      color: visionResult?.success ? 'success.main' : 'text.secondary'
                    }}>
                      {visionResult?.success ? '✅' : '⏳'} Medições quantitativas
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: transcriptionResult?.success ? 'success.main' : 'text.secondary'
                    }}>
                      {transcriptionResult?.success ? '✅' : '⏳'} Descrição macroscópica
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: extractionResult?.success ? 'success.main' : 'text.secondary'
                    }}>
                      {extractionResult?.success ? '✅' : '⏳'} Dados estruturados
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: reportResult?.success ? 'success.main' : 'text.secondary'
                    }}>
                      {reportResult?.success ? '✅' : '⏳'} Relatório final
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Bottom Action Bar */}
      <Box sx={{ 
        p: 2, 
        borderTop: 1, 
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        display: 'flex',
        justifyContent: 'center',
        gap: 2
      }}>
        <Button
          variant="contained"
          size="large"
          startIcon={realTimeMode && isConnected ? <Wifi /> : <AutoFixHigh />}
          onClick={runCompleteAnalysis}
          disabled={loading || (!imageFile && !audioFile)}
          sx={{ minWidth: 200 }}
        >
          {loading ? 'Processando...' : 
           realTimeMode && isConnected ? 'Análise Tempo Real' : 'Análise Completa'}
        </Button>
        
        <Button
          variant="outlined"
          size="large"
          startIcon={<Biotech />}
          onClick={runVisionAnalysis}
          disabled={loading || !imageFile}
        >
          Só Visão
        </Button>
        
        <Button
          variant="outlined"
          size="large"
          startIcon={<Mic />}
          onClick={runAudioTranscription}
          disabled={loading || !audioFile}
        >
          Só Áudio
        </Button>
      </Box>

      {/* Report Dialog */}
      <Dialog
        open={reportDialog}
        onClose={() => setReportDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          📄 Relatório de Análise de Biópsia
        </DialogTitle>
        <DialogContent>
          {reportResult?.success && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {reportResult.report}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialog(false)}>Fechar</Button>
          <Button variant="contained" startIcon={<Download />}>
            Baixar PDF
          </Button>
        </DialogActions>
      </Dialog>

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
      />
      <input
        type="file"
        ref={audioInputRef}
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0])}
      />
    </Box>
  );
}