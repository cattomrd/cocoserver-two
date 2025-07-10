# router/playlists_api.py - VERSIÓN INTEGRADA con funcionalidad dinámica de tiendas

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_  # ← IMPORTAR func y or_ para evitar errores
from typing import List, Optional
import logging
from datetime import datetime

from models.database import get_db
from models.models import Playlist, Video, PlaylistVideo
# NUEVA INTEGRACIÓN: Importar utilidades dinámicas de tiendas
try:
    from utils.dynamic_location_utils import TiendaService, get_tienda_service
    TIENDAS_INTEGRATION_AVAILABLE = True
except ImportError:
    # Fallback si no está disponible aún
    TIENDAS_INTEGRATION_AVAILABLE = False
    print("⚠️ Integración de tiendas no disponible - funcionalidad básica mantenida")

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/playlists",
    tags=["playlists"]
)

# ========================================
# FUNCIONES DE AUTENTICACIÓN LOCALES (MANTENIDAS)
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
# FUNCIONES HELPER PARA TIENDAS
# ========================================

def get_tienda_service_safe(db: Session):
    """
    Helper para obtener TiendaService de forma segura
    """
    if TIENDAS_INTEGRATION_AVAILABLE:
        return TiendaService(db)
    return None

def validate_tienda_code_safe(tienda_service, codigo_tienda: Optional[str]) -> bool:
    """
    Validación segura de código de tienda
    """
    if not tienda_service or not codigo_tienda:
        return True  # Sin validación si no hay servicio o código vacío
    return tienda_service.validate_tienda_code(codigo_tienda)

def normalize_tienda_code_safe(tienda_service, codigo_tienda: Optional[str]) -> Optional[str]:
    """
    Normalización segura de código de tienda
    """
    if not tienda_service:
        return codigo_tienda.upper() if codigo_tienda else None
    return tienda_service.normalize_tienda_code(codigo_tienda)

def get_tienda_nombre_safe(tienda_service, codigo_tienda: Optional[str]) -> str:
    """
    Obtener nombre de tienda de forma segura
    """
    if not tienda_service:
        return codigo_tienda if codigo_tienda else 'Sin asignar'
    return tienda_service.get_tienda_nombre(codigo_tienda)

# ========================================
# ENDPOINTS PRINCIPALES (MEJORADOS CON TIENDAS)
# ========================================

