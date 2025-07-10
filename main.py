# main.py - Versión corregida y limpia

from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse, JSONResponse
from dotenv import load_dotenv
import logging
import os
import uvicorn

load_dotenv()

# Importar los modelos para crear las tablas
from models import models
from models.database import engine

# Importar los routers
from router import videos, playlists, raspberry, ui, devices, device_playlists, services_enhanced as services, device_service_api,playlists_api
from router.client_api import router as client_api_router
from router.auth import router as auth_router
from router.users import router as users_router
from router.playlist_checker_api import router as playlist_checker_router
from router.ui_auth import router as ui_auth_router
from router.tiendas import router as tiendas_router
from utils.list_checker import start_playlist_checker
from utils.ping_checker import start_background_ping_checker

# Crear las tablas en la base de datos
models.Base.metadata.create_all(bind=engine)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Crear la aplicación FastAPI
app = FastAPI(
    title="API de Gestión de Videos",
    description="API para gestionar videos y listas de reproducción para Raspberry Pi",
    version="1.0.0"
)

# ==========================================
# FUNCIÓN DE AUTENTICACIÓN CORREGIDA
# ==========================================

def is_authenticated(request: Request) -> bool:
    """Verificar si el usuario tiene una sesión válida por cookie - VERSIÓN CORREGIDA"""
    from router.auth import verify_session  # ✅ CORRECCIÓN: Importar del archivo correcto
    
    session_token = request.cookies.get("session")
    
    if not session_token:
        print("🚫 No hay token de sesión")
        return False
    
    # Usar la función verify_session del sistema de autenticación corregido
    session_data = verify_session(session_token)
    is_valid = session_data is not None
    
    # Log para debug
    if is_valid:
        username = session_data.get('username', 'unknown')
        print(f"🔐 Sesión válida para: {username}")
    else:
        print(f"🚫 Sesión inválida o expirada: {session_token[:10]}...")
    
    return is_valid

# ==========================================
# RUTAS DE REDIRECCIÓN
# ==========================================

@app.get("/login")
async def redirect_login():
    """Redireccionar /login a /ui/login"""
    return RedirectResponse(url="/ui/login", status_code=301)

@app.get("/")
async def redirect_root(request: Request):
    """Redireccionar / según el estado de autenticación"""
    if is_authenticated(request):
        return RedirectResponse(url="/ui/dashboard", status_code=302)
    else:
        return RedirectResponse(url="/ui/login", status_code=302)

# ==========================================
# DASHBOARD CORREGIDO
# ==========================================

@app.get("/ui/dashboard")
async def dashboard(request: Request):
    """Dashboard principal - VERSIÓN CORREGIDA"""
    
    # Verificar autenticación usando la función corregida
    if not is_authenticated(request):
        print("❌ Dashboard: Usuario no autenticado, redirigiendo a login")
        return RedirectResponse(url="/ui/login", status_code=302)
    
    print("✅ Dashboard: Usuario autenticado, mostrando dashboard")
    
    # Obtener datos de usuario desde la sesión
    from router.auth import verify_session  # ✅ CORRECCIÓN: Mismo archivo que is_authenticated
    session_token = request.cookies.get("session")
    session_data = verify_session(session_token) if session_token else None
    
    user_data = {
        "username": session_data.get('username', 'Usuario') if session_data else 'Usuario',
        "is_admin": True  # Por ahora asumir admin
    }
    
    # Templates para el dashboard
    from fastapi.templating import Jinja2Templates
    templates = Jinja2Templates(directory="templates")
    
    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "title": "Dashboard",
            "user": user_data
        }
    )

# ==========================================
# CONFIGURACIÓN DE MIDDLEWARE
# ==========================================

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS
# ==========================================

# Crear directorios si no existen
UPLOAD_DIR = "uploads"
PLAYLIST_DIR = "playlists"
STATIC_DIR = "static"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PLAYLIST_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/playlists", StaticFiles(directory=PLAYLIST_DIR), name="playlists")

templates = Jinja2Templates(directory='templates')

# ==========================================
# INCLUIR ROUTERS
# ==========================================

app.include_router(ui_auth_router)      # /ui/login, /ui/register, etc.
app.include_router(auth_router)         # Rutas de autenticación API originales
app.include_router(users_router)        # Gestión de usuarios original
app.include_router(videos.router)
app.include_router(playlists.router)
app.include_router(playlists_api.router)
app.include_router(raspberry.router)
app.include_router(ui.router)
app.include_router(devices.router)
app.include_router(device_playlists.router)
app.include_router(services.router)
app.include_router(device_service_api.router)
app.include_router(playlist_checker_router)
app.include_router(client_api_router)
app.include_router(tiendas_router)

# ==========================================
# MIDDLEWARE DE AUTENTICACIÓN UNIFICADO
# ==========================================

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """
    Middleware de autenticación que maneja cookies de sesión
    """
    path = request.url.path
    
    # Rutas públicas que no requieren autenticación
    public_paths = [
        "/login",
        "/ui/login", 
        "/ui/register",
        "/ui/logout",
        "/static/",
        "/docs", 
        "/redoc", 
        "/openapi.json",
        # ✅ Rutas de autenticación API
        "/api/login",
        "/api/logout",
        "/test-auth",
        "/debug/sessions",
        # Rutas existentes
        "/api/devices",
        "/api/raspberry/",
        "/api/videos"
        "api/tiendas/"
    ]
    
    try:
        # Si es una ruta pública, continuar sin verificación
        if any(path.startswith(public_path) for public_path in public_paths):
            response = await call_next(request)
            return response
        
        # Para rutas protegidas de UI, verificar autenticación por cookie
        if path.startswith("/ui/"):
            if is_authenticated(request):
                response = await call_next(request)
                return response
            else:
                return RedirectResponse(url="/ui/login", status_code=302)
        
        # Para rutas API protegidas
        elif path.startswith("/api/"):
            if is_authenticated(request):
                response = await call_next(request)
                return response
            else:
                return JSONResponse(
                    content={"detail": "Token de acceso requerido"},
                    status_code=401,
                    headers={"WWW-Authenticate": "Bearer"}
                )
        
        # Continuar con la solicitud para cualquier otra ruta
        response = await call_next(request)
        return response
    
    except Exception as e:
        logger.error(f"Error en auth_middleware: {str(e)}")
        
        if path.startswith("/api/"):
            return JSONResponse(
                content={"detail": "Error de servidor: " + str(e)},
                status_code=500
            )
        else:
            return JSONResponse(
                content={"detail": "Error de servidor"},
                status_code=500
            )

start_playlist_checker(app)
start_background_ping_checker(app)

# ==========================================
# EVENTOS DE APLICACIÓN
# ==========================================

@app.on_event("startup")
async def startup_event():
    logger.info("Aplicación iniciada correctamente")

# ==========================================
# PUNTO DE ENTRADA
# ==========================================

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)