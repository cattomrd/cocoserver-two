from models.database import SessionLocal
from models.models import Device
import uuid

# Abrir sesión de base de datos
db = SessionLocal()

# Buscar dispositivo
device_id = "dca632104df8"  # Reemplaza con tu device_id
device = db.query(Device).filter(Device.device_id == device_id).first()

if device:
    # Mostrar API key existente
    print(f"API key para {device.device_id}: {device.api_key}")
    
    # Si no tiene API key, generar una
    if not device.api_key:
        device.api_key = str(uuid.uuid4())
        db.commit()
        print(f"Nueva API key generada: {device.api_key}")
else:
    print(f"Dispositivo {device_id} no encontrado")

db.close()
