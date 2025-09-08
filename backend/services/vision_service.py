"""
Serviço de visão computacional avançada para análise de biópsias
"""
import cv2
import numpy as np
from typing import  List, Tuple, Optional, Any
import base64
import json
from datetime import datetime
from scipy import ndimage
from skimage import measure, morphology, segmentation, filters
from skimage.feature import canny
from skimage.measure import label, regionprops
import math


class VisionService:
    """Serviço para análise avançada de biópsias usando visão computacional"""
    
    @staticmethod
    def preprocess_image(image: np.ndarray, enhance: bool = True) -> dict[str, np.ndarray]:
        """Pré-processa imagem para análise"""
        result = {}
        
        # Imagem original
        result['original'] = image.copy()
        
        # Conversão para escala de cinza
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        result['gray'] = gray
        
        if enhance:
            # Equalização de histograma adaptativa (CLAHE)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            result['enhanced'] = enhanced
            
            # Filtro bilateral para reduzir ruído mantendo bordas
            bilateral = cv2.bilateralFilter(enhanced, 9, 75, 75)
            result['bilateral'] = bilateral
            
            # Filtro Gaussiano
            gaussian = cv2.GaussianBlur(enhanced, (5, 5), 0)
            result['gaussian'] = gaussian
        
        return result
    
    @staticmethod
    def detect_grid_advanced(image: np.ndarray, grid_size_mm: float = 5.0) -> dict[str, Any]:
        """Detecção avançada da grade com múltiplas técnicas"""
        processed = VisionService.preprocess_image(image)
        gray = processed['enhanced'] if 'enhanced' in processed else processed['gray']
        
        # Múltiplas abordagens para detecção de linhas
        results = {
            'grid_detected': False,
            'pixels_per_mm': 0,
            'grid_lines': {'horizontal': [], 'vertical': []},
            'confidence': 0,
            'method_used': '',
            'quality_score': 0
        }
        
        methods = [
            VisionService._detect_grid_hough,
            VisionService._detect_grid_morphological,
            VisionService._detect_grid_frequency
        ]
        
        best_result = None
        best_confidence = 0
        
        for method in methods:
            try:
                method_result = method(gray, grid_size_mm)
                if method_result['confidence'] > best_confidence:
                    best_confidence = method_result['confidence']
                    best_result = method_result
            except Exception as e:
                print(f"Erro no método de detecção: {e}")
                continue
        
        if best_result and best_confidence > 0.3:  # Threshold mínimo
            results.update(best_result)
            results['grid_detected'] = True
        
        return results
    
    @staticmethod
    def _detect_grid_hough(gray: np.ndarray, grid_size_mm: float) -> dict[str, Any]:
        """Detecção usando Hough Transform"""
        # Detecção de bordas com Canny
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        
        # Hough Transform para linhas
        lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)
        
        if lines is None:
            return {'confidence': 0, 'method_used': 'hough'}
        
        # Separar linhas horizontais e verticais
        h_lines = []
        v_lines = []
        
        for line in lines:
            rho, theta = line[0]
            
            # Linhas horizontais (theta próximo de 0 ou π)
            if abs(theta) < 0.2 or abs(theta - np.pi) < 0.2:
                h_lines.append(rho)
            # Linhas verticais (theta próximo de π/2)
            elif abs(theta - np.pi/2) < 0.2:
                v_lines.append(rho)
        
        # Calcular espaçamento médio
        h_lines.sort()
        v_lines.sort()
        
        h_spacing = np.mean(np.diff(h_lines)) if len(h_lines) > 1 else 0
        v_spacing = np.mean(np.diff(v_lines)) if len(v_lines) > 1 else 0
        
        if h_spacing > 0 and v_spacing > 0:
            avg_spacing = (h_spacing + v_spacing) / 2
            pixels_per_mm = avg_spacing / grid_size_mm
            
            # Confiança baseada na regularidade e quantidade de linhas
            regularity = 1.0 - abs(h_spacing - v_spacing) / max(h_spacing, v_spacing)
            line_count_factor = min(1.0, (len(h_lines) + len(v_lines)) / 20)
            confidence = regularity * line_count_factor * 0.8
            
            return {
                'confidence': confidence,
                'pixels_per_mm': pixels_per_mm,
                'grid_lines': {'horizontal': h_lines, 'vertical': v_lines},
                'method_used': 'hough',
                'quality_score': regularity
            }
        
        return {'confidence': 0, 'method_used': 'hough'}
    
    @staticmethod
    def _detect_grid_morphological(gray: np.ndarray, grid_size_mm: float) -> dict[str, Any]:
        """Detecção usando morfologia matemática"""
        # Binarização adaptativa
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        
        # Elementos estruturantes para detectar linhas
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 25))
        
        # Detectar linhas horizontais e verticais
        horizontal_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel)
        vertical_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vertical_kernel)
        
        # Encontrar contornos das linhas
        h_contours, _ = cv2.findContours(horizontal_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        v_contours, _ = cv2.findContours(vertical_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Calcular posições médias das linhas
        h_positions = []
        v_positions = []
        
        for contour in h_contours:
            if cv2.contourArea(contour) > 100:  # Filtrar ruído
                y = np.mean([point[0][1] for point in contour])
                h_positions.append(y)
        
        for contour in v_contours:
            if cv2.contourArea(contour) > 100:
                x = np.mean([point[0][0] for point in contour])
                v_positions.append(x)
        
        if len(h_positions) > 2 and len(v_positions) > 2:
            h_positions.sort()
            v_positions.sort()
            
            h_spacing = np.mean(np.diff(h_positions))
            v_spacing = np.mean(np.diff(v_positions))
            
            avg_spacing = (h_spacing + v_spacing) / 2
            pixels_per_mm = avg_spacing / grid_size_mm
            
            regularity = 1.0 - abs(h_spacing - v_spacing) / max(h_spacing, v_spacing)
            confidence = regularity * 0.7
            
            return {
                'confidence': confidence,
                'pixels_per_mm': pixels_per_mm,
                'grid_lines': {'horizontal': h_positions, 'vertical': v_positions},
                'method_used': 'morphological',
                'quality_score': regularity
            }
        
        return {'confidence': 0, 'method_used': 'morphological'}
    
    @staticmethod
    def _detect_grid_frequency(gray: np.ndarray, grid_size_mm: float) -> dict[str, Any]:
        """Detecção usando análise de frequência (FFT)"""
        try:
            # FFT 2D da imagem
            fft = np.fft.fft2(gray)
            fft_shift = np.fft.fftshift(fft)
            magnitude = np.log(np.abs(fft_shift) + 1)
            
            # Encontrar picos na FFT que correspondem à grade
            # Isso detecta padrões periódicos na imagem
            
            # Análise das frequências dominantes
            h, w = magnitude.shape
            center_y, center_x = h // 2, w // 2
            
            # Análise de frequências horizontais (linha central horizontal)
            h_freq = magnitude[center_y, :]
            h_peaks = VisionService._find_frequency_peaks(h_freq)
            
            # Análise de frequências verticais (linha central vertical) 
            v_freq = magnitude[:, center_x]
            v_peaks = VisionService._find_frequency_peaks(v_freq)
            
            if len(h_peaks) > 0 and len(v_peaks) > 0:
                # Estimar espaçamento baseado nos picos de frequência
                h_period = w / max(h_peaks) if max(h_peaks) > 0 else 0
                v_period = h / max(v_peaks) if max(v_peaks) > 0 else 0
                
                if h_period > 0 and v_period > 0:
                    avg_period = (h_period + v_period) / 2
                    pixels_per_mm = avg_period / grid_size_mm
                    
                    # Confiança baseada na força dos picos
                    confidence = min(0.6, (len(h_peaks) + len(v_peaks)) / 10)
                    
                    return {
                        'confidence': confidence,
                        'pixels_per_mm': pixels_per_mm,
                        'grid_lines': {'horizontal': [], 'vertical': []},
                        'method_used': 'frequency',
                        'quality_score': confidence
                    }
            
        except Exception:
            pass
        
        return {'confidence': 0, 'method_used': 'frequency'}
    
    @staticmethod
    def _find_frequency_peaks(signal: np.ndarray, threshold: float = 0.1) -> List[int]:
        """Encontra picos em sinal de frequência"""
        # Suavizar sinal
        smoothed = ndimage.gaussian_filter1d(signal, sigma=1)
        
        # Encontrar picos
        peaks = []
        for i in range(1, len(smoothed) - 1):
            if (smoothed[i] > smoothed[i-1] and 
                smoothed[i] > smoothed[i+1] and 
                smoothed[i] > threshold * np.max(smoothed)):
                peaks.append(i)
        
        return peaks
    
    @staticmethod
    def segment_biopsy(image: np.ndarray, grid_info: dict[str, Any]) -> dict[str, Any]:
        """Segmentação avançada da biópsia"""
        processed = VisionService.preprocess_image(image)
        
        # Múltiplas abordagens de segmentação
        results = {
            'biopsy_detected': False,
            'contour': None,
            'mask': None,
            'confidence': 0,
            'method_used': '',
            'preprocessing_used': []
        }
        
        methods = [
            VisionService._segment_watershed,
            VisionService._segment_adaptive_threshold,
            VisionService._segment_color_based,
            VisionService._segment_edge_based
        ]
        
        best_result = None
        best_confidence = 0
        
        for method in methods:
            for preproc_key, preproc_image in processed.items():
                if preproc_key == 'original':
                    continue
                    
                try:
                    method_result = method(preproc_image, image)
                    method_result['preprocessing_used'] = [preproc_key]
                    
                    if method_result['confidence'] > best_confidence:
                        best_confidence = method_result['confidence']
                        best_result = method_result
                except Exception as e:
                    print(f"Erro na segmentação: {e}")
                    continue
        
        if best_result and best_confidence > 0.4:  # Threshold mínimo
            results.update(best_result)
            results['biopsy_detected'] = True
        
        return results
    
    @staticmethod
    def _segment_watershed(gray: np.ndarray, original: np.ndarray) -> dict[str, Any]:
        """Segmentação usando algoritmo Watershed"""
        # Filtro de suavização
        denoised = cv2.medianBlur(gray, 5)
        
        # Gradiente morfológico
        kernel = np.ones((3, 3), np.uint8)
        gradient = cv2.morphologyEx(denoised, cv2.MORPH_GRADIENT, kernel)
        
        # Threshold para encontrar marcadores
        _, thresh = cv2.threshold(gradient, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Operações morfológicas para limpar
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
        
        # Dilatação para encontrar background
        sure_bg = cv2.dilate(opening, kernel, iterations=3)
        
        # Distância transform para foreground
        dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
        _, sure_fg = cv2.threshold(dist_transform, 0.7 * dist_transform.max(), 255, 0)
        
        # Região incerta
        sure_fg = np.uint8(sure_fg)
        unknown = cv2.subtract(sure_bg, sure_fg)
        
        # Marcadores para watershed
        _, markers = cv2.connectedComponents(sure_fg)
        markers = markers + 1
        markers[unknown == 255] = 0
        
        # Aplicar watershed
        markers = cv2.watershed(cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR), markers)
        
        # Extrair maior região (assumindo que é a biópsia)
        mask = np.zeros_like(gray)
        unique_labels = np.unique(markers)
        
        largest_area = 0
        best_label = 0
        
        for label in unique_labels:
            if label <= 1:  # Pular background e bordas
                continue
            area = np.sum(markers == label)
            if area > largest_area:
                largest_area = area
                best_label = label
        
        if best_label > 0:
            mask[markers == best_label] = 255
            
            # Encontrar contorno
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                largest_contour = max(contours, key=cv2.contourArea)
                area = cv2.contourArea(largest_contour)
                
                # Confiança baseada no tamanho da região
                total_area = gray.shape[0] * gray.shape[1]
                confidence = min(0.8, area / (total_area * 0.1))  # Assume biópsia ocupa 10-80% da imagem
                
                return {
                    'confidence': confidence,
                    'contour': largest_contour,
                    'mask': mask,
                    'method_used': 'watershed'
                }
        
        return {'confidence': 0, 'method_used': 'watershed'}
    
    @staticmethod
    def _segment_adaptive_threshold(gray: np.ndarray, original: np.ndarray) -> dict[str, Any]:
        """Segmentação usando threshold adaptativo"""
        # Threshold adaptativo
        adaptive = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # Limpeza morfológica
        kernel = np.ones((3, 3), np.uint8)
        cleaned = cv2.morphologyEx(adaptive, cv2.MORPH_CLOSE, kernel)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
        
        # Encontrar contornos
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # Filtrar contornos por área
            min_area = (gray.shape[0] * gray.shape[1]) * 0.01  # 1% da imagem
            max_area = (gray.shape[0] * gray.shape[1]) * 0.8   # 80% da imagem
            
            valid_contours = [c for c in contours if min_area < cv2.contourArea(c) < max_area]
            
            if valid_contours:
                largest_contour = max(valid_contours, key=cv2.contourArea)
                area = cv2.contourArea(largest_contour)
                
                # Criar máscara
                mask = np.zeros_like(gray)
                cv2.fillPoly(mask, [largest_contour], 255)
                
                # Confiança baseada na compacidade do contorno
                perimeter = cv2.arcLength(largest_contour, True)
                compactness = (4 * np.pi * area) / (perimeter * perimeter) if perimeter > 0 else 0
                confidence = min(0.7, compactness * 2)  # Objetos mais redondos = maior confiança
                
                return {
                    'confidence': confidence,
                    'contour': largest_contour,
                    'mask': mask,
                    'method_used': 'adaptive_threshold'
                }
        
        return {'confidence': 0, 'method_used': 'adaptive_threshold'}
    
    @staticmethod
    def _segment_color_based(gray: np.ndarray, original: np.ndarray) -> dict[str, Any]:
        """Segmentação baseada em cor (assumindo biópsia tem cor diferente do fundo)"""
        if len(original.shape) != 3:
            return {'confidence': 0, 'method_used': 'color_based'}
        
        # Converter para HSV para melhor segmentação por cor
        hsv = cv2.cvtColor(original, cv2.COLOR_BGR2HSV)
        
        # Definir ranges típicos para tecidos biológicos (tons rosados/vermelhos)
        # Range 1: tons rosados
        lower_pink = np.array([0, 30, 50])
        upper_pink = np.array([20, 255, 255])
        mask1 = cv2.inRange(hsv, lower_pink, upper_pink)
        
        # Range 2: tons avermelhados
        lower_red = np.array([160, 30, 50])
        upper_red = np.array([180, 255, 255])
        mask2 = cv2.inRange(hsv, lower_red, upper_red)
        
        # Combinar máscaras
        mask = cv2.bitwise_or(mask1, mask2)
        
        # Limpeza morfológica
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        # Encontrar contornos
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(largest_contour)
            
            # Verificar se área é razoável
            total_area = gray.shape[0] * gray.shape[1]
            if area > total_area * 0.01 and area < total_area * 0.8:
                confidence = min(0.6, area / (total_area * 0.2))
                
                return {
                    'confidence': confidence,
                    'contour': largest_contour,
                    'mask': mask,
                    'method_used': 'color_based'
                }
        
        return {'confidence': 0, 'method_used': 'color_based'}
    
    @staticmethod
    def _segment_edge_based(gray: np.ndarray, original: np.ndarray) -> dict[str, Any]:
        """Segmentação baseada em detecção de bordas"""
        # Detecção de bordas com Canny
        edges = cv2.Canny(gray, 50, 150)
        
        # Dilatação para conectar bordas próximas
        kernel = np.ones((3, 3), np.uint8)
        dilated = cv2.dilate(edges, kernel, iterations=2)
        
        # Preenchimento de contornos fechados
        filled = dilated.copy()
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            cv2.fillPoly(filled, [contour], 255)
        
        # Encontrar maior região preenchida
        contours, _ = cv2.findContours(filled, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(largest_contour)
            
            # Verificar área válida
            total_area = gray.shape[0] * gray.shape[1]
            if area > total_area * 0.02 and area < total_area * 0.7:
                mask = np.zeros_like(gray)
                cv2.fillPoly(mask, [largest_contour], 255)
                
                # Confiança baseada na continuidade das bordas
                perimeter = cv2.arcLength(largest_contour, True)
                edge_strength = np.sum(edges[mask > 0]) / area if area > 0 else 0
                confidence = min(0.5, edge_strength / 50)  # Normalizar
                
                return {
                    'confidence': confidence,
                    'contour': largest_contour,
                    'mask': mask,
                    'method_used': 'edge_based'
                }
        
        return {'confidence': 0, 'method_used': 'edge_based'}
    
    @staticmethod
    def calculate_measurements(contour: np.ndarray, pixels_per_mm: float) -> dict[str, float]:
        """Calcula medições precisas da biópsia"""
        if contour is None or len(contour) == 0:
            return {}
        
        # Área em pixels e mm²
        area_pixels = cv2.contourArea(contour)
        area_mm2 = area_pixels / (pixels_per_mm ** 2)
        
        # Perímetro em pixels e mm
        perimeter_pixels = cv2.arcLength(contour, True)
        perimeter_mm = perimeter_pixels / pixels_per_mm
        
        # Bounding box para dimensões máximas
        x, y, w, h = cv2.boundingRect(contour)
        width_mm = w / pixels_per_mm
        height_mm = h / pixels_per_mm
        
        # Elipse fitting para medições mais precisas
        if len(contour) >= 5:  # Mínimo para fitEllipse
            ellipse = cv2.fitEllipse(contour)
            center, axes, angle = ellipse
            major_axis_mm = max(axes) / pixels_per_mm
            minor_axis_mm = min(axes) / pixels_per_mm
        else:
            major_axis_mm = max(width_mm, height_mm)
            minor_axis_mm = min(width_mm, height_mm)
            angle = 0
        
        # Medições adicionais
        # Circularidade (4π * área / perímetro²)
        circularity = (4 * np.pi * area_pixels) / (perimeter_pixels ** 2) if perimeter_pixels > 0 else 0
        
        # Razão de aspecto
        aspect_ratio = major_axis_mm / minor_axis_mm if minor_axis_mm > 0 else 1
        
        # Solidity (área do contorno / área do hull convexo)
        hull = cv2.convexHull(contour)
        hull_area = cv2.contourArea(hull)
        solidity = area_pixels / hull_area if hull_area > 0 else 0
        
        # Extent (área do contorno / área do bounding box)
        extent = area_pixels / (w * h) if (w * h) > 0 else 0
        
        # Diâmetro equivalente (diâmetro de círculo com mesma área)
        equivalent_diameter = 2 * np.sqrt(area_mm2 / np.pi)
        
        return {
            # Dimensões básicas
            'area_mm2': round(area_mm2, 2),
            'perimeter_mm': round(perimeter_mm, 2),
            'width_mm': round(width_mm, 2),
            'height_mm': round(height_mm, 2),
            'length_max_mm': round(major_axis_mm, 2),
            'width_max_mm': round(minor_axis_mm, 2),
            
            # Medições derivadas
            'equivalent_diameter_mm': round(equivalent_diameter, 2),
            'circularity': round(circularity, 3),
            'aspect_ratio': round(aspect_ratio, 2),
            'solidity': round(solidity, 3),
            'extent': round(extent, 3),
            
            # Metadados
            'angle_degrees': round(angle, 1),
            'pixels_per_mm': round(pixels_per_mm, 2),
            'area_pixels': int(area_pixels),
            'perimeter_pixels': round(perimeter_pixels, 1)
        }
    
    @staticmethod
    def create_analysis_overlay(
        image: np.ndarray, 
        contour: np.ndarray, 
        measurements: dict[str, float],
        grid_info: dict[str, Any]
    ) -> np.ndarray:
        """Cria overlay visual com medições e análises"""
        overlay = image.copy()
        
        if contour is None:
            return overlay
        
        # Desenhar contorno da biópsia
        cv2.drawContours(overlay, [contour], -1, (0, 255, 0), 3)
        
        # Desenhar bounding box
        x, y, w, h = cv2.boundingRect(contour)
        cv2.rectangle(overlay, (x, y), (x + w, y + h), (255, 0, 0), 2)
        
        # Desenhar elipse fitting
        if len(contour) >= 5:
            ellipse = cv2.fitEllipse(contour)
            cv2.ellipse(overlay, ellipse, (0, 0, 255), 2)
        
        # Desenhar linhas de medição principais
        if 'length_max_mm' in measurements and 'width_max_mm' in measurements:
            # Linha do eixo maior
            if len(contour) >= 5:
                ellipse = cv2.fitEllipse(contour)
                center, axes, angle = ellipse
                cx, cy = int(center[0]), int(center[1])
                
                # Calcular pontos das extremidades dos eixos
                angle_rad = np.deg2rad(angle)
                
                # Eixo maior
                major_length = axes[0] / 2
                major_x1 = int(cx + major_length * np.cos(angle_rad))
                major_y1 = int(cy + major_length * np.sin(angle_rad))
                major_x2 = int(cx - major_length * np.cos(angle_rad))
                major_y2 = int(cy - major_length * np.sin(angle_rad))
                
                cv2.line(overlay, (major_x1, major_y1), (major_x2, major_y2), (255, 255, 0), 2)
                
                # Eixo menor
                minor_length = axes[1] / 2
                minor_x1 = int(cx + minor_length * np.cos(angle_rad + np.pi/2))
                minor_y1 = int(cy + minor_length * np.sin(angle_rad + np.pi/2))
                minor_x2 = int(cx - minor_length * np.cos(angle_rad + np.pi/2))
                minor_y2 = int(cy - minor_length * np.sin(angle_rad + np.pi/2))
                
                cv2.line(overlay, (minor_x1, minor_y1), (minor_x2, minor_y2), (0, 255, 255), 2)
        
        # Adicionar texto com medições
        text_lines = [
            f"Área: {measurements.get('area_mm2', 0)} mm²",
            f"Comprimento: {measurements.get('length_max_mm', 0)} mm",
            f"Largura: {measurements.get('width_max_mm', 0)} mm",
            f"Perímetro: {measurements.get('perimeter_mm', 0)} mm",
            f"Circularidade: {measurements.get('circularity', 0):.3f}"
        ]
        
        # Posicionar texto no canto superior esquerdo
        y_offset = 30
        for i, line in enumerate(text_lines):
            cv2.putText(
                overlay, line, (10, y_offset + i * 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA
            )
            cv2.putText(
                overlay, line, (10, y_offset + i * 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1, cv2.LINE_AA
            )
        
        return overlay
    
    @staticmethod
    def analyze_biopsy_complete(
        image: np.ndarray, 
        grid_size_mm: float = 5.0,
        calibration_data: Optional[dict] = None
    ) -> dict[str, Any]:
        """Análise completa da biópsia com todas as etapas"""
        
        analysis_start = datetime.now()
        
        result = {
            'success': False,
            'timestamp': analysis_start.isoformat(),
            'processing_time_ms': 0,
            'image_info': {
                'width': image.shape[1],
                'height': image.shape[0],
                'channels': len(image.shape)
            },
            'grid_detection': {},
            'biopsy_segmentation': {},
            'measurements': {},
            'overlay_image': None,
            'confidence_overall': 0,
            'errors': []
        }
        
        try:
            # 1. Detecção da grade
            print("Detectando grade...")
            grid_info = VisionService.detect_grid_advanced(image, grid_size_mm)
            result['grid_detection'] = grid_info
            
            if not grid_info['grid_detected']:
                result['errors'].append("Grade não detectada - usando calibração manual")
                # Usar dados de calibração se disponível
                if calibration_data and 'pixels_per_mm' in calibration_data:
                    grid_info['pixels_per_mm'] = calibration_data['pixels_per_mm']
                    grid_info['grid_detected'] = True
                else:
                    result['errors'].append("Nenhuma calibração disponível")
                    return result
            
            # 2. Segmentação da biópsia
            print("Segmentando biópsia...")
            segmentation_info = VisionService.segment_biopsy(image, grid_info)
            result['biopsy_segmentation'] = segmentation_info
            
            if not segmentation_info['biopsy_detected']:
                result['errors'].append("Biópsia não detectada na imagem")
                return result
            
            # 3. Cálculo de medições
            print("Calculando medições...")
            measurements = VisionService.calculate_measurements(
                segmentation_info['contour'],
                grid_info['pixels_per_mm']
            )
            result['measurements'] = measurements
            
            # 4. Criação do overlay
            print("Criando overlay visual...")
            overlay = VisionService.create_analysis_overlay(
                image, 
                segmentation_info['contour'],
                measurements,
                grid_info
            )
            
            # Codificar overlay em base64
            _, buffer = cv2.imencode('.jpg', overlay)
            overlay_base64 = base64.b64encode(buffer).decode('utf-8')
            result['overlay_image'] = overlay_base64
            
            # 5. Cálculo de confiança geral
            grid_confidence = grid_info.get('confidence', 0)
            segment_confidence = segmentation_info.get('confidence', 0)
            result['confidence_overall'] = (grid_confidence + segment_confidence) / 2
            
            result['success'] = True
            
        except Exception as e:
            error_msg = f"Erro durante análise: {str(e)}"
            result['errors'].append(error_msg)
            print(error_msg)
        
        # Tempo de processamento
        processing_time = (datetime.now() - analysis_start).total_seconds() * 1000
        result['processing_time_ms'] = round(processing_time, 2)
        
        return result
    
    @staticmethod
    def create_synthetic_test_image() -> np.ndarray:
        """Cria imagem sintética para teste do pipeline"""
        # Criar imagem branca
        img = np.ones((600, 800, 3), dtype=np.uint8) * 255
        
        # Desenhar grade (papel quadriculado)
        grid_spacing = 40  # pixels
        for x in range(0, 800, grid_spacing):
            cv2.line(img, (x, 0), (x, 600), (200, 200, 200), 1)
        for y in range(0, 600, grid_spacing):
            cv2.line(img, (0, y), (800, y), (200, 200, 200), 1)
        
        # Desenhar biópsia sintética (elipse rosada)
        center = (400, 300)
        axes = (80, 60)
        angle = 30
        color = (180, 120, 150)  # Rosa
        
        # Corpo principal da biópsia
        cv2.ellipse(img, center, axes, angle, 0, 360, color, -1)
        
        # Adicionar algumas variações de cor para realismo
        cv2.ellipse(img, (380, 280), (20, 15), angle, 0, 360, (160, 100, 130), -1)
        cv2.ellipse(img, (420, 320), (15, 10), angle, 0, 360, (200, 140, 170), -1)
        
        # Adicionar um pouco de ruído
        noise = np.random.normal(0, 10, img.shape).astype(np.uint8)
        img = cv2.add(img, noise)
        
        return img