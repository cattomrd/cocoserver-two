#!/usr/bin/env python3
"""
Script de migración para agregar campos faltantes a la tabla videos
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

def get_database_url():
    """Obtener URL de base de datos"""
    if os.environ.get('POSTGRES_HOST'):
        # PostgreSQL
        user = os.environ.get('POSTGRES_USER')
        password = os.environ.get('POSTGRES_PASSWORD')
        db = os.environ.get('POSTGRES_DB')
        host = os.environ.get('POSTGRES_HOST')
        return f"postgresql://{user}:{password}@{host}/{db}"
    else:
        # SQLite
        return "sqlite:///./data.db"

def check_column_exists(conn, table_name, column_name):
    """Verificar si una columna existe"""
    try:
        inspector = inspect(conn)
        columns = [col['name'] for col in inspector.get_columns(table_name)]
        return column_name in columns
    except Exception:
        return False

def migrate_video_table():
    """Migrar tabla videos para agregar campos faltantes"""
    print("=== MIGRACIÓN TABLA VIDEOS ===")
    
    database_url = get_database_url()
    print(f"Conectando a: {database_url.split('@')[-1] if '@' in database_url else database_url}")
    
    try:
        engine = create_engine(database_url)
        
        with engine.begin() as conn:
            print("Verificando estructura de la tabla videos...")
            
            # Campos a agregar si no existen
            fields_to_add = {
                'filename': 'VARCHAR(255)',
                'tags': 'TEXT',
                'is_active': 'BOOLEAN DEFAULT true',
                'thumbnail': 'VARCHAR(500)'
            }
            
            for field_name, field_type in fields_to_add.items():
                if not check_column_exists(conn, 'videos', field_name):
                    print(f"Agregando campo {field_name}...")
                    try:
                        if 'postgresql' in database_url:
                            sql = f"ALTER TABLE videos ADD COLUMN {field_name} {field_type}"
                        else:  # SQLite
                            sql = f"ALTER TABLE videos ADD COLUMN {field_name} {field_type}"
                        
                        conn.execute(text(sql))
                        print(f"✅ Campo {field_name} agregado")
                    except Exception as e:
                        print(f"❌ Error agregando {field_name}: {e}")
                else:
                    print(f"✅ Campo {field_name} ya existe")
            
            # Verificar y actualizar tabla playlist_videos si es necesario
            print("\nVerificando tabla playlist_videos...")
            if not check_column_exists(conn, 'playlist_videos', 'position'):
                print("Agregando campo position a playlist_videos...")
                try:
                    sql = "ALTER TABLE playlist_videos ADD COLUMN position INTEGER DEFAULT 0"
                    conn.execute(text(sql))
                    print("✅ Campo position agregado")
                except Exception as e:
                    print(f"❌ Error agregando position: {e}")
            else:
                print("✅ Campo position ya existe")
            
        print("\n✅ Migración completada exitosamente")
        return True
        
    except Exception as e:
        print(f"❌ Error en migración: {e}")
        return False

if __name__ == "__main__":
    success = migrate_video_table()
    sys.exit(0 if success else 1)