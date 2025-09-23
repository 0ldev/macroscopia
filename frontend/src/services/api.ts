/**
 * Cliente HTTP para comunicação com a API
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  User, 
  LoginRequest, 
  TokenResponse, 
  UserCreate, 
  UserUpdate,
  Log,
  Calibration,
  CalibrationCreate,
  Analysis,
  AnalysisCreate,
  MessageResponse
} from '../types';

// Configuração base do axios
// Use relative base URL when frontend is served by backend to avoid CORS/token issues
const baseURL = process.env.REACT_APP_API_URL || '';

class ApiClient {
  public api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para adicionar token de autenticação
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Interceptor para tratar respostas e erros
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expirado ou inválido
          localStorage.removeItem('access_token');
          // Don't redirect here, let the AuthContext handle it
        }
        return Promise.reject(error);
      }
    );
  }

  // Métodos de autenticação
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    const form = new URLSearchParams();
    form.append('username', credentials.username);
    form.append('password', credentials.password);
    const response: AxiosResponse<TokenResponse> = await this.api.post('/auth/login', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response: AxiosResponse<User> = await this.api.get('/auth/me');
    return response.data;
  }

  async logout(): Promise<void> {
    await this.api.post('/auth/logout');
  }

  // Métodos administrativos
  async getUsers(skip: number = 0, limit: number = 100): Promise<User[]> {
    const response: AxiosResponse<User[]> = await this.api.get('/admin/users', {
      params: { skip, limit }
    });
    return response.data;
  }

  async createUser(user: UserCreate): Promise<User> {
    const response: AxiosResponse<User> = await this.api.post('/admin/users', user);
    return response.data;
  }

  async getUser(userId: number): Promise<User> {
    const response: AxiosResponse<User> = await this.api.get(`/admin/users/${userId}`);
    return response.data;
  }

  async updateUser(userId: number, updates: UserUpdate): Promise<User> {
    const response: AxiosResponse<User> = await this.api.put(`/admin/users/${userId}`, updates);
    return response.data;
  }

  async deleteUser(userId: number): Promise<MessageResponse> {
    const response: AxiosResponse<MessageResponse> = await this.api.delete(`/admin/users/${userId}`);
    return response.data;
  }

  async getLogs(skip: number = 0, limit: number = 100, userId?: number): Promise<Log[]> {
    const response: AxiosResponse<Log[]> = await this.api.get('/admin/logs', {
      params: { skip, limit, user_id: userId }
    });
    return response.data;
  }

  // Métodos de calibração (a serem implementados nas próximas fases)
  async getCalibrations(): Promise<Calibration[]> {
    const response: AxiosResponse<Calibration[]> = await this.api.get('/calibrations');
    return response.data;
  }

  async createCalibration(calibration: CalibrationCreate): Promise<Calibration> {
    const response: AxiosResponse<Calibration> = await this.api.post('/calibrations', calibration);
    return response.data;
  }

  // Métodos de análise (a serem implementados nas próximas fases)
  async getAnalyses(skip: number = 0, limit: number = 100): Promise<Analysis[]> {
    const response: AxiosResponse<Analysis[]> = await this.api.get('/analyses', {
      params: { skip, limit }
    });
    return response.data;
  }

  async createAnalysis(analysis: AnalysisCreate): Promise<Analysis> {
    const response: AxiosResponse<Analysis> = await this.api.post('/analyses', analysis);
    return response.data;
  }

  async getAnalysis(analysisId: number): Promise<Analysis> {
    const response: AxiosResponse<Analysis> = await this.api.get(`/analyses/${analysisId}`);
    return response.data;
  }

  async updateAnalysis(analysisId: number, updates: Partial<Analysis>): Promise<Analysis> {
    const response: AxiosResponse<Analysis> = await this.api.put(`/analyses/${analysisId}`, updates);
    return response.data;
  }

  // Métodos de visão computacional
  async analyzeImage(imageFile: File, gridSize: number = 10.0, useCalibration: boolean = true): Promise<any> {
    const formData = new FormData();
    formData.append('image_file', imageFile);
    formData.append('grid_size_mm', gridSize.toString());
    formData.append('use_calibration', useCalibration.toString());

    const response = await this.api.post('/vision/analyze-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async analyzeCameraImage(cameraIndex: number = 0, gridSize: number = 10.0, useCalibration: boolean = true): Promise<any> {
    const response = await this.api.post('/vision/analyze-from-camera', {
      camera_index: cameraIndex,
      grid_size_mm: gridSize,
      use_calibration: useCalibration
    });
    return response.data;
  }

  // Métodos de IA/OpenAI
  async transcribeAudio(audioFile: File): Promise<any> {
    const formData = new FormData();
    formData.append('audio_file', audioFile);

    const response = await this.api.post('/ai/transcribe-audio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async extractBiopsyData(transcriptionText: string, visionMeasurements?: any): Promise<any> {
    const formData = new FormData();
    formData.append('transcription_text', transcriptionText);
    if (visionMeasurements) {
      formData.append('vision_measurements', JSON.stringify(visionMeasurements));
    }

    const response = await this.api.post('/ai/extract-biopsy-data', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  }

  async generateBiopsyReport(structuredData: any, visionMeasurements?: any, transcriptionText?: string): Promise<any> {
    const response = await this.api.post('/ai/generate-report', {
      structured_data: structuredData,
      vision_measurements: visionMeasurements,
      transcription_text: transcriptionText
    });
    return response.data;
  }

  // Método de verificação de saúde da API
  async healthCheck(): Promise<any> {
    const response = await this.api.get('/health');
    return response.data;
  }
}

// Instância singleton do cliente da API
export const apiClient = new ApiClient();
export default apiClient;