# utils/location_utils.py
"""
Utilidades para manejo consistente de ubicaciones/tiendas
Proporciona funciones centralizadas para la gestión de la relación location:tienda
"""

from typing import Dict, List, Optional, Tuple
from enum import Enum

class TiendaCode(str, Enum):
    """Enum para códigos de tienda válidos"""
    SDQ = "SDQ"  # Santo Domingo
    STI = "STI"  # Santiago  
    PUJ = "PUJ"  # Punta Cana
    LRM = "LRM"  # La Romana
    BAY = "BAY"  # Bayahíbe
    SDE = "SDE"  # Santo Domingo Este
    SDN = "SDN"  # Santo Domingo Norte
    SDO = "SDO"  # Santo Domingo Oeste

# Mapeo centralizado de códigos a nombres
TIENDAS_MAP: Dict[str, str] = {
    TiendaCode.SDQ: 'Santo Domingo',
    TiendaCode.STI: 'Santiago',
    TiendaCode.PUJ: 'Punta Cana', 
    TiendaCode.LRM: 'La Romana',
    TiendaCode.BAY: 'Bayahíbe',
    TiendaCode.SDE: 'Santo Domingo Este',
    TiendaCode.SDN: 'Santo Domingo Norte',
    TiendaCode.SDO: 'Santo Domingo Oeste'
}

def get_tienda_nombre(codigo_tienda: Optional[str]) -> str:
    """
    Obtiene el nombre completo de una tienda basado en su código
    
    Args:
        codigo_tienda: Código de la tienda (puede ser None)
        
    Returns:
        str: Nombre completo de la tienda o 'Sin asignar' si no hay código
    """
    if not codigo_tienda:
        return 'Sin asignar'
    return TIENDAS_MAP.get(codigo_tienda.upper(), codigo_tienda)

def get_valid_tienda_codes() -> List[str]:
    """
    Obtiene lista de códigos de tienda válidos
    
    Returns:
        List[str]: Lista de códigos válidos
    """
    return [code.value for code in TiendaCode]

def validate_tienda_code(codigo_tienda: Optional[str]) -> bool:
    """
    Valida si un código de tienda es válido
    
    Args:
        codigo_tienda: Código a validar
        
    Returns:
        bool: True si es válido, False en caso contrario
    """
    if not codigo_tienda:
        return True  # None/vacío es válido (playlist general)
    return codigo_tienda.upper() in get_valid_tienda_codes()

def normalize_tienda_code(codigo_tienda: Optional[str]) -> Optional[str]:
    """
    Normaliza un código de tienda (convierte a mayúsculas)
    
    Args:
        codigo_tienda: Código a normalizar
        
    Returns:
        Optional[str]: Código normalizado o None
    """
    if not codigo_tienda or not codigo_tienda.strip():
        return None
    
    normalized = codigo_tienda.strip().upper()
    return normalized if validate_tienda_code(normalized) else None

def get_tiendas_for_select() -> List[Tuple[str, str]]:
    """
    Obtiene lista de tiendas formateada para selectores HTML
    
    Returns:
        List[Tuple[str, str]]: Lista de tuplas (codigo, nombre_completo)
    """
    return [(code, f"{code} - {name}") for code, name in TIENDAS_MAP.items()]

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
    
    # Misma ubicación
    return normalize_tienda_code(playlist_location) == normalize_tienda_code(device_location)

def get_playlists_filter_options() -> List[Dict[str, str]]:
    """
    Obtiene opciones para filtros de playlist en frontend
    
    Returns:
        List[Dict]: Lista de opciones con 'value' y 'label'
    """
    options = [{"value": "", "label": "Todas las ubicaciones"}]
    
    for code, name in TIENDAS_MAP.items():
        options.append({
            "value": code,
            "label": f"{code} - {name}"
        })
    
    return options

def get_location_stats_summary(playlists_by_location: Dict[str, int]) -> Dict:
    """
    Genera resumen de estadísticas por ubicación
    
    Args:
        playlists_by_location: Diccionario con conteos por ubicación
        
    Returns:
        Dict: Resumen con estadísticas formateadas
    """
    total_playlists = sum(playlists_by_location.values())
    general_playlists = playlists_by_location.get(None, 0) + playlists_by_location.get('', 0)
    
    location_breakdown = []
    for location_code, count in playlists_by_location.items():
        if location_code and location_code.strip():  # Excluir generales
            location_breakdown.append({
                'codigo': location_code,
                'nombre': get_tienda_nombre(location_code),
                'cantidad': count,
                'porcentaje': round((count / total_playlists * 100) if total_playlists > 0 else 0, 1)
            })
    
    return {
        'total_playlists': total_playlists,
        'general_playlists': general_playlists,
        'ubicaciones_especificas': len(location_breakdown),
        'breakdown_por_ubicacion': sorted(location_breakdown, key=lambda x: x['cantidad'], reverse=True)
    }

# Funciones de utilidad para templates
def get_location_badge_class(codigo_tienda: Optional[str]) -> str:
    """
    Obtiene la clase CSS apropiada para el badge de ubicación
    
    Args:
        codigo_tienda: Código de la tienda
        
    Returns:
        str: Clase CSS para el badge
    """
    if not codigo_tienda:
        return "badge bg-secondary"
    return "location-badge"

def format_location_display(codigo_tienda: Optional[str], show_code: bool = True) -> str:
    """
    Formatea la visualización de ubicación para templates
    
    Args:
        codigo_tienda: Código de la tienda
        show_code: Si mostrar el código además del nombre
        
    Returns:
        str: Texto formateado para mostrar
    """
    if not codigo_tienda:
        return "General"
    
    nombre = get_tienda_nombre(codigo_tienda)
    if show_code and codigo_tienda != nombre:
        return f"{codigo_tienda} - {nombre}"
    return nombre

# Constantes para JavaScript/Frontend
FRONTEND_CONFIG = {
    "tiendas_map": TIENDAS_MAP,
    "valid_codes": get_valid_tienda_codes(),
    "filter_options": get_playlists_filter_options()
}