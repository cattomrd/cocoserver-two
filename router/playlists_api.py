# router/playlists_api.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from models.database import get_db
from models.models import Playlist, Video, PlaylistVideo
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/playlists",
    tags=["playlists"]
)

# ========================================
# ENDPOINTS PARA playlist.html
# ========================================

@router.get("/")
async def get_playlists(
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort: Optional[str] = "created_at_desc",
    page: int = 1,
    page_size: int = 24,
    db: Session = Depends(get_db)
):
    """
    Obtener todas las listas de reproducción con filtros y paginación
    """
    try:
        query = db.query(Playlist)
        
        # Filtro de búsqueda
        if search:
            query = query.filter(
                (Playlist.title.ilike(f"%{search}%")) |
                (Playlist.description.ilike(f"%{search}%"))
            )
        
        # Filtro de estado
        if status and status != "all":
            if status == "active":
                query = query.filter(Playlist.is_active == True)
            elif status == "inactive":
                query = query.filter(Playlist.is_active == False)
            # Agregar lógica para "expired" basada en expiration_date
        
        # Ordenamiento
        if sort:
            field, direction = sort.split("_")
            order_field = getattr(Playlist, field)
            if direction == "desc":
                query = query.order_by(order_field.desc())
            else:
                query = query.order_by(order_field.asc())
        
        # Paginación
        if page_size != "all":
            offset = (page - 1) * page_size
            playlists = query.offset(offset).limit(page_size).all()
        else:
            playlists = query.all()
        
        # Agregar conteo de videos a cada playlist
        for playlist in playlists:
            playlist.video_count = db.query(PlaylistVideo).filter(
                PlaylistVideo.playlist_id == playlist.id
            ).count()
            
            # Calcular duración total
            total_duration = db.query(
                db.func.sum(Video.duration)
            ).join(
                PlaylistVideo, Video.id == PlaylistVideo.video_id
            ).filter(
                PlaylistVideo.playlist_id == playlist.id
            ).scalar() or 0
            
            playlist.total_duration = total_duration
        
        return playlists
        
    except Exception as e:
        logger.error(f"Error al obtener playlists: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/{playlist_id}/detail")
async def get_playlist_detail(playlist_id: int, db: Session = Depends(get_db)):
    """
    Obtener detalles completos de una playlist incluyendo videos
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Obtener videos ordenados
        playlist_videos = db.query(
            Video, PlaylistVideo.order
        ).join(
            PlaylistVideo, Video.id == PlaylistVideo.video_id
        ).filter(
            PlaylistVideo.playlist_id == playlist_id
        ).order_by(PlaylistVideo.order).all()
        
        # Formatear respuesta
        playlist.videos = [
            {
                "id": video.id,
                "title": video.title,
                "description": video.description,
                "duration": video.duration,
                "thumbnail": video.thumbnail,
                "order": order
            }
            for video, order in playlist_videos
        ]
        
        playlist.video_count = len(playlist.videos)
        playlist.total_duration = sum(v["duration"] or 0 for v in playlist.videos)
        
        return playlist
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener detalles de playlist {playlist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/")
async def create_playlist(
    playlist_data: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Crear nueva lista de reproducción
    """
    try:
        new_playlist = Playlist(
            title=playlist_data["title"],
            description=playlist_data.get("description"),
            start_date=playlist_data.get("start_date"),
            expiration_date=playlist_data.get("expiration_date"),
            is_active=playlist_data.get("is_active", True),
            created_by=current_user["id"]
        )
        
        db.add(new_playlist)
        db.commit()
        db.refresh(new_playlist)
        
        logger.info(f"Playlist creada: {new_playlist.id} por usuario {current_user['username']}")
        return new_playlist
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error al crear playlist: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al crear la lista")

