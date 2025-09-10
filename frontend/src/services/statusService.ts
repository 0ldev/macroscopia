/**
 * Shared Status Management Service
 * Synchronizes calibration status between Dashboard and Calibration pages
 */

import { calibrationApi } from './calibrationApi';
import { Calibration } from '../types';

export type ComponentStatusType = 'not_configured' | 'configured' | 'testing' | 'error';

export interface ComponentStatus {
  camera: ComponentStatusType;
  audio: ComponentStatusType; 
  grid: ComponentStatusType;
  preview: ComponentStatusType;
}

export interface SystemStatusForDashboard {
  camera: {
    configured: boolean;
    label: string;
  };
  audio: {
    configured: boolean;
    label: string;
  };
  grid: {
    configured: boolean;
    label: string;
  };
  overall: {
    configured: boolean;
    ready: boolean;
  };
}

export interface CalibrationStatusData {
  calibration: Calibration | null;
  componentStatus: ComponentStatus;
  dashboardStatus: SystemStatusForDashboard;
}

class StatusService {
  private static instance: StatusService;
  private currentStatus: CalibrationStatusData | null = null;
  private listeners: Array<(status: CalibrationStatusData) => void> = [];

  private constructor() {}

  public static getInstance(): StatusService {
    if (!StatusService.instance) {
      StatusService.instance = new StatusService();
    }
    return StatusService.instance;
  }

  /**
   * Load calibration status from database and update all listeners
   */
  public async loadStatus(): Promise<CalibrationStatusData> {
    try {
      // Get current calibration from database
      const currentCalibration = await calibrationApi.getCurrentCalibration();
      
      // Calculate component status based on database data
      const componentStatus = this.calculateComponentStatus(currentCalibration);
      
      // Calculate dashboard status
      const dashboardStatus = this.calculateDashboardStatus(componentStatus);
      
      // Store current status
      this.currentStatus = {
        calibration: currentCalibration,
        componentStatus,
        dashboardStatus
      };
      
      // Notify all listeners
      this.notifyListeners();
      
      return this.currentStatus;
      
    } catch (error) {
      console.error('Error loading calibration status:', error);
      
      // Return default status on error
      const defaultStatus: CalibrationStatusData = {
        calibration: null,
        componentStatus: {
          camera: 'not_configured',
          audio: 'not_configured',
          grid: 'not_configured',
          preview: 'not_configured'
        },
        dashboardStatus: {
          camera: { configured: false, label: 'Configurar' },
          audio: { configured: false, label: 'Configurar' },
          grid: { configured: false, label: 'Configurar' },
          overall: { configured: false, ready: false }
        }
      };
      
      this.currentStatus = defaultStatus;
      this.notifyListeners();
      return defaultStatus;
    }
  }

  /**
   * Get current cached status (loads if not available)
   */
  public async getStatus(): Promise<CalibrationStatusData> {
    if (!this.currentStatus) {
      return await this.loadStatus();
    }
    return this.currentStatus;
  }

  /**
   * Force reload status from database
   */
  public async refreshStatus(): Promise<CalibrationStatusData> {
    return await this.loadStatus();
  }

  /**
   * Subscribe to status changes
   */
  public subscribe(listener: (status: CalibrationStatusData) => void): () => void {
    this.listeners.push(listener);
    
    // If we have current status, immediately notify new listener
    if (this.currentStatus) {
      listener(this.currentStatus);
    }
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Update component status locally (for testing states, etc.)
   */
  public updateComponentStatus(component: keyof ComponentStatus, status: ComponentStatusType) {
    if (this.currentStatus) {
      this.currentStatus.componentStatus[component] = status;
      this.currentStatus.dashboardStatus = this.calculateDashboardStatus(this.currentStatus.componentStatus);
      this.notifyListeners();
    }
  }

  /**
   * Save calibration and update status
   */
  public async saveCalibration(calibrationData: any): Promise<void> {
    try {
      let savedCalibration: Calibration;
      
      if (this.currentStatus?.calibration?.id) {
        // Update existing calibration
        savedCalibration = await calibrationApi.updateCurrentCalibration(calibrationData);
      } else {
        // Create new calibration
        savedCalibration = await calibrationApi.createCalibration(calibrationData);
      }
      
      // Reload status from database to ensure consistency
      await this.refreshStatus();
      
    } catch (error) {
      console.error('Error saving calibration:', error);
      throw error;
    }
  }

  /**
   * Calculate component status based on calibration data
   */
  private calculateComponentStatus(calibration: Calibration | null): ComponentStatus {
    const status: ComponentStatus = {
      camera: 'not_configured',
      audio: 'not_configured',
      grid: 'not_configured',
      preview: 'not_configured'
    };

    if (!calibration) {
      return status;
    }

    // Check camera configuration
    if (calibration.camera_settings && Object.keys(calibration.camera_settings).length > 0) {
      status.camera = 'configured';
    }

    // Check audio configuration
    if (calibration.audio_settings && Object.keys(calibration.audio_settings).length > 0) {
      status.audio = 'configured';
    }

    // Check grid configuration
    if (calibration.grid_size_mm && calibration.grid_size_mm > 0) {
      status.grid = 'configured';
    }

    // Check overall system (preview) - all components must be configured
    if (status.camera === 'configured' && status.audio === 'configured' && status.grid === 'configured') {
      status.preview = 'configured';
    }

    return status;
  }

  /**
   * Calculate dashboard status based on component status
   */
  private calculateDashboardStatus(componentStatus: ComponentStatus): SystemStatusForDashboard {
    return {
      camera: {
        configured: componentStatus.camera === 'configured',
        label: this.getStatusLabel(componentStatus.camera)
      },
      audio: {
        configured: componentStatus.audio === 'configured',
        label: this.getStatusLabel(componentStatus.audio)
      },
      grid: {
        configured: componentStatus.grid === 'configured',
        label: this.getStatusLabel(componentStatus.grid)
      },
      overall: {
        configured: componentStatus.preview === 'configured',
        ready: componentStatus.preview === 'configured'
      }
    };
  }

  /**
   * Convert component status to label
   */
  private getStatusLabel(status: ComponentStatusType): string {
    switch (status) {
      case 'configured': return 'Configurado';
      case 'testing': return 'Testando';
      case 'error': return 'Erro';
      case 'not_configured': 
      default: return 'Configurar';
    }
  }

  /**
   * Notify all listeners of status changes
   */
  private notifyListeners(): void {
    if (this.currentStatus) {
      this.listeners.forEach(listener => listener(this.currentStatus!));
    }
  }

  /**
   * Get status color for chips
   */
  public static getStatusColor(configured: boolean): "success" | "warning" | "error" {
    return configured ? "success" : "warning";
  }

  public static getComponentStatusColor(status: ComponentStatusType): "success" | "warning" | "error" | "info" {
    switch (status) {
      case 'configured': return 'success';
      case 'testing': return 'info';
      case 'error': return 'error';
      case 'not_configured': 
      default: return 'warning';
    }
  }

  /**
   * Get status icon for component status
   */
  public static getStatusIcon(status: ComponentStatusType): string {
    switch (status) {
      case 'configured': return '✓';
      case 'testing': return '⏳';
      case 'error': return '❌';
      case 'not_configured': 
      default: return '⚠️';
    }
  }
}

export default StatusService;