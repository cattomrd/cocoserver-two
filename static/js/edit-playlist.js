/**
 * EDIT-PLAYLIST.JS - Editor de Listas de Reproducción
 * Versión corregida sin errores de Mixed Content
 */

console.log('🎵 Cargando Editor de Playlist...');

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let currentPlaylistData = null;
let availableVideos = [];
let playlistVideos = [];
let hasUnsavedChanges = false;
let isLoading = false;

// ==========================================
// CONFIGURACIÓN DE API - USANDO API_CONFIG GLOBAL
// ==========================================

/**
 * Verificar que API_CONFIG esté disponible, si no, crear configuración de emergencia
 */
function ensureApiConfig() {
    if (typeof window.API_CONFIG === 'undefined') {
        console.warn('⚠️ API_CONFIG no encontrado, creando configuración de emergencia...');
        
        const protocol = window.location.protocol;
        const host = window.location.host;
        const apiUrl = `${protocol}//${host}/api`;
        
        window.API_CONFIG = {
            BASE_URL: apiUrl,
            VIDEOS: { LIST: `${apiUrl}/videos` },
            PLAYLISTS: {
                LIST: `${apiUrl}/playlists`,
                GET_BY_ID: (id) => `${apiUrl}/playlists/${id}`,
                UPDATE: (id) => `${apiUrl}/playlists/${id}`,
                ADD_VIDEO: (playlistId, videoId) => `${apiUrl}/playlists/${playlistId}/videos/${videoId}`,
                REMOVE_VIDEO: (playlistId, videoId) => `${apiUrl}/playlists/${playlistId}/videos/${videoId}`
            }
        };
    }
    return window.API_CONFIG;
}

// Asegurar configuración disponible
const API_CONFIG = ensureApiConfig();

// Detectar si hay datos de playlist pasados desde el template
try {
    const playlistElement = document.getElementById('playlist-data');
    if (playlistElement && playlistElement.textContent) {
        const templateData = JSON.parse(playlistElement.textContent);
        if (templateData && templateData.id) {
            currentPlaylistData = templateData;
            playlistVideos = templateData.videos || [];
            console.log('📋 Datos de playlist cargados desde template:', currentPlaylistData);
        }
    }
} catch (error) {
    console.warn('⚠️ No se pudieron cargar datos desde template:', error);
}

// ==========================================
// FUNCIONES PRINCIPALES - CARGA DE DATOS
// ==========================================

/**
 * Cargar datos completos de la playlist para edición
 */
async function loadPlaylistForEdit(playlistId) {
    if (!playlistId || isLoading) return;
    
    console.log('🎵 Cargando playlist para editar:', playlistId);
    setLoadingState(true);
    
    try {
        showToast('Cargando datos de la playlist...', 'info');
        
        // 1. Cargar datos básicos de la playlist
        const playlistUrl = API_CONFIG.PLAYLISTS.GET_BY_ID(playlistId);
        console.log('📡 Fetch:', playlistUrl);
        
        const playlistResponse = await safeFetch(playlistUrl);
        
        if (!playlistResponse.ok) {
            throw new Error(`Error ${playlistResponse.status}: No se pudo cargar la playlist`);
        }
        
        const playlistData = await playlistResponse.json();
        currentPlaylistData = playlistData;
        
        console.log('✅ Playlist cargada:', currentPlaylistData);
        
        // 2. Obtener videos asignados (ya incluidos en el detail)
        playlistVideos = currentPlaylistData.videos || [];
        console.log('✅ Videos de playlist cargados:', playlistVideos.length);
        
        // 3. Cargar videos disponibles
        await loadAvailableVideos();
        
        // 4. Actualizar interfaz
        setupEditMode();
        renderPlaylistVideos();
        renderAvailableVideos();
        updatePlaylistStats();
        
        showToast('Playlist cargada correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error cargando playlist:', error);
        showToast(`Error: ${error.message}`, 'error');
        showErrorState('No se pudo cargar la playlist');
    } finally {
        setLoadingState(false);
    }
}

/**
 * Cargar todos los videos disponibles
 */
