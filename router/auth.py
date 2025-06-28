# router/auth.py - VERSIÓN SIMPLIFICADA QUE FUNCIONA
# Reemplaza completamente tu archivo router/auth.py actual

from fastapi import APIRouter, Request, Form, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from pathlib import Path
import logging
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
import bcrypt

from models.database import get_db
from models.models import User

logger = logging.getLogger(__name__)

# Setup templates
BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

router = APIRouter(tags=["authentication"])

# ==========================================
# SISTEMA DE SESIONES SIMPLE
# ==========================================

# Almacén de sesiones en memoria
active_sessions = {}

def generate_session_token() -> str:
    """Genera un token de sesión seguro"""
    return secrets.token_urlsafe(32)

def create_session(user_id: int, username: str) -> str:
    """Crea una nueva sesión para el usuario"""
    session_token = generate_session_token()
    session_data = {
        'user_id': user_id,
        'username': username,
        'created_at': datetime.utcnow(),
        'last_activity': datetime.utcnow(),
        'expires_at': datetime.utcnow() + timedelta(hours=24)
    }
    active_sessions[session_token] = session_data
    logger.info(f"Sesión creada para usuario {username}: {session_token[:10]}...")
    return session_token

def verify_session(session_token: str) -> Optional[dict]:
    """Verifica si una sesión es válida"""
    if not session_token or session_token not in active_sessions:
        return None
    
    session_data = active_sessions[session_token]
    
    # Verificar si la sesión no ha expirado
    if datetime.utcnow() > session_data['expires_at']:
        logger.info(f"Sesión expirada eliminada: {session_token[:10]}...")
        del active_sessions[session_token]
        return None
    
    # Actualizar última actividad
    session_data['last_activity'] = datetime.utcnow()
    return session_data

def revoke_session(session_token: str) -> bool:
    """Revoca una sesión específica"""
    if session_token in active_sessions:
        del active_sessions[session_token]
        logger.info(f"Sesión revocada: {session_token[:10]}...")
        return True
    return False

# ==========================================
# FUNCIÓN DE AUTENTICACIÓN - MISMA LÓGICA DEL SCRIPT
# ==========================================

def verify_password(password: str, hashed: str) -> bool:
    """Verificar contraseña - MISMA LÓGICA QUE EL SCRIPT QUE FUNCIONA"""
    try:
        if hashed.startswith('$2b$'):
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
        else:
            # Contraseña en texto plano o SHA256
            return password == hashed or hashed == hashlib.sha256(password.encode()).hexdigest()
    except Exception as e:
        logger.error(f"Error verificando contraseña: {e}")
        return False

def authenticate_user(db: Session, username: str, password: str) -> tuple[bool, Optional[User], str]:
    """
    Autentica un usuario - MISMA LÓGICA QUE EL SCRIPT QUE FUNCIONA
    """
    try:
        logger.info(f"🔐 Intento de autenticación para: {username}")
        
        # Buscar usuario por username o email
        user = db.query(User).filter(
            (User.username == username) | (User.email == username)
        ).first()
        
        if not user:
            logger.warning(f"❌ Usuario no encontrado: {username}")
            return False, None, "Usuario no encontrado"
        
        logger.info(f"👤 Usuario encontrado: {user.username} ({user.email})")
        logger.info(f"🏃 Estado: {'Activo' if user.is_active else 'Inactivo'}")
        logger.info(f"👑 Admin: {'Sí' if user.is_admin else 'No'}")
        
        if not user.is_active:
            logger.warning(f"❌ Usuario desactivado: {username}")
            return False, None, "Usuario desactivado"
        
        # Verificar contraseña usando la misma lógica del script
        if verify_password(password, user.password_hash):
            logger.info(f"✅ Contraseña correcta para: {username}")
            return True, user, "Autenticación exitosa"
        else:
            logger.warning(f"❌ Contraseña incorrecta para: {username}")
            logger.debug(f"Hash almacenado: {user.password_hash[:30] if user.password_hash else 'None'}...")
            return False, None, "Contraseña incorrecta"
            
    except Exception as e:
        logger.error(f"❌ Error en authenticate_user: {str(e)}")
        return False, None, "Error interno de autenticación"

# ==========================================
# RUTAS DE AUTENTICACIÓN
# ==========================================

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, error: str = None, next: str = "/"):
    """Página de login"""
    
    # Si ya está autenticado, redirigir
    session_token = request.cookies.get("session")
    if session_token and verify_session(session_token):
        logger.info("Usuario ya autenticado, redirigiendo...")
        return RedirectResponse(url=next, status_code=302)
    
    context = {
        "request": request,
        "title": "Iniciar Sesión",
        "error": error,
        "next": next
    }
    
    return templates.TemplateResponse("login.html", context)

