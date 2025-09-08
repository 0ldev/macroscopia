/**
 * Tipos específicos para calibração
 */

// Tipo para atualização de calibração
export interface CalibrationUpdate {
  grid_size_mm?: number;
  camera_settings?: Record<string, any>;
  audio_settings?: Record<string, any>;
}

// Tipos de câmera
export interface CameraInfo {
  index: number;
  name: string;
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  available: boolean;
}

export interface CameraCapabilities {
  available: boolean;
  supported_properties: Record<string, boolean>;
  current_settings: Record<string, number>;
}

export interface CameraSettings {
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  brightness: number;
  contrast: number;
  saturation: number;
  auto_focus: boolean;
  auto_white_balance: boolean;
}

// Tipos de áudio
export interface AudioDevice {
  index: number;
  name: string;
  max_input_channels: number;
  max_output_channels: number;
  default_sample_rate: number;
  is_default_input: boolean;
  host_api: number;
  available: boolean;
}

export interface AudioSettings {
  sample_rate: number;
  channels: number;
  bit_depth: number;
  buffer_size: number;
  input_device: number;
  volume: number;
  noise_suppression: boolean;
  auto_gain: boolean;
}

export interface AudioTestResult {
  available: boolean;
  device_index: number;
  device_name: string;
  sample_rate: number;
  channels: number;
  duration: number;
  audio_stats: {
    rms: number;
    peak: number;
    noise_floor: number;
    signal_detected: boolean;
    samples_recorded: number;
  };
  error?: string;
}

export interface AudioLevelsResult {
  success: boolean;
  device_index: number;
  duration: number;
  levels: number[];
  statistics: {
    average: number;
    maximum: number;
    minimum: number;
    quality: 'baixa' | 'média' | 'boa' | 'muito_alta';
  };
  error?: string;
}

// Tipos de detecção de grade
export interface GridDetectionInfo {
  grid_detected: boolean;
  line_count: number;
  horizontal_lines: number;
  vertical_lines: number;
  confidence: number;
  error?: string;
}

export interface GridSizeEstimation {
  estimated: boolean;
  pixels_per_mm: number;
  grid_size_mm: number;
  average_line_distance?: number;
  confidence?: number;
  error?: string;
}

export interface GridDetectionResult {
  status: 'success' | 'error';
  grid_detected: boolean;
  grid_info: GridDetectionInfo;
  size_estimation: GridSizeEstimation;
  camera_index: number;
  known_grid_size_mm: number;
}

// Tipos para captura de frame
export interface CapturedFrame {
  image_base64: string;
  width: number;
  height: number;
  channels: number;
}

// Tipos de validação
export interface ValidationResult {
  camera_valid: boolean;
  audio_valid: boolean;
  camera_errors: string[];
  audio_errors: string[];
}

// Tipos de configurações padrão
export interface DefaultSettings {
  camera: CameraSettings;
  audio: AudioSettings;
  grid_size_mm: number;
}

// Estados da calibração
export type CalibrationStep = 
  | 'camera_setup' 
  | 'audio_setup' 
  | 'grid_detection' 
  | 'preview_test' 
  | 'save_config';

export interface CalibrationState {
  currentStep: CalibrationStep;
  cameraIndex: number;
  audioDeviceIndex: number;
  gridSizeMm: number;
  cameraSettings: CameraSettings;
  audioSettings: AudioSettings;
  isValid: boolean;
  errors: string[];
}

// Props para componentes de calibração
export interface CameraSetupProps {
  selectedCamera: number;
  onCameraChange: (index: number) => void;
  cameraSettings: CameraSettings;
  onSettingsChange: (settings: CameraSettings) => void;
  onNext: () => void;
}

export interface AudioSetupProps {
  selectedDevice: number;
  onDeviceChange: (index: number) => void;
  audioSettings: AudioSettings;
  onSettingsChange: (settings: AudioSettings) => void;
  onNext: () => void;
  onBack: () => void;
}

export interface GridDetectionProps {
  cameraIndex: number;
  gridSizeMm: number;
  onGridSizeChange: (size: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export interface PreviewTestProps {
  calibrationState: CalibrationState;
  onSave: () => void;
  onBack: () => void;
}

// Tipos de resposta da API
export interface ApiCalibrationResponse {
  status: 'success' | 'error';
  message?: string;
  data?: any;
  error?: string;
}