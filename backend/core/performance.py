"""
Configurações e monitoramento de performance
Otimizações para o sistema de macroscopia
"""

import time
import psutil
import logging
from typing import Any, Optional
from functools import wraps
from contextlib import asynccontextmanager
import asyncio
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class PerformanceMonitor:
    """Monitor de performance do sistema"""
    
    def __init__(self):
        self.metrics = {
            "request_count": 0,
            "total_request_time": 0.0,
            "avg_response_time": 0.0,
            "memory_usage": 0.0,
            "cpu_usage": 0.0,
            "active_connections": 0,
            "errors_count": 0,
            "last_updated": datetime.now()
        }
        self.request_history = []
        self.max_history = 1000
    
    def record_request(self, duration: float, status_code: int = 200):
        """Registra uma requisição"""
        self.metrics["request_count"] += 1
        self.metrics["total_request_time"] += duration
        self.metrics["avg_response_time"] = (
            self.metrics["total_request_time"] / self.metrics["request_count"]
        )
        
        if status_code >= 400:
            self.metrics["errors_count"] += 1
        
        # Histórico de requisições
        self.request_history.append({
            "timestamp": datetime.now(),
            "duration": duration,
            "status_code": status_code
        })
        
        # Limitar histórico
        if len(self.request_history) > self.max_history:
            self.request_history.pop(0)
        
        self.update_system_metrics()
    
    def update_system_metrics(self):
        """Atualiza métricas do sistema"""
        try:
            process = psutil.Process()
            self.metrics["memory_usage"] = process.memory_info().rss / 1024 / 1024  # MB
            self.metrics["cpu_usage"] = process.cpu_percent()
            self.metrics["last_updated"] = datetime.now()
        except Exception as e:
            logger.error(f"Erro ao atualizar métricas: {e}")
    
    def get_metrics(self) -> dict[str, Any]:
        """Retorna métricas atuais"""
        self.update_system_metrics()
        return self.metrics.copy()
    
    def get_performance_report(self) -> dict[str, Any]:
        """Gera relatório de performance"""
        recent_requests = [
            r for r in self.request_history 
            if r["timestamp"] > datetime.now() - timedelta(minutes=5)
        ]
        
        if recent_requests:
            recent_avg = sum(r["duration"] for r in recent_requests) / len(recent_requests)
            recent_errors = sum(1 for r in recent_requests if r["status_code"] >= 400)
        else:
            recent_avg = 0
            recent_errors = 0
        
        return {
            "overview": self.get_metrics(),
            "recent_5min": {
                "request_count": len(recent_requests),
                "avg_response_time": recent_avg,
                "error_rate": recent_errors / max(len(recent_requests), 1) * 100,
                "requests_per_minute": len(recent_requests) / 5
            },
            "health_status": self.get_health_status()
        }
    
    def get_health_status(self) -> dict[str, Any]:
        """Avalia status de saúde do sistema"""
        metrics = self.get_metrics()
        
        # Critérios de saúde
        health = {
            "overall": "healthy",
            "issues": [],
            "score": 100
        }
        
        # Verificar tempo de resposta
        if metrics["avg_response_time"] > 2.0:
            health["issues"].append("Tempo de resposta alto")
            health["score"] -= 20
        elif metrics["avg_response_time"] > 1.0:
            health["issues"].append("Tempo de resposta moderado")
            health["score"] -= 10
        
        # Verificar uso de memória
        if metrics["memory_usage"] > 1024:  # 1GB
            health["issues"].append("Uso de memória alto")
            health["score"] -= 25
        elif metrics["memory_usage"] > 512:  # 512MB
            health["issues"].append("Uso de memória moderado")
            health["score"] -= 15
        
        # Verificar CPU
        if metrics["cpu_usage"] > 80:
            health["issues"].append("Uso de CPU alto")
            health["score"] -= 20
        elif metrics["cpu_usage"] > 60:
            health["issues"].append("Uso de CPU moderado")
            health["score"] -= 10
        
        # Taxa de erro
        error_rate = (metrics["errors_count"] / max(metrics["request_count"], 1)) * 100
        if error_rate > 10:
            health["issues"].append("Taxa de erro alta")
            health["score"] -= 30
        elif error_rate > 5:
            health["issues"].append("Taxa de erro moderada")
            health["score"] -= 15
        
        # Status geral
        if health["score"] >= 90:
            health["overall"] = "healthy"
        elif health["score"] >= 70:
            health["overall"] = "warning"
        else:
            health["overall"] = "critical"
        
        return health


# Instância global do monitor
performance_monitor = PerformanceMonitor()


