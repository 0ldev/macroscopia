"""
Utilitários de segurança simples para MVP
"""
import hashlib
import secrets
from typing import Optional
from fastapi import HTTPException, status


# Simple in-memory session store for MVP
active_sessions = {}


def hash_senha(senha: str) -> str:
    """Gera hash simples da senha usando SHA256"""
    return hashlib.sha256(senha.encode()).hexdigest()


def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    """Verifica se a senha corresponde ao hash"""
    return hashlib.sha256(senha_plana.encode()).hexdigest() == senha_hash


def criar_sessao(username: str) -> str:
    """Cria uma sessão simples"""
    session_token = secrets.token_urlsafe(32)
    active_sessions[session_token] = {
        "username": username,
        "created_at": "now"  # For MVP, we don't need real timestamps
    }
    return session_token


def verificar_sessao(token: str) -> str:
    """Verifica se a sessão é válida e retorna o username"""
    if token not in active_sessions:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return active_sessions[token]["username"]


def invalidar_sessao(token: str):
    """Remove a sessão (logout)"""
    if token in active_sessions:
        del active_sessions[token]