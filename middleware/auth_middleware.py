# ==========================================
# SOLUCIÓN INMEDIATA: Corregir middleware/auth_middleware.py
# ==========================================

from fastapi import Request
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware de autenticación corregido - SIN bucles de redirección"""
    
    async def dispatch(self, request: Request, call_next):
        if request.scope["type"] != "http":
            return await call_next(request)
        
        path = request.url.path
        method = request.method
        
        # ==========================================
        # RUTAS PÚBLICAS AMPLIADAS (SIN AUTENTICACIÓN)
        # ==========================================
        public_paths = [
            # Páginas de autenticación (CRÍTICO)
            "/login",
            "/ui/login",          # ✅ AGREGADO - Permitir acceso a login UI
            "/register",
            "/ui/register",
            
            # API de autenticación
            "/api/login",
            "/api/logout", 
            "/logout",
            
            # Archivos estáticos
            "/static/",
            "/favicon.ico",
            
            # API para dispositivos (sin auth)
            "/api/devices",
            "/api/raspberry/",
            
            # Documentación
            "/docs",
            "/redoc", 
            "/openapi.json",
            
            # Health checks
            "/api/health",
            "/api/info",
            
            # Root redirect
            "/"
        ]
        
        # ==========================================
        # VERIFICAR SI ES RUTA PÚBLICA
        # ==========================================
        is_public_route = any(path.startswith(public_path) for public_path in public_paths)
        
        if is_public_route:
            logger.debug(f"✅ Ruta pública permitida: {method} {path}")
            return await call_next(request)
        
        # ==========================================
        # VERIFICAR AUTENTICACIÓN PARA RUTAS PROTEGIDAS
        # ==========================================
        session_token = request.cookies.get("session")
        
        if not session_token:
            logger.warning(f"⚠️ Acceso sin token a ruta protegida: {path}")
            
            # Redirigir páginas UI a login
            if path.startswith("/ui/") and path != "/ui/login":
                return RedirectResponse(url=f"/login?next={path}", status_code=302)
            
            # APIs devuelven 401
            elif path.startswith("/api/"):
                return JSONResponse(
                    {"error": "No autorizado", "message": "Token de sesión requerido"}, 
                    status_code=401
                )
            
            # Otras rutas van a login
            else:
                return RedirectResponse(url=f"/login?next={path}", status_code=302)
        
        # ==========================================
        # VERIFICAR VALIDEZ DE LA SESIÓN
        # ==========================================
        try:
            from router.auth_fixed import verify_session
            session_data = verify_session(session_token)
            
            if not session_data:
                logger.warning(f"⚠️ Sesión inválida/expirada para: {path}")
                
                # Crear respuesta según tipo de ruta
                if path.startswith("/ui/") and path != "/ui/login":
                    response = RedirectResponse(url=f"/login?next={path}", status_code=302)
                elif path.startswith("/api/"):
                    response = JSONResponse(
                        {"error": "Sesión expirada", "message": "Por favor, inicia sesión nuevamente"}, 
                        status_code=401
                    )
                else:
                    response = RedirectResponse(url=f"/login?next={path}", status_code=302)
                
                # Limpiar cookie inválida
                response.delete_cookie(key="session", path="/")
                return response
            
            # ✅ Sesión válida - continuar
            logger.debug(f"✅ Acceso autorizado: {session_data['username']} -> {path}")
            return await call_next(request)
            
        except ImportError:
            logger.error("❌ No se pudo importar verify_session desde router.auth_fixed")
            # En caso de error, permitir acceso (modo degradado)
            return await call_next(request)
        except Exception as e:
            logger.error(f"❌ Error verificando sesión: {str(e)}")
            # En caso de error, permitir acceso (modo degradado)
            return await call_next(request)


# ==========================================
# SOLUCIÓN ALTERNATIVA: main.py sin conflictos de rutas
# ==========================================

"""
Si tienes redirecciones conflictivas en main.py, reemplaza con esto:

# En main.py, ELIMINAR redirecciones problemáticas:

# ❌ ELIMINAR esto si existe:
@app.get("/login")
async def redirect_login():
    return RedirectResponse(url="/ui/login", status_code=301)

# ✅ MANTENER solo esto:
@app.get("/")
async def redirect_root(request: Request):
    if is_authenticated(request):
        return RedirectResponse(url="/ui/dashboard", status_code=302)
    else:
        return RedirectResponse(url="/ui/login", status_code=302)
