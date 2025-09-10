/**
 * Página de calibração do sistema - Componentes individuais
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Container,
  Typography,
  Alert,
  Button,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
} from '@mui/material';
import {
  CameraAlt,
  Mic,
  GridOn,
  Preview,
  CheckCircle,
  Error,
  Warning,
  Settings,
  PlayArrow,
} from '@mui/icons-material';
import Layout from '../components/Layout/Layout';
import CameraSetup from '../components/Calibration/CameraSetup';
import AudioSetup from '../components/Calibration/AudioSetup';
import GridCalibrationCamera from '../components/Calibration/GridCalibrationCamera';
import { CameraSettings, AudioSettings } from '../types/calibration';
import { calibrationApi } from '../services/calibrationApi';
import { useCalibrationStatus } from '../hooks/useCalibrationStatus';
import StatusService from '../services/statusService';


const Calibration: React.FC = () => {
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // Use synchronized status management
  const { status, updateComponentStatus, saveCalibration } = useCalibrationStatus();
  
  // Estados individuais de configuração
  const [cameraConfig, setCameraConfig] = useState({
    index: -1,
    settings: {
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      brightness: 50,
      contrast: 50,
      saturation: 50,
      auto_focus: true,
      auto_white_balance: true,
    } as CameraSettings,
    calibrationId: null as number | null
  });
  
  const [audioConfig, setAudioConfig] = useState({
    deviceIndex: -1,
    settings: {
      sample_rate: 44100,
      channels: 1,
      bit_depth: 16,
      buffer_size: 1024,
      input_device: -1,
      volume: 75,
      noise_suppression: true,
      auto_gain: true,
    } as AudioSettings,
    calibrationId: null as number | null
  });
  
  const [gridConfig, setGridConfig] = useState({
    sizeMm: 5.0,
    detectionConfidence: 0,
    calibrationId: null as number | null
  });
  
  // Dialog states
  const [cameraDialog, setCameraDialog] = useState(false);
  const [audioDialog, setAudioDialog] = useState(false);
  const [gridDialog, setGridDialog] = useState(false);

  // Initialize local configs based on synchronized status
  useEffect(() => {
    if (status?.calibration) {
      const calibration = status.calibration;
      
      if (calibration.camera_settings) {
        setCameraConfig(prev => ({
          ...prev,
          settings: calibration.camera_settings as CameraSettings,
          calibrationId: calibration.id
        }));
      }
      
      if (calibration.audio_settings) {
        setAudioConfig(prev => ({
          ...prev,
          settings: calibration.audio_settings as AudioSettings,
          calibrationId: calibration.id
        }));
      }
      
      if (calibration.grid_size_mm) {
        setGridConfig(prev => ({
          ...prev,
          sizeMm: calibration.grid_size_mm,
          calibrationId: calibration.id
        }));
      }
    }
  }, [status?.calibration]);

  // Salvar calibração individual da câmera
  const saveCameraCalibration = async () => {
    try {
      updateComponentStatus('camera', 'testing');
      
      const calibrationData = {
        grid_size_mm: gridConfig.sizeMm || 5.0,
        camera_settings: cameraConfig.settings,
        audio_settings: audioConfig.settings
      };
      
      await saveCalibration(calibrationData);
      setCameraDialog(false);
      setSnackbar({ open: true, message: 'Calibração da câmera salva com sucesso!', severity: 'success' });
      
    } catch (err: any) {
      updateComponentStatus('camera', 'error');
      setSnackbar({ open: true, message: `Erro ao salvar calibração da câmera: ${err.message}`, severity: 'error' });
    }
  };

  // Salvar calibração individual do áudio
  const saveAudioCalibration = async () => {
    try {
      updateComponentStatus('audio', 'testing');
      
      const calibrationData = {
        grid_size_mm: gridConfig.sizeMm || 5.0,
        camera_settings: cameraConfig.settings,
        audio_settings: audioConfig.settings
      };
      
      await saveCalibration(calibrationData);
      setAudioDialog(false);
      setSnackbar({ open: true, message: 'Calibração do áudio salva com sucesso!', severity: 'success' });
      
    } catch (err: any) {
      updateComponentStatus('audio', 'error');
      setSnackbar({ open: true, message: `Erro ao salvar calibração do áudio: ${err.message}`, severity: 'error' });
    }
  };

  // Salvar calibração individual da grade
  const saveGridCalibration = async () => {
    try {
      updateComponentStatus('grid', 'testing');
      
      // Testar detecção da grade primeiro
      const gridTest = await calibrationApi.detectGrid(cameraConfig.index, gridConfig.sizeMm);
      
      if (gridTest.grid_detected && gridTest.grid_info.confidence > 0.7) {
        const calibrationData = {
          grid_size_mm: gridConfig.sizeMm,
          camera_settings: cameraConfig.settings,
          audio_settings: audioConfig.settings
        };
        
        await saveCalibration(calibrationData);
        setGridConfig(prev => ({ ...prev, detectionConfidence: gridTest.grid_info.confidence }));
        setSnackbar({ open: true, message: `Calibração da grade salva! Confiança: ${(gridTest.grid_info.confidence * 100).toFixed(1)}%`, severity: 'success' });
        setGridDialog(false);
        
      } else {
        updateComponentStatus('grid', 'error');
        setSnackbar({ open: true, message: 'Falha na detecção da grade. Verifique o posicionamento do papel quadriculado.', severity: 'error' });
      }
      
    } catch (err: any) {
      updateComponentStatus('grid', 'error');
      setSnackbar({ open: true, message: `Erro ao calibrar grade: ${err.message}`, severity: 'error' });
    }
  };

  // Testar sistema completo
  const testCompleteSystem = async () => {
    try {
      updateComponentStatus('preview', 'testing');
      
      // Validar todas as configurações
      const validation = await calibrationApi.validateSettings(
        cameraConfig.settings,
        audioConfig.settings
      );
      
      if (validation.camera_valid && validation.audio_valid) {
        updateComponentStatus('preview', 'configured');
        setSnackbar({ open: true, message: 'Sistema testado com sucesso! Todas as configurações estão válidas.', severity: 'success' });
      } else {
        updateComponentStatus('preview', 'error');
        setSnackbar({ open: true, message: `Teste falhou: ${validation.camera_valid ? '' : 'Câmera inválida. '} ${validation.audio_valid ? '' : 'Áudio inválido.'}`, severity: 'error' });
      }
      
    } catch (err: any) {
      updateComponentStatus('preview', 'error');
      setSnackbar({ open: true, message: `Erro no teste: ${err.message}`, severity: 'error' });
    }
  };

  const getStatusIcon = (componentStatus: any) => {
    switch (componentStatus) {
      case 'configured': return <CheckCircle color="success" />;
      case 'testing': return <CircularProgress size={20} />;
      case 'error': return <Error color="error" />;
      default: return <Warning color="warning" />;
    }
  };

  const getStatusColor = (componentStatus: any) => {
    return StatusService.getComponentStatusColor(componentStatus);
  };

  const getStatusText = (componentStatus: any) => {
    switch (componentStatus) {
      case 'configured': return 'Configurado';
      case 'testing': return 'Testando...';
      case 'error': return 'Erro';
      default: return 'Não Configurado';
    }
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Settings />
            Calibração do Sistema - Componentes Individuais
          </Typography>
          
          <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
            Configure cada componente do sistema individualmente. Você pode calibrar e salvar as configurações de cada componente separadamente.
          </Typography>

          <Grid container spacing={3}>
            {/* Componente Câmera */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CameraAlt color="primary" />
                    <Typography variant="h6">
                      Configuração da Câmera
                    </Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <Chip 
                        icon={getStatusIcon(status?.componentStatus.camera)}
                        label={getStatusText(status?.componentStatus.camera)}
                        color={getStatusColor(status?.componentStatus.camera)}
                        size="small"
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Configure sua webcam para captura de imagens de alta qualidade das amostras.
                  </Typography>
                  
                  {status?.componentStatus.camera === 'configured' && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="success.main">
                        ✓ Câmera configurada: Resolução {cameraConfig.settings.resolution.width}x{cameraConfig.settings.resolution.height}, {cameraConfig.settings.fps}fps
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                
                <CardActions>
                  <Button 
                    variant="contained" 
                    startIcon={<Settings />}
                    onClick={() => setCameraDialog(true)}
                    disabled={status?.componentStatus.camera === 'testing'}
                  >
                    Configurar Câmera
                  </Button>
                </CardActions>
              </Card>
            </Grid>

            {/* Componente Áudio */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Mic color="primary" />
                    <Typography variant="h6">
                      Configuração do Áudio
                    </Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <Chip 
                        icon={getStatusIcon(status?.componentStatus.audio)}
                        label={getStatusText(status?.componentStatus.audio)}
                        color={getStatusColor(status?.componentStatus.audio)}
                        size="small"
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Configure seu microfone para transcrição automática de laudos médicos.
                  </Typography>
                  
                  {status?.componentStatus.audio === 'configured' && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="success.main">
                        ✓ Áudio configurado: {audioConfig.settings.sample_rate}Hz, {audioConfig.settings.channels} canal, Volume {audioConfig.settings.volume}%
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                
                <CardActions>
                  <Button 
                    variant="contained" 
                    startIcon={<Settings />}
                    onClick={() => setAudioDialog(true)}
                    disabled={status?.componentStatus.audio === 'testing'}
                  >
                    Configurar Áudio
                  </Button>
                </CardActions>
              </Card>
            </Grid>

            {/* Componente Grade */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <GridOn color="primary" />
                    <Typography variant="h6">
                      Detecção de Grade
                    </Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <Chip 
                        icon={getStatusIcon(status?.componentStatus.grid)}
                        label={getStatusText(status?.componentStatus.grid)}
                        color={getStatusColor(status?.componentStatus.grid)}
                        size="small"
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Calibre o sistema para detectar automaticamente o papel quadriculado para medições precisas.
                  </Typography>
                  
                  {status?.componentStatus.grid === 'configured' && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="success.main">
                        ✓ Grade configurada: {gridConfig.sizeMm}mm, Confiança: {(gridConfig.detectionConfidence * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                
                <CardActions>
                  <Button 
                    variant="contained" 
                    startIcon={<GridOn />}
                    onClick={() => setGridDialog(true)}
                    disabled={status?.componentStatus.grid === 'testing' || status?.componentStatus.camera !== 'configured'}
                  >
                    Calibrar Grade
                  </Button>
                </CardActions>
              </Card>
            </Grid>

            {/* Componente Teste Completo */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Preview color="primary" />
                    <Typography variant="h6">
                      Teste do Sistema
                    </Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <Chip 
                        icon={getStatusIcon(status?.componentStatus.preview)}
                        label={getStatusText(status?.componentStatus.preview)}
                        color={getStatusColor(status?.componentStatus.preview)}
                        size="small"
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Execute um teste completo do sistema para validar todas as configurações.
                  </Typography>
                  
                  {status?.componentStatus.preview === 'configured' && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="success.main">
                        ✓ Sistema testado: Todas as configurações válidas
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                
                <CardActions>
                  <Button 
                    variant="contained" 
                    startIcon={<PlayArrow />}
                    onClick={testCompleteSystem}
                    disabled={status?.componentStatus.preview === 'testing' || 
                             status?.componentStatus.camera !== 'configured' || 
                             status?.componentStatus.audio !== 'configured'}
                  >
                    Testar Sistema
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </Grid>

          {/* Status Geral */}
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Status Geral do Sistema
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  {getStatusIcon(status?.componentStatus.camera)}
                  <Typography variant="caption" display="block">Câmera</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  {getStatusIcon(status?.componentStatus.audio)}
                  <Typography variant="caption" display="block">Áudio</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  {getStatusIcon(status?.componentStatus.grid)}
                  <Typography variant="caption" display="block">Grade</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  {getStatusIcon(status?.componentStatus.preview)}
                  <Typography variant="caption" display="block">Sistema</Typography>
                </Box>
              </Grid>
            </Grid>
            
            {status?.componentStatus && Object.values(status.componentStatus).every(componentState => componentState === 'configured') && (
              <Alert severity="success" sx={{ mt: 2 }}>
                ✅ Sistema completamente calibrado! Todas as configurações estão válidas e salvas.
              </Alert>
            )}
          </Box>

          {/* Dialogs para configuração individual */}
          
          {/* Dialog Câmera */}
          <Dialog open={cameraDialog} onClose={() => setCameraDialog(false)} maxWidth="md" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CameraAlt />
                Configuração da Câmera
              </Box>
            </DialogTitle>
            <DialogContent>
              <CameraSetup
                selectedCamera={cameraConfig.index}
                cameraSettings={cameraConfig.settings}
                onCameraChange={(index) => setCameraConfig(prev => ({ ...prev, index }))}
                onSettingsChange={(settings) => setCameraConfig(prev => ({ ...prev, settings }))}
                onNext={() => {}} // Not needed in dialog mode
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCameraDialog(false)}>
                Cancelar
              </Button>
              <Button 
                variant="contained" 
                onClick={saveCameraCalibration}
                disabled={cameraConfig.index === -1 || status?.componentStatus.camera === 'testing'}
              >
                {status?.componentStatus.camera === 'testing' ? (
                  <CircularProgress size={20} />
                ) : (
                  'Salvar Configuração'
                )}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Dialog Áudio */}
          <Dialog open={audioDialog} onClose={() => setAudioDialog(false)} maxWidth="md" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Mic />
                Configuração do Áudio
              </Box>
            </DialogTitle>
            <DialogContent>
              <AudioSetup
                selectedDevice={audioConfig.deviceIndex}
                audioSettings={audioConfig.settings}
                onDeviceChange={(index) => setAudioConfig(prev => ({ ...prev, deviceIndex: index }))}
                onSettingsChange={(settings) => setAudioConfig(prev => ({ ...prev, settings }))}
                onNext={() => {}} // Not needed in dialog mode
                onBack={() => {}} // Not needed in dialog mode
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAudioDialog(false)}>
                Cancelar
              </Button>
              <Button 
                variant="contained" 
                onClick={saveAudioCalibration}
                disabled={audioConfig.deviceIndex === -1 || status?.componentStatus.audio === 'testing'}
              >
                {status?.componentStatus.audio === 'testing' ? (
                  <CircularProgress size={20} />
                ) : (
                  'Salvar Configuração'
                )}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Dialog Grade com Câmera */}
          <Dialog open={gridDialog} onClose={() => setGridDialog(false)} maxWidth="md" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GridOn />
                Calibração da Grade
              </Box>
            </DialogTitle>
            <DialogContent>
              <GridCalibrationCamera
                gridSizeMm={gridConfig.sizeMm}
                cameraIndex={cameraConfig.index >= 0 ? cameraConfig.index : 0}
                onGridDetected={(calibrationData) => {
                  setGridConfig(prev => ({
                    ...prev,
                    detectionConfidence: calibrationData.confidence
                  }));
                  
                  if (calibrationData.confidence > 0.7) {
                    updateComponentStatus('grid', 'configured');
                    setSnackbar({ 
                      open: true, 
                      message: `Grade detectada com ${(calibrationData.confidence * 100).toFixed(1)}% de confiança!`, 
                      severity: 'success' 
                    });
                  }
                }}
                onError={(error) => {
                  setSnackbar({ open: true, message: error, severity: 'error' });
                  updateComponentStatus('grid', 'error');
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setGridDialog(false)}>
                Fechar
              </Button>
              <Button 
                variant="contained" 
                onClick={saveGridCalibration}
                disabled={status?.componentStatus.grid === 'testing' || gridConfig.detectionConfidence < 0.7}
              >
                {status?.componentStatus.grid === 'testing' ? (
                  <CircularProgress size={20} />
                ) : (
                  'Salvar Calibração'
                )}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Snackbar para notificações */}
          <Snackbar 
            open={snackbar.open} 
            autoHideDuration={6000} 
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          >
            <Alert 
              onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
              severity={snackbar.severity}
              sx={{ width: '100%' }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Paper>
      </Container>
    </Layout>
  );
};
export default Calibration;