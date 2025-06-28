# ==========================================
# ARCHIVO: tasks/session_cleanup.py
# Tarea de limpieza automática de sesiones
# ==========================================

import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models.database import get_db
from utils.session_manager import SessionManager

logger = logging.getLogger(__name__)

class SessionCleanupTask:
    """Tarea para limpiar sesiones expiradas automáticamente"""
    
    def __init__(self, interval_hours: int = 1):
        self.interval_hours = interval_hours
        self.is_running = False
    
    async def start(self):
        """Iniciar tarea de limpieza"""
        if self.is_running:
            logger.warning("Tarea de limpieza ya está ejecutándose")
            return
        
        self.is_running = True
        logger.info(f"Iniciando tarea de limpieza de sesiones (intervalo: {self.interval_hours}h)")
        
        while self.is_running:
            try:
                await self._cleanup_sessions()
                await asyncio.sleep(self.interval_hours * 3600)  # Convertir horas a segundos
            except Exception as e:
                logger.error(f"Error en tarea de limpieza: {str(e)}")
                await asyncio.sleep(300)  # Esperar 5 minutos en caso de error
    
    def stop(self):
        """Detener tarea de limpieza"""
        self.is_running = False
        logger.info("Deteniendo tarea de limpieza de sesiones")
    
    async def _cleanup_sessions(self):
        """Ejecutar limpieza de sesiones"""
        try:
            # Obtener sesión de BD
            db = next(get_db())
            
            # Limpiar sesiones expiradas
            expired_count = SessionManager.cleanup_expired_sessions(db)
            
            if expired_count > 0:
                logger.info(f"Limpieza completada: {expired_count} sesiones expiradas eliminadas")
            
            db.close()
            
        except Exception as e:
            logger.error(f"Error ejecutando limpieza: {str(e)}")