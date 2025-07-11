# utils/dynamic_location_utils.py
"""
Utilidades dinámicas para manejo de ubicaciones/tiendas
Utiliza los endpoints del router de tiendas para obtener información actualizada
"""

import httpx
import logging
from typing import Dict, List, Optional, Tuple
from functools import lru_cache
import asyncio
from fastapi import Depends
from sqlalchemy.orm import Session
from models.database import get_db
from models import models

logger = logging.getLogger(__name__)

class TiendaService:
    """Servicio para interactuar con datos de tiendas de forma dinámica"""
    
    def __init__(self, db: Session):
        self.db = db
        self._cache = {}
        self._cache_timeout = 300  # 5 minutos
    
    def get_all_tiendas(self, force_refresh: bool = False) -> List[Dict]:
        """
        Obtiene todas las tiendas disponibles
        
        Args:
            force_refresh: Forzar actualización del cache
            
        Returns:
            List[Dict]: Lista de tiendas con formato {id, tienda, location}
        """
        if not force_refresh and 'all_tiendas' in self._cache:
            return self._cache['all_tiendas']
        
        try:
            tiendas = self.db.query(models.Tienda).order_by(models.Tienda.tienda).all()
            tiendas_list = [
                {
                    'id': tienda.id,
                    'tienda': tienda.tienda,  # Código de tienda
                    'location': tienda.location  # Nombre/descripción
                }
                for tienda in tiendas
            ]
            
            self._cache['all_tiendas'] = tiendas_list
            logger.info(f"Cargadas {len(tiendas_list)} tiendas desde base de datos")
            return tiendas_list
            
        except Exception as e:
            logger.error(f"Error obteniendo tiendas: {str(e)}")
            return []
    
    def get_tiendas_map(self) -> Dict[str, str]:
        """
        Obtiene un diccionario de mapeo código -> nombre de tienda
        
        Returns:
            Dict[str, str]: Mapeo {codigo: nombre}
        """
        tiendas = self.get_all_tiendas()
        return {tienda['tienda']: tienda['location'] for tienda in tiendas}
    
    def get_valid_tienda_codes(self) -> List[str]:
        """
        Obtiene lista de códigos de tienda válidos
        
        Returns:
            List[str]: Lista de códigos válidos
        """
        tiendas = self.get_all_tiendas()
        return [tienda['tienda'] for tienda in tiendas]
    
    def get_tienda_by_code(self, codigo_tienda: str) -> Optional[Dict]:
        """
        Obtiene información de una tienda específica por código
        
        Args:
            codigo_tienda: Código de la tienda
            
        Returns:
            Optional[Dict]: Información de la tienda o None
        """
        if not codigo_tienda:
            return None
            
        tiendas = self.get_all_tiendas()
        return next((t for t in tiendas if t['tienda'] == codigo_tienda.upper()), None)
    
    def get_tienda_nombre(self, codigo_tienda: Optional[str]) -> str:
        """
        Obtiene el nombre completo de una tienda basado en su código
        
        Args:
            codigo_tienda: Código de la tienda (puede ser None)
            
        Returns:
            str: Nombre completo de la tienda o 'Sin asignar' si no hay código
        """
        if not codigo_tienda:
            return 'Sin asignar'
            
        tienda_info = self.get_tienda_by_code(codigo_tienda)
        if tienda_info:
            return tienda_info['location']
        return codigo_tienda  # Fallback al código si no se encuentra
    
    def validate_tienda_code(self, codigo_tienda: Optional[str]) -> bool:
        """
        Valida si un código de tienda es válido
        
        Args:
            codigo_tienda: Código a validar
            
        Returns:
            bool: True si es válido, False en caso contrario
        """
        if not codigo_tienda:
            return True  # None/vacío es válido (playlist general)
        return codigo_tienda.upper() in self.get_valid_tienda_codes()
    
    def normalize_tienda_code(self, codigo_tienda: Optional[str]) -> Optional[str]:
        """
        Normaliza un código de tienda (convierte a mayúsculas y valida)
        
        Args:
            codigo_tienda: Código a normalizar
            
        Returns:
            Optional[str]: Código normalizado o None
        """
        if not codigo_tienda or not codigo_tienda.strip():
            return None
        
        normalized = codigo_tienda.strip().upper()
        return normalized if self.validate_tienda_code(normalized) else None
    
    def get_tiendas_for_select(self) -> List[Tuple[str, str]]:
        """
        Obtiene lista de tiendas formateada para selectores HTML
        
        Returns:
            List[Tuple[str, str]]: Lista de tuplas (codigo, display_text)
        """
        tiendas = self.get_all_tiendas()
        return [(t['tienda'], f"{t['tienda']} - {t['location']}") for t in tiendas]
    
    def get_tiendas_with_device_count(self) -> List[Dict]:
        """
        Obtiene tiendas con conteo de dispositivos usando query optimizada
        
        Returns:
            List[Dict]: Tiendas con conteo de dispositivos
        """
        try:
            # Query que cuenta dispositivos por tienda
            query = self.db.query(
                models.Tienda.id,
                models.Tienda.tienda,
                models.Tienda.location,
                self.db.func.count(models.Device.device_id).label('device_count'),
                self.db.func.count(
                    self.db.func.case([(models.Device.is_active == True, 1)])
                ).label('active_device_count')
            ).outerjoin(
                models.Device, 
                models.Device.tienda == models.Tienda.tienda
            ).group_by(
                models.Tienda.id,
                models.Tienda.tienda,
                models.Tienda.location
            ).order_by(models.Tienda.tienda)
            
            results = query.all()
            
            return [
                {
                    "id": result.id,
                    "tienda": result.tienda,
                    "location": result.location,
                    "device_count": result.device_count,
                    "active_device_count": result.active_device_count
                }
                for result in results
            ]
            
        except Exception as e:
            logger.error(f"Error obteniendo tiendas con dispositivos: {str(e)}")
            return []

