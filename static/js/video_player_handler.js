/**
 * VIDEO PLAYER HANDLER
 * Mejoras para la reproducción de videos en playlist_detail.html
 * 
 * Este archivo contiene funciones optimizadas para la reproducción de videos
 * sin modificar el diseño del template original.
 */

(function() {
    'use strict';
    
    console.log('🎬 Inicializando video_player_handler.js...');
    
    // ==========================================
    // CONFIGURACIÓN PARA REPRODUCCIÓN DE VIDEOS
    // ==========================================
    
    // Configuración para reproducción de videos
    const VIDEO_CONFIG = {
        API_BASE: window.location.origin + '/api',
        FORMATS: ['mp4', 'webm', 'ogg'],
        FALLBACK_VIDEO: '/static/videos/placeholder.mp4',
        CORS_PROXY: '', // Dejar vacío si no se usa proxy CORS
        MAX_RETRIES: 2,
        DEFAULT_TYPE: 'video/mp4'
    };
    
    // Cache de información de videos ya consultados
    const videoCache = {};
    
    // ==========================================
    // FUNCIONES MEJORADAS PARA REPRODUCCIÓN
    // ==========================================
    
    /**
     * Construir URL del video para reproducción (versión mejorada)
     * @param {Object} videoData - Datos del video
     * @param {Number} retry - Número de intento (para fallbacks)
     * @returns {String} URL del video
     */
    function buildVideoUrl(videoData, retry = 0) {
        if (!videoData) return null;
        
        console.log('🔍 Construyendo URL para video:', videoData.id, 'Intento:', retry);
        
        // Array de estrategias de URL en orden de prioridad
        const urlStrategies = [
            // Estrategia 1: Si ya es una URL completa
            () => {
                if (videoData.file_path && (videoData.file_path.startsWith('http') || videoData.file_path.startsWith('//'))) {
                    console.log('✅ Usando URL completa:', videoData.file_path);
                    return videoData.file_path;
                }
                return null;
            },
            
            // Estrategia 2: Endpoint de streaming de la API
            () => {
                if (videoData.id) {
                    const url = `${VIDEO_CONFIG.API_BASE}/videos/${videoData.id}/stream`;
                    console.log('✅ Usando endpoint de streaming:', url);
                    return url;
                }
                return null;
            },
            
            // Estrategia 3: Ruta a carpeta de uploads
            () => {
                if (videoData.file_path) {
                    // Limpiar la ruta y construir URL
                    const cleanPath = videoData.file_path.replace(/^.*[\\\/]/, ''); // Solo nombre del archivo
                    const url = `${window.location.origin}/uploads/${cleanPath}`;
                    console.log('✅ Usando ruta a uploads:', url);
                    return url;
                }
                return null;
            },
            
            // Estrategia 4: Ruta a carpeta static/videos
            () => {
                if (videoData.id) {
                    // Intentar diferentes extensiones
                    const format = VIDEO_CONFIG.FORMATS[retry % VIDEO_CONFIG.FORMATS.length];
                    const url = `${window.location.origin}/static/videos/${videoData.id}.${format}`;
                    console.log('✅ Usando ruta a static/videos:', url);
                    return url;
                }
                return null;
            },
            
            // Estrategia 5: Endpoint directo de archivos
            () => {
                if (videoData.id) {
                    const url = `${window.location.origin}/files/videos/${videoData.id}`;
                    console.log('✅ Usando endpoint directo de archivos:', url);
                    return url;
                }
                return null;
            },
            
            // Estrategia 6: Video fallback
            () => {
                console.log('⚠️ Usando video fallback');
                return VIDEO_CONFIG.FALLBACK_VIDEO;
            }
        ];
        
        // Seleccionar la estrategia según el número de intento
        const strategyIndex = Math.min(retry, urlStrategies.length - 1);
        
        // Intentar estrategias en orden hasta encontrar una válida
        for (let i = strategyIndex; i < urlStrategies.length; i++) {
            const url = urlStrategies[i]();
            if (url) return url;
        }
        
        // Si llegamos aquí, no se pudo construir una URL
        console.error('❌ No se pudo construir URL para el video:', videoData);
        return VIDEO_CONFIG.FALLBACK_VIDEO;
    }
    
    /**
     * Obtener información del video
     * @param {Number} videoId - ID del video
     * @returns {Promise<Object>} - Datos del video
     */
    async function getVideoInfo(videoId) {
        // Si ya tenemos el video en cache, devolverlo
        if (videoCache[videoId]) {
            console.log('📋 Video encontrado en cache:', videoId);
            return videoCache[videoId];
        }
        
        // Buscar en videos de la playlist
        if (window.playlistVideos) {
            const videoData = window.playlistVideos.find(v => v.id == videoId);
            if (videoData) {
                console.log('📋 Video encontrado en playlist:', videoId);
                videoCache[videoId] = videoData;
                return videoData;
            }
        }
        
        // Si no está en la playlist, buscar en la API
        console.log('📋 Video no encontrado en playlist, consultando API...', videoId);
        
        try {
            const response = await fetch(`${VIDEO_CONFIG.API_BASE}/videos/${videoId}`);
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const videoData = await response.json();
            console.log('📋 Video obtenido de API:', videoData);
            
            // Guardar en cache
            videoCache[videoId] = videoData;
            
            return videoData;
        } catch (error) {
            console.error('❌ Error obteniendo datos del video:', error);
            return null;
        }
    }
    
    /**
     * Verificar si una URL existe
     * @param {String} url - URL a verificar
     * @returns {Promise<Boolean>} - true si la URL existe
     */
    async function checkUrlExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.warn('⚠️ Error verificando URL:', url, error);
            return false;
        }
    }
    
    /**
     * Mostrar vista previa de un video (versión mejorada)
     * @param {Number} videoId - ID del video a previsualizar
     */
    async function previewVideo(videoId) {
        console.log('🎬 Reproduciendo video:', videoId);
        
        try {
            // Obtener elementos del DOM
            const modal = document.getElementById('videoPreviewModal');
            const modalTitle = document.getElementById('previewVideoTitle');
            const modalDescription = document.getElementById('previewVideoDescription');
            let videoPlayer = document.getElementById('previewVideoPlayer');
            
            if (!modal || !videoPlayer) {
                throw new Error('Modal de previsualización no encontrado');
            }
            
            // Limpiar contenido anterior
            modalTitle.textContent = 'Cargando...';
            modalDescription.textContent = '';
            videoPlayer.pause();
            videoPlayer.src = '';
            videoPlayer.load();
            
            // Mostrar el modal
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
            
            // Obtener datos del video
            const videoData = await getVideoInfo(videoId);
            
            if (!videoData) {
                throw new Error('No se pudo obtener la información del video');
            }
            
            // Actualizar información del modal
            modalTitle.textContent = videoData.title || 'Video sin título';
            modalDescription.textContent = videoData.description || 'Sin descripción';
            
            // Variables para el control de reproducción
            let currentRetry = 0;
            let videoLoaded = false;
            
            // Función para intentar cargar el video
            const tryLoadVideo = (retry = 0) => {
                currentRetry = retry;
                
                // Si ya hemos superado el máximo de intentos, mostrar error
                if (retry > VIDEO_CONFIG.MAX_RETRIES) {
                    console.error('❌ Superado el máximo de intentos de carga');
                    modalTitle.textContent = `${videoData.title || 'Video sin título'} - Error de carga`;
                    modalDescription.textContent = 'No se pudo cargar el video después de varios intentos';
                    return;
                }
                
                // Construir URL del video
                const videoUrl = buildVideoUrl(videoData, retry);
                
                console.log(`📹 Intentando cargar video (intento ${retry + 1}/${VIDEO_CONFIG.MAX_RETRIES + 1}):`, videoUrl);
                
                // Actualizar UI
                modalTitle.textContent = `${videoData.title || 'Video sin título'} (Cargando...)`;
                
                // Configurar el reproductor
                videoPlayer.src = videoUrl;
                
                // Establecer el tipo MIME si es necesario
                const fileExtension = videoUrl.split('.').pop().toLowerCase();
                let mimeType = VIDEO_CONFIG.DEFAULT_TYPE;
                
                if (fileExtension === 'webm') mimeType = 'video/webm';
                else if (fileExtension === 'ogg') mimeType = 'video/ogg';
                
                // Crear o actualizar source
                let source = videoPlayer.querySelector('source');
                if (!source) {
                    source = document.createElement('source');
                    videoPlayer.appendChild(source);
                }
                
                source.src = videoUrl;
                source.type = mimeType;
                
                // Recargar el video
                videoPlayer.load();
            };
            
            // Limpieza de listeners más segura, sin reasignar videoPlayer
            const oldPlayer = videoPlayer;
            const newPlayer = oldPlayer.cloneNode(true);
            oldPlayer.parentNode.replaceChild(newPlayer, oldPlayer);
            videoPlayer = newPlayer; // Ahora es seguro, porque videoPlayer se declaró con 'let'
            
            // Event listeners para el video
            videoPlayer.addEventListener('loadstart', () => {
                console.log('📹 Iniciando carga del video...');
            });
            
            videoPlayer.addEventListener('loadeddata', () => {
                console.log('📹 Video cargado correctamente');
                modalTitle.textContent = videoData.title || 'Video sin título';
                videoLoaded = true;
                showToast('Video cargado correctamente', 'success');
            });
            
            videoPlayer.addEventListener('error', (e) => {
                console.error('❌ Error cargando video:', e);
                
                // Si no hemos superado el máximo de intentos, probar con otra estrategia
                if (currentRetry < VIDEO_CONFIG.MAX_RETRIES) {
                    console.log('🔄 Reintentando con otra estrategia...');
                    tryLoadVideo(currentRetry + 1);
                } else {
                    modalTitle.textContent = `${videoData.title || 'Video sin título'} - Error de carga`;
                    modalDescription.textContent = 'No se pudo cargar el video. Por favor, inténtelo más tarde.';
                }
            });
            
            // Iniciar la carga del video
            tryLoadVideo(0);
            
        } catch (error) {
            console.error('❌ Error en vista previa:', error);
            showToast(`Error: ${error.message}`, 'error');
            
            // Actualizar modal con error
            const modalTitle = document.getElementById('previewVideoTitle');
            const modalDescription = document.getElementById('previewVideoDescription');
            
            if (modalTitle) modalTitle.textContent = 'Error al cargar video';
            if (modalDescription) modalDescription.textContent = error.message;
        }
    }
    
    /**
     * Mostrar toast de notificación (versión simple)
     * @param {String} message - Mensaje a mostrar
     * @param {String} type - Tipo de toast (success, error, warning, info)
     */
    function showToast(message, type = 'info') {
        console.log(`🍞 Toast [${type}]: ${message}`);
        
        // Si hay una función global de toast, usarla
        if (window.showToast && typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }
        
        // Si no hay función global, usar implementación básica
        alert(`${type.toUpperCase()}: ${message}`);
    }
    
    // ==========================================
    // EXPORTAR FUNCIONES
    // ==========================================
    
    // Sobrescribir la función global previewVideo
    window.previewVideo = previewVideo;
    
    // Exportar otras funciones útiles
    window.videoPlayerHandler = {
        buildVideoUrl,
        getVideoInfo,
        checkUrlExists
    };
    
    console.log('✅ video_player_handler.js cargado correctamente');
})();