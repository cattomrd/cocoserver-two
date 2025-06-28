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