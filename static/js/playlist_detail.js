/**
 * playlist_detail.js - Script mejorado para la gestión de playlists
 * Soluciona problemas con thumbnails y manejo de errores
 */

// Constants
const API_URL = window.location.origin + '/api';

// Variables globales
let playlistVideos = [];
let availableVideos = [];
let currentPlaylistData = null;
let hasChanges = false;

/**
 * Inicializar la página cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', function() {
    const playlistId = document.getElementById('playlist-id')?.value;
    
    if (!playlistId) {
        console.error('No se encontró el ID de la playlist');
        return;
    }
    
    console.log('Inicializando detalles de la playlist:', playlistId);
    
    // Cargar datos de la playlist
    loadPlaylistData(playlistId);
    
    // Configurar filtros de búsqueda
    setupSearchFilter();
});

/**
 * Cargar datos de la playlist desde la API
 */
async function loadPlaylistData(playlistId) {
    try {
        showLoadingState('Cargando detalles de la playlist...');
        
        // Obtener datos de la playlist
        const response = await fetch(`${API_URL}/playlists/${playlistId}?include_videos=true`);
        if (!response.ok) throw new Error(`Error al cargar playlist: ${response.status}`);
        
        currentPlaylistData = await response.json();
        console.log('Playlist cargada:', currentPlaylistData);
        
        // Guardar videos de la playlist
        if (currentPlaylistData.videos && Array.isArray(currentPlaylistData.videos)) {
            playlistVideos = currentPlaylistData.videos;
            console.log(`Cargados ${playlistVideos.length} videos en la playlist`);
        } else {
            playlistVideos = [];
            console.log('La playlist no contiene videos');
        }
        
        // Renderizar videos de la playlist
        renderPlaylistVideos();
        
        // Cargar videos disponibles
        await loadAvailableVideos();
        
        // Configurar drag and drop
        initializeDragAndDrop();
        
        // Actualizar estadísticas
        updatePlaylistStats();
        
        hideLoadingState();
    } catch (error) {
        console.error('Error al cargar datos de la playlist:', error);
        showErrorMessage('No se pudieron cargar los datos de la playlist', error);
    }
}

/**
 * Cargar videos disponibles para añadir a la playlist
 */
