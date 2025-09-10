/**
 * Dashboard principal do sistema
 */
import React, { useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Paper,
  Avatar,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  History,
  Settings,
  People,
  Camera,
  Mic,
  GridOn,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useCalibrationStatus } from '../hooks/useCalibrationStatus';

const Dashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { status, loading: statusLoading, error: statusError, refreshStatus } = useCalibrationStatus();

  // Adicionar listener para recarregar quando voltar para a página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshStatus]);

  const handleNewAnalysis = () => {
    navigate('/analysis');
  };

  const handleHistory = () => {
    navigate('/history');
  };

  const handleCalibration = () => {
    navigate('/calibration');
  };

  const handleAdmin = () => {
    navigate('/admin');
  };

  const getStatusChipColor = (configured: boolean): "success" | "warning" => {
    return configured ? "success" : "warning";
  };

  return (
    <Layout>
      <Box>
        {/* Cabeçalho de boas-vindas */}
        <Paper
          sx={{
            p: 3,
            mb: 3,
            background: 'linear-gradient(135deg, #2C5F8A 0%, #5A7FA8 100%)',
            color: 'white',
            borderRadius: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: 64,
                height: 64,
                bgcolor: 'rgba(255,255,255,0.2)',
                fontSize: '1.5rem',
              }}
            >
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
            
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" fontWeight={600} gutterBottom>
                Bem-vindo, {user?.username}!
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Sistema de Macroscopia Biomédica - Análise inteligente de biópsias
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Chip
                  label={user?.role === 'admin' ? 'Administrador' : 'Usuário'}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Ações principais */}
        <Grid container spacing={3}>
          {/* Nova Análise */}
          <Grid item xs={12} md={6} lg={4}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                },
              }}
              onClick={handleNewAnalysis}
            >
              <CardContent sx={{ textAlign: 'center', p: 4 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: 'primary.main',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <Add sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography variant="h5" fontWeight={600} gutterBottom>
                  Nova Análise
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Iniciar uma nova análise macroscópica com medição automática e IA
                </Typography>
                <Button variant="contained" size="large" fullWidth>
                  Iniciar Análise
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Histórico */}
          <Grid item xs={12} md={6} lg={4}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                },
              }}
              onClick={handleHistory}
            >
              <CardContent sx={{ textAlign: 'center', p: 4 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: 'secondary.main',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <History sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography variant="h5" fontWeight={600} gutterBottom>
                  Histórico
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Visualizar análises anteriores e relatórios gerados
                </Typography>
                <Button variant="outlined" size="large" fullWidth>
                  Ver Histórico
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Calibração */}
          <Grid item xs={12} md={6} lg={4}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                },
              }}
              onClick={handleCalibration}
            >
              <CardContent sx={{ textAlign: 'center', p: 4 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: 'warning.main',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <Settings sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography variant="h5" fontWeight={600} gutterBottom>
                  Calibração
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Configurar webcam, microfone e papel quadriculado
                </Typography>
                <Button variant="outlined" size="large" fullWidth>
                  Calibrar Sistema
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Administração (apenas para admins) */}
          {isAdmin && (
            <Grid item xs={12} md={6} lg={4}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  },
                }}
                onClick={handleAdmin}
              >
                <CardContent sx={{ textAlign: 'center', p: 4 }}>
                  <Avatar
                    sx={{
                      width: 80,
                      height: 80,
                      bgcolor: 'error.main',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <People sx={{ fontSize: 40 }} />
                  </Avatar>
                  <Typography variant="h5" fontWeight={600} gutterBottom>
                    Administração
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Gerenciar usuários e configurações do sistema
                  </Typography>
                  <Button variant="outlined" size="large" fullWidth>
                    Administrar
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* Status do sistema */}
        <Paper sx={{ mt: 4, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Status do Sistema
          </Typography>
          
          {statusLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Camera color="primary" />
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Webcam
                    </Typography>
                    <Chip 
                      label={status?.dashboardStatus.camera.label || 'Configurar'} 
                      color={getStatusChipColor(status?.dashboardStatus.camera.configured || false)} 
                      size="small" 
                    />
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Mic color="primary" />
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Microfone
                    </Typography>
                    <Chip 
                      label={status?.dashboardStatus.audio.label || 'Configurar'} 
                      color={getStatusChipColor(status?.dashboardStatus.audio.configured || false)} 
                      size="small" 
                    />
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GridOn color="primary" />
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Grade de Referência
                    </Typography>
                    <Chip 
                      label={status?.dashboardStatus.grid.label || 'Configurar'} 
                      color={getStatusChipColor(status?.dashboardStatus.grid.configured || false)} 
                      size="small" 
                    />
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}
          
          {/* Status geral do sistema */}
          {!statusLoading && status?.dashboardStatus.overall.ready && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
              <Typography variant="body2" color="success.dark" fontWeight={500}>
                ✅ Sistema totalmente configurado e pronto para uso!
              </Typography>
            </Box>
          )}
          
          {!statusLoading && !status?.dashboardStatus.overall.ready && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'warning.light', borderRadius: 2 }}>
              <Typography variant="body2" color="warning.dark" fontWeight={500}>
                ⚠️ Configure todos os componentes para usar o sistema completo.
              </Typography>
            </Box>
          )}

          {/* Error handling */}
          {statusError && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'error.light', borderRadius: 2 }}>
              <Typography variant="body2" color="error.dark" fontWeight={500}>
                ❌ {statusError}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Informações úteis */}
        <Paper sx={{ mt: 3, p: 3, bgcolor: 'background.default' }}>
          <Typography variant="h6" gutterBottom>
            Como usar o sistema
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  1. Calibração
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure sua webcam, microfone e papel quadriculado antes de iniciar.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  2. Nova Análise
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Posicione a biópsia no papel quadriculado e descreva oralmente.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  3. Relatório
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  A IA preencherá automaticamente o formulário e gerará o relatório.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Layout>
  );
};

export default Dashboard;