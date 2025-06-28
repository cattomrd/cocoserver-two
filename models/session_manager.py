# ==========================================
# ARCHIVO: utils/session_manager.py
# Gestor de sesiones con BD
# ==========================================

from sqlalchemy.orm import Session
from models.session import UserSession
from models.models import User
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class SessionManager:
    """Gestor de sesiones con persistencia en base de datos"""
    
    @staticmethod
    def create_session(db: Session, user_id: int, ip_address: str = None, 
                      user_agent: str = None) -> str:
        """Crear nueva sesión de usuario"""
        try:
            # Limpiar sesiones antiguas del usuario (máximo 5 sesiones activas)
            SessionManager._cleanup_user_sessions(db, user_id, max_sessions=5)
            
            # Crear nueva sesión
            session = UserSession.create_session(
                db=db,
                user_id=user_id,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            logger.info(f"Sesión creada para usuario {user_id}: {session.session_token[:10]}...")
            return session.session_token
            
        except Exception as e:
            logger.error(f"Error creando sesión: {str(e)}")
            raise
    
    @staticmethod
    def verify_session(db: Session, session_token: str) -> dict:
        """Verificar validez de sesión y retornar datos"""
        try:
            session = db.query(UserSession).filter(
                UserSession.session_token == session_token,
                UserSession.is_active == True
            ).first()
            
            if not session:
                return None
            
            if not session.is_valid():
                # Sesión expirada, revocarla
                session.revoke()
                db.commit()
                logger.info(f"Sesión expirada revocada: {session_token[:10]}...")
                return None
            
            # Actualizar última actividad
            session.last_activity = datetime.utcnow()
            db.commit()
            
            # Retornar datos de la sesión
            return {
                'session_id': session.id,
                'user_id': session.user_id,
                'username': session.user.username,
                'email': session.user.email,
                'is_admin': session.user.is_admin,
                'created_at': session.created_at,
                'last_activity': session.last_activity
            }
            
        except Exception as e:
            logger.error(f"Error verificando sesión: {str(e)}")
            return None
    
    @staticmethod
    def revoke_session(db: Session, session_token: str) -> bool:
        """Revocar sesión específica"""
        try:
            session = db.query(UserSession).filter(
                UserSession.session_token == session_token
            ).first()
            
            if session:
                session.revoke()
                db.commit()
                logger.info(f"Sesión revocada: {session_token[:10]}...")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error revocando sesión: {str(e)}")
            return False
    
    @staticmethod
    def revoke_all_user_sessions(db: Session, user_id: int) -> int:
        """Revocar todas las sesiones de un usuario"""
        try:
            revoked_count = db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active == True
            ).update({UserSession.is_active: False})
            
            db.commit()
            logger.info(f"Revocadas {revoked_count} sesiones para usuario {user_id}")
            return revoked_count
            
        except Exception as e:
            logger.error(f"Error revocando sesiones de usuario: {str(e)}")
            return 0
    
    @staticmethod
    def _cleanup_user_sessions(db: Session, user_id: int, max_sessions: int = 5):
        """Limpiar sesiones antiguas del usuario"""
        try:
            # Obtener sesiones activas ordenadas por última actividad
            active_sessions = db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active == True
            ).order_by(UserSession.last_activity.desc()).all()
            
            # Si hay más sesiones que el máximo permitido, revocar las más antiguas
            if len(active_sessions) >= max_sessions:
                sessions_to_revoke = active_sessions[max_sessions-1:]
                for session in sessions_to_revoke:
                    session.revoke()
                
                db.commit()
                logger.info(f"Limpiadas {len(sessions_to_revoke)} sesiones antiguas para usuario {user_id}")
                
        except Exception as e:
            logger.error(f"Error limpiando sesiones: {str(e)}")
    
    @staticmethod
    def cleanup_expired_sessions(db: Session) -> int:
        """Tarea de mantenimiento: limpiar sesiones expiradas"""
        try:
            expired_count = UserSession.cleanup_expired_sessions(db)
            logger.info(f"Limpiadas {expired_count} sesiones expiradas")
            return expired_count
        except Exception as e:
            logger.error(f"Error limpiando sesiones expiradas: {str(e)}")
            return 0
    
    @staticmethod
    def get_user_sessions(db: Session, user_id: int):
        """Obtener sesiones activas de un usuario"""
        try:
            sessions = db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active == True
            ).order_by(UserSession.last_activity.desc()).all()
            
            return [{
                'id': s.id,
                'created_at': s.created_at,
                'last_activity': s.last_activity,
                'ip_address': s.ip_address,
                'user_agent': s.user_agent[:100] if s.user_agent else None,  # Truncar
                'is_current': s.session_token == session_token if 'session_token' in locals() else False
            } for s in sessions]
            
        except Exception as e:
            logger.error(f"Error obteniendo sesiones de usuario: {str(e)}")
            return []