async function loadAvailableVideos() {
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
        const videosUrl = API_CONFIG.VIDEOS.LIST;
        console.log('📡 Fetch:', videosUrl);
        
        const response = await safeFetch(videosUrl);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudieron cargar los videos`);
        }

        const data = await response.json();
        availableVideos = Array.isArray(data) ? data : (data.videos || []);
        
        console.log('✅ Videos disponibles cargados:', availableVideos.length);
        
        renderAvailableVideos();
        
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
    }
}

// ==========================================
// FUNCIONES DE RENDERIZADO
// ==========================================

/**
 * Renderizar videos disponibles
 */
function renderAvailableVideos() {
    const container = document.getElementById('availableVideosList');
    if (!container) return;
    
    // Filtrar videos que ya están en la playlist
    const playlistVideoIds = playlistVideos.map(v => parseInt(v.id));
    const filteredVideos = availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id)));
    
    if (filteredVideos.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="fas fa-video fa-3x mb-3"></i>
                <p class="mb-0">No hay videos disponibles para agregar</p>
                <small>Todos los videos ya están en la playlist</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredVideos.map(video => `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card h-100 video-card">
                <div class="position-relative">
                    <div class="video-thumbnail-placeholder bg-light d-flex align-items-center justify-content-center" style="height: 120px;">
                        <i class="fas fa-play-circle fa-3x text-primary"></i>
                    </div>
                    <div class="position-absolute top-0 end-0 m-2">
                        <button class="btn btn-sm btn-success" 
                                onclick="addVideoToPlaylist(${video.id})"
                                title="Agregar a playlist">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <h6 class="card-title">${escapeHtml(video.title || 'Sin título')}</h6>
                    <p class="card-text small text-muted">
                        ${video.description ? escapeHtml(video.description).substring(0, 80) + '...' : 'Sin descripción'}
                    </p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="fas fa-clock me-1"></i>
                            ${formatDuration(video.duration)}
                        </small>
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="previewVideo(${video.id})"
                                title="Vista previa">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Renderizar videos de la playlist
 */
function renderPlaylistVideos() {
    const container = document.getElementById('playlistVideosList');
    if (!container) return;
    
    if (playlistVideos.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="fas fa-list-alt fa-3x mb-3"></i>
                <p class="mb-0">La playlist está vacía</p>
                <small>Agrega videos desde la biblioteca disponible</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th style="width: 50px">#</th>
                        <th>Video</th>
                        <th style="width: 100px">Duración</th>
                        <th style="width: 120px">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${playlistVideos.map((video, index) => `
                        <tr data-video-id="${video.id}">
                            <td>
                                <span class="badge bg-secondary">${index + 1}</span>
                            </td>
                            <td>
                                <div class="d-flex align-items-center">
                                    <div class="me-3" style="width: 60px; height: 45px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; border-radius: 4px;">
                                        <i class="fas fa-play-circle text-primary"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1">${escapeHtml(video.title || 'Sin título')}</h6>
                                        <small class="text-muted">
                                            ${video.description ? escapeHtml(video.description).substring(0, 60) + '...' : 'Sin descripción'}
                                        </small>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <small class="text-muted">
                                    <i class="fas fa-clock me-1"></i>
                                    ${formatDuration(video.duration)}
                                </small>
                            </td>
                            <td>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary" 
                                            onclick="previewVideo(${video.id})"
                                            title="Vista previa">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-outline-danger" 
                                            onclick="removeVideoFromPlaylist(${video.id})"
                                            title="Eliminar">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ==========================================
// FUNCIONES DE GESTIÓN DE VIDEOS
// ==========================================

/**
 * Agregar video a la playlist
 */
async function addVideoToPlaylist(videoId) {
    try {
        const playlistId = getPlaylistId();
        
        if (!playlistId) {
            throw new Error('No se pudo determinar el ID de la playlist');
        }
        
        console.log(`🎬 Añadiendo video ${videoId} a playlist ${playlistId}`);
        
        const url = API_CONFIG.PLAYLISTS.ADD_VIDEO(playlistId, videoId);
        console.log(`📡 URL de la API: ${url}`);
        
        const response = await safeFetch(url, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Error de API (${response.status}): ${errorText}`);
            throw new Error('Failed to add video to playlist');
        }
        
        const result = await response.json();
        console.log('✅ Video agregado exitosamente:', result);
        
        // Encontrar el video en la lista de disponibles
        const video = availableVideos.find(v => parseInt(v.id) === parseInt(videoId));
        if (video) {
            // Agregar a la lista de videos de la playlist
            playlistVideos.push({
                ...video,
                order: playlistVideos.length + 1
            });
            
            // Actualizar la interfaz
            renderPlaylistVideos();
            renderAvailableVideos();
            updatePlaylistStats();
            markAsUnsaved();
            showToast('Video agregado a la playlist', 'success');
        }
        
    } catch (error) {
        console.error('❌ Error agregando video:', error);
        showToast(`Error al agregar video: ${error.message}`, 'error');
    }
}

/**
 * Eliminar video de la playlist
 */
async function removeVideoFromPlaylist(videoId) {
    try {
        const playlistId = getPlaylistId();
        
        if (!playlistId) {
            throw new Error('No se pudo determinar el ID de la playlist');
        }
        
        console.log(`🗑️ Eliminando video ${videoId} de playlist ${playlistId}`);
        
        const url = API_CONFIG.PLAYLISTS.REMOVE_VIDEO(playlistId, videoId);
        console.log(`📡 URL de la API: ${url}`);
        
        const response = await safeFetch(url, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Error de API (${response.status}): ${errorText}`);
            throw new Error('Failed to remove video from playlist');
        }
        
        // Actualizar la interfaz
        playlistVideos = playlistVideos.filter(v => parseInt(v.id) !== parseInt(videoId));
        renderPlaylistVideos();
        renderAvailableVideos();
        updatePlaylistStats();
        markAsUnsaved();
        showToast('Video eliminado de la playlist', 'success');
        
    } catch (error) {
        console.error('❌ Error eliminando video:', error);
        showToast(`Error al eliminar video: ${error.message}`, 'error');
    }
}

/**
 * Guardar cambios de la playlist
 */
async function savePlaylist() {
    const playlistId = getPlaylistId();
    if (!playlistId) {
        showToast('Error: No se pudo identificar la playlist', 'error');
        return;
    }
    
    setLoadingState(true);
    
    try {
        // Recopilar datos del formulario
        const titleInput = document.getElementById('playlistTitle');
        const descInput = document.getElementById('playlistDescription');
        const statusSelect = document.getElementById('playlistStatus');
        const startDateInput = document.getElementById('startDate');
        const expDateInput = document.getElementById('expirationDate');
        
        const playlistData = {
            title: titleInput ? titleInput.value : currentPlaylistData.title,
            description: descInput ? descInput.value : (currentPlaylistData.description || ''),
            is_active: statusSelect ? statusSelect.value === 'true' : currentPlaylistData.is_active,
            start_date: startDateInput ? startDateInput.value || null : currentPlaylistData.start_date,
            expiration_date: expDateInput ? expDateInput.value || null : currentPlaylistData.expiration_date
        };

        console.log('📝 Datos a guardar:', playlistData);

        const url = API_CONFIG.PLAYLISTS.UPDATE(currentPlaylistData.id);
        const response = await safeFetch(url, {
            method: 'PUT',
            body: JSON.stringify(playlistData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Error ${response.status}`);
        }

        const updatedPlaylist = await response.json();
        currentPlaylistData = { ...currentPlaylistData, ...updatedPlaylist };
        hasUnsavedChanges = false;
        
        updatePageTitle();
        showToast('Cambios guardados correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error guardando playlist:', error);
        showToast(`Error al guardar: ${error.message}`, 'error');
    } finally {
        setLoadingState(false);
    }
}

