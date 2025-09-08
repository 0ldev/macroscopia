#!/bin/bash

# Script para executar Sistema de Macroscopia diretamente do código fonte
# ============================================================

set -e  # Exit on any error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Função para logging colorido
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

header() {
    echo -e "${CYAN}$1${NC}"
}

# Banner de início
echo ""
header "============================================================"
header "🔬 SISTEMA DE MACROSCOPIA BIOMÉDICA"
header "   Executando diretamente do código fonte"
header "============================================================"

# Verificar se estamos no diretório correto
if [[ ! -f "launcher.py" ]] || [[ ! -d "backend" ]]; then
    error "Execute este script na raiz do projeto (onde está launcher.py)"
    exit 1
fi

# Verificar Python
PYTHON_CMD=""
if command -v python3.11 >/dev/null 2>&1; then
    PYTHON_CMD="python3.11"
    log "Usando Python 3.11: $(python3.11 --version)"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    if [[ "$PYTHON_VERSION" == "3.11" ]] || [[ "$PYTHON_VERSION" > "3.11" ]]; then
        PYTHON_CMD="python3"
        log "Usando Python 3: $(python3 --version)"
    else
        error "Python 3.11+ necessário. Versão atual: $PYTHON_VERSION"
        exit 1
    fi
elif command -v python >/dev/null 2>&1; then
    PYTHON_VERSION=$(python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    if [[ "$PYTHON_VERSION" == "3.11" ]] || [[ "$PYTHON_VERSION" > "3.11" ]]; then
        PYTHON_CMD="python"
        log "Usando Python: $(python --version)"
    else
        error "Python 3.11+ necessário. Versão atual: $PYTHON_VERSION"
        exit 1
    fi
else
    error "Python não encontrado. Instale Python 3.11+"
    exit 1
fi

# Verificar se o ambiente virtual existe
VENV_PATH="venv"
if [[ ! -d "$VENV_PATH" ]]; then
    log "Criando ambiente virtual..."
    $PYTHON_CMD -m venv $VENV_PATH
    
    if [[ $? -ne 0 ]]; then
        error "Falha ao criar ambiente virtual"
        exit 1
    fi
fi

# Ativar ambiente virtual
log "Ativando ambiente virtual..."
if [[ -f "$VENV_PATH/bin/activate" ]]; then
    source "$VENV_PATH/bin/activate"
elif [[ -f "$VENV_PATH/Scripts/activate" ]]; then
    source "$VENV_PATH/Scripts/activate"
else
    error "Não foi possível encontrar script de ativação do venv"
    exit 1
fi

# Verificar se pip está disponível
if ! command -v pip >/dev/null 2>&1; then
    error "pip não encontrado no ambiente virtual"
    exit 1
fi

# Atualizar pip
log "Atualizando pip..."
pip install --upgrade pip setuptools wheel

# Instalar dependências do backend
if [[ -f "backend/requirements.txt" ]]; then
    log "Instalando dependências do backend..."
    pip install -r backend/requirements.txt
else
    warn "Arquivo requirements.txt não encontrado. Instalando dependências básicas..."
    pip install fastapi uvicorn sqlalchemy pydantic pydantic-settings
fi

# Verificar dependências críticas
log "Verificando dependências críticas..."

# PyAudio (pode precisar de instalação especial)
if ! python -c "import pyaudio" 2>/dev/null; then
    warn "PyAudio não encontrado. Tentando instalar..."
    
    # Detectar sistema operacional
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Sistema Linux detectado"
        if command -v apt-get >/dev/null 2>&1; then
            warn "Execute: sudo apt-get install portaudio19-dev python3-dev"
        elif command -v pacman >/dev/null 2>&1; then
            warn "Execute: sudo pacman -S portaudio python-pip"
        elif command -v yum >/dev/null 2>&1; then
            warn "Execute: sudo yum install portaudio-devel python3-devel"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew >/dev/null 2>&1; then
            warn "Execute: brew install portaudio"
        fi
    fi
    
    # Tentar instalar PyAudio
    pip install pyaudio || warn "Falha na instalação do PyAudio. Recursos de áudio podem não funcionar."
fi

# OpenCV
if ! python -c "import cv2" 2>/dev/null; then
    log "Instalando OpenCV..."
    pip install opencv-python
fi

# Criar diretórios necessários
log "Criando diretórios necessários..."
mkdir -p uploads logs backups database

# Build frontend se necessário
if [[ -d "frontend" ]]; then
    if [[ ! -d "frontend/node_modules" ]]; then
        log "Instalando dependências do frontend..."
        if command -v npm >/dev/null 2>&1; then
            (cd frontend && npm install --no-audit --no-fund)
        else
            warn "npm não encontrado. Pulei instalação do frontend."
        fi
    fi
    if [[ ! -d "frontend/build" ]]; then
        log "Gerando build do frontend (React)..."
        if command -v npm >/dev/null 2>&1; then
            (cd frontend && npm run build || warn "Falha ao gerar build do frontend")
        fi
    fi
else
    warn "Diretório frontend não encontrado. Interface web indisponível."
fi

# Criar arquivo .env se não existir
if [[ ! -f ".env" ]]; then
    log "Criando arquivo .env de exemplo..."
    cat > .env << 'EOF'
# Configurações do Sistema de Macroscopia

# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_PROMPT_ID=

# AI Configuration Files
AI_PROMPT_FILE=./prompt.md
AI_FUNCTIONS_FILE=./functions.md

# Database
DATABASE_URL=sqlite:///./database/macroscopia.db

# Security
SECRET_KEY=sua_chave_secreta_muito_longa_e_segura_para_producao
JWT_EXPIRE_MINUTES=1440

# Server
HOST=127.0.0.1
PORT=8000
RELOAD=true
LOG_LEVEL=INFO

# Paths
UPLOAD_PATH=./uploads
BACKUP_PATH=./backups
LOG_PATH=./logs
EOF
    
    warn "Arquivo .env criado. Configure sua OPENAI_API_KEY antes de usar o sistema."
fi

# Verificar se os arquivos de configuração existem
if [[ ! -f "prompt.md" ]]; then
    warn "Arquivo prompt.md não encontrado. O sistema usará prompt padrão."
fi

if [[ ! -f "functions.md" ]]; then
    warn "Arquivo functions.md não encontrado. O sistema usará funções padrão."
fi

# Mostrar informações finais
header "============================================================"
header "🚀 INICIANDO SISTEMA DE MACROSCOPIA"
header "============================================================"

log "🐍 Python: $($PYTHON_CMD --version)"
log "📁 Diretório: $(pwd)"
log "🌐 URL: http://127.0.0.1:8000"
log "📊 Swagger: http://127.0.0.1:8000/docs"
log "👤 Login padrão: admin / admin"

echo ""
header "📝 Funcionalidades disponíveis:"
echo "  🤖 Transcrição de áudio (OpenAI Whisper)"
echo "  🔧 8 funções estruturadas para análise"
echo "  💻 Interface 4-quadrantes profissional"
echo "  📊 Visão computacional para medições"
echo "  🌐 WebSocket tempo real"
echo "  📄 Relatórios médicos automatizados"

echo ""
header "ℹ️  Pressione Ctrl+C para parar o sistema"
header "============================================================"

# Executar o sistema
log "Iniciando aplicação..."
exec $PYTHON_CMD launcher.py