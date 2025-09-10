/**
 * Service for integrating with backend vision API
 */

export interface GridDetectionResult {
  grid_detected: boolean;
  confidence: number;
  pixels_per_mm?: number;
  horizontal_lines: number;
  vertical_lines: number;
  line_count: number;
  method_used?: string;
  quality_score?: number;
}

export interface BiopsyMeasurements {
  area_mm2: number;
  perimeter_mm: number;
  length_max_mm: number;
  width_max_mm: number;
  equivalent_diameter_mm: number;
  circularity: number;
  aspect_ratio: number;
  solidity: number;
  extent: number;
  confidence_overall?: number;
  pixels_per_mm: number;
}

export interface VisionAnalysisResult {
  success: boolean;
  processing_time_ms: number;
  grid_detection: GridDetectionResult;
  biopsy_segmentation?: {
    biopsy_detected: boolean;
    confidence: number;
    method_used: string;
  };
  measurements?: BiopsyMeasurements;
  overlay_image?: string;
  confidence_overall: number;
  errors: string[];
}

export interface CalibrationData {
  pixels_per_mm: number;
  confidence: number;
  grid_size_mm: number;
  estimated?: boolean;
}

class VisionService {
  private static readonly BASE_URL = '/api';

  /**
   * Get authentication token from localStorage
   */
  private static getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Convert image data URL to FormData for backend upload
   */
  private static imageDataToFormData(imageData: string, filename = 'image.jpg'): FormData {
    const formData = new FormData();
    
    // Convert base64 to blob
    const byteString = atob(imageData.split(',')[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    
    const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
    formData.append('image_file', blob, filename);
    
    return formData;
  }

  /**
   * Detect grid in image
   */
  static async detectGrid(
    imageData: string, 
    gridSizeMm: number = 5.0
  ): Promise<{ status: string; grid_detection: GridDetectionResult }> {
    try {
      const formData = this.imageDataToFormData(imageData, 'grid_detection.jpg');
      formData.append('grid_size_mm', gridSizeMm.toString());

      const response = await fetch(`${this.BASE_URL}/vision/detect-grid-only`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in grid detection:', error);
      throw error;
    }
  }

  /**
   * Perform complete biopsy analysis
   */
  static async analyzeBiopsy(
    imageData: string,
    gridSizeMm: number = 5.0,
    useCalibration: boolean = true
  ): Promise<VisionAnalysisResult> {
    try {
      const formData = this.imageDataToFormData(imageData, 'biopsy_analysis.jpg');
      formData.append('grid_size_mm', gridSizeMm.toString());
      formData.append('use_calibration', useCalibration.toString());

      const response = await fetch(`${this.BASE_URL}/vision/analyze-image`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in biopsy analysis:', error);
      throw error;
    }
  }

  /**
   * Segment biopsy only (without measurements)
   */
  static async segmentBiopsy(imageData: string): Promise<{
    status: string;
    segmentation: any;
    overlay_image?: string;
  }> {
    try {
      const formData = this.imageDataToFormData(imageData, 'biopsy_segmentation.jpg');

      const response = await fetch(`${this.BASE_URL}/vision/segment-biopsy-only`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in biopsy segmentation:', error);
      throw error;
    }
  }

  /**
   * Detect grid from camera feed
   */
  static async detectGridFromCamera(
    cameraIndex: number = 0,
    knownGridSizeMm: number = 5.0
  ): Promise<{
    status: string;
    grid_detected: boolean;
    grid_info: GridDetectionResult;
    size_estimation: any;
  }> {
    try {
      const response = await fetch(`${this.BASE_URL}/calibration/detect-grid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          camera_index: cameraIndex,
          known_grid_size_mm: knownGridSizeMm,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in camera grid detection:', error);
      throw error;
    }
  }

  /**
   * Analyze from camera directly
   */
  static async analyzeFromCamera(
    cameraIndex: number = 0,
    gridSizeMm: number = 5.0,
    useCalibration: boolean = true
  ): Promise<VisionAnalysisResult> {
    try {
      const response = await fetch(`${this.BASE_URL}/vision/analyze-from-camera`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          camera_index: cameraIndex,
          grid_size_mm: gridSizeMm,
          use_calibration: useCalibration,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in camera analysis:', error);
      throw error;
    }
  }

  /**
   * Get processing methods available
   */
  static async getProcessingMethods(): Promise<{
    grid_detection_methods: any[];
    segmentation_methods: any[];
    measurements_available: string[];
  }> {
    try {
      const response = await fetch(`${this.BASE_URL}/vision/processing-methods`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting processing methods:', error);
      throw error;
    }
  }

  /**
   * Get calibration status for vision
   */
  static async getCalibrationStatus(): Promise<{
    status: string;
    has_calibration: boolean;
    calibration_id?: number;
    grid_size_mm?: number;
    quality?: string;
    features_available?: {
      grid_detection: boolean;
      camera_optimized: boolean;
      automatic_measurement: boolean;
    };
  }> {
    try {
      const response = await fetch(`${this.BASE_URL}/vision/calibration-status`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting calibration status:', error);
      throw error;
    }
  }

  /**
   * Test the vision pipeline with synthetic image
   */
  static async testVisionPipeline(): Promise<{
    status: string;
    test_results: VisionAnalysisResult;
    message: string;
  }> {
    try {
      const response = await fetch(`${this.BASE_URL}/vision/test-vision-pipeline`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error testing vision pipeline:', error);
      throw error;
    }
  }

  /**
   * Utility: Convert measurements to display format
   */
  static formatMeasurements(measurements: BiopsyMeasurements): Record<string, string> {
    return {
      'Área': `${measurements.area_mm2} mm²`,
      'Perímetro': `${measurements.perimeter_mm} mm`,
      'Comprimento': `${measurements.length_max_mm} mm`,
      'Largura': `${measurements.width_max_mm} mm`,
      'Diâmetro Equiv.': `${measurements.equivalent_diameter_mm} mm`,
      'Circularidade': measurements.circularity.toFixed(3),
      'Razão de Aspecto': measurements.aspect_ratio.toFixed(2),
      'Solidez': measurements.solidity.toFixed(3),
      'Extensão': measurements.extent.toFixed(3),
    };
  }

  /**
   * Utility: Get confidence level description
   */
  static getConfidenceDescription(confidence: number): {
    level: 'high' | 'medium' | 'low';
    description: string;
    color: 'success' | 'warning' | 'error';
  } {
    if (confidence >= 0.8) {
      return {
        level: 'high',
        description: 'Alta confiança - resultados muito confiáveis',
        color: 'success'
      };
    } else if (confidence >= 0.5) {
      return {
        level: 'medium',
        description: 'Confiança média - verifique as condições',
        color: 'warning'
      };
    } else {
      return {
        level: 'low',
        description: 'Baixa confiança - melhore iluminação/posicionamento',
        color: 'error'
      };
    }
  }
}

export default VisionService;