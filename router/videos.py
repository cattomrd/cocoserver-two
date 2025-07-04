# router/videos.py - Versión corregida con endpoint de descarga mejorado

import os
import shutil
import uuid
import logging
from typing import List, Optional
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Query, Request, Response
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
    limit: int = Query(1000, ge=1, le=1001),
    db: Session = Depends(get_db)
):
    try:
        videos = db.query(Video).offset(skip).limit(limit).all()
        logger.info(f"Retornando {len(videos)} videos (skip={skip}, limit={limit})")
        return videos
    except Exception as e:
        logger.error(f"Error al obtener videos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener videos: {str(e)}")

# Añade o modifica este endpoint en router/videos.py

@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtener información detallada de un video específico.
    """
    try:
        # Buscar el video en la base de datos
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video no encontrado")
        
        # Verificar si el archivo existe
        file_exists = os.path.exists(video.file_path) if video.file_path else False
        
        # Extraer el nombre del archivo de la ruta completa
        filename = os.path.basename(video.file_path) if video.file_path else "unknown.mp4"
        
        # Crear un objeto VideoResponse con los datos del video
        # NOTA: Solo incluir atributos que existen en el modelo Video y en el esquema VideoResponse
        response = {
            "id": video.id,
            "title": video.title,
            "description": video.description,
            "file_path": video.file_path,
            "file_size": video.file_size,
            "upload_date": video.upload_date,
            "duration": video.duration,
            "expiration_date": video.expiration_date,
            # Añadir propiedades adicionales que puedan ser útiles para el frontend
            "file_exists": file_exists,
            # No incluir 'filename' como atributo directo, sino extraerlo de file_path
            # para evitar el error 'Video' object has no attribute 'filename'
        }
        
        # Registrar en el log la consulta
        logger.info(f"Obteniendo información del video ID {video_id}: {video.title}")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener info del video {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener información del video: {str(e)}")

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

# Reemplaza el endpoint de descarga con esta versión que soporta HEAD

@router.get("/{video_id}/download")
@router.head("/{video_id}/download")  # Añadir soporte para solicitudes HEAD
async def download_video(
    video_id: int,
    request: Request,  # Añadir Request para verificar el método
    db: Session = Depends(get_db)
):
    """
    Endpoint para descargar un video completo.
    También maneja solicitudes HEAD para verificar disponibilidad.
    """
    try:
        # Buscar el video en la base de datos
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video no encontrado")
        
        # Verificar que el archivo existe
        video_path = Path(video.file_path)
        if not video_path.exists() or not video_path.is_file():
            logger.error(f"Archivo de video no encontrado: {video.file_path}")
            raise HTTPException(status_code=404, detail="Archivo de video no encontrado")
        
        # Generar un nombre de archivo para la descarga
        download_filename = f"{video.title or 'video'}{video_path.suffix}"
        # Sanitizar el nombre de archivo para evitar caracteres inválidos
        download_filename = "".join(c for c in download_filename if c.isalnum() or c in "._- ")
        
        # Para solicitudes HEAD, solo devolver los headers sin el cuerpo
        if request.method == "HEAD":
            # Obtener tamaño del archivo
            file_size = video_path.stat().st_size
            
            # Configurar los headers de respuesta
            headers = {
                "Content-Disposition": f'attachment; filename="{download_filename}"',
                "Content-Type": "application/octet-stream",
                "Content-Length": str(file_size),
                "Accept-Ranges": "bytes"
            }
            
            logger.info(f"Verificación HEAD para video ID {video_id}: {video.file_path}")
            return Response(headers=headers)
        
        # Para solicitudes GET, devolver el archivo completo
        logger.info(f"Descargando video ID {video_id}: {video.file_path} como {download_filename}")
        
        return FileResponse(
            path=video.file_path,
            filename=download_filename,
            media_type="application/octet-stream"  # Forzar descarga en lugar de reproducción
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al procesar video {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al procesar el video: {str(e)}")

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


@router.get("/{video_id}/stream")
async def stream_video(
    video_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Endpoint para streaming de videos con soporte para rangos de bytes.
    Permite la reproducción directa en el navegador con seeking.
    """
    # Buscar el video en la base de datos
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    
    # Verificar que el archivo existe
    video_path = Path(video.file_path)
    if not video_path.exists() or not video_path.is_file():
        logger.error(f"Archivo de video no encontrado: {video.file_path}")
        raise HTTPException(status_code=404, detail="Archivo de video no encontrado")
    
    # Obtener el tamaño del archivo
    file_size = video_path.stat().st_size
    
    # Determinar el tipo de contenido basado en la extensión del archivo
    content_type = get_content_type(video_path)
    
    # Implementar soporte para rangos de bytes (byte ranges)
    # Esto permite la búsqueda (seeking) en el reproductor de video
    range_header = request.headers.get("Range", "").strip()
    
    start_byte = 0
    end_byte = file_size - 1
    
    # Procesar el header Range si existe
    if range_header and range_header.startswith("bytes="):
        range_data = range_header.replace("bytes=", "").split("-")
        
        if len(range_data) == 2:
            if range_data[0]:
                start_byte = int(range_data[0])
            if range_data[1]:
                end_byte = min(int(range_data[1]), file_size - 1)
    
    # Calcular el tamaño del contenido a enviar
    content_length = end_byte - start_byte + 1
    
    # Definir la función para leer el archivo por partes
    async def video_stream_generator():
        """
        Generador asíncrono para transmitir el archivo por partes.
        """
        with open(video.file_path, "rb") as video_file:
            # Mover el puntero al byte inicial
            video_file.seek(start_byte)
            
            # Tamaño del fragmento a leer cada vez
            chunk_size = 1024 * 1024  # 1MB
            bytes_sent = 0
            
            # Leer y enviar fragmentos hasta completar el rango solicitado
            while bytes_sent < content_length:
                # Leer el siguiente fragmento
                remaining = content_length - bytes_sent
                chunk = video_file.read(min(chunk_size, remaining))
                
                if not chunk:
                    break
                
                bytes_sent += len(chunk)
                yield chunk
    
    # Headers HTTP para la respuesta
    headers = {
        "Content-Type": content_type,
        "Content-Length": str(content_length),
        "Accept-Ranges": "bytes",
    }
    
    # Si es una solicitud de rango, agregar el header Content-Range
    if range_header:
        headers["Content-Range"] = f"bytes {start_byte}-{end_byte}/{file_size}"
        status_code = 206  # Partial Content
    else:
        status_code = 200  # OK
    
    # Registrar en el log el streaming
    logger.info(f"Streaming video ID {video_id}: {start_byte}-{end_byte}/{file_size} ({content_type})")
    
    # Devolver la respuesta de streaming
    return StreamingResponse(
        video_stream_generator(),
        status_code=status_code,
        headers=headers
    )

