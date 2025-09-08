/**
 * Página de calibração do sistema
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Container,
  Typography,
  Alert,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  CameraAlt,
  Mic,
  GridOn,
  Preview,
  Save,
} from '@mui/icons-material';
import Layout from '../components/Layout/Layout';
import CameraSetup from '../components/Calibration/CameraSetup';
import AudioSetup from '../components/Calibration/AudioSetup';
// import GridDetection from '../components/Calibration/GridDetection';
// import PreviewTest from '../components/Calibration/PreviewTest';
import { CalibrationStep, CalibrationState, CameraSettings, AudioSettings } from '../types/calibration';
import { calibrationApi } from '../services/calibrationApi';
import { useAuth } from '../contexts/AuthContext';

const steps = [
  {
    key: 'camera_setup' as CalibrationStep,
    label: 'Configurar Câmera',
    icon: <CameraAlt />,
    description: 'Configure sua webcam para captura de imagens'
  },
  {
    key: 'audio_setup' as CalibrationStep,
    label: 'Configurar Áudio',
    icon: <Mic />,
    description: 'Configure seu microfone para transcrição'
  },
  {
    key: 'grid_detection' as CalibrationStep,
    label: 'Detectar Grade',
    icon: <GridOn />,
    description: 'Configure o papel quadriculado para medições'
  },
  {
    key: 'preview_test' as CalibrationStep,
    label: 'Teste e Preview',
    icon: <Preview />,
    description: 'Teste final do sistema configurado'
  },
  {
    key: 'save_config' as CalibrationStep,
    label: 'Salvar Configuração',
    icon: <Save />,
    description: 'Salvar calibração no sistema'
  }
];

const Calibration: React.FC = () => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<CalibrationStep>('camera_setup');
  const [calibrationState, setCalibrationState] = useState<CalibrationState>({
    currentStep: 'camera_setup',
    cameraIndex: -1,
    audioDeviceIndex: -1,
    gridSizeMm: 5.0,
    cameraSettings: {
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      brightness: 50,
      contrast: 50,
      saturation: 50,
      auto_focus: true,
      auto_white_balance: true,
    },
    audioSettings: {
      sample_rate: 44100,
      channels: 1,
      bit_depth: 16,
      buffer_size: 1024,
      input_device: -1,
      volume: 75,
      noise_suppression: true,
      auto_gain: true,
    },
    isValid: false,
    errors: []
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Carregar configurações padrão ao inicializar
  useEffect(() => {
    loadDefaultSettings();
  }, []);

  const loadDefaultSettings = async () => {
    try {
      setLoading(true);
      const defaultSettings = await calibrationApi.getDefaultSettings();
      
      setCalibrationState(prev => ({
        ...prev,
        cameraSettings: defaultSettings.camera,
        audioSettings: defaultSettings.audio,
        gridSizeMm: defaultSettings.grid_size_mm
      }));
    } catch (err: any) {
      console.error('Erro ao carregar configurações padrão:', err);
      setError('Erro ao carregar configurações padrão');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.key === currentStep);
  };

  const handleCameraChange = (index: number) => {
    setCalibrationState(prev => ({
      ...prev,
      cameraIndex: index,
      audioSettings: {
        ...prev.audioSettings,
        input_device: index // Assumir que o dispositivo de áudio padrão corresponde
      }
    }));
  };

  const handleAudioDeviceChange = (index: number) => {
    setCalibrationState(prev => ({
      ...prev,
      audioDeviceIndex: index,
      audioSettings: {
        ...prev.audioSettings,
        input_device: index
      }
    }));
  };

  const handleCameraSettingsChange = (settings: CameraSettings) => {
    setCalibrationState(prev => ({
      ...prev,
      cameraSettings: settings
    }));
  };

  const handleAudioSettingsChange = (settings: AudioSettings) => {
    setCalibrationState(prev => ({
      ...prev,
      audioSettings: settings
    }));
  };

  const nextStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < steps.length - 1) {
      const nextStepKey = steps[currentIndex + 1].key;
      setCurrentStep(nextStepKey);
      setCalibrationState(prev => ({
        ...prev,
        currentStep: nextStepKey
      }));
    }
  };

  const prevStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      const prevStepKey = steps[currentIndex - 1].key;
      setCurrentStep(prevStepKey);
      setCalibrationState(prev => ({
        ...prev,
        currentStep: prevStepKey
      }));
    }
  };

  const handleSaveCalibration = async () => {
    try {
      setLoading(true);
      setError('');

      // Criar calibração completa
      const calibration = await calibrationApi.performFullCalibration(
        calibrationState.cameraIndex,
        calibrationState.audioDeviceIndex,
        calibrationState.gridSizeMm,
        calibrationState.cameraSettings,
        calibrationState.audioSettings
      );

      setSuccess('Calibração salva com sucesso!');
      console.log('Calibração criada:', calibration);
      
      // Opcional: redirecionar para dashboard após alguns segundos
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
      
    } catch (err: any) {
      setError(`Erro ao salvar calibração: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'camera_setup':
        return (
          <CameraSetup
            selectedCamera={calibrationState.cameraIndex}
            onCameraChange={handleCameraChange}
            cameraSettings={calibrationState.cameraSettings}
            onSettingsChange={handleCameraSettingsChange}
            onNext={nextStep}
          />
        );
      
      case 'audio_setup':
        return (
          <AudioSetup
            selectedDevice={calibrationState.audioDeviceIndex}
            onDeviceChange={handleAudioDeviceChange}
            audioSettings={calibrationState.audioSettings}
            onSettingsChange={handleAudioSettingsChange}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      
      case 'grid_detection':
        return (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <GridOn sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom>
              Detecção de Grade
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Esta funcionalidade será implementada na próxima fase.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', maxWidth: 400, mx: 'auto' }}>
              <Button variant="outlined" onClick={prevStep}>
                Voltar
              </Button>
              <Button variant="contained" onClick={nextStep}>
                Próximo
              </Button>
            </Box>
          </Box>
        );
      
      case 'preview_test':
        return (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Preview sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom>
              Teste e Preview
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Esta funcionalidade será implementada na próxima fase.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', maxWidth: 400, mx: 'auto' }}>
              <Button variant="outlined" onClick={prevStep}>
                Voltar
              </Button>
              <Button variant="contained" onClick={nextStep}>
                Próximo
              </Button>
            </Box>
          </Box>
        );
      
      case 'save_config':
        return (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Save sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom>
              Salvar Configuração
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Finalize a calibração salvando suas configurações no sistema.
            </Typography>
            
            {/* Resumo da configuração */}
            <Paper elevation={1} sx={{ p: 3, mb: 4, textAlign: 'left', maxWidth: 600, mx: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Resumo da Calibração
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Câmera:</strong> Índice {calibrationState.cameraIndex} 
                ({calibrationState.cameraSettings.resolution.width}x{calibrationState.cameraSettings.resolution.height})
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Áudio:</strong> Dispositivo {calibrationState.audioDeviceIndex} 
                ({calibrationState.audioSettings.sample_rate}Hz, {calibrationState.audioSettings.channels} canal)
              </Typography>
              <Typography variant="body2">
                <strong>Grade:</strong> {calibrationState.gridSizeMm}mm
              </Typography>
            </Paper>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', maxWidth: 400, mx: 'auto' }}>
              <Button variant="outlined" onClick={prevStep} disabled={loading}>
                Voltar
              </Button>
              <Button 
                variant="contained" 
                onClick={handleSaveCalibration}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <Save />}
              >
                {loading ? 'Salvando...' : 'Salvar Calibração'}
              </Button>
            </Box>
          </Box>
        );
      
      default:
        return null;
    }
  };

  if (loading && currentStep === 'camera_setup') {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress size={48} />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout maxWidth="lg">
      <Container>
        {/* Cabeçalho */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Calibração do Sistema
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure sua webcam, microfone e papel quadriculado para usar o sistema de macroscopia.
          </Typography>
        </Box>

        {/* Alertas */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        {/* Stepper */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Stepper activeStep={getCurrentStepIndex()} alternativeLabel>
            {steps.map((step, index) => (
              <Step key={step.key}>
                <StepLabel
                  StepIconComponent={() => (
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: index <= getCurrentStepIndex() ? 'primary.main' : 'grey.300',
                        color: index <= getCurrentStepIndex() ? 'white' : 'grey.500',
                      }}
                    >
                      {step.icon}
                    </Box>
                  )}
                >
                  <Typography variant="subtitle2">
                    {step.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {/* Conteúdo do passo atual */}
        <Paper elevation={2} sx={{ p: 4 }}>
          {renderCurrentStep()}
        </Paper>
      </Container>
    </Layout>
  );
};

export default Calibration;