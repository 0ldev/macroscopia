import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Pagination,
  Fab,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  History as HistoryIcon,
  Visibility,
  Download,
  Delete,
  Search,
  Refresh,
  FilterList,
  ExpandMore,
  Description,
  Biotech,
  Schedule,
  Person,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import type { Analysis } from '../types';

const HistoricoPage: React.FC = () => {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [detailDialog, setDetailDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para filtros e paginação
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Carregar análises
  const loadAnalyses = async () => {
    try {
      setLoading(true);
      setError(null);
      const analysesData = await apiClient.getAnalyses(0, 100); // Carregar até 100 itens
      setAnalyses(analysesData);
    } catch (err: any) {
      setError('Erro ao carregar histórico de análises: ' + (err.response?.data?.detail || err.message));
      console.error('Erro ao carregar análises:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados na inicialização
  useEffect(() => {
    loadAnalyses();
  }, []);

  // Filtrar análises por termo de busca
  const filteredAnalyses = analyses.filter(analysis =>
    analysis.sample_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (analysis.transcription && analysis.transcription.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (analysis.report && analysis.report.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Paginação
  const totalPages = Math.ceil(filteredAnalyses.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedAnalyses = filteredAnalyses.slice(startIndex, startIndex + itemsPerPage);

  // Manipuladores de eventos
  const handleViewDetails = (analysis: Analysis) => {
    setSelectedAnalysis(analysis);
    setDetailDialog(true);
  };

  const handleCloseDetails = () => {
    setDetailDialog(false);
    setSelectedAnalysis(null);
  };

  const handleDeleteAnalysis = async (analysisId: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta análise? Esta ação não pode ser desfeita.')) {
      try {
        // Nota: Implementar endpoint de delete se necessário
        // await apiClient.deleteAnalysis(analysisId);
        console.log('Delete analysis:', analysisId);
        // Por enquanto, apenas remove da lista local
        setAnalyses(analyses.filter(a => a.id !== analysisId));
      } catch (err: any) {
        setError('Erro ao excluir análise: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatMeasurements = (measurements: Record<string, any> | undefined) => {
    if (!measurements) return 'Não disponível';
    
    const entries = Object.entries(measurements);
    if (entries.length === 0) return 'Não disponível';
    
    return entries.slice(0, 3).map(([key, value]) => 
      `${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`
    ).join(', ');
  };

  const getStatusColor = (analysis: Analysis) => {
    if (analysis.report) return 'success';
    if (analysis.transcription && analysis.measurements) return 'warning';
    return 'default';
  };

  const getStatusLabel = (analysis: Analysis) => {
    if (analysis.report) return 'Completa';
    if (analysis.transcription || analysis.measurements) return 'Parcial';
    return 'Iniciada';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        <HistoryIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
        Histórico de Análises
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Buscar por ID da amostra, transcrição ou relatório..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                startIcon={<Refresh />}
                onClick={loadAnalyses}
                disabled={loading}
              >
                Atualizar
              </Button>
              <Button
                startIcon={<FilterList />}
                variant="outlined"
              >
                Filtros
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Resumo */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {analyses.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total de Análises
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {analyses.filter(a => a.report).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completas
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {analyses.filter(a => !a.report && (a.transcription || a.measurements)).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Parciais
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="text.secondary">
                {analyses.filter(a => !a.report && !a.transcription && !a.measurements).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Iniciadas
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Lista de análises */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID da Amostra</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Criada em</TableCell>
                <TableCell>Atualizada em</TableCell>
                <TableCell>Medições</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : paginatedAnalyses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    {searchTerm ? 'Nenhuma análise encontrada com os critérios de busca.' : 'Nenhuma análise encontrada.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAnalyses.map((analysis) => (
                  <TableRow key={analysis.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Biotech fontSize="small" />
                        <Typography variant="body2" fontWeight="medium">
                          {analysis.sample_id}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(analysis)}
                        color={getStatusColor(analysis)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Schedule fontSize="small" />
                        {formatDate(analysis.created_at)}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Schedule fontSize="small" />
                        {formatDate(analysis.updated_at)}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Typography variant="body2" noWrap title={formatMeasurements(analysis.measurements)}>
                        {formatMeasurements(analysis.measurements)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Ver detalhes">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(analysis)}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      {analysis.report && (
                        <Tooltip title="Download do relatório">
                          <IconButton size="small">
                            <Download />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Excluir análise">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteAnalysis(analysis.id)}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Paginação */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(event, value) => setPage(value)}
              color="primary"
            />
          </Box>
        )}
      </Paper>

      {/* Dialog de detalhes */}
      <Dialog open={detailDialog} onClose={handleCloseDetails} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Description />
            Detalhes da Análise - {selectedAnalysis?.sample_id}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedAnalysis && (
            <Box sx={{ mt: 1 }}>
              {/* Informações básicas */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Informações Gerais</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">ID da Amostra:</Typography>
                      <Typography variant="body1">{selectedAnalysis.sample_id}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Status:</Typography>
                      <Chip
                        label={getStatusLabel(selectedAnalysis)}
                        color={getStatusColor(selectedAnalysis)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Criada em:</Typography>
                      <Typography variant="body1">{formatDate(selectedAnalysis.created_at)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Atualizada em:</Typography>
                      <Typography variant="body1">{formatDate(selectedAnalysis.updated_at)}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Medições */}
              {selectedAnalysis.measurements && (
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">Medições de Visão Computacional</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {Object.entries(selectedAnalysis.measurements).map(([key, value]) => (
                        <Grid item xs={6} md={4} key={key}>
                          <Typography variant="body2" color="text.secondary">{key}:</Typography>
                          <Typography variant="body1">
                            {typeof value === 'number' ? value.toFixed(3) : String(value)}
                          </Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Transcrição */}
              {selectedAnalysis.transcription && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">Transcrição de Áudio</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                      <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                        {selectedAnalysis.transcription}
                      </Typography>
                    </Paper>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Dados do formulário */}
              {selectedAnalysis.form_data && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">Dados Estruturados</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {Object.entries(selectedAnalysis.form_data).map(([key, value]) => (
                        <Grid item xs={12} md={6} key={key}>
                          <Typography variant="body2" color="text.secondary">{key}:</Typography>
                          <Typography variant="body1">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Relatório */}
              {selectedAnalysis.report && (
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">Relatório Final</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                      <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                        {selectedAnalysis.report}
                      </Typography>
                    </Paper>
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {selectedAnalysis?.report && (
            <Button startIcon={<Download />}>
              Download Relatório
            </Button>
          )}
          <Button onClick={handleCloseDetails}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HistoricoPage;
