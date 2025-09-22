"""
Configurações da aplicação
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configurações da aplicação"""
    
    # Database
    database_url: str = "sqlite:///./database/macroscopia.db"
    
    # Security
    secret_key: str = "sua_chave_secreta_muito_longa_e_segura"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    
    # OpenAI Configuration
    openai_api_key: Optional[str] = None
    openai_prompt_id: Optional[str] = None  # Prompt ID configured in OpenAI platform
    # Local AI prompt/function file references (used by launcher/.env)
    ai_prompt_file: str = "./prompt.md"
    ai_functions_file: str = "./functions.md"
    
    # Upload
    upload_max_size: int = 10485760  # 10MB
    upload_path: str = "./uploads"
    
    # Backup
    backup_enabled: bool = True
    backup_interval_hours: int = 24
    backup_path: str = "./backups"
    
    # Logging
    log_level: str = "INFO"
    log_path: str = "./logs"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    
    class Config:
        # Prefer project root .env; fallback to config/.env if exists
        env_file = ".env"
        case_sensitive = False
        # Ignore extra environment variables instead of raising validation errors
        extra = "ignore"


# Instância global das configurações
settings = Settings()