/**
 * Configuração do tema Material-UI
 */
import { createTheme } from '@mui/material/styles';

// Cores do sistema
const colors = {
  primary: '#2C5F8A',      // Azul médico
  secondary: '#4CAF50',    // Verde sucesso
  warning: '#FF9800',      // Amarelo atenção
  error: '#F44336',        // Vermelho erro
  background: '#FFFFFF',   // Branco
  surface: '#F5F5F5',      // Cinza claro
  text: {
    primary: '#212121',
    secondary: '#757575',
  }
};

// Tema personalizado para o sistema de macroscopia
export const theme = createTheme({
  palette: {
    primary: {
      main: colors.primary,
      light: '#5A7FA8',
      dark: '#1E4261',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: colors.secondary,
      light: '#6CBF69',
      dark: '#357A35',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: colors.warning,
      light: '#FFB74D',
      dark: '#F57C00',
      contrastText: '#FFFFFF',
    },
    error: {
      main: colors.error,
      light: '#E57373',
      dark: '#D32F2F',
      contrastText: '#FFFFFF',
    },
    background: {
      default: colors.background,
      paper: colors.background,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
    },
    divider: '#E0E0E0',
  },
  
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      lineHeight: 1.2,
      color: colors.text.primary,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
      color: colors.text.primary,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
      lineHeight: 1.4,
      color: colors.text.primary,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
      lineHeight: 1.4,
      color: colors.text.primary,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.5,
      color: colors.text.primary,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
      color: colors.text.primary,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: colors.text.primary,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: colors.text.secondary,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },

  shape: {
    borderRadius: 8,
  },

  spacing: 8,

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          padding: '10px 24px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },
    
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
          border: '1px solid #E0E0E0',
          '&:hover': {
            boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.12)',
          },
        },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: colors.background,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.primary,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.primary,
              borderWidth: '2px',
            },
          },
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: colors.primary,
          boxShadow: '0px 2px 8px rgba(44, 95, 138, 0.2)',
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.surface,
          borderRight: `1px solid ${colors.primary}20`,
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
        filled: {
          fontWeight: 500,
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          padding: '8px',
        },
      },
    },

    MuiTable: {
      styleOverrides: {
        root: {
          '& .MuiTableHead-root': {
            backgroundColor: colors.surface,
          },
          '& .MuiTableRow-root:hover': {
            backgroundColor: '#F8F9FA',
          },
        },
      },
    },
  },
});

export default theme;