def performance_tracking(func):
    """Decorator para tracking de performance"""
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            duration = time.time() - start_time
            performance_monitor.record_request(duration, 200)
            return result
        except Exception as e:
            duration = time.time() - start_time
            performance_monitor.record_request(duration, 500)
            raise
    
    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            duration = time.time() - start_time
            performance_monitor.record_request(duration, 200)
            return result
        except Exception as e:
            duration = time.time() - start_time
            performance_monitor.record_request(duration, 500)
            raise
    
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    else:
        return sync_wrapper


class ConnectionPool:
    """Pool de conexões otimizado"""
    
    def __init__(self, max_connections: int = 100):
        self.max_connections = max_connections
        self.active_connections = 0
        self.semaphore = asyncio.Semaphore(max_connections)
    
    @asynccontextmanager
    async def acquire_connection(self):
        """Adquire uma conexão do pool"""
        async with self.semaphore:
            self.active_connections += 1
            try:
                yield
            finally:
                self.active_connections -= 1
    
    def get_status(self) -> dict[str, int]:
        """Status do pool de conexões"""
        return {
            "max_connections": self.max_connections,
            "active_connections": self.active_connections,
            "available_connections": self.max_connections - self.active_connections
        }


class CacheManager:
    """Gerenciador de cache simples"""
    
    def __init__(self, max_size: int = 1000, ttl: int = 300):
        self.cache = {}
        self.timestamps = {}
        self.max_size = max_size
        self.ttl = ttl  # Time to live em segundos
    
    def get(self, key: str) -> Optional[Any]:
        """Obtém valor do cache"""
        if key not in self.cache:
            return None
        
        # Verificar TTL
        if time.time() - self.timestamps[key] > self.ttl:
            self.delete(key)
            return None
        
        return self.cache[key]
    
    def set(self, key: str, value: Any):
        """Define valor no cache"""
        # Limpar cache se necessário
        if len(self.cache) >= self.max_size:
            self._evict_oldest()
        
        self.cache[key] = value
        self.timestamps[key] = time.time()
    
    def delete(self, key: str):
        """Remove valor do cache"""
        self.cache.pop(key, None)
        self.timestamps.pop(key, None)
    
    def clear(self):
        """Limpa todo o cache"""
        self.cache.clear()
        self.timestamps.clear()
    
    def _evict_oldest(self):
        """Remove entrada mais antiga do cache"""
        if not self.timestamps:
            return
        
        oldest_key = min(self.timestamps.keys(), key=lambda k: self.timestamps[k])
        self.delete(oldest_key)
    
    def get_stats(self) -> dict[str, Any]:
        """Estatísticas do cache"""
        current_time = time.time()
        valid_entries = sum(
            1 for ts in self.timestamps.values() 
            if current_time - ts <= self.ttl
        )
        
        return {
            "total_entries": len(self.cache),
            "valid_entries": valid_entries,
            "expired_entries": len(self.cache) - valid_entries,
            "max_size": self.max_size,
            "usage_percentage": (len(self.cache) / self.max_size) * 100
        }


class ResourceOptimizer:
    """Otimizador de recursos do sistema"""
    
    @staticmethod
    def optimize_image_processing():
        """Otimizações para processamento de imagem"""
        import cv2
        import os
        
        # Configurar OpenCV para usar todos os cores disponíveis
        cv2.setNumThreads(0)  # Use all available cores
        
        # Configurar variáveis de ambiente para otimização
        os.environ["OMP_NUM_THREADS"] = str(psutil.cpu_count())
        os.environ["OPENBLAS_NUM_THREADS"] = str(psutil.cpu_count())
        
        return {
            "opencv_threads": cv2.getNumThreads(),
            "cpu_cores": psutil.cpu_count(),
            "optimization": "enabled"
        }
    
    @staticmethod
    def optimize_memory_usage():
        """Otimizações de uso de memória"""
        import gc
        
        # Force garbage collection
        gc.collect()
        
        # Configurar threshold do garbage collector
        gc.set_threshold(700, 10, 10)
        
        return {
            "garbage_collection": "optimized",
            "threshold": gc.get_threshold(),
            "memory_freed": "yes"
        }
    
    @staticmethod
    def get_system_limits():
        """Obtém limites do sistema"""
        return {
            "max_memory_mb": psutil.virtual_memory().total / 1024 / 1024,
            "cpu_cores": psutil.cpu_count(),
            "cpu_freq_mhz": psutil.cpu_freq().current if psutil.cpu_freq() else None,
            "disk_space_gb": psutil.disk_usage('/').total / 1024 / 1024 / 1024
        }


# Instâncias globais
connection_pool = ConnectionPool()
cache_manager = CacheManager()
resource_optimizer = ResourceOptimizer()


def get_performance_summary() -> dict[str, Any]:
    """Retorna resumo completo de performance"""
    return {
        "monitor": performance_monitor.get_performance_report(),
        "connections": connection_pool.get_status(),
        "cache": cache_manager.get_stats(),
        "system": resource_optimizer.get_system_limits(),
        "timestamp": datetime.now().isoformat()
    }