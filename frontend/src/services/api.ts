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
          window.location.href = '/login';
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

  async refreshToken(): Promise<TokenResponse> {
    const response: AxiosResponse<TokenResponse> = await this.api.post('/auth/refresh');
    return response.data;
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

  // Método de verificação de saúde da API
  async healthCheck(): Promise<any> {
    const response = await this.api.get('/health');
    return response.data;
  }
}

// Instância singleton do cliente da API
export const apiClient = new ApiClient();
export default apiClient;