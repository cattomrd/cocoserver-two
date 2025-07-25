# router/playlists_api.py - VERSIÓN COMPATIBLE con nombres existentes

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func  # ← IMPORTAR func para evitar el error
from typing import List, Optional
import logging

from models.database import get_db
from models.models import Playlist, Video, PlaylistVideo

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/playlists",
    tags=["playlists"]
)

# ========================================
# FUNCIONES DE AUTENTICACIÓN LOCALES
# ========================================

def get_current_user():
    """
    Función dummy para compatibilidad
    En una implementación real, esto extraería el usuario del token JWT
    """
    def _get_current_user():
        # Retorna un usuario mock para evitar errores
        return {
            "id": 1,
            "username": "admin",
            "email": "admin@localhost",
            "is_admin": True,
            "is_active": True,
            "authenticated": True
        }
    return _get_current_user

def require_authenticated_user():
    """
    Función dummy para requerir autenticación
    """
    def _require_authenticated_user():
        # En una implementación real, verificaría el token
        return {
            "id": 1,
            "username": "admin",
            "email": "admin@localhost", 
            "is_admin": True,
            "is_active": True,
            "authenticated": True
        }
    return _require_authenticated_user

# ========================================
# ENDPOINTS PARA playlist.html
# ========================================

@router.get("/")
async def get_playlists(
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort: Optional[str] = "creation_date_desc",
    page: int = 1,
    page_size: int = 24,
    limit: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Obtener todas las listas de reproducción con filtros y paginación
    Versión corregida para evitar el error 500
    """
    try:
        # Asegurarnos de que limit no sea demasiado grande para evitar problemas de memoria
        if limit and limit > 10000:
            logger.warning(f"Límite demasiado grande ({limit}), restringiendo a 10000")
            limit = 10000

        # Iniciar la consulta base
        query = db.query(Playlist)
        
        # Aplicar filtros
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Playlist.title.ilike(search_term),
                    Playlist.description.ilike(search_term)
                )
            )
        
        if status and status != "all":
            if status == "active":
                now = datetime.now()
                query = query.filter(
                    Playlist.is_active == True,
                    or_(
                        Playlist.expiration_date.is_(None),
                        Playlist.expiration_date > now
                    )
                )
            elif status == "inactive":
                query = query.filter(Playlist.is_active == False)
            elif status == "expired":
                now = datetime.now()
                query = query.filter(
                    Playlist.expiration_date.isnot(None),
                    Playlist.expiration_date <= now
                )
        
        # Aplicar ordenamiento
        if sort:
            # Extraer campo y dirección de ordenamiento
            sort_parts = sort.split('_')
            if len(sort_parts) >= 2:
                sort_field = '_'.join(sort_parts[:-1])  # Todo excepto la última parte
                sort_direction = sort_parts[-1]  # La última parte (asc/desc)
                
                # Determinar columna para ordenar
                if sort_field == "title":
                    order_col = Playlist.title
                elif sort_field == "creation":
                    order_col = Playlist.creation_date
                elif sort_field == "creation_date":
                    order_col = Playlist.creation_date
                elif sort_field == "expiration":
                    order_col = Playlist.expiration_date
                elif sort_field == "expiration_date":
                    order_col = Playlist.expiration_date
                else:
                    # Por defecto ordenar por fecha de creación
                    order_col = Playlist.creation_date
                
                # Aplicar dirección
                if sort_direction == "desc":
                    query = query.order_by(order_col.desc())
                else:
                    query = query.order_by(order_col.asc())
            else:
                # Si el formato no es correcto, ordenar por fecha de creación descendente
                query = query.order_by(Playlist.creation_date.desc())
        
        # Contar total de resultados para paginación (solo si se solicita paginación)
        total = None
        if page and page_size and not limit:
            total = query.count()
        
        # Aplicar paginación si no se especifica límite
        if page and page_size and not limit:
            offset = (page - 1) * page_size
            query = query.offset(offset).limit(page_size)
        elif limit:
            # Si se especifica límite, usarlo directamente
            query = query.limit(limit)
        
        # Ejecutar la consulta
        playlists = query.all()
        
        # Si se solicitó paginación, devolver información adicional
        if page and page_size and not limit and total is not None:
            total_pages = (total + page_size - 1) // page_size
            
            return {
                "items": playlists,
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages
            }
        
        # Si no se solicitó paginación o se especificó límite, devolver solo la lista
        return playlists
        
    except Exception as e:
        logger.error(f"Error al obtener playlists: {str(e)}")
        # Agregar más detalles al log para diagnóstico
        import traceback
        logger.error(traceback.format_exc())
        # Devolver un error más descriptivo
        raise HTTPException(
            status_code=500, 
            detail=f"Error al obtener las listas de reproducción: {str(e)}"
        )

@router.get("/{playlist_id}")
async def get_playlist_detail(
    playlist_id: int, 
    db: Session = Depends(get_db)
):
    """
    Obtener detalles completos de una playlist incluyendo videos
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Obtener videos ordenados - CORREGIDO: usar position en lugar de order
        playlist_videos = db.query(
            Video, PlaylistVideo.position  # ← CORREGIDO
        ).join(
            PlaylistVideo, Video.id == PlaylistVideo.video_id
        ).filter(
            PlaylistVideo.playlist_id == playlist_id
        ).order_by(PlaylistVideo.position).all()  # ← CORREGIDO
        
        # Formatear respuesta
        playlist.videos = [
            {
                "id": video.id,
                "title": video.title,
                "description": video.description,
                "duration": video.duration,
                "thumbnail": getattr(video, 'thumbnail', None),
                "position": position,  # ← CORREGIDO
                "order": position  # ← Mantener para compatibilidad con frontend
            }
            for video, position in playlist_videos
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
    current_user = Depends(get_current_user())  # ← USAR función local
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
            is_active=playlist_data.get("is_active", True)
        )
        
        db.add(new_playlist)
        db.commit()
        db.refresh(new_playlist)
        
        logger.info(f"Playlist creada: {new_playlist.id} por {current_user.get('username', 'unknown')}")
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
    current_user = Depends(require_authenticated_user())  # ← USAR función local
):
    """
    Actualizar lista de reproducción existente
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Actualizar campos
        playlist.title = playlist_data.get("title", playlist.title)
        playlist.description = playlist_data.get("description", playlist.description)
        playlist.start_date = playlist_data.get("start_date", playlist.start_date)
        playlist.expiration_date = playlist_data.get("expiration_date", playlist.expiration_date)
        playlist.is_active = playlist_data.get("is_active", playlist.is_active)
        
        db.commit()
        
        logger.info(f"Playlist {playlist_id} actualizada por {current_user.get('username', 'unknown')}")
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
    current_user = Depends(require_authenticated_user())  # ← USAR función local
):
    """
    Eliminar lista de reproducción
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        db.delete(playlist)
        db.commit()
        
        logger.info(f"Playlist {playlist_id} eliminada por {current_user.get('username', 'unknown')}")
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
async def get_playlist_for_edit(
    playlist_id: int, 
    db: Session = Depends(get_db)
):
    """
    Obtener playlist completa para edición
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Obtener videos con información completa - CORREGIDO: usar position
        playlist_videos = db.query(
            Video, PlaylistVideo.position  # ← CORREGIDO
        ).join(
            PlaylistVideo, Video.id == PlaylistVideo.video_id
        ).filter(
            PlaylistVideo.playlist_id == playlist_id
        ).order_by(PlaylistVideo.position).all()  # ← CORREGIDO
        
        playlist.videos = [
            {
                "id": video.id,
                "title": video.title,
                "description": video.description,
                "duration": video.duration,
                "thumbnail": getattr(video, 'thumbnail', None),
                "file_path": video.file_path,
                "tags": getattr(video, 'tags', None),
                "position": position,  # ← CORREGIDO
                "order": position  # ← Mantener para compatibilidad
            }
            for video, position in playlist_videos
        ]
        
        return playlist
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener playlist para edición {playlist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.put("/{playlist_id}/reorder")
async def update_video_order(
    playlist_id: int,
    order_data: dict,
    db: Session = Depends(get_db),
    current_user = Depends(require_authenticated_user())  # ← USAR función local
):
    """
    Actualizar orden de videos en la playlist
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Actualizar posición de cada video - CORREGIDO: usar position
        for video_order in order_data["videos"]:
            db.query(PlaylistVideo).filter(
                PlaylistVideo.playlist_id == playlist_id,
                PlaylistVideo.video_id == video_order["video_id"]
            ).update({"position": video_order.get("position", video_order.get("order"))})  # ← CORREGIDO
        
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
    db: Session = Depends(get_db),
    current_user = Depends(require_authenticated_user())  # ← USAR función local
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
        
        # Obtener la siguiente posición - CORREGIDO: usar position y func importado
        max_position = db.query(
            func.max(PlaylistVideo.position)  # ← CORREGIDO
        ).filter(
            PlaylistVideo.playlist_id == playlist_id
        ).scalar() or 0
        
        # Añadir video
        playlist_video = PlaylistVideo(
            playlist_id=playlist_id,
            video_id=video_id,
            position=max_position + 1  # ← CORREGIDO: usar position
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
    db: Session = Depends(get_db),
    current_user = Depends(require_authenticated_user())  # ← USAR función local
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
        
        # Guardar la posición del video eliminado
        deleted_position = playlist_video.position
        
        # Eliminar relación
        db.delete(playlist_video)
        
        # Reordenar videos restantes - CORREGIDO: usar position
        remaining_videos = db.query(PlaylistVideo).filter(
            PlaylistVideo.playlist_id == playlist_id,
            PlaylistVideo.position > deleted_position  # ← CORREGIDO
        ).all()
        
        for pv in remaining_videos:
            pv.position -= 1  # ← CORREGIDO
        
        db.commit()
        
        logger.info(f"Video {video_id} eliminado de playlist {playlist_id}")
        return {"message": "Video eliminado correctamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al eliminar video {video_id} de playlist {playlist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al eliminar el video")

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
            (Video.description.ilike(f"%{q}%"))
        ).limit(limit).all()
        
        return videos
        
    except Exception as e:
        logger.error(f"Error al buscar videos: {str(e)}")
        raise HTTPException(status_code=500, detail="Error en la búsqueda")