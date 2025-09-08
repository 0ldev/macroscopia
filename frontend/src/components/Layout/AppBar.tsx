/**
 * Barra de navegação superior
 */
import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
} from '@mui/material';
import {
  AccountCircle,
  ExitToApp,
  Settings,
  Dashboard,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const CustomAppBar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleClose();
    navigate('/login');
  };

  const handleProfile = () => {
    navigate('/profile');
    handleClose();
  };

  const handleAdmin = () => {
    navigate('/admin');
    handleClose();
  };

  const handleCalibration = () => {
    navigate('/calibration');
    handleClose();
  };

  return (
    <AppBar position="static" elevation={2}>
      <Toolbar>
        {/* Logo e título */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <Typography
            variant="h6"
            component="div"
            sx={{ 
              fontWeight: 600,
              color: 'white',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/')}
          >
            🔬 Sistema de Macroscopia
          </Typography>
        </Box>

        {/* Navegação */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            color="inherit"
            onClick={() => navigate('/')}
            startIcon={<Dashboard />}
          >
            Dashboard
          </Button>

          <Button
            color="inherit"
            onClick={() => navigate('/analysis')}
          >
            Nova Análise
          </Button>

          <Button
            color="inherit"
            onClick={() => navigate('/history')}
          >
            Histórico
          </Button>

          {/* Menu do usuário */}
          <IconButton
            size="large"
            aria-label="conta do usuário atual"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.2)' }}>
              <AccountCircle />
            </Avatar>
          </IconButton>

          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            {/* Informações do usuário */}
            <MenuItem disabled>
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {user?.username}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
                </Typography>
              </Box>
            </MenuItem>

            {/* Separador */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', my: 1 }} />

            {/* Opções do menu */}
            <MenuItem onClick={handleProfile}>
              <AccountCircle sx={{ mr: 2 }} />
              Perfil
            </MenuItem>

            <MenuItem onClick={handleCalibration}>
              <Settings sx={{ mr: 2 }} />
              Calibração
            </MenuItem>

            {/* Menu admin apenas para administradores */}
            {isAdmin && (
              <MenuItem onClick={handleAdmin}>
                <Dashboard sx={{ mr: 2 }} />
                Administração
              </MenuItem>
            )}

            <MenuItem onClick={handleLogout}>
              <ExitToApp sx={{ mr: 2 }} />
              Sair
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default CustomAppBar;