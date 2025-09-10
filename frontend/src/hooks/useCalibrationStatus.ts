/**
 * React Hook for Calibration Status Management
 * Provides synchronized status across components
 */

import { useState, useEffect } from 'react';
import StatusService, { CalibrationStatusData, ComponentStatusType } from '../services/statusService';

export interface UseCalibrationStatusReturn {
  // Status data
  status: CalibrationStatusData | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  loadStatus: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  updateComponentStatus: (component: keyof CalibrationStatusData['componentStatus'], status: ComponentStatusType) => void;
  saveCalibration: (calibrationData: any) => Promise<void>;
  
  // Convenience getters
  isSystemReady: boolean;
  cameraConfigured: boolean;
  audioConfigured: boolean;
  gridConfigured: boolean;
}

export const useCalibrationStatus = (): UseCalibrationStatusReturn => {
  const [status, setStatus] = useState<CalibrationStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusService = StatusService.getInstance();

  // Load status on mount and subscribe to changes
  useEffect(() => {
    let mounted = true;

    const loadInitialStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        const currentStatus = await statusService.loadStatus();
        if (mounted) {
          setStatus(currentStatus);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Erro ao carregar status de calibração');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Subscribe to status changes
    const unsubscribe = statusService.subscribe((newStatus) => {
      if (mounted) {
        setStatus(newStatus);
        setLoading(false);
        setError(null);
      }
    });

    loadInitialStatus();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [statusService]);

  // Load status function
  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      await statusService.loadStatus();
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar status');
    } finally {
      setLoading(false);
    }
  };

  // Refresh status function
  const refreshStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      await statusService.refreshStatus();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  // Update component status
  const updateComponentStatus = (component: keyof CalibrationStatusData['componentStatus'], componentStatus: ComponentStatusType) => {
    statusService.updateComponentStatus(component, componentStatus);
  };

  // Save calibration
  const saveCalibration = async (calibrationData: any) => {
    try {
      setError(null);
      await statusService.saveCalibration(calibrationData);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar calibração');
      throw err;
    }
  };

  // Convenience getters
  const isSystemReady = status?.dashboardStatus.overall.ready || false;
  const cameraConfigured = status?.dashboardStatus.camera.configured || false;
  const audioConfigured = status?.dashboardStatus.audio.configured || false;
  const gridConfigured = status?.dashboardStatus.grid.configured || false;

  return {
    status,
    loading,
    error,
    loadStatus,
    refreshStatus,
    updateComponentStatus,
    saveCalibration,
    isSystemReady,
    cameraConfigured,
    audioConfigured,
    gridConfigured
  };
};

export default useCalibrationStatus;