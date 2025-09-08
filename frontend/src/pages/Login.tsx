/**
 * Página de login
 */
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  Avatar,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { LockOutlined } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { LoginRequest } from '../types';

const Login: React.FC = () => {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<LoginRequest>({
    username: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Se já estiver autenticado, redirecionar
  if (user && !isLoading) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Limpar erro ao digitar
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
  await login({ ...formData, remember: rememberMe });
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Erro no login:', err);
      
      if (err.response?.status === 401) {
        setError('Credenciais inválidas. Verifique seu usuário e senha.');
      } else if (err.response?.status >= 500) {
        setError('Erro no servidor. Tente novamente mais tarde.');
      } else {
        setError('Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = () => {
    setFormData({
      username: 'admin',
      password: 'admin',
    });
  };

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <Typography>Carregando...</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #2C5F8A 0%, #5A7FA8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
      }}
    >
      <Container maxWidth="sm">
        <Card
          elevation={8}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* Cabeçalho */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mb: 3,
              }}
            >
              <Avatar
                sx={{
                  m: 1,
                  bgcolor: 'primary.main',
                  width: 56,
                  height: 56,
                }}
              >
                <LockOutlined />
              </Avatar>
              
              <Typography component="h1" variant="h4" fontWeight={600} gutterBottom>
                Sistema de Macroscopia
              </Typography>
              
              <Typography variant="body1" color="text.secondary" textAlign="center">
                Faça login para acessar a plataforma de análise biomédica
              </Typography>
            </Box>

            {/* Formulário */}
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Nome de usuário"
                name="username"
                autoComplete="username"
                autoFocus
                value={formData.username}
                onChange={handleChange}
                disabled={isSubmitting}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Senha"
                type="password"
                id="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                disabled={isSubmitting}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    value="remember"
                    color="primary"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                }
                label="Lembrar de mim"
                sx={{ mt: 1 }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2, py: 1.5 }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </Button>

              <Button
                fullWidth
                variant="outlined"
                onClick={handleDemoLogin}
                disabled={isSubmitting}
                sx={{ mb: 2 }}
              >
                Usar credenciais padrão (admin/admin)
              </Button>

              {/* Informações de ajuda */}
              <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  <strong>Credenciais padrão:</strong><br />
                  Usuário: admin | Senha: admin
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Login;