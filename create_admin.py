#!/usr/bin/env python3
"""
Script para crear usuarios administradores
==========================================

Este script permite crear usuarios administradores en la base de datos
con soporte para autenticación local y Active Directory.

Características:
- Creación de usuarios locales con contraseña hasheada
- Soporte para usuarios de Active Directory
- Validación de datos de entrada
- Verificación de usuarios existentes
- Opciones interactivas y por línea de comandos

Uso:
    # Modo interactivo
    python create_admin_user.py --database-url "sqlite:///./database.db" --interactive
    
    # Línea de comandos con parámetros
    python create_admin_user.py --database-url "sqlite:///./database.db" \
        --username admin --email admin@company.com --password mypassword \
        --fullname "Administrator" --department "IT"
    
    # Usuario de Active Directory
    python create_admin_user.py --database-url "sqlite:///./database.db" \
        --username jdoe --email jdoe@company.com --auth-provider ad \
        --ad-dn "CN=John Doe,OU=Users,DC=company,DC=com"
"""

import argparse
import logging
import sys
import getpass
import re
from datetime import datetime
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AdminUserCreator:
    def __init__(self, database_url: str):
        """
        Inicializa el creador de usuarios administradores
        
        Args:
            database_url: URL de conexión a la base de datos
        """
        self.database_url = database_url
        self.engine = create_engine(database_url)
        self.Session = sessionmaker(bind=self.engine)
        self.dialect = self.engine.dialect.name
        
        # Verificar que la tabla users existe
        self._verify_users_table()
    
    def _verify_users_table(self):
        """Verifica que la tabla users existe"""
        inspector = inspect(self.engine)
        tables = inspector.get_table_names()
        
        if 'users' not in tables:
            logger.error("❌ La tabla 'users' no existe en la base de datos")
            logger.error("   Asegúrate de que la base de datos esté migrada a V2")
            raise Exception("Tabla 'users' no encontrada")
        
        # Verificar columnas requeridas
        columns = [col['name'] for col in inspector.get_columns('users')]
        required_columns = ['username', 'email', 'password_hash', 'is_admin', 'auth_provider']
        missing_columns = [col for col in required_columns if col not in columns]
        
        if missing_columns:
            logger.error(f"❌ Columnas faltantes en la tabla users: {missing_columns}")
            raise Exception("Estructura de tabla 'users' incompleta")
        
        logger.info("✅ Tabla 'users' verificada correctamente")
    
    def _hash_password(self, password: str) -> str:
        """
        Hashea una contraseña usando bcrypt
        
        Args:
            password: Contraseña en texto plano
            
        Returns:
            str: Contraseña hasheada
        """
        try:
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            return pwd_context.hash(password)
        except ImportError:
            logger.error("❌ passlib no está instalado. Instálalo con: pip install passlib[bcrypt]")
            raise
    
    def _validate_email(self, email: str) -> bool:
        """Valida formato de email"""
        if not email:
            return True  # Email es opcional
        
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    def _validate_username(self, username: str) -> bool:
        """Valida formato de username"""
        if not username or len(username) < 3:
            return False
        
        # Solo letras, números, guiones y guiones bajos
        pattern = r'^[a-zA-Z0-9._-]+$'
        return re.match(pattern, username) is not None
    
    def _validate_password(self, password: str) -> tuple[bool, str]:
        """
        Valida la fortaleza de la contraseña
        
        Returns:
            tuple: (es_válida, mensaje)
        """
        if len(password) < 6:
            return False, "La contraseña debe tener al menos 6 caracteres"
        
        if len(password) < 8:
            return True, "⚠️  Contraseña débil: considera usar al menos 8 caracteres"
        
        # Verificar complejidad
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)
        
        complexity_score = sum([has_upper, has_lower, has_digit, has_special])
        
        if complexity_score >= 3:
            return True, "✅ Contraseña fuerte"
        elif complexity_score >= 2:
            return True, "⚠️  Contraseña moderada: considera añadir más variedad de caracteres"
        else:
            return True, "⚠️  Contraseña débil: considera usar mayúsculas, números y símbolos"
    
    def check_user_exists(self, username: str, email: str = None) -> dict:
        """
        Verifica si un usuario ya existe
        
        Returns:
            dict: Información sobre conflictos existentes
        """
        try:
            with self.engine.begin() as conn:
                # Verificar username
                username_result = conn.execute(
                    text("SELECT id, username, email, is_admin FROM users WHERE username = :username"),
                    {"username": username}
                ).fetchone()
                
                # Verificar email si se proporciona
                email_result = None
                if email:
                    email_result = conn.execute(
                        text("SELECT id, username, email, is_admin FROM users WHERE email = :email"),
                        {"email": email}
                    ).fetchone()
                
                return {
                    "username_exists": username_result is not None,
                    "username_data": dict(username_result) if username_result else None,
                    "email_exists": email_result is not None,
                    "email_data": dict(email_result) if email_result else None
                }
                
        except SQLAlchemyError as e:
            logger.error(f"Error verificando usuario existente: {e}")
            raise
    
    def create_user(self, username: str, email: str = None, password: str = None,
                   fullname: str = None, department: str = None, 
                   auth_provider: str = "local", ad_dn: str = None,
                   is_admin: bool = True, force: bool = False) -> bool:
        """
        Crea un nuevo usuario administrador
        
        Args:
            username: Nombre de usuario único
            email: Email del usuario (opcional)
            password: Contraseña (requerida para auth_provider='local')
            fullname: Nombre completo
            department: Departamento
            auth_provider: 'local' o 'ad'
            ad_dn: Distinguished Name para Active Directory
            is_admin: Si el usuario es administrador
            force: Forzar creación aunque existan advertencias
            
        Returns:
            bool: True si el usuario fue creado exitosamente
        """
        
        # Validaciones
        if not self._validate_username(username):
            logger.error("❌ Username inválido. Debe tener al menos 3 caracteres y solo contener letras, números, ., _, -")
            return False
        
        if email and not self._validate_email(email):
            logger.error("❌ Formato de email inválido")
            return False
        
        if auth_provider == "local" and not password:
            logger.error("❌ La contraseña es requerida para usuarios locales")
            return False
        
        if auth_provider == "ad" and not ad_dn:
            logger.error("❌ El Distinguished Name (AD DN) es requerido para usuarios de Active Directory")
            return False
        
        # Verificar usuario existente
        existing = self.check_user_exists(username, email)
        
        if existing["username_exists"]:
            logger.error(f"❌ El username '{username}' ya existe")
            if existing["username_data"]:
                data = existing["username_data"]
                logger.error(f"   Usuario existente: {data['username']} ({data['email']}) - Admin: {data['is_admin']}")
            return False
        
        if existing["email_exists"] and email:
            logger.error(f"❌ El email '{email}' ya está en uso")
            if existing["email_data"]:
                data = existing["email_data"]
                logger.error(f"   Usuario existente: {data['username']} ({data['email']}) - Admin: {data['is_admin']}")
            return False
        
        # Validar contraseña para usuarios locales
        password_hash = None
        if auth_provider == "local":
            is_valid, message = self._validate_password(password)
            if not is_valid:
                logger.error(f"❌ {message}")
                return False
            elif not force and "débil" in message.lower():
                logger.warning(message)
                if not self._confirm_action("¿Continuar con esta contraseña?"):
                    return False
            else:
                logger.info(message)
            
            password_hash = self._hash_password(password)
        
        # Crear usuario
        try:
            with self.engine.begin() as conn:
                insert_sql = """
                INSERT INTO users (
                    username, email, password_hash, fullname, department,
                    is_active, is_admin, auth_provider, ad_dn,
                    created_at, updated_at
                ) VALUES (
                    :username, :email, :password_hash, :fullname, :department,
                    :is_active, :is_admin, :auth_provider, :ad_dn,
                    :created_at, :updated_at
                )
                """
                
                now = datetime.now()
                params = {
                    "username": username,
                    "email": email,
                    "password_hash": password_hash,
                    "fullname": fullname,
                    "department": department,
                    "is_active": True,
                    "is_admin": is_admin,
                    "auth_provider": auth_provider,
                    "ad_dn": ad_dn,
                    "created_at": now,
                    "updated_at": now
                }
                
                conn.execute(text(insert_sql), params)
                
                logger.info("🎉 Usuario creado exitosamente!")
                logger.info(f"   👤 Username: {username}")
                logger.info(f"   📧 Email: {email or 'No especificado'}")
                logger.info(f"   👑 Admin: {'Sí' if is_admin else 'No'}")
                logger.info(f"   🔐 Auth: {auth_provider}")
                
                if auth_provider == "local":
                    logger.warning("⚠️  IMPORTANTE: Guarda las credenciales de forma segura")
                    logger.warning(f"   Username: {username}")
                    logger.warning(f"   Password: [OCULTA]")
                
                return True
                
        except IntegrityError as e:
            logger.error(f"❌ Error de integridad: {e}")
            logger.error("   Es posible que el usuario ya exista o haya un conflicto de datos únicos")
            return False
        except SQLAlchemyError as e:
            logger.error(f"❌ Error creando usuario: {e}")
            return False
    
    def _confirm_action(self, message: str) -> bool:
        """Solicita confirmación del usuario"""
        while True:
            response = input(f"{message} (s/n): ").lower().strip()
            if response in ['s', 'sí', 'si', 'y', 'yes']:
                return True
            elif response in ['n', 'no']:
                return False
            else:
                print("Por favor responde 's' para sí o 'n' para no")
    
    def interactive_create_user(self):
        """Modo interactivo para crear usuario"""
        print("\n🚀 CREADOR INTERACTIVO DE USUARIO ADMINISTRADOR")
        print("=" * 50)
        
        # Información básica
        print("\n📝 INFORMACIÓN BÁSICA:")
        username = input("Username: ").strip()
        if not username:
            logger.error("❌ Username es requerido")
            return False
        
        email = input("Email (opcional): ").strip()
        if not email:
            email = None
        
        fullname = input("Nombre completo (opcional): ").strip()
        if not fullname:
            fullname = None
        
        department = input("Departamento (opcional): ").strip()
        if not department:
            department = None
        
        # Tipo de autenticación
        print("\n🔐 TIPO DE AUTENTICACIÓN:")
        print("1. Local (usuario y contraseña)")
        print("2. Active Directory")
        
        while True:
            auth_choice = input("Selecciona (1 o 2): ").strip()
            if auth_choice == "1":
                auth_provider = "local"
                break
            elif auth_choice == "2":
                auth_provider = "ad"
                break
            else:
                print("❌ Opción inválida. Selecciona 1 o 2")
        
        # Configuración específica por tipo de auth
        password = None
        ad_dn = None
        
        if auth_provider == "local":
            print("\n🔑 CONFIGURACIÓN DE CONTRASEÑA:")
            while True:
                password = getpass.getpass("Contraseña: ")
                password_confirm = getpass.getpass("Confirmar contraseña: ")
                
                if password != password_confirm:
                    print("❌ Las contraseñas no coinciden. Intenta nuevamente.")
                    continue
                
                is_valid, message = self._validate_password(password)
                print(f"   {message}")
                
                if is_valid:
                    if "débil" in message.lower():
                        if self._confirm_action("¿Usar esta contraseña de todos modos?"):
                            break
                    else:
                        break
                else:
                    print("❌ Contraseña no válida. Intenta nuevamente.")
        
        elif auth_provider == "ad":
            print("\n🏢 CONFIGURACIÓN DE ACTIVE DIRECTORY:")
            ad_dn = input("Distinguished Name (DN): ").strip()
            if not ad_dn:
                logger.error("❌ El DN es requerido para usuarios de AD")
                return False
        
        # Privilegios
        print("\n👑 PRIVILEGIOS:")
        is_admin = self._confirm_action("¿Este usuario será administrador?")
        
        # Resumen
        print("\n📋 RESUMEN DE CONFIGURACIÓN:")
        print(f"   👤 Username: {username}")
        print(f"   📧 Email: {email or 'No especificado'}")
        print(f"   👨‍💼 Nombre completo: {fullname or 'No especificado'}")
        print(f"   🏢 Departamento: {department or 'No especificado'}")
        print(f"   🔐 Autenticación: {auth_provider}")
        print(f"   👑 Administrador: {'Sí' if is_admin else 'No'}")
        if ad_dn:
            print(f"   🌐 AD DN: {ad_dn}")
        
        print()
        if not self._confirm_action("¿Crear este usuario?"):
            print("❌ Operación cancelada")
            return False
        
        # Crear usuario
        return self.create_user(
            username=username,
            email=email,
            password=password,
            fullname=fullname,
            department=department,
            auth_provider=auth_provider,
            ad_dn=ad_dn,
            is_admin=is_admin
        )
    
    def list_existing_users(self):
        """Lista usuarios existentes"""
        try:
            with self.engine.begin() as conn:
                result = conn.execute(text("""
                    SELECT username, email, fullname, is_admin, is_active, auth_provider, created_at
                    FROM users 
                    ORDER BY created_at DESC
                """))
                
                users = result.fetchall()
                
                if not users:
                    print("📭 No hay usuarios en la base de datos")
                    return
                
                print(f"\n👥 USUARIOS EXISTENTES ({len(users)} total):")
                print("=" * 80)
                print(f"{'Username':<15} {'Email':<25} {'Nombre':<20} {'Admin':<5} {'Auth':<5} {'Creado':<12}")
                print("-" * 80)
                
                for user in users:
                    username = user[0] or ""
                    email = user[1] or ""
                    fullname = user[2] or ""
                    is_admin = "Sí" if user[3] else "No"
                    is_active = "✅" if user[4] else "❌"
                    auth_provider = user[5] or ""
                    created_at = user[6].strftime('%Y-%m-%d') if user[6] else ""
                    
                    print(f"{username:<15} {email:<25} {fullname:<20} {is_admin:<5} {auth_provider:<5} {created_at:<12}")
                
                print()
                
        except SQLAlchemyError as e:
            logger.error(f"Error listando usuarios: {e}")

