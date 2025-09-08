"""
Configuração da base de dados
"""
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from databases import Database
from core.config import settings


# Motor da base de dados
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}  # Necessário para SQLite
)

# Base para os modelos
Base = declarative_base()

# Metadata
metadata = MetaData()

# Database instance para async operations
database = Database(settings.database_url)

# Session maker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_database_session():
    """Dependência para obter sessão da base de dados"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def connect_db():
    """Conecta à base de dados"""
    await database.connect()


async def disconnect_db():
    """Desconecta da base de dados"""
    await database.disconnect()


def create_tables():
    """Cria todas as tabelas"""
    Base.metadata.create_all(bind=engine)