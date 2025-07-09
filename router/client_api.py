# router/client_api.py - API para clientes externos

# router/client_api.py - API para clientes externos

from fastapi import APIRouter, Depends, HTTPException, status, Request, Path
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import os
import json
import uuid
import jwt
from pydantic import BaseModel

from models.database import get_db
from models.models import Playlist, Video, User, Device, DevicePlaylist

# Configuración desde variables de entorno
from dotenv import load_dotenv
load_dotenv()

# Directorios para archivos
PLAYLIST_DIR = "temp/playlists"
os.makedirs(PLAYLIST_DIR, exist_ok=True)

# Configuración JWT
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "un_secreto_muy_seguro")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 horas

# Crear router
router = APIRouter(
    prefix="/api/client",
    tags=["client"]
)

# Esquema para el token
class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

class ClientAuth(BaseModel):
    client_id: str
    client_secret: str

# Funciones de utilidad
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_client(request: Request, db: Session = Depends(get_db)):
    """
    Verifica el token JWT y retorna el dispositivo cliente si es válido.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Obtener el encabezado de autorización
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso requerido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extraer el token
    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() != "bearer":
        raise credentials_exception
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        client_id: str = payload.get("sub")
        if client_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    # Verificar si es un dispositivo registrado
    device = db.query(Device).filter(Device.device_id == client_id).first()
    if device is None:
        raise credentials_exception
        
    # Actualizar última conexión
    device.last_seen = datetime.now()
    db.commit()
    
    return device

# Endpoint de login
@router.post("/login", response_model=Token)
async def login_for_access_token(
    auth_data: ClientAuth,
    db: Session = Depends(get_db)
):
    """
    Endpoint para que los clientes obtengan un token de autenticación.
    
    - client_id: ID único del dispositivo
    - client_secret: Clave secreta asignada al dispositivo
    
    Retorna un token JWT válido por 24 horas
    """
    # Buscar dispositivo
    device = db.query(Device).filter(Device.device_id == auth_data.client_id).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Dispositivo no encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verificar si el dispositivo tiene api_key configurada
    # Si no tiene api_key (columna recién añadida), aceptar cualquier clave
    has_api_key = hasattr(device, 'api_key') and device.api_key is not None
    
    # Verificar la clave solo si el dispositivo tiene api_key configurada
    if has_api_key and device.api_key != auth_data.client_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ID de cliente o clave secreta incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Si no tiene api_key, asignarle la clave proporcionada
    if not has_api_key:
        try:
            device.api_key = auth_data.client_secret
            db.commit()
        except Exception as e:
            db.rollback()
            # Si falla al añadir la api_key, continuamos de todos modos
            print(f"No se pudo asignar api_key al dispositivo: {e}")
    
    # Verificar si el dispositivo está activo
    if not device.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este dispositivo está desactivado",
        )
    
    # Crear token de acceso
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": device.device_id}, 
        expires_delta=access_token_expires
    )
    
    # Actualizar última conexión
    device.last_seen = datetime.now()
    db.commit()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60  # en segundos
    }

# Endpoint para obtener listas de reproducción asignadas
@router.get("/playlists", response_model=List[dict])
async def get_client_playlists(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Obtiene todas las listas de reproducción asignadas al dispositivo autenticado.
    Solo retorna listas activas y no expiradas.
    """
    # Verificar autenticación
    current_client = await get_current_client(request, db)
    
    now = datetime.now()
    
    # Obtener listas asignadas al dispositivo
    query = db.query(Playlist).join(
        DevicePlaylist,
        DevicePlaylist.playlist_id == Playlist.id
    ).filter(
        Playlist.is_active == True,
        (Playlist.expiration_date == None) | (Playlist.expiration_date > now),
        DevicePlaylist.device_id == current_client.device_id
    )
    
    playlists = query.all()
    
    result = []
    for playlist in playlists:
        # Filtrar videos que no hayan expirado
        active_videos = [
            video for video in playlist.videos 
            if not video.expiration_date or video.expiration_date > now
        ]
        
        # Solo incluir playlists con al menos un video activo
        if active_videos:
            playlist_data = {
                "id": playlist.id,
                "title": playlist.title,
                "description": playlist.description,
                "expiration_date": playlist.expiration_date.isoformat() if playlist.expiration_date else None,
                "videos": [
                    {
                        "id": video.id,
                        "title": video.title,
                        "file_path": f"/api/client/videos/{video.id}/download",
                        "duration": video.duration,
                        "expiration_date": video.expiration_date.isoformat() if video.expiration_date else None
                    }
                    for video in active_videos
                ]
            }
            result.append(playlist_data)
    
    return result

