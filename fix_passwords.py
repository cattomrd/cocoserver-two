#!/usr/bin/env python3
"""
Script para verificar y corregir contraseñas en la base de datos
============================================================

Este script:
1. Verifica el formato de las contraseñas almacenadas
2. Corrige contraseñas en formato incorrecto
3. Permite cambiar contraseñas específicas
4. Muestra información de usuarios

Uso:
    python fix_passwords.py --check-all
    python fix_passwords.py --fix-user username --password newpassword
    python fix_passwords.py --list-users
"""

import sys
import os
import argparse
import logging
from datetime import datetime
from typing import Optional

# Agregar el directorio padre al path para importar los modelos
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import bcrypt
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from models.models import User
    from models.database import get_db, engine
except ImportError as e:
    print(f"❌ Error de importación: {e}")
    print("Asegúrate de estar en el directorio del proyecto y tener las dependencias instaladas")
    sys.exit(1)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PasswordManager:
    def __init__(self, database_url: str = None):
        """Inicializar el gestor de contraseñas"""
        if database_url:
            self.engine = create_engine(database_url)
            self.Session = sessionmaker(bind=self.engine)
        else:
            self.engine = engine
            self.Session = sessionmaker(bind=engine)
    
    def hash_password(self, password: str) -> str:
        """Generar hash bcrypt de una contraseña"""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """Verificar contraseña contra hash"""
        try:
            if hashed.startswith('$2b$'):
                return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
            else:
                # Contraseña en texto plano
                return password == hashed
        except Exception as e:
            logger.error(f"Error verificando contraseña: {e}")
            return False
    
    def list_users(self):
        """Listar todos los usuarios y el formato de sus contraseñas"""
        session = self.Session()
        try:
            users = session.query(User).all()
            
            print("\n" + "="*80)
            print("LISTA DE USUARIOS EN LA BASE DE DATOS")
            print("="*80)
            
            for user in users:
                password_format = "❌ Sin contraseña"
                if user.password_hash:
                    if user.password_hash.startswith('$2b$'):
                        password_format = "✅ BCrypt (correcto)"
                    elif len(user.password_hash) == 64 and all(c in '0123456789abcdef' for c in user.password_hash):
                        password_format = "⚠️  SHA256 (necesita corrección)"
                    else:
                        password_format = "⚠️  Texto plano (necesita corrección)"
                
                status = "✅ Activo" if user.is_active else "❌ Inactivo"
                admin = "👑 Admin" if user.is_admin else "👤 Usuario"
                
                print(f"\nID: {user.id}")
                print(f"Username: {user.username}")
                print(f"Email: {user.email}")
                print(f"Nombre: {user.full_name}")
                print(f"Estado: {status}")
                print(f"Tipo: {admin}")
                print(f"Contraseña: {password_format}")
                print(f"Creado: {user.created_at}")
                print("-" * 50)
            
            print(f"\nTotal de usuarios: {len(users)}")
            
        except Exception as e:
            logger.error(f"Error listando usuarios: {e}")
        finally:
            session.close()
    
    def check_all_passwords(self):
        """Verificar el formato de todas las contraseñas"""
        session = self.Session()
        try:
            users = session.query(User).all()
            
            print("\n" + "="*80)
            print("VERIFICACIÓN DE CONTRASEÑAS")
            print("="*80)
            
            users_with_issues = []
            
            for user in users:
                if not user.password_hash:
                    print(f"❌ {user.username}: Sin contraseña")
                    users_with_issues.append(user.username)
                elif user.password_hash.startswith('$2b$'):
                    print(f"✅ {user.username}: Contraseña en formato BCrypt correcto")
                else:
                    print(f"⚠️  {user.username}: Contraseña en formato incorrecto ({len(user.password_hash)} chars)")
                    users_with_issues.append(user.username)
            
            if users_with_issues:
                print(f"\n⚠️  Se encontraron {len(users_with_issues)} usuarios con problemas de contraseña:")
                for username in users_with_issues:
                    print(f"   - {username}")
                
                print("\nPara corregir, ejecuta:")
                for username in users_with_issues:
                    print(f"   python fix_passwords.py --fix-user {username} --password nueva_contraseña")
            else:
                print("\n✅ Todas las contraseñas están en formato correcto")
            
        except Exception as e:
            logger.error(f"Error verificando contraseñas: {e}")
        finally:
            session.close()
    
    def fix_user_password(self, username: str, new_password: str, force: bool = False):
        """Corregir contraseña de un usuario específico"""
        session = self.Session()
        try:
            user = session.query(User).filter(User.username == username).first()
            
            if not user:
                print(f"❌ Usuario '{username}' no encontrado")
                return False
            
            print(f"\n👤 Usuario encontrado: {user.username} ({user.email})")
            
            # Mostrar estado actual
            if user.password_hash:
                if user.password_hash.startswith('$2b$'):
                    current_format = "BCrypt (correcto)"
                else:
                    current_format = "Formato incorrecto"
            else:
                current_format = "Sin contraseña"
            
            print(f"📝 Estado actual: {current_format}")
            
            # Confirmar cambio si no es forzado
            if not force:
                confirm = input(f"\n¿Cambiar contraseña para '{username}'? (s/N): ").lower()
                if confirm != 's':
                    print("❌ Operación cancelada")
                    return False
            
            # Generar nuevo hash
            new_hash = self.hash_password(new_password)
            old_hash = user.password_hash
            
            # Actualizar usuario
            user.password_hash = new_hash
            user.updated_at = datetime.utcnow()
            
            session.commit()
            
            print(f"✅ Contraseña actualizada para '{username}'")
            print(f"📝 Hash anterior: {old_hash[:20] if old_hash else 'None'}...")
            print(f"📝 Hash nuevo: {new_hash[:20]}...")
            
            # Verificar que funciona
            if self.verify_password(new_password, new_hash):
                print("✅ Verificación exitosa: La nueva contraseña funciona correctamente")
            else:
                print("❌ Error: La verificación de la nueva contraseña falló")
                return False
            
            return True
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error actualizando contraseña: {e}")
            return False
        finally:
            session.close()
    
    def test_login(self, username: str, password: str):
        """Probar login con credenciales específicas"""
        session = self.Session()
        try:
            user = session.query(User).filter(
                (User.username == username) | (User.email == username)
            ).first()
            
            if not user:
                print(f"❌ Usuario '{username}' no encontrado")
                return False
            
            print(f"\n👤 Usuario encontrado: {user.username}")
            print(f"📧 Email: {user.email}")
            print(f"🏃 Estado: {'Activo' if user.is_active else 'Inactivo'}")
            print(f"👑 Admin: {'Sí' if user.is_admin else 'No'}")
            
            if not user.is_active:
                print("❌ El usuario está desactivado")
                return False
            
            # Verificar contraseña
            if self.verify_password(password, user.password_hash):
                print("✅ Contraseña correcta - Login exitoso")
                return True
            else:
                print("❌ Contraseña incorrecta")
                print(f"📝 Hash almacenado: {user.password_hash[:30] if user.password_hash else 'None'}...")
                return False
                
        except Exception as e:
            logger.error(f"Error probando login: {e}")
            return False
        finally:
            session.close()

