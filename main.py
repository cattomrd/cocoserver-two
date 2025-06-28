# main.py - Versión con autenticación por cookies y restricciones de IP

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
from router.auth import router as auth_router
from router.users import router as users_router
from router.playlist_checker_api import router as playlist_checker_router
from router.ui_auth import router as ui_auth_router
from utils.list_checker import start_playlist_checker
from utils.ping_checker import start_background_ping_checker

# Importar el middleware de restricción de IP
from utils.ip_restrictions import IPRestrictionPresets

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

# ========================================
# CONFIGURACIÓN DE RESTRICCIONES DE IP
# ========================================

# Configurar las redes permitidas para acceder a la documentación
ALLOWED_NETWORKS = [
    "192.168.36.128/25",  # Red específica mencionada
    "127.0.0.0/8",        # Localhost
    "10.0.0.0/8",         # Red privada clase A
    "172.16.0.0/12",      # Red privada clase B
]

# IPs específicas permitidas (opcional)
ALLOWED_IPS = [
    "127.0.0.1",
    "::1",  # IPv6 localhost
]

# Rutas que requieren restricción de IP
RESTRICTED_PATHS = [
    "/docs",           # Swagger UI
    "/redoc",          # ReDoc
    "/openapi.json",   # OpenAPI schema
    "/api/admin",      # APIs de administración (si existen)
]

# Configurar el middleware de restricción de IP
ip_restriction_middleware = IPRestrictionPresets.documentation_only(
    allowed_networks=ALLOWED_NETWORKS,
    allowed_ips=ALLOWED_IPS
)

# ========================================
# CONFIGURACIÓN DE MIDDLEWARES
# ========================================

# IMPORTANTE: El orden de los middlewares importa
# Se ejecutan en orden LIFO (Last In, First Out)

# 1. Middleware de restricción de IP (se ejecuta primero)
app.middleware("http")(ip_restriction_middleware)

# 2. Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================
# FUNCIONES DE UTILIDAD
# ========================================

def is_authenticated(request: Request) -> bool:
    """Verificar si el usuario tiene una sesión válida por cookie"""
    session_cookie = request.cookies.get("session")
    if session_cookie and len(session_cookie) > 10:
        # Verificación básica - en producción validar JWT o sesión en BD
        return True
    return False

# ========================================
# CONFIGURACIÓN DE DIRECTORIOS Y ARCHIVOS ESTÁTICOS
# ========================================

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

# ========================================
# RUTAS DE REDIRECCIÓN PRINCIPALES
# ========================================

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

@app.get("/ui/dashboard")
async def dashboard(request: Request):
    """Dashboard principal"""
    if not is_authenticated(request):
        return RedirectResponse(url="/ui/login", status_code=302)
    
    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "title": "Dashboard",
            "user": {"username": "admin", "is_admin": True}
        }
    )

# ========================================
# MIDDLEWARE DE AUTENTICACIÓN
# ========================================

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
        "/api/videos",
        "/api/devices",
        "/api/raspberry/",
        "/api/playlists/"
    ]
    
    try:
        # Si es una ruta pública, continuar sin verificación
        if any(path.startswith(public_path) for public_path in public_paths):
            response = await call_next(request)
            return response
        
        # Para rutas protegidas, verificar autenticación
        if path.startswith("/ui/"):
            if not is_authenticated(request):
                return RedirectResponse(url="/ui/login", status_code=302)
        
        # Para APIs protegidas, verificar token en header
        elif path.startswith("/api/"):
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                # Permitir ciertas APIs sin autenticación
                allowed_api_paths = ["/api/videos", "/api/devices", "/api/raspberry/"]
                if not any(path.startswith(api_path) for api_path in allowed_api_paths):
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Token de autorización requerido"}
                    )
        
        response = await call_next(request)
        return response
        
    except Exception as e:
        logger.error(f"Error en middleware de autenticación: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Error interno del servidor"}
        )

# ========================================
# INCLUIR ROUTERS
# ========================================

# Incluir routers en orden
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

# ========================================
# INICIAR SERVICIOS EN BACKGROUND
# ========================================

start_background_ping_checker(app)
start_playlist_checker(app)

# ========================================
# RUTAS DE INFORMACIÓN Y ESTADO
# ========================================

@app.get("/health")
async def health_check():
    """Endpoint de verificación de salud"""
    return {"status": "healthy", "message": "Servicio funcionando correctamente"}

@app.get("/info")
async def app_info(request: Request):
    """Información básica de la aplicación (con restricción de IP)"""
    client_ip = request.client.host if request.client else "unknown"
    return {
        "app": "VideoManager API",
        "version": "1.0.0",
        "client_ip": client_ip,
        "restrictions": {
            "documentation_access": "Restringido por IP",
            "allowed_networks": ALLOWED_NETWORKS
        }
    }

# ========================================
# CONFIGURACIÓN DE LOGGING PARA IP RESTRICTIONS
# ========================================

@app.on_event("startup")
async def startup_event():
    """Configuración al iniciar la aplicación"""
    logger.info("🚀 Iniciando VideoManager API")
    logger.info("🔒 Restricciones de IP configuradas:")
    logger.info(f"   📍 Redes permitidas: {ALLOWED_NETWORKS}")
    logger.info(f"   📍 IPs específicas: {ALLOWED_IPS}")
    logger.info(f"   📍 Rutas restringidas: {RESTRICTED_PATHS}")
    logger.info("✅ Configuración completada")

@app.on_event("shutdown")
async def shutdown_event():
    """Limpieza al cerrar la aplicación"""
    logger.info("🛑 Cerrando VideoManager API")

# ========================================
# CONFIGURACIÓN PARA DESARROLLO
# ========================================

if __name__ == "__main__":
    # Configuración para desarrollo local
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )