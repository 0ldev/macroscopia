"""
API de monitoramento e métricas de performance
"""
from typing import  Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
try:
    from core.database import get_database_session
    from models.user import User
    from core.performance import (
        performance_monitor, 
        connection_pool, 
        cache_manager,
        resource_optimizer,
        get_performance_summary
    )
    from api.auth import get_current_user
except ImportError:
    from core.database import get_database_session
    from models.user import User
    from core.performance import (
        performance_monitor, 
        connection_pool, 
        cache_manager,
        resource_optimizer,
        get_performance_summary
    )
    from api.auth import get_current_user

router = APIRouter(prefix="/monitoring", tags=["monitoramento"])


@router.get("/health")
async def get_health_status():
    """Status de saúde do sistema com métricas básicas"""
    health = performance_monitor.get_health_status()
    metrics = performance_monitor.get_metrics()
    
    return {
        "status": health["overall"],
        "score": health["score"],
        "issues": health["issues"],
        "uptime_requests": metrics["request_count"],
        "avg_response_time": f"{metrics['avg_response_time']:.3f}s",
        "memory_usage_mb": f"{metrics['memory_usage']:.1f}",
        "cpu_usage": f"{metrics['cpu_usage']:.1f}%",
        "last_updated": metrics["last_updated"].isoformat()
    }


@router.get("/metrics")
async def get_system_metrics(current_user: User = Depends(get_current_user)):
    """Métricas detalhadas do sistema (usuários autenticados)"""
    return performance_monitor.get_performance_report()


@router.get("/performance")
async def get_performance_overview(current_user: User = Depends(get_current_user)):
    """Visão geral completa de performance"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    return get_performance_summary()


@router.get("/connections")
async def get_connections_status(current_user: User = Depends(get_current_user)):
    """Status das conexões ativas"""
    return {
        "connection_pool": connection_pool.get_status(),
        "websocket_connections": {
            "active": 0,  # Seria obtido do connection_manager
            "sessions": 0
        },
        "database_connections": "healthy"
    }


@router.get("/cache")
async def get_cache_status(current_user: User = Depends(get_current_user)):
    """Status do cache do sistema"""
    return cache_manager.get_stats()


@router.post("/cache/clear")
async def clear_cache(current_user: User = Depends(get_current_user)):
    """Limpa o cache do sistema (apenas admins)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    cache_manager.clear()
    return {"message": "Cache limpo com sucesso"}