def main():
    parser = argparse.ArgumentParser(description='Gestor de contraseñas para la base de datos')
    parser.add_argument('--list-users', action='store_true', help='Listar todos los usuarios')
    parser.add_argument('--check-all', action='store_true', help='Verificar formato de todas las contraseñas')
    parser.add_argument('--fix-user', type=str, help='Username del usuario a corregir')
    parser.add_argument('--password', type=str, help='Nueva contraseña')
    parser.add_argument('--test-login', type=str, help='Probar login con username')
    parser.add_argument('--force', action='store_true', help='Forzar cambios sin confirmación')
    parser.add_argument('--database-url', type=str, help='URL de la base de datos (opcional)')
    
    args = parser.parse_args()
    
    # Crear instancia del gestor
    password_manager = PasswordManager(args.database_url)
    
    if args.list_users:
        password_manager.list_users()
    
    elif args.check_all:
        password_manager.check_all_passwords()
    
    elif args.fix_user:
        if not args.password:
            print("❌ Error: --password es requerido cuando usas --fix-user")
            sys.exit(1)
        
        success = password_manager.fix_user_password(args.fix_user, args.password, args.force)
        if not success:
            sys.exit(1)
    
    elif args.test_login:
        if not args.password:
            print("❌ Error: --password es requerido cuando usas --test-login")
            sys.exit(1)
        
        success = password_manager.test_login(args.test_login, args.password)
        if not success:
            sys.exit(1)
    
    else:
        print("Gestor de Contraseñas - Sistema de Videos")
        print("=====================================")
        print()
        print("Opciones disponibles:")
        print("  --list-users                 Listar todos los usuarios")
        print("  --check-all                  Verificar formato de contraseñas")
        print("  --fix-user USERNAME          Corregir contraseña de usuario")
        print("  --password PASSWORD          Nueva contraseña (requerida con --fix-user)")
        print("  --test-login USERNAME        Probar login")
        print("  --force                      Forzar cambios sin confirmación")
        print()
        print("Ejemplos:")
        print("  python fix_passwords.py --list-users")
        print("  python fix_passwords.py --check-all")
        print("  python fix_passwords.py --fix-user admin --password nuevapass")
        print("  python fix_passwords.py --test-login admin --password tupassword")

if __name__ == "__main__":
    main()