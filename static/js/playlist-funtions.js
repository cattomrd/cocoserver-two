/**
 * PLAYLIST-FUNCTIONS.JS - Funciones de Gestión de Playlist
 * Ubicación: static/js/playlist-functions.js
 * 
 * Requiere: api-config.js (debe cargarse antes)
 */

(function() {
    'use strict';
    
    console.log('🎵 Cargando funciones de playlist...');
    
    // ==========================================
    // FUNCIÓN: loadAvailableVideos
    // ==========================================
    
    window.loadAvailableVideos = async function() {
        console.log('🎬 Cargando videos disponibles...');
        
        const loadingElement = document.getElementById('loadingAvailableVideos');
        const availableVideosList = document.getElementById('availableVideosList');
        
        if (!availableVideosList) {
            console.error('❌ Elemento availableVideosList no encontrado');
            return;
        }

        // Mostrar loading
        if (loadingElement) {
            loadingElement.style.display = 'block';
            loadingElement.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mt-2 text-muted">Cargando videos disponibles...</p>
                </div>
            `;
        }

        try {
            const response = await window.safeFetch(window.API_CONFIG.VIDEOS.LIST);
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: No se pudieron cargar los videos`);
            }

            const data = await response.json();
            window.availableVideos = Array.isArray(data) ? data : (data.videos || []);
            
            console.log('✅ Videos disponibles cargados:', window.availableVideos.length);
            
            window.renderAvailableVideos();
            
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }

        } catch (error) {
            console.error('❌ Error cargando videos disponibles:', error);
            
            if (loadingElement) {
                loadingElement.innerHTML = `
                    <div class="text-center py-3 text-warning">
                        <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                        <p class="mb-1">Error conectando con la API</p>
                        <p class="small text-muted mb-2">No se pudieron cargar los videos disponibles</p>
                        <button class="btn btn-sm btn-outline-primary" onclick="loadAvailableVideos()">
                            <i class="fas fa-sync"></i> Reintentar
                        </button>
                    </div>
                `;
            }
            
            window.showToast(`Error cargando videos: ${error.message}`, 'error');
        }
    };
    
    // ==========================================
    // FUNCIÓN: renderAvailableVideos
    // ==========================================
    
    window.renderAvailableVideos = function() {
        const container = document.getElementById('availableVideosList');
        if (!container) {
            console.warn('⚠️ Container availableVideosList no encontrado');
            return;
        }
        
        // Filtrar videos que ya están en la playlist
        const playlistVideoIds = window.playlistVideos.map(v => parseInt(v.id));
        const filteredVideos = window.availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id)));
        
        if (filteredVideos.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-video fa-3x mb-3"></i>
                    <p class="mb-0">No hay videos disponibles para agregar</p>
                    <small>Todos los videos ya están en la playlist o no hay videos en el sistema</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredVideos.map(video => `
            <div class="available-video-item mb-2" data-video-id="${video.id}">
                <div class="card border-0 shadow-sm">
                    <div class="card-body p-2">
                        <div class="d-flex align-items-center">
                            <div class="video-thumbnail me-3">
                                <div class="bg-light d-flex align-items-center justify-content-center text-primary" 
                                     style="width: 50px; height: 40px; border-radius: 0.25rem;">
                                    <i class="fas fa-play-circle"></i>
                                </div>
                            </div>
                            <div class="flex-grow-1">
                                <h6 class="mb-1 small">${window.escapeHtml(video.title || 'Sin título')}</h6>
                                <div class="d-flex justify-content-between align-items-center">
                                    <small class="text-muted">
                                        <i class="fas fa-clock me-1"></i>
                                        ${window.formatDuration(video.duration)}
                                    </small>
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-success btn-sm" 
                                                onclick="addVideoToPlaylist(${video.id})"
                                                title="Agregar">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                        <button class="btn btn-outline-primary btn-sm" 
                                                onclick="previewVideo(${video.id})"
                                                title="Vista previa">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Actualizar contador
        const countElement = document.getElementById('availableVideoCount');
        if (countElement) {
            countElement.textContent = `${filteredVideos.length} videos`;
        }
    };
    
    // ==========================================
    // FUNCIÓN: addVideoToPlaylist
    // ==========================================
    
    window.addVideoToPlaylist = async function(videoId) {
        try {
            const playlistId = window.getPlaylistId();
            
            if (!playlistId) {
                throw new Error('No se pudo determinar el ID de la playlist');
            }
            
            console.log(`🎬 Añadiendo video ${videoId} a playlist ${playlistId}`);
            
            const url = window.API_CONFIG.PLAYLISTS.ADD_VIDEO(playlistId, videoId);
            const response = await window.safeFetch(url, {
                method: 'POST'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Error de API (${response.status}): ${errorText}`);
                throw new Error('Failed to add video to playlist');
            }
            
            // Encontrar el video en la lista de disponibles
            const video = window.availableVideos.find(v => parseInt(v.id) === parseInt(videoId));
            if (video) {
                window.playlistVideos.push({
                    ...video,
                    order: window.playlistVideos.length + 1
                });
                
                window.renderAvailableVideos();
                window.showToast('Video agregado a la playlist', 'success');
                
                // Actualizar estadísticas si existen
                if (typeof window.updatePlaylistStats === 'function') {
                    window.updatePlaylistStats();
                }
            }
            
        } catch (error) {
            console.error('❌ Error agregando video:', error);
            window.showToast(`Error al agregar video: ${error.message}`, 'error');
        }
    };
    
    // ==========================================
    // FUNCIÓN: removeVideoFromPlaylist
    // ==========================================
    
    window.removeVideoFromPlaylist = async function(videoId) {
        try {
            const playlistId = window.getPlaylistId();
            
            if (!playlistId) {
                throw new Error('No se pudo determinar el ID de la playlist');
            }
            
            console.log(`🗑️ Eliminando video ${videoId} de playlist ${playlistId}`);
            
            const url = window.API_CONFIG.PLAYLISTS.REMOVE_VIDEO(playlistId, videoId);
            const response = await window.safeFetch(url, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Error de API (${response.status}): ${errorText}`);
                throw new Error('Failed to remove video from playlist');
            }
            
            // Actualizar interfaz
            window.playlistVideos = window.playlistVideos.filter(v => parseInt(v.id) !== parseInt(videoId));
            window.renderAvailableVideos();
            window.showToast('Video eliminado de la playlist', 'success');
            
            // Eliminar elemento del DOM
            const videoElement = document.querySelector(`[data-video-id="${videoId}"]`);
            if (videoElement && videoElement.closest('.playlist-video-item')) {
                videoElement.closest('.playlist-video-item').remove();
            }
            
            // Actualizar estadísticas
            if (typeof window.updatePlaylistStats === 'function') {
                window.updatePlaylistStats();
            }
            
        } catch (error) {
            console.error('❌ Error eliminando video:', error);
            window.showToast(`Error al eliminar video: ${error.message}`, 'error');
        }
    };
    
    // ==========================================
    // FUNCIÓN: previewVideo
    // ==========================================
    
    window.previewVideo = function(videoId) {
        console.log('▶️ Previsualizando video:', videoId);
        
        const modal = document.getElementById('videoPreviewModal');
        const videoPlayer = document.getElementById('previewVideoPlayer');
        
        if (!modal || !videoPlayer) {
            window.showToast('Reproductor de video no disponible', 'error');
            return;
        }
        
        try {
            const videoUrl = window.API_CONFIG.VIDEOS.STREAM(videoId);
            
            videoPlayer.src = videoUrl;
            videoPlayer.load();
            
            // Mostrar modal
            if (typeof bootstrap !== 'undefined') {
                const bsModal = new bootstrap.Modal(modal);
                bsModal.show();
            } else {
                modal.style.display = 'block';
                modal.classList.add('show');
            }
            
            // Reproducir automáticamente
            videoPlayer.play().catch(e => console.log('Reproducción automática bloqueada'));
        } catch (error) {
            console.error('Error inicializando preview:', error);
            window.showToast('No se pudo inicializar el reproductor', 'error');
        }
    };
    
    // ==========================================
    // FUNCIONES AUXILIARES DE PLAYLIST
    // ==========================================
    
    window.updatePlaylistStats = function() {
        console.log('📊 Actualizando estadísticas de playlist');
        
        const totalVideosElement = document.getElementById('totalVideos');
        const playlistVideoCountElement = document.getElementById('playlistVideoCount');
        
        if (totalVideosElement) {
            totalVideosElement.textContent = window.playlistVideos.length;
        }
        
        if (playlistVideoCountElement) {
            playlistVideoCountElement.textContent = `${window.playlistVideos.length} videos`;
        }
        
        // Mostrar/ocultar mensaje de lista vacía
        const emptyMessage = document.getElementById('emptyPlaylistMessage');
        if (emptyMessage) {
            emptyMessage.style.display = window.playlistVideos.length === 0 ? 'block' : 'none';
        }
    };
    
    window.clearPlaylist = function() {
        if (window.playlistVideos && window.playlistVideos.length > 0) {
            if (confirm('¿Estás seguro de vaciar toda la lista de reproducción?')) {
                window.playlistVideos = [];
                window.renderAvailableVideos();
                window.updatePlaylistStats();
                window.showToast('Lista vaciada', 'success');
                
                // Limpiar el DOM de videos de playlist
                const playlistContainer = document.getElementById('playlistVideosList');
                if (playlistContainer) {
                    playlistContainer.innerHTML = '';
                }
            }
        } else {
            window.showToast('La lista ya está vacía', 'info');
        }
    };
    
    window.showAddVideosModal = function() {
        window.showToast('Usa el panel de la derecha para agregar videos', 'info');
        
        // Cargar videos disponibles si no están cargados
        if (window.availableVideos.length === 0) {
            window.loadAvailableVideos();
        }
    };
    
    window.exportPlaylist = function() {
        window.showToast('Función de exportación en desarrollo', 'info');
    };
    
    window.previewPlaylist = function() {
        if (!window.playlistVideos || window.playlistVideos.length === 0) {
            window.showToast('No hay videos en la playlist para previsualizar', 'warning');
            return;
        }
        window.showToast('Vista previa de playlist - Funcionalidad en desarrollo', 'info');
    };
    
    window.editPlaylistInfo = function() {
        const playlistId = window.getPlaylistId();
        if (playlistId) {
            window.location.href = `/ui/playlists/${playlistId}/edit`;
        } else {
            window.showToast('Error: No se pudo determinar el ID de la playlist', 'error');
        }
    };
    
    window.loadPlaylistData = function() {
        window.location.reload();
    };
    
    // ==========================================
    // CARGAR DATOS DESDE TEMPLATE
    // ==========================================
    
    function loadPlaylistDataFromTemplate() {
        try {
            const playlistElement = document.getElementById('playlist-data');
            if (playlistElement && playlistElement.textContent) {
                const data = JSON.parse(playlistElement.textContent);
                window.currentPlaylistData = data;
                window.playlistVideos = data.videos || [];
                console.log('📋 Datos de playlist cargados desde template:', data.title);
                
                // Actualizar estadísticas
                window.updatePlaylistStats();
            }
        } catch (error) {
            console.warn('⚠️ No se pudieron cargar datos desde template:', error);
        }
    }
    
    // ==========================================
    // INICIALIZACIÓN AUTOMÁTICA
    // ==========================================
    
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🎬 Inicializando funciones de playlist...');
        
        // Cargar datos desde template
        loadPlaylistDataFromTemplate();
        
        console.log('✅ Funciones de playlist inicializadas');
    });
    
    console.log('✅ Funciones de playlist cargadas correctamente');
    
})();