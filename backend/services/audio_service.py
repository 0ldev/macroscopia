"""
Serviço de áudio e microfone
"""
import pyaudio
import numpy as np
from typing import List, Dict, Optional, Tuple
import wave
import threading
import time


class AudioService:
    """Serviço para operações com áudio e microfone"""
    
    @staticmethod
    def get_audio_devices() -> List[Dict]:
        """Lista dispositivos de áudio disponíveis"""
        try:
            p = pyaudio.PyAudio()
            devices = []
            
            for i in range(p.get_device_count()):
                try:
                    info = p.get_device_info_by_index(i)
                    
                    # Incluir apenas dispositivos com entrada de áudio
                    if info.get('maxInputChannels', 0) > 0:
                        devices.append({
                            "index": i,
                            "name": info.get('name', f'Dispositivo {i}'),
                            "max_input_channels": info.get('maxInputChannels', 0),
                            "max_output_channels": info.get('maxOutputChannels', 0),
                            "default_sample_rate": int(info.get('defaultSampleRate', 44100)),
                            "is_default_input": i == p.get_default_input_device_info().get('index', -1),
                            "host_api": info.get('hostApi', 0),
                            "available": True
                        })
                except Exception:
                    continue
            
            p.terminate()
            return devices
            
        except Exception:
            return []
    
    @staticmethod
    def test_microphone(device_index: Optional[int] = None, duration: float = 1.0) -> Dict:
        """Testa um microfone específico"""
        try:
            p = pyaudio.PyAudio()
            
            # Configurações de teste
            CHUNK = 1024
            FORMAT = pyaudio.paInt16
            CHANNELS = 1
            RATE = 44100
            
            # Usar dispositivo padrão se não especificado
            if device_index is None:
                device_index = p.get_default_input_device_info().get('index')
            
            # Verificar se o dispositivo existe
            try:
                device_info = p.get_device_info_by_index(device_index)
            except Exception:
                p.terminate()
                return {
                    "available": False,
                    "error": f"Dispositivo {device_index} não encontrado"
                }
            
            # Testar abertura do stream
            try:
                stream = p.open(
                    format=FORMAT,
                    channels=CHANNELS,
                    rate=RATE,
                    input=True,
                    input_device_index=device_index,
                    frames_per_buffer=CHUNK
                )
                
                # Gravar por um curto período
                frames = []
                frames_to_record = int(RATE / CHUNK * duration)
                
                for _ in range(frames_to_record):
                    data = stream.read(CHUNK, exception_on_overflow=False)
                    frames.append(data)
                
                stream.stop_stream()
                stream.close()
                
                # Analisar o áudio capturado
                audio_data = np.frombuffer(b''.join(frames), dtype=np.int16)
                
                # Calcular estatísticas - conversão para tipos nativos Python
                rms = float(np.sqrt(np.mean(audio_data.astype(np.float64)**2)))
                peak = int(np.max(np.abs(audio_data)))
                noise_floor = float(np.percentile(np.abs(audio_data), 10))
                
                # Detectar se há sinal - garantir boolean nativo
                signal_detected = bool(rms > 100)  # Threshold para detectar som
                
                p.terminate()
                
                return {
                    "available": True,
                    "device_index": device_index,
                    "device_name": device_info.get('name', 'Desconhecido'),
                    "sample_rate": RATE,
                    "channels": CHANNELS,
                    "duration": duration,
                    "audio_stats": {
                        "rms": rms,
                        "peak": peak,
                        "noise_floor": noise_floor,
                        "signal_detected": signal_detected,
                        "samples_recorded": len(audio_data)
                    }
                }
                
            except Exception as e:
                p.terminate()
                return {
                    "available": False,
                    "error": f"Erro ao abrir stream de áudio: {str(e)}"
                }
                
        except Exception as e:
            return {
                "available": False,
                "error": f"Erro ao testar microfone: {str(e)}"
            }
    
    @staticmethod
    def test_audio_levels(device_index: Optional[int] = None, duration: float = 3.0) -> Dict:
        """Testa níveis de áudio em tempo real"""
        try:
            p = pyaudio.PyAudio()
            
            CHUNK = 1024
            FORMAT = pyaudio.paInt16
            CHANNELS = 1
            RATE = 44100
            
            if device_index is None:
                device_index = p.get_default_input_device_info().get('index')
            
            stream = p.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                input_device_index=device_index,
                frames_per_buffer=CHUNK
            )
            
            levels = []
            chunks_to_record = int(RATE / CHUNK * duration)
            
            for _ in range(chunks_to_record):
                data = stream.read(CHUNK, exception_on_overflow=False)
                audio_data = np.frombuffer(data, dtype=np.int16)
                rms = np.sqrt(np.mean(audio_data.astype(np.float64)**2))
                levels.append(float(rms))
            
            stream.stop_stream()
            stream.close()
            p.terminate()
            
            # Análise dos níveis
            avg_level = np.mean(levels)
            max_level = np.max(levels)
            min_level = np.min(levels)
            
            # Classificação de qualidade baseada no nível médio
            if avg_level < 50:
                quality = "baixa"
            elif avg_level < 200:
                quality = "média"
            elif avg_level < 1000:
                quality = "boa"
            else:
                quality = "muito_alta"
            
            return {
                "success": True,
                "device_index": device_index,
                "duration": duration,
                "levels": levels,
                "statistics": {
                    "average": float(avg_level),
                    "maximum": float(max_level),
                    "minimum": float(min_level),
                    "quality": quality
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def validate_audio_settings(settings: Dict) -> Tuple[bool, str]:
        """Valida configurações de áudio"""
        try:
            # Verificar campos obrigatórios
            required_fields = ["sample_rate", "channels", "bit_depth", "buffer_size"]
            for field in required_fields:
                if field not in settings:
                    return False, f"Campo obrigatório ausente: {field}"
            
            # Validar sample rate
            valid_sample_rates = [8000, 16000, 22050, 44100, 48000, 96000]
            if settings["sample_rate"] not in valid_sample_rates:
                return False, f"Sample rate inválido. Use um dos valores: {valid_sample_rates}"
            
            # Validar channels
            if not (1 <= settings["channels"] <= 2):
                return False, "Número de canais deve ser 1 (mono) ou 2 (estéreo)"
            
            # Validar bit depth
            valid_bit_depths = [8, 16, 24, 32]
            if settings["bit_depth"] not in valid_bit_depths:
                return False, f"Bit depth inválido. Use um dos valores: {valid_bit_depths}"
            
            # Validar buffer size
            if not (64 <= settings["buffer_size"] <= 8192):
                return False, "Buffer size deve estar entre 64 e 8192"
            
            # Validar volume se presente
            if "volume" in settings:
                if not (0 <= settings["volume"] <= 100):
                    return False, "Volume deve estar entre 0 e 100"
            
            # Validar device index se presente
            if "input_device" in settings and settings["input_device"] != -1:
                try:
                    p = pyaudio.PyAudio()
                    p.get_device_info_by_index(settings["input_device"])
                    p.terminate()
                except Exception:
                    return False, f"Dispositivo de entrada {settings['input_device']} não encontrado"
            
            return True, "Configurações válidas"
            
        except Exception as e:
            return False, f"Erro ao validar configurações: {str(e)}"
    
    @staticmethod
    def get_optimal_settings_for_device(device_index: int) -> Dict:
        """Obtém configurações otimizadas para um dispositivo específico"""
        try:
            p = pyaudio.PyAudio()
            device_info = p.get_device_info_by_index(device_index)
            p.terminate()
            
            # Configurações baseadas nas capacidades do dispositivo
            default_rate = int(device_info.get('defaultSampleRate', 44100))
            max_channels = min(device_info.get('maxInputChannels', 1), 2)
            
            # Ajustar sample rate se necessário
            if default_rate not in [8000, 16000, 22050, 44100, 48000, 96000]:
                if default_rate < 22050:
                    default_rate = 22050
                elif default_rate < 44100:
                    default_rate = 44100
                else:
                    default_rate = 48000
            
            return {
                "sample_rate": default_rate,
                "channels": 1,  # Usar mono para transcrição
                "bit_depth": 16,
                "buffer_size": 1024,
                "input_device": device_index,
                "volume": 75,
                "noise_suppression": True,
                "auto_gain": True,
                "device_name": device_info.get('name', f'Dispositivo {device_index}')
            }
            
        except Exception:
            # Retornar configurações padrão em caso de erro
            return {
                "sample_rate": 44100,
                "channels": 1,
                "bit_depth": 16,
                "buffer_size": 1024,
                "input_device": -1,
                "volume": 75,
                "noise_suppression": True,
                "auto_gain": True,
                "device_name": "Dispositivo padrão"
            }
    
    @staticmethod
    def detect_silence_threshold(device_index: Optional[int] = None, duration: float = 3.0) -> Dict:
        """Detecta o threshold de silêncio para um dispositivo"""
        try:
            test_result = AudioService.test_audio_levels(device_index, duration)
            
            if not test_result["success"]:
                return {
                    "success": False,
                    "error": test_result["error"]
                }
            
            levels = test_result["levels"]
            
            # Calcular threshold baseado no percentil 20 (ruído de fundo)
            noise_floor = np.percentile(levels, 20)
            
            # Threshold deve ser 2-3 vezes o ruído de fundo
            silence_threshold = noise_floor * 2.5
            
            # Limites mínimo e máximo
            silence_threshold = max(50, min(silence_threshold, 500))
            
            return {
                "success": True,
                "silence_threshold": float(silence_threshold),
                "noise_floor": float(noise_floor),
                "recommended_gain": min(100, max(50, 100 - (noise_floor / 10)))
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }