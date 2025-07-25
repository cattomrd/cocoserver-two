# models/schemas.py (reemplaza COMPLETAMENTE el archivo actual si ya existe)

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import List, Optional, ForwardRef
import warnings
warnings.filterwarnings("ignore", message="Valid config keys have changed in V2")

# Esquemas para Video
class VideoBase(BaseModel):
    title: str
    description: Optional[str] = None
    expiration_date: Optional[datetime] = None

class VideoCreate(VideoBase):
    pass

class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    expiration_date: Optional[datetime] = None

class VideoResponse(VideoBase):
    id: int
    file_path: str
    file_size: Optional[int] = None
    duration: Optional[int] = None
    upload_date: datetime
    
    class Config:
        orm_mode = True

# Esquemas para Playlist
class PlaylistBase(BaseModel):
    title: str = Field(..., max_length=255, description="Título de la playlist")
    description: Optional[str] = Field(None, description="Descripción de la playlist")
    start_date: Optional[datetime] = Field(None, description="Fecha de inicio de la playlist")
    expiration_date: Optional[datetime] = Field(None, description="Fecha de expiración de la playlist")
    is_active: bool = Field(True, description="Indica si la playlist está activa")
    id_tienda: Optional[str] = Field(None, max_length=10, description="Código de la tienda asociada")

class PlaylistCreate(PlaylistBase):
    pass

class PlaylistUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255, description="Título de la playlist")
    description: Optional[str] = Field(None, description="Descripción de la playlist")
    start_date: Optional[datetime] = Field(None, description="Fecha de inicio de la playlist")
    expiration_date: Optional[datetime] = Field(None, description="Fecha de expiración de la playlist")
    is_active: Optional[bool] = Field(None, description="Indica si la playlist está activa")
    id_tienda: Optional[str] = Field(None, max_length=10, description="Código de la tienda asociada")


# Forward refs para resolver referencias circulares
DeviceInfoRef = ForwardRef('DeviceInfo')

class PlaylistResponse(PlaylistBase):
    id: int
    creation_date: datetime
    updated_at: datetime
    video_count: Optional[int] = 0
    total_duration: Optional[int] = 0
    tienda_nombre: Optional[str] = None

    class Config:
        orm_mode = True

# Esquemas para Device
class DeviceBase(BaseModel):
    device_id: str
    name: str
    model: str
    ip_address_lan: Optional[str] = None
    ip_address_wifi: Optional[str] = None
    mac_address: str
    wlan0_mac: Optional[str] = None
    model: Optional[str] = None
    location: Optional[str] = None
    tienda: Optional[str] = None

class DeviceCreate(BaseModel):
    device_id: str
    name: Optional[str] = None
    model: Optional[str] = None
    mac_address: Optional[str] = None
    wlan0_mac: Optional[str] = None    
    ip_address_lan: Optional[str] = None
    ip_address_wifi: Optional[str] = None
    location: Optional[str] = None
    tienda: Optional[str] = None
    is_active: Optional[bool] = True
    videoloop_enabled: Optional[bool] = True
    kiosk_enabled: Optional[bool] = False
    service_logs: Optional[str] = None

    @validator('*', pre=True)
    def clean_string_fields(cls, v):
        """Limpia caracteres nulos y de control de todos los campos string"""
        if isinstance(v, str):
            # Remover caracteres nulos y otros caracteres problemáticos
            cleaned = v.replace('\x00', '').replace('\r', '').replace('\n', ' ')
            # Remover espacios extra y strip
            return ' '.join(cleaned.split())
        return v

    @validator('device_id')
    def validate_device_id(cls, v):
        """Validar que device_id no esté vacío después de limpieza"""
        if not v or not v.strip():
            raise ValueError('device_id no puede estar vacío')
        return v.strip()

    @validator('mac_address')
    def validate_mac_address(cls, v):
        """Validar formato de MAC address si se proporciona"""
        if v:
            import re
            # Patrón básico para MAC address
            mac_pattern = r'^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$'
            if not re.match(mac_pattern, v):
                raise ValueError('Formato de MAC address inválido')
        return v

    @validator('ip_address_lan', 'ip_address_wifi')
    def validate_ip_address(cls, v):
        """Validar formato de IP address si se proporciona"""
        if v:
            import ipaddress
            try:
                ipaddress.ip_address(v)
            except ValueError:
                raise ValueError('Formato de IP address inválido')
        return v

    class Config:
        # Permitir campos extra para compatibilidad
        extra = "ignore"

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    ip_address_lan: Optional[str] = None
    ip_address_wifi: Optional[str] = None
    location: Optional[str] = None
    tienda: Optional[str] = None
    is_active: Optional[bool] = None
    cpu_temp: Optional[float] = None
    memory_usage: Optional[float] = None
    disk_usage: Optional[float] = None

