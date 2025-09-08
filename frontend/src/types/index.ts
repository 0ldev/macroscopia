/**
 * Tipos TypeScript para o Sistema de Macroscopia
 */

// Tipos de usuário
export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
  last_login?: string;
  active: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserCreate {
  username: string;
  password: string;
  role: 'admin' | 'user';
}

export interface UserUpdate {
  username?: string;
  password?: string;
  role?: 'admin' | 'user';
  active?: boolean;
}

// Tipos de calibração
export interface Calibration {
  id: number;
  user_id: number;
  grid_size_mm: number;
  camera_settings?: Record<string, any>;
  audio_settings?: Record<string, any>;
  created_at: string;
}

export interface CalibrationCreate {
  grid_size_mm: number;
  camera_settings?: Record<string, any>;
  audio_settings?: Record<string, any>;
}

// Tipos de análise
export interface Analysis {
  id: number;
  user_id: number;
  sample_id: string;
  image_path?: string;
  measurements?: Record<string, any>;
  transcription?: string;
  form_data?: Record<string, any>;
  report?: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisCreate {
  sample_id: string;
  measurements?: Record<string, any>;
  transcription?: string;
  form_data?: Record<string, any>;
  report?: string;
}

// Tipos de log
export interface Log {
  id: number;
  user_id?: number;
  action: string;
  details?: string;
  timestamp: string;
}

// Tipos de resposta da API
export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
}

export interface MessageResponse {
  message: string;
}

export interface ErrorResponse {
  detail: string;
}

// Tipos para o contexto de autenticação
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: LoginRequest & { remember?: boolean }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAdmin: boolean;
}

// Tipos para o sistema de medição
export interface Measurements {
  length_max: number;
  width_max: number;
  area: number;
  perimeter: number;
  circularity: number;
  scale_pixels_per_mm: number;
  grid_size_detected: number;
  confidence: number;
}

// Tipos para os dados do formulário de macroscopia
// Exportar tipos de calibração
export * from './calibration';

export interface MacroscopyForm {
  // Identificação
  numero_peca?: string;
  tipo_tecido: string;
  localizacao?: string;
  procedencia?: string;
  
  // Coloração
  cor_predominante: 'rosada' | 'esbranquiçada' | 'amarelada' | 'acastanhada' | 'avermelhada' | 'arroxeada' | 'enegrecida' | 'outras';
  cor_secundaria?: 'rosada' | 'esbranquiçada' | 'amarelada' | 'acastanhada' | 'avermelhada' | 'arroxeada' | 'enegrecida' | 'ausente';
  distribuicao?: 'homogênea' | 'heterogênea' | 'focal' | 'difusa' | 'variegada';
  observacoes_cor?: string;
  
  // Consistência
  consistencia_principal: 'mole' | 'elástica' | 'firme' | 'endurecida' | 'friável' | 'gelatinosa' | 'cística';
  homogeneidade?: 'homogênea' | 'heterogênea';
  areas_diferentes?: string;
  
  // Superfície
  aspecto_superficie: 'lisa' | 'rugosa' | 'irregular' | 'nodular' | 'ulcerada' | 'papilomatosa';
  brilho?: 'brilhante' | 'opaca' | 'fosca';
  presenca_secrecao?: boolean;
  tipo_secrecao?: string;
  
  // Lesões
  presenca_lesoes: boolean;
  tipo_lesao?: ('mancha' | 'nódulo' | 'massa' | 'cisto' | 'úlcera' | 'erosão' | 'fissura' | 'outras')[];
  localizacao_lesao?: string;
  tamanho_aproximado?: string;
  caracteristicas_lesao?: string;
  
  // Inflamação
  intensidade_inflamacao: 'ausente' | 'leve' | 'moderada' | 'intensa';
  sinais_presentes?: ('hiperemia' | 'edema' | 'congestão' | 'exsudato' | 'necrose')[];
  distribuicao_inflamacao?: 'focal' | 'multifocal' | 'difusa';
  
  // Observações
  observacoes_gerais?: string;
  particularidades?: string;
  correlacao_clinica?: string;
  recomendacoes?: string;
  
  // Conclusão
  impressao_diagnostica?: string;
  achados_principais: string[];
  necessidade_microscopia?: boolean;
  observacoes_finais?: string;
}