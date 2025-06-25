#!/usr/bin/env python3
"""
Script de migración de base de datos V1.0 a V2.0
===============================================

Este script migra la base de datos desde la versión 1.0 a la versión 2.0,
aplicando todos los cambios necesarios en la estructura y datos.

Cambios principales:
- Nueva tabla playlist_videos con campo position
- Nuevos campos en devices: videoloop_enabled, kiosk_enabled, service_logs
- Nuevos campos en playlists: updated_at, start_date
- Nuevas tablas: users, ad_sync_logs
- Migración de datos de relaciones playlist-video existentes

Uso:
    python migrate_v1_to_v2.py --database-url "sqlite:///./database.db"
    python migrate_v1_to_v2.py --database-url "postgresql://user:pass@localhost/dbname"
"""

import argparse
import logging
import sys
from datetime import datetime
from sqlalchemy import (
    create_engine, MetaData, Table, Column, Integer, String, Text, DateTime, 
    Boolean, ForeignKey, UniqueConstraint, Float, func, inspect, text
)
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
import warnings

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

warnings.filterwarnings("ignore", message="Valid config keys have changed in V2")

class DatabaseMigration:
    def __init__(self, database_url: str, dry_run: bool = False):
        """
        Inicializa la migración de base de datos
        
        Args:
            database_url: URL de conexión a la base de datos
            dry_run: Si es True, solo muestra lo que se haría sin ejecutar
        """
        self.database_url = database_url
        self.dry_run = dry_run
        self.engine = create_engine(database_url)
        self.metadata = MetaData()
        self.Session = sessionmaker(bind=self.engine)
        
        # Detectar el dialecto de la base de datos
        self.dialect = self.engine.dialect.name
        logger.info(f"Detectado dialecto de BD: {self.dialect}")
        
    def check_current_version(self):
        """Verifica la versión actual de la base de datos"""
        inspector = inspect(self.engine)
        tables = inspector.get_table_names()
        
        # Verificar si ya existe la tabla playlist_videos (indicador de V2)
        if 'playlist_videos' in tables:
            logger.warning("La tabla 'playlist_videos' ya existe. Posiblemente ya está en V2.")
            return "v2"
        
        # Verificar tablas básicas de V1
        required_v1_tables = ['videos', 'playlists', 'devices']
        missing_tables = [table for table in required_v1_tables if table not in tables]
        
        if missing_tables:
            logger.error(f"Tablas faltantes para V1: {missing_tables}")
            raise Exception("La base de datos no parece ser V1 válida")
        
        logger.info("Base de datos identificada como V1")
        return "v1"
    
    def backup_database(self):
        """Crea un respaldo de la base de datos antes de la migración"""
        if self.dry_run:
            logger.info("[DRY RUN] Se crearía un respaldo de la base de datos")
            return
        
        backup_filename = f"backup_v1_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
        
        if self.dialect == 'sqlite':
            import shutil
            db_file = self.database_url.replace('sqlite:///', '')
            backup_file = f"{db_file}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            shutil.copy2(db_file, backup_file)
            logger.info(f"Respaldo SQLite creado: {backup_file}")
        else:
            logger.info("Para PostgreSQL, asegúrate de hacer respaldo con pg_dump manualmente")
    
    def create_new_tables(self):
        """Crea las nuevas tablas de la V2"""
        logger.info("Creando nuevas tablas...")
        
        # Tabla playlist_videos
        playlist_videos_sql = """
        CREATE TABLE IF NOT EXISTS playlist_videos (
            id INTEGER PRIMARY KEY,
            playlist_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            position INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
            FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE,
            UNIQUE (playlist_id, position)
        );
        """
        
        # Tabla users
        users_sql = """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE,
            password_hash VARCHAR(128),
            fullname VARCHAR(100),
            department VARCHAR(100),
            is_active BOOLEAN DEFAULT TRUE,
            is_admin BOOLEAN DEFAULT FALSE,
            auth_provider VARCHAR(20) DEFAULT 'local',
            ad_dn TEXT,
            last_ad_sync TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        );
        """
        
        # Tabla ad_sync_logs
        ad_sync_logs_sql = """
        CREATE TABLE IF NOT EXISTS ad_sync_logs (
            id INTEGER PRIMARY KEY,
            sync_type VARCHAR(50) NOT NULL,
            status VARCHAR(20) NOT NULL,
            message TEXT,
            users_processed INTEGER DEFAULT 0,
            users_created INTEGER DEFAULT 0,
            users_updated INTEGER DEFAULT 0,
            users_errors INTEGER DEFAULT 0,
            duration_seconds REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        
        if self.dry_run:
            logger.info("[DRY RUN] Se crearían las tablas: playlist_videos, users, ad_sync_logs")
            return
        
        try:
            with self.engine.begin() as conn:
                conn.execute(text(playlist_videos_sql))
                conn.execute(text(users_sql))
                conn.execute(text(ad_sync_logs_sql))
            logger.info("Nuevas tablas creadas exitosamente")
        except SQLAlchemyError as e:
            logger.error(f"Error creando nuevas tablas: {e}")
            raise
    
    def add_new_columns(self):
        """Añade nuevas columnas a las tablas existentes"""
        logger.info("Añadiendo nuevas columnas...")
        
        # Columnas para devices
        device_columns = [
            "ALTER TABLE devices ADD COLUMN videoloop_enabled BOOLEAN DEFAULT TRUE;",
            "ALTER TABLE devices ADD COLUMN kiosk_enabled BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE devices ADD COLUMN service_logs TEXT;"
        ]
        
        # Columnas para playlists
        playlist_columns = [
            "ALTER TABLE playlists ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
            "ALTER TABLE playlists ADD COLUMN start_date TIMESTAMP;"
        ]
        
        if self.dry_run:
            logger.info("[DRY RUN] Se añadirían columnas a devices y playlists")
            return
        
        try:
            with self.engine.begin() as conn:
                # Verificar qué columnas ya existen
                inspector = inspect(self.engine)
                
                # Verificar devices
                device_cols = [col['name'] for col in inspector.get_columns('devices')]
                for sql in device_columns:
                    col_name = sql.split('ADD COLUMN ')[1].split()[0]
                    if col_name not in device_cols:
                        try:
                            conn.execute(text(sql))
                            logger.info(f"Columna {col_name} añadida a devices")
                        except SQLAlchemyError as e:
                            logger.warning(f"No se pudo añadir {col_name}: {e}")
                
                # Verificar playlists
                playlist_cols = [col['name'] for col in inspector.get_columns('playlists')]
                for sql in playlist_columns:
                    col_name = sql.split('ADD COLUMN ')[1].split()[0]
                    if col_name not in playlist_cols:
                        try:
                            conn.execute(text(sql))
                            logger.info(f"Columna {col_name} añadida a playlists")
                        except SQLAlchemyError as e:
                            logger.warning(f"No se pudo añadir {col_name}: {e}")
                            
        except SQLAlchemyError as e:
            logger.error(f"Error añadiendo columnas: {e}")
            raise
    
    def migrate_playlist_video_relationships(self):
        """Migra las relaciones playlist-video existentes a la nueva tabla"""
        logger.info("Migrando relaciones playlist-video...")
        
        if self.dry_run:
            logger.info("[DRY RUN] Se migrarían las relaciones playlist-video existentes")
            return
        
        try:
            with self.engine.begin() as conn:
                # Verificar si existe una tabla de relación anterior
                inspector = inspect(self.engine)
                tables = inspector.get_table_names()
                
                # Si existe device_playlists, podemos asumir que las relaciones
                # playlist-video se manejarán a través de la asignación de dispositivos
                if 'device_playlists' in tables:
                    logger.info("Tabla device_playlists encontrada, no se requiere migración de datos")
                    return
                
                # Buscar relaciones existentes en tablas relacionadas o logs
                # Como no hay una relación directa en V1, inicializamos la tabla vacía
                logger.info("No se encontraron relaciones playlist-video anteriores para migrar")
                
        except SQLAlchemyError as e:
            logger.error(f"Error migrando relaciones: {e}")
            raise
    
    def update_playlist_timestamps(self):
        """Actualiza los timestamps de updated_at en playlists existentes"""
        logger.info("Actualizando timestamps de playlists...")
        
        if self.dry_run:
            logger.info("[DRY RUN] Se actualizarían los timestamps de playlists")
            return
        
        try:
            with self.engine.begin() as conn:
                # Actualizar updated_at para playlists existentes
                update_sql = """
                UPDATE playlists 
                SET updated_at = creation_date 
                WHERE updated_at IS NULL;
                """
                conn.execute(text(update_sql))
                logger.info("Timestamps de playlists actualizados")
                
        except SQLAlchemyError as e:
            logger.error(f"Error actualizando timestamps: {e}")
            raise
    
    def create_default_admin_user(self):
        """Crea un usuario administrador por defecto"""
        logger.info("Creando usuario administrador por defecto...")
        
        if self.dry_run:
            logger.info("[DRY RUN] Se crearía un usuario administrador por defecto")
            return
        
        try:
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            
            # Contraseña por defecto (debe cambiarse después)
            default_password = "admin123"
            password_hash = pwd_context.hash(default_password)
            
            with self.engine.begin() as conn:
                # Verificar si ya existe un usuario admin
                check_sql = "SELECT COUNT(*) as count FROM users WHERE username = 'admin';"
                result = conn.execute(text(check_sql)).fetchone()
                
                if result[0] == 0:
                    insert_sql = """
                    INSERT INTO users (username, email, password_hash, fullname, is_active, is_admin, auth_provider)
                    VALUES ('admin', 'admin@example.com', :password_hash, 'Administrador', TRUE, TRUE, 'local');
                    """
                    conn.execute(text(insert_sql), {"password_hash": password_hash})
                    logger.info("Usuario administrador creado: admin/admin123")
                    logger.warning("IMPORTANTE: Cambia la contraseña del administrador después de la migración")
                else:
                    logger.info("Usuario administrador ya existe")
                    
        except ImportError:
            logger.warning("passlib no está instalado, no se puede crear usuario por defecto")
        except SQLAlchemyError as e:
            logger.error(f"Error creando usuario administrador: {e}")
            raise
    
    def create_indexes(self):
        """Crea índices para optimizar el rendimiento"""
        logger.info("Creando índices...")
        
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_playlist_videos_playlist_id ON playlist_videos(playlist_id);",
            "CREATE INDEX IF NOT EXISTS idx_playlist_videos_video_id ON playlist_videos(video_id);",
            "CREATE INDEX IF NOT EXISTS idx_playlist_videos_position ON playlist_videos(playlist_id, position);",
            "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);",
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
            "CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);",
            "CREATE INDEX IF NOT EXISTS idx_devices_is_active ON devices(is_active);",
            "CREATE INDEX IF NOT EXISTS idx_playlists_is_active ON playlists(is_active);"
        ]
        
        if self.dry_run:
            logger.info("[DRY RUN] Se crearían los índices de optimización")
            return
        
        try:
            with self.engine.begin() as conn:
                for index_sql in indexes:
                    try:
                        conn.execute(text(index_sql))
                    except SQLAlchemyError as e:
                        logger.warning(f"No se pudo crear índice: {e}")
            logger.info("Índices creados exitosamente")
            
        except SQLAlchemyError as e:
            logger.error(f"Error creando índices: {e}")
            raise
    
    def verify_migration(self):
        """Verifica que la migración se haya completado correctamente"""
        logger.info("Verificando migración...")
        
        try:
            inspector = inspect(self.engine)
            tables = inspector.get_table_names()
            
            # Verificar tablas requeridas
            required_tables = ['videos', 'playlists', 'devices', 'playlist_videos', 'users', 'ad_sync_logs', 'device_playlists']
            missing_tables = [table for table in required_tables if table not in tables]
            
            if missing_tables:
                logger.error(f"Tablas faltantes después de la migración: {missing_tables}")
                return False
            
            # Verificar columnas específicas
            device_cols = [col['name'] for col in inspector.get_columns('devices')]
            required_device_cols = ['videoloop_enabled', 'kiosk_enabled', 'service_logs']
            missing_device_cols = [col for col in required_device_cols if col not in device_cols]
            
            if missing_device_cols:
                logger.error(f"Columnas faltantes en devices: {missing_device_cols}")
                return False
            
            playlist_cols = [col['name'] for col in inspector.get_columns('playlists')]
            required_playlist_cols = ['updated_at', 'start_date']
            missing_playlist_cols = [col for col in required_playlist_cols if col not in playlist_cols]
            
            if missing_playlist_cols:
                logger.error(f"Columnas faltantes en playlists: {missing_playlist_cols}")
                return False
            
            logger.info("✅ Migración verificada exitosamente")
            return True
            
        except SQLAlchemyError as e:
            logger.error(f"Error verificando migración: {e}")
            return False
    
    def run_migration(self):
        """Ejecuta la migración completa"""
        logger.info("Iniciando migración de V1 a V2...")
        
        try:
            # Verificar versión actual
            current_version = self.check_current_version()
            if current_version == "v2":
                logger.info("La base de datos ya está en V2. No se requiere migración.")
                return True
            
            # Crear respaldo
            self.backup_database()
            
            # Ejecutar pasos de migración
            steps = [
                ("Crear nuevas tablas", self.create_new_tables),
                ("Añadir nuevas columnas", self.add_new_columns),
                ("Migrar relaciones playlist-video", self.migrate_playlist_video_relationships),
                ("Actualizar timestamps", self.update_playlist_timestamps),
                ("Crear usuario administrador", self.create_default_admin_user),
                ("Crear índices", self.create_indexes),
                ("Verificar migración", self.verify_migration)
            ]
            
            for step_name, step_func in steps:
                logger.info(f"Ejecutando: {step_name}")
                try:
                    result = step_func()
                    if step_name == "Verificar migración" and not result:
                        raise Exception("La verificación de migración falló")
                except Exception as e:
                    logger.error(f"Error en {step_name}: {e}")
                    raise
            
            if not self.dry_run:
                logger.info("🎉 Migración completada exitosamente!")
                logger.info("Recuerda:")
                logger.info("1. Cambiar la contraseña del usuario 'admin'")
                logger.info("2. Configurar Active Directory si es necesario")
                logger.info("3. Probar todas las funcionalidades")
            else:
                logger.info("🔍 Simulación completada. Usa --execute para realizar la migración real.")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error durante la migración: {e}")
            logger.error("Restaura desde el respaldo si es necesario")
            return False

def main():
    parser = argparse.ArgumentParser(
        description="Migración de base de datos V1 a V2",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos de uso:

  # Simulación (no ejecuta cambios reales)
  python migrate_v1_to_v2.py --database-url "sqlite:///./database.db" --dry-run

  # Migración real
  python migrate_v1_to_v2.py --database-url "sqlite:///./database.db" --execute

  # PostgreSQL
  python migrate_v1_to_v2.py --database-url "postgresql://user:pass@localhost/dbname" --execute
        """
    )
    
    parser.add_argument(
        "--database-url", 
        required=True,
        help="URL de conexión a la base de datos (ej: sqlite:///./database.db)"
    )
    
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--dry-run", 
        action="store_true",
        help="Simula la migración sin ejecutar cambios reales"
    )
    group.add_argument(
        "--execute", 
        action="store_true",
        help="Ejecuta la migración real"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Salida detallada"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Crear instancia de migración
    migration = DatabaseMigration(args.database_url, dry_run=args.dry_run)
    
    # Ejecutar migración
    success = migration.run_migration()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()