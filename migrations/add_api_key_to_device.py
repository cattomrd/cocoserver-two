#!/usr/bin/env python3
# run_migration.py - Script para ejecutar migración manualmente

import os
import sys
import logging
import argparse
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
import uuid
from dotenv import load_dotenv

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


load_dotenv()


user_db = os.environ.get('POSTGRES_USER')
password_db = os.environ.get('POSTGRES_PASSWORD')
db = os.environ.get('POSTGRES_DB')
server_db = os.environ.get('POSTGRES_HOST')

DATABASE_URL = f"postgresql://{user_db}:{password_db}@{server_db}/{db}"
# Obtener la conexión de base de datos desde variable de entorno o usar SQLite por defecto
# DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL")

def generate_api_key():
    """Genera una API Key aleatoria para dispositivos"""
    return str(uuid.uuid4())

def add_api_key_column():
    """Añade la columna api_key a la tabla devices si no existe"""
    engine = create_engine(DATABASE_URL)
    
    try:
        # Verificar si la columna ya existe
        with engine.connect() as conn:
            try:
                # Intentar seleccionar la columna api_key
                conn.execute(text("SELECT api_key FROM devices LIMIT 1"))
                logger.info("La columna api_key ya existe en la tabla devices")
                return False
            except SQLAlchemyError:
                logger.info("La columna api_key no existe. Procediendo a crearla...")
            
            # Añadir la columna
            conn.execute(text("ALTER TABLE devices ADD COLUMN api_key VARCHAR"))
            logger.info("Columna api_key añadida correctamente")
            
            # Generar y asignar API keys para dispositivos existentes
            result = conn.execute(text("SELECT device_id FROM devices"))
            devices = result.fetchall()
            
            for device in devices:
                device_id = device[0]
                api_key = generate_api_key()
                conn.execute(
                    text("UPDATE devices SET api_key = :api_key WHERE device_id = :device_id"),
                    {"api_key": api_key, "device_id": device_id}
                )
                logger.info(f"Asignada API key al dispositivo {device_id}")
            
            conn.commit()
            logger.info(f"Se actualizaron {len(devices)} dispositivos con nuevas API keys")
            return True
            
    except Exception as e:
        logger.error(f"Error al añadir la columna api_key: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ejecutar migración para añadir campo api_key")
    parser.add_argument("--force", action="store_true", help="Forzar la ejecución aunque la columna ya exista")
    args = parser.parse_args()
    
    logger.info(f"Conectando a la base de datos: {DATABASE_URL}")
    
    success = add_api_key_column()
    
    if success or args.force:
        logger.info("Migración completada exitosamente")
    else:
        logger.info("No se realizaron cambios en la base de datos")