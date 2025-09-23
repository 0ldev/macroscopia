/**
 * Componente para configuração manual do tamanho da grade
 */
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import {
  GridOn,
  Rule,
  CheckCircle,
  Info,
} from '@mui/icons-material';

interface ManualGridSizeConfigProps {
  gridSizeMm: number;
  onGridSizeChange: (size: number) => void;
  onSave?: () => void;
  disabled?: boolean;
}

const PRESET_SIZES = [
  { value: 5.0, label: '5mm x 5mm', description: 'Grade fina' },
  { value: 10.0, label: '1cm x 1cm', description: 'Grade padrão' },
  { value: 20.0, label: '2cm x 2cm', description: 'Grade grande' },
];

const ManualGridSizeConfig: React.FC<ManualGridSizeConfigProps> = ({
  gridSizeMm,
  onGridSizeChange,
  onSave,
  disabled = false
}) => {
  const [customSize, setCustomSize] = useState(gridSizeMm);
  const [showCustom, setShowCustom] = useState(false);

  const handlePresetChange = (value: number) => {
    setCustomSize(value);
    onGridSizeChange(value);
    setShowCustom(false);
  };

  const handleCustomChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value) || 0;
    setCustomSize(value);
  };

  const handleCustomSave = () => {
    if (customSize > 0 && customSize <= 50) {
      onGridSizeChange(customSize);
      setShowCustom(false);
    }
  };

  const getCurrentPreset = () => {
    return PRESET_SIZES.find(preset => preset.value === gridSizeMm);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <GridOn color="primary" />
        <Typography variant="h6">
          Calibração Manual da Grade
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Configure o tamanho real dos quadrados do papel quadriculado que você está usando como fundo.
          Esta informação é essencial para cálculos precisos de área e perímetro das biópsias.
        </Typography>
      </Alert>

      {/* Status Atual */}
      <Card sx={{ mb: 3, bgcolor: 'success.50' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CheckCircle color="success" />
            <Typography variant="subtitle1" color="success.main">
              Configuração Atual
            </Typography>
          </Box>
          <Typography variant="h4" color="success.main">
            {gridSizeMm}mm x {gridSizeMm}mm
          </Typography>
          <Typography variant="body2" color="success.dark">
            {getCurrentPreset()?.description || 'Tamanho personalizado'}
          </Typography>
        </CardContent>
      </Card>

      {/* Opções Predefinidas */}
      <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Rule />
        Tamanhos Predefinidos
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {PRESET_SIZES.map((preset) => (
          <Grid item xs={12} sm={4} key={preset.value}>
            <Card 
              sx={{ 
                cursor: disabled ? 'default' : 'pointer',
                border: gridSizeMm === preset.value ? 2 : 1,
                borderColor: gridSizeMm === preset.value ? 'primary.main' : 'grey.300',
                bgcolor: gridSizeMm === preset.value ? 'primary.50' : 'transparent',
                '&:hover': disabled ? {} : {
                  boxShadow: 2,
                  borderColor: 'primary.main'
                }
              }}
              onClick={() => !disabled && handlePresetChange(preset.value)}
            >
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h6" color="primary">
                  {preset.label}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {preset.description}
                </Typography>
                {gridSizeMm === preset.value && (
                  <Chip 
                    icon={<CheckCircle />}
                    label="Selecionado"
                    color="primary"
                    size="small"
                    sx={{ mt: 1 }}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tamanho Personalizado */}
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        Tamanho Personalizado
      </Typography>

      {!showCustom ? (
        <Button
          variant="outlined"
          onClick={() => setShowCustom(true)}
          disabled={disabled}
          sx={{ mb: 2 }}
        >
          Definir Tamanho Personalizado
        </Button>
      ) : (
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Tamanho do Quadrado"
                type="number"
                value={customSize}
                onChange={handleCustomChange}
                disabled={disabled}
                InputProps={{
                  endAdornment: <InputAdornment position="end">mm</InputAdornment>,
                }}
                inputProps={{
                  min: 1,
                  max: 50,
                  step: 0.1
                }}
                helperText="Entre 1mm e 50mm"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleCustomSave}
                  disabled={disabled || customSize <= 0 || customSize > 50}
                >
                  Aplicar
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowCustom(false);
                    setCustomSize(gridSizeMm);
                  }}
                  disabled={disabled}
                >
                  Cancelar
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Informações Adicionais */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Dica:</strong> Use uma régua para medir alguns quadrados do seu papel quadriculado 
          e confirmar o tamanho real. Papéis diferentes podem ter tamanhos ligeiramente diferentes 
          do que está impresso.
        </Typography>
      </Alert>

      {/* Botão Salvar */}
      {onSave && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={onSave}
            disabled={disabled}
            startIcon={<CheckCircle />}
          >
            Salvar Configuração da Grade
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default ManualGridSizeConfig;
