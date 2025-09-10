import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import Layout from '../components/Layout/Layout';
import SequentialWorkflow from '../components/Analysis/SequentialWorkflow';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
      {value === index && children}
    </div>
  );
}

interface AnalysisResults {
  visionMeasurements?: any;
  audioTranscription?: string;
  structuredData?: any;
  finalReport?: string;
  step: number;
}

export default function Analysis() {
  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);

  const handleWorkflowComplete = (workflowResults: AnalysisResults) => {
    setResults(workflowResults);
    console.log('Análise completa:', workflowResults);
  };

  const handleWorkflowError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 2 }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }} 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={tabValue} 
              onChange={(_, newValue) => setTabValue(newValue)}
              variant="fullWidth"
            >
              <Tab label="🔬 Análise Sequencial" />
              <Tab label="📊 Resultados" disabled={!results} />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <SequentialWorkflow
              onComplete={handleWorkflowComplete}
              onError={handleWorkflowError}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 3 }}>
              {results ? (
                <Box>
                  <Typography variant="h5" gutterBottom>
                    📋 Resultados da Análise
                  </Typography>
                  
                  <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                    Análise concluída na etapa {results.step} de 5
                  </Typography>

                  {results.visionMeasurements && (
                    <Paper sx={{ p: 2, mb: 2, backgroundColor: 'success.light' }}>
                      <Typography variant="h6" gutterBottom>
                        📏 Medições Automáticas
                      </Typography>
                      <pre style={{ fontSize: '0.9rem', overflow: 'auto' }}>
                        {JSON.stringify(results.visionMeasurements, null, 2)}
                      </pre>
                    </Paper>
                  )}

                  {results.audioTranscription && (
                    <Paper sx={{ p: 2, mb: 2, backgroundColor: 'info.light' }}>
                      <Typography variant="h6" gutterBottom>
                        🎤 Transcrição de Áudio
                      </Typography>
                      <Typography variant="body2">
                        {results.audioTranscription}
                      </Typography>
                    </Paper>
                  )}

                  {results.structuredData && (
                    <Paper sx={{ p: 2, mb: 2, backgroundColor: 'warning.light' }}>
                      <Typography variant="h6" gutterBottom>
                        📋 Dados Estruturados
                      </Typography>
                      <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>
                        {JSON.stringify(results.structuredData, null, 2)}
                      </pre>
                    </Paper>
                  )}

                  {results.finalReport && (
                    <Paper sx={{ p: 2, mb: 2, backgroundColor: 'secondary.light' }}>
                      <Typography variant="h6" gutterBottom>
                        📄 Relatório Final
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {results.finalReport}
                      </Typography>
                    </Paper>
                  )}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="h6" color="textSecondary">
                    Complete a análise sequencial para ver os resultados aqui
                  </Typography>
                </Box>
              )}
            </Box>
          </TabPanel>
        </Paper>
      </Container>
    </Layout>
  );
}