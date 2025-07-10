# models/schemas.py - VERSIÓN CORREGIDA Y LIMPIA

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import List, Optional, ForwardRef
import warnings
warnings.filterwarnings("ignore", message="Valid config keys have changed in V2")

# ========================================
# ESQUEMAS PARA VIDEO
# ========================================

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

# ========================================
# ESQUEMAS PARA PLAYLIST (ACTUALIZADOS CON TIENDAS)
# ========================================

class PlaylistBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Título de la playlist")
    description: Optional[str] = Field(None, description="Descripción opcional de la playlist")
    start_date: Optional[datetime] = Field(None, description="Fecha de inicio de la playlist")
    expiration_date: Optional[datetime] = Field(None, description="Fecha de expiración de la playlist")
    is_active: bool = Field(True, description="Indica si la playlist está activa")
    # NUEVO CAMPO: Soporte para tiendas
    id_tienda: Optional[str] = Field(None, max_length=10, description="Código de la tienda/ubicación")

    @validator('id_tienda')
    def validate_tienda_code(cls, v):
        """Validar formato básico del código de tienda"""
        if v is not None and v.strip():
            # Normalizar a mayúsculas y validar longitud
            v = v.strip().upper()
            if len(v) < 2 or len(v) > 10:
                raise ValueError('Código de tienda debe tener entre 2 y 10 caracteres')
            # Validar que solo contenga letras y números
            if not v.replace('_', '').replace('-', '').isalnum():
                raise ValueError('Código de tienda solo puede contener letras, números, guiones y guiones bajos')
            return v
        return None

class PlaylistCreate(PlaylistBase):
    """Esquema para crear una nueva playlist"""
    
    @validator('expiration_date')
    def expiration_after_start(cls, v, values):
        """Validar que la fecha de expiración sea posterior a la de inicio SOLO al crear"""
        if v and 'start_date' in values and values['start_date']:
            if v <= values['start_date']:
                raise ValueError('La fecha de expiración debe ser posterior a la fecha de inicio')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "title": "Promociones Enero 2025",
                "description": "Lista de videos promocionales para enero",
                "start_date": "2025-01-01T00:00:00",
                "expiration_date": "2025-01-31T23:59:59",
                "is_active": True,
                "id_tienda": "SDQ"
            }
        }

