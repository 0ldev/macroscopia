@echo off
setlocal enabledelayedexpansion

REM Script para executar Sistema de Macroscopia diretamente do código fonte - Windows
REM =========================================================================

REM Configurar codepage para UTF-8
chcp 65001 >nul 2>&1

REM Cores para output (usando PowerShell para cores)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "PURPLE=[95m"
set "CYAN=[96m"
set "NC=[0m"

REM Banner de início
echo.
echo %CYAN%============================================================%NC%
echo %CYAN%🔬 SISTEMA DE MACROSCOPIA BIOMÉDICA%NC%
echo %CYAN%   Executando diretamente do código fonte - Windows%NC%
echo %CYAN%============================================================%NC%

REM Verificar se estamos no diretório correto
if not exist "launcher.py" (
    echo %RED%[ERROR]%NC% Execute este script na raiz do projeto ^(onde está launcher.py^)
    pause
    exit /b 1
)

if not exist "backend" (
    echo %RED%[ERROR]%NC% Diretório backend não encontrado
    pause
    exit /b 1
)

REM Verificar Python
set "PYTHON_CMD="
echo %GREEN%[INFO]%NC% Verificando instalação do Python...

REM Tentar Python 3.11+ primeiro
python --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=2" %%v in ('python --version 2^>^&1') do (
        for /f "tokens=1,2 delims=." %%a in ("%%v") do (
            set /a major=%%a
            set /a minor=%%b
            if !major! gtr 3 (
                set "PYTHON_CMD=python"
            ) else if !major! equ 3 (
                if !minor! geq 8 (
                    set "PYTHON_CMD=python"
                )
            )
        )
    )
)

REM Tentar python3 se python não funcionou
if "!PYTHON_CMD!"=="" (
    python3 --version >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=2" %%v in ('python3 --version 2^>^&1') do (
            for /f "tokens=1,2 delims=." %%a in ("%%v") do (
                set /a major=%%a
                set /a minor=%%b
                if !major! gtr 3 (
                    set "PYTHON_CMD=python3"
                ) else if !major! equ 3 (
                    if !minor! geq 8 (
                        set "PYTHON_CMD=python3"
                    )
                )
            )
        )
    )
)

REM Tentar py launcher
if "!PYTHON_CMD!"=="" (
    py --version >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=2" %%v in ('py --version 2^>^&1') do (
            for /f "tokens=1,2 delims=." %%a in ("%%v") do (
                set /a major=%%a
                set /a minor=%%b
                if !major! gtr 3 (
                    set "PYTHON_CMD=py"
                ) else if !major! equ 3 (
                    if !minor! geq 8 (
                        set "PYTHON_CMD=py"
                    )
                )
            )
        )
    )
)

