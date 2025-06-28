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
import bcrypt

logger = logging.getLogger(__name__)

# Setup templates
BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar password con bcrypt o comparación plana"""
    try:
        # ✅ CORRECCIÓN: Cambiar 'b$' por '$2b$'
        if hashed_password.startswith('$2b$'):
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        else:
            return plain_password == hashed_password
    except Exception as e:
        logger.error(f"Error verificando password: {e}")
        return plain_password == hashed_password


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

# ==========================================
# ARCHIVO 2: middleware/auth_middleware.py  
# Middleware de autenticación corregido
# ==========================================

from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse
import logging

logger = logging.getLogger(__name__)

class AuthMiddleware:
    """Middleware de autenticación mejorado"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request = Request(scope, receive)
        
        # Rutas públicas que no requieren autenticación
        public_paths = [
            "/login",
            "/api/login", 
            "/logout",
            "/api/logout",
            "/static/",
            "/favicon.ico",
            # API específicas para dispositivos Raspberry Pi
            "/api/devices",
            "/api/raspberry/",
            # Documentación de la API
            "/docs",
            "/redoc",
            "/openapi.json"
        ]
        
        path = request.url.path
        
        # Verificar si es una ruta pública
        is_public = any(path.startswith(public_path) for public_path in public_paths)
        
        if is_public:
            await self.app(scope, receive, send)
            return
        
        # Verificar autenticación para rutas protegidas
        session_token = request.cookies.get("session")
        
        if not session_token:
            logger.warning(f"Acceso no autorizado a {path} - no hay token de sesión")
            # Redirigir a login para rutas de UI
            if path.startswith("/ui/") or path == "/":
                response = RedirectResponse(url=f"/login?next={path}", status_code=302)
                await response(scope, receive, send)
                return
            else:
                # Para APIs devolver 401
                response = JSONResponse({"error": "No autorizado"}, status_code=401)
                await response(scope, receive, send)
                return
        
        # Verificar validez de la sesión
        from router.auth_fixed import verify_session
        session_data = verify_session(session_token)
        
        if not session_data:
            logger.warning(f"Acceso no autorizado a {path} - sesión inválida")
            
            # Crear respuesta y limpiar cookie inválida
            if path.startswith("/ui/") or path == "/":
                response = RedirectResponse(url=f"/login?next={path}", status_code=302)
            else:
                response = JSONResponse({"error": "Sesión expirada"}, status_code=401)
            
            # Limpiar cookie inválida
            response.delete_cookie(key="session", path="/")
            await response(scope, receive, send)
            return
        
        # Usuario autenticado, continuar con la request
        await self.app(scope, receive, send)

# ==========================================
# ARCHIVO 3: static/js/auth_fixed.js
# JavaScript de autenticación corregido
# ==========================================

