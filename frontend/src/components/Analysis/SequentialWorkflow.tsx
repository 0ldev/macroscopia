/**
 * Componente de fluxo sequencial para análise de biópsias
 * Implementa o workflow: Camera → Oral Report → Review → Form → Storage
 */
import React, { useState, useCallback } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  AutoAwesome,
  Save,
  CheckCircle,
  Error as ErrorIcon,
  Refresh,
  ExpandMore,
} from '@mui/icons-material';
import SimpleCameraCapture from './SimpleCameraCapture';
import AdvancedAudioRecorder from './AdvancedAudioRecorder';
import { analysisService, VisionAnalysisResult } from '../../services/analysisService';

interface SequentialWorkflowProps {
  onComplete?: (results: AnalysisResults) => void;
  onError?: (error: string) => void;
}

interface AnalysisResults {
  visionMeasurements?: any;
  overlayImage?: string;
  audioTranscription?: string;
  structuredData?: any;
  finalReport?: string;
  formData?: MacroscopiaFormData;
  savedId?: string;
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

interface MacroscopiaFormData {
  // 8 campos correspondentes às 8 funções do functions.md
  preencher_identificacao: string;
  preencher_coloracao: string;
  preencher_consistencia: string;
  preencher_superficie: string;
  identificar_lesoes: string;
  avaliar_inflamacao: string;
  registrar_observacoes: string;
  gerar_conclusao: string;
}

const SequentialWorkflow: React.FC<SequentialWorkflowProps> = ({
  onComplete,
  onError
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResults>({ step: 0 });
  
  // Transcription state
  const [transcriptionText, setTranscriptionText] = useState('');
  const [editedTranscription, setEditedTranscription] = useState('');

  // Measurement confirmation state
  const [measurementError, setMeasurementError] = useState<string | null>(null);

  // Form data state
  // Animation and visual feedback states
  const [animatingField, setAnimatingField] = useState<string | null>(null);

  const [formData, setFormData] = useState<MacroscopiaFormData>({
    preencher_identificacao: '',
    preencher_coloracao: '',
    preencher_consistencia: '',
    preencher_superficie: '',
    identificar_lesoes: '',
    avaliar_inflamacao: '',
    registrar_observacoes: '',
    gerar_conclusao: ''
  });

  const [formGenerated, setFormGenerated] = useState(false);

  // Helper function to format AI function results into readable text
  const formatFunctionResult = (functionData: any): string => {
    if (!functionData || typeof functionData !== 'object') {
      return '';
    }

    const lines: string[] = [];
    Object.entries(functionData).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            lines.push(`${key}: ${value.join(', ')}`);
          }
        } else if (typeof value === 'boolean') {
          lines.push(`${key}: ${value ? 'Sim' : 'Não'}`);
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
    });
    return lines.join('\n');
  };

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
  const [informationChecklist] = useState<InformationChecklist[]>([
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
    setMeasurementError(null);
    
    try {
      // Validar imagem antes de enviar
      const validation = analysisService.validateImageForAnalysis(imageData);
      if (!validation.valid) {
        const errorMsg = `Imagem inválida: ${validation.errors.join(', ')}`;
        setMeasurementError(errorMsg);
        updateStepCompletion(0, false, errorMsg);
        return;
      }

      // Chamar API real de análise de visão computacional
      const visionResult: VisionAnalysisResult = await analysisService.analyzeImage(imageData);
      
      if (!visionResult.success) {
        const errorMsg = `Erro na análise: ${visionResult.errors.join(', ')}`;
        setMeasurementError(errorMsg);
        updateStepCompletion(0, false, errorMsg);
        return;
      }

      // Verificar se as medições são confiáveis
      if (visionResult.confidence_overall < 0.7) {
        const errorMsg = `Confiança baixa (${Math.round(visionResult.confidence_overall * 100)}%). Tente capturar novamente com melhor iluminação e foco.`;
        setMeasurementError(errorMsg);
        updateStepCompletion(0, false, errorMsg);
        return;
      }
      
      // Mostrar medidas para revisão (NÃO avançar automaticamente)
      setResults(prev => ({
        ...prev,
        visionMeasurements: visionResult.measurements,
        overlayImage: visionResult.overlay_image,
        step: 0
      }));
      
      // Preparar texto inicial com medidas para transcrição
      if (visionResult.measurements) {
        const measurementsText = `Medições automáticas obtidas: área ${visionResult.measurements.area_mm2} mm², perímetro ${visionResult.measurements.perimeter_mm} mm, comprimento máximo ${visionResult.measurements.length_max_mm} mm, largura máxima ${visionResult.measurements.width_max_mm} mm. `;
        setTranscriptionText(measurementsText);
        setEditedTranscription(measurementsText);
      }
      
    } catch (error: any) {
      console.error('Erro na captura de imagem:', error);
      const errorMsg = error?.message || 'Erro inesperado durante o processamento da imagem';
      setMeasurementError(errorMsg);
      updateStepCompletion(0, false, errorMsg);
    } finally {
      setLoading(false);
    }
  }, [updateStepCompletion]);

  // Accept measurements and proceed to next step
  const acceptMeasurements = useCallback(() => {
    updateStepCompletion(0, true);
    setResults(prev => ({ ...prev, step: 1 }));
    setActiveStep(1);
  }, [updateStepCompletion]);

  // Retry measurements
  const retryMeasurements = useCallback(() => {
    setResults(prev => ({ ...prev, visionMeasurements: undefined }));
    setMeasurementError(null);
    setTranscriptionText('');
    setEditedTranscription('');
    updateStepCompletion(0, false);
  }, [updateStepCompletion]);



  // Step 3: Generate Report with AI
  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      // First try to use OPENAI_PROMPT_ID approach
      const response = await fetch('/ai/process-with-structured-functions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: new URLSearchParams({
          transcription_text: editedTranscription,
          vision_measurements: results.visionMeasurements ? JSON.stringify(results.visionMeasurements) : ''
        })
      });

      if (!response.ok) {
        const error = Error(`AI processing failed: ${response.status}`);
        throw error;
      }

      const aiResult = await response.json();
      console.log('AI Result:', aiResult);

      if (aiResult.success) {
        // Start visual animation

        // Map AI results to form fields with animation
        const aiData = aiResult.results || {};
        console.log('AI Data:', aiData);

        // Simulate animated filling of form fields
        const fieldGroups = [
          'preencher_identificacao',
          'preencher_coloracao',
          'preencher_consistencia',
          'preencher_superficie',
          'identificar_lesoes',
          'avaliar_inflamacao',
          'registrar_observacoes',
          'gerar_conclusao'
        ];

        // Animate each field group with delay
        for (let i = 0; i < fieldGroups.length; i++) {
          setTimeout(() => {
            setAnimatingField(fieldGroups[i]);
          }, i * 200);
        }

        // Complete animation after all fields
        setTimeout(() => {
          setAnimatingField(null);
        }, fieldGroups.length * 200 + 500);

        // Convert AI structured data to consolidated text for each function
        const newFormData: MacroscopiaFormData = {
          preencher_identificacao: formatFunctionResult(aiData.preencher_identificacao),
          preencher_coloracao: formatFunctionResult(aiData.preencher_coloracao),
          preencher_consistencia: formatFunctionResult(aiData.preencher_consistencia),
          preencher_superficie: formatFunctionResult(aiData.preencher_superficie),
          identificar_lesoes: formatFunctionResult(aiData.identificar_lesoes),
          avaliar_inflamacao: formatFunctionResult(aiData.avaliar_inflamacao),
          registrar_observacoes: formatFunctionResult(aiData.registrar_observacoes),
          gerar_conclusao: formatFunctionResult(aiData.gerar_conclusao)
        };

        console.log('New Form Data:', newFormData);

        setFormData(newFormData);
        setFormGenerated(true);
        // Stay on step 2 for review, don't auto-advance
        updateStepCompletion(2, false); // Keep as incomplete until user reviews
      } else {
        const error = Error(aiResult.error || 'Failed to process transcription with AI');
        throw error;
      }
    } catch (error: any) {
      console.error('Error generating report:', error);
      onError?.(error.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, [editedTranscription, results.visionMeasurements, updateStepCompletion, onError]);

  // Step 2.5: Review form and proceed
  const reviewFormAndProceed = useCallback(() => {
    // Mark step 2 as completed and move to step 3
    updateStepCompletion(2, true);
    setActiveStep(3);
  }, [updateStepCompletion]);

  // Step 4: Save to Database
  const saveToDatabase = useCallback(async () => {
    setLoading(true);
    try {
      // Prepare the complete data structure for saving
      const completeData = {
        transcription: editedTranscription,
        visionMeasurements: results.visionMeasurements,
        formData: formData,
        timestamp: new Date().toISOString(),
        user_id: localStorage.getItem('user_id') // Assuming user ID is stored in localStorage
      };

      // Save to database via API
      const response = await fetch('/api/analysis/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(completeData)
      });

      if (!response.ok) {
        const error = Error(`Failed to save to database: ${response.status}`);
        throw error;
      }

      const saveResult = await response.json();

      updateStepCompletion(4, true);

      if (onComplete) {
        onComplete({
          ...results,
          formData: formData,
          savedId: saveResult.id,
          step: 5
        });
      }

    } catch (error: any) {
      console.error('Error saving to database:', error);
      const errorMsg = error?.message || 'Failed to save to database';
      updateStepCompletion(4, false, errorMsg);
      if (onError) onError('Failed to save analysis to database');
    } finally {
      setLoading(false);
    }
  }, [editedTranscription, results, formData, updateStepCompletion, onComplete, onError]);

  // Step 4: Generate structured form (legacy - keeping for compatibility)
  const generateStructuredForm = useCallback(async () => {
    setLoading(true);
    try {
      // Chamar API real para extrair dados estruturados
      const extractionResult = await analysisService.extractBiopsyData(
        editedTranscription,
        results.visionMeasurements
      );
      
      if (!extractionResult.success) {
        const errorMsg = extractionResult.error || 'Erro na extração de dados';
        updateStepCompletion(3, false, errorMsg);
        if (onError) onError(errorMsg);
        return;
      }
      
      // Usar dados extraídos pela IA ou fallback para estrutura mínima
      const structuredData = extractionResult.paciente || extractionResult.biópsia || 
        extractionResult.análise_macroscópica || {
        biópsia: {
          tipo_tecido: "Não especificado",
          local_coleta: "Não especificado",
          data_coleta: new Date().toISOString().split('T')[0]
        },
        análise_macroscópica: {
          descrição: editedTranscription.substring(0, 500) + "..."
        },
        medições: results.visionMeasurements,
        qualidade_extração: extractionResult.qualidade_extração,
        tokens_usados: extractionResult.tokens_used
      };
      
      setResults(prev => ({ ...prev, structuredData, step: 4 }));
      updateStepCompletion(3, true);
      setActiveStep(4);
      
    } catch (error: any) {
      console.error('Erro na geração do formulário:', error);
      const errorMsg = error?.message || 'Erro na geração do formulário';
      updateStepCompletion(3, false, errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [editedTranscription, results.visionMeasurements, updateStepCompletion, onError]);


  const getStepIcon = (step: WorkflowStep) => {
    if (step.error) return <ErrorIcon color="error" />;
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
                
                {/* Exibição de Erro */}
                {measurementError && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>❌ Erro na Medição:</strong> {measurementError}
                      </Typography>
                    </Alert>
                    <Paper sx={{ p: 2, backgroundColor: 'error.light' }}>
                      <Typography variant="h6" gutterBottom color="error">
                        🔄 Medição Não Realizada
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        O sistema não conseguiu extrair medidas precisas da imagem. 
                        Isso pode ocorrer devido a problemas de iluminação, foco, ou posicionamento da amostra.
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={retryMeasurements}
                          startIcon={<Refresh />}
                        >
                          Capturar Nova Imagem
                        </Button>
                        <Button
                          variant="outlined"
                          color="warning"
                          onClick={acceptMeasurements}
                        >
                          Prosseguir sem Medidas
                        </Button>
                      </Box>
                    </Paper>
                  </Box>
                )}

                {/* Exibição de Medidas Bem-sucedidas */}
                {results.visionMeasurements && !measurementError && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      ✅ Medições automáticas concluídas com {(results.visionMeasurements.confidence * 100).toFixed(1)}% de confiança!
                    </Alert>
                    <Paper sx={{ p: 2, backgroundColor: 'success.light' }}>

                      {/* Contour Overlay Image */}
                      {results.overlayImage && (
                        <Box sx={{ mb: 3, textAlign: 'center' }}>
                          <Typography variant="h6" gutterBottom>
                            🎯 Contorno Detectado
                          </Typography>
                          <Paper
                            sx={{
                              display: 'inline-block',
                              p: 1,
                              backgroundColor: 'white',
                              border: '2px solid',
                              borderColor: 'success.main',
                              borderRadius: 2
                            }}
                          >
                            <img
                              src={`data:image/jpeg;base64,${results.overlayImage}`}
                              alt="Contorno da medição detectada"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '400px',
                                borderRadius: '4px'
                              }}
                            />
                          </Paper>
                          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                            🔍 <strong>Linha verde:</strong> Área medida automaticamente |
                            <strong>Linhas azuis/vermelhas:</strong> Dimensões principais
                          </Typography>
                        </Box>
                      )}

                      <Typography variant="h6" gutterBottom>
                        📏 Resultados das Medições
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2">
                            <strong>Área:</strong> {results.visionMeasurements.area_mm2} mm²
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2">
                            <strong>Perímetro:</strong> {results.visionMeasurements.perimeter_mm} mm
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2">
                            <strong>Comprimento:</strong> {results.visionMeasurements.length_max_mm} mm
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2">
                            <strong>Largura:</strong> {results.visionMeasurements.width_max_mm} mm
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2">
                            <strong>Circularidade:</strong> {results.visionMeasurements.circularity}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2">
                            <strong>Confiança:</strong> {(results.visionMeasurements.confidence * 100).toFixed(1)}%
                          </Typography>
                        </Grid>
                      </Grid>
                      
                      {/* Botões de Decisão */}
                      <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Button
                          variant="contained"
                          color="success"
                          onClick={acceptMeasurements}
                          startIcon={<CheckCircle />}
                          size="large"
                        >
                          ✅ Aceitar Medidas e Prosseguir
                        </Button>
                        <Button
                          variant="outlined"
                          color="primary"
                          onClick={retryMeasurements}
                          startIcon={<Refresh />}
                        >
                          🔄 Medir Novamente
                        </Button>
                      </Box>

                      <Alert severity="info" sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          <strong>Revisão necessária:</strong> Confirme se as medidas estão adequadas antes de prosseguir. 
                          As medidas aceitas serão incluídas automaticamente na transcrição.
                        </Typography>
                      </Alert>
                    </Paper>
                  </Box>
                )}
              </CardContent>
            </Card>
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
            
            {/* Lista de Referência - Apenas para Orientação */}
            <Paper sx={{ p: 2, mb: 2, backgroundColor: 'info.light', border: '1px solid', borderColor: 'info.main' }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'info.dark' }}>
                📋 Itens de referência para o relatório oral:
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                📝 Use esta lista como guia durante sua gravação. Não é necessário marcar itens.
              </Typography>
              <Grid container spacing={1}>
                {informationChecklist.map((item) => (
                  <Grid item xs={6} md={3} key={item.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', py: 0.25 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: item.required ? 'warning.main' : 'info.main',
                          mr: 1,
                          flexShrink: 0
                        }}
                      />
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.2 }}>
                        {item.label}
                        {item.required && (
                          <Chip
                            label="Importante"
                            size="small"
                            color="warning"
                            sx={{ ml: 0.5, height: 16, fontSize: '0.6rem' }}
                          />
                        )}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                ⚠️ Itens marcados como "Importante" são fundamentais para um relatório completo
              </Typography>
            </Paper>

            {/* Novo componente de gravação avançada */}
            <AdvancedAudioRecorder
              onTranscriptionComplete={(transcription) => {
                setTranscriptionText(transcription);
                setEditedTranscription(transcription);
                updateStepCompletion(1, true);
                setResults(prev => ({ ...prev, audioTranscription: transcription, step: 2 }));
              }}
              onTranscriptionUpdate={(partialText) => {
                // Feedback em tempo real durante a transcrição
                setTranscriptionText(partialText);
              }}
              onError={(error) => {
                updateStepCompletion(1, false, error);
                if (onError) onError(error);
              }}
              disabled={loading}
              maxDurationSeconds={600} // 10 minutos máximo
            />
            
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
                      ✏️ Editar Transcrição do ChatGPT
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      Revise e edite a transcrição gerada automaticamente pela IA.
                      Esta transcrição inclui as medições automáticas e sua descrição oral.
                    </Typography>

                    {transcriptionText && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          <strong>Transcrição Original do ChatGPT:</strong> A IA processou sua gravação e gerou automaticamente este texto.
                        </Typography>
                      </Alert>
                    )}

                    <TextField
                      fullWidth
                      multiline
                      rows={8}
                      variant="outlined"
                      label="Transcrição do ChatGPT para edição"
                      value={editedTranscription}
                      onChange={(e) => setEditedTranscription(e.target.value)}
                      placeholder="A transcrição do ChatGPT aparecerá aqui para edição..."
                      helperText="Edite conforme necessário antes de prosseguir para a geração do formulário estruturado"
                    />
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      📋 Formulário de Macroscopia
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      Campos do formulário que serão preenchidos automaticamente pela IA
                    </Typography>

                    {/* Formulário de Macroscopia */}
                    {transcriptionText || editedTranscription ? (
                      <Box sx={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {!formGenerated && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                              📝 Campos prontos para preenchimento. Clique em "Gerar Relatório" para preenchimento automático via IA.
                            </Typography>
                          </Alert>
                        )}

                        {formGenerated && (
                          <Alert severity="success" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                              ✅ Formulário preenchido pela IA! Revise e edite conforme necessário.
                            </Typography>
                          </Alert>
                        )}

                        <Box sx={{
                          transition: 'all 0.3s ease-in-out',
                          opacity: formGenerated ? 1 : 0.7
                        }}>
                          <Grid container spacing={2}>
                            {Object.entries(formData).map(([functionKey, value], index) => {
                              const functionLabels = {
                                preencher_identificacao: '📋 Identificação',
                                preencher_coloracao: '🎨 Coloração',
                                preencher_consistencia: '✋ Consistência',
                                preencher_superficie: '🔍 Superfície',
                                identificar_lesoes: '🔍 Lesões',
                                avaliar_inflamacao: '🩺 Inflamação',
                                registrar_observacoes: '📝 Observações',
                                gerar_conclusao: '📊 Conclusão'
                              };

                              return (
                                <Grid item xs={12} key={functionKey}>
                                  <Box sx={{
                                    border: animatingField === functionKey ? '2px solid #1976d2' : 'none',
                                    borderRadius: 1,
                                    p: animatingField === functionKey ? 1 : 0,
                                    transition: 'all 0.3s ease-in-out',
                                    backgroundColor: animatingField === functionKey ? '#e3f2fd' : 'transparent'
                                  }}>
                                    <TextField
                                      fullWidth
                                      multiline
                                      rows={3}
                                      label={functionLabels[functionKey as keyof typeof functionLabels]}
                                      value={value}
                                      onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        [functionKey]: e.target.value
                                      }))}
                                      placeholder={`Campo preenchido automaticamente pela IA com base na função ${functionKey}`}
                                      variant="outlined"
                                      size="small"
                                      InputProps={{
                                        endAdornment: animatingField === functionKey && (
                                          <Chip
                                            size="small"
                                            label="Preenchendo..."
                                            color="primary"
                                            sx={{ fontSize: '0.7rem' }}
                                          />
                                        )
                                      }}
                                    />
                                  </Box>
                                </Grid>
                              );
                            })}
                          </Grid>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" color="textSecondary">
                          O formulário aparecerá aqui após a transcrição de áudio
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Box sx={{ mb: 1 }}>
              {!formGenerated ? (
                <Button
                  variant="contained"
                  onClick={generateReport}
                  sx={{ mt: 1, mr: 1 }}
                  startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesome />}
                  disabled={loading || !editedTranscription.trim()}
                >
                  {loading ? 'Gerando Relatório...' : 'Gerar Relatório'}
                </Button>
              ) : (
                <>
                  <Button
                    variant="contained"
                    onClick={reviewFormAndProceed}
                    sx={{ mt: 1, mr: 1 }}
                    startIcon={<CheckCircle />}
                    color="success"
                  >
                    Revisar Formulário Completo
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setFormGenerated(false)}
                    sx={{ mt: 1 }}
                    startIcon={<AutoAwesome />}
                  >
                    Gerar Novamente
                  </Button>
                </>
              )}
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
                      Todos os dados coletados serão salvos no banco
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                      onClick={saveToDatabase}
                      disabled={loading}
                      size="large"
                    >
                      {loading ? 'Salvando...' : 'Salvar no Banco'}
                    </Button>
                  </Box>
                ) : (
                  <Alert severity="success">
                    ✅ Análise salva com sucesso no banco de dados!
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Box sx={{ mb: 1 }}>
              <Button
                variant="contained"
                onClick={() => setActiveStep(0)}
                sx={{ mt: 1, mr: 1 }}
              >
                Nova Análise
              </Button>
            </Box>
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