// ==========================================
// FUNCIONES DE INTERFAZ Y UTILIDADES
// ==========================================

/**
 * Configurar modo de edición
 */
function setupEditMode() {
    console.log(`⚙️ Configurando modo edición para: ${currentPlaylistData?.title || 'playlist'}`);
    
    // Actualizar título de la página
    if (currentPlaylistData?.title) {
        document.title = `Editando: ${currentPlaylistData.title}`;
    }
    
    // Rellenar formulario si existe
    fillPlaylistForm();
    
    // Configurar event listeners
    setupEventListeners();
}

/**
 * Rellenar formulario con datos de la playlist
 */
function fillPlaylistForm() {
    if (!currentPlaylistData) return;
    
    const titleInput = document.getElementById('playlistTitle');
    const descInput = document.getElementById('playlistDescription');
    const statusSelect = document.getElementById('playlistStatus');
    const startDateInput = document.getElementById('startDate');
    const expDateInput = document.getElementById('expirationDate');
    
    if (titleInput) titleInput.value = currentPlaylistData.title || '';
    if (descInput) descInput.value = currentPlaylistData.description || '';
    if (statusSelect) statusSelect.value = currentPlaylistData.is_active ? 'true' : 'false';
    
    // Formatear fechas para inputs
    if (startDateInput && currentPlaylistData.start_date) {
        const startDate = new Date(currentPlaylistData.start_date);
        startDateInput.value = startDate.toISOString().split('T')[0];
    }
    
    if (expDateInput && currentPlaylistData.expiration_date) {
        const expDate = new Date(currentPlaylistData.expiration_date);
        expDateInput.value = expDate.toISOString().split('T')[0];
    }
    
    console.log('✅ Formulario rellenado con datos de la playlist');
}

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Event listeners para cambios en campos del formulario
    const formFields = ['playlistTitle', 'playlistDescription', 'playlistStatus', 'startDate', 'expirationDate'];
    formFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('change', markAsUnsaved);
            field.addEventListener('input', markAsUnsaved);
        }
    });
    
    // Prevenir pérdida de cambios al salir
    window.addEventListener('beforeunload', function(e) {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?';
        }
    });
}

