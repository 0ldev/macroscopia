"""
Serviço de logs
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from models.log import Log
from models.schemas import LogCreate


class LogService:
    """Serviço para operações com logs"""
    
    @staticmethod
    async def create_log(
        db: Session, 
        action: str, 
        details: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> Log:
        """Cria novo log"""
        db_log = Log(
            action=action,
            details=details,
            user_id=user_id
        )
        
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        return db_log
    
    @staticmethod
    def get_logs(
        db: Session, 
        skip: int = 0, 
        limit: int = 100,
        user_id: Optional[int] = None
    ) -> List[Log]:
        """Lista logs com filtro opcional por usuário"""
        query = db.query(Log)
        
        if user_id:
            query = query.filter(Log.user_id == user_id)
        
        return query.order_by(Log.timestamp.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_log_by_id(db: Session, log_id: int) -> Optional[Log]:
        """Busca log por ID"""
        return db.query(Log).filter(Log.id == log_id).first()