"""
class AuthManagerFixed {
    constructor() {
        this.tokenKey = 'auth_token';
        this.userKey = 'auth_user';
        this.isInitialized = false;
        
        this.init();
    }
    
    init() {
        if (this.isInitialized) return;
        
        console.log('🔐 Inicializando AuthManager...');
        
        // Verificar estado de autenticación al cargar
        this.checkAuthStatus();
        
        // Configurar interceptores de fetch
        this.setupFetchInterceptor();
        
        // Configurar logout automático en tabs
        this.setupStorageListener();
        
        this.isInitialized = true;
        console.log('✅ AuthManager inicializado');
    }
    
    /**
     * Verifica el estado de autenticación actual
     */
    checkAuthStatus() {
        const token = this.getToken();
        const user = this.getUser();
        
        if (token && user) {
            console.log('👤 Usuario autenticado:', user.username);
            this.updateAuthUI(true, user);
        } else {
            console.log('🚫 Usuario no autenticado');
            this.updateAuthUI(false);
            
            // Solo redirigir si estamos en una página protegida
            if (this.isProtectedPage()) {
                this.redirectToLogin();
            }
        }
    }
    
    /**
     * Verifica si la página actual requiere autenticación
     */
    isProtectedPage() {
        const path = window.location.pathname;
        const publicPaths = ['/login', '/register', '/logout'];
        
        return !publicPaths.some(publicPath => path.startsWith(publicPath));
    }
    
    /**
     * Configurar interceptor de fetch para manejo automático de autenticación
     */
    setupFetchInterceptor() {
        const originalFetch = window.fetch;
        
        window.fetch = async (url, options = {}) => {
            // Agregar headers de autenticación automáticamente
            const token = this.getToken();
            if (token && !options.headers?.['Authorization']) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                };
            }
            
            try {
                const response = await originalFetch(url, options);
                
                // Manejar respuestas 401 automáticamente
                if (response.status === 401) {
                    console.warn('🚫 Token expirado o inválido');
                    this.handleTokenExpired();
                    
                    return new Response(
                        JSON.stringify({ error: 'Sesión expirada' }), 
                        {
                            status: 401,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                }
                
                return response;
            } catch (error) {
                console.error('❌ Error en fetch:', error);
                throw error;
            }
        };
    }
    
    /**
     * Configurar listener para cambios en localStorage entre pestañas
     */
    setupStorageListener() {
        window.addEventListener('storage', (event) => {
            if (event.key === this.tokenKey || event.key === this.userKey) {
                if (!event.newValue) {
                    // Token eliminado en otra pestaña, hacer logout
                    console.log('🔄 Logout detectado en otra pestaña');
                    this.handleTokenExpired();
                }
            }
        });
    }
    
    /**
     * Manejar token expirado o inválido
     */
    handleTokenExpired() {
        console.log('⏰ Manejando token expirado...');
        
        // Limpiar datos locales
        this.clearAuth();
        
        // Actualizar UI
        this.updateAuthUI(false);
        
        // Redirigir solo si estamos en página protegida
        if (this.isProtectedPage()) {
            this.redirectToLogin();
        }
    }
    
    /**
     * Guardar datos de autenticación
     */
    saveAuth(authData) {
        if (!authData) {
            console.error('❌ Datos de autenticación inválidos');
            return false;
        }
        
        try {
            // Guardar token
            if (authData.session_token) {
                localStorage.setItem(this.tokenKey, authData.session_token);
            }
            
            // Guardar datos de usuario
            if (authData.user) {
                localStorage.setItem(this.userKey, JSON.stringify(authData.user));
            }
            
            console.log('✅ Datos de autenticación guardados');
            this.updateAuthUI(true, authData.user);
            
            return true;
        } catch (error) {
            console.error('❌ Error guardando autenticación:', error);
            return false;
        }
    }
    
    /**
     * Limpiar datos de autenticación
     */
    clearAuth() {
        console.log('🧹 Limpiando datos de autenticación...');
        
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        
        this.updateAuthUI(false);
    }
    
    /**
     * Obtener token actual
     */
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }
    
    /**
     * Obtener datos de usuario
     */
    getUser() {
        try {
            const userData = localStorage.getItem(this.userKey);
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('❌ Error obteniendo datos de usuario:', error);
            return null;
        }
    }
    
    /**
     * Verificar si está autenticado
     */
    isAuthenticated() {
        return !!(this.getToken() && this.getUser());
    }
    
    /**
     * Actualizar interfaz según estado de autenticación
     */
    updateAuthUI(isAuth = false, user = null) {
        console.log('🎨 Actualizando UI de autenticación:', isAuth);
        
        // Elementos que solo se muestran cuando está autenticado
        const authElements = document.querySelectorAll('.auth-only');
        // Elementos que solo se muestran cuando NO está autenticado  
        const noAuthElements = document.querySelectorAll('.no-auth-only');
        // Elementos para mostrar nombre de usuario
        const userNameElements = document.querySelectorAll('.user-name');
        
        // Mostrar/ocultar elementos según autenticación
        authElements.forEach(el => {
            el.style.display = isAuth ? '' : 'none';
        });
        
        noAuthElements.forEach(el => {
            el.style.display = isAuth ? 'none' : '';
        });
        
        // Actualizar nombre de usuario
        if (user && userNameElements.length > 0) {
            userNameElements.forEach(el => {
                el.textContent = user.username || user.email || 'Usuario';
            });
        }
        
        // Mostrar elementos de admin si corresponde
        const adminElements = document.querySelectorAll('.admin-only');
        if (isAuth && user && user.is_admin) {
            adminElements.forEach(el => el.style.display = '');
        } else {
            adminElements.forEach(el => el.style.display = 'none');
        }
    }
    
    /**
     * Redirigir a página de login
     */
    redirectToLogin() {
        const currentPath = window.location.pathname;
        const nextParam = currentPath !== '/login' ? `?next=${encodeURIComponent(currentPath)}` : '';
        
        console.log('🔀 Redirigiendo a login...');
        window.location.href = `/login${nextParam}`;
    }
    
    /**
     * Hacer logout
     */
    async logout() {
        console.log('🚪 Iniciando logout...');
        
        try {
            // Llamar al endpoint de logout del servidor
            await fetch('/api/logout', {
                method: 'GET',
                credentials: 'include' // Incluir cookies
            });
        } catch (error) {
            console.warn('⚠️ Error en logout del servidor:', error);
        }
        
        // Limpiar datos locales
        this.clearAuth();
        
        // Redirigir a login
        window.location.href = '/login';
    }
    
    /**
     * Login con credenciales
     */
    async login(username, password) {
        console.log('🔑 Intentando login para:', username);
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    username: username,
                    password: password
                }),
                credentials: 'include' // Incluir cookies
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Login exitoso');
                this.saveAuth(data);
                return { success: true, message: data.message };
            } else {
                console.warn('❌ Login fallido:', data.message);
                return { success: false, message: data.message };
            }
            
        } catch (error) {
            console.error('❌ Error en login:', error);
            return { success: false, message: 'Error de conexión' };
        }
    }
}

// Crear instancia global
const authManager = new AuthManagerFixed();

// Configurar eventos globales
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM cargado, configurando eventos de auth...');
    
    // Botón de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            authManager.logout();
        });
    }
    
    // Formulario de login si existe
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username')?.value;
            const password = document.getElementById('password')?.value;
            
            if (!username || !password) {
                alert('Por favor, completa todos los campos');
                return;
            }
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Iniciando sesión...';
                
                const result = await authManager.login(username, password);
                
                if (result.success) {
                    // Redirigir a la página siguiente
                    const urlParams = new URLSearchParams(window.location.search);
                    const nextUrl = urlParams.get('next') || '/';
                    window.location.href = nextUrl;
                } else {
                    alert(result.message || 'Error de autenticación');
                }
                
            } catch (error) {
                console.error('Error en login:', error);
                alert('Error de conexión');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
});

// Exponer globalmente
window.authManager = authManager;
"""

