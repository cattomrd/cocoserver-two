# Actualización para router/playlists.py - Solo las funciones modificadas

import os
import uuid
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy.sql import text
from fastapi.staticfiles import StaticFiles

from models.database import get_db
from models.models import Playlist, Video, PlaylistVideo
from models.schemas import PlaylistCreate, PlaylistResponse, PlaylistUpdate
from utils.helpers import is_playlist_active

router = APIRouter(
    prefix="/api/playlists",
    tags=["playlists"]
)

# router.mount("static", StaticFiles(directory="static/"), name="static")

# Directorio para archivos de playlist
PLAYLIST_DIR = "playlists"

@router.post("/", response_model=PlaylistResponse)
def create_playlist(
    playlist: PlaylistCreate, 
    db: Session = Depends(get_db)
):
    # Crear playlist con start_date
    db_playlist = Playlist(**playlist.dict())
    db.add(db_playlist)
    db.commit()
    db.refresh(db_playlist)
    return db_playlist

@router.get("/", response_model=List[PlaylistResponse])
def read_playlists(
    skip: int = 0, 
    limit: int = 10000,  # Aumentar el límite por defecto
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Playlist)
    
    if active_only:
        now = datetime.now()
        query = query.filter(
            Playlist.is_active == True,
            (Playlist.expiration_date == None) | (Playlist.expiration_date > now)
        )
    
    playlists = query.offset(skip).limit(limit).all()
    print(f"Devolviendo {len(playlists)} playlists (límite: {limit})")
    
    return playlists


@router.get("/count")
def get_playlists_count(
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """
    Obtener el número total de playlists sin cargar los datos
    """
    query = db.query(Playlist)
    
    if active_only:
        now = datetime.now()
        query = query.filter(
            Playlist.is_active == True,
            (Playlist.expiration_date == None) | (Playlist.expiration_date > now)
        )
    
    total = query.count()
    
    return {
        "total": total,
        "active_only": active_only
    }

# Y un endpoint para paginación del lado del servidor si lo prefieres
@router.get("/paginated")
def get_playlists_paginated(
    page: int = 1,
    page_size: int = 100,
    active_only: bool = False,
    search: str = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db)
):
    """
    Endpoint con paginación del lado del servidor
    """
    query = db.query(Playlist)
    
    # Filtro por estado activo
    if active_only:
        now = datetime.now()
        query = query.filter(
            Playlist.is_active == True,
            (Playlist.expiration_date == None) | (Playlist.expiration_date > now)
        )
    
    # Búsqueda por texto
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Playlist.title.ilike(search_term)) |
            (Playlist.description.ilike(search_term))
        )
    
    # Ordenamiento
    if sort_by == "title":
        order_column = Playlist.title
    elif sort_by == "created_at":
        order_column = Playlist.created_at
    elif sort_by == "expiration_date":
        order_column = Playlist.expiration_date
    else:
        order_column = Playlist.created_at
    
    if sort_order.lower() == "desc":
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column.asc())
    
    # Conteo total antes de la paginación
    total_items = query.count()
    total_pages = (total_items + page_size - 1) // page_size
    
    # Aplicar paginación
    skip = (page - 1) * page_size
    playlists = query.offset(skip).limit(page_size).all()
    
    return {
        "items": playlists,
        "page": page,
        "page_size": page_size,
        "total_items": total_items,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    }

@router.get("/{playlist_id}", response_model=PlaylistResponse)
def read_playlist(
    playlist_id: int, 
    db: Session = Depends(get_db)
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Lista de reproducción no encontrada")
    return playlist

@router.put("/{playlist_id}", response_model=PlaylistResponse)
def update_playlist(
    playlist_id: int, 
    playlist_update: PlaylistUpdate, 
    db: Session = Depends(get_db)
):
    db_playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if db_playlist is None:
        raise HTTPException(status_code=404, detail="Lista de reproducción no encontrada")
    
    # Actualizar solo los campos proporcionados (incluyendo start_date)
    update_data = playlist_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_playlist, key, value)
    
    db.commit()
    db.refresh(db_playlist)
    return db_playlist