# Endpoint para descargar una playlist completa
@router.get("/playlists/{playlist_id}/download")
async def download_client_playlist(
    request: Request,
    playlist_id: int = Path(..., description="ID de la playlist a descargar"),
    db: Session = Depends(get_db)
):
    """
    Descarga una lista de reproducción específica como archivo JSON.
    Verifica que el cliente tenga acceso a esta playlist.
    """
    # Verificar autenticación
    current_client = await get_current_client(request, db)
    
    # Buscar la playlist
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Lista de reproducción no encontrada")
    
    # Verificar que la playlist esté asignada al dispositivo
    device_has_playlist = db.query(Playlist).join(
        DevicePlaylist,
        DevicePlaylist.playlist_id == Playlist.id
    ).filter(
        Playlist.id == playlist_id,
        DevicePlaylist.device_id == current_client.device_id
    ).first()
    
    if not device_has_playlist:
        raise HTTPException(
            status_code=403, 
            detail="Este dispositivo no tiene acceso a esta lista de reproducción"
        )
    
    # Verificar que la playlist esté activa
    now = datetime.now()
    if not playlist.is_active or (playlist.expiration_date and playlist.expiration_date <= now):
        raise HTTPException(
            status_code=403,
            detail="Esta lista de reproducción no está activa o ha expirado"
        )
    
    # Crear archivo JSON con la información
    playlist_data = {
        "id": playlist.id,
        "title": playlist.title,
        "description": playlist.description,
        "start_date": playlist.start_date.isoformat() if playlist.start_date else None,
        "expiration_date": playlist.expiration_date.isoformat() if playlist.expiration_date else None,
        "videos": [
            {
                "id": video.id,
                "title": video.title,
                "description": video.description,
                "file_path": f"/api/client/videos/{video.id}/download",
                "duration": video.duration,
                "expiration_date": video.expiration_date.isoformat() if video.expiration_date else None
            }
            for video in playlist.videos
            if not video.expiration_date or video.expiration_date > now
        ]
    }
    
    # Crear archivo temporal
    playlist_filename = f"playlist_{playlist.id}_{uuid.uuid4()}.json"
    playlist_file_path = os.path.join(PLAYLIST_DIR, playlist_filename)
    
    with open(playlist_file_path, "w") as f:
        json.dump(playlist_data, f, indent=4)
    
    # Retornar archivo para descarga
    return FileResponse(
        path=playlist_file_path, 
        filename=f"playlist_{playlist.title.replace(' ', '_')}.json", 
        media_type="application/json"
    )

# Endpoint para descargar un video
@router.get("/videos/{video_id}/download")
async def download_client_video(
    request: Request,
    video_id: int = Path(..., description="ID del video a descargar"),
    db: Session = Depends(get_db)
):
    """
    Descarga un video específico.
    Verifica que el cliente tenga acceso a este video a través de alguna playlist asignada.
    """
    # Verificar autenticación
    current_client = await get_current_client(request, db)
    
    # Buscar el video
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    
    # Verificar si el video ha expirado
    now = datetime.now()
    if video.expiration_date and video.expiration_date <= now:
        raise HTTPException(status_code=403, detail="Este video ha expirado")
    
    # Verificar que el video esté en alguna playlist asignada al dispositivo
    video_in_device_playlist = db.query(Video).join(
        "playlists"
    ).join(
        DevicePlaylist,
        DevicePlaylist.playlist_id == Playlist.id
    ).filter(
        Video.id == video_id,
        DevicePlaylist.device_id == current_client.device_id
    ).first()
    
    if not video_in_device_playlist:
        raise HTTPException(
            status_code=403, 
            detail="Este dispositivo no tiene acceso a este video"
        )
    
    # Comprobar que el archivo existe
    if not os.path.exists(video.file_path):
        raise HTTPException(
            status_code=404,
            detail="El archivo de video no se encuentra en el servidor"
        )
    
    # Retornar archivo para descarga
    return FileResponse(
        path=video.file_path,
        filename=os.path.basename(video.file_path),
        media_type="video/mp4"  # Ajustar según el tipo de archivo
    )