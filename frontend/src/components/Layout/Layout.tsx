/**
 * Layout principal da aplicação
 */
import React from 'react';
import { Box, Container } from '@mui/material';
import AppBar from './AppBar';

interface LayoutProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disableContainer?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  maxWidth = 'xl',
  disableContainer = false 
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Barra de navegação */}
      <AppBar />
      
      {/* Conteúdo principal */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          py: 3,
          backgroundColor: 'background.default',
        }}
      >
        {disableContainer ? (
          <Box sx={{ height: '100%' }}>
            {children}
          </Box>
        ) : (
          <Container maxWidth={maxWidth} sx={{ height: '100%' }}>
            {children}
          </Container>
        )}
      </Box>

      {/* Rodapé (opcional) */}
      <Box
        component="footer"
        sx={{
          py: 2,
          px: 3,
          backgroundColor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        <Box sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
          © 2024 Sistema de Macroscopia - Versão 1.0.0
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;