/**
 * Obtener ID de la playlist
 */
function getPlaylistId() {
    // Método 1: Obtener de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    
    // Método 2: Obtener del elemento oculto
    const idElement = document.getElementById('playlist-id');
    const idFromElement = idElement ? idElement.value : null;
    
    // Método 3: Obtener de los datos globales
    const idFromData = currentPlaylistData ? currentPlaylistData.id : null;
    
    // Prioridad: URL > elemento oculto > datos globales
    const playlistId = idFromUrl || idFromElement || idFromData;
    
    if (!playlistId) {
        console.error('❌ No se pudo determinar el ID de la playlist');
    }
    
    return playlistId;
}

/**
 * Actualizar estadísticas de la playlist
 */
function updatePlaylistStats() {
    const videoCount = playlistVideos.length;
    const totalDuration = playlistVideos.reduce((sum, video) => sum + (video.duration || 0), 0);
    
    // Actualizar elementos de estadísticas si existen
    const videoCountElement = document.getElementById('videoCount');
    const totalDurationElement = document.getElementById('totalDuration');
    
    if (videoCountElement) {
        videoCountElement.textContent = `${videoCount} video${videoCount !== 1 ? 's' : ''}`;
    }
    
    if (totalDurationElement) {
        totalDurationElement.textContent = formatDuration(totalDuration);
    }
}

/**
 * Marcar formulario como modificado
 */
function markAsUnsaved() {
    hasUnsavedChanges = true;
    
    // Actualizar indicador visual si existe
    const saveIndicator = document.getElementById('saveIndicator');
    if (saveIndicator) {
        saveIndicator.innerHTML = '<i class="fas fa-circle text-warning"></i> Cambios sin guardar';
    }
    
    // Habilitar botón de guardar si existe
    const saveBtn = document.getElementById('savePlaylistBtn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('btn-secondary');
        saveBtn.classList.add('btn-primary');
    }
}

/**
 * Actualizar título de la página
 */
function updatePageTitle() {
    if (currentPlaylistData?.title) {
        document.title = `Editando: ${currentPlaylistData.title}`;
    }
}

// ==========================================
// FUNCIONES DE VISTA PREVIA
// ==========================================

