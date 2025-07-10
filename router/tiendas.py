# router/tiendas.py
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import logging

from models import models, schemas
from models.database import get_db

# Configuración del logger
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/tiendas",
    tags=["tiendas"]
)

@router.get("/", response_model=List[schemas.TiendaResponse])
def get_tiendas(
    skip: int = 0,
    limit: int = 1000,
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """
    Obtener lista de todas las tiendas
    
    Args:
        skip: Número de registros a omitir (para paginación)
        limit: Límite de registros a devolver
        active_only: Si es True, solo devuelve tiendas que tienen dispositivos activos
        db: Sesión de base de datos
    
    Returns:
        List[TiendaResponse]: Lista de tiendas
    """
    try:
        query = db.query(models.Tienda)
        
        if active_only:
            # Solo tiendas que tienen al menos un dispositivo activo
            query = query.join(models.Device, models.Device.tienda == models.Tienda.tienda)\
                        .filter(models.Device.is_active == True)\
                        .distinct()
        
        tiendas = query.offset(skip).limit(limit).all()
        
        logger.info(f"Devolviendo {len(tiendas)} tiendas")
        return tiendas
        
    except Exception as e:
        logger.error(f"Error obteniendo tiendas: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/count")
def get_tiendas_count(
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """
    Obtener el número total de tiendas
    
    Args:
        active_only: Si es True, cuenta solo tiendas con dispositivos activos
        db: Sesión de base de datos
    
    Returns:
        dict: Diccionario con el total de tiendas
    """
    try:
        query = db.query(models.Tienda)
        
        if active_only:
            # Solo tiendas que tienen al menos un dispositivo activo
            query = query.join(models.Device, models.Device.tienda == models.Tienda.tienda)\
                        .filter(models.Device.is_active == True)\
                        .distinct()
        
        total = query.count()
        
        return {
            "total": total,
            "active_only": active_only
        }
        
    except Exception as e:
        logger.error(f"Error contando tiendas: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/with-devices")
def get_tiendas_with_device_count(
    db: Session = Depends(get_db)
):
    """
    Obtener tiendas con el número de dispositivos asociados
    
    Args:
        db: Sesión de base de datos
    
    Returns:
        List[dict]: Lista de tiendas con conteo de dispositivos
    """
    try:
        # Query que cuenta dispositivos por tienda
        query = db.query(
            models.Tienda.id,
            models.Tienda.tienda,
            models.Tienda.location,
            db.func.count(models.Device.device_id).label('device_count'),
            db.func.count(
                db.case([(models.Device.is_active == True, 1)])
            ).label('active_device_count')
        ).outerjoin(
            models.Device, 
            models.Device.tienda == models.Tienda.tienda
        ).group_by(
            models.Tienda.id,
            models.Tienda.tienda,
            models.Tienda.location
        ).order_by(models.Tienda.tienda)
        
        results = query.all()
        
        # Convertir a formato de respuesta
        tiendas_with_devices = []
        for result in results:
            tiendas_with_devices.append({
                "id": result.id,
                "tienda": result.tienda,
                "location": result.location,
                "device_count": result.device_count,
                "active_device_count": result.active_device_count
            })
        
        logger.info(f"Devolviendo {len(tiendas_with_devices)} tiendas con conteo de dispositivos")
        return tiendas_with_devices
        
    except Exception as e:
        logger.error(f"Error obteniendo tiendas con dispositivos: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/{tienda_id}", response_model=schemas.TiendaResponse)
def get_tienda(
    tienda_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtener una tienda específica por ID
    
    Args:
        tienda_id: ID de la tienda
        db: Sesión de base de datos
    
    Returns:
        TiendaResponse: Datos de la tienda
    """
    try:
        tienda = db.query(models.Tienda).filter(models.Tienda.id == tienda_id).first()
        
        if tienda is None:
            raise HTTPException(status_code=404, detail="Tienda no encontrada")
        
        return tienda
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo tienda {tienda_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/", response_model=schemas.TiendaResponse, status_code=status.HTTP_201_CREATED)
def create_tienda(
    tienda: schemas.TiendaCreate,
    db: Session = Depends(get_db)
):
    """
    Crear una nueva tienda
    
    Args:
        tienda: Datos de la tienda a crear
        db: Sesión de base de datos
    
    Returns:
        TiendaResponse: Tienda creada
    """
    try:
        # Verificar si ya existe una tienda con el mismo nombre
        existing_tienda = db.query(models.Tienda).filter(
            models.Tienda.tienda == tienda.tienda
        ).first()
        
        if existing_tienda:
            raise HTTPException(
                status_code=400, 
                detail=f"Ya existe una tienda con el nombre '{tienda.tienda}'"
            )
        
        # Crear nueva tienda
        db_tienda = models.Tienda(**tienda.dict())
        db.add(db_tienda)
        db.commit()
        db.refresh(db_tienda)
        
        logger.info(f"Tienda creada: {db_tienda.tienda} (ID: {db_tienda.id})")
        return db_tienda
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creando tienda: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.put("/{tienda_id}", response_model=schemas.TiendaResponse)
def update_tienda(
    tienda_id: int,
    tienda: schemas.TiendaUpdate,
    db: Session = Depends(get_db)
):
    """
    Actualizar una tienda existente
    
    Args:
        tienda_id: ID de la tienda a actualizar
        tienda: Datos actualizados de la tienda
        db: Sesión de base de datos
    
    Returns:
        TiendaResponse: Tienda actualizada
    """
    try:
        db_tienda = db.query(models.Tienda).filter(models.Tienda.id == tienda_id).first()
        
        if db_tienda is None:
            raise HTTPException(status_code=404, detail="Tienda no encontrada")
        
        # Actualizar solo los campos proporcionados
        update_data = tienda.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_tienda, key, value)
        
        db.commit()
        db.refresh(db_tienda)
        
        logger.info(f"Tienda actualizada: {db_tienda.tienda} (ID: {db_tienda.id})")
        return db_tienda
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error actualizando tienda {tienda_id}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.delete("/{tienda_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tienda(
    tienda_id: int,
    db: Session = Depends(get_db)
):
    """
    Eliminar una tienda
    
    Args:
        tienda_id: ID de la tienda a eliminar
        db: Sesión de base de datos
    
    Returns:
        None
    """
    try:
        tienda = db.query(models.Tienda).filter(models.Tienda.id == tienda_id).first()
        
        if tienda is None:
            raise HTTPException(status_code=404, detail="Tienda no encontrada")
        
        # Verificar si hay dispositivos asociados
        devices_count = db.query(models.Device).filter(
            models.Device.tienda == tienda.tienda
        ).count()
        
        if devices_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"No se puede eliminar la tienda. Tiene {devices_count} dispositivos asociados."
            )
        
        db.delete(tienda)
        db.commit()
        
        logger.info(f"Tienda eliminada: {tienda.tienda} (ID: {tienda_id})")
        return {"status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error eliminando tienda {tienda_id}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/search/{search_term}")
def search_tiendas(
    search_term: str,
    db: Session = Depends(get_db)
):
    """
    Buscar tiendas por nombre o ubicación
    
    Args:
        search_term: Término de búsqueda
        db: Sesión de base de datos
    
    Returns:
        List[TiendaResponse]: Tiendas que coinciden con la búsqueda
    """
    try:
        tiendas = db.query(models.Tienda).filter(
            db.or_(
                models.Tienda.tienda.ilike(f'%{search_term}%'),
                models.Tienda.location.ilike(f'%{search_term}%')
            )
        ).order_by(models.Tienda.tienda).all()
        
        logger.info(f"Búsqueda '{search_term}': {len(tiendas)} tiendas encontradas")
        return tiendas
        
    except Exception as e:
        logger.error(f"Error en búsqueda de tiendas: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")