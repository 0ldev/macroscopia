/**
 * Tipos para funcionalidades de IA (OpenAI Integration)
 */

// Tipos para transcrição de áudio
export interface TranscriptionResult {
  success: boolean;
  text: string;
  language: string | null;
  duration: number;
  segments: TranscriptionSegment[];
  confidence: number | null;
  processing_time_ms: number;
  error?: string;
}

export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

// Tipos para dados estruturados de biópsia
export interface PatientData {
  nome: string | null;
  idade: number | null;
  genero: string | null;
  registro: string | null;
}

export interface BiopsyData {
  local_coleta: string | null;
  data_coleta: string | null;
  tipo_tecido: string | null;
  coloracao: string | null;
  orientacao: string | null;
}

export interface MacroscopicAnalysis {
  aspecto_geral: string | null;
  cor: string | null;
  consistencia: string | null;
  superfície: string | null;
  lesões_visíveis: string[] | null;
}

export interface MeasurementData {
  dimensões_descritas: string | null;
  peso: string | null;
  volume: string | null;
}

export interface Observations {
  achados_relevantes: string[] | null;
  hipótese_diagnóstica: string | null;
  comentários_adicionais: string | null;
}

export interface ExtractionQuality {
  confiança: number;
  campos_identificados: number;
  campos_totais: number;
}

export interface StructuredBiopsyData {
  paciente: PatientData;
  biópsia: BiopsyData;
  análise_macroscópica: MacroscopicAnalysis;
  medições: MeasurementData;
  observações: Observations;
  qualidade_extração: ExtractionQuality;
}

// Tipos para extração de dados
export interface DataExtractionResult {
  success: boolean;
  structured_data: StructuredBiopsyData;
  raw_response: string;
  model_used: string;
  tokens_used: number;
  processing_time_ms: number;
  error?: string;
}

// Tipos para geração de relatórios
export interface ReportSections {
  patient_info: boolean;
  sample_data: boolean;
  macroscopic: boolean;
  measurements: boolean;
  findings: boolean;
  diagnosis: boolean;
  comments: boolean;
}

export interface ReportGenerationResult {
  success: boolean;
  report: string;
  model_used: string;
  tokens_used: number;
  sections: ReportSections;
  error?: string;
}

// Tipos para análise completa
export interface CompleteAnalysisResult {
  transcription: TranscriptionResult | null;
  vision_analysis: import('./vision').VisionAnalysisResult | null;
  structured_data: DataExtractionResult | null;
  final_report: ReportGenerationResult | null;
  success: boolean;
  errors: string[];
}

// Tipos para validação de qualidade
export interface QualityAssessment {
  quality_score: number;
  medical_terminology: 'excellent' | 'good' | 'fair' | 'poor';
  completeness: 'complete' | 'mostly_complete' | 'partial' | 'incomplete';
  evident_errors: number;
  confidence_assessment: 'high' | 'medium' | 'low';
  suggestions: string[];
  key_information_present: {
    patient_data: boolean;
    sample_location: boolean;
    macroscopic_description: boolean;
    measurements: boolean;
    clinical_observations: boolean;
  };
}

export interface TranscriptionQualityResult {
  success: boolean;
  analysis: QualityAssessment;
  tokens_used: number;
  error?: string;
}

// Tipos para teste de integração
export interface OpenAITestResult {
  whisper_test: {
    success: boolean;
    error: string;
  };
  gpt4_extraction_test: {
    success: boolean;
    error: string;
    tokens_used?: number;
  };
  gpt4_report_test: {
    success: boolean;
    error: string;
    tokens_used?: number;
    report_length?: number;
  };
  overall_success: boolean;
  general_error?: string;
}

// Tipos para capacidades de IA
export interface WhisperCapabilities {
  available: boolean;
  supported_formats: string[];
  max_file_size: string;
  languages: string[];
  model: string;
}

export interface GPT4Capabilities {
  available: boolean;
  model: string;
  capabilities: string[];
  context_window: string;
}

export interface IntegrationCapabilities {
  vision_ai_workflow: boolean;
  complete_analysis_pipeline: boolean;
  multi_modal_processing: boolean;
  automated_reporting: boolean;
}

export interface AICapabilities {
  whisper: WhisperCapabilities;
  gpt4: GPT4Capabilities;
  integration: IntegrationCapabilities;
}

// Props para componentes de IA
export interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onError: (error: string) => void;
  maxDuration?: number;
  enabled?: boolean;
}

export interface TranscriptionDisplayProps {
  transcription: TranscriptionResult;
  onEdit?: (editedText: string) => void;
  showSegments?: boolean;
  showMetadata?: boolean;
}

export interface StructuredDataDisplayProps {
  data: StructuredBiopsyData;
  onEdit?: (field: string, value: any) => void;
  readonly?: boolean;
  compact?: boolean;
}

export interface ReportDisplayProps {
  report: string;
  sections: ReportSections;
  onExport?: (format: 'pdf' | 'docx' | 'txt') => void;
  onEdit?: (editedReport: string) => void;
  readonly?: boolean;
}

export interface CompleteWorkflowProps {
  onAnalysisComplete: (result: CompleteAnalysisResult) => void;
  onError: (error: string) => void;
  enabledFeatures: {
    audioRecording: boolean;
    imageUpload: boolean;
    visionAnalysis: boolean;
    dataExtraction: boolean;
    reportGeneration: boolean;
  };
}

// Tipos para configurações de IA
export interface AISettings {
  whisper: {
    language: string;
    response_format: 'json' | 'text' | 'verbose_json';
    temperature: number;
  };
  gpt4: {
    model: 'gpt-4o-mini' | 'gpt-4';
    temperature: number;
    max_tokens: number;
    response_format: 'text' | 'json_object';
  };
  integration: {
    auto_transcribe: boolean;
    auto_extract_data: boolean;
    auto_generate_report: boolean;
    quality_threshold: number;
  };
}

// Estados da interface de IA
export type AIMode = 'transcription' | 'extraction' | 'reporting' | 'complete_workflow';

export interface AIUIState {
  mode: AIMode;
  processing: boolean;
  current_transcription?: TranscriptionResult;
  current_extraction?: DataExtractionResult;
  current_report?: ReportGenerationResult;
  complete_analysis?: CompleteAnalysisResult;
  settings: AISettings;
  error?: string;
}

// Tipos para histórico de análises de IA
export interface AIAnalysisHistoryItem {
  id: number;
  timestamp: string;
  type: 'transcription' | 'extraction' | 'report' | 'complete';
  success: boolean;
  tokens_used: number;
  processing_time_ms: number;
  user_id: number;
  metadata?: {
    audio_duration?: number;
    text_length?: number;
    report_sections?: number;
    quality_score?: number;
  };
}

// Tipos para exportação de relatórios
export interface ReportExportOptions {
  format: 'pdf' | 'docx' | 'txt' | 'html';
  include_metadata: boolean;
  include_vision_data: boolean;
  include_transcription: boolean;
  template?: string;
}

export interface ExportResult {
  success: boolean;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  error?: string;
}