@router.get("/")
async def get_playlists(
    search: Optional[str] = None,
    status: Optional[str] = None,
    id_tienda: Optional[str] = Query(None, description="Filtrar por código de tienda"),  # NUEVO
    sort: Optional[str] = "creation_date_desc",
    page: int = 1,
    page_size: int = 24,
    limit: Optional[int] = None,
    include_stats: bool = Query(False, description="Incluir estadísticas de videos"),  # NUEVO
    db: Session = Depends(get_db)
):
    """
    Obtener todas las listas de reproducción con filtros y paginación
    Versión mejorada con soporte para filtros por tienda
    """
    try:
        # Obtener servicio de tiendas de forma segura
        tienda_service = get_tienda_service_safe(db)
        
        # Asegurarnos de que limit no sea demasiado grande para evitar problemas de memoria
        if limit and limit > 10000:
            logger.warning(f"Límite demasiado grande ({limit}), restringiendo a 10000")
            limit = 10000

        # Iniciar la consulta base
        query = db.query(Playlist)
        
        # Aplicar filtros existentes
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Playlist.title.ilike(search_term),
                    Playlist.description.ilike(search_term)
                )
            )
        
        # NUEVO: Filtro por tienda con validación dinámica
        if id_tienda:
            if tienda_service and not validate_tienda_code_safe(tienda_service, id_tienda):
                # Obtener códigos válidos para el error
                valid_codes = tienda_service.get_valid_tienda_codes() if tienda_service else []
                raise HTTPException(
                    status_code=400,
                    detail=f"Código de tienda inválido: {id_tienda}. Válidos: {', '.join(valid_codes)}"
                )
            
            # Normalizar código
            normalized_tienda = normalize_tienda_code_safe(tienda_service, id_tienda)
            
            if normalized_tienda:
                query = query.filter(Playlist.id_tienda == normalized_tienda)
            else:
                # Buscar playlists sin tienda asignada
                query = query.filter(Playlist.id_tienda.is_(None))
        
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
        
        # Aplicar ordenamiento (incluyendo nuevo soporte para tienda)
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
                elif sort_field == "tienda":  # NUEVO: ordenamiento por tienda
                    order_col = Playlist.id_tienda
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
        
        # NUEVO: Agregar estadísticas si se solicitan
        if include_stats:
            for playlist in playlists:
                # Contar videos en la playlist
                playlist.video_count = db.query(PlaylistVideo).filter(
                    PlaylistVideo.playlist_id == playlist.id
                ).count()
                
                # Calcular duración total
                total_duration = db.query(
                    func.sum(Video.duration)
                ).join(
                    PlaylistVideo, Video.id == PlaylistVideo.video_id
                ).filter(
                    PlaylistVideo.playlist_id == playlist.id
                ).scalar() or 0
                
                playlist.total_duration = total_duration
                
                # Agregar nombre de tienda usando el servicio
                playlist.tienda_nombre = get_tienda_nombre_safe(tienda_service, playlist.id_tienda)
        
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
    Manteniendo compatibilidad con estructura existente
    """
    try:
        # Obtener servicio de tiendas de forma segura
        tienda_service = get_tienda_service_safe(db)
        
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Obtener videos ordenados - MANTENIDO: usar position
        playlist_videos = db.query(
            Video, PlaylistVideo.position
        ).join(
            PlaylistVideo, Video.id == PlaylistVideo.video_id
        ).filter(
            PlaylistVideo.playlist_id == playlist_id
        ).order_by(PlaylistVideo.position).all()
        
        # Formatear respuesta
        playlist.videos = [
            {
                "id": video.id,
                "title": video.title,
                "description": video.description,
                "duration": video.duration,
                "thumbnail": getattr(video, 'thumbnail', None),
                "position": position,
                "order": position  # Mantener para compatibilidad con frontend
            }
            for video, position in playlist_videos
        ]
        
        playlist.video_count = len(playlist.videos)
        playlist.total_duration = sum(v["duration"] or 0 for v in playlist.videos)
        
        # NUEVO: Agregar información de tienda
        playlist.tienda_nombre = get_tienda_nombre_safe(tienda_service, playlist.id_tienda)
        
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
    current_user = Depends(get_current_user())
):
    """
    Crear nueva lista de reproducción
    Versión mejorada con soporte para tiendas
    """
    try:
        # Obtener servicio de tiendas de forma segura
        tienda_service = get_tienda_service_safe(db)
        
        # NUEVO: Validar código de tienda si se proporciona
        id_tienda = playlist_data.get("id_tienda")
        if id_tienda:
            if tienda_service and not validate_tienda_code_safe(tienda_service, id_tienda):
                valid_codes = tienda_service.get_valid_tienda_codes() if tienda_service else []
                raise HTTPException(
                    status_code=400,
                    detail=f"Código de tienda inválido: {id_tienda}. Válidos: {', '.join(valid_codes)}"
                )
            id_tienda = normalize_tienda_code_safe(tienda_service, id_tienda)
        
        new_playlist = Playlist(
            title=playlist_data["title"],
            description=playlist_data.get("description"),
            start_date=playlist_data.get("start_date"),
            expiration_date=playlist_data.get("expiration_date"),
            is_active=playlist_data.get("is_active", True),
            id_tienda=id_tienda  # NUEVO CAMPO
        )
        
        db.add(new_playlist)
        db.commit()
        db.refresh(new_playlist)
        
        # NUEVO: Agregar información de tienda a la respuesta
        new_playlist.tienda_nombre = get_tienda_nombre_safe(tienda_service, new_playlist.id_tienda)
        
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
    current_user = Depends(require_authenticated_user())
):
    """
    Actualizar lista de reproducción existente
    Versión mejorada con soporte para cambio de tienda
    """
    try:
        # Obtener servicio de tiendas de forma segura
        tienda_service = get_tienda_service_safe(db)
        
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # NUEVO: Validar código de tienda si se está actualizando
        if "id_tienda" in playlist_data:
            id_tienda = playlist_data["id_tienda"]
            if id_tienda:  # Si no es una cadena vacía
                if tienda_service and not validate_tienda_code_safe(tienda_service, id_tienda):
                    valid_codes = tienda_service.get_valid_tienda_codes() if tienda_service else []
                    raise HTTPException(
                        status_code=400,
                        detail=f"Código de tienda inválido: {id_tienda}. Válidos: {', '.join(valid_codes)}"
                    )
                id_tienda = normalize_tienda_code_safe(tienda_service, id_tienda)
            playlist.id_tienda = id_tienda
        
        # Actualizar campos existentes
        playlist.title = playlist_data.get("title", playlist.title)
        playlist.description = playlist_data.get("description", playlist.description)
        playlist.start_date = playlist_data.get("start_date", playlist.start_date)
        playlist.expiration_date = playlist_data.get("expiration_date", playlist.expiration_date)
        playlist.is_active = playlist_data.get("is_active", playlist.is_active)
        
        db.commit()
        
        # NUEVO: Agregar información de tienda a la respuesta
        playlist.tienda_nombre = get_tienda_nombre_safe(tienda_service, playlist.id_tienda)
        
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
    current_user = Depends(require_authenticated_user())
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
# ENDPOINTS PARA edit-playlist.html (MANTENIDOS)
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
        # Obtener servicio de tiendas de forma segura
        tienda_service = get_tienda_service_safe(db)
        
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Obtener videos con información completa - MANTENIDO: usar position
        playlist_videos = db.query(
            Video, PlaylistVideo.position
        ).join(
            PlaylistVideo, Video.id == PlaylistVideo.video_id
        ).filter(
            PlaylistVideo.playlist_id == playlist_id
        ).order_by(PlaylistVideo.position).all()
        
        playlist.videos = [
            {
                "id": video.id,
                "title": video.title,
                "description": video.description,
                "duration": video.duration,
                "thumbnail": getattr(video, 'thumbnail', None),
                "file_path": video.file_path,
                "tags": getattr(video, 'tags', None),
                "position": position,
                "order": position  # Mantener para compatibilidad
            }
            for video, position in playlist_videos
        ]
        
        # NUEVO: Agregar información de tienda
        playlist.tienda_nombre = get_tienda_nombre_safe(tienda_service, playlist.id_tienda)
        
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
    current_user = Depends(require_authenticated_user())
):
    """
    Actualizar orden de videos en la playlist
    """
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(status_code=404, detail="Lista no encontrada")
        
        # Actualizar posición de cada video - MANTENIDO: usar position
        for video_order in order_data["videos"]:
            db.query(PlaylistVideo).filter(
                PlaylistVideo.playlist_id == playlist_id,
                PlaylistVideo.video_id == video_order["video_id"]
            ).update({"position": video_order.get("position", video_order.get("order"))})
        
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
    current_user = Depends(require_authenticated_user())
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
        
        # Obtener la siguiente posición - MANTENIDO: usar position y func importado
        max_position = db.query(
            func.max(PlaylistVideo.position)
        ).filter(
            PlaylistVideo.playlist_id == playlist_id
        ).scalar() or 0
        
        # Añadir video
        playlist_video = PlaylistVideo(
            playlist_id=playlist_id,
            video_id=video_id,
            position=max_position + 1  # MANTENIDO: usar position
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
    current_user = Depends(require_authenticated_user())
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
        
        # Reordenar videos restantes - MANTENIDO: usar position
        remaining_videos = db.query(PlaylistVideo).filter(
            PlaylistVideo.playlist_id == playlist_id,
            PlaylistVideo.position > deleted_position
        ).all()
        
        for pv in remaining_videos:
            pv.position -= 1
        
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
# ENDPOINTS PARA BÚSQUEDA DE VIDEOS (MANTENIDOS)
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

# ========================================
# NUEVOS ENDPOINTS ESPECÍFICOS PARA TIENDAS
# ========================================

@router.get("/by-tienda/{codigo_tienda}")
async def get_playlists_by_tienda(
    codigo_tienda: str,
    include_general: bool = Query(False, description="Incluir playlists generales (sin tienda asignada)"),
    only_active: bool = Query(True, description="Solo playlists activas"),
    db: Session = Depends(get_db)
):
    """
    Obtener playlists de una tienda específica con validación dinámica
    """
    try:
        # Obtener servicio de tiendas de forma segura
        tienda_service = get_tienda_service_safe(db)
        
        # Validar código de tienda
        if tienda_service and not validate_tienda_code_safe(tienda_service, codigo_tienda):
            valid_codes = tienda_service.get_valid_tienda_codes() if tienda_service else []
            raise HTTPException(
                status_code=400,
                detail=f"Código de tienda inválido: {codigo_tienda}. Válidos: {', '.join(valid_codes)}"
            )
        
        codigo_tienda = normalize_tienda_code_safe(tienda_service, codigo_tienda)
        
        # Construir query
        query = db.query(Playlist)
        
        if include_general:
            # Incluir playlists de la tienda Y las generales
            query = query.filter(
                or_(
                    Playlist.id_tienda == codigo_tienda,
                    Playlist.id_tienda.is_(None)
                )
            )
        else:
            # Solo playlists de la tienda específica
            query = query.filter(Playlist.id_tienda == codigo_tienda)
        
        if only_active:
            query = query.filter(Playlist.is_active == True)
        
        playlists = query.order_by(Playlist.creation_date.desc()).all()
        
        # Agregar estadísticas y nombres de tienda
        for playlist in playlists:
            playlist.video_count = db.query(PlaylistVideo).filter(
                PlaylistVideo.playlist_id == playlist.id
            ).count()
            
            total_duration = db.query(
                func.sum(Video.duration)
            ).join(
                PlaylistVideo, Video.id == PlaylistVideo.video_id
            ).filter(
                PlaylistVideo.playlist_id == playlist.id
            ).scalar() or 0
            
            playlist.total_duration = total_duration
            playlist.tienda_nombre = get_tienda_nombre_safe(tienda_service, playlist.id_tienda)
        
        return playlists
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener playlists por tienda {codigo_tienda}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener playlists por tienda: {str(e)}")

@router.get("/tiendas/stats")
async def get_playlists_stats_by_tienda(db: Session = Depends(get_db)):
    """
    Obtener estadísticas de playlists agrupadas por tienda usando datos dinámicos
    """
    try:
        # Obtener servicio de tiendas de forma segura
        tienda_service = get_tienda_service_safe(db)
        
        # Query para obtener estadísticas por tienda
        tienda_stats = db.query(
            Playlist.id_tienda,
            func.count(Playlist.id).label('total_playlists'),
            func.sum(func.cast(Playlist.is_active, func.INTEGER)).label('active_playlists')
        ).group_by(Playlist.id_tienda).all()
        
        # Formatear resultados usando el servicio de tiendas
        stats = []
        for tienda_code, total, active in tienda_stats:
            tienda_nombre = get_tienda_nombre_safe(tienda_service, tienda_code)
            stats.append({
                'codigo_tienda': tienda_code,
                'nombre_tienda': tienda_nombre,
                'total_playlists': total,
                'active_playlists': active,
                'inactive_playlists': total - active
            })
        
        response = {
            'stats_by_tienda': stats,
            'total_general': sum(stat['total_playlists'] for stat in stats),
            'total_active': sum(stat['active_playlists'] for stat in stats)
        }
        
        # Agregar tiendas disponibles si el servicio está disponible
        if tienda_service:
            response['available_tiendas'] = tienda_service.get_tiendas_for_select()
        
        return response
        
    except Exception as e:
        logger.error(f"Error al obtener estadísticas por tienda: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener estadísticas: {str(e)}")

@router.get("/tiendas/available")
async def get_available_tiendas(db: Session = Depends(get_db)):
    """
    Endpoint para obtener las tiendas disponibles (para frontend)
    """
    try:
        # Obtener servicio de tiendas de forma segura
        tienda_service = get_tienda_service_safe(db)
        
        if not tienda_service:
            return {
                'message': 'Servicio de tiendas no disponible',
                'tiendas': [],
                'select_options': [],
                'valid_codes': []
            }
        
        return {
            'tiendas': tienda_service.get_all_tiendas(),
            'select_options': tienda_service.get_tiendas_for_select(),
            'valid_codes': tienda_service.get_valid_tienda_codes()
        }
    except Exception as e:
        logger.error(f"Error al obtener tiendas disponibles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener tiendas disponibles: {str(e)}")

# ========================================
# ENDPOINT DE COMPATIBILIDAD CON DISPOSITIVOS
# ========================================

@router.get("/compatible-with-device/{device_id}")
async def get_compatible_playlists_for_device(
    device_id: str,
    only_active: bool = Query(True, description="Solo playlists activas"),
    db: Session = Depends(get_db)
):
    """
    Obtener playlists compatibles con un dispositivo específico
    """
    try:
        # Obtener servicio de tiendas de forma segura
        tienda_service = get_tienda_service_safe(db)
        
        # Buscar dispositivo (asumiendo que tienes modelo Device)
        from models.models import Device
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
        
        # Construir query de playlists compatibles
        query = db.query(Playlist)
        
        if only_active:
            query = query.filter(Playlist.is_active == True)
        
        if device.tienda:
            # Dispositivo tiene tienda: incluir playlists de esa tienda + generales
            query = query.filter(
                or_(
                    Playlist.id_tienda == device.tienda,
                    Playlist.id_tienda.is_(None)
                )
            )
        else:
            # Dispositivo sin tienda: solo playlists generales
            query = query.filter(Playlist.id_tienda.is_(None))
        
        playlists = query.order_by(Playlist.creation_date.desc()).all()
        
        # Agregar información adicional
        for playlist in playlists:
            playlist.tienda_nombre = get_tienda_nombre_safe(tienda_service, playlist.id_tienda)
            playlist.compatible_reason = "general" if not playlist.id_tienda else f"misma_tienda ({playlist.id_tienda})"
        
        return {
            "device_info": {
                "device_id": device.device_id,
                "name": device.name,
                "tienda": device.tienda,
                "tienda_nombre": get_tienda_nombre_safe(tienda_service, device.tienda)
            },
            "compatible_playlists": playlists,
            "total_compatibles": len(playlists)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener playlists compatibles para dispositivo {device_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener playlists compatibles: {str(e)}")

# ========================================
# LOGGING DE ESTADO DE INTEGRACIÓN
# ========================================

if TIENDAS_INTEGRATION_AVAILABLE:
    logger.info("✅ Integración de tiendas dinámica activada")
else:
    logger.warning("⚠️ Integración de tiendas no disponible - funcionando en modo básico")