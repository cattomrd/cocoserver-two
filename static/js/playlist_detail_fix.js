/**
 * playlist_detail_fix.js - Parche para corregir problemas
 * Este archivo extiende la funcionalidad existente sin reemplazarla
 */

// Sobrescribir la función createVideoElement eliminando referencias a thumbnails y duración
window.createVideoElement = function(video, type) {
    const videoDiv = document.createElement('div');
    videoDiv.className = type === 'library' ? 'available-video-item mb-2' : 'playlist-video-item';
    videoDiv.dataset.videoId = video.id;
    
    if (type === 'playlist') {
        videoDiv.draggable = true;
        videoDiv.dataset.order = video.order || 0;
    }
    
    // Usar solo un icono en lugar de thumbnail
    const iconHtml = `<div class="bg-secondary d-flex align-items-center justify-content-center text-white" style="width: 60px; height: 45px; border-radius: 0.25rem;"><i class="fas fa-video"></i></div>`;
    
    videoDiv.innerHTML = `
        <div class="card video-card">
            <div class="card-body p-2">
                <div class="d-flex align-items-center">
                    ${type === 'playlist' ? '<div class="drag-handle me-2"><i class="fas fa-grip-vertical text-muted"></i></div>' : ''}
                    <div class="video-thumbnail me-3">
                        ${iconHtml}
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1 video-title">${video.title || 'Sin título'}</h6>
                        <small class="text-muted video-duration">
                            ${type === 'playlist' ? `<span class="badge bg-secondary me-1">${video.order || ''}</span>` : ''}
                        </small>
                    </div>
                    <div class="video-actions">
                        ${type === 'library' 
                            ? `<button class="btn btn-sm btn-outline-primary" onclick="addVideoToPlaylist(${video.id})" title="Agregar a la lista"><i class="fas fa-plus"></i></button>`
                            : `<button class="btn btn-sm btn-outline-danger" onclick="removeVideoFromPlaylist(${video.id})" title="Eliminar de la lista"><i class="fas fa-times"></i></button>`
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Si es un video de la biblioteca, hacerlo arrastrable
    if (type === 'library') {
        videoDiv.draggable = true;
        videoDiv.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', video.id);
            e.dataTransfer.effectAllowed = 'copy';
        });
    }
    
    return videoDiv;
};

// Sobrescribir la función loadAvailableVideos para manejar errores
window.loadAvailableVideos = async function() {
    const loadingAvailableVideos = document.getElementById('loadingAvailableVideos');
    const availableVideosList = document.getElementById('availableVideosList');
    
    if (!availableVideosList) return;
    
    if (loadingAvailableVideos) loadingAvailableVideos.style.display = 'block';
    availableVideosList.innerHTML = '';
    
    try {
        const response = await fetch(`${API_URL}/videos?available=true`);
        if (!response.ok) throw new Error('Error al cargar videos');
        
        const videos = await response.json();
        
        if (loadingAvailableVideos) loadingAvailableVideos.style.display = 'none';
        
        if (videos.length === 0) {
            availableVideosList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-film fa-2x text-muted mb-3"></i>
                    <h6>No hay videos disponibles</h6>
                    <p class="text-muted">Sube videos para agregarlos a la lista</p>
                </div>
            `;
            
            const availableVideoCount = document.getElementById('availableVideoCount');
            if (availableVideoCount) {
                availableVideoCount.textContent = '0 videos';
            }
            
            return;
        }
        
        const availableVideoCount = document.getElementById('availableVideoCount');
        if (availableVideoCount) {
            availableVideoCount.textContent = `${videos.length} videos`;
        }
        
        // Renderizar cada video
        videos.forEach(video => {
            try {
                const videoElement = createVideoElement(video, 'library');
                availableVideosList.appendChild(videoElement);
            } catch (videoError) {
                console.warn('Error al renderizar video:', videoError, video);
                // Continuar con el siguiente video
            }
        });
    } catch (error) {
        console.error('Error al cargar videos:', error);
        
        if (loadingAvailableVideos) loadingAvailableVideos.style.display = 'none';
        
        availableVideosList.innerHTML = `
            <div class="text-center py-4 text-danger">
                <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                <h6>Error al cargar videos</h6>
                <p>No se pudieron cargar los videos. Intente de nuevo.</p>
                <button class="btn btn-outline-primary" onclick="loadAvailableVideos()">
                    <i class="fas fa-sync-alt me-1"></i>Reintentar
                </button>
            </div>
        `;
    }
};

// Agregar función para mostrar mensajes de error
window.showPlaylistError = function(message, error = null) {
    console.error(message, error);
    
    // Intentar mostrar notificación si hay soporte de Bootstrap
    if (window.bootstrap && typeof bootstrap.Toast !== 'undefined') {
        // Crear toast dinámicamente
        let toastElement = document.getElementById('errorToast');
        
        if (!toastElement) {
            // Crear el elemento toast
            toastElement = document.createElement('div');
            toastElement.className = 'toast align-items-center text-white bg-danger';
            toastElement.id = 'errorToast';
            toastElement.setAttribute('role', 'alert');
            toastElement.setAttribute('aria-live', 'assertive');
            toastElement.setAttribute('aria-atomic', 'true');
            
            toastElement.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        <span class="toast-message">${message}</span>
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            `;
            
            // Crear contenedor si no existe
            let toastContainer = document.querySelector('.toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
                document.body.appendChild(toastContainer);
            }
            
            toastContainer.appendChild(toastElement);
        } else {
            // Actualizar mensaje
            const toastMessage = toastElement.querySelector('.toast-message');
            if (toastMessage) {
                toastMessage.textContent = message;
            }
        }
        
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
    } else {
        // Fallback a alert si no hay soporte de toast
        alert(message);
    }
};

// Cargar el script cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('Extensión de playlist_detail cargada correctamente');
    
    // No inicializar nada aquí, ya que el script original se encarga de eso
});