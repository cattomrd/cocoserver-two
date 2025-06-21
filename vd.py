#!/usr/bin/env python3
"""
Script de diagnóstico para videos - diagnose_videos.py
Ejecuta: python diagnose_videos.py
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# Agregar el directorio raíz al path para importar modelos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from models.database import SessionLocal
    from models.models import Video
    from sqlalchemy import text
except ImportError as e:
    print(f"Error al importar modelos: {e}")
    print("Asegúrate de ejecutar desde el directorio raíz del proyecto")
    sys.exit(1)

def diagnose_video_system():
    """Diagnostica el sistema de videos completo"""
    
    print("=" * 60)
    print("DIAGNÓSTICO DEL SISTEMA DE VIDEOS")
    print("=" * 60)
    
    # Crear sesión de base de datos
    db = SessionLocal()
    
    try:
        # 1. Verificar conexión a base de datos
        print("\n1. VERIFICANDO CONEXIÓN A BASE DE DATOS...")
        try:
            result = db.execute(text("SELECT 1")).fetchone()
            print("✅ Conexión a base de datos: OK")
        except Exception as e:
            print(f"❌ Error de conexión a BD: {e}")
            return
        
        # 2. Contar videos en base de datos
        print("\n2. CONTANDO VIDEOS EN BASE DE DATOS...")
        total_videos = db.query(Video).count()
        print(f"📊 Total de videos en BD: {total_videos}")
        
        if total_videos == 0:
            print("⚠️  No hay videos en la base de datos")
            return
        
        # 3. Verificar directorio de uploads
        print("\n3. VERIFICANDO DIRECTORIO DE UPLOADS...")
        upload_dir = Path("uploads")
        if upload_dir.exists():
            files_in_upload = list(upload_dir.glob("*"))
            print(f"✅ Directorio uploads existe")
            print(f"📁 Archivos en uploads: {len(files_in_upload)}")
        else:
            print("❌ Directorio uploads no existe")
            return
        
        # 4. Verificar video específico (ID 130)
        print("\n4. VERIFICANDO VIDEO ID 130...")
        video_130 = db.query(Video).filter(Video.id == 130).first()
        
        if video_130:
            print("✅ Video ID 130 encontrado en BD")
            print(f"   📝 Título: {video_130.title}")
            print(f"   📄 Archivo: {video_130.filename}")
            print(f"   📍 Ruta: {video_130.file_path}")
            print(f"   📅 Subido: {video_130.upload_date}")
            print(f"   ⏰ Expira: {video_130.expiration_date or 'Nunca'}")
            
            # Verificar si el archivo existe
            if video_130.file_path:
                file_path = Path(video_130.file_path)
                if file_path.exists():
                    print(f"✅ Archivo existe: {file_path}")
                    print(f"   📊 Tamaño: {file_path.stat().st_size} bytes")
                else:
                    print(f"❌ Archivo NO existe: {file_path}")
                    
                    # Buscar archivo en uploads con nombre original
                    if video_130.filename:
                        alt_path = upload_dir / video_130.filename
                        if alt_path.exists():
                            print(f"✅ Archivo encontrado en ruta alternativa: {alt_path}")
                            print(f"   📊 Tamaño: {alt_path.stat().st_size} bytes")
                        else:
                            print(f"❌ Archivo tampoco en ruta alternativa: {alt_path}")
            else:
                print("❌ Video no tiene ruta de archivo definida")
        else:
            print("❌ Video ID 130 NO encontrado en base de datos")
            
            # Mostrar videos cercanos
            nearby_videos = db.query(Video).filter(
                (Video.id >= 125) & (Video.id <= 135)
            ).all()
            
            if nearby_videos:
                print("\n   📋 Videos con IDs cercanos:")
                for vid in nearby_videos:
                    status = "✅" if vid.file_path and Path(vid.file_path).exists() else "❌"
                    print(f"   {status} ID {vid.id}: {vid.title} ({vid.filename})")
            else:
                print("   📋 No hay videos con IDs cercanos al 130")
        
        # 5. Análisis general de archivos faltantes
        print("\n5. ANÁLISIS GENERAL DE ARCHIVOS...")
        all_videos = db.query(Video).all()
        missing_files = []
        videos_without_path = []
        
        for video in all_videos:
            if not video.file_path:
                videos_without_path.append(video)
            elif not Path(video.file_path).exists():
                missing_files.append(video)
        
        print(f"📊 Videos sin ruta de archivo: {len(videos_without_path)}")
        print(f"📊 Videos con archivos faltantes: {len(missing_files)}")
        
        if videos_without_path:
            print("   📋 Videos sin ruta:")
            for vid in videos_without_path[:5]:  # Mostrar solo los primeros 5
                print(f"   - ID {vid.id}: {vid.title}")
            if len(videos_without_path) > 5:
                print(f"   ... y {len(videos_without_path) - 5} más")
        
        if missing_files:
            print("   📋 Videos con archivos faltantes:")
            for vid in missing_files[:5]:  # Mostrar solo los primeros 5
                print(f"   - ID {vid.id}: {vid.title} -> {vid.file_path}")
            if len(missing_files) > 5:
                print(f"   ... y {len(missing_files) - 5} más")
        
        # 6. Listar archivos huérfanos
        print("\n6. VERIFICANDO ARCHIVOS HUÉRFANOS...")
        db_file_paths = {Path(v.file_path).name for v in all_videos if v.file_path}
        db_filenames = {v.filename for v in all_videos if v.filename}
        all_db_files = db_file_paths.union(db_filenames)
        
        orphan_files = []
        if upload_dir.exists():
            for file_path in upload_dir.iterdir():
                if file_path.is_file() and file_path.name not in all_db_files:
                    orphan_files.append(file_path)
        
        print(f"📊 Archivos huérfanos (no en BD): {len(orphan_files)}")
        if orphan_files:
            print("   📋 Archivos huérfanos:")
            for file_path in orphan_files[:5]:
                print(f"   - {file_path.name} ({file_path.stat().st_size} bytes)")
            if len(orphan_files) > 5:
                print(f"   ... y {len(orphan_files) - 5} más")
        
        # 7. Verificar videos expirados
        print("\n7. VERIFICANDO VIDEOS EXPIRADOS...")
        now = datetime.now()
        expired_videos = db.query(Video).filter(
            Video.expiration_date < now
        ).all()
        
        print(f"📊 Videos expirados: {len(expired_videos)}")
        if expired_videos:
            print("   📋 Videos expirados:")
            for vid in expired_videos[:5]:
                print(f"   - ID {vid.id}: {vid.title} (expiró: {vid.expiration_date})")
            if len(expired_videos) > 5:
                print(f"   ... y {len(expired_videos) - 5} más")
        
        print("\n" + "=" * 60)
        print("RESUMEN DEL DIAGNÓSTICO")
        print("=" * 60)
        print(f"📊 Total videos en BD: {total_videos}")
        print(f"📊 Videos sin ruta: {len(videos_without_path)}")
        print(f"📊 Videos con archivos faltantes: {len(missing_files)}")
        print(f"📊 Archivos huérfanos: {len(orphan_files)}")
        print(f"📊 Videos expirados: {len(expired_videos)}")
        
        if video_130:
            video_130_status = "✅ EXISTE" if video_130.file_path and Path(video_130.file_path).exists() else "❌ PROBLEMA"
            print(f"📊 Video ID 130: {video_130_status}")
        else:
            print("📊 Video ID 130: ❌ NO EXISTE EN BD")
        
    except Exception as e:
        print(f"\n❌ Error durante el diagnóstico: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        db.close()

def fix_video_paths():
    """Intenta reparar rutas de archivos rotas"""
    
    print("\n" + "=" * 60)
    print("REPARANDO RUTAS DE ARCHIVOS")
    print("=" * 60)
    
    db = SessionLocal()
    upload_dir = Path("uploads")
    
    try:
        videos_with_issues = db.query(Video).filter(
            (Video.file_path == None) | (Video.file_path == "")
        ).all()
        
        # También videos cuyo archivo no existe
        all_videos = db.query(Video).all()
        for video in all_videos:
            if video.file_path and not Path(video.file_path).exists():
                videos_with_issues.append(video)
        
        print(f"📊 Videos con problemas de ruta: {len(videos_with_issues)}")
        
        fixed_count = 0
        for video in videos_with_issues:
            if video.filename:
                # Intentar encontrar el archivo en uploads
                potential_path = upload_dir / video.filename
                if potential_path.exists():
                    print(f"✅ Reparando video ID {video.id}: {video.filename}")
                    video.file_path = str(potential_path)
                    fixed_count += 1
        
        if fixed_count > 0:
            db.commit()
            print(f"🔧 Rutas reparadas: {fixed_count}")
        else:
            print("ℹ️  No se encontraron rutas para reparar")
    
    except Exception as e:
        print(f"❌ Error durante la reparación: {e}")
        db.rollback()
    
    finally:
        db.close()

if __name__ == "__main__":
    diagnose_video_system()
    
    # Preguntar si quiere intentar reparar
    try:
        response = input("\n¿Deseas intentar reparar rutas de archivos automáticamente? (s/N): ")
        if response.lower() in ['s', 'si', 'sí', 'y', 'yes']:
            fix_video_paths()
    except KeyboardInterrupt:
        print("\nDiagnóstico terminado.")
    
    print("\n✅ Diagnóstico completado.")