@router.get("/active", response_model=List[PlaylistResponse])
def get_active_playlists(
    db: Session = Depends(get_db)
):
    """
    Devuelve todas las playlists activas considerando fechas de inicio y fin
    """
    now = datetime.now()
    active_playlists = db.query(Playlist).filter(
        Playlist.is_active == True,
        # Ha empezado (o no tiene fecha de inicio)
        (Playlist.start_date == None) | (Playlist.start_date <= now),
        # No ha expirado (o no tiene fecha de expiración)
        (Playlist.expiration_date == None) | (Playlist.expiration_date > now)
    ).all()
    
    return active_playlists

@router.get("/{playlist_id}/status")
def get_playlist_status(
    playlist_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtiene el estado detallado de una playlist considerando fechas
    """
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Lista de reproducción no encontrada")
    
    from utils.helpers import get_playlist_status_info, get_next_status_change
    
    # Obtener información de estado
    status_info = get_playlist_status_info(playlist)
    
    # Obtener próximo cambio de estado
    next_change = get_next_status_change(playlist)
    
    # Información adicional
    result = {
        "playlist": {
            "id": playlist.id,
            "title": playlist.title,
            "description": playlist.description,
            "is_active_flag": playlist.is_active,
            "start_date": playlist.start_date.isoformat() if playlist.start_date else None,
            "expiration_date": playlist.expiration_date.isoformat() if playlist.expiration_date else None,
        },
        "status": status_info,
        "next_change": next_change
    }
    
    return result

@router.post("/{playlist_id}/videos")
def add_video_to_playlist_simple(
    playlist_id: int,
    video_data: dict,
    db: Session = Depends(get_db)
):
    """
    Agregar video a playlist - VERSIÓN SIMPLE
    """
    print(f"➕ Agregando video a playlist {playlist_id}: {video_data}")
    
    try:
        # Verificar que la playlist existe
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            print(f"❌ Playlist {playlist_id} no encontrada")
            raise HTTPException(status_code=404, detail="Lista de reproducción no encontrada")
        
        video_id = video_data.get("video_id")
        if not video_id:
            print(f"❌ video_id faltante en request: {video_data}")
            raise HTTPException(status_code=400, detail="ID de video requerido")
        
        # Verificar que el video existe
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            print(f"❌ Video {video_id} no encontrado")
            raise HTTPException(status_code=404, detail="Video no encontrado")
        
        # Verificar si ya está en la playlist
        existing = db.query(PlaylistVideo).filter(
            PlaylistVideo.playlist_id == playlist_id,
            PlaylistVideo.video_id == video_id
        ).first()
        
        if existing:
            print(f"⚠️ Video {video_id} ya está en playlist {playlist_id}")
            raise HTTPException(status_code=400, detail="El video ya está en la lista")
        
        # Obtener la siguiente posición/orden
        try:
            # Intentar con 'position' primero
            max_position = db.query(
                db.func.max(PlaylistVideo.position)
            ).filter(
                PlaylistVideo.playlist_id == playlist_id
            ).scalar() or 0
            
            print(f"✅ Usando campo 'position', max actual: {max_position}")
            
            # Crear nueva relación
            playlist_video = PlaylistVideo(
                playlist_id=playlist_id,
                video_id=video_id,
                position=max_position + 1
            )
            
        except Exception as pos_error:
            print(f"❌ Error con campo 'position': {pos_error}")
            # Si 'position' no existe, crear sin orden específico
            playlist_video = PlaylistVideo(
                playlist_id=playlist_id,
                video_id=video_id
            )
        
        db.add(playlist_video)
        db.commit()
        db.refresh(playlist_video)
        
        print(f"✅ Video {video_id} agregado a playlist {playlist_id}")
        return {"message": "Video agregado correctamente", "video_id": video_id}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error agregando video: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


# Resto de las funciones permanecen igual...
@router.delete("/{playlist_id}")
def delete_playlist(
    playlist_id: int, 
    db: Session = Depends(get_db)
):
    db_playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if db_playlist is None:
        raise HTTPException(status_code=404, detail="Lista de reproducción no encontrada")
    
    db.delete(db_playlist)
    db.commit()
    
    return {"message": "Lista de reproducción eliminada correctamente"}


@router.delete("/{playlist_id}/videos/{video_id}")
def remove_video_from_playlist_simple(
    playlist_id: int,
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    Quitar video de playlist - VERSIÓN SIMPLE
    """
    print(f"➖ Quitando video {video_id} de playlist {playlist_id}")
    
    try:
        # Verificar que la playlist existe
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            print(f"❌ Playlist {playlist_id} no encontrada")
            raise HTTPException(status_code=404, detail="Lista de reproducción no encontrada")
        
        # Buscar la relación
        playlist_video = db.query(PlaylistVideo).filter(
            PlaylistVideo.playlist_id == playlist_id,
            PlaylistVideo.video_id == video_id
        ).first()
        
        if not playlist_video:
            print(f"❌ Video {video_id} no está en playlist {playlist_id}")
            raise HTTPException(status_code=404, detail="Video no encontrado en la lista")
        
        # Eliminar la relación
        db.delete(playlist_video)
        db.commit()
        
        print(f"✅ Video {video_id} quitado de playlist {playlist_id}")
        return {"message": "Video quitado correctamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error quitando video: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


# @router.delete("/{playlist_id}/videos/{video_id}")
# def remove_video_from_playlist(
#     playlist_id: int, 
#     video_id: int, 
#     db: Session = Depends(get_db)
# ):
#     # Verificar que la playlist exista
#     db_playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
#     if db_playlist is None:
#         raise HTTPException(status_code=404, detail="Lista de reproducción no encontrada")
    
#     # Verificar que el video exista
#     db_video = db.query(Video).filter(Video.id == video_id).first()
#     if db_video is None:
#         raise HTTPException(status_code=404, detail="Video no encontrado")
    
#     # Buscar la relación específica
#     playlist_video = db.query(PlaylistVideo).filter(
#         PlaylistVideo.playlist_id == playlist_id,
#         PlaylistVideo.video_id == video_id
#     ).first()
    
#     if not playlist_video:
#         raise HTTPException(
#             status_code=404, 
#             detail="El video no se encuentra en esta lista de reproducción"
#         )
    
#     # Eliminar la relación
#     db.delete(playlist_video)
#     db.commit()
    
#     # Reorganizar las posiciones de los videos restantes
#     remaining_videos = db.query(PlaylistVideo).filter(
#         PlaylistVideo.playlist_id == playlist_id
#     ).order_by(PlaylistVideo.position).all()
    
#     for i, pv in enumerate(remaining_videos):
#         pv.position = i
    
#     db.commit()
    
#     return {"message": "Video eliminado de la lista de reproducción correctamente"}


@router.get("/{playlist_id}/videos")
def get_playlist_videos_simple(
    playlist_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtener videos de una playlist - VERSIÓN SIMPLE
    """
    print(f"📋 Obteniendo videos de playlist {playlist_id}")
    
    try:
        # Verificar que la playlist existe
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            print(f"❌ Playlist {playlist_id} no encontrada")
            raise HTTPException(status_code=404, detail="Lista de reproducción no encontrada")
        
        # Intentar obtener videos con campo order/position
        try:
            # Primero intentar con 'position'
            playlist_videos = db.query(
                Video, PlaylistVideo.position
            ).join(
                PlaylistVideo, Video.id == PlaylistVideo.video_id
            ).filter(
                PlaylistVideo.playlist_id == playlist_id
            ).order_by(PlaylistVideo.position).all()
            
            print(f"✅ Videos obtenidos con campo 'position': {len(playlist_videos)}")
            
            videos = []
            for video, position in playlist_videos:
                videos.append({
                    "id": video.id,
                    "title": video.title,
                    "description": video.description or "",
                    "duration": video.duration or 0,
                    "thumbnail": getattr(video, 'thumbnail', None),
                    "thumbnail_url": getattr(video, 'thumbnail', None),
                    "file_path": video.file_path,
                    "filename": getattr(video, 'filename', f"video_{video.id}.mp4"),
                    "tags": getattr(video, 'tags', None),
                    "is_active": getattr(video, 'is_active', True),
                    "expiration_date": video.expiration_date,
                    "order": position,
                    "position": position
                })
            
        except Exception as pos_error:
            print(f"⚠️ Error con campo 'position': {pos_error}")
            
            # Fallback: obtener videos sin orden específico
            playlist_videos = db.query(Video).join(
                PlaylistVideo, Video.id == PlaylistVideo.video_id
            ).filter(
                PlaylistVideo.playlist_id == playlist_id
            ).all()
            
            print(f"✅ Videos obtenidos sin orden: {len(playlist_videos)}")
            
            videos = []
            for index, video in enumerate(playlist_videos):
                videos.append({
                    "id": video.id,
                    "title": video.title,
                    "description": video.description or "",
                    "duration": video.duration or 0,
                    "thumbnail": getattr(video, 'thumbnail', None),
                    "thumbnail_url": getattr(video, 'thumbnail', None),
                    "file_path": video.file_path,
                    "filename": getattr(video, 'filename', f"video_{video.id}.mp4"),
                    "tags": getattr(video, 'tags', None),
                    "is_active": getattr(video, 'is_active', True),
                    "expiration_date": video.expiration_date,
                    "order": index + 1,
                    "position": index + 1
                })
        
        print(f"✅ Retornando {len(videos)} videos")
        return videos
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error obteniendo videos: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.get("/{playlist_id}/download")
def download_playlist(
    playlist_id: int, 
    db: Session = Depends(get_db)
):
    db_playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if db_playlist is None:
        raise HTTPException(status_code=404, detail="Lista de reproducción no encontrada")
    
    # Usar la nueva función helper
    if not is_playlist_active(db_playlist):
        raise HTTPException(
            status_code=403, 
            detail="Esta lista de reproducción no está activa o no está en su período de actividad"
        )
    
    # Crear un archivo JSON con la información de la playlist y los videos
    playlist_data = {
        "id": db_playlist.id,
        "title": db_playlist.title,
        "description": db_playlist.description,
        "start_date": db_playlist.start_date.isoformat() if db_playlist.start_date else None,
        "expiration_date": db_playlist.expiration_date.isoformat() if db_playlist.expiration_date else None,
        "videos": [
            {
                "id": video.id,
                "title": video.title,
                "description": video.description,
                "file_path": video.file_path,
                "duration": video.duration
            }
            for video in db_playlist.videos
        ]
    }
    
    # Crear directorios si no existen
    os.makedirs(PLAYLIST_DIR, exist_ok=True)
    
    # Crear un archivo JSON temporal
    playlist_filename = f"playlist_{db_playlist.id}_{uuid.uuid4()}.json"
    playlist_file_path = os.path.join(PLAYLIST_DIR, playlist_filename)
    
    with open(playlist_file_path, "w") as f:
        json.dump(playlist_data, f, indent=4)
    
    return FileResponse(
        path=playlist_file_path, 
        filename=f"playlist_{db_playlist.title.replace(' ', '_')}.json", 
        media_type="application/json"
    )

@router.get("/{playlist_id}/active_videos")
def get_active_videos_in_playlist(
    playlist_id: int, 
    db: Session = Depends(get_db)
):
    """
    Devuelve los videos activos en una playlist.
    """
    db_playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if db_playlist is None:
        raise HTTPException(status_code=404, detail="Lista de reproducción no encontrada")
    
    now = datetime.now()
    active_videos = [
        video for video in db_playlist.videos 
        if not video.expiration_date or video.expiration_date > now
    ]
    
    return {"active_videos": [
        {
            "id": video.id,
            "title": video.title,
            "file_path": video.file_path,
            "description": video.description,
            "duration": video.duration,
            "upload_date": video.upload_date.isoformat() if video.upload_date else None,
            "expiration_date": video.expiration_date.isoformat() if video.expiration_date else None
        }
        for video in active_videos
    ]}