@router.post("/login")
async def login_submit(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    next: str = Form(default="/"),
    db: Session = Depends(get_db)
):
    """Procesa el login del usuario"""
    
    try:
        logger.info(f"📝 Login form submit para: {username}")
        
        # Autenticar usuario
        success, user, message = authenticate_user(db, username, password)
        
        if not success or not user:
            logger.warning(f"❌ Login fallido: {username} - {message}")
            error_url = f"/login?error={message}&next={next}"
            return RedirectResponse(url=error_url, status_code=302)
        
        # Crear sesión
        session_token = create_session(user.id, user.username)
        
        # Crear respuesta con cookie
        response = RedirectResponse(url=next, status_code=302)
        response.set_cookie(
            key="session",
            value=session_token,
            httponly=True,
            max_age=86400,  # 24 horas
            path="/",
            secure=False,  # Cambiar a True en producción con HTTPS
            samesite="lax"
        )
        
        logger.info(f"✅ Login exitoso: {username}")
        return response
        
    except Exception as e:
        logger.error(f"❌ Error en login: {str(e)}")
        error_url = f"/login?error=Error interno del servidor&next={next}"
        return RedirectResponse(url=error_url, status_code=302)

@router.post("/api/login")
async def api_login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """API endpoint para login (para AJAX) - VERSIÓN CON COOKIE"""
    
    try:
        logger.info(f"🔐 API login para: {username}")
        
        # Autenticar usuario usando la misma función que funciona
        success, user, message = authenticate_user(db, username, password)
        
        if not success or not user:
            logger.warning(f"❌ API login fallido: {username} - {message}")
            return JSONResponse({
                "success": False,
                "message": message
            }, status_code=401)
        
        # Crear sesión
        session_token = create_session(user.id, user.username)
        
        logger.info(f"✅ API login exitoso: {username}")
        
        # ⭐ CREAR RESPUESTA CON COOKIE
        response_data = {
            "success": True,
            "message": f"Bienvenido, {user.username}",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_admin": user.is_admin
            },
            "session_token": session_token
        }
        
        # Crear respuesta JSON
        response = JSONResponse(response_data)
        
        # ⭐ CONFIGURAR COOKIE DE SESIÓN
        response.set_cookie(
            key="session",
            value=session_token,
            httponly=True,
            max_age=86400,  # 24 horas
            path="/",
            secure=False,  # Cambiar a True en producción con HTTPS
            samesite="lax"
        )
        
        logger.info(f"🍪 Cookie de sesión configurada: {session_token[:10]}...")
        
        return response
        
    except Exception as e:
        logger.error(f"❌ Error en API login: {str(e)}")
        return JSONResponse({
            "success": False,
            "message": "Error interno del servidor"
        }, status_code=500)
        
@router.get("/logout")
@router.post("/logout")
async def logout(request: Request):
    """Logout completo y seguro"""
    
    # Obtener token de sesión
    session_token = request.cookies.get("session")
    
    if session_token:
        # Revocar sesión del servidor
        revoke_session(session_token)
        logger.info(f"🚪 Logout: sesión {session_token[:10]}... revocada")
    
    # Crear respuesta de redirección
    response = RedirectResponse(url="/login", status_code=302)
    
    # Eliminar cookie de forma segura
    response.delete_cookie(key="session", path="/")
    
    return response

@router.get("/api/logout")
async def api_logout(request: Request):
    """API endpoint para logout"""
    
    session_token = request.cookies.get("session")
    
    if session_token:
        revoke_session(session_token)
        logger.info(f"🚪 API logout: sesión {session_token[:10]}... revocada")
    
    return JSONResponse({
        "success": True,
        "message": "Sesión cerrada correctamente"
    })

# ==========================================
# FUNCIÓN PARA VERIFICAR AUTENTICACIÓN (para main.py)
# ==========================================

def get_current_user_from_request(request: Request, db: Session) -> Optional[dict]:
    """Obtiene el usuario actual desde la request"""
    
    session_token = request.cookies.get("session")
    if not session_token:
        return None
    
    session_data = verify_session(session_token)
    if not session_data:
        return None
    
    # Obtener datos actualizados del usuario desde la BD
    user = db.query(User).filter(User.id == session_data['user_id']).first()
    if not user or not user.is_active:
        # Si el usuario no existe o está desactivado, revocar sesión
        revoke_session(session_token)
        return None
    
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'is_admin': user.is_admin,
        'is_active': user.is_active,
        'session_token': session_token
    }

# Función para usar en main.py
def is_authenticated(request: Request) -> bool:
    """Verificar si el usuario tiene una sesión válida por cookie"""
    session_token = request.cookies.get("session")
    return session_token and verify_session(session_token) is not None

# ==========================================
# RUTA DE DEBUG (TEMPORAL)
# ==========================================

@router.get("/debug/sessions")
async def debug_sessions(request: Request):
    """Ver sesiones activas - SOLO PARA DEBUG"""
    
    session_token = request.cookies.get("session")
    current_session = verify_session(session_token) if session_token else None
    
    return JSONResponse({
        "total_sessions": len(active_sessions),
        "current_session_valid": bool(current_session),
        "current_session_token": session_token[:10] + "..." if session_token else None,
        "current_session_data": current_session,
        "all_sessions": {
            token[:10] + "...": {
                "username": data["username"],
                "created_at": data["created_at"].isoformat(),
                "expires_at": data["expires_at"].isoformat()
            } for token, data in active_sessions.items()
        }
    })

# ==========================================
# RUTA DE TEST DE AUTENTICACIÓN
# ==========================================

@router.post("/test-auth")
async def test_auth_endpoint(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """Endpoint para probar autenticación - SOLO PARA DEBUG"""
    
    success, user, message = authenticate_user(db, username, password)
    
    return JSONResponse({
        "success": success,
        "message": message,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin,
            "is_active": user.is_active
        } if user else None
    })