# Forward refs para resolver referencias circulares
PlaylistInfoRef = ForwardRef('PlaylistInfo')

class Device(DeviceBase):
    id: int
    is_active: bool
    cpu_temp: Optional[float] = None
    memory_usage: Optional[float] = None
    disk_usage: Optional[float] = None
    videoloop_status: Optional[str] = None
    kiosk_status: Optional[str] = None
    last_seen: datetime
    registered_at: datetime
    playlists: List[PlaylistInfoRef] = []

    class Config:
        orm_mode = True

# Esquemas simplificados para evitar recursión infinita
class DeviceInfo(BaseModel):
    device_id: str
    name: str
    is_active: bool
    location: Optional[str] = None
    tienda: Optional[str] = None

    class Config:
        orm_mode = True

class PlaylistInfo(BaseModel):
    id: int
    title: str
    is_active: bool
    start_date: Optional[datetime] = None  # Nueva fecha de inicio
    expiration_date: Optional[datetime] = None

    class Config:
        orm_mode = True

# Esquemas para DevicePlaylist
class DevicePlaylistBase(BaseModel):
    device_id: str
    playlist_id: int

class DevicePlaylistCreate(DevicePlaylistBase):
    pass

class DevicePlaylistResponse(DevicePlaylistBase):
    id: int
    assigned_at: datetime

    class Config:
        orm_mode = True

# Estado del dispositivo
class DeviceStatus(BaseModel):
    device_id: str
    ip_address_lan: Optional[str] = None
    ip_address_wifi: Optional[str] = None
    cpu_temp: float = Field(..., description="CPU temperature in Celsius")
    memory_usage: float = Field(..., description="Memory usage percentage")
    disk_usage: float = Field(..., description="Disk usage percentage")
    videoloop_status: Optional[str] = Field(None, description="Status of videoloop service")
    kiosk_status: Optional[str] = Field(None, description="Status of kiosk service")
    wlan0_mac: Optional[str] = Field(None, description="MAC address of WiFi interface")

# Servicio
class ServiceStatus(BaseModel):
    name: str
    status: str
    active: bool
    enabled: bool
    runtime: Optional[str] = None
    description: Optional[str] = None

class ServiceAction(BaseModel):
    action: str = Field(..., description="Action to perform: start, stop, restart, status")
    service: str = Field(..., description="Service name: videoloop or kiosk")

class ServiceActionResponse(BaseModel):
    device_id: str
    action: str
    service: str
    success: bool
    message: str
    timestamp: datetime = Field(default_factory=datetime.now)

# Resolver referencias circulares
PlaylistResponse.update_forward_refs()
Device.update_forward_refs()

# Agregar esto al archivo models/schemas.py

from pydantic import BaseModel, EmailStr, Field, validator
from typing import List, Optional
from datetime import datetime

# Esquema base para usuarios
class UserBase(BaseModel):
    username: str
    email: EmailStr
    fullname: Optional[str] = None
    is_active: bool = True
    is_admin: bool = False


# Esquema para creación de usuarios (registro)
class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    password_confirm: str = Field(..., min_length=6)

    @validator('password_confirm')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Las contraseñas no coinciden')
        return v

# Esquema para actualización de usuarios
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    fullname: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6)
    password_confirm: Optional[str] = Field(None, min_length=6)