class PlaylistUpdate(BaseModel):
    """Esquema para actualizar una playlist existente"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    id_tienda: Optional[str] = Field(None, max_length=10)

    @validator('expiration_date')
    def expiration_after_start(cls, v, values):
        """Validar que la fecha de expiración sea posterior a la de inicio SOLO al actualizar"""
        if v and 'start_date' in values and values['start_date']:
            if v <= values['start_date']:
                raise ValueError('La fecha de expiración debe ser posterior a la fecha de inicio')
        return v

    @validator('id_tienda')
    def validate_tienda_code(cls, v):
        """Validar formato básico del código de tienda"""
        if v is not None and v.strip():
            v = v.strip().upper()
            if len(v) < 2 or len(v) > 10:
                raise ValueError('Código de tienda debe tener entre 2 y 10 caracteres')
            if not v.replace('_', '').replace('-', '').isalnum():
                raise ValueError('Código de tienda solo puede contener letras, números, guiones y guiones bajos')
            return v
        return None

# Forward refs para resolver referencias circulares
DeviceInfoRef = ForwardRef('DeviceInfo')
PlaylistInfoRef = ForwardRef('PlaylistInfo')

class PlaylistResponse(BaseModel):
    """Esquema de respuesta para playlist - SIN validaciones restrictivas para datos existentes"""
    id: int
    title: str
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    is_active: bool = True
    id_tienda: Optional[str] = None
    creation_date: datetime
    updated_at: datetime
    videos: List[VideoResponse] = []
    devices: List[DeviceInfoRef] = []
    
    # Campos calculados (opcionales)
    video_count: Optional[int] = Field(None, description="Número de videos en la playlist")
    total_duration: Optional[int] = Field(None, description="Duración total en segundos")
    tienda_nombre: Optional[str] = Field(None, description="Nombre completo de la tienda")
    
    class Config:
        orm_mode = True

# ========================================
# ESQUEMAS PARA DEVICE
# ========================================

class DeviceBase(BaseModel):
    device_id: str = Field(..., description="ID único del dispositivo")
    name: str = Field(..., description="Nombre del dispositivo")
    model: Optional[str] = Field(None, description="Modelo del dispositivo")
    ip_address_lan: Optional[str] = Field(None, description="Dirección IP LAN")
    ip_address_wifi: Optional[str] = Field(None, description="Dirección IP WiFi")
    mac_address: str = Field(..., description="Dirección MAC principal")
    wlan0_mac: Optional[str] = Field(None, description="Dirección MAC WiFi")
    location: Optional[str] = Field(None, description="Ubicación física del dispositivo")
    tienda: Optional[str] = Field(None, description="Código de tienda del dispositivo")

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    ip_address_lan: Optional[str] = None
    ip_address_wifi: Optional[str] = None
    mac_address: Optional[str] = None
    wlan0_mac: Optional[str] = None
    location: Optional[str] = None
    tienda: Optional[str] = None
    is_active: Optional[bool] = None

# ========================================
# ESQUEMAS SIMPLIFICADOS PARA EVITAR RECURSIÓN
# ========================================

class DeviceInfo(BaseModel):
    """Esquema simplificado para información básica de dispositivo"""
    device_id: str
    name: str
    tienda: Optional[str] = None
    is_active: bool = True
    location: Optional[str] = None
    
    class Config:
        orm_mode = True

class PlaylistInfo(BaseModel):
    """Esquema simplificado para información básica de playlist"""
    id: int
    title: str
    is_active: bool = True
    start_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    description: Optional[str] = None
    id_tienda: Optional[str] = None
    
    class Config:
        orm_mode = True

class Device(DeviceBase):
    id: int
    is_active: bool = True
    cpu_temp: Optional[float] = None
    memory_usage: Optional[float] = None
    disk_usage: Optional[float] = None
    videoloop_status: Optional[str] = None
    kiosk_status: Optional[str] = None
    videoloop_enabled: Optional[bool] = True
    kiosk_enabled: Optional[bool] = False
    last_seen: Optional[datetime] = None
    registered_at: datetime
    
    class Config:
        orm_mode = True

# ========================================
# ESQUEMAS PARA DEVICE PLAYLIST
# ========================================

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

# ========================================
# ESQUEMAS PARA ESTADO DEL DISPOSITIVO
# ========================================

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

# ========================================
# ESQUEMAS PARA SERVICIOS
# ========================================

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

# ========================================
# ESQUEMAS PARA USUARIOS (CORREGIDOS)
# ========================================

class UserBase(BaseModel):
    username: str
    email: str
    fullname: Optional[str] = None
    is_active: bool = True
    is_admin: bool = False

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    password_confirm: str = Field(..., min_length=6)

    @validator('password_confirm')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Las contraseñas no coinciden')
        return v

class UserUpdate(BaseModel):
    email: Optional[str] = None
    fullname: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6)
    password_confirm: Optional[str] = Field(None, min_length=6)

    @validator('password_confirm')
    def passwords_match(cls, v, values):
        if 'password' in values and values['password'] is not None and v != values['password']:
            raise ValueError('Las contraseñas no coinciden')
        return v

class UserResponse(UserBase):
    id: int
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class UserLogin(BaseModel):
    username: str
    password: str

class TokenRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse

# ========================================
# ESQUEMAS PARA TIENDAS
# ========================================

class TiendaBase(BaseModel):
    tienda: str = Field(..., min_length=2, max_length=10, description="Código de la tienda")
    location: str = Field(..., min_length=1, max_length=255, description="Ubicación/nombre de la tienda")

class TiendaCreate(TiendaBase):
    pass

class TiendaUpdate(BaseModel):
    tienda: Optional[str] = Field(None, min_length=2, max_length=10)
    location: Optional[str] = Field(None, min_length=1, max_length=255)

class TiendaResponse(TiendaBase):
    id: int

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "id": 1,
                "tienda": "SDQ",
                "location": "Santo Domingo"
            }
        }

class TiendaWithDevices(TiendaResponse):
    """Esquema de tienda con información de dispositivos"""
    device_count: int = Field(0, description="Número total de dispositivos en esta tienda")
    active_device_count: int = Field(0, description="Número de dispositivos activos en esta tienda")

    class Config:
        orm_mode = True

# ========================================
# ESQUEMAS PARA VALIDACIÓN DE FORMS
# ========================================

class PlaylistFormData(BaseModel):
    """Esquema para datos de formulario de playlist desde frontend"""
    title: str
    description: str = ""
    start_date: Optional[str] = None  # Viene como string desde form
    expiration_date: Optional[str] = None  # Viene como string desde form
    is_active: bool = True
    id_tienda: str = ""  # Viene como string, puede estar vacío

    def to_playlist_create(self) -> PlaylistCreate:
        """Convierte datos de formulario a PlaylistCreate"""
        start_dt = None
        if self.start_date:
            try:
                start_dt = datetime.fromisoformat(self.start_date.replace('Z', '+00:00'))
            except:
                pass
        
        exp_dt = None
        if self.expiration_date:
            try:
                exp_dt = datetime.fromisoformat(self.expiration_date.replace('Z', '+00:00'))
            except:
                pass
        
        return PlaylistCreate(
            title=self.title,
            description=self.description if self.description else None,
            start_date=start_dt,
            expiration_date=exp_dt,
            is_active=self.is_active,
            id_tienda=self.id_tienda if self.id_tienda else None
        )

# ========================================
# RESOLVER REFERENCIAS CIRCULARES
# ========================================

PlaylistResponse.update_forward_refs()
Device.update_forward_refs()