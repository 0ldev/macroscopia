import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Fab,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Person,
  AdminPanelSettings,
  History,
  Refresh,
  AccountCircle,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import type { User, UserCreate, UserUpdate, Log } from '../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AdminPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  
  // Estados para usuários
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDialog, setUserDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Estados para logs
  const [logs, setLogs] = useState<Log[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Estados para formulário
  const [formData, setFormData] = useState<UserCreate>({
    username: '',
    password: '',
    role: 'user',
  });
  
  // Estados para feedback
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [error, setError] = useState<string | null>(null);

  // Verificar se o usuário é admin
  useEffect(() => {
    if (!isAdmin) {
      setError('Acesso negado. Você precisa ser administrador para acessar esta página.');
      return;
    }
  }, [isAdmin]);

  // Carregar usuários
  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const userData = await apiClient.getUsers();
      setUsers(userData);
    } catch (err: any) {
      setError('Erro ao carregar usuários: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUsersLoading(false);
    }
  };

  // Carregar logs
  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const logsData = await apiClient.getLogs();
      setLogs(logsData);
    } catch (err: any) {
      setError('Erro ao carregar logs: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLogsLoading(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadLogs();
    }
  }, [isAdmin]);

  // Manipuladores de eventos
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOpenUserDialog = (user?: User) => {
    if (user) {
      setSelectedUser(user);
      setFormData({
        username: user.username,
        password: '',
        role: user.role,
      });
      setIsEditMode(true);
    } else {
      setSelectedUser(null);
      setFormData({
        username: '',
        password: '',
        role: 'user',
      });
      setIsEditMode(false);
    }
    setUserDialog(true);
  };

  const handleCloseUserDialog = () => {
    setUserDialog(false);
    setSelectedUser(null);
    setFormData({
      username: '',
      password: '',
      role: 'user',
    });
  };

  const handleSaveUser = async () => {
    try {
      if (isEditMode && selectedUser) {
        const updateData: UserUpdate = {
          username: formData.username,
          role: formData.role,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await apiClient.updateUser(selectedUser.id, updateData);
        setSnackbar({ open: true, message: 'Usuário atualizado com sucesso!', severity: 'success' });
      } else {
        await apiClient.createUser(formData);
        setSnackbar({ open: true, message: 'Usuário criado com sucesso!', severity: 'success' });
      }
      handleCloseUserDialog();
      loadUsers();
    } catch (err: any) {
      setSnackbar({ 
        open: true, 
        message: 'Erro ao salvar usuário: ' + (err.response?.data?.detail || err.message), 
        severity: 'error' 
      });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('Tem certeza que deseja desativar este usuário?')) {
      try {
        await apiClient.deleteUser(userId);
        setSnackbar({ open: true, message: 'Usuário desativado com sucesso!', severity: 'success' });
        loadUsers();
      } catch (err: any) {
        setSnackbar({ 
          open: true, 
          message: 'Erro ao desativar usuário: ' + (err.response?.data?.detail || err.message), 
          severity: 'error' 
        });
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Acesso negado. Você precisa ser administrador para acessar esta página.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        <AdminPanelSettings sx={{ mr: 2, verticalAlign: 'middle' }} />
        Administração do Sistema
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="abas de administração"
          variant="fullWidth"
        >
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person />
                Usuários ({users.length})
              </Box>
            } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <History />
                Logs do Sistema ({logs.length})
              </Box>
            } 
          />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Gerenciamento de Usuários</Typography>
            <Box>
              <Button
                startIcon={<Refresh />}
                onClick={loadUsers}
                disabled={usersLoading}
                sx={{ mr: 1 }}
              >
                Atualizar
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenUserDialog()}
              >
                Novo Usuário
              </Button>
            </Box>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Usuário</TableCell>
                  <TableCell>Função</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Criado em</TableCell>
                  <TableCell>Último Login</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((userItem) => (
                    <TableRow key={userItem.id}>
                      <TableCell>{userItem.id}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AccountCircle />
                          {userItem.username}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={userItem.role === 'admin' ? 'Administrador' : 'Usuário'}
                          color={userItem.role === 'admin' ? 'secondary' : 'primary'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={userItem.active ? 'Ativo' : 'Inativo'}
                          color={userItem.active ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatDate(userItem.created_at)}</TableCell>
                      <TableCell>
                        {userItem.last_login ? formatDate(userItem.last_login) : 'Nunca'}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenUserDialog(userItem)}
                          title="Editar usuário"
                        >
                          <Edit />
                        </IconButton>
                        {userItem.id !== user?.id && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteUser(userItem.id)}
                            title="Desativar usuário"
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Logs de Auditoria do Sistema</Typography>
            <Button
              startIcon={<Refresh />}
              onClick={loadLogs}
              disabled={logsLoading}
            >
              Atualizar
            </Button>
          </Box>

          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Data/Hora</TableCell>
                  <TableCell>Usuário</TableCell>
                  <TableCell>Ação</TableCell>
                  <TableCell>Detalhes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDate(log.timestamp)}</TableCell>
                      <TableCell>
                        {log.user_id ? `ID: ${log.user_id}` : 'Sistema'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.action}
                          size="small"
                          color={
                            log.action.includes('error') ? 'error' :
                            log.action.includes('login') ? 'success' :
                            'default'
                          }
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 400, wordBreak: 'break-word' }}>
                        {log.details || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* Dialog para criar/editar usuário */}
      <Dialog open={userDialog} onClose={handleCloseUserDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {isEditMode ? 'Editar Usuário' : 'Novo Usuário'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Nome de usuário"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label={isEditMode ? "Nova senha (deixe em branco para manter)" : "Senha"}
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              fullWidth
              required={!isEditMode}
            />
            <FormControl fullWidth required>
              <InputLabel>Função</InputLabel>
              <Select
                value={formData.role}
                label="Função"
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
              >
                <MenuItem value="user">Usuário</MenuItem>
                <MenuItem value="admin">Administrador</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUserDialog}>Cancelar</Button>
          <Button
            onClick={handleSaveUser}
            variant="contained"
            disabled={!formData.username || (!isEditMode && !formData.password)}
          >
            {isEditMode ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminPage;