"""

# ==========================================
# VERIFICACIÓN RÁPIDA DEL PROBLEMA
# ==========================================

def debug_auth_routes():
    """Función para debuggear rutas de autenticación"""
    
    print("🔍 DIAGNÓSTICO DE RUTAS DE AUTENTICACIÓN")
    print("="*50)
    
    # Verificar archivos críticos
    import os
    from pathlib import Path
    
    project_root = Path.cwd()
    critical_files = [
        "middleware/auth_middleware.py",
        "router/auth_fixed.py", 
        "templates/login.html",
        "main.py"
    ]
    
    print("📁 Archivos críticos:")
    for file_path in critical_files:
        full_path = project_root / file_path
        if full_path.exists():
            print(f"  ✅ {file_path}")
        else:
            print(f"  ❌ {file_path} - FALTA")
    
    # Verificar contenido de main.py
    main_file = project_root / "main.py"
    if main_file.exists():
        with open(main_file, 'r') as f:
            content = f.read()
        
        print("\n🔍 Análisis de main.py:")
        
        # Buscar redirecciones problemáticas
        if '@app.get("/login")' in content:
            print("  ⚠️ Encontrada redirección /login -> esto puede causar bucles")
        
        if 'AuthMiddleware' in content:
            print("  ✅ AuthMiddleware está configurado")
        else:
            print("  ❌ AuthMiddleware NO está configurado")
        
        if 'auth_fixed_router' in content:
            print("  ✅ auth_fixed_router está incluido")
        else:
            print("  ❌ auth_fixed_router NO está incluido")
    
    print("\n💡 SOLUCIÓN RECOMENDADA:")
    print("1. Actualizar middleware/auth_middleware.py con el código corregido")
    print("2. Eliminar redirecciones conflictivas en main.py")
    print("3. Reiniciar el servidor")
    
    print("="*50)

if __name__ == "__main__":
    debug_auth_routes()


# ==========================================
# COMANDO DE REPARACIÓN RÁPIDA
# ==========================================

def fix_auth_loop_now():
    """Reparación inmediata del bucle de autenticación"""
    
    import os
    from pathlib import Path
    
    project_root = Path.cwd()
    
    print("🚑 REPARACIÓN DE EMERGENCIA - Bucle de autenticación")
    print("="*60)
    
    # 1. Actualizar middleware
    middleware_file = project_root / "middleware" / "auth_middleware.py"
    
    if middleware_file.exists():
        # Crear backup
        backup_file = middleware_file.with_suffix('.py.backup')
        import shutil
        shutil.copy2(middleware_file, backup_file)
        print(f"📁 Backup creado: {backup_file}")
        
        # Escribir middleware corregido
        corrected_content = '''# middleware/auth_middleware.py - CORREGIDO
from fastapi import Request
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.scope["type"] != "http":
            return await call_next(request)
        
        path = request.url.path
        
        # Rutas públicas AMPLIADAS
        public_paths = [
            "/login", "/ui/login", "/register", "/ui/register",
            "/api/login", "/api/logout", "/logout",
            "/static/", "/favicon.ico",
            "/api/devices", "/api/raspberry/",
            "/docs", "/redoc", "/openapi.json",
            "/api/health", "/api/info", "/"
        ]
        
        if any(path.startswith(p) for p in public_paths):
            return await call_next(request)
        
        session_token = request.cookies.get("session")
        
        if not session_token:
            if path.startswith("/ui/") and path != "/ui/login":
                return RedirectResponse(url=f"/login?next={path}", status_code=302)
            elif path.startswith("/api/"):
                return JSONResponse({"error": "No autorizado"}, status_code=401)
            else:
                return RedirectResponse(url=f"/login?next={path}", status_code=302)
        
        try:
            from router.auth_fixed import verify_session
            if not verify_session(session_token):
                response = RedirectResponse(url=f"/login?next={path}", status_code=302) if path.startswith("/ui/") else JSONResponse({"error": "Sesión expirada"}, status_code=401)
                response.delete_cookie(key="session", path="/")
                return response
        except:
            pass
        
        return await call_next(request)
'''
        
        with open(middleware_file, 'w', encoding='utf-8') as f:
            f.write(corrected_content)
        
        print("✅ Middleware corregido")
    
    # 2. Verificar main.py
    main_file = project_root / "main.py"
    if main_file.exists():
        with open(main_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Buscar redirecciones problemáticas
        if '@app.get("/login")' in content and 'RedirectResponse(url="/ui/login"' in content:
            print("⚠️ ENCONTRADO: Redirección problemática en main.py")
            print("   Debes eliminar manualmente el @app.get('/login') que redirige a /ui/login")
    
    print("\n🔄 PASOS FINALES:")
    print("1. Reinicia el servidor: Ctrl+C y luego uvicorn main:app --reload")
    print("2. Ve a: http://localhost:8000/ui/login")
    print("3. Si persiste el problema, ejecuta: python debug_tools.py check-auth")
    
    print("="*60)

# Para ejecutar la reparación:
if __name__ == "__main__":
    fix_auth_loop_now()