def get_content_type(file_path: Path) -> str:
    """
    Determina el tipo MIME basado en la extensión del archivo.
    """
    extension = file_path.suffix.lower()
    
    # Mapeo de extensiones comunes de video a tipos MIME
    mime_types = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".ogg": "video/ogg",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".wmv": "video/x-ms-wmv",
        ".flv": "video/x-flv",
        ".mkv": "video/x-matroska",
        ".3gp": "video/3gpp",
        ".ts": "video/mp2t",
        ".m4v": "video/x-m4v",
    }
    
    # Devolver el tipo MIME correspondiente o un tipo genérico si no se encuentra
    return mime_types.get(extension, "application/octet-stream")


    # Añade o modifica este endpoint en router/videos.py

@router.get("/{video_id}/info", response_model=dict)
async def get_video_info(
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtener información detallada de un video específico.
    """
    try:
        # Buscar el video en la base de datos
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video no encontrado")
        
        # Verificar si el archivo existe
        file_exists = os.path.exists(video.file_path) if video.file_path else False
        
        # Extraer el nombre del archivo de la ruta completa
        file_name = os.path.basename(video.file_path) if video.file_path else "unknown.mp4"
        
        # Crear un objeto con los datos del video
        # Solo incluir atributos que existen en el modelo Video
        response = {
            "id": video.id,
            "title": video.title,
            "description": video.description,
            "file_path": video.file_path,
            "file_size": video.file_size,
            "upload_date": video.upload_date,
            "duration": video.duration,
            "expiration_date": video.expiration_date,
            # Añadir propiedades derivadas
            "file_exists": file_exists,
            "file_name": file_name,  # Usar file_name en lugar de filename
            # Propiedades formateadas para el frontend
            "formatted_duration": video.formatted_duration if hasattr(video, 'formatted_duration') else formatDuration(video.duration),
            "formatted_file_size": video.formatted_file_size if hasattr(video, 'formatted_file_size') else formatFileSize(video.file_size)
        }
        
        # Registrar en el log la consulta
        logger.info(f"Obteniendo información del video ID {video_id}: {video.title}")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener info del video {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener información del video: {str(e)}")

# Funciones auxiliares para formatear duración y tamaño
def formatDuration(seconds):
    """Formatea la duración en segundos a formato legible"""
    if seconds is None:
        return "Desconocida"
    
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02}"

def formatFileSize(size_bytes):
    """Formatea el tamaño en bytes a formato legible"""
    if size_bytes is None:
        return "Desconocido"
    
    # Convertir bytes a una unidad legible
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024 or unit == 'GB':
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024