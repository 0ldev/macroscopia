/**
 * Cliente da API de calibração
 */
import { apiClient } from './api';
import {
  Calibration,
  CalibrationCreate
} from '../types';
import {
  CalibrationUpdate,
  CameraInfo,
  CameraCapabilities,
  AudioDevice,
  AudioTestResult,
  AudioLevelsResult,
  GridDetectionResult,
  CapturedFrame,
  ValidationResult,
  DefaultSettings,
  ApiCalibrationResponse
} from '../types/calibration';

class CalibrationApi {
  // Endpoints de calibração
  async getCalibrations(): Promise<Calibration[]> {
    const response = await apiClient.api.get('/calibration/');
    return response.data;
  }

  async getCurrentCalibration(): Promise<Calibration | null> {
    const response = await apiClient.api.get('/calibration/current');
    return response.data;
  }

  async createCalibration(calibration: CalibrationCreate): Promise<Calibration> {
    const response = await apiClient.api.post('/calibration/', calibration);
    return response.data;
  }

  async updateCurrentCalibration(updates: CalibrationUpdate): Promise<Calibration> {
    const response = await apiClient.api.put('/calibration/current', updates);
    return response.data;
  }

  async deleteCalibration(calibrationId: number): Promise<{ message: string }> {
    const response = await apiClient.api.delete(`/calibration/${calibrationId}`);
    return response.data;
  }

  // Endpoints de câmera
  async listCameras(): Promise<CameraInfo[]> {
    const response = await apiClient.api.get('/calibration/cameras');
    return response.data.cameras;
  }

  async testCamera(cameraIndex: number = 0): Promise<ApiCalibrationResponse> {
    const response = await apiClient.api.post('/calibration/test-camera', null, {
      params: { camera_index: cameraIndex }
    });
    return response.data;
  }

  async getCameraCapabilities(cameraIndex: number): Promise<CameraCapabilities> {
    const response = await apiClient.api.get(`/calibration/camera/${cameraIndex}/capabilities`);
    return response.data.capabilities;
  }

  async captureFrame(cameraIndex: number = 0): Promise<CapturedFrame> {
    const response = await apiClient.api.post('/calibration/capture-frame', null, {
      params: { camera_index: cameraIndex }
    });
    return response.data.frame;
  }

  // Endpoints de áudio
  async listAudioDevices(): Promise<AudioDevice[]> {
    const response = await apiClient.api.get('/calibration/audio-devices');
    return response.data.devices;
  }

  async testMicrophone(deviceIndex?: number, duration: number = 1.0): Promise<AudioTestResult> {
    const params: any = { duration };
    if (deviceIndex !== undefined) {
      params.device_index = deviceIndex;
    }
    
    const response = await apiClient.api.post('/calibration/test-microphone', null, {
      params
    });
    return response.data.microphone_info;
  }

  async testAudioLevels(deviceIndex?: number, duration: number = 3.0): Promise<AudioLevelsResult> {
    const params: any = { duration };
    if (deviceIndex !== undefined) {
      params.device_index = deviceIndex;
    }
    
    const response = await apiClient.api.post('/calibration/test-audio-levels', null, {
      params
    });
    return response.data.audio_levels;
  }

  async detectSilenceThreshold(deviceIndex?: number, duration: number = 3.0): Promise<any> {
    const params: any = { duration };
    if (deviceIndex !== undefined) {
      params.device_index = deviceIndex;
    }
    
    const response = await apiClient.api.post('/calibration/detect-silence-threshold', null, {
      params
    });
    return response.data.threshold_info;
  }

  // Endpoints de detecção de grade
  async detectGrid(cameraIndex: number = 0, knownGridSizeMm: number = 5.0): Promise<GridDetectionResult> {
    const response = await apiClient.api.post('/calibration/detect-grid', null, {
      params: {
        camera_index: cameraIndex,
        known_grid_size_mm: knownGridSizeMm
      }
    });
    return response.data;
  }

  // Endpoints de validação e configurações
  async validateSettings(cameraSettings?: any, audioSettings?: any): Promise<ValidationResult> {
    const response = await apiClient.api.post('/calibration/validate-settings', {
      camera_settings: cameraSettings,
      audio_settings: audioSettings
    });
    return response.data.validation_results;
  }

  async getDefaultSettings(): Promise<DefaultSettings> {
    const response = await apiClient.api.get('/calibration/default-settings');
    return response.data.default_settings;
  }

  // Métodos utilitários
  async performFullCalibration(
    cameraIndex: number,
    audioDeviceIndex: number,
    gridSizeMm: number,
    cameraSettings: any,
    audioSettings: any
  ): Promise<Calibration> {
    // Validar configurações primeiro
    const validation = await this.validateSettings(cameraSettings, audioSettings);
    
    if (!validation.camera_valid || !validation.audio_valid) {
      const errors = [...validation.camera_errors, ...validation.audio_errors];
      throw new Error(`Configurações inválidas: ${errors.join(', ')}`);
    }

    // Testar câmera
    const cameraTest = await this.testCamera(cameraIndex);
    if (cameraTest.status !== 'success') {
      throw new Error(`Erro ao testar câmera: ${cameraTest.message}`);
    }

    // Testar microfone
    const audioTest = await this.testMicrophone(audioDeviceIndex);
    if (!audioTest.available) {
      throw new Error(`Erro ao testar microfone: ${audioTest.error}`);
    }

    // Detectar grade
    const gridDetection = await this.detectGrid(cameraIndex, gridSizeMm);
    if (!gridDetection.grid_detected) {
      console.warn('Grade não detectada automaticamente. Usando configuração manual.');
    }

    // Criar calibração
    const calibrationData: CalibrationCreate = {
      grid_size_mm: gridSizeMm,
      camera_settings: {
        ...cameraSettings,
        camera_index: cameraIndex
      },
      audio_settings: {
        ...audioSettings,
        input_device: audioDeviceIndex
      }
    };

    return await this.createCalibration(calibrationData);
  }

  // Método para obter status do sistema de calibração
  async getCalibrationStatus(): Promise<{
    hasCalibration: boolean;
    cameraAvailable: boolean;
    audioAvailable: boolean;
    lastCalibration?: Calibration;
  }> {
    try {
      const [currentCalibration, cameras, audioDevices] = await Promise.all([
        this.getCurrentCalibration().catch(() => null),
        this.listCameras().catch(() => []),
        this.listAudioDevices().catch(() => [])
      ]);

      return {
        hasCalibration: !!currentCalibration,
        cameraAvailable: cameras.length > 0,
        audioAvailable: audioDevices.length > 0,
        lastCalibration: currentCalibration || undefined
      };
    } catch (error) {
      console.error('Erro ao obter status de calibração:', error);
      return {
        hasCalibration: false,
        cameraAvailable: false,
        audioAvailable: false
      };
    }
  }
}

// Instância singleton da API de calibração
export const calibrationApi = new CalibrationApi();
export default calibrationApi;