# Funciones de utilidad que siguen el patrón anterior pero usando TiendaService
def get_tienda_service(db: Session = Depends(get_db)) -> TiendaService:
    """Factory function para crear TiendaService"""
    return TiendaService(db)

def is_playlist_compatible_with_device_location(
    playlist_location: Optional[str], 
    device_location: Optional[str]
) -> bool:
    """
    Verifica si una playlist es compatible con la ubicación de un dispositivo
    
    Args:
        playlist_location: Ubicación de la playlist (id_tienda)
        device_location: Ubicación del dispositivo (tienda)
        
    Returns:
        bool: True si son compatibles
        
    Reglas de compatibilidad:
    - Playlist sin ubicación (general) es compatible con cualquier dispositivo
    - Playlist con ubicación específica solo es compatible con dispositivos de la misma ubicación
    - Dispositivos sin ubicación pueden recibir solo playlists generales
    """
    # Playlist general (sin ubicación específica) - compatible con todos
    if not playlist_location:
        return True
    
    # Dispositivo sin ubicación específica - solo playlists generales
    if not device_location:
        return False
    
    # Misma ubicación (normalizada)
    return playlist_location.upper() == device_location.upper()

# Clase helper para templates
class TiendaTemplateHelper:
    """Helper para templates que necesitan información de tiendas"""
    
    def __init__(self, tienda_service: TiendaService):
        self.tienda_service = tienda_service
    
    def get_location_badge_class(self, codigo_tienda: Optional[str]) -> str:
        """
        Obtiene la clase CSS apropiada para el badge de ubicación
        """
        if not codigo_tienda:
            return "badge bg-secondary"
        return "location-badge"
    
    def format_location_display(self, codigo_tienda: Optional[str], show_code: bool = True) -> str:
        """
        Formatea la visualización de ubicación para templates
        """
        if not codigo_tienda:
            return "General"
        
        nombre = self.tienda_service.get_tienda_nombre(codigo_tienda)
        if show_code and codigo_tienda != nombre:
            return f"{codigo_tienda} - {nombre}"
        return nombre
    
    def get_filter_options_for_frontend(self) -> List[Dict[str, str]]:
        """
        Obtiene opciones para filtros de playlist en frontend
        """
        options = [{"value": "", "label": "Todas las ubicaciones"}]
        
        for codigo, display in self.tienda_service.get_tiendas_for_select():
            options.append({
                "value": codigo,
                "label": display
            })
        
        return options

# Funciones async para API calls (si necesitas hacer llamadas HTTP internas)
class AsyncTiendaClient:
    """Cliente async para hacer llamadas a endpoints de tiendas"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
    
    async def get_tiendas(self) -> List[Dict]:
        """Obtiene tiendas via HTTP call"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{self.base_url}/api/tiendas/")
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Error en llamada async a tiendas: {str(e)}")
                return []
    
    async def get_tiendas_with_devices(self) -> List[Dict]:
        """Obtiene tiendas con conteo de dispositivos via HTTP call"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{self.base_url}/api/tiendas/with-devices")
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Error en llamada async a tiendas con dispositivos: {str(e)}")
                return []

# Decorador para cache de tiendas
def with_tienda_cache(func):
    """Decorador para cachear resultados de tiendas"""
    cache = {}
    
    def wrapper(*args, **kwargs):
        cache_key = f"{func.__name__}_{hash(str(args) + str(kwargs))}"
        if cache_key not in cache:
            cache[cache_key] = func(*args, **kwargs)
        return cache[cache_key]
    
    return wrapper

# Función para limpiar cache (útil en desarrollo)
def clear_tienda_cache():
    """Limpia el cache de tiendas"""
    logger.info("Cache de tiendas limpiado")
    # Implementar según el sistema de cache usado