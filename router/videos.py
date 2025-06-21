# router/videos.py - Versión corregida con endpoint de descarga mejorado

import os
import shutil
import uuid
import logging
from typing import List, Optional
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from models.database import get_db
from models.models import Video
from models.schemas import VideoResponse, VideoUpdate

# Configurar logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/videos",
    tags=["videos"]
)

# Directorio para almacenar videos
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/", response_model=VideoResponse)
async def create_video(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    expiration_date: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Creando video: {title}")
        
        # Validar que el archivo sea un video
        if not file.content_type or not file.content_type.startswith("video/"):
            raise HTTPException(status_code=400, detail="El archivo debe ser un video")
        
        # Crear un nombre único para el archivo
        file_extension = os.path.splitext(file.filename)[1] if file.filename else ".mp4"
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Guardar el archivo
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Obtener el tamaño del archivo
        file_size = os.path.getsize(file_path)
        
        # Convertir la fecha de expiración si se proporcionó
        expiration_date_obj = None
        if expiration_date:
            try:
                expiration_date_obj = datetime.fromisoformat(expiration_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Formato de fecha de expiración inválido")
        
        # Crear el registro en la base de datos
        video_db = Video(
            title=title,
            description=description,
            filename=file.filename or unique_filename,
            file_path=file_path,
            file_size=file_size,
            upload_date=datetime.now(),
            expiration_date=expiration_date_obj
        )
        
        db.add(video_db)
        db.commit()
        db.refresh(video_db)
        
        logger.info(f"Video creado exitosamente: ID {video_db.id}")
        return video_db
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al crear video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear video: {str(e)}")

@router.get("/", response_model=List[VideoResponse])
def get_videos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    try:
        videos = db.query(Video).offset(skip).limit(limit).all()
        logger.info(f"Retornando {len(videos)} videos (skip={skip}, limit={limit})")
        return videos
    except Exception as e:
        logger.error(f"Error al obtener videos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener videos: {str(e)}")

@router.get("/{video_id}", response_model=VideoResponse)
def get_video(video_id: int, db: Session = Depends(get_db)):
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if video is None:
            raise HTTPException(status_code=404, detail="Video no encontrado")
        return video
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener video {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener video: {str(e)}")

@router.put("/{video_id}", response_model=VideoResponse)
def update_video(
    video_id: int,
    video_update: VideoUpdate,
    db: Session = Depends(get_db)
):
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if video is None:
            raise HTTPException(status_code=404, detail="Video no encontrado")
        
        # Actualizar campos
        if video_update.title is not None:
            video.title = video_update.title
        if video_update.description is not None:
            video.description = video_update.description
        if video_update.expiration_date is not None:
            video.expiration_date = video_update.expiration_date
        
        db.commit()
        db.refresh(video)
        
        logger.info(f"Video {video_id} actualizado exitosamente")
        return video
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al actualizar video {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al actualizar video: {str(e)}")

@router.get("/{video_id}/download")
def download_video(
    video_id: int, 
    db: Session = Depends(get_db)
):
    """
    Endpoint mejorado para descargar videos con mejor logging y manejo de errores
    """
    try:
        logger.info(f"Solicitando descarga de video ID: {video_id}")
        
        # Buscar el video en la base de datos
        video = db.query(Video).filter(Video.id == video_id).first()
        if video is None:
            logger.warning(f"Video no encontrado en BD: ID {video_id}")
            raise HTTPException(status_code=404, detail="Video no encontrado")
        
        logger.info(f"Video encontrado: {video.title} - Archivo: {video.file_path}")
        
        # Verificar si el video ha expirado
        if video.expiration_date and video.expiration_date < datetime.now():
            logger.warning(f"Video {video_id} ha expirado: {video.expiration_date}")
            raise HTTPException(status_code=403, detail="Este video ha expirado y ya no está disponible")
        
        # Verificar que el archivo existe
        if not video.file_path:
            logger.error(f"Video {video_id} no tiene ruta de archivo definida")
            raise HTTPException(status_code=500, detail="El video no tiene una ruta de archivo válida")
        
        # Convertir a Path para mejor manejo
        file_path = Path(video.file_path)
        
        # Verificar que el archivo existe físicamente
        if not file_path.exists():
            logger.error(f"Archivo no encontrado en el sistema: {file_path}")
            # Intentar buscar en directorio uploads con nombre original
            upload_path = Path(UPLOAD_DIR) / video.filename
            if upload_path.exists():
                logger.info(f"Archivo encontrado en ruta alternativa: {upload_path}")
                file_path = upload_path
                # Actualizar la ruta en la base de datos
                video.file_path = str(upload_path)
                db.commit()
            else:
                raise HTTPException(status_code=404, detail="Archivo de video no encontrado en el servidor")
        
        # Verificar que el archivo es legible
        if not file_path.is_file():
            logger.error(f"La ruta no apunta a un archivo válido: {file_path}")
            raise HTTPException(status_code=500, detail="La ruta del video no apunta a un archivo válido")
        
        # Obtener información del archivo
        file_size = file_path.stat().st_size
        logger.info(f"Preparando descarga - Archivo: {file_path.name}, Tamaño: {file_size} bytes")
        
        # Determinar el tipo de contenido basado en la extensión
        content_types = {
            '.mp4': 'video/mp4',
            '.avi': 'video/avi',
            '.mov': 'video/quicktime',
            '.mkv': 'video/x-matroska',
            '.webm': 'video/webm',
            '.flv': 'video/x-flv',
            '.wmv': 'video/x-ms-wmv'
        }
        
        file_extension = file_path.suffix.lower()
        media_type = content_types.get(file_extension, 'video/mp4')
        
        # Generar nombre de archivo para descarga
        download_filename = video.filename or f"{video.title or 'video'}_{video_id}{file_extension}"
        
        # Asegurar que el nombre de archivo sea seguro
        safe_filename = "".join(c for c in download_filename if c.isalnum() or c in (' ', '-', '_', '.')).rstrip()
        
        logger.info(f"Iniciando descarga: {safe_filename} ({media_type})")
        
        # Retornar FileResponse para descarga
        return FileResponse(
            path=str(file_path),
            filename=safe_filename,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}",
                "Content-Length": str(file_size)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error inesperado al descargar video {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno al descargar video: {str(e)}")

@router.delete("/{video_id}")
def delete_video(
    video_id: int, 
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Eliminando video ID: {video_id}")
        
        video = db.query(Video).filter(Video.id == video_id).first()
        if video is None:
            raise HTTPException(status_code=404, detail="Video no encontrado")
        
        # Eliminar el archivo físico si existe
        if video.file_path and os.path.exists(video.file_path):
            try:
                os.remove(video.file_path)
                logger.info(f"Archivo físico eliminado: {video.file_path}")
            except OSError as e:
                logger.warning(f"No se pudo eliminar el archivo físico: {e}")
        
        # Eliminar de la base de datos
        db.delete(video)
        db.commit()
        
        logger.info(f"Video {video_id} eliminado exitosamente")
        return {"message": "Video eliminado correctamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error al eliminar video {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al eliminar video: {str(e)}")

# Endpoint adicional para diagnóstico
@router.get("/{video_id}/info")
def get_video_info(video_id: int, db: Session = Depends(get_db)):
    """
    Endpoint de diagnóstico para obtener información detallada del video
    """
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if video is None:
            raise HTTPException(status_code=404, detail="Video no encontrado")
        
        file_exists = os.path.exists(video.file_path) if video.file_path else False
        file_size_actual = os.path.getsize(video.file_path) if file_exists else 0
        
        info = {
            "id": video.id,
            "title": video.title,
            "filename": video.filename,
            "file_path": video.file_path,
            "file_size_db": video.file_size,
            "file_size_actual": file_size_actual,
            "file_exists": file_exists,
            "upload_date": video.upload_date,
            "expiration_date": video.expiration_date,
            "is_expired": video.expiration_date and video.expiration_date < datetime.now(),
            "upload_directory": UPLOAD_DIR,
            "upload_dir_exists": os.path.exists(UPLOAD_DIR)
        }
        
        return info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener info del video {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener información: {str(e)}")

# Endpoint para listar archivos en el directorio de uploads
@router.get("/debug/files")
def list_upload_files():
    """
    Endpoint de diagnóstico para listar archivos en el directorio de uploads
    """
    try:
        if not os.path.exists(UPLOAD_DIR):
            return {"error": f"Directorio {UPLOAD_DIR} no existe"}
        
        files = []
        for filename in os.listdir(UPLOAD_DIR):
            filepath = os.path.join(UPLOAD_DIR, filename)
            if os.path.isfile(filepath):
                files.append({
                    "filename": filename,
                    "size": os.path.getsize(filepath),
                    "modified": datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
                })
        
        return {
            "upload_directory": UPLOAD_DIR,
            "file_count": len(files),
            "files": files
        }
        
    except Exception as e:
        logger.error(f"Error al listar archivos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al listar archivos: {str(e)}")