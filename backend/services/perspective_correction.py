"""
Correção de perspectiva para melhorar precisão da medição em grades
"""
import cv2
import numpy as np
from typing import Optional, Tuple, List


class PerspectiveCorrector:
    """Classe para correção de perspectiva em imagens de grade"""

    @staticmethod
    def detect_grid_corners(image: np.ndarray, grid_size_mm: float = 10.0) -> Optional[np.ndarray]:
        """Detecta os cantos da grade para correção de perspectiva"""
        # Converter para escala de cinza
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Melhorar contraste
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # Detectar cantos usando cornerHarris
        corners = cv2.cornerHarris(enhanced, 2, 3, 0.04)

        # Dilatar para marcar cantos
        corners = cv2.dilate(corners, None)

        # Threshold para marcar cantos
        image_corners = image.copy()
        image_corners[corners > 0.01 * corners.max()] = [0, 0, 255]

        # Encontrar coordenadas dos cantos
        corner_coords = np.where(corners > 0.01 * corners.max())
        corner_points = np.column_stack((corner_coords[1], corner_coords[0]))

        if len(corner_points) < 4:
            return None

        # Ordenar cantos: top-left, top-right, bottom-right, bottom-left
        ordered_corners = PerspectiveCorrector._order_corners(corner_points)

        return ordered_corners

    @staticmethod
    def _order_corners(corners: np.ndarray) -> np.ndarray:
        """Ordena os cantos no sentido horário começando do superior esquerdo"""
        # Calcular centro
        center = np.mean(corners, axis=0)

        # Separar cantos por quadrante
        top_left = None
        top_right = None
        bottom_right = None
        bottom_left = None

        min_tl_dist = float('inf')
        min_tr_dist = float('inf')
        min_br_dist = float('inf')
        min_bl_dist = float('inf')

        for corner in corners:
            x, y = corner
            cx, cy = center

            # Top-left (menor x+y)
            if x < cx and y < cy:
                dist = np.sqrt((x - 0)**2 + (y - 0)**2)
                if dist < min_tl_dist:
                    min_tl_dist = dist
                    top_left = corner

            # Top-right (maior x, menor y)
            elif x > cx and y < cy:
                dist = np.sqrt((x - 1000)**2 + (y - 0)**2)
                if dist < min_tr_dist:
                    min_tr_dist = dist
                    top_right = corner

            # Bottom-right (maior x+y)
            elif x > cx and y > cy:
                dist = np.sqrt((x - 1000)**2 + (y - 1000)**2)
                if dist < min_br_dist:
                    min_br_dist = dist
                    bottom_right = corner

            # Bottom-left (menor x, maior y)
            else:
                dist = np.sqrt((x - 0)**2 + (y - 1000)**2)
                if dist < min_bl_dist:
                    min_bl_dist = dist
                    bottom_left = corner

        # Usar os 4 cantos mais externos se alguns não foram encontrados
        if any(c is None for c in [top_left, top_right, bottom_right, bottom_left]):
            # Fallback: usar os 4 cantos mais extremos
            corners_sorted = corners[np.argsort(corners[:, 0] + corners[:, 1])]
            top_left = corners_sorted[0]

            corners_sorted = corners[np.argsort(corners[:, 0] - corners[:, 1])]
            top_right = corners_sorted[-1]

            corners_sorted = corners[np.argsort(-(corners[:, 0] + corners[:, 1]))]
            bottom_right = corners_sorted[0]

            corners_sorted = corners[np.argsort(-(corners[:, 0] - corners[:, 1]))]
            bottom_left = corners_sorted[0]

        return np.array([top_left, top_right, bottom_right, bottom_left], dtype=np.float32)

    @staticmethod
    def correct_perspective(image: np.ndarray, corners: np.ndarray,
                          output_size: Tuple[int, int] = (800, 600)) -> np.ndarray:
        """Aplica correção de perspectiva baseada nos cantos detectados"""
        # Definir pontos de destino (retângulo perfeito)
        width, height = output_size
        dst_corners = np.array([
            [0, 0],
            [width - 1, 0],
            [width - 1, height - 1],
            [0, height - 1]
        ], dtype=np.float32)

        # Calcular matriz de transformação
        matrix = cv2.getPerspectiveTransform(corners, dst_corners)

        # Aplicar transformação
        corrected = cv2.warpPerspective(image, matrix, output_size)

        return corrected

    @staticmethod
    def estimate_grid_quality(image: np.ndarray) -> dict:
        """Estima a qualidade da grade para determinar se precisa de correção"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Detectar linhas
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=80)

        if lines is None:
            return {'quality': 0, 'needs_correction': True, 'reason': 'No lines detected'}

        # Analisar ângulos das linhas
        angles = []
        for line in lines:
            rho, theta = line[0]
            angle = np.degrees(theta)
            angles.append(angle)

        angles = np.array(angles)

        # Verificar se há linhas próximas de 0° e 90°
        horizontal_lines = np.sum((angles < 10) | (angles > 170))
        vertical_lines = np.sum((angles > 80) & (angles < 100))

        # Calcular score de qualidade
        total_lines = len(lines)
        perpendicular_ratio = (horizontal_lines + vertical_lines) / total_lines

        quality_score = perpendicular_ratio * 100
        needs_correction = quality_score < 70  # Se menos de 70% das linhas são perpendiculares

        return {
            'quality': quality_score,
            'needs_correction': needs_correction,
            'total_lines': total_lines,
            'horizontal_lines': horizontal_lines,
            'vertical_lines': vertical_lines,
            'reason': 'Low perpendicular ratio' if needs_correction else 'Good grid alignment'
        }

    @staticmethod
    def auto_correct_perspective(image: np.ndarray) -> Tuple[np.ndarray, dict]:
        """Correção automática de perspectiva se necessário"""
        # Verificar qualidade da grade
        quality_info = PerspectiveCorrector.estimate_grid_quality(image)

        if not quality_info['needs_correction']:
            return image, {'corrected': False, 'reason': 'No correction needed', 'quality': quality_info}

        # Tentar detectar cantos
        corners = PerspectiveCorrector.detect_grid_corners(image)

        if corners is None:
            return image, {'corrected': False, 'reason': 'Could not detect grid corners', 'quality': quality_info}

        # Aplicar correção
        try:
            corrected_image = PerspectiveCorrector.correct_perspective(image, corners)

            # Verificar se a correção melhorou a qualidade
            corrected_quality = PerspectiveCorrector.estimate_grid_quality(corrected_image)

            if corrected_quality['quality'] > quality_info['quality']:
                return corrected_image, {
                    'corrected': True,
                    'reason': 'Perspective corrected successfully',
                    'original_quality': quality_info,
                    'corrected_quality': corrected_quality
                }
            else:
                return image, {
                    'corrected': False,
                    'reason': 'Correction did not improve quality',
                    'original_quality': quality_info,
                    'corrected_quality': corrected_quality
                }

        except Exception as e:
            return image, {'corrected': False, 'reason': f'Correction failed: {str(e)}', 'quality': quality_info}