async function loadAvailableVideos() {
    const availableVideosList = document.getElementById('availableVideosList');
    const loadingAvailableVideos = document.getElementById('loadingAvailableVideos');
    const availableVideoCount = document.getElementById('availableVideoCount');
    
    if (!availableVideosList) return;
    
    try {
        if (loadingAvailableVideos) loadingAvailableVideos.style.display = 'block';
        availableVideosList.innerHTML = '';
        
        const response = await fetch(`${API_URL}/videos?limit=100`);
        if (!response.ok) throw new Error('Error al cargar videos disponibles');
        
        const videos = await response.json();
        
        if (loadingAvailableVideos) loadingAvailableVideos.style.display = 'none';
        
        // Filtrar videos que ya están en la playlist
        const playlistVideoIds = playlistVideos.map(v => v.id);
        availableVideos = videos.filter(v => !playlistVideoIds.includes(v.id));
        
        if (availableVideoCount) {
            availableVideoCount.textContent = `${availableVideos.length} videos`;
        }
        
        if (availableVideos.length === 0) {
            availableVideosList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-film fa-2x text-muted mb-3"></i>
                    <h6>No hay videos disponibles</h6>
                    <p class="text-muted">Sube videos para agregarlos a la lista</p>
                </div>
            `;
            return;
        }
        
        // Renderizar cada video disponible
        availableVideos.forEach(video => {
            const videoElement = createVideoElement(video, 'library');
            availableVideosList.appendChild(videoElement);
        });
        
    } catch (error) {
        console.error('Error al cargar videos disponibles:', error);
        
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
}

/**
 * Renderizar los videos de la playlist
 */
function renderPlaylistVideos() {
    const playlistVideosList = document.getElementById('playlistVideosList');
    const emptyPlaylistMessage = document.getElementById('emptyPlaylistMessage');
    
    if (!playlistVideosList) return;
    
    if (!playlistVideos || playlistVideos.length === 0) {
        playlistVideosList.innerHTML = '';
        if (emptyPlaylistMessage) emptyPlaylistMessage.style.display = 'block';
        return;
    }
    
    if (emptyPlaylistMessage) emptyPlaylistMessage.style.display = 'none';
    
    // Ordenar videos por posición
    const sortedVideos = [...playlistVideos].sort((a, b) => {
        return (a.order || a.position || 0) - (b.order || b.position || 0);
    });
    
    // Limpiar la lista
    playlistVideosList.innerHTML = '';
    
    // Añadir cada video a la lista
    sortedVideos.forEach((video, index) => {
        // Asegurar que tenga una posición
        video.order = video.order || video.position || index;
        
        const videoElement = createVideoElement(video, 'playlist');
        playlistVideosList.appendChild(videoElement);
    });
    
    // Actualizar estadísticas
    updatePlaylistStats();
}

/**
 * Crear elemento DOM para un video
 */
function createVideoElement(video, type) {
    const videoDiv = document.createElement('div');
    videoDiv.className = type === 'library' ? 'available-video-item mb-2' : 'playlist-video-item mb-2';
    videoDiv.dataset.videoId = video.id;
    
    if (type === 'playlist') {
        videoDiv.draggable = true;
        videoDiv.dataset.order = video.order || 0;
    }
    
    // Manejar caso donde thumbnail no existe
    let thumbnailHtml;
    
    if (video.thumbnail) {
        thumbnailHtml = `<img src="${video.thumbnail}" alt="Thumbnail" class="img-thumbnail" style="width: 60px; height: 45px; object-fit: cover;">`;
    } else {
        // Placeholder para videos sin thumbnail
        thumbnailHtml = `<div class="bg-secondary d-flex align-items-center justify-content-center text-white" style="width: 60px; height: 45px; border-radius: 0.25rem;"><i class="fas fa-video"></i></div>`;
    }
    
    videoDiv.innerHTML = `
        <div class="card video-card">
            <div class="card-body p-2">
                <div class="d-flex align-items-center">
                    ${type === 'playlist' ? '<div class="drag-handle me-2"><i class="fas fa-grip-vertical text-muted"></i></div>' : ''}
                    <div class="video-thumbnail me-3">
                        ${thumbnailHtml}
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1 video-title">${video.title || 'Sin título'}</h6>
                        <small class="text-muted video-duration">
                            ${type === 'playlist' ? `<span class="badge bg-secondary me-1">${video.order || ''}</span>` : ''}
                            ${formatDuration(video.duration)}
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
    
    // Configurar eventos de arrastrar y soltar
    if (type === 'library') {
        videoDiv.draggable = true;
        videoDiv.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', video.id);
            e.dataTransfer.effectAllowed = 'copy';
        });
    } else if (type === 'playlist') {
        videoDiv.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', video.id);
            e.dataTransfer.setData('source', 'playlist');
            e.dataTransfer.effectAllowed = 'move';
            videoDiv.classList.add('dragging');
        });
        
        videoDiv.addEventListener('dragend', () => {
            videoDiv.classList.remove('dragging');
        });
    }
    
    return videoDiv;
}

/**
 * Añadir un video a la playlist
 */
