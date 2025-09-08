#!/usr/bin/env python3
"""
Launcher for Biomedical Macroscopy Platform
Entry point for PyInstaller executable
"""

import sys
import os
import asyncio
import threading
import time
import webbrowser
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('macroscopia.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Detect if running as PyInstaller bundle
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    # Running as PyInstaller bundle
    BUNDLE_DIR = Path(sys._MEIPASS)
    IS_BUNDLED = True
    logger.info("Running as PyInstaller bundle")
else:
    # Running as script
    BUNDLE_DIR = Path(__file__).parent
    IS_BUNDLED = False
    logger.info("Running as Python script")

# Add backend to Python path
if IS_BUNDLED:
    # In PyInstaller bundle, backend is included as data files
    # Also need to add the _internal directory for dependencies
    internal_path = BUNDLE_DIR / '_internal'
    if internal_path.exists():
        sys.path.insert(0, str(internal_path))
        logger.info(f"Added bundle _internal to path: {internal_path}")
    
    backend_path = BUNDLE_DIR / 'backend'
    if backend_path.exists():
        sys.path.insert(0, str(backend_path))
        logger.info(f"Added bundled backend to path: {backend_path}")
        # Also add the parent directory so core.config can be found
        sys.path.insert(0, str(BUNDLE_DIR))
        logger.info(f"Added bundle root to path: {BUNDLE_DIR}")
    else:
        # Try alternative paths in bundle
        alt_backend_path = BUNDLE_DIR / '_internal' / 'backend'
        if alt_backend_path.exists():
            sys.path.insert(0, str(alt_backend_path))
            backend_path = alt_backend_path
            logger.info(f"Added alternative backend to path: {alt_backend_path}")
            # Also add the parent directory so core.config can be found
            sys.path.insert(0, str(BUNDLE_DIR))
            logger.info(f"Added bundle root to path: {BUNDLE_DIR}")
        else:
            logger.error(f"Backend path not found in bundle. Tried: {backend_path}, {alt_backend_path}")
            logger.info(f"Available paths in bundle: {list(BUNDLE_DIR.iterdir())}")
else:
    # Running as script
    backend_path = BUNDLE_DIR / 'backend'
    if backend_path.exists():
        sys.path.insert(0, str(backend_path))
        logger.info(f"Added script backend to path: {backend_path}")
    else:
        logger.error(f"Backend path not found: {backend_path}")


class MacroscopiaLauncher:
    """Main launcher class for the Macroscopia platform"""
    
    def __init__(self):
        self.host = "127.0.0.1"
        self.port = 8000
        self.frontend_port = 3000
        self.server_thread = None
        self.server_process = None
        self.running = False
        
        # Configure environment
        self.setup_environment()
    
    def setup_environment(self):
        """Configure environment variables and paths"""
        # Set up data directories
        if IS_BUNDLED:
            # For bundled app, use user data directory
            import platform
            if platform.system() == "Windows":
                data_dir = Path(os.environ.get('APPDATA', '.')) / 'Macroscopia'
            else:
                data_dir = Path.home() / '.macroscopia'
        else:
            # For development, use project directory
            data_dir = BUNDLE_DIR
        
        data_dir.mkdir(exist_ok=True)
        
        # Set environment variables
        os.environ['MACROSCOPIA_DATA_DIR'] = str(data_dir)
        os.environ['MACROSCOPIA_DB_PATH'] = str(data_dir / 'macroscopia.db')
        os.environ['MACROSCOPIA_UPLOAD_PATH'] = str(data_dir / 'uploads')
        os.environ['MACROSCOPIA_LOG_PATH'] = str(data_dir / 'logs')
        
        # Create necessary directories
        (data_dir / 'uploads').mkdir(exist_ok=True)
        (data_dir / 'logs').mkdir(exist_ok=True)
        (data_dir / 'backup').mkdir(exist_ok=True)
        
        logger.info(f"Data directory: {data_dir}")
    
    def check_port_available(self, port):
        """Check if port is available"""
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return True
            except socket.error:
                return False
    
    def find_available_port(self, start_port, max_tries=10):
        """Find an available port starting from start_port"""
        for i in range(max_tries):
            port = start_port + i
            if self.check_port_available(port):
                return port
        return None
    
    def start_backend_server(self):
        """Start the FastAPI backend server"""
        try:
            logger.info("Starting backend server...")
            
            # Find available port
            available_port = self.find_available_port(self.port)
            if available_port is None:
                logger.error(f"Could not find available port starting from {self.port}")
                return False
            
            self.port = available_port
            logger.info(f"Using port: {self.port}")
            
            # Import and start the FastAPI app
            import uvicorn
            from backend.main import app
            
            # Configure uvicorn
            config = uvicorn.Config(
                app=app,
                host=self.host,
                port=self.port,
                log_level="info",
                access_log=True
            )
            
            server = uvicorn.Server(config)
            
            # Run server in thread
            def run_server():
                try:
                    asyncio.run(server.serve())
                except Exception as e:
                    logger.error(f"Server error: {e}")
            
            self.server_thread = threading.Thread(target=run_server, daemon=True)
            self.server_thread.start()
            
            # Wait for server to start
            max_wait = 60  # seconds
            for i in range(max_wait):
                try:
                    import requests
                    for path in ("/health", "/", "/api"):
                        try:
                            r = requests.get(f"http://{self.host}:{self.port}{path}", timeout=2)
                            if r.status_code == 200:
                                logger.info("Backend server started successfully!")
                                return True
                        except Exception:
                            continue
                except Exception:
                    pass
                time.sleep(1)
            logger.error("Backend server failed to signal readiness within timeout but process is running. Continuing anyway.")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start backend server: {e}")
            return False
    
    def serve_frontend(self):
        """Serve frontend files"""
        if IS_BUNDLED:
            # In bundled mode, frontend is served by FastAPI
            frontend_path = BUNDLE_DIR / 'frontend'
            if frontend_path.exists():
                logger.info(f"Frontend files found at: {frontend_path}")
                # Frontend will be served by FastAPI static files
                return True
            else:
                logger.warning("Frontend files not found in bundle")
                return False
        else:
            # In development mode, assume React dev server or build files
            frontend_build = BUNDLE_DIR / 'frontend' / 'build'
            if frontend_build.exists():
                logger.info("Frontend build files found")
                return True
            else:
                logger.warning("Frontend build not found. Run 'npm run build' first.")
                return False
    
    def open_browser(self):
        """Open the application in default browser"""
        try:
            url = f"http://{self.host}:{self.port}"
            logger.info(f"Opening browser: {url}")
            webbrowser.open(url)
        except Exception as e:
            logger.error(f"Failed to open browser: {e}")
    
    def show_startup_info(self):
        """Show startup information"""
        print("\n" + "="*60)
        print("🔬 PLATAFORMA DE MACROSCOPIA BIOMÉDICA")
        print("   Análise Inteligente com Visão Computacional + IA")
        print("="*60)
        print(f"🚀 Servidor iniciado em: http://{self.host}:{self.port}")
        print(f"📊 Painel administrativo: http://{self.host}:{self.port}/docs")
        print(f"👤 Login padrão: admin / admin")
        print("="*60)
        print("📝 Funcionalidades:")
        print("  🤖 Transcrição de áudio em tempo real (OpenAI Whisper)")
        print("  🔧 8 funções estruturadas para análise automatizada") 
        print("  💻 Interface 4-quadrantes profissional")
        print("  📊 Visão computacional para medições automáticas")
        print("  🌐 Comunicação WebSocket tempo real")
        print("  📄 Geração automática de relatórios médicos")
        print("="*60)
        print("ℹ️  Pressione Ctrl+C para parar o servidor")
        print("🌐 O navegador será aberto automaticamente...")
        print("="*60 + "\n")
    
    def run(self):
        """Main run method"""
        try:
            self.running = True
            
            # Setup frontend
            if not self.serve_frontend():
                logger.warning("Frontend setup issues detected")
            
            # Start backend server
            if not self.start_backend_server():
                logger.error("Failed to start backend server")
                return 1
            
            # Show startup information
            self.show_startup_info()
            
            # Open browser after a short delay
            threading.Timer(3.0, self.open_browser).start()
            
            # Keep main thread alive
            try:
                while self.running:
                    time.sleep(1)
            except KeyboardInterrupt:
                logger.info("Shutdown requested by user")
                self.stop()
            
            return 0
            
        except Exception as e:
            logger.error(f"Application error: {e}")
            return 1
    
    def stop(self):
        """Stop the application"""
        self.running = False
        logger.info("Stopping Macroscopia platform...")
        print("\n" + "="*60)
        print("🛑 Parando o Sistema de Macroscopia...")
        print("   Obrigado por usar a plataforma!")
        print("="*60)


def main():
    """Main entry point"""
    try:
        # Check Python version
        if sys.version_info < (3, 8):
            print("❌ Python 3.8 ou superior é necessário")
            return 1
        
        # Create and run launcher
        launcher = MacroscopiaLauncher()
        return launcher.run()
        
    except KeyboardInterrupt:
        print("\n🛑 Aplicação interrompida pelo usuário")
        return 0
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        print(f"❌ Erro fatal: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())