/**
 * Tipos para visão computacional
 */

// Tipos para análise de imagem
export interface ImageInfo {
  width: number;
  height: number;
  channels: number;
}

export interface GridDetectionResult {
  grid_detected: boolean;
  pixels_per_mm: number;
  grid_lines: {
    horizontal: number[];
    vertical: number[];
  };
  confidence: number;
  method_used: string;
  quality_score: number;
}

export interface BiopsySegmentationResult {
  biopsy_detected: boolean;
  contour: any; // Array de pontos do contorno
  mask: any; // Máscara binária
  confidence: number;
  method_used: string;
  preprocessing_used: string[];
}

export interface BiopsyMeasurements {
  // Dimensões básicas
  area_mm2: number;
  perimeter_mm: number;
  width_mm: number;
  height_mm: number;
  length_max_mm: number;
  width_max_mm: number;
  
  // Medições derivadas
  equivalent_diameter_mm: number;
  circularity: number;
  aspect_ratio: number;
  solidity: number;
  extent: number;
  
  // Metadados
  angle_degrees: number;
  pixels_per_mm: number;
  area_pixels: number;
  perimeter_pixels: number;
}

export interface VisionAnalysisResult {
  success: boolean;
  timestamp: string;
  processing_time_ms: number;
  image_info: ImageInfo;
  grid_detection: GridDetectionResult;
  biopsy_segmentation: BiopsySegmentationResult;
  measurements: BiopsyMeasurements;
  overlay_image?: string; // Base64 encoded image
  confidence_overall: number;
  errors: string[];
}

// Tipos para métodos de processamento
export interface ProcessingMethod {
  name: string;
  description: string;
  best_for: string;
}

export interface ProcessingMethods {
  grid_detection_methods: ProcessingMethod[];
  segmentation_methods: ProcessingMethod[];
  measurements_available: string[];
}

// Tipos para status de calibração
export interface CalibrationStatus {
  status: 'calibrated' | 'not_calibrated';
  message?: string;
  has_calibration: boolean;
  calibration_id?: number;
  grid_size_mm?: number;
  quality?: 'good' | 'basic';
  created_at?: string;
  features_available?: {
    grid_detection: boolean;
    camera_optimized: boolean;
    automatic_measurement: boolean;
  };
}

// Tipos para análise em tempo real
export interface RealTimeAnalysis {
  is_active: boolean;
  camera_index: number;
  grid_size_mm: number;
  use_calibration: boolean;
  current_result?: VisionAnalysisResult;
  processing: boolean;
  error?: string;
}

// Props para componentes
export interface VisionAnalysisProps {
  onAnalysisComplete: (result: VisionAnalysisResult) => void;
  onError: (error: string) => void;
  calibrationStatus: CalibrationStatus;
}

export interface ImageUploadProps {
  onImageUpload: (result: VisionAnalysisResult) => void;
  onError: (error: string) => void;
  loading: boolean;
}

export interface CameraAnalysisProps {
  cameraIndex: number;
  onAnalysisResult: (result: VisionAnalysisResult) => void;
  onError: (error: string) => void;
  gridSizeMm: number;
  useCalibration: boolean;
}

export interface MeasurementDisplayProps {
  measurements: BiopsyMeasurements;
  showDetails?: boolean;
  compact?: boolean;
}

export interface OverlayImageProps {
  overlayImage: string;
  originalImage?: string;
  measurements: BiopsyMeasurements;
  onImageClick?: (x: number, y: number) => void;
}

// Tipos para configurações de análise
export interface AnalysisSettings {
  grid_size_mm: number;
  use_calibration: boolean;
  auto_detect_grid: boolean;
  segmentation_method?: string;
  grid_detection_method?: string;
  min_biopsy_area_mm2: number;
  max_biopsy_area_mm2: number;
  confidence_threshold: number;
}

// Tipos para histórico de análises
export interface AnalysisHistoryItem {
  id: number;
  timestamp: string;
  success: boolean;
  measurements?: BiopsyMeasurements;
  confidence: number;
  processing_time_ms: number;
  image_info: ImageInfo;
  errors?: string[];
}

// Tipos para exportação de dados
export interface ExportData {
  analysis: VisionAnalysisResult;
  settings: AnalysisSettings;
  user_notes?: string;
  export_format: 'json' | 'csv' | 'pdf';
}

// Tipos para validação
export interface ValidationResult {
  is_valid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

// Estados da interface
export type AnalysisMode = 'upload' | 'camera' | 'test';

export interface VisionUIState {
  mode: AnalysisMode;
  processing: boolean;
  current_result?: VisionAnalysisResult;
  history: AnalysisHistoryItem[];
  settings: AnalysisSettings;
  calibration_status: CalibrationStatus;
  error?: string;
}