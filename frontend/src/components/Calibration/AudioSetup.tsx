/**
 * Componente de configuração do áudio
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
  LinearProgress,
  Paper,
  Chip,
} from '@mui/material';
import {
  Mic,
  CheckCircle,
  Error,
  Refresh,
  Settings,
  VolumeUp,
  GraphicEq,
} from '@mui/icons-material';
import { AudioDevice, AudioSettings, AudioTestResult, AudioLevelsResult } from '../../types/calibration';
import { calibrationApi } from '../../services/calibrationApi';

interface AudioSetupProps {
  selectedDevice: number;
  onDeviceChange: (index: number) => void;
  audioSettings: AudioSettings;
  onSettingsChange: (settings: AudioSettings) => void;
  onNext: () => void;
  onBack: () => void;
}

const AudioSetup: React.FC<AudioSetupProps> = ({
  selectedDevice,
  onDeviceChange,
  audioSettings,
  onSettingsChange,
  onNext,
  onBack,
}) => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AudioTestResult | null>(null);
  const [levelTesting, setLevelTesting] = useState(false);
  const [levelResult, setLevelResult] = useState<AudioLevelsResult | null>(null);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [error, setError] = useState<string>('');

  // Carregar dispositivos de áudio disponíveis
  useEffect(() => {
    loadAudioDevices();
  }, []);

  const loadAudioDevices = async () => {
    try {
      setLoading(true);
      setError('');
      const deviceList = await calibrationApi.listAudioDevices();
      setDevices(deviceList);
      
      // Selecionar dispositivo padrão se nenhum estiver selecionado
      if (deviceList.length > 0 && selectedDevice === -1) {
        const defaultDevice = deviceList.find(d => d.is_default_input) || deviceList[0];
        onDeviceChange(defaultDevice.index);
      }
    } catch (err: any) {
      setError(`Erro ao carregar dispositivos de áudio: ${err.message}`);
      console.error('Erro ao carregar dispositivos:', err);
    } finally {
      setLoading(false);
    }
  };

  const testMicrophone = async () => {
    try {
      setTesting(true);
      setError('');
      const result = await calibrationApi.testMicrophone(selectedDevice, 2.0);
      setTestResult(result);
    } catch (err: any) {
      setError(`Erro ao testar microfone: ${err.message}`);
      setTestResult(null);
    } finally {
      setTesting(false);
    }
  };

  const testAudioLevels = async () => {
    try {
      setLevelTesting(true);
      setError('');
      
      // Simular teste em tempo real
      const result = await calibrationApi.testAudioLevels(selectedDevice, 5.0);
      setLevelResult(result);
      
      // Animar os níveis para feedback visual
      if (result.success && result.levels) {
        const levels = result.levels;
        let index = 0;
        const interval = setInterval(() => {
          if (index < levels.length) {
            setCurrentLevel(levels[index]);
            index++;
          } else {
            clearInterval(interval);
            setCurrentLevel(0);
          }
        }, 50);
      }
      
    } catch (err: any) {
      setError(`Erro ao testar níveis de áudio: ${err.message}`);
      setLevelResult(null);
    } finally {
      setLevelTesting(false);
    }
  };

  const handleSettingChange = (setting: keyof AudioSettings, value: any) => {
    onSettingsChange({
      ...audioSettings,
      [setting]: value,
    });
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'muito_alta': return 'success';
      case 'boa': return 'info';
      case 'média': return 'warning';
      case 'baixa': return 'error';
      default: return 'default';
    }
  };

  const canProceed = devices.length > 0 && selectedDevice >= 0 && testResult?.available;

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Mic />
        Configuração do Áudio
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure seu microfone para captura das descrições orais durante o exame macroscópico.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Seleção do dispositivo */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Seleção do Microfone
              </Typography>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Dispositivo de Áudio</InputLabel>
                  <Select
                    value={selectedDevice}
                    label="Dispositivo de Áudio"
                    onChange={(e) => onDeviceChange(Number(e.target.value))}
                  >
                    {devices.map((device) => (
                      <MenuItem key={device.index} value={device.index}>
                        <Box>
                          <Typography variant="body2">
                            {device.name}
                            {device.is_default_input && (
                              <Chip label="Padrão" size="small" sx={{ ml: 1 }} />
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {device.max_input_channels} canais - {device.default_sample_rate}Hz
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadAudioDevices}
                  disabled={loading}
                  size="small"
                >
                  Atualizar Lista
                </Button>
                <Button
                  variant="contained"
                  onClick={testMicrophone}
                  disabled={testing || selectedDevice < 0}
                  size="small"
                >
                  {testing ? <CircularProgress size={16} /> : 'Testar Microfone'}
                </Button>
              </Box>

              {testResult && (
                <Alert
                  severity={testResult.available ? 'success' : 'error'}
                  icon={testResult.available ? <CheckCircle /> : <Error />}
                >
                  {testResult.available ? (
                    <Box>
                      <Typography variant="body2">
                        Microfone funcionando corretamente
                      </Typography>
                      <Typography variant="caption">
                        RMS: {testResult.audio_stats.rms.toFixed(1)} | 
                        Peak: {testResult.audio_stats.peak} | 
                        Amostras: {testResult.audio_stats.samples_recorded}
                      </Typography>
                    </Box>
                  ) : (
                    testResult.error || 'Microfone não disponível'
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Configurações de áudio */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Settings />
                Configurações
              </Typography>

              {/* Sample Rate */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Taxa de Amostragem</InputLabel>
                <Select
                  value={audioSettings.sample_rate}
                  label="Taxa de Amostragem"
                  onChange={(e) => handleSettingChange('sample_rate', e.target.value)}
                >
                  <MenuItem value={16000}>16 kHz</MenuItem>
                  <MenuItem value={22050}>22 kHz</MenuItem>
                  <MenuItem value={44100}>44.1 kHz (Recomendado)</MenuItem>
                  <MenuItem value={48000}>48 kHz</MenuItem>
                </Select>
              </FormControl>

              {/* Canais */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Canais</InputLabel>
                <Select
                  value={audioSettings.channels}
                  label="Canais"
                  onChange={(e) => handleSettingChange('channels', e.target.value)}
                >
                  <MenuItem value={1}>Mono (Recomendado)</MenuItem>
                  <MenuItem value={2}>Estéreo</MenuItem>
                </Select>
              </FormControl>

              {/* Bit Depth */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Profundidade de Bits</InputLabel>
                <Select
                  value={audioSettings.bit_depth}
                  label="Profundidade de Bits"
                  onChange={(e) => handleSettingChange('bit_depth', e.target.value)}
                >
                  <MenuItem value={8}>8 bits</MenuItem>
                  <MenuItem value={16}>16 bits (Recomendado)</MenuItem>
                  <MenuItem value={24}>24 bits</MenuItem>
                  <MenuItem value={32}>32 bits</MenuItem>
                </Select>
              </FormControl>

              {/* Volume */}
              <Typography variant="body2" gutterBottom>
                Volume: {audioSettings.volume}%
              </Typography>
              <Slider
                value={audioSettings.volume}
                min={0}
                max={100}
                onChange={(_, value) => handleSettingChange('volume', value as number)}
                sx={{ mb: 2 }}
              />

              {/* Buffer Size */}
              <Typography variant="body2" gutterBottom>
                Buffer Size: {audioSettings.buffer_size}
              </Typography>
              <Slider
                value={audioSettings.buffer_size}
                min={256}
                max={4096}
                step={256}
                onChange={(_, value) => handleSettingChange('buffer_size', value as number)}
                marks={[
                  { value: 256, label: '256' },
                  { value: 1024, label: '1024' },
                  { value: 2048, label: '2048' },
                  { value: 4096, label: '4096' },
                ]}
                sx={{ mb: 2 }}
              />

              {/* Switches */}
              <FormControlLabel
                control={
                  <Switch
                    checked={audioSettings.noise_suppression}
                    onChange={(e) => handleSettingChange('noise_suppression', e.target.checked)}
                  />
                }
                label="Supressão de ruído"
                sx={{ mb: 1, display: 'block' }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={audioSettings.auto_gain}
                    onChange={(e) => handleSettingChange('auto_gain', e.target.checked)}
                  />
                }
                label="Ganho automático"
                sx={{ mb: 2, display: 'block' }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Teste de níveis de áudio */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GraphicEq />
                  Teste de Níveis de Áudio
                </Typography>
                <Button
                  variant="outlined"
                  onClick={testAudioLevels}
                  disabled={levelTesting || selectedDevice < 0}
                  size="small"
                  startIcon={levelTesting ? <CircularProgress size={16} /> : <VolumeUp />}
                >
                  {levelTesting ? 'Testando...' : 'Testar Níveis'}
                </Button>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Teste os níveis de áudio falando normalmente no microfone por alguns segundos.
              </Typography>

              {/* Medidor de nível em tempo real */}
              {levelTesting && (
                <Paper elevation={1} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" gutterBottom>
                    Nível atual: {currentLevel.toFixed(1)}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min((currentLevel / 1000) * 100, 100)}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Paper>
              )}

              {/* Resultado do teste */}
              {levelResult && (
                <Alert
                  severity={levelResult.success ? 'success' : 'error'}
                  sx={{ mb: 2 }}
                >
                  {levelResult.success ? (
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Teste concluído com sucesso
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip
                          label={`Qualidade: ${levelResult.statistics.quality}`}
                          color={getQualityColor(levelResult.statistics.quality) as any}
                          size="small"
                        />
                        <Typography variant="caption">
                          Nível médio: {levelResult.statistics.average.toFixed(1)} |
                          Máximo: {levelResult.statistics.maximum.toFixed(1)}
                        </Typography>
                      </Box>
                    </Box>
                  ) : (
                    levelResult.error || 'Erro no teste de níveis'
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Navegação */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          size="large"
          onClick={onBack}
        >
          Voltar: Configurar Câmera
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={onNext}
          disabled={!canProceed}
        >
          Próximo: Detectar Grade
        </Button>
      </Box>
    </Box>
  );
};

export default AudioSetup;