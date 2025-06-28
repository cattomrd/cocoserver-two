# ==========================================
# ARCHIVO: models/session.py
# Modelo de sesiones para persistencia en BD
# ==========================================

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timedelta
import secrets

from models.database import Base

class UserSession(Base):
    """
    Modelo para gestionar sesiones de usuario en base de datos
    Reemplaza el sistema en memoria para mayor robustez
    """
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_token = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Información de la sesión
    created_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Información del cliente
    ip_address = Column(String(45))  # IPv6 compatible
    user_agent = Column(Text)
    device_info = Column(Text)
    
    # Relación con usuario
    user = relationship("User", back_populates="sessions")
    
    @classmethod
    def generate_token(cls) -> str:
        """Genera un token de sesión seguro"""
        return secrets.token_urlsafe(48)
    
    @classmethod
    def create_session(cls, db, user_id: int, ip_address: str = None, 
                      user_agent: str = None, hours_valid: int = 24):
        """Crear nueva sesión para usuario"""
        session_token = cls.generate_token()
        expires_at = datetime.utcnow() + timedelta(hours=hours_valid)
        
        session = cls(
            session_token=session_token,
            user_id=user_id,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        db.add(session)
        db.commit()
        db.refresh(session)
        
        return session
    
    def is_valid(self) -> bool:
        """Verificar si la sesión es válida"""
        return (
            self.is_active and 
            self.expires_at > datetime.utcnow()
        )
    
    def extend_session(self, hours: int = 24):
        """Extender la sesión por X horas"""
        self.expires_at = datetime.utcnow() + timedelta(hours=hours)
        self.last_activity = datetime.utcnow()
    
    def revoke(self):
        """Revocar la sesión"""
        self.is_active = False
    
    @classmethod
    def cleanup_expired_sessions(cls, db):
        """Limpiar sesiones expiradas (tarea de mantenimiento)"""
        expired_count = db.query(cls).filter(
            cls.expires_at < datetime.utcnow()
        ).update({cls.is_active: False})
        
        db.commit()
        return expired_count

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

# ==========================================
# ARCHIVO: tasks/session_cleanup.py
# Tarea de limpieza automática de sesiones
# ==========================================

import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models.database import get_db
from utils.session_manager import SessionManager

logger = logging.getLogger(__name__)

class SessionCleanupTask:
    """Tarea para limpiar sesiones expiradas automáticamente"""
    
    def __init__(self, interval_hours: int = 1):
        self.interval_hours = interval_hours
        self.is_running = False
    
    async def start(self):
        """Iniciar tarea de limpieza"""
        if self.is_running:
            logger.warning("Tarea de limpieza ya está ejecutándose")
            return
        
        self.is_running = True
        logger.info(f"Iniciando tarea de limpieza de sesiones (intervalo: {self.interval_hours}h)")
        
        while self.is_running:
            try:
                await self._cleanup_sessions()
                await asyncio.sleep(self.interval_hours * 3600)  # Convertir horas a segundos
            except Exception as e:
                logger.error(f"Error en tarea de limpieza: {str(e)}")
                await asyncio.sleep(300)  # Esperar 5 minutos en caso de error
    
    def stop(self):
        """Detener tarea de limpieza"""
        self.is_running = False
        logger.info("Deteniendo tarea de limpieza de sesiones")
    
    async def _cleanup_sessions(self):
        """Ejecutar limpieza de sesiones"""
        try:
            # Obtener sesión de BD
            db = next(get_db())
            
            # Limpiar sesiones expiradas
            expired_count = SessionManager.cleanup_expired_sessions(db)
            
            if expired_count > 0:
                logger.info(f"Limpieza completada: {expired_count} sesiones expiradas eliminadas")
            
            db.close()
            
        except Exception as e:
            logger.error(f"Error ejecutando limpieza: {str(e)}")

# Instancia global de la tarea
session_cleanup_task = SessionCleanupTask()

# ==========================================
# ARCHIVO: utils/auth_enhanced_v2.py
# Sistema de autenticación mejorado con BD
# ==========================================

from sqlalchemy.orm import Session
from fastapi import Request
from models.models import User
from utils.session_manager import SessionManager
import hashlib
import logging

logger = logging.getLogger(__name__)

class AuthServiceV2:
    """Servicio de autenticación mejorado con BD"""
    
    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> tuple[bool, User, str]:
        """Autenticar usuario con username/email y password"""
        try:
            # Buscar usuario por username o email
            user = db.query(User).filter(
                (User.username == username) | (User.email == username)
            ).first()
            
            if not user:
                return False, None, "Usuario no encontrado"
            
            if not user.is_active:
                return False, None, "Cuenta desactivada"
            
            # Verificar password (mejorar con bcrypt en producción)
            if AuthServiceV2._verify_password(password, user.password_hash):
                return True, user, "Autenticación exitosa"
            else:
                return False, None, "Contraseña incorrecta"
                
        except Exception as e:
            logger.error(f"Error en autenticación: {str(e)}")
            return False, None, "Error interno"
    
    @staticmethod
    def create_session(db: Session, user: User, request: Request) -> str:
        """Crear sesión para usuario autenticado"""
        try:
            # Extraer información del request
            ip_address = AuthServiceV2._get_client_ip(request)
            user_agent = request.headers.get("User-Agent", "")
            
            # Crear sesión en BD
            session_token = SessionManager.create_session(
                db=db,
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            return session_token
            
        except Exception as e:
            logger.error(f"Error creando sesión: {str(e)}")
            raise
    
    @staticmethod
    def verify_session(db: Session, session_token: str) -> dict:
        """Verificar sesión y retornar datos del usuario"""
        return SessionManager.verify_session(db, session_token)
    
    @staticmethod
    def revoke_session(db: Session, session_token: str) -> bool:
        """Revocar sesión específica"""
        return SessionManager.revoke_session(db, session_token)
    
    @staticmethod
    def logout_user(db: Session, session_token: str) -> bool:
        """Logout completo de usuario"""
        return AuthServiceV2.revoke_session(db, session_token)
    
    @staticmethod
    def logout_all_sessions(db: Session, user_id: int) -> int:
        """Cerrar todas las sesiones de un usuario"""
        return SessionManager.revoke_all_user_sessions(db, user_id)
    
    @staticmethod
    def _verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verificar password (temporal - usar bcrypt en producción)"""
        # Verificar hash SHA256 (temporal)
        sha256_hash = hashlib.sha256(plain_password.encode()).hexdigest()
        
        # Verificar tanto password plano como hasheado para compatibilidad
        return (
            plain_password == hashed_password or 
            sha256_hash == hashed_password
        )
    
    @staticmethod
    def _get_client_ip(request: Request) -> str:
        """Extraer IP del cliente considerando proxies"""
        # Verificar headers de proxy comunes
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # IP directa
        return request.client.host if request.client else "unknown"

# Instancia global del servicio
auth_service_v2 = AuthServiceV2()

print("✅ Componentes de sesiones persistentes creados")
print("📦 Archivos incluidos:")
print("- models/session.py: Modelo de sesiones en BD")
print("- utils/session_manager.py: Gestor de sesiones")
print("- tasks/session_cleanup.py: Limpieza automática")
print("- utils/auth_enhanced_v2.py: Servicio de auth mejorado")