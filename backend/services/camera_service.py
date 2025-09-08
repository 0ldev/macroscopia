"""
Serviço de câmera e visão computacional
"""
import cv2
import numpy as np
from typing import Optional, Dict, List, Tuple
import base64
import io
from PIL import Image


class CameraService:
    """Serviço para operações com câmera e processamento de imagem"""
    
    @staticmethod
    def get_available_cameras() -> List[Dict]:
        """Lista câmeras disponíveis no sistema"""
        cameras = []
        
        # Testar até 5 índices de câmera
        for i in range(5):
            cap = cv2.VideoCapture(i)
            if cap.isOpened():
                # Obter informações da câmera
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = int(cap.get(cv2.CAP_PROP_FPS))
                
                cameras.append({
                    "index": i,
                    "name": f"Câmera {i}",
                    "resolution": {"width": width, "height": height},
                    "fps": fps,
                    "available": True
                })
                
                cap.release()
            else:
                cap.release()
                break
        
        return cameras
    
    @staticmethod
    def test_camera(camera_index: int = 0) -> Dict:
        """Testa uma câmera específica"""
        try:
            cap = cv2.VideoCapture(camera_index)
            
            if not cap.isOpened():
                return {
                    "available": False,
                    "error": f"Não foi possível abrir a câmera {camera_index}"
                }
            
            # Obter propriedades da câmera
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = int(cap.get(cv2.CAP_PROP_FPS))
            
            # Tentar capturar um frame
            ret, frame = cap.read()
            cap.release()
            
            if not ret:
                return {
                    "available": False,
                    "error": "Não foi possível capturar imagem da câmera"
                }
            
            return {
                "available": True,
                "index": camera_index,
                "resolution": {"width": width, "height": height},
                "fps": fps,
                "frame_captured": True
            }
            
        except Exception as e:
            return {
                "available": False,
                "error": f"Erro ao testar câmera: {str(e)}"
            }
    
    @staticmethod
    def capture_frame(camera_index: int = 0) -> Optional[dict]:
        """Captura um frame da câmera"""
        try:
            cap = cv2.VideoCapture(camera_index)
            
            if not cap.isOpened():
                return None
            
            ret, frame = cap.read()
            cap.release()
            
            if not ret:
                return None
            
            # Converter para base64 para envio via API
            _, buffer = cv2.imencode('.jpg', frame)
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            
            return {
                "image_base64": frame_base64,
                "width": frame.shape[1],
                "height": frame.shape[0],
                "channels": frame.shape[2]
            }
            
        except Exception:
            return None
    
    @staticmethod
    def detect_grid_lines(frame: np.ndarray) -> Dict:
        """Detecta linhas de grade em uma imagem"""
        try:
            # Converter para escala de cinza
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Aplicar filtro Gaussiano para reduzir ruído
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # Detectar bordas usando Canny
            edges = cv2.Canny(blurred, 50, 150, apertureSize=3)
            
            # Detectar linhas usando Hough Transform
            lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)
            
            if lines is None:
                return {
                    "grid_detected": False,
                    "line_count": 0,
                    "horizontal_lines": 0,
                    "vertical_lines": 0,
                    "confidence": 0
                }
            
            # Classificar linhas em horizontais e verticais
            horizontal_lines = []
            vertical_lines = []
            
            for line in lines:
                rho, theta = line[0]
                
                # Linhas horizontais (theta próximo de 0 ou pi)
                if abs(theta) < 0.2 or abs(theta - np.pi) < 0.2:
                    horizontal_lines.append((rho, theta))
                # Linhas verticais (theta próximo de pi/2)
                elif abs(theta - np.pi/2) < 0.2:
                    vertical_lines.append((rho, theta))
            
            total_lines = len(lines)
            h_count = len(horizontal_lines)
            v_count = len(vertical_lines)
            
            # Determinar se uma grade foi detectada
            grid_detected = h_count >= 3 and v_count >= 3
            
            # Calcular confiança baseada na quantidade e regularidade das linhas
            confidence = min(100, max(0, (total_lines / 20) * 100))
            if grid_detected:
                confidence = min(100, confidence + 30)  # Boost para grades detectadas
            
            return {
                "grid_detected": grid_detected,
                "line_count": total_lines,
                "horizontal_lines": h_count,
                "vertical_lines": v_count,
                "confidence": int(confidence)
            }
            
        except Exception as e:
            return {
                "grid_detected": False,
                "line_count": 0,
                "horizontal_lines": 0,
                "vertical_lines": 0,
                "confidence": 0,
                "error": str(e)
            }
    
    @staticmethod
    def estimate_grid_size(frame: np.ndarray, known_grid_size_mm: float = 5.0) -> Dict:
        """Estima o tamanho da grade e calcula pixels por mm"""
        try:
            grid_info = CameraService.detect_grid_lines(frame)
            
            if not grid_info["grid_detected"]:
                return {
                    "estimated": False,
                    "pixels_per_mm": 0,
                    "grid_size_mm": 0,
                    "error": "Grade não detectada"
                }
            
            # Converter para escala de cinza
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)
            
            if lines is None:
                return {
                    "estimated": False,
                    "pixels_per_mm": 0,
                    "grid_size_mm": 0,
                    "error": "Nenhuma linha detectada"
                }
            
            # Separar linhas horizontais e verticais
            h_positions = []
            v_positions = []
            
            for line in lines:
                rho, theta = line[0]
                
                if abs(theta) < 0.2 or abs(theta - np.pi) < 0.2:
                    h_positions.append(abs(rho))
                elif abs(theta - np.pi/2) < 0.2:
                    v_positions.append(abs(rho))
            
            # Calcular distâncias médias entre linhas
            avg_distance = 0
            if len(h_positions) >= 2 and len(v_positions) >= 2:
                h_positions.sort()
                v_positions.sort()
                
                h_distances = [h_positions[i+1] - h_positions[i] 
                             for i in range(len(h_positions)-1)]
                v_distances = [v_positions[i+1] - v_positions[i] 
                             for i in range(len(v_positions)-1)]
                
                if h_distances and v_distances:
                    avg_distance = (np.mean(h_distances) + np.mean(v_distances)) / 2
            
            if avg_distance == 0:
                return {
                    "estimated": False,
                    "pixels_per_mm": 0,
                    "grid_size_mm": 0,
                    "error": "Não foi possível calcular distância entre linhas"
                }
            
            # Calcular pixels por mm baseado no tamanho conhecido da grade
            pixels_per_mm = avg_distance / known_grid_size_mm
            
            return {
                "estimated": True,
                "pixels_per_mm": float(pixels_per_mm),
                "grid_size_mm": known_grid_size_mm,
                "average_line_distance": float(avg_distance),
                "confidence": grid_info["confidence"]
            }
            
        except Exception as e:
            return {
                "estimated": False,
                "pixels_per_mm": 0,
                "grid_size_mm": 0,
                "error": str(e)
            }
    
    @staticmethod
    def apply_camera_settings(camera_index: int, settings: Dict) -> bool:
        """Aplica configurações à câmera"""
        try:
            cap = cv2.VideoCapture(camera_index)
            
            if not cap.isOpened():
                return False
            
            # Aplicar configurações suportadas pelo OpenCV
            if "width" in settings.get("resolution", {}):
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, settings["resolution"]["width"])
            
            if "height" in settings.get("resolution", {}):
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, settings["resolution"]["height"])
            
            if "fps" in settings:
                cap.set(cv2.CAP_PROP_FPS, settings["fps"])
            
            if "brightness" in settings:
                cap.set(cv2.CAP_PROP_BRIGHTNESS, settings["brightness"] / 100.0)
            
            if "contrast" in settings:
                cap.set(cv2.CAP_PROP_CONTRAST, settings["contrast"] / 100.0)
            
            if "saturation" in settings:
                cap.set(cv2.CAP_PROP_SATURATION, settings["saturation"] / 100.0)
            
            if "auto_focus" in settings:
                cap.set(cv2.CAP_PROP_AUTOFOCUS, 1 if settings["auto_focus"] else 0)
            
            cap.release()
            return True
            
        except Exception:
            return False
    
    @staticmethod
    def get_camera_capabilities(camera_index: int = 0) -> Dict:
        """Obtém as capacidades de uma câmera específica"""
        try:
            cap = cv2.VideoCapture(camera_index)
            
            if not cap.isOpened():
                return {"available": False}
            
            capabilities = {
                "available": True,
                "supported_properties": {},
                "current_settings": {}
            }
            
            # Propriedades principais a verificar
            properties = {
                "width": cv2.CAP_PROP_FRAME_WIDTH,
                "height": cv2.CAP_PROP_FRAME_HEIGHT,
                "fps": cv2.CAP_PROP_FPS,
                "brightness": cv2.CAP_PROP_BRIGHTNESS,
                "contrast": cv2.CAP_PROP_CONTRAST,
                "saturation": cv2.CAP_PROP_SATURATION,
                "auto_focus": cv2.CAP_PROP_AUTOFOCUS,
                "focus": cv2.CAP_PROP_FOCUS,
                "exposure": cv2.CAP_PROP_EXPOSURE,
                "gain": cv2.CAP_PROP_GAIN
            }
            
            for prop_name, prop_id in properties.items():
                try:
                    value = cap.get(prop_id)
                    if value != -1:  # -1 indica propriedade não suportada
                        capabilities["supported_properties"][prop_name] = True
                        capabilities["current_settings"][prop_name] = value
                    else:
                        capabilities["supported_properties"][prop_name] = False
                except:
                    capabilities["supported_properties"][prop_name] = False
            
            cap.release()
            return capabilities
            
        except Exception as e:
            return {
                "available": False,
                "error": str(e)
            }