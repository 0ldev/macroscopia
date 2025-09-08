"""
Esquemas Pydantic para validação de dados
"""
from datetime import datetime
from typing import Optional, Any, Dict
from pydantic import BaseModel, ConfigDict


# Esquemas de Usuário
class UserBase(BaseModel):
    username: str
    role: str = "user"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    last_login: Optional[datetime] = None
    active: bool


# Esquemas de Login
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# Esquemas de Calibração
class CalibrationBase(BaseModel):
    grid_size_mm: float
    camera_settings: Optional[dict[str, Any]] = None
    audio_settings: Optional[dict[str, Any]] = None


class CalibrationCreate(CalibrationBase):
    pass


class CalibrationUpdate(BaseModel):
    grid_size_mm: Optional[float] = None
    camera_settings: Optional[dict[str, Any]] = None
    audio_settings: Optional[dict[str, Any]] = None


class CalibrationResponse(CalibrationBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    created_at: datetime


# Esquemas de Análise
class AnalysisBase(BaseModel):
    sample_id: str
    measurements: Optional[dict[str, Any]] = None
    transcription: Optional[str] = None
    form_data: Optional[dict[str, Any]] = None
    report: Optional[str] = None


class AnalysisCreate(AnalysisBase):
    pass


class AnalysisUpdate(BaseModel):
    sample_id: Optional[str] = None
    image_path: Optional[str] = None
    measurements: Optional[dict[str, Any]] = None
    transcription: Optional[str] = None
    form_data: Optional[dict[str, Any]] = None
    report: Optional[str] = None


class AnalysisResponse(AnalysisBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    image_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# Esquemas de Log
class LogCreate(BaseModel):
    action: str
    details: Optional[str] = None
    user_id: Optional[int] = None


class LogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: Optional[int] = None
    action: str
    details: Optional[str] = None
    timestamp: datetime


# Esquemas de resposta padrão
class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    detail: str