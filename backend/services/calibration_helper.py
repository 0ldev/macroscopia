"""
Helper para calibração manual e automática de grade 10mm
"""
import cv2
import numpy as np
from typing import Dict, Optional, Tuple


class CalibrationHelper:
    """Classe para auxiliar na calibração quando detecção automática falha"""

    @staticmethod
    def estimate_pixels_per_mm_from_image_size(image: np.ndarray, assumed_real_width_mm: float = 200) -> float:
        """Estima pixels/mm baseado no tamanho da imagem e largura real assumida"""
        image_width_pixels = image.shape[1]
        return image_width_pixels / assumed_real_width_mm

    @staticmethod
    def create_emergency_calibration(image: np.ndarray, grid_size_mm: float = 10.0) -> Dict:
        """Cria calibração de emergência quando não consegue detectar grade"""
        height, width = image.shape[:2]

        # Estimar pixels por mm baseado em tamanhos típicos de imagem
        # Assumir que a imagem captura aproximadamente 100-300mm de largura
        typical_scene_widths = [100, 150, 200, 250, 300]  # mm

        best_estimate = None
        best_reasonableness = 0

        for scene_width in typical_scene_widths:
            pixels_per_mm = width / scene_width

            # Verificar se é um valor razoável (10-100 pixels/mm é típico)
            if 10 <= pixels_per_mm <= 100:
                reasonableness = 1.0 - abs(pixels_per_mm - 40) / 40  # 40 pixels/mm é ideal
                if reasonableness > best_reasonableness:
                    best_reasonableness = reasonableness
                    best_estimate = pixels_per_mm

        if best_estimate is None:
            # Fallback: usar valor médio conservador
            best_estimate = 30  # pixels/mm

        return {
            'pixels_per_mm': best_estimate,
            'method': 'emergency_estimation',
            'confidence': 0.3,
            'estimated_scene_width_mm': width / best_estimate,
            'grid_size_mm': grid_size_mm,
            'warning': f'Calibração de emergência: {best_estimate:.1f} pixels/mm'
        }

    @staticmethod
    def interactive_calibration_points(image: np.ndarray) -> Optional[Dict]:
        """Permite calibração manual com pontos clicados (para uso futuro)"""
        # Esta função pode ser expandida para interface manual
        # Por enquanto, retorna None para indicar que não está implementada
        return None

    @staticmethod
    def validate_calibration(pixels_per_mm: float, image: np.ndarray) -> Dict:
        """Valida se uma calibração faz sentido"""
        validation = {
            'valid': False,
            'confidence': 0.0,
            'warnings': [],
            'suggestions': []
        }

        # Verificar se o valor está em um range razoável
        if pixels_per_mm < 5:
            validation['warnings'].append('Pixels/mm muito baixo - objeto pode estar muito distante')
            validation['suggestions'].append('Aproxime a câmera do objeto')
        elif pixels_per_mm > 200:
            validation['warnings'].append('Pixels/mm muito alto - objeto pode estar muito próximo')
            validation['suggestions'].append('Afaste a câmera do objeto')
        else:
            validation['valid'] = True

        # Calcular confiança baseada na proximidade com valores típicos
        optimal_range = (20, 80)  # pixels/mm
        if optimal_range[0] <= pixels_per_mm <= optimal_range[1]:
            validation['confidence'] = 1.0
        else:
            distance_from_optimal = min(
                abs(pixels_per_mm - optimal_range[0]),
                abs(pixels_per_mm - optimal_range[1])
            )
            validation['confidence'] = max(0.1, 1.0 - distance_from_optimal / 50)

        # Verificar dimensões da imagem
        height, width = image.shape[:2]
        estimated_scene_width = width / pixels_per_mm
        estimated_scene_height = height / pixels_per_mm

        if estimated_scene_width < 50 or estimated_scene_width > 500:
            validation['warnings'].append(f'Largura estimada da cena: {estimated_scene_width:.1f}mm parece incomum')

        if estimated_scene_height < 30 or estimated_scene_height > 400:
            validation['warnings'].append(f'Altura estimada da cena: {estimated_scene_height:.1f}mm parece incomum')

        return validation

    @staticmethod
    def auto_calibrate_with_object(image: np.ndarray, known_object_size_mm: float) -> Optional[Dict]:
        """Tenta calibrar usando um objeto de tamanho conhecido na imagem"""
        # Converter para escala de cinza
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Detectar contornos
        edges = cv2.Canny(gray, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        # Encontrar o maior contorno (assumindo que é o objeto de referência)
        largest_contour = max(contours, key=cv2.contourArea)

        # Calcular dimensões do contorno
        x, y, w, h = cv2.boundingRect(largest_contour)
        object_size_pixels = max(w, h)  # Usar a maior dimensão

        # Calcular pixels por mm
        pixels_per_mm = object_size_pixels / known_object_size_mm

        # Validar resultado
        validation = CalibrationHelper.validate_calibration(pixels_per_mm, image)

        if validation['valid']:
            return {
                'pixels_per_mm': pixels_per_mm,
                'method': 'object_reference',
                'confidence': validation['confidence'],
                'object_size_pixels': object_size_pixels,
                'known_object_size_mm': known_object_size_mm,
                'validation': validation
            }

        return None

    @staticmethod
    def get_fallback_calibration(image: np.ndarray, grid_size_mm: float = 10.0) -> Dict:
        """Obtém melhor calibração possível quando tudo mais falha"""
        height, width = image.shape[:2]

        # Tentar múltiplas estratégias
        strategies = []

        # Estratégia 1: Baseada no tamanho da imagem
        emergency_cal = CalibrationHelper.create_emergency_calibration(image, grid_size_mm)
        strategies.append(emergency_cal)

        # Estratégia 2: Valores típicos para diferentes tipos de imagem
        typical_calibrations = [
            {'pixels_per_mm': 25, 'scenario': 'Vista ampla do microscópio'},
            {'pixels_per_mm': 40, 'scenario': 'Vista padrão de biópsia'},
            {'pixels_per_mm': 60, 'scenario': 'Vista aproximada'}
        ]

        for cal in typical_calibrations:
            validation = CalibrationHelper.validate_calibration(cal['pixels_per_mm'], image)
            cal.update({
                'method': 'typical_scenario',
                'confidence': validation['confidence'],
                'validation': validation
            })
            strategies.append(cal)

        # Escolher a estratégia com maior confiança
        best_strategy = max(strategies, key=lambda x: x.get('confidence', 0))

        return {
            'pixels_per_mm': best_strategy['pixels_per_mm'],
            'method': best_strategy.get('method', 'fallback'),
            'confidence': best_strategy.get('confidence', 0.2),
            'scenario': best_strategy.get('scenario', 'Calibração de emergência'),
            'warning': f"Usando calibração alternativa: {best_strategy['pixels_per_mm']:.1f} pixels/mm",
            'all_strategies': strategies
        }