async function addVideoToPlaylist(videoId) {
    const playlistId = document.getElementById('playlist-id')?.value;
    if (!playlistId) {
        showErrorMessage('No se pudo identificar la playlist');
        return;
    }
    
    try {
        // Verificar si el video ya está en la playlist
        if (playlistVideos.some(v => v.id == videoId)) {
            showMessage('Este video ya está en la lista', 'warning');
            return;
        }
        
        // Obtener el próximo orden
        const order = playlistVideos.length + 1;
        
        // Enviar solicitud a la API
        const response = await fetch(`${API_URL}/playlists/${playlistId}/videos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                video_id: parseInt(videoId),
                order: order
            })
        });
        
        if (!response.ok) throw new Error(`Error al añadir video: ${response.status}`);
        
        // Encontrar el video en los disponibles
        const video = availableVideos.find(v => v.id == videoId);
        if (!video) throw new Error('Video no encontrado en la lista de disponibles');
        
        // Añadir a la lista de la playlist
        video.order = order;
        playlistVideos.push(video);
        
        // Quitar de disponibles
        availableVideos = availableVideos.filter(v => v.id != videoId);
        
        // Actualizar la interfaz
        renderPlaylistVideos();
        
        // Recargar videos disponibles
        const availableVideosList = document.getElementById('availableVideosList');
        if (availableVideosList) {
            availableVideosList.innerHTML = '';
            availableVideos.forEach(video => {
                const videoElement = createVideoElement(video, 'library');
                availableVideosList.appendChild(videoElement);
            });
        }
        
        showMessage('Video añadido a la playlist', 'success');
        hasChanges = true;
        
    } catch (error) {
        console.error('Error al añadir video:', error);
        showErrorMessage('No se pudo añadir el video a la playlist', error);
    }
}

/**
 * Quitar un video de la playlist
 */
async function removeVideoFromPlaylist(videoId) {
    const playlistId = document.getElementById('playlist-id')?.value;
    if (!playlistId) {
        showErrorMessage('No se pudo identificar la playlist');
        return;
    }
    
    if (!confirm('¿Seguro que desea quitar este video de la lista?')) {
        return;
    }
    
    try {
        // Enviar solicitud a la API
        const response = await fetch(`${API_URL}/playlists/${playlistId}/videos/${videoId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error(`Error al quitar video: ${response.status}`);
        
        // Encontrar el video
        const video = playlistVideos.find(v => v.id == videoId);
        
        // Quitar de la lista de la playlist
        playlistVideos = playlistVideos.filter(v => v.id != videoId);
        
        // Añadir a disponibles si existe
        if (video) {
            availableVideos.push(video);
            
            // Actualizar la lista de videos disponibles
            const availableVideosList = document.getElementById('availableVideosList');
            if (availableVideosList) {
                const videoElement = createVideoElement(video, 'library');
                availableVideosList.appendChild(videoElement);
            }
        }
        
        // Actualizar la interfaz
        renderPlaylistVideos();
        updatePlaylistStats();
        
        showMessage('Video quitado de la playlist', 'success');
        hasChanges = true;
        
    } catch (error) {
        console.error('Error al quitar video:', error);
        showErrorMessage('No se pudo quitar el video de la playlist', error);
    }
}

/**
 * Inicializar funcionalidad de arrastrar y soltar
 */
function initializeDragAndDrop() {
    const dropZone = document.getElementById('playlistDropZone');
    if (!dropZone) return;
    
    // Configurar el área donde se pueden soltar
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        dropZone.classList.add('highlight-drop-zone');
        
        // Encontrar la posición para insertar
        const afterElement = getDragAfterElement(e.clientY);
        const draggable = document.querySelector('.dragging');
        
        if (draggable && afterElement) {
            const playlistVideosList = document.getElementById('playlistVideosList');
            if (playlistVideosList) {
                playlistVideosList.insertBefore(draggable, afterElement);
            }
        } else if (draggable) {
            const playlistVideosList = document.getElementById('playlistVideosList');
            if (playlistVideosList) {
                playlistVideosList.appendChild(draggable);
            }
        }
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('highlight-drop-zone');
    });
    
    dropZone.addEventListener('drop', async e => {
        e.preventDefault();
        dropZone.classList.remove('highlight-drop-zone');
        
        const videoId = e.dataTransfer.getData('text/plain');
        const source = e.dataTransfer.getData('source');
        
        if (source === 'playlist') {
            // Reordenar en la playlist
            await updatePlaylistOrder();
        } else {
            // Añadir desde la biblioteca
            await addVideoToPlaylist(videoId);
        }
    });
}

/**
 * Determinar elemento después del cual soltar
 */
function getDragAfterElement(y) {
    const playlistVideosList = document.getElementById('playlistVideosList');
    if (!playlistVideosList) return null;
    
    const draggableElements = [...playlistVideosList.querySelectorAll('.playlist-video-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Actualizar el orden de los videos en la playlist
 */
async function updatePlaylistOrder() {
    const playlistId = document.getElementById('playlist-id')?.value;
    if (!playlistId) {
        showErrorMessage('No se pudo identificar la playlist');
        return;
    }
    
    try {
        // Obtener todos los videos en su orden actual
        const playlistItems = document.querySelectorAll('.playlist-video-item');
        const videos = [];
        
        playlistItems.forEach((item, index) => {
            const videoId = parseInt(item.dataset.videoId);
            videos.push({
                video_id: videoId,
                order: index + 1
            });
            
            // Actualizar el badge de orden
            const orderBadge = item.querySelector('.badge');
            if (orderBadge) orderBadge.textContent = index + 1;
            
            // Actualizar el orden en nuestra lista local
            const videoInList = playlistVideos.find(v => v.id == videoId);
            if (videoInList) {
                videoInList.order = index + 1;
            }
        });
        
        // Enviar a la API
        const response = await fetch(`${API_URL}/playlists/${playlistId}/reorder`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videos })
        });
        
        if (!response.ok) throw new Error(`Error al actualizar orden: ${response.status}`);
        
        // Actualizar la interfaz
        updatePlaylistStats();
        
        showMessage('Orden actualizado', 'success');
        hasChanges = true;
        
    } catch (error) {
        console.error('Error al actualizar orden:', error);
        showErrorMessage('No se pudo actualizar el orden de los videos', error);
    }
}

