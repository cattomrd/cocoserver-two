# ==========================================
# ARCHIVO 1: router/auth_fixed.py
# Sistema de autenticación corregido
# ==========================================

from fastapi import APIRouter, Request, Form, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from pathlib import Path
import logging
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from models.database import get_db
from models.models import User

logger = logging.getLogger(__name__)

# Setup templates
BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

router = APIRouter(
    prefix="",
    tags=["authentication_fixed"]
)

# ==========================================
# SISTEMA DE SESIONES MEJORADO
# ==========================================

# Almacén de sesiones en memoria (en producción usar Redis o BD)
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

def revoke_all_user_sessions(user_id: int) -> int:
    """Revoca todas las sesiones de un usuario específico"""
    revoked_count = 0
    tokens_to_remove = []
    
    for token, session_data in active_sessions.items():
        if session_data['user_id'] == user_id:
            tokens_to_remove.append(token)
    
    for token in tokens_to_remove:
        del active_sessions[token]
        revoked_count += 1
    
    logger.info(f"Revocadas {revoked_count} sesiones para usuario ID {user_id}")
    return revoked_count

# ==========================================
# FUNCIONES DE AUTENTICACIÓN
# ==========================================

def authenticate_user(db: Session, username: str, password: str) -> tuple[bool, Optional[User], str]:
    """
    Autentica un usuario con username y password
    Retorna: (success, user, message)
    """
    try:
        # Buscar usuario por username o email
        user = db.query(User).filter(
            (User.username == username) | (User.email == username)
        ).first()
        
        if not user:
            return False, None, "Usuario no encontrado"
        
        if not user.is_active:
            return False, None, "Usuario desactivado"
        
        # Verificar password (implementar hash en producción)
        if user.password_hash == password or user.password_hash == hashlib.sha256(password.encode()).hexdigest():
            return True, user, "Autenticación exitosa"
        else:
            return False, None, "Contraseña incorrecta"
            
    except Exception as e:
        logger.error(f"Error en authenticate_user: {str(e)}")
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
        # Autenticar usuario
        success, user, message = authenticate_user(db, username, password)
        
        if not success or not user:
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
        
        logger.info(f"Login exitoso: {username}")
        return response
        
    except Exception as e:
        logger.error(f"Error en login: {str(e)}")
        error_url = f"/login?error=Error interno del servidor&next={next}"
        return RedirectResponse(url=error_url, status_code=302)

@router.post("/api/login")
async def api_login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """API endpoint para login (para AJAX)"""
    
    try:
        # Autenticar usuario
        success, user, message = authenticate_user(db, username, password)
        
        if not success or not user:
            return JSONResponse({
                "success": False,
                "message": message
            }, status_code=401)
        
        # Crear sesión
        session_token = create_session(user.id, user.username)
        
        return JSONResponse({
            "success": True,
            "message": f"Bienvenido, {user.username}",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_admin": user.is_admin
            },
            "session_token": session_token
        })
        
    except Exception as e:
        logger.error(f"Error en API login: {str(e)}")
        return JSONResponse({
            "success": False,
            "message": "Error interno del servidor"
        }, status_code=500)

@router.get("/logout")
@router.post("/logout")
async def logout(request: Request, response: Response = None):
    """Logout completo y seguro"""
    
    # Obtener token de sesión
    session_token = request.cookies.get("session")
    
    if session_token:
        # Revocar sesión del servidor
        revoke_session(session_token)
        logger.info(f"Logout: sesión {session_token[:10]}... revocada")
    
    # Crear respuesta de redirección
    if response is None:
        response = RedirectResponse(url="/login", status_code=302)
    
    # Eliminar cookie de forma segura
    response.delete_cookie(
        key="session",
        path="/",
        domain=None  # Usar el dominio actual
    )
    
    # Headers adicionales para limpiar caché
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    return response

@router.get("/api/logout")
async def api_logout(request: Request):
    """API endpoint para logout"""
    
    session_token = request.cookies.get("session")
    
    if session_token:
        revoke_session(session_token)
    
    return JSONResponse({
        "success": True,
        "message": "Sesión cerrada correctamente"
    })

# ==========================================
# MIDDLEWARE DE VERIFICACIÓN
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