def main():
    parser = argparse.ArgumentParser(
        description="Crear usuarios administradores en la base de datos",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos de uso:

  # Modo interactivo (recomendado)
  python create_admin_user.py --database-url "sqlite:///./database.db" --interactive

  # Usuario local por línea de comandos
  python create_admin_user.py --database-url "sqlite:///./database.db" \\
      --username admin --email admin@company.com --password mypassword \\
      --fullname "Administrator" --department "IT"

  # Usuario de Active Directory
  python create_admin_user.py --database-url "sqlite:///./database.db" \\
      --username jdoe --email jdoe@company.com --auth-provider ad \\
      --ad-dn "CN=John Doe,OU=Users,DC=company,DC=com"

  # Listar usuarios existentes
  python create_admin_user.py --database-url "sqlite:///./database.db" --list-users
        """
    )
    
    parser.add_argument(
        "--database-url", 
        required=True,
        help="URL de conexión a la base de datos"
    )
    
    # Modo de operación
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--interactive", "-i",
        action="store_true",
        help="Modo interactivo (recomendado)"
    )
    mode_group.add_argument(
        "--list-users", "-l",
        action="store_true",
        help="Listar usuarios existentes"
    )
    
    # Parámetros de usuario
    parser.add_argument("--username", help="Nombre de usuario")
    parser.add_argument("--email", help="Email del usuario")
    parser.add_argument("--password", help="Contraseña (para usuarios locales)")
    parser.add_argument("--fullname", help="Nombre completo")
    parser.add_argument("--department", help="Departamento")
    parser.add_argument("--auth-provider", choices=["local", "ad"], default="local",
                       help="Proveedor de autenticación")
    parser.add_argument("--ad-dn", help="Distinguished Name para Active Directory")
    parser.add_argument("--no-admin", action="store_true",
                       help="El usuario NO será administrador")
    parser.add_argument("--force", action="store_true",
                       help="Forzar creación sin confirmaciones")
    
    args = parser.parse_args()
    
    try:
        creator = AdminUserCreator(args.database_url)
        
        if args.list_users:
            creator.list_existing_users()
            return
        
        if args.interactive:
            success = creator.interactive_create_user()
        else:
            # Validar parámetros requeridos
            if not args.username:
                logger.error("❌ --username es requerido en modo no interactivo")
                sys.exit(1)
            
            if args.auth_provider == "local" and not args.password:
                logger.error("❌ --password es requerido para usuarios locales")
                sys.exit(1)
            
            if args.auth_provider == "ad" and not args.ad_dn:
                logger.error("❌ --ad-dn es requerido para usuarios de Active Directory")
                sys.exit(1)
            
            success = creator.create_user(
                username=args.username,
                email=args.email,
                password=args.password,
                fullname=args.fullname,
                department=args.department,
                auth_provider=args.auth_provider,
                ad_dn=args.ad_dn,
                is_admin=not args.no_admin,
                force=args.force
            )
        
        sys.exit(0 if success else 1)
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()