/**
 * Componente de fluxo sequencial para análise de biópsias
 * Implementa o workflow: Camera → Oral Report → Review → Form → Storage
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Alert,
  LinearProgress,
  Card,
  CardContent,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CameraAlt,
  Mic,
  MicOff,
  Edit,
  AutoAwesome,
  Save,
  CheckCircle,
  Error,
  Warning,
  Refresh,
  PlayArrow,
  Stop,
  ExpandMore,
  Visibility,
  PhotoCamera,
} from '@mui/icons-material';
import SimpleCameraCapture from './SimpleCameraCapture';

interface SequentialWorkflowProps {
  onComplete?: (results: AnalysisResults) => void;
  onError?: (error: string) => void;
}

interface AnalysisResults {
  visionMeasurements?: any;
  audioTranscription?: string;
  structuredData?: any;
  finalReport?: string;
  step: number;
}

interface WorkflowStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  error?: string;
  optional: boolean;
}

interface InformationChecklist {
  id: string;
  label: string;
  checked: boolean;
  required: boolean;
}

const SequentialWorkflow: React.FC<SequentialWorkflowProps> = ({
  onComplete,
  onError
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResults>({ step: 0 });
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [editedTranscription, setEditedTranscription] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout>();
  
  // Step definitions
  const [steps, setSteps] = useState<WorkflowStep[]>([
    {
      id: 0,
      title: 'Medições da Câmera',
      description: 'Análise computacional automática para medições precisas',
      completed: false,
      optional: false
    },
    {
      id: 1,
      title: 'Relatório Oral',
      description: 'Gravação de áudio e transcrição automática',
      completed: false,
      optional: false
    },
    {
      id: 2,
      title: 'Revisão do Relatório',
      description: 'Revisar e editar transcrição antes do processamento',
      completed: false,
      optional: false
    },
    {
      id: 3,
      title: 'Geração de Formulário',
      description: 'IA processa dados usando 8 funções estruturadas',
      completed: false,
      optional: false
    },
    {
      id: 4,
      title: 'Armazenamento',
      description: 'Salvar análise completa no banco de dados',
      completed: false,
      optional: false
    }
  ]);
  
  // Information checklist for step 2
  const [informationChecklist, setInformationChecklist] = useState<InformationChecklist[]>([
    { id: 'tipo_tecido', label: 'Tipo de tecido identificado', checked: false, required: true },
    { id: 'localizacao', label: 'Localização anatômica', checked: false, required: true },
    { id: 'coloracao', label: 'Coloração da amostra', checked: false, required: true },
    { id: 'consistencia', label: 'Consistência do tecido', checked: false, required: true },
    { id: 'superficie', label: 'Características da superfície', checked: false, required: false },
    { id: 'dimensoes', label: 'Dimensões ou medições mencionadas', checked: false, required: false },
    { id: 'lesoes', label: 'Lesões ou anormalidades visíveis', checked: false, required: false },
    { id: 'observacoes', label: 'Observações clínicas relevantes', checked: false, required: false }
  ]);

  const updateStepCompletion = useCallback((stepId: number, completed: boolean, error?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, completed, error } : step
    ));
  }, []);

  // Step 1: Camera measurements
  const handleCameraCapture = useCallback(async (imageData: string) => {
    setLoading(true);
    try {
      // Simular processamento de visão computacional
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulação de medições automáticas
      const mockMeasurements = {
        area_mm2: 45.2,
        perimeter_mm: 28.7,
        length_max_mm: 8.3,
        width_max_mm: 6.1,
        circularity: 0.72,
        confidence: 0.89
      };
      
      setResults(prev => ({ ...prev, visionMeasurements: mockMeasurements, step: 1 }));
      updateStepCompletion(0, true);
      setActiveStep(1);
      
      // Auto-populate measurements in transcription
      const measurementsText = `Medições automáticas: área ${mockMeasurements.area_mm2} mm², perímetro ${mockMeasurements.perimeter_mm} mm, comprimento máximo ${mockMeasurements.length_max_mm} mm, largura máxima ${mockMeasurements.width_max_mm} mm. `;
      setTranscriptionText(measurementsText);
      setEditedTranscription(measurementsText);
      
    } catch (error) {
      updateStepCompletion(0, false, 'Erro na análise de visão');
      if (onError) onError('Erro ao processar medições da câmera');
    } finally {
      setLoading(false);
    }
  }, [updateStepCompletion, onError]);

  // Step 2: Audio recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        processAudioTranscription(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      mediaRecorder.start();

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      if (onError) onError('Erro ao acessar microfone');
    }
  }, [onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }, [isRecording]);

  const processAudioTranscription = useCallback(async (audioBlob: Blob) => {
    setLoading(true);
    try {
      // Simular transcrição via OpenAI Whisper
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const mockTranscription = "Amostra de biópsia de pele coletada da região dorsal. Apresenta coloração rosada uniforme, consistência firme e superfície lisa. Dimensões aproximadamente 8mm por 6mm conforme medições automáticas. Não foram observadas lesões macroscópicas evidentes. Tecido íntegro para análise histopatológica.";
      
      const fullTranscription = transcriptionText + mockTranscription;
      setTranscriptionText(fullTranscription);
      setEditedTranscription(fullTranscription);
      
      setResults(prev => ({ ...prev, audioTranscription: fullTranscription, step: 2 }));
      updateStepCompletion(1, true);
      setActiveStep(2);
      
      // Auto-check some checklist items
      setInformationChecklist(prev => prev.map(item => ({
        ...item,
        checked: ['tipo_tecido', 'localizacao', 'coloracao', 'consistencia'].includes(item.id)
      })));
      
    } catch (error) {
      updateStepCompletion(1, false, 'Erro na transcrição');
      if (onError) onError('Erro ao processar transcrição de áudio');
    } finally {
      setLoading(false);
    }
  }, [transcriptionText, updateStepCompletion, onError]);

  // Step 3: Review transcription
  const completeReview = useCallback(() => {
    const requiredItemsCompleted = informationChecklist
      .filter(item => item.required)
      .every(item => item.checked);
    
    if (!requiredItemsCompleted) {
      if (onError) onError('Complete todos os itens obrigatórios da lista de verificação');
      return;
    }
    
    setResults(prev => ({ ...prev, step: 3 }));
    updateStepCompletion(2, true);
    setActiveStep(3);
  }, [informationChecklist, updateStepCompletion, onError]);

  // Step 4: Generate structured form
  const generateStructuredForm = useCallback(async () => {
    setLoading(true);
    try {
      // Simular processamento via 8 funções estruturadas
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      const mockStructuredData = {
        biópsia: {
          tipo_tecido: "Pele",
          local_coleta: "Região dorsal",
          data_coleta: new Date().toISOString().split('T')[0]
        },
        análise_macroscópica: {
          cor: "Rosada",
          consistencia: "Firme",
          superfície: "Lisa",
          aspecto_geral: "Íntegro"
        },
        medições: results.visionMeasurements,
        observações: {
          achados_relevantes: ["Ausência de lesões macroscópicas"]
        }
      };
      
      setResults(prev => ({ ...prev, structuredData: mockStructuredData, step: 4 }));
      updateStepCompletion(3, true);
      setActiveStep(4);
      
    } catch (error) {
      updateStepCompletion(3, false, 'Erro na geração do formulário');
      if (onError) onError('Erro ao gerar formulário estruturado');
    } finally {
      setLoading(false);
    }
  }, [results.visionMeasurements, updateStepCompletion, onError]);

  // Step 5: Save to database
  const saveToDatabase = useCallback(async () => {
    setLoading(true);
    try {
      // Simular salvamento no banco
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalResults = {
        ...results,
        finalReport: `Relatório de análise completo - ${new Date().toLocaleString()}`,
        step: 5
      };
      
      setResults(finalResults);
      updateStepCompletion(4, true);
      
      if (onComplete) onComplete(finalResults);
      
    } catch (error) {
      updateStepCompletion(4, false, 'Erro ao salvar no banco');
      if (onError) onError('Erro ao salvar análise no banco de dados');
    } finally {
      setLoading(false);
    }
  }, [results, updateStepCompletion, onComplete, onError]);

  const handleChecklistChange = (id: string, checked: boolean) => {
    setInformationChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, checked } : item
    ));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStepIcon = (step: WorkflowStep) => {
    if (step.error) return <Error color="error" />;
    if (step.completed) return <CheckCircle color="success" />;
    if (loading && steps[activeStep]?.id === step.id) return <CircularProgress size={20} />;
    return null;
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'primary.main' }}>
        🔬 Análise Sequencial de Biópsia
      </Typography>
      
      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Siga o fluxo passo a passo para uma análise completa e precisa
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        {/* Step 0: Camera Measurements */}
        <Step>
          <StepLabel 
            icon={getStepIcon(steps[0])}
            error={!!steps[0].error}
          >
            {steps[0].title}
          </StepLabel>
          <StepContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {steps[0].description}
            </Typography>
            
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <SimpleCameraCapture
                  onCapture={handleCameraCapture}
                  onError={(error) => updateStepCompletion(0, false, error)}
                  showGrid={true}
                  width={640}
                  height={480}
                />
                
                {results.visionMeasurements && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="success">
                      ✅ Medições automáticas concluídas!
                    </Alert>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Área:</strong> {results.visionMeasurements.area_mm2} mm²
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Perímetro:</strong> {results.visionMeasurements.perimeter_mm} mm
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>
            
            <Box sx={{ mb: 1 }}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(1)}
                disabled={!steps[0].completed}
                sx={{ mt: 1, mr: 1 }}
              >
                Pular (Opcional)
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 1: Audio Recording */}
        <Step>
          <StepLabel 
            icon={getStepIcon(steps[1])}
            error={!!steps[1].error}
          >
            {steps[1].title}
          </StepLabel>
          <StepContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {steps[1].description}
            </Typography>
            
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  {isRecording ? (
                    <Box>
                      <IconButton 
                        onClick={stopRecording}
                        sx={{ 
                          width: 80, 
                          height: 80, 
                          backgroundColor: 'error.main',
                          color: 'white',
                          animation: 'pulse 1.5s infinite'
                        }}
                      >
                        <Stop />
                      </IconButton>
                      <Typography variant="h6" sx={{ mt: 1, color: 'error.main' }}>
                        🔴 {formatTime(recordingTime)}
                      </Typography>
                      <Typography variant="body2">
                        Gravando... Descreva características da amostra
                      </Typography>
                    </Box>
                  ) : (
                    <Box>
                      <IconButton 
                        onClick={startRecording}
                        sx={{ 
                          width: 80, 
                          height: 80, 
                          backgroundColor: 'primary.main',
                          color: 'white'
                        }}
                      >
                        <Mic />
                      </IconButton>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Iniciar descrição oral
                      </Typography>
                    </Box>
                  )}
                </Box>
                
                {transcriptionText && (
                  <Paper sx={{ p: 2, backgroundColor: 'info.light' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      📝 Transcrição Automática:
                    </Typography>
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      {transcriptionText}
                    </Typography>
                  </Paper>
                )}
              </CardContent>
            </Card>
            
            <Box sx={{ mb: 1 }}>
              <Button
                variant="contained"
                onClick={() => setActiveStep(2)}
                disabled={!steps[1].completed}
                sx={{ mt: 1, mr: 1 }}
              >
                Próximo
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 2: Review Transcription */}
        <Step>
          <StepLabel 
            icon={getStepIcon(steps[2])}
            error={!!steps[2].error}
          >
            {steps[2].title}
          </StepLabel>
          <StepContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {steps[2].description}
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      ✏️ Editar Transcrição
                    </Typography>
                    <TextField
                      multiline
                      rows={8}
                      fullWidth
                      value={editedTranscription}
                      onChange={(e) => setEditedTranscription(e.target.value)}
                      placeholder="Edite a transcrição conforme necessário..."
                    />
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      📋 Lista de Verificação
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      Verifique se todas as informações essenciais estão presentes:
                    </Typography>
                    
                    <List dense>
                      {informationChecklist.map((item) => (
                        <ListItem key={item.id} sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Checkbox
                              checked={item.checked}
                              onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                              color="primary"
                            />
                          </ListItemIcon>
                          <ListItemText 
                            primary={item.label}
                            secondary={item.required ? "Obrigatório" : "Opcional"}
                          />
                          {item.required && (
                            <Chip 
                              label="Obrigatório" 
                              size="small" 
                              color={item.checked ? "success" : "warning"}
                            />
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            <Box sx={{ mb: 1 }}>
              <Button
                variant="contained"
                onClick={completeReview}
                sx={{ mt: 1, mr: 1 }}
              >
                Revisar Completo
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 3: Generate Structured Form */}
        <Step>
          <StepLabel 
            icon={getStepIcon(steps[3])}
            error={!!steps[3].error}
          >
            {steps[3].title}
          </StepLabel>
          <StepContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {steps[3].description}
            </Typography>
            
            <Card sx={{ mb: 2 }}>
              <CardContent>
                {!steps[3].completed ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <AutoAwesome sx={{ fontSize: 48, mb: 2, color: 'primary.main' }} />
                    <Typography variant="h6" gutterBottom>
                      Pronto para processar com IA
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                      O sistema usará 8 funções estruturadas para extrair dados médicos
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesome />}
                      onClick={generateStructuredForm}
                      disabled={loading}
                      size="large"
                    >
                      {loading ? 'Processando com IA...' : 'Gerar Formulário'}
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      ✅ Formulário estruturado gerado com sucesso!
                    </Alert>
                    
                    {results.structuredData && (
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Typography variant="h6">
                            📊 Dados Estruturados Extraídos
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>
                            {JSON.stringify(results.structuredData, null, 2)}
                          </pre>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
            
            <Box sx={{ mb: 1 }}>
              <Button
                variant="contained"
                onClick={() => setActiveStep(4)}
                disabled={!steps[3].completed}
                sx={{ mt: 1, mr: 1 }}
              >
                Próximo
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 4: Save to Database */}
        <Step>
          <StepLabel 
            icon={getStepIcon(steps[4])}
            error={!!steps[4].error}
          >
            {steps[4].title}
          </StepLabel>
          <StepContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {steps[4].description}
            </Typography>
            
            <Card sx={{ mb: 2 }}>
              <CardContent>
                {!steps[4].completed ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Save sx={{ fontSize: 48, mb: 2, color: 'primary.main' }} />
                    <Typography variant="h6" gutterBottom>
                      Salvar Análise Completa
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                      Todos os dados serão armazenados no banco de dados
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                      onClick={saveToDatabase}
                      disabled={loading}
                      size="large"
                      color="success"
                    >
                      {loading ? 'Salvando...' : 'Salvar no Banco'}
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CheckCircle sx={{ fontSize: 48, mb: 2, color: 'success.main' }} />
                    <Typography variant="h5" gutterBottom color="success.main">
                      ✅ Análise Concluída!
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      Todos os dados foram salvos com sucesso no sistema.
                    </Typography>
                    <Chip 
                      label={`Finalizada em ${new Date().toLocaleString()}`}
                      color="success"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </StepContent>
        </Step>
      </Stepper>
      
      {loading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
            Processando...
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SequentialWorkflow;