# Esquema para cambiar contraseña
# class PasswordChange(BaseModel):
#     current_password: str
#     new_password: str = Field(..., min_length=8)
#     confirm_password: str

    @validator('password_confirm')
    def passwords_match(cls, v, values):
        if 'password' in values and values['password'] is not None and v != values['password']:
            raise ValueError('Las contraseñas no coinciden')
        return v
    
# Esquema para datos de usuario en respuestas
class UserResponse(UserBase):
    id: int
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class UserLogin(BaseModel):
    username: str
    password: str


# Esquema para solicitud de token (login)
class TokenRequest(BaseModel):
    username: str
    password: str

# Esquema para respuesta con token
class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse


class TiendaBase(BaseModel):
    """Esquema base para Tienda"""
    tienda: str = Field(..., description="Nombre de la tienda", min_length=1, max_length=100)
    location: Optional[str] = Field(None, description="Ubicación de la tienda", max_length=200)

    @validator('tienda')
    def validate_tienda_name(cls, v):
        """Validar que el nombre de la tienda no esté vacío"""
        if not v or not v.strip():
            raise ValueError('El nombre de la tienda no puede estar vacío')
        return v.strip()

    @validator('location')
    def validate_location(cls, v):
        """Limpiar y validar ubicación"""
        if v:
            return v.strip()
        return v

class TiendaCreate(TiendaBase):
    """Esquema para crear una nueva tienda"""
    pass

class TiendaUpdate(BaseModel):
    """Esquema para actualizar una tienda existente"""
    tienda: Optional[str] = Field(None, description="Nombre de la tienda", min_length=1, max_length=100)
    location: Optional[str] = Field(None, description="Ubicación de la tienda", max_length=200)

    @validator('tienda')
    def validate_tienda_name(cls, v):
        """Validar que el nombre de la tienda no esté vacío"""
        if v is not None and (not v or not v.strip()):
            raise ValueError('El nombre de la tienda no puede estar vacío')
        return v.strip() if v else v

    @validator('location')
    def validate_location(cls, v):
        """Limpiar y validar ubicación"""
        if v:
            return v.strip()
        return v

class TiendaResponse(TiendaBase):
    """Esquema de respuesta para Tienda"""
    id: int = Field(..., description="ID único de la tienda")
    
    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "id": 1,
                "tienda": "Tienda Centro",
                "location": "Centro Comercial Plaza Norte"
            }
        }

class TiendaWithDevices(TiendaResponse):
    """Esquema de tienda con información de dispositivos"""
    device_count: int = Field(0, description="Número total de dispositivos en esta tienda")
    active_device_count: int = Field(0, description="Número de dispositivos activos en esta tienda")
    
    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "id": 1,
                "tienda": "Tienda Centro",
                "location": "Centro Comercial Plaza Norte",
                "device_count": 5,
                "active_device_count": 3
            }
        }

class TiendaInfo(BaseModel):
    """Esquema simplificado para información de tienda"""
    id: int
    tienda: str
    
    class Config:
        orm_mode = True

# ==========================================
# ESQUEMAS PARA FILTROS Y BÚSQUEDA
# ==========================================

class TiendaFilter(BaseModel):
    """Esquema para filtrar tiendas"""
    search: Optional[str] = Field(None, description="Término de búsqueda")
    active_only: Optional[bool] = Field(False, description="Solo tiendas con dispositivos activos")
    with_devices: Optional[bool] = Field(False, description="Incluir conteo de dispositivos")

class TiendaSearchResponse(BaseModel):
    """Esquema de respuesta para búsqueda de tiendas"""
    tiendas: List[TiendaResponse]
    total: int
    search_term: Optional[str] = None
    
    class Config:
        schema_extra = {
            "example": {
                "tiendas": [
                    {
                        "id": 1,
                        "tienda": "Tienda Centro",
                        "location": "Centro Comercial Plaza Norte"
                    }
                ],
                "total": 1,
                "search_term": "centro"
            }
        }