/**
 * Componente de configuração da câmera
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Paper,
} from '@mui/material';
import {
  CameraAlt,
  CheckCircle,
  Error,
  Refresh,
  Settings,
} from '@mui/icons-material';
import { CameraInfo, CameraSettings } from '../../types/calibration';
import { calibrationApi } from '../../services/calibrationApi';

interface CameraSetupProps {
  selectedCamera: number;
  onCameraChange: (index: number) => void;
  cameraSettings: CameraSettings;
  onSettingsChange: (settings: CameraSettings) => void;
  onNext: () => void;
}

const CameraSetup: React.FC<CameraSetupProps> = ({
  selectedCamera,
  onCameraChange,
  cameraSettings,
  onSettingsChange,
  onNext,
}) => {
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  // Carregar câmeras disponíveis
  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      setLoading(true);
      setError('');
      const cameraList = await calibrationApi.listCameras();
      setCameras(cameraList);
      
      // Selecionar primeira câmera disponível se nenhuma estiver selecionada
      if (cameraList.length > 0 && selectedCamera === -1) {
        onCameraChange(cameraList[0].index);
      }
    } catch (err: any) {
      setError(`Erro ao carregar câmeras: ${err.message}`);
      console.error('Erro ao carregar câmeras:', err);
    } finally {
      setLoading(false);
    }
  };

  const testCamera = async () => {
    try {
      setTesting(true);
      setError('');
      const result = await calibrationApi.testCamera(selectedCamera);
      setTestResult(result);
    } catch (err: any) {
      setError(`Erro ao testar câmera: ${err.message}`);
      setTestResult(null);
    } finally {
      setTesting(false);
    }
  };

  const capturePreview = async () => {
    try {
      setError('');
      const frame = await calibrationApi.captureFrame(selectedCamera);
      setPreview(`data:image/jpeg;base64,${frame.image_base64}`);
    } catch (err: any) {
      setError(`Erro ao capturar preview: ${err.message}`);
    }
  };

  const handleSettingChange = (setting: keyof CameraSettings, value: any) => {
    onSettingsChange({
      ...cameraSettings,
      [setting]: value,
    });
  };

  const handleResolutionChange = (dimension: 'width' | 'height', value: number) => {
    onSettingsChange({
      ...cameraSettings,
      resolution: {
        ...cameraSettings.resolution,
        [dimension]: value,
      },
    });
  };

  const canProceed = cameras.length > 0 && selectedCamera >= 0 && testResult?.status === 'success';

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CameraAlt />
        Configuração da Câmera
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure sua câmera para captura de imagens das biópsias. A câmera deve estar posicionada sobre o papel quadriculado.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Seleção da câmera */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Seleção da Câmera
              </Typography>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Câmera</InputLabel>
                  <Select
                    value={selectedCamera}
                    label="Câmera"
                    onChange={(e) => onCameraChange(Number(e.target.value))}
                  >
                    {cameras.map((camera) => (
                      <MenuItem key={camera.index} value={camera.index}>
                        {camera.name} ({camera.resolution.width}x{camera.resolution.height})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadCameras}
                  disabled={loading}
                  size="small"
                >
                  Atualizar Lista
                </Button>
                <Button
                  variant="contained"
                  onClick={testCamera}
                  disabled={testing || selectedCamera < 0}
                  size="small"
                >
                  {testing ? <CircularProgress size={16} /> : 'Testar Câmera'}
                </Button>
              </Box>

              {testResult && (
                <Alert
                  severity={testResult.status === 'success' ? 'success' : 'error'}
                  icon={testResult.status === 'success' ? <CheckCircle /> : <Error />}
                >
                  {testResult.message}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Configurações da câmera */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Settings />
                Configurações
              </Typography>

              {/* Resolução */}
              <Typography variant="subtitle2" gutterBottom>
                Resolução
              </Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="body2">Largura: {cameraSettings.resolution.width}px</Typography>
                  <Slider
                    value={cameraSettings.resolution.width}
                    min={640}
                    max={1920}
                    step={160}
                    onChange={(_, value) => handleResolutionChange('width', value as number)}
                    marks={[
                      { value: 640, label: '640' },
                      { value: 1280, label: '1280' },
                      { value: 1920, label: '1920' },
                    ]}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">Altura: {cameraSettings.resolution.height}px</Typography>
                  <Slider
                    value={cameraSettings.resolution.height}
                    min={480}
                    max={1080}
                    step={120}
                    onChange={(_, value) => handleResolutionChange('height', value as number)}
                    marks={[
                      { value: 480, label: '480' },
                      { value: 720, label: '720' },
                      { value: 1080, label: '1080' },
                    ]}
                  />
                </Grid>
              </Grid>

              {/* FPS */}
              <Typography variant="body2" gutterBottom>
                FPS: {cameraSettings.fps}
              </Typography>
              <Slider
                value={cameraSettings.fps}
                min={15}
                max={60}
                step={15}
                onChange={(_, value) => handleSettingChange('fps', value as number)}
                marks={[
                  { value: 15, label: '15' },
                  { value: 30, label: '30' },
                  { value: 60, label: '60' },
                ]}
                sx={{ mb: 2 }}
              />

              {/* Brilho */}
              <Typography variant="body2" gutterBottom>
                Brilho: {cameraSettings.brightness}%
              </Typography>
              <Slider
                value={cameraSettings.brightness}
                min={0}
                max={100}
                onChange={(_, value) => handleSettingChange('brightness', value as number)}
                sx={{ mb: 2 }}
              />

              {/* Contraste */}
              <Typography variant="body2" gutterBottom>
                Contraste: {cameraSettings.contrast}%
              </Typography>
              <Slider
                value={cameraSettings.contrast}
                min={0}
                max={100}
                onChange={(_, value) => handleSettingChange('contrast', value as number)}
                sx={{ mb: 2 }}
              />

              {/* Saturação */}
              <Typography variant="body2" gutterBottom>
                Saturação: {cameraSettings.saturation}%
              </Typography>
              <Slider
                value={cameraSettings.saturation}
                min={0}
                max={100}
                onChange={(_, value) => handleSettingChange('saturation', value as number)}
                sx={{ mb: 2 }}
              />

              {/* Switches */}
              <FormControlLabel
                control={
                  <Switch
                    checked={cameraSettings.auto_focus}
                    onChange={(e) => handleSettingChange('auto_focus', e.target.checked)}
                  />
                }
                label="Foco automático"
                sx={{ mb: 1, display: 'block' }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={cameraSettings.auto_white_balance}
                    onChange={(e) => handleSettingChange('auto_white_balance', e.target.checked)}
                  />
                }
                label="Balanço de branco automático"
                sx={{ mb: 2, display: 'block' }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Camera settings preview - Static only */}
        <Grid item xs={12}>
          {preview && !error && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Preview de Teste da Câmera
                </Typography>
                <Paper
                  elevation={2}
                  sx={{
                    p: 1,
                    textAlign: 'center',
                    bgcolor: 'grey.100',
                  }}
                >
                  <img
                    src={preview}
                    alt="Preview da câmera"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '200px',
                      objectFit: 'contain',
                    }}
                  />
                </Paper>
              </CardContent>
            </Card>
          )}
          
          {!preview && !error && (
            <Paper
              elevation={1}
              sx={{
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.100',
                color: 'text.secondary',
              }}
            >
              <Typography>
                Configure as configurações da câmera e teste para ver o preview
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Botão de próximo passo */}
      <Box sx={{ mt: 3, textAlign: 'right' }}>
        <Button
          variant="contained"
          size="large"
          onClick={onNext}
          disabled={!canProceed}
        >
          Próximo: Configurar Áudio
        </Button>
      </Box>
    </Box>
  );
};

export default CameraSetup;