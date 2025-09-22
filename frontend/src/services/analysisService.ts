/**
 * Serviço de análise para integração com backend real
 * Remove simulações e utiliza APIs reais
 */
import { apiClient } from './api';

export interface VisionMeasurements {
  area_mm2: number;
  perimeter_mm: number;
  length_max_mm: number;
  width_max_mm: number;
  circularity: number;
  aspect_ratio: number;
  confidence: number;
}

export interface VisionAnalysisResult {
  success: boolean;
  measurements?: VisionMeasurements;
  confidence_overall: number;
  processing_time_ms: number;
  overlay_image?: string;
  errors: string[];
  timestamp: string;
}

export interface TranscriptionResult {
  success: boolean;
  text: string;
  language: string;
  duration: number;
  confidence?: number;
  segments?: any[];
  error?: string;
}

export interface ExtractedBiopsyData {
  success: boolean;
  paciente?: any;
  biópsia?: any;
  análise_macroscópica?: any;
  medições?: any;
  observações?: any;
  qualidade_extração?: any;
  tokens_used?: number;
  error?: string;
}

export interface BiopsyReport {
  success: boolean;
  report_text?: string;
  structured_sections?: any;
  metadata?: any;
  tokens_used?: number;
  error?: string;
}

class AnalysisService {
  /**
   * Analisa imagem capturada e retorna medições
   */
  async analyzeImage(imageData: string): Promise<VisionAnalysisResult> {
    try {
      // Converter base64 para Blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], 'captured_image.jpg', { type: 'image/jpeg' });

      // Chamar API real de análise
      const result = await apiClient.analyzeImage(file, 5.0, true);
      
      if (!result.success) {
        return {
          success: false,
          confidence_overall: 0,
          processing_time_ms: 0,
          errors: result.errors || ['Erro desconhecido na análise'],
          timestamp: new Date().toISOString()
        };
      }

      // Mapear resultado para interface esperada
      return {
        success: true,
        measurements: result.measurements,
        confidence_overall: result.confidence_overall,
        processing_time_ms: result.processing_time_ms,
        overlay_image: result.overlay_image,
        errors: result.errors || [],
        timestamp: result.timestamp
      };

    } catch (error: any) {
      console.error('Erro na análise de imagem:', error);
      
      // Retornar erro estruturado
      return {
        success: false,
        confidence_overall: 0,
        processing_time_ms: 0,
        errors: [
          error?.message || 'Erro desconhecido',
          'Verifique se o backend está funcionando e se a imagem está válida'
        ],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Transcreve áudio usando OpenAI Whisper
   */
  async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    try {
      // Converter Blob para File
      const audioFile = new File([audioBlob], 'audio_recording.wav', { 
        type: 'audio/wav' 
      });

      // Chamar API real de transcrição
      const result = await apiClient.transcribeAudio(audioFile);
      
      return result;

    } catch (error: any) {
      console.error('Erro na transcrição de áudio:', error);
      
      return {
        success: false,
        text: '',
        language: 'pt',
        duration: 0,
        error: error?.message || 'Erro desconhecido na transcrição'
      };
    }
  }

  /**
   * Extrai dados estruturados da transcrição usando GPT-4
   */
  async extractBiopsyData(
    transcriptionText: string, 
    visionMeasurements?: VisionMeasurements
  ): Promise<ExtractedBiopsyData> {
    try {
      const result = await apiClient.extractBiopsyData(
        transcriptionText, 
        visionMeasurements
      );
      
      return result;

    } catch (error: any) {
      console.error('Erro na extração de dados:', error);
      
      return {
        success: false,
        error: error?.message || 'Erro desconhecido na extração'
      };
    }
  }

  /**
   * Gera relatório final usando GPT-4
   */
  async generateBiopsyReport(
    structuredData: any,
    visionMeasurements?: VisionMeasurements,
    transcriptionText?: string
  ): Promise<BiopsyReport> {
    try {
      const result = await apiClient.generateBiopsyReport(
        structuredData,
        visionMeasurements,
        transcriptionText
      );
      
      return result;

    } catch (error: any) {
      console.error('Erro na geração do relatório:', error);
      
      return {
        success: false,
        error: error?.message || 'Erro desconhecido na geração do relatório'
      };
    }
  }

  /**
   * Converte base64 para Blob (utilitário)
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Valida se uma imagem está adequada para análise
   */
  validateImageForAnalysis(imageData: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      // Verificar se é uma string base64 válida
      if (!imageData.startsWith('data:image/')) {
        errors.push('Formato de imagem inválido');
      }
      
      // Verificar tamanho (aproximado)
      const base64Length = imageData.length;
      const sizeInBytes = (base64Length * 3) / 4;
      const sizeInMB = sizeInBytes / (1024 * 1024);
      
      if (sizeInMB > 10) {
        errors.push('Imagem muito grande (máximo 10MB)');
      }
      
      if (sizeInMB < 0.01) {
        errors.push('Imagem muito pequena ou corrompida');
      }
      
    } catch (error) {
      errors.push('Erro ao validar imagem');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Valida se um áudio está adequado para transcrição
   */
  validateAudioForTranscription(audioBlob: Blob): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Verificar tamanho (25MB é o limite do Whisper)
    const sizeInMB = audioBlob.size / (1024 * 1024);
    
    if (sizeInMB > 25) {
      errors.push('Arquivo de áudio muito grande (máximo 25MB)');
    }
    
    if (sizeInMB < 0.001) {
      errors.push('Arquivo de áudio muito pequeno ou vazio');
    }
    
    // Verificar tipo MIME
    if (!audioBlob.type.startsWith('audio/')) {
      errors.push('Tipo de arquivo inválido (deve ser áudio)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Instância singleton
export const analysisService = new AnalysisService();
export default analysisService;