# ==========================================
# ARCHIVO 4: Actualización del main.py
# ==========================================

"""
# Agregar al main.py existente:

# Importar el middleware corregido
from middleware.auth_middleware import AuthMiddleware

# Agregar el middleware a la aplicación (después de crear app)
app.add_middleware(AuthMiddleware)

# Actualizar la función is_authenticated para usar el nuevo sistema
def is_authenticated(request: Request) -> bool:
    from router.auth_fixed import verify_session
    
    session_cookie = request.cookies.get("session")
    if not session_cookie:
        return False
    
    session_data = verify_session(session_cookie)
    return session_data is not None
"""

print("✅ Sistema de autenticación corregido creado")
print("📋 Archivos a crear/actualizar:")
print("1. router/auth_fixed.py - Sistema de autenticación corregido")
print("2. middleware/auth_middleware.py - Middleware de autenticación")  
print("3. static/js/auth_fixed.js - JavaScript de autenticación corregido")
print("4. Actualizar main.py con el nuevo middleware")

print("\n🔧 Pasos para implementar:")
print("1. Crear los archivos en las ubicaciones indicadas")
print("2. Actualizar las importaciones en main.py")
print("3. Reemplazar router de auth actual con auth_fixed")
print("4. Probar login y logout para verificar funcionamiento")