if "!PYTHON_CMD!"=="" (
    echo %RED%[ERROR]%NC% Python 3.8+ não encontrado. Instale Python 3.8 ou superior
    echo           Baixe em: https://www.python.org/downloads/
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('!PYTHON_CMD! --version 2^>^&1') do (
    echo %GREEN%[INFO]%NC% Usando Python: !PYTHON_CMD! %%v
)

REM Verificar se o ambiente virtual existe
set "VENV_PATH=venv"
if not exist "!VENV_PATH!" (
    echo %GREEN%[INFO]%NC% Criando ambiente virtual...
    !PYTHON_CMD! -m venv !VENV_PATH!
    if !errorlevel! neq 0 (
        echo %RED%[ERROR]%NC% Falha ao criar ambiente virtual
        pause
        exit /b 1
    )
    
    REM Aguardar a criação completa
    timeout /t 2 /nobreak >nul 2>&1
)

REM Verificar se o Python do ambiente virtual existe
set "VENV_PYTHON=!VENV_PATH!\Scripts\python.exe"
set "VENV_PIP=!VENV_PATH!\Scripts\pip.exe"

if not exist "!VENV_PYTHON!" (
    echo %RED%[ERROR]%NC% Python não encontrado no ambiente virtual
    echo          Tentando recriar o ambiente virtual...
    rmdir /s /q "!VENV_PATH!" 2>nul
    !PYTHON_CMD! -m venv !VENV_PATH!
    if !errorlevel! neq 0 (
        echo %RED%[ERROR]%NC% Falha ao recriar ambiente virtual
        pause
        exit /b 1
    )
    timeout /t 2 /nobreak >nul 2>&1
)

REM Usar Python diretamente do venv em vez de ativação
echo %GREEN%[INFO]%NC% Configurando ambiente virtual...
"!VENV_PYTHON!" --version >nul 2>&1
if !errorlevel! neq 0 (
    echo %RED%[ERROR]%NC% Ambiente virtual corrompido
    pause
    exit /b 1
)

echo %GREEN%[INFO]%NC% Ambiente virtual configurado com sucesso

REM Verificar se pip está disponível no venv
"!VENV_PIP!" --version >nul 2>&1
if !errorlevel! neq 0 (
    echo %RED%[ERROR]%NC% pip não encontrado no ambiente virtual
    pause
    exit /b 1
)

REM Atualizar pip no ambiente virtual
echo %GREEN%[INFO]%NC% Atualizando pip...
"!VENV_PIP!" install --upgrade pip setuptools wheel

REM Verificar se requirements.txt existe
if exist "backend\requirements.txt" (
    echo %GREEN%[INFO]%NC% Instalando dependências do backend...
    "!VENV_PIP!" install -r backend\requirements.txt
    if !errorlevel! neq 0 (
        echo %YELLOW%[WARN]%NC% Algumas dependências podem ter falhado. Tentando dependências básicas...
        "!VENV_PIP!" install fastapi uvicorn sqlalchemy pydantic pydantic-settings
    )
) else (
    echo %YELLOW%[WARN]%NC% Arquivo requirements.txt não encontrado. Instalando dependências básicas...
    "!VENV_PIP!" install fastapi uvicorn sqlalchemy pydantic pydantic-settings python-multipart
)

REM Verificar dependências críticas
echo %GREEN%[INFO]%NC% Verificando dependências críticas...

REM Instalar dependências essenciais
echo %GREEN%[INFO]%NC% Instalando dependências essenciais...
"!VENV_PIP!" install requests opencv-python pillow numpy

REM PyAudio (opcional, pode falhar no Windows)
echo %GREEN%[INFO]%NC% Tentando instalar PyAudio ^(opcional^)...
"!VENV_PIP!" install pyaudio >nul 2>&1
if !errorlevel! neq 0 (
    echo %YELLOW%[WARN]%NC% PyAudio falhou na instalação. Recursos de áudio podem não funcionar.
    echo %YELLOW%[WARN]%NC% Para instalar PyAudio no Windows, baixe o wheel em:
    echo           https://www.lfd.uci.edu/~gohlke/pythonlibs/#pyaudio
)

REM Criar diretórios necessários
echo %GREEN%[INFO]%NC% Criando diretórios necessários...
if not exist "uploads" mkdir uploads
if not exist "logs" mkdir logs
if not exist "backups" mkdir backups
if not exist "database" mkdir database

REM Build frontend se necessário
if exist "frontend" (
    echo %GREEN%[INFO]%NC% Verificando frontend...
    
    REM Verificar se Node.js está instalado
    node --version >nul 2>&1
    if !errorlevel! equ 0 (
        if not exist "frontend\node_modules" (
            echo %GREEN%[INFO]%NC% Instalando dependências do frontend...
            cd frontend
            npm install --no-audit --no-fund
            cd ..
        )
        
        if not exist "frontend\build" (
            echo %GREEN%[INFO]%NC% Gerando build do frontend ^(React^)...
            cd frontend
            npm run build
            cd ..
            if exist "build" (
                echo %GREEN%[INFO]%NC% Build do frontend gerado com sucesso
            ) else (
                echo %YELLOW%[WARN]%NC% Falha ao gerar build do frontend
            )
        ) else (
            echo %GREEN%[INFO]%NC% Build do frontend já existe
        )
    ) else (
        echo %YELLOW%[WARN]%NC% Node.js não encontrado. Frontend não será construído.
        echo %YELLOW%[WARN]%NC% Baixe Node.js em: https://nodejs.org/
    )
) else (
    echo %YELLOW%[WARN]%NC% Diretório frontend não encontrado. Interface web indisponível.
)

REM Criar arquivo .env se não existir
if not exist ".env" (
    echo %GREEN%[INFO]%NC% Criando arquivo .env de exemplo...
    (
        echo # Configurações do Sistema de Macroscopia
        echo.
        echo # OpenAI API
        echo OPENAI_API_KEY=your_openai_api_key_here
        echo OPENAI_PROMPT_ID=
        echo.
        echo # AI Configuration Files
        echo AI_PROMPT_FILE=./prompt.md
        echo AI_FUNCTIONS_FILE=./functions.md
        echo.
        echo # Database
        echo DATABASE_URL=sqlite:///./database/macroscopia.db
        echo.
        echo # Security
        echo SECRET_KEY=sua_chave_secreta_muito_longa_e_segura_para_producao
        echo JWT_EXPIRE_MINUTES=1440
        echo.
        echo # Server
        echo HOST=127.0.0.1
        echo PORT=8000
        echo RELOAD=true
        echo LOG_LEVEL=INFO
        echo.
        echo # Paths
        echo UPLOAD_PATH=./uploads
        echo BACKUP_PATH=./backups
        echo LOG_PATH=./logs
    ) > .env
    
    echo %YELLOW%[WARN]%NC% Arquivo .env criado. Configure sua OPENAI_API_KEY antes de usar o sistema.
)

REM Verificar se os arquivos de configuração existem
if not exist "prompt.md" (
    echo %YELLOW%[WARN]%NC% Arquivo prompt.md não encontrado. O sistema usará prompt padrão.
)

if not exist "functions.md" (
    echo %YELLOW%[WARN]%NC% Arquivo functions.md não encontrado. O sistema usará funções padrão.
)

REM Mostrar informações finais
echo.
echo %CYAN%============================================================%NC%
echo %CYAN%🚀 INICIANDO SISTEMA DE MACROSCOPIA%NC%
echo %CYAN%============================================================%NC%

for /f "tokens=2" %%v in ('!PYTHON_CMD! --version 2^>^&1') do (
    echo %GREEN%[INFO]%NC% 🐍 Python: !PYTHON_CMD! %%v
)
echo %GREEN%[INFO]%NC% 📁 Diretório: %CD%
echo %GREEN%[INFO]%NC% 🌐 URL: http://127.0.0.1:8000
echo %GREEN%[INFO]%NC% 📊 Swagger: http://127.0.0.1:8000/docs
echo %GREEN%[INFO]%NC% 👤 Login padrão: admin / admin

echo.
echo %CYAN%📝 Funcionalidades disponíveis:%NC%
echo   🤖 Transcrição de áudio ^(OpenAI Whisper^)
echo   🔧 8 funções estruturadas para análise
echo   💻 Interface 4-quadrantes profissional
echo   📊 Visão computacional para medições
echo   🌐 WebSocket tempo real
echo   📄 Relatórios médicos automatizados

echo.
echo %CYAN%ℹ️  Pressione Ctrl+C para parar o sistema%NC%
echo %CYAN%============================================================%NC%

REM Executar o sistema
echo %GREEN%[INFO]%NC% Iniciando aplicação...
echo.

REM Executar o launcher com o Python correto do venv
echo %GREEN%[INFO]%NC% Executando com Python do ambiente virtual...
"!VENV_PYTHON!" launcher.py

REM Se chegou aqui, o programa terminou
echo.
echo %CYAN%============================================================%NC%
echo %CYAN%🛑 Sistema de Macroscopia finalizado%NC%
echo %CYAN%   Obrigado por usar a plataforma!%NC%
echo %CYAN%============================================================%NC%

pause
