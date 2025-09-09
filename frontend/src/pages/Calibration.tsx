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
import { CameraSettings, AudioSettings } from '../types/calibration';
import { calibrationApi } from '../services/calibrationApi';
import { useAuth } from '../contexts/AuthContext';

interface ComponentCalibrationStatus {
  camera: 'not_configured' | 'configured' | 'testing' | 'error';
  audio: 'not_configured' | 'configured' | 'testing' | 'error';
  grid: 'not_configured' | 'configured' | 'testing' | 'error';
  preview: 'not_configured' | 'configured' | 'testing' | 'error';
}

const Calibration: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // Estado de calibração individual
  const [componentStatus, setComponentStatus] = useState<ComponentCalibrationStatus>({
    camera: 'not_configured',
    audio: 'not_configured', 
    grid: 'not_configured',
    preview: 'not_configured'
  });
  
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

  // Carregar configurações existentes
  useEffect(() => {
    loadExistingCalibrations();
  }, []);

  const loadExistingCalibrations = async () => {
    try {
      setLoading(true);
      const currentCalibration = await calibrationApi.getCurrentCalibration();
      
      if (currentCalibration) {
        // Atualizar estados baseado na calibração existente
        if (currentCalibration.camera_settings) {
          setCameraConfig(prev => ({
            ...prev,
            settings: currentCalibration.camera_settings as CameraSettings,
            calibrationId: currentCalibration.id
          }));
          setComponentStatus(prev => ({ ...prev, camera: 'configured' }));
        }
        
        if (currentCalibration.audio_settings) {
          setAudioConfig(prev => ({
            ...prev,
            settings: currentCalibration.audio_settings as AudioSettings,
            calibrationId: currentCalibration.id
          }));
          setComponentStatus(prev => ({ ...prev, audio: 'configured' }));
        }
        
        if (currentCalibration.grid_size_mm) {
          setGridConfig(prev => ({
            ...prev,
            sizeMm: currentCalibration.grid_size_mm,
            calibrationId: currentCalibration.id
          }));
          setComponentStatus(prev => ({ ...prev, grid: 'configured' }));
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar calibrações:', err);
    } finally {
      setLoading(false);
    }
  };

  // Salvar calibração individual da câmera
  const saveCameraCalibration = async () => {
    try {
      setComponentStatus(prev => ({ ...prev, camera: 'testing' }));
      
      const calibrationData = {
        grid_size_mm: gridConfig.sizeMm || 5.0,
        camera_settings: cameraConfig.settings,
        audio_settings: audioConfig.settings
      };
      
      if (cameraConfig.calibrationId) {
        await calibrationApi.updateCurrentCalibration(calibrationData);
      } else {
        const newCalibration = await calibrationApi.createCalibration(calibrationData);
        setCameraConfig(prev => ({ ...prev, calibrationId: newCalibration.id }));
      }
      
      setComponentStatus(prev => ({ ...prev, camera: 'configured' }));
      setSnackbar({ open: true, message: 'Calibração da câmera salva com sucesso!', severity: 'success' });
      setCameraDialog(false);
      
      // Atualizar todas as configurações para manter consistência
      await loadExistingCalibrations();
      
    } catch (err: any) {
      setComponentStatus(prev => ({ ...prev, camera: 'error' }));
      setSnackbar({ open: true, message: `Erro ao salvar calibração da câmera: ${err.message}`, severity: 'error' });
    }
  };

  // Salvar calibração individual do áudio
  const saveAudioCalibration = async () => {
    try {
      setComponentStatus(prev => ({ ...prev, audio: 'testing' }));
      
      const calibrationData = {
        grid_size_mm: gridConfig.sizeMm || 5.0,
        camera_settings: cameraConfig.settings,
        audio_settings: audioConfig.settings
      };
      
      if (audioConfig.calibrationId) {
        await calibrationApi.updateCurrentCalibration(calibrationData);
      } else {
        const newCalibration = await calibrationApi.createCalibration(calibrationData);
        setAudioConfig(prev => ({ ...prev, calibrationId: newCalibration.id }));
      }
      
      setComponentStatus(prev => ({ ...prev, audio: 'configured' }));
      setSnackbar({ open: true, message: 'Calibração do áudio salva com sucesso!', severity: 'success' });
      setAudioDialog(false);
      
      // Atualizar todas as configurações para manter consistência
      await loadExistingCalibrations();
      
    } catch (err: any) {
      setComponentStatus(prev => ({ ...prev, audio: 'error' }));
      setSnackbar({ open: true, message: `Erro ao salvar calibração do áudio: ${err.message}`, severity: 'error' });
    }
  };

  // Salvar calibração individual da grade
  const saveGridCalibration = async () => {
    try {
      setComponentStatus(prev => ({ ...prev, grid: 'testing' }));
      
      // Testar detecção da grade primeiro
      const gridTest = await calibrationApi.detectGrid(cameraConfig.index, gridConfig.sizeMm);
      
      if (gridTest.grid_detected && gridTest.grid_info.confidence > 0.7) {
        const calibrationData = {
          grid_size_mm: gridConfig.sizeMm,
          camera_settings: cameraConfig.settings,
          audio_settings: audioConfig.settings
        };
        
        if (gridConfig.calibrationId) {
          await calibrationApi.updateCurrentCalibration(calibrationData);
        } else {
          const newCalibration = await calibrationApi.createCalibration(calibrationData);
          setGridConfig(prev => ({ ...prev, calibrationId: newCalibration.id }));
        }
        
        setGridConfig(prev => ({ ...prev, detectionConfidence: gridTest.grid_info.confidence }));
        setComponentStatus(prev => ({ ...prev, grid: 'configured' }));
        setSnackbar({ open: true, message: `Calibração da grade salva! Confiança: ${(gridTest.grid_info.confidence * 100).toFixed(1)}%`, severity: 'success' });
        setGridDialog(false);
        
        // Atualizar todas as configurações para manter consistência
        await loadExistingCalibrations();
        
      } else {
        setComponentStatus(prev => ({ ...prev, grid: 'error' }));
        setSnackbar({ open: true, message: 'Falha na detecção da grade. Verifique o posicionamento do papel quadriculado.', severity: 'error' });
      }
      
    } catch (err: any) {
      setComponentStatus(prev => ({ ...prev, grid: 'error' }));
      setSnackbar({ open: true, message: `Erro ao calibrar grade: ${err.message}`, severity: 'error' });
    }
  };

  // Testar sistema completo
  const testCompleteSystem = async () => {
    try {
      setComponentStatus(prev => ({ ...prev, preview: 'testing' }));
      
      // Validar todas as configurações
      const validation = await calibrationApi.validateSettings(
        cameraConfig.settings,
        audioConfig.settings
      );
      
      if (validation.camera_valid && validation.audio_valid) {
        setComponentStatus(prev => ({ ...prev, preview: 'configured' }));
        setSnackbar({ open: true, message: 'Sistema testado com sucesso! Todas as configurações estão válidas.', severity: 'success' });
      } else {
        setComponentStatus(prev => ({ ...prev, preview: 'error' }));
        setSnackbar({ open: true, message: `Teste falhou: ${validation.camera_valid ? '' : 'Câmera inválida. '} ${validation.audio_valid ? '' : 'Áudio inválido.'}`, severity: 'error' });
      }
      
    } catch (err: any) {
      setComponentStatus(prev => ({ ...prev, preview: 'error' }));
      setSnackbar({ open: true, message: `Erro no teste: ${err.message}`, severity: 'error' });
    }
  };

  const getStatusIcon = (status: ComponentCalibrationStatus[keyof ComponentCalibrationStatus]) => {
    switch (status) {
      case 'configured': return <CheckCircle color="success" />;
      case 'testing': return <CircularProgress size={20} />;
      case 'error': return <Error color="error" />;
      default: return <Warning color="warning" />;
    }
  };

  const getStatusColor = (status: ComponentCalibrationStatus[keyof ComponentCalibrationStatus]): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case 'configured': return 'success';
      case 'testing': return 'info';
      case 'error': return 'error';
      default: return 'warning';
    }
  };

  const getStatusText = (status: ComponentCalibrationStatus[keyof ComponentCalibrationStatus]) => {
    switch (status) {
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
                        icon={getStatusIcon(componentStatus.camera)}
                        label={getStatusText(componentStatus.camera)}
                        color={getStatusColor(componentStatus.camera)}
                        size="small"
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Configure sua webcam para captura de imagens de alta qualidade das amostras.
                  </Typography>
                  
                  {componentStatus.camera === 'configured' && (
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
                    disabled={componentStatus.camera === 'testing'}
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
                        icon={getStatusIcon(componentStatus.audio)}
                        label={getStatusText(componentStatus.audio)}
                        color={getStatusColor(componentStatus.audio)}
                        size="small"
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Configure seu microfone para transcrição automática de laudos médicos.
                  </Typography>
                  
                  {componentStatus.audio === 'configured' && (
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
                    disabled={componentStatus.audio === 'testing'}
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
                        icon={getStatusIcon(componentStatus.grid)}
                        label={getStatusText(componentStatus.grid)}
                        color={getStatusColor(componentStatus.grid)}
                        size="small"
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Calibre o sistema para detectar automaticamente o papel quadriculado para medições precisas.
                  </Typography>
                  
                  {componentStatus.grid === 'configured' && (
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
                    disabled={componentStatus.grid === 'testing' || componentStatus.camera !== 'configured'}
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
                        icon={getStatusIcon(componentStatus.preview)}
                        label={getStatusText(componentStatus.preview)}
                        color={getStatusColor(componentStatus.preview)}
                        size="small"
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Execute um teste completo do sistema para validar todas as configurações.
                  </Typography>
                  
                  {componentStatus.preview === 'configured' && (
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
                    disabled={componentStatus.preview === 'testing' || 
                             componentStatus.camera !== 'configured' || 
                             componentStatus.audio !== 'configured'}
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
                  {getStatusIcon(componentStatus.camera)}
                  <Typography variant="caption" display="block">Câmera</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  {getStatusIcon(componentStatus.audio)}
                  <Typography variant="caption" display="block">Áudio</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  {getStatusIcon(componentStatus.grid)}
                  <Typography variant="caption" display="block">Grade</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  {getStatusIcon(componentStatus.preview)}
                  <Typography variant="caption" display="block">Sistema</Typography>
                </Box>
              </Grid>
            </Grid>
            
            {Object.values(componentStatus).every(status => status === 'configured') && (
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
                disabled={cameraConfig.index === -1 || componentStatus.camera === 'testing'}
              >
                {componentStatus.camera === 'testing' ? (
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
                disabled={audioConfig.deviceIndex === -1 || componentStatus.audio === 'testing'}
              >
                {componentStatus.audio === 'testing' ? (
                  <CircularProgress size={20} />
                ) : (
                  'Salvar Configuração'
                )}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Dialog Grade */}
          <Dialog open={gridDialog} onClose={() => setGridDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GridOn />
                Calibração da Grade
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ py: 2 }}>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  Posicione o papel quadriculado na frente da câmera e clique em "Detectar Grade" para calibrar o sistema de medição.
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Tamanho da grade:</strong> {gridConfig.sizeMm}mm
                </Typography>
                
                {gridConfig.detectionConfidence > 0 && (
                  <Typography variant="body2" color="success.main">
                    <strong>Última detecção:</strong> {(gridConfig.detectionConfidence * 100).toFixed(1)}% de confiança
                  </Typography>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setGridDialog(false)}>
                Cancelar
              </Button>
              <Button 
                variant="contained" 
                onClick={saveGridCalibration}
                disabled={componentStatus.grid === 'testing'}
              >
                {componentStatus.grid === 'testing' ? (
                  <CircularProgress size={20} />
                ) : (
                  'Detectar e Salvar Grade'
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