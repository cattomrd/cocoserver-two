# utils/api_key_util.py
# Utilidad para manejar API keys de dispositivos

import uuid
import logging
from models.database import get_db, SessionLocal
from models.models import Device

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def generate_api_key():
    """Genera una API Key aleatoria para dispositivos"""
    return str(uuid.uuid4())

def assign_api_keys():
    """
    Asigna API Keys a todos los dispositivos que no tengan una.
    
    Returns:
        int: Número de dispositivos actualizados
    """
    db = SessionLocal()
    try:
        # Verificar si la columna api_key existe en la tabla Device
        try:
            # Intentar hacer una consulta que use la columna api_key
            db.query(Device.api_key).first()
            column_exists = True
        except Exception as e:
            logger.warning(f"La columna api_key no existe en la tabla Device: {e}")
            column_exists = False
            return 0
        
        if not column_exists:
            logger.info("La columna api_key no existe. Ejecute la migración primero.")
            return 0
        
        # Obtener dispositivos sin API Key
        devices_without_key = db.query(Device).filter(Device.api_key.is_(None)).all()
        
        logger.info(f"Se encontraron {len(devices_without_key)} dispositivos sin API key")
        
        # Asignar API Keys
        for device in devices_without_key:
            device.api_key = generate_api_key()
            logger.info(f"Asignada API key a dispositivo {device.device_id}: {device.api_key}")
        
        # Guardar cambios
        db.commit()
        
        return len(devices_without_key)
    except Exception as e:
        db.rollback()
        logger.error(f"Error al asignar API keys: {e}")
        return 0
    finally:
        db.close()

if __name__ == "__main__":
    """
    Ejecutar este script directamente para asignar API keys a todos los dispositivos
    que no tengan una asignada.
    
    Ejemplo:
        python -m utils.api_key_util
    """
    logger.info("Iniciando asignación de API keys a dispositivos...")
    count = assign_api_keys()
    logger.info(f"Se asignaron API keys a {count} dispositivos")