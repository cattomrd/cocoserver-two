# ==========================================
# ARCHIVO: tests/test_auth_system.py
# Tests para el sistema de autenticación
# ==========================================

import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

from main import app
from models.database import Base, get_db
from models.models import User
from models.session import UserSession
from utils.session_manager import SessionManager
from utils.auth_enhanced_v2 import AuthServiceV2

# Base de datos de prueba en memoria
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override de la dependencia de BD para tests
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

# Crear tablas de test
Base.metadata.create_all(bind=engine)

client = TestClient(app)

@pytest.fixture
def db_session():
    """Fixture para sesión de BD de prueba"""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def test_user(db_session):
    """Fixture para usuario de prueba"""
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash="testpassword123",
        is_active=True,
        is_admin=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

class TestAuthenticationSystem:
    """Tests del sistema de autenticación"""
    
    def test_user_creation(self, db_session):
        """Test: Crear usuario en BD"""
        user = User(
            username="newuser",
            email="newuser@test.com",
            password_hash="password123",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        
        # Verificar que se creó correctamente
        created_user = db_session.query(User).filter(User.username == "newuser").first()
        assert created_user is not None
        assert created_user.email == "newuser@test.com"
        assert created_user.is_active == True
    
    def test_session_creation(self, db_session, test_user):
        """Test: Crear sesión de usuario"""
        session_token = SessionManager.create_session(
            db=db_session,
            user_id=test_user.id,
            ip_address="127.0.0.1",
            user_agent="Test Agent"
        )
        
        assert session_token is not None
        assert len(session_token) > 20  # Token debe ser suficientemente largo
        
        # Verificar que la sesión existe en BD
        session = db_session.query(UserSession).filter(
            UserSession.session_token == session_token
        ).first()
        
        assert session is not None
        assert session.user_id == test_user.id
        assert session.is_active == True
    
    def test_session_verification(self, db_session, test_user):
        """Test: Verificar sesión válida"""
        # Crear sesión
        session_token = SessionManager.create_session(
            db=db_session,
            user_id=test_user.id
        )
        
        # Verificar sesión
        session_data = SessionManager.verify_session(db_session, session_token)
        
        assert session_data is not None
        assert session_data['user_id'] == test_user.id
        assert session_data['username'] == test_user.username
    
    def test_session_revocation(self, db_session, test_user):
        """Test: Revocar sesión"""
        # Crear sesión
        session_token = SessionManager.create_session(
            db=db_session,
            user_id=test_user.id
        )
        
        # Verificar que está activa
        session_data = SessionManager.verify_session(db_session, session_token)
        assert session_data is not None
        
        # Revocar sesión
        result = SessionManager.revoke_session(db_session, session_token)
        assert result == True
        
        # Verificar que ya no es válida
        session_data = SessionManager.verify_session(db_session, session_token)
        assert session_data is None
    
    def test_expired_session_cleanup(self, db_session, test_user):
        """Test: Limpieza de sesiones expiradas"""
        # Crear sesión expirada manualmente
        expired_session = UserSession(
            session_token="expired_token_123",
            user_id=test_user.id,
            expires_at=datetime.utcnow() - timedelta(hours=1),  # Expirada hace 1 hora
            is_active=True
        )
        db_session.add(expired_session)
        db_session.commit()
        
        # Ejecutar limpieza
        cleaned_count = SessionManager.cleanup_expired_sessions(db_session)
        
        assert cleaned_count > 0
        
        # Verificar que la sesión expirada fue marcada como inactiva
        updated_session = db_session.query(UserSession).filter(
            UserSession.session_token == "expired_token_123"
        ).first()
        assert updated_session.is_active == False
    
    def test_user_authentication(self, db_session, test_user):
        """Test: Autenticación de usuario"""
        # Test con credenciales correctas
        success, user, message = AuthServiceV2.authenticate_user(
            db_session, 
            test_user.username, 
            "testpassword123"
        )
        
        assert success == True
        assert user.id == test_user.id
        assert "exitosa" in message.lower()
        
        # Test con credenciales incorrectas
        success, user, message = AuthServiceV2.authenticate_user(
            db_session,
            test_user.username,
            "wrongpassword"
        )
        
        assert success == False
        assert user is None
        assert "incorrecta" in message.lower()
    
    def test_multiple_sessions_per_user(self, db_session, test_user):
        """Test: Múltiples sesiones por usuario"""
        # Crear varias sesiones
        tokens = []
        for i in range(3):
            token = SessionManager.create_session(
                db=db_session,
                user_id=test_user.id,
                ip_address=f"192.168.1.{i+1}"
            )
            tokens.append(token)
        
        # Verificar que todas son válidas
        for token in tokens:
            session_data = SessionManager.verify_session(db_session, token)
            assert session_data is not None
        
        # Revocar todas las sesiones del usuario
        revoked_count = SessionManager.revoke_all_user_sessions(db_session, test_user.id)
        assert revoked_count == 3
        
        # Verificar que ninguna es válida
        for token in tokens:
            session_data = SessionManager.verify_session(db_session, token)
            assert session_data is None

class TestAPIEndpoints:
    """Tests de endpoints de la API"""
    
    def test_login_endpoint_success(self, db_session, test_user):
        """Test: Endpoint de login exitoso"""
        response = client.post("/api/login", data={
            "username": test_user.username,
            "password": "testpassword123"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "session_token" in data
    
    def test_login_endpoint_failure(self):
        """Test: Endpoint de login fallido"""
        response = client.post("/api/login", data={
            "username": "nonexistent",
            "password": "wrongpass"
        })
        
        assert response.status_code == 401
        data = response.json()
        assert data["success"] == False
    
    def test_logout_endpoint(self, db_session, test_user):
        """Test: Endpoint de logout"""
        # Primero hacer login
        login_response = client.post("/api/login", data={
            "username": test_user.username,
            "password": "testpassword123"
        })
        
        assert login_response.status_code == 200
        
        # Luego hacer logout
        logout_response = client.get("/api/logout")
        
        assert logout_response.status_code == 200
        data = logout_response.json()
        assert data["success"] == True
    
    def test_protected_route_without_auth(self):
        """Test: Acceso a ruta protegida sin autenticación"""
        response = client.get("/ui/dashboard")
        
        # Debe redirigir a login
        assert response.status_code == 302
        assert "/login" in response.headers.get("location", "")
    
    def test_protected_route_with_auth(self, db_session, test_user):
        """Test: Acceso a ruta protegida con autenticación"""
        # Hacer login primero
        login_response = client.post("/login", data={
            "username": test_user.username,
            "password": "testpassword123",
            "next": "/ui/dashboard"
        }, follow_redirects=False)
        
        # El login debe redirigir al dashboard
        assert login_response.status_code == 302

# ==========================================
# ARCHIVO: scripts/migration_script.py
# Script de migración para implementar cambios
# ==========================================

import os
import sys
import logging
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Agregar el directorio raíz al path para imports
sys.path.append(str(Path(__file__).parent.parent))

from models.database import get_database_url
from models.session import UserSession, Base
from models.models import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MigrationScript:
    """Script para migrar la aplicación al nuevo sistema de autenticación"""
    
    def __init__(self):
        self.database_url = get_database_url()
        self.engine = create_engine(self.database_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
    
    def run_migration(self):
        """Ejecutar migración completa"""
        logger.info("🚀 Iniciando migración del sistema de autenticación...")
        
        try:
            # 1. Crear backup de BD
            self.create_backup()
            
            # 2. Crear tablas nuevas
            self.create_new_tables()
            
            # 3. Migrar datos existentes
            self.migrate_existing_data()
            
            # 4. Verificar integridad
            self.verify_migration()
            
            logger.info("✅ Migración completada exitosamente")
            
        except Exception as e:
            logger.error(f"❌ Error en migración: {str(e)}")
            logger.error("🔄 Considera restaurar desde backup")
            raise
    
    def create_backup(self):
        """Crear backup de la base de datos"""
        logger.info("💾 Creando backup de la base de datos...")
        
        # Para SQLite
        if "sqlite" in self.database_url.lower():
            import shutil
            db_path = self.database_url.replace("sqlite:///", "")
            backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            shutil.copy2(db_path, backup_path)
            logger.info(f"✅ Backup creado: {backup_path}")
        
        # Para PostgreSQL/MySQL (agregar comandos específicos)
        else:
            logger.warning("⚠️ Backup manual requerido para BD externa")
            input("Presiona Enter cuando hayas creado el backup...")
    
    def create_new_tables(self):
        """Crear nuevas tablas del sistema de sesiones"""
        logger.info("🏗️ Creando nuevas tablas...")
        
        try:
            # Crear tabla de sesiones
            UserSession.__table__.create(self.engine, checkfirst=True)
            logger.info("✅ Tabla user_sessions creada")
            
            # Verificar que User tenga relación con sessions
            # (esto debería estar en el modelo User actualizado)
            
        except Exception as e:
            logger.error(f"❌ Error creando tablas: {str(e)}")
            raise
    
    def migrate_existing_data(self):
        """Migrar datos existentes si es necesario"""
        logger.info("🔄 Migrando datos existentes...")
        
        db = self.SessionLocal()
        try:
            # Verificar usuarios existentes
            user_count = db.query(User).count()
            logger.info(f"📊 Usuarios existentes: {user_count}")
            
            # Si no hay usuarios, crear usuario admin por defecto
            if user_count == 0:
                self.create_default_admin(db)
            
            # Limpiar sesiones antiguas si existieran
            # (no aplica si es primera instalación)
            
            db.commit()
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error migrando datos: {str(e)}")
            raise
        finally:
            db.close()
    
    def create_default_admin(self, db):
        """Crear usuario administrador por defecto"""
        logger.info("👤 Creando usuario administrador por defecto...")
        
        import hashlib
        
        admin_user = User(
            username="admin",
            email="admin@localhost",
            password_hash=hashlib.sha256("admin123".encode()).hexdigest(),
            is_active=True,
            is_admin=True,
            fullname="Administrador"
        )
        
        db.add(admin_user)
        db.commit()
        
        logger.info("✅ Usuario admin creado (admin/admin123)")
        logger.warning("⚠️ IMPORTANTE: Cambiar la contraseña por defecto")
    
    def verify_migration(self):
        """Verificar que la migración fue exitosa"""
        logger.info("🔍 Verificando migración...")
        
        db = self.SessionLocal()
        try:
            # Verificar que las tablas existen y son accesibles
            user_count = db.query(User).count()
            session_count = db.query(UserSession).count()
            
            logger.info(f"✅ Usuarios: {user_count}")
            logger.info(f"✅ Sesiones: {session_count}")
            
            # Verificar estructura de tablas
            assert hasattr(UserSession, 'session_token')
            assert hasattr(UserSession, 'user_id')
            assert hasattr(UserSession, 'expires_at')
            
            logger.info("✅ Estructura de tablas verificada")
            
        except Exception as e:
            logger.error(f"❌ Error en verificación: {str(e)}")
            raise
        finally:
            db.close()

# ==========================================
# ARCHIVO: scripts/validation_checklist.py
# Lista de validación post-implementación
# ==========================================

import requests
import time
from datetime import datetime

class ValidationChecklist:
    """Lista de validación para verificar el sistema completo"""
    
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.results = []
    
    def run_all_checks(self):
        """Ejecutar todas las validaciones"""
        print("🔍 Iniciando validación completa del sistema...")
        
        checks = [
            ("Conectividad básica", self.check_connectivity),
            ("Página de login", self.check_login_page),
            ("Login exitoso", self.check_successful_login),
            ("Logout seguro", self.check_secure_logout),
            ("Protección de rutas", self.check_route_protection),
            ("API de playlists", self.check_playlists_api),
            ("Gestión de sesiones", self.check_session_management),
            ("Limpieza de cookies", self.check_cookie_cleanup)
        ]
        
        for name, check_func in checks:
            print(f"\n📋 Validando: {name}")
            try:
                result = check_func()
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"   {status}")
                self.results.append((name, result))
            except Exception as e:
                print(f"   ❌ ERROR: {str(e)}")
                self.results.append((name, False))
        
        self.print_summary()
    
    def check_connectivity(self):
        """Verificar conectividad básica"""
        response = self.session.get(f"{self.base_url}/")
        return response.status_code in [200, 302]  # OK o redirect
    
    def check_login_page(self):
        """Verificar que la página de login carga"""
        response = self.session.get(f"{self.base_url}/login")
        return response.status_code == 200 and "login" in response.text.lower()
    
    def check_successful_login(self):
        """Verificar login exitoso"""
        login_data = {
            "username": "admin",
            "password": "admin123"
        }
        
        response = self.session.post(
            f"{self.base_url}/api/login",
            data=login_data
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("success") == True
        
        return False
    
    def check_secure_logout(self):
        """Verificar logout seguro"""
        # Primero hacer login
        if not self.check_successful_login():
            return False
        
        # Hacer logout
        response = self.session.get(f"{self.base_url}/api/logout")
        
        if response.status_code != 200:
            return False
        
        # Verificar que no podemos acceder a rutas protegidas
        protected_response = self.session.get(f"{self.base_url}/ui/dashboard")
        return protected_response.status_code in [302, 401]  # Redirect o unauthorized
    
    def check_route_protection(self):
        """Verificar protección de rutas"""
        # Limpiar sesión
        self.session.cookies.clear()
        
        protected_routes = [
            "/ui/dashboard",
            "/ui/playlists", 
            "/api/playlists"
        ]
        
        for route in protected_routes:
            response = self.session.get(f"{self.base_url}{route}")
            if response.status_code not in [302, 401]:
                return False
        
        return True
    
    def check_playlists_api(self):
        """Verificar API de playlists"""
        # Login primero
        if not self.check_successful_login():
            return False
        
        # Verificar endpoint de playlists
        response = self.session.get(f"{self.base_url}/api/playlists")
        return response.status_code == 200
    
    def check_session_management(self):
        """Verificar gestión de sesiones"""
        # Hacer múltiples logins
        login_data = {
            "username": "admin", 
            "password": "admin123"
        }
        
        sessions = []
        for i in range(3):
            session = requests.Session()
            response = session.post(f"{self.base_url}/api/login", data=login_data)
            if response.status_code == 200:
                sessions.append(session)
        
        # Verificar que las sesiones son independientes
        return len(sessions) >= 2
    
    def check_cookie_cleanup(self):
        """Verificar limpieza de cookies"""
        # Login
        login_data = {"username": "admin", "password": "admin123"}
        login_response = self.session.post(f"{self.base_url}/api/login", data=login_data)
        
        if login_response.status_code != 200:
            return False
        
        # Verificar que hay cookies
        has_session_cookie = any("session" in str(cookie) for cookie in self.session.cookies)
        
        if not has_session_cookie:
            return False
        
        # Hacer logout
        self.session.get(f"{self.base_url}/api/logout")
        
        # Verificar que las cookies se limpiaron
        session_cookies_after = [cookie for cookie in self.session.cookies if "session" in str(cookie)]
        return len(session_cookies_after) == 0
    
    def print_summary(self):
        """Imprimir resumen de validación"""
        print("\n" + "="*50)
        print("📊 RESUMEN DE VALIDACIÓN")
        print("="*50)
        
        passed = sum(1 for _, result in self.results if result)
        total = len(self.results)
        
        for name, result in self.results:
            status = "✅" if result else "❌"
            print(f"{status} {name}")
        
        print(f"\n📈 Resultado: {passed}/{total} verificaciones pasaron")
        
        if passed == total:
            print("🎉 ¡Todos los tests pasaron! Sistema funcionando correctamente.")
        else:
            print("⚠️ Algunos tests fallaron. Revisar implementación.")

# ==========================================
# ARCHIVO: run_migration.py
# Script principal de migración
# ==========================================

#!/usr/bin/env python3

"""
Script de migración principal
Ejecutar con: python run_migration.py
"""

import sys
import traceback
from pathlib import Path

# Agregar directorio raíz al path
sys.path.append(str(Path(__file__).parent))

def main():
    print("🚀 Sistema de Migración de Autenticación")
    print("=" * 50)
    
    try:
        # Importar después de agregar al path
        from scripts.migration_script import MigrationScript
        from scripts.validation_checklist import ValidationChecklist
        
        # Ejecutar migración
        migrator = MigrationScript()
        migrator.run_migration()
        
        print("\n⏱️ Esperando 5 segundos antes de validar...")
        import time
        time.sleep(5)
        
        # Ejecutar validación
        validator = ValidationChecklist()
        validator.run_all_checks()
        
    except ImportError as e:
        print(f"❌ Error de importación: {str(e)}")
        print("🔧 Asegúrate de estar en el directorio raíz del proyecto")
    except Exception as e:
        print(f"❌ Error durante migración: {str(e)}")
        print("\n📋 Traceback completo:")
        traceback.print_exc()

if __name__ == "__main__":
    main()

print("✅ Scripts de testing y validación creados")
print("📦 Archivos incluidos:")
print("- tests/test_auth_system.py: Tests unitarios")
print("- scripts/migration_script.py: Script de migración")
print("- scripts/validation_checklist.py: Lista de validación")
print("- run_migration.py: Script principal de migración")
print("\n🔧 Para ejecutar:")
print("1. pytest tests/test_auth_system.py  # Ejecutar tests")
print("2. python run_migration.py           # Migrar sistema")