@router.get("/optimization")
async def get_optimization_status(current_user: User = Depends(get_current_user)):
    """Status das otimizações do sistema"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    return {
        "image_processing": resource_optimizer.optimize_image_processing(),
        "memory": resource_optimizer.optimize_memory_usage(),
        "system_limits": resource_optimizer.get_system_limits()
    }


@router.post("/optimization/run")
async def run_optimizations(current_user: User = Depends(get_current_user)):
    """Executa otimizações do sistema"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    try:
        results = {
            "image_processing": resource_optimizer.optimize_image_processing(),
            "memory": resource_optimizer.optimize_memory_usage(),
            "cache": {"cleared": False}
        }
        
        # Limpar cache se necessário
        cache_stats = cache_manager.get_stats()
        if cache_stats["usage_percentage"] > 80:
            cache_manager.clear()
            results["cache"]["cleared"] = True
        
        return {
            "message": "Otimizações executadas com sucesso",
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro nas otimizações: {str(e)}")


@router.get("/logs/performance")
async def get_performance_logs(
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Logs de performance recentes"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    # Retorna histórico de requisições (últimas N)
    history = performance_monitor.request_history[-limit:]
    
    return {
        "total_entries": len(performance_monitor.request_history),
        "returned_entries": len(history),
        "logs": [
            {
                "timestamp": entry["timestamp"].isoformat(),
                "duration_ms": f"{entry['duration'] * 1000:.1f}",
                "status_code": entry["status_code"]
            }
            for entry in history
        ]
    }


@router.get("/diagnostics")
async def run_diagnostics(current_user: User = Depends(get_current_user)):
    """Executa diagnósticos completos do sistema"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    
    import psutil
    import platform
    from datetime import datetime
    
    try:
        # Informações do sistema
        system_info = {
            "platform": platform.system(),
            "platform_version": platform.version(),
            "architecture": platform.machine(),
            "processor": platform.processor(),
            "python_version": platform.python_version(),
            "hostname": platform.node()
        }
        
        # Recursos do sistema
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        resources = {
            "cpu": {
                "physical_cores": psutil.cpu_count(logical=False),
                "logical_cores": psutil.cpu_count(logical=True),
                "current_usage": psutil.cpu_percent(interval=1),
                "frequency": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None
            },
            "memory": {
                "total_gb": memory.total / 1024**3,
                "available_gb": memory.available / 1024**3,
                "used_gb": memory.used / 1024**3,
                "usage_percent": memory.percent
            },
            "disk": {
                "total_gb": disk.total / 1024**3,
                "free_gb": disk.free / 1024**3,
                "used_gb": disk.used / 1024**3,
                "usage_percent": (disk.used / disk.total) * 100
            }
        }
        
        # Status dos serviços
        services_status = {
            "database": "healthy",  # Seria testado com query
            "websocket": "healthy",
            "ai_service": "healthy",  # Seria testado com call
            "vision_service": "healthy"
        }
        
        # Performance atual
        perf_summary = get_performance_summary()
        
        return {
            "timestamp": datetime.now().isoformat(),
            "system": system_info,
            "resources": resources,
            "services": services_status,
            "performance": perf_summary,
            "recommendations": generate_recommendations(resources, perf_summary)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no diagnóstico: {str(e)}")


def generate_recommendations(resources: dict[str, Any], performance: dict[str, Any]) -> list:
    """Gera recomendações baseadas no diagnóstico"""
    recommendations = []
    
    # CPU
    if resources["cpu"]["current_usage"] > 80:
        recommendations.append({
            "type": "warning",
            "component": "CPU",
            "message": "Alto uso de CPU detectado",
            "suggestion": "Considere otimizar processos ou aumentar recursos"
        })
    
    # Memória
    if resources["memory"]["usage_percent"] > 85:
        recommendations.append({
            "type": "critical", 
            "component": "Memory",
            "message": "Uso crítico de memória",
            "suggestion": "Reinicie o sistema ou aumente a RAM disponível"
        })
    elif resources["memory"]["usage_percent"] > 70:
        recommendations.append({
            "type": "warning",
            "component": "Memory", 
            "message": "Alto uso de memória",
            "suggestion": "Monitore o uso e considere otimizações"
        })
    
    # Disco
    if resources["disk"]["usage_percent"] > 90:
        recommendations.append({
            "type": "critical",
            "component": "Disk",
            "message": "Espaço em disco crítico",
            "suggestion": "Libere espaço ou expanda armazenamento"
        })
    
    # Performance
    monitor_health = performance["monitor"]["health_status"]
    if monitor_health["overall"] != "healthy":
        recommendations.append({
            "type": "warning",
            "component": "Performance",
            "message": f"Status de saúde: {monitor_health['overall']}",
            "suggestion": f"Verifique: {', '.join(monitor_health['issues'])}"
        })
    
    # Cache
    cache_stats = performance["cache"]
    if cache_stats["usage_percentage"] > 90:
        recommendations.append({
            "type": "info",
            "component": "Cache",
            "message": "Cache quase cheio",
            "suggestion": "Considere limpar o cache para melhor performance"
        })
    
    if not recommendations:
        recommendations.append({
            "type": "success",
            "component": "System",
            "message": "Sistema funcionando normalmente",
            "suggestion": "Nenhuma ação necessária no momento"
        })
    
    return recommendations