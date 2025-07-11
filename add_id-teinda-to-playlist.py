# Migración para agregar campo id_tienda a la tabla playlists
# Archivo: migrations/add_tienda_to_playlists.py

#!/usr/bin/env python3
"""
Migración para agregar campo id_tienda a la tabla playlists
Este campo permitirá asociar playlists con ubicaciones/tiendas específicas

CONCEPTO: location -> tienda
- id_tienda representa la ubicación/localización de la playlist
- Compatible con el campo 'tienda' usado en devices
- Permite playlists generales (NULL) y específicas por ubicación
- Facilita filtrado y asignación automática por ubicación
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

def get_database_url():
    """Obtener URL de base de datos desde variables de entorno"""
    user_db = os.environ.get('POSTGRES_USER')
    password_db = os.environ.get('POSTGRES_PASSWORD')
    db = os.environ.get('POSTGRES_DB')
    server_db = os.environ.get('POSTGRES_HOST')
    
    if all([user_db, password_db, db, server_db]):
        return f"postgresql://{user_db}:{password_db}@{server_db}/{db}"
    
    # Fallback a SQLite si no hay configuración PostgreSQL
    return "sqlite:///./database.db"

def check_column_exists(conn, table_name, column_name):
    """Verifica si una columna existe en la tabla"""
    try:
        # Para PostgreSQL
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = :table_name AND column_name = :column_name
        """), {"table_name": table_name, "column_name": column_name})
        
        return result.fetchone() is not None
    except Exception:
        try:
            # Para SQLite
            result = conn.execute(text(f"PRAGMA table_info({table_name})"))
            columns = [row[1] for row in result.fetchall()]
            return column_name in columns
        except Exception:
            return False

def run_migration():
    """Ejecuta la migración para agregar id_tienda a playlists"""
    print("=== MIGRACIÓN: Agregar campo id_tienda a playlists ===")
    
    database_url = get_database_url()
    print(f"Conectando a: {database_url.split('@')[-1] if '@' in database_url else database_url}")
    
    try:
        engine = create_engine(database_url)
        dialect = engine.dialect.name
        
        with engine.begin() as conn:
            # Verificar si la tabla playlists existe
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            
            if 'playlists' not in tables:
                print("❌ La tabla 'playlists' no existe")
                return False
            
            # Verificar si la columna ya existe
            if check_column_exists(conn, 'playlists', 'id_tienda'):
                print("✅ La columna 'id_tienda' ya existe en la tabla playlists")
                return True
            
            print("📝 Agregando columna id_tienda a la tabla playlists...")
            
            # Crear la columna según el tipo de base de datos
            if dialect == 'postgresql':
                migration_sql = """
                    ALTER TABLE playlists 
                    ADD COLUMN id_tienda VARCHAR(10) DEFAULT NULL;
                """
            else:  # SQLite
                migration_sql = """
                    ALTER TABLE playlists 
                    ADD COLUMN id_tienda TEXT DEFAULT NULL;
                """
            
            conn.execute(text(migration_sql))
            print("✅ Columna id_tienda agregada exitosamente")
            
            # Crear índice para mejorar el rendimiento de las consultas por tienda
            index_sql = """
                CREATE INDEX IF NOT EXISTS idx_playlists_tienda 
                ON playlists(id_tienda);
            """
            conn.execute(text(index_sql))
            print("✅ Índice creado para id_tienda")
            
            # Verificar que la migración fue exitosa
            if check_column_exists(conn, 'playlists', 'id_tienda'):
                print("🎉 Migración completada exitosamente")
                
                # Mostrar estructura actualizada
                print("\n📋 Estructura actualizada de la tabla playlists:")
                if dialect == 'postgresql':
                    result = conn.execute(text("""
                        SELECT column_name, data_type, is_nullable 
                        FROM information_schema.columns 
                        WHERE table_name = 'playlists'
                        ORDER BY ordinal_position
                    """))
                    for row in result:
                        nullable = "NULL" if row[2] == "YES" else "NOT NULL"
                        print(f"  - {row[0]} ({row[1]}) {nullable}")
                else:  # SQLite
                    result = conn.execute(text("PRAGMA table_info(playlists)"))
                    for row in result:
                        nullable = "NULL" if row[3] == 0 else "NOT NULL"
                        print(f"  - {row[1]} ({row[2]}) {nullable}")
                
                return True
            else:
                print("❌ Error: La migración no se aplicó correctamente")
                return False
                
    except Exception as e:
        print(f"❌ Error durante la migración: {str(e)}")
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)