/**
 * Actualizar estadísticas de la playlist
 */
function updatePlaylistStats() {
    const totalPlaylistDuration = document.getElementById('totalPlaylistDuration');
    if (!totalPlaylistDuration) return;
    
    // Calcular duración total
    let totalSeconds = 0;
    playlistVideos.forEach(video => {
        totalSeconds += (video.duration || 0);
    });
    
    totalPlaylistDuration.textContent = formatDuration(totalSeconds);
    
    // Mostrar/ocultar mensaje de vacío
    const emptyPlaylistMessage = document.getElementById('emptyPlaylistMessage');
    if (emptyPlaylistMessage) {
        emptyPlaylistMessage.style.display = playlistVideos.length === 0 ? 'block' : 'none';
    }
}

/**
 * Configurar filtro de búsqueda
 */
function setupSearchFilter() {
    const videoSearchInput = document.getElementById('videoSearch');
    const clearVideoSearchBtn = document.getElementById('clearVideoSearchBtn');
    
    if (!videoSearchInput || !clearVideoSearchBtn) return;
    
    videoSearchInput.addEventListener('input', filterVideos);
    
    clearVideoSearchBtn.addEventListener('click', () => {
        videoSearchInput.value = '';
        filterVideos();
    });
}

/**
 * Filtrar videos según texto de búsqueda
 */
function filterVideos() {
    const videoSearchInput = document.getElementById('videoSearch');
    if (!videoSearchInput) return;
    
    const searchTerm = videoSearchInput.value.toLowerCase().trim();
    const videos = document.querySelectorAll('.available-video-item');
    
    videos.forEach(video => {
        const title = video.querySelector('.video-title')?.textContent.toLowerCase() || '';
        if (title.includes(searchTerm) || searchTerm === '') {
            video.style.display = 'block';
        } else {
            video.style.display = 'none';
        }
    });
}

/**
 * Formatear duración en segundos a formato legible
 */
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    seconds = parseInt(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

/**
 * Convertir string de duración a segundos
 */
function durationToSeconds(duration) {
    if (!duration || duration === '0:00') return 0;
    
    const parts = duration.split(':').map(p => parseInt(p));
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else {
        return parseInt(duration) || 0;
    }
}

/**
 * Mostrar estado de carga
 */
function showLoadingState(message = 'Cargando...') {
    // Implementar según la interfaz
    console.log(message);
}

/**
 * Ocultar estado de carga
 */
function hideLoadingState() {
    // Implementar según la interfaz
}

/**
 * Mostrar mensaje al usuario
 */
function showMessage(message, type = 'info') {
    // Implementar según el sistema de notificaciones disponible
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Mostrar toast si está disponible
    if (window.bootstrap && typeof bootstrap.Toast !== 'undefined') {
        // Crear toast dinámicamente si no existe
        let toastElement = document.getElementById('notificationToast');
        
        if (!toastElement) {
            toastElement = document.createElement('div');
            toastElement.className = `toast align-items-center text-white bg-${type} border-0`;
            toastElement.id = 'notificationToast';
            toastElement.setAttribute('role', 'alert');
            toastElement.setAttribute('aria-live', 'assertive');
            toastElement.setAttribute('aria-atomic', 'true');
            
            toastElement.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
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
            // Actualizar mensaje y tipo
            toastElement.className = toastElement.className.replace(/bg-\w+/, `bg-${type}`);
            const toastBody = toastElement.querySelector('.toast-body');
            if (toastBody) toastBody.textContent = message;
        }
        
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
    }
}

/**
 * Mostrar mensaje de error al usuario
 */
function showErrorMessage(message, error = null) {
    console.error(message, error);
    
    let fullMessage = message;
    if (error && error.message) {
        fullMessage += `: ${error.message}`;
    }
    
    showMessage(fullMessage, 'danger');
}

// Exportar funciones para usar globalmente
window.addVideoToPlaylist = addVideoToPlaylist;
window.removeVideoFromPlaylist = removeVideoFromPlaylist;
window.updatePlaylistOrder = updatePlaylistOrder;
window.loadAvailableVideos = loadAvailableVideos;
window.filterVideos = filterVideos;