@router.put("/{playlist_id}")
async def update_playlist(
    playlist_id: int,
    playlist_data: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Actualizar lista de reproducción
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Actualizar campos
        for field, value in playlist_data.items():
            if hasattr(playlist, field):
                setattr(playlist, field, value)
        
        db.commit()
        db.refresh(playlist)
        
        logger.info(f"Playlist {playlist_id} actualizada por {current_user['username']}")
        return playlist
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al actualizar playlist {playlist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al actualizar la lista")

@router.delete("/{playlist_id}")
async def delete_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Eliminar lista de reproducción
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Eliminar relaciones con videos
        db.query(PlaylistVideo).filter(PlaylistVideo.playlist_id == playlist_id).delete()
        
        # Eliminar playlist
        db.delete(playlist)
        db.commit()
        
        logger.info(f"Playlist {playlist_id} eliminada por {current_user['username']}")
        return {"message": "Lista eliminada correctamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al eliminar playlist {playlist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al eliminar la lista")

# ========================================
# ENDPOINTS PARA edit-playlist.html
# ========================================

@router.get("/{playlist_id}/edit")
async def get_playlist_for_edit(playlist_id: int, db: Session = Depends(get_db)):
    """
    Obtener playlist completa para edición
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Obtener videos con información completa
        playlist_videos = db.query(
            Video, PlaylistVideo.order
        ).join(
            PlaylistVideo, Video.id == PlaylistVideo.video_id
        ).filter(
            PlaylistVideo.playlist_id == playlist_id
        ).order_by(PlaylistVideo.order).all()
        
        playlist.videos = [
            {
                "id": video.id,
                "title": video.title,
                "description": video.description,
                "duration": video.duration,
                "thumbnail": video.thumbnail,
                "file_path": video.file_path,
                "tags": video.tags,
                "order": order
            }
            for video, order in playlist_videos
        ]
        
        return playlist
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener playlist para edición {playlist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.put("/{playlist_id}/video-order")
async def update_video_order(
    playlist_id: int,
    order_data: dict,
    db: Session = Depends(get_db)
):
    """
    Actualizar orden de videos en la playlist
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Actualizar orden de cada video
        for video_order in order_data["videos"]:
            db.query(PlaylistVideo).filter(
                PlaylistVideo.playlist_id == playlist_id,
                PlaylistVideo.video_id == video_order["video_id"]
            ).update({"order": video_order["order"]})
        
        db.commit()
        
        logger.info(f"Orden de videos actualizado en playlist {playlist_id}")
        return {"message": "Orden actualizado correctamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al actualizar orden en playlist {playlist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al actualizar el orden")

@router.post("/{playlist_id}/videos/{video_id}")
async def add_video_to_playlist(
    playlist_id: int,
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    Añadir video a playlist
    """
    try:
        # Verificar que la playlist existe
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Verificar que el video existe
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video no encontrado")
        
        # Verificar si ya está en la playlist
        existing = db.query(PlaylistVideo).filter(
            PlaylistVideo.playlist_id == playlist_id,
            PlaylistVideo.video_id == video_id
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="El video ya está en la lista")
        
        # Obtener el siguiente orden
        max_order = db.query(
            db.func.max(PlaylistVideo.order)
        ).filter(
            PlaylistVideo.playlist_id == playlist_id
        ).scalar() or 0
        
        # Añadir video
        playlist_video = PlaylistVideo(
            playlist_id=playlist_id,
            video_id=video_id,
            order=max_order + 1
        )
        
        db.add(playlist_video)
        db.commit()
        
        logger.info(f"Video {video_id} añadido a playlist {playlist_id}")
        return {"message": "Video añadido correctamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al añadir video {video_id} a playlist {playlist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al añadir el video")

@router.delete("/{playlist_id}/videos/{video_id}")
async def remove_video_from_playlist(
    playlist_id: int,
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    Eliminar video de playlist
    """
    try:
        playlist_video = db.query(PlaylistVideo).filter(
            PlaylistVideo.playlist_id == playlist_id,
            PlaylistVideo.video_id == video_id
        ).first()
        
        if not playlist_video:
            raise HTTPException(status_code=404, detail="Video no encontrado en la lista")
        
        # Eliminar relación
        db.delete(playlist_video)
        
        # Reordenar videos restantes
        remaining_videos = db.query(PlaylistVideo).filter(
            PlaylistVideo.playlist_id == playlist_id,
            PlaylistVideo.order > playlist_video.order
        ).all()
        
        for pv in remaining_videos:
            pv.order -= 1
        
        db.commit()
        
        logger.info(f"Video {video_id} eliminado de playlist {playlist_id}")
        return {"message": "Video eliminado correctamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al eliminar video {video_id} de playlist {playlist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al eliminar el video")

@router.post("/{playlist_id}/publish")
async def publish_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Publicar playlist (marcarla como activa y lista para uso)
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        playlist.is_active = True
        playlist.published_at = db.func.now()
        
        db.commit()
        
        logger.info(f"Playlist {playlist_id} publicada por {current_user['username']}")
        return {"message": "Lista publicada correctamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al publicar playlist {playlist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al publicar la lista")

# ========================================
# ENDPOINTS PARA BÚSQUEDA DE VIDEOS
# ========================================

@router.get("/videos/search")
async def search_videos_for_playlist(
    q: str,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Buscar videos disponibles para añadir a playlists
    """
    try:
        videos = db.query(Video).filter(
            (Video.title.ilike(f"%{q}%")) |
            (Video.description.ilike(f"%{q}%")) |
            (Video.tags.ilike(f"%{q}%"))
        ).limit(limit).all()
        
        return videos
        
    except Exception as e:
        logger.error(f"Error al buscar videos: {str(e)}")
        raise HTTPException(status_code=500, detail="Error en la búsqueda")

@router.post("/videos/upload")
async def upload_video_for_playlist(
    file: UploadFile = File(...),
    title: str = None,
    description: str = None,
    tags: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Subir nuevo video para usar en playlists
    """
    try:
        # Validar archivo
        if not file.content_type.startswith("video/"):
            raise HTTPException(status_code=400, detail="El archivo debe ser un video")
        
        # Aquí implementarías la lógica de subida de archivos
        # Por ejemplo, guardar en un directorio específico
        
        # Crear registro en base de datos
        new_video = Video(
            title=title or file.filename,
            description=description,
            tags=tags,
            file_path=f"/uploads/videos/{file.filename}",  # Ajustar según tu estructura
            uploaded_by=current_user["id"]
        )
        
        db.add(new_video)
        db.commit()
        db.refresh(new_video)
        
        logger.info(f"Video subido: {new_video.id} por {current_user['username']}")
        return new_video
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al subir video: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al subir el video")

@router.post("/videos/from-url")
async def add_video_from_url(
    video_data: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Añadir video desde URL (YouTube, Vimeo, etc.)
    """
    try:
        url = video_data["url"]
        title = video_data.get("title")
        description = video_data.get("description")
        
        # Aquí implementarías la lógica para procesar URLs
        # Por ejemplo, extraer información de YouTube/Vimeo
        
        new_video = Video(
            title=title or "Video desde URL",
            description=description,
            file_path=url,
            video_type="url",
            uploaded_by=current_user["id"]
        )
        
        db.add(new_video)
        db.commit()
        db.refresh(new_video)
        
        logger.info(f"Video desde URL añadido: {new_video.id}")
        return new_video
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error al añadir video desde URL: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al procesar la URL")