/**
 * Previsualizar un video específico
 */
function previewVideo(videoId) {
    console.log('▶️ Previsualizando video:', videoId);
    
    const modal = document.getElementById('videoPreviewModal');
    const videoPlayer = document.getElementById('previewVideoPlayer');
    
    if (!modal || !videoPlayer) {
        showToast('Reproductor de video no disponible', 'error');
        return;
    }
    
    try {
        // Usar URL segura para el video
        const videoUrl = API_CONFIG.VIDEOS.STREAM ? API_CONFIG.VIDEOS.STREAM(videoId) : 
                         `${API_CONFIG.BASE_URL}/videos/${videoId}/stream`;
        
        videoPlayer.src = videoUrl;
        videoPlayer.load();
        
        // Mostrar modal
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Reproducir automáticamente
        videoPlayer.play().catch(e => console.log('Reproducción automática bloqueada por el navegador'));
    } catch (error) {
        console.error('Error inicializando preview:', error);
        showToast('No se pudo inicializar el reproductor de video', 'error');
    }
}

// ==========================================
// FUNCIONES ADICIONALES REQUERIDAS
// ==========================================

/**
 * Cargar selector de playlists
 */
function loadPlaylistSelector() {
    console.log('🔄 Abriendo selector de playlists...');
    showToast('Selector de playlists - Funcionalidad en desarrollo', 'info');
    
    const modal = document.getElementById('playlistSelectorModal');
    if (modal && window.bootstrap) {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
}

/**
 * Vista previa de la playlist
 */
function previewPlaylist() {
    console.log('👁️ Abriendo vista previa...');
    showToast('Vista previa - Funcionalidad en desarrollo', 'info');
    
    const modal = document.getElementById('previewModal');
    if (modal && window.bootstrap) {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
}

/**
 * Vaciar playlist
 */
function clearPlaylist() {
    if (playlistVideos && playlistVideos.length > 0) {
        if (confirm('¿Estás seguro de vaciar toda la lista de reproducción?')) {
            playlistVideos = [];
            renderPlaylistVideos();
            renderAvailableVideos();
            updatePlaylistStats();
            markAsUnsaved();
            showToast('Lista vaciada', 'success');
        }
    } else {
        showToast('La lista ya está vacía', 'info');
    }
}

/**
 * Resetear cambios
 */
function resetChanges() {
    if (hasUnsavedChanges && confirm('¿Estás seguro de descartar todos los cambios no guardados?')) {
        location.reload();
    }
}

// ==========================================
// FUNCIONES UTILITARIAS
// ==========================================

function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function setLoadingState(loading) {
    isLoading = loading;
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = loading ? 'flex' : 'none';
    }
}

function showErrorState(message) {
    const container = document.getElementById('mainContent');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                <h5>Error</h5>
                <p class="mb-2">${message}</p>
                <button class="btn btn-outline-danger btn-sm" onclick="location.reload()">
                    <i class="fas fa-refresh me-1"></i> Recargar Página
                </button>
            </div>
        `;
    }
}

function showToast(message, type = 'info', duration = 3000) {
    // Crear contenedor de toasts si no existe
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }
    
    const toastId = 'toast-' + Date.now();
    const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-triangle',
        warning: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast show align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0 mb-2`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="${iconMap[type] || iconMap.info} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="closeToast('${toastId}')"></button>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => closeToast(toastId), duration);
}

function closeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.remove();
    }
}

// ==========================================
// INICIALIZACIÓN AUTOMÁTICA
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando editor de playlist...');
    
    // Si ya tenemos datos de la playlist, configurar la interfaz
    if (currentPlaylistData) {
        console.log('📋 Configurando interfaz con datos existentes...');
        setupEditMode();
        renderPlaylistVideos();
        updatePlaylistStats();
    } else {
        // Si no hay datos, intentar cargarlos
        const playlistId = getPlaylistId();
        if (playlistId) {
            loadPlaylistForEdit(playlistId);
        }
    }
    
    console.log('✅ Editor de playlist inicializado');
});

console.log('✅ Script de editor de playlist cargado correctamente (sin Mixed Content)');