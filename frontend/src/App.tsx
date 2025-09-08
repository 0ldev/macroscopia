/**
 * Componente principal da aplicação
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import theme from './utils/theme';

// Páginas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Calibration from './pages/Calibration';
import Analysis from './pages/Analysis';

// Componente de rota protegida
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <CircularProgress />
      </Box>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// Componente de rota pública (apenas para usuários não autenticados)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <CircularProgress />
      </Box>
    );
  }

  return !user ? <>{children}</> : <Navigate to="/" replace />;
};

// Componente de roteamento principal
const AppRoutes: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Rotas públicas */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* Rotas protegidas */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Placeholder para futuras rotas */}
        <Route
          path="/analysis"
          element={
            <ProtectedRoute>
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <h2>Página de Análise</h2>
                <p>Esta página será implementada na próxima fase.</p>
              </Box>
            </ProtectedRoute>
          }
        />

        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <h2>Histórico de Análises</h2>
                <p>Esta página será implementada na próxima fase.</p>
              </Box>
            </ProtectedRoute>
          }
        />

        <Route
          path="/calibration"
          element={
            <ProtectedRoute>
              <Calibration />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <h2>Administração</h2>
                <p>Esta página será implementada na próxima fase.</p>
              </Box>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <h2>Perfil do Usuário</h2>
                <p>Esta página será implementada na próxima fase.</p>
              </Box>
            </ProtectedRoute>
          }
        />

        {/* Rota 404 */}
        <Route
          path="*"
          element={
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                textAlign: 'center',
                p: 3,
              }}
            >
              <h1>404 - Página não encontrada</h1>
              <p>A página que você está procurando não existe.</p>
              <button onClick={() => window.history.back()}>Voltar</button>
            </Box>
          }
        />
      </Routes>
    </Router>
  );
};

// Componente principal da aplicação
const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;