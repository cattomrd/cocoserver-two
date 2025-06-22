/**
 * EDIT-PLAYLIST.JS - Editor de Listas de Reproducción
 * Archivo: static/js/edit-playlist.js
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
// CONFIGURACIÓN DE APIs
// ==========================================
const API_ENDPOINTS = {
    videos: '/api/videos',
    playlists: '/api/playlists',
    playlistById: (id) => `/api/playlists/${id}`,
    playlistVideos: (id) => `/api/playlists/${id}/videos`,
    addVideoToPlaylist: (playlistId) => `/api/playlists/${playlistId}/videos`,
    removeVideoFromPlaylist: (playlistId, videoId) => `/api/playlists/${playlistId}/videos/${videoId}`,
    updatePlaylist: (id) => `/api/playlists/${id}`
};

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
        console.log('📡 Fetch:', API_ENDPOINTS.playlistById(playlistId));
        const playlistResponse = await fetch(API_ENDPOINTS.playlistById(playlistId));
        
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
        console.log('📡 Fetch:', API_ENDPOINTS.videos);
        const response = await fetch(API_ENDPOINTS.videos);
        
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
        
        // Fallback con datos de ejemplo
        availableVideos = createSampleVideos();
        console.log('📝 Usando datos de muestra:', availableVideos.length);
        
        renderAvailableVideos();
        
        if (loadingElement) {
            loadingElement.innerHTML = `
                <div class="text-center py-3 text-warning">
                    <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                    <p class="mb-1">Error conectando con la API</p>
                    <p class="small text-muted mb-2">Mostrando datos de muestra</p>
                    <button class="btn btn-sm btn-outline-primary" onclick="loadAvailableVideos()">
                        <i class="fas fa-retry"></i> Reintentar
                    </button>
                </div>
            `;
        }
    }
}

/**
 * Crear videos de muestra para testing
 */
function createSampleVideos() {
    return [
        {
            id: 1,
            title: "Video de Muestra 1",
            description: "Primera demostración del sistema",
            duration: 120,
            thumbnail_url: null,
            is_active: true,
            filename: "sample1.mp4"
        },
        {
            id: 2,
            title: "Video de Muestra 2",
            description: "Segunda demostración del sistema",
            duration: 180,
            thumbnail_url: null,
            is_active: true,
            filename: "sample2.mp4"
        },
        {
            id: 3,
            title: "Video de Muestra 3",
            description: "Tercera demostración del sistema",
            duration: 95,
            thumbnail_url: null,
            is_active: true,
            filename: "sample3.mp4"
        }
    ];
}

// ==========================================
// FUNCIONES DE RENDERIZADO
// ==========================================

/**
 * Renderizar videos disponibles
 */
function renderAvailableVideos() {
    console.log('🎨 Renderizando videos disponibles...');
    
    const availableVideosList = document.getElementById('availableVideosList');
    if (!availableVideosList) {
        console.error('❌ Elemento availableVideosList no encontrado');
        return;
    }

    if (!availableVideos || availableVideos.length === 0) {
        availableVideosList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-video-slash fa-2x text-muted mb-3"></i>
                <h6 class="text-muted">No hay videos disponibles</h6>
                <button class="btn btn-sm btn-primary" onclick="loadAvailableVideos()">
                    <i class="fas fa-sync me-1"></i> Recargar Videos
                </button>
            </div>
        `;
        return;
    }

    // Filtrar videos que ya están en la playlist
    const playlistVideoIds = playlistVideos.map(v => parseInt(v.id));
    const videosDisponibles = availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id)));

    if (videosDisponibles.length === 0) {
        availableVideosList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-check-circle fa-2x text-success mb-3"></i>
                <h6 class="text-success">Todos los videos están en la lista</h6>
                <button class="btn btn-sm btn-outline-primary" onclick="loadAvailableVideos()">
                    <i class="fas fa-sync me-1"></i> Actualizar
                </button>
            </div>
        `;
        return;
    }

    // Generar HTML para cada video disponible
    const videosHTML = videosDisponibles.map(video => {
        const duration = formatDuration(video.duration || 0);
        const thumbnailUrl = video.thumbnail_url || '/static/images/default-video.jpg';
        const status = getVideoStatus(video);

        return `
        <div class="video-card mb-2" data-video-id="${video.id}">
            <div class="card border-0 shadow-sm video-item-hover">
                <div class="card-body p-2">
                    <div class="row align-items-center">
                        <div class="col-auto">
                            <div class="video-thumbnail-container">
                                <img src="${thumbnailUrl}" 
                                     alt="${escapeHtml(video.title)}" 
                                     class="img-thumbnail"
                                     style="width: 60px; height: 45px; object-fit: cover;"
                                     onerror="this.src='/static/images/default-video.jpg'">
                                <div class="video-duration-overlay">${duration}</div>
                            </div>
                        </div>
                        <div class="col">
                            <h6 class="mb-1 fw-bold video-title">${escapeHtml(video.title)}</h6>
                            ${video.description ? 
                                `<p class="mb-1 text-muted small video-description">${escapeHtml(video.description.substring(0, 60))}${video.description.length > 60 ? '...' : ''}</p>` : 
                                '<p class="mb-1 text-muted small">Sin descripción</p>'
                            }
                            <div class="d-flex align-items-center">
                                <span class="badge ${status.class} me-2">${status.text}</span>
                                <small class="text-muted">${duration}</small>
                            </div>
                        </div>
                        <div class="col-auto">
                            <button class="btn btn-sm btn-primary" 
                                    onclick="addVideoToPlaylist(${video.id})"
                                    title="Agregar a la lista">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    availableVideosList.innerHTML = videosHTML;
    
    // Actualizar contador
    updateAvailableVideoCount(videosDisponibles.length);
}

/**
 * Renderizar videos de la playlist
 */
function renderPlaylistVideos() {
    console.log('🎬 Renderizando videos de la playlist:', playlistVideos.length);
    
    const container = document.getElementById('playlistVideosList');
    const emptyMessage = document.getElementById('emptyPlaylistMessage');
    const countElement = document.getElementById('playlistVideoCount');

    if (!container) {
        console.error('❌ Container playlistVideosList no encontrado');
        return;
    }

    // Mostrar mensaje vacío si no hay videos
    if (!playlistVideos || playlistVideos.length === 0) {
        if (emptyMessage) emptyMessage.style.display = 'block';
        container.innerHTML = '';
        if (countElement) countElement.textContent = '0 videos';
        return;
    }

    // Ocultar mensaje vacío
    if (emptyMessage) emptyMessage.style.display = 'none';

    // Ordenar videos por su orden en la playlist
    const sortedVideos = [...playlistVideos].sort((a, b) => {
        return (a.order || 0) - (b.order || 0);
    });

    const videosHTML = sortedVideos.map((video, index) => {
        const order = video.order || (index + 1);
        const duration = formatDuration(video.duration || 0);
        const thumbnailUrl = video.thumbnail || video.thumbnail_url || '/static/images/default-video.jpg';
        const status = getVideoStatus(video);

        return `
        <div class="playlist-video-item mb-2" data-video-id="${video.id}" data-order="${order}">
            <div class="card border-0 shadow-sm">
                <div class="card-body p-3">
                    <div class="row align-items-center">
                        <div class="col-auto">
                            <div class="d-flex align-items-center">
                                <div class="drag-handle me-2" title="Arrastrar para reordenar">
                                    <i class="fas fa-grip-vertical text-muted"></i>
                                </div>
                                <span class="badge bg-primary order-badge">${order}</span>
                            </div>
                        </div>
                        <div class="col-auto">
                            <div class="video-thumbnail-container">
                                <img src="${thumbnailUrl}" 
                                     alt="${escapeHtml(video.title)}" 
                                     class="img-thumbnail"
                                     style="width: 80px; height: 60px; object-fit: cover;"
                                     onerror="this.src='/static/images/default-video.jpg'">
                                <div class="video-duration-overlay">${duration}</div>
                            </div>
                        </div>
                        <div class="col">
                            <h6 class="mb-1 fw-bold">${escapeHtml(video.title)}</h6>
                            <p class="mb-1 text-muted small">
                                ${escapeHtml(video.description || 'Sin descripción')}
                            </p>
                            <div class="d-flex align-items-center">
                                <span class="badge ${status.class} me-2">${status.text}</span>
                                <small class="text-muted">${duration}</small>
                                ${video.filename ? `<small class="text-muted ms-2">${video.filename}</small>` : ''}
                            </div>
                        </div>
                        <div class="col-auto">
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary" 
                                        onclick="previewVideo(${video.id})"
                                        title="Vista previa">
                                    <i class="fas fa-play"></i>
                                </button>
                                <button class="btn btn-outline-danger" 
                                        onclick="removeVideoFromPlaylist(${video.id})"
                                        title="Quitar de la lista">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    container.innerHTML = videosHTML;

    // Actualizar contador
    if (countElement) {
        countElement.textContent = `${playlistVideos.length} video${playlistVideos.length !== 1 ? 's' : ''}`;
    }
}

// ==========================================
// FUNCIONES DE GESTIÓN DE PLAYLIST
// ==========================================

/**
 * Agregar video a la playlist
 */
async function addVideoToPlaylist(videoId) {
    console.log('➕ Agregando video a playlist:', videoId);
    
    if (!currentPlaylistData || !currentPlaylistData.id) {
        showToast('No hay una playlist seleccionada', 'error');
        return;
    }

    if (isLoading) return;
    setLoadingState(true);

    try {
        const response = await fetch(API_ENDPOINTS.addVideoToPlaylist(currentPlaylistData.id), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                video_id: videoId,
                order: playlistVideos.length + 1
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Error ${response.status}`);
        }

        // Agregar video a la lista local
        const video = availableVideos.find(v => v.id === videoId);
        if (video) {
            playlistVideos.push({
                ...video,
                order: playlistVideos.length + 1
            });
            
            renderPlaylistVideos();
            renderAvailableVideos();
            updatePlaylistStats();
            markAsUnsaved();
            
            showToast('Video agregado a la lista', 'success');
        }

    } catch (error) {
        console.error('❌ Error agregando video:', error);
        showToast(`Error al agregar video: ${error.message}`, 'error');
    } finally {
        setLoadingState(false);
    }
}

/**
 * Quitar video de la playlist
 */
async function removeVideoFromPlaylist(videoId) {
    console.log('➖ Quitando video de playlist:', videoId);
    
    if (!confirm('¿Estás seguro de quitar este video de la lista?')) return;

    if (!currentPlaylistData || !currentPlaylistData.id) {
        showToast('No hay una playlist seleccionada', 'error');
        return;
    }

    if (isLoading) return;
    setLoadingState(true);

    try {
        const response = await fetch(API_ENDPOINTS.removeVideoFromPlaylist(currentPlaylistData.id, videoId), {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Error ${response.status}`);
        }

        // Quitar video de la lista local
        playlistVideos = playlistVideos.filter(v => v.id !== videoId);
        
        renderPlaylistVideos();
        renderAvailableVideos();
        updatePlaylistStats();
        markAsUnsaved();
        
        showToast('Video quitado de la lista', 'success');

    } catch (error) {
        console.error('❌ Error quitando video:', error);
        showToast(`Error al quitar video: ${error.message}`, 'error');
    } finally {
        setLoadingState(false);
    }
}

/**
 * Guardar cambios de la playlist
 */
async function savePlaylistChanges() {
    console.log('💾 Guardando cambios de playlist...');
    
    if (!currentPlaylistData || !currentPlaylistData.id) {
        showToast('No hay una playlist para guardar', 'warning');
        return;
    }

    if (isLoading) return;
    setLoadingState(true);

    try {
        showToast('Guardando cambios...', 'info');
        
        const form = document.getElementById('playlistInfoForm');
        if (!form) {
            throw new Error('Formulario de playlist no encontrado');
        }
        
        const formData = new FormData(form);
        
        const playlistData = {
            title: formData.get('title') || currentPlaylistData.title,
            description: formData.get('description') || currentPlaylistData.description || '',
            is_active: formData.get('is_active') === 'on',
            start_date: formData.get('start_date') || null,
            expiration_date: formData.get('expiration_date') || null
        };

        console.log('📝 Datos a guardar:', playlistData);

        const response = await fetch(API_ENDPOINTS.updatePlaylist(currentPlaylistData.id), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
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

/**
 * Actualizar información de la playlist
 */
function updatePlaylistInfo() {
    console.log('🔄 Actualizando información de playlist...');
    
    const form = document.getElementById('playlistInfoForm');
    if (!form) {
        console.warn('❌ Formulario de playlist no encontrado');
        return;
    }

    markAsUnsaved();
    
    const formData = new FormData(form);
    const title = formData.get('title');
    
    if (title && currentPlaylistData) {
        currentPlaylistData.title = title;
        updatePageTitle();
    }
    
    showToast('Información actualizada (sin guardar)', 'info');
}

// ==========================================
// FUNCIONES DE INTERFAZ Y UTILIDADES
// ==========================================

/**
 * Configurar modo de edición
 */
function setupEditMode() {
    if (!currentPlaylistData) return;
    
    console.log('⚙️ Configurando modo edición para:', currentPlaylistData.title);
    
    updatePageTitle();
    fillPlaylistForm();
    updatePlaylistBadge();
}

/**
 * Llenar formulario con datos de la playlist
 */
function fillPlaylistForm() {
    if (!currentPlaylistData) return;
    
    const form = document.getElementById('playlistInfoForm');
    if (!form) {
        console.warn('❌ Formulario de playlist no encontrado');
        return;
    }
    
    // Llenar campos básicos
    const titleField = form.querySelector('#playlistTitle');
    const descField = form.querySelector('#playlistDescription');
    const activeField = form.querySelector('#playlistActive');
    const startDateField = form.querySelector('#playlistStartDate');
    const expirationField = form.querySelector('#playlistExpiration');
    
    if (titleField) titleField.value = currentPlaylistData.title || '';
    if (descField) descField.value = currentPlaylistData.description || '';
    if (activeField) activeField.checked = currentPlaylistData.is_active || false;
    
    if (startDateField && currentPlaylistData.start_date) {
        startDateField.value = formatDateTimeForInput(currentPlaylistData.start_date);
    }
    
    if (expirationField && currentPlaylistData.expiration_date) {
        expirationField.value = formatDateTimeForInput(currentPlaylistData.expiration_date);
    }
}

/**
 * Actualizar título de la página
 */
function updatePageTitle() {
    const titleElement = document.getElementById('pageTitle');
    if (titleElement && currentPlaylistData) {
        titleElement.textContent = `Editar Lista: ${currentPlaylistData.title}`;
    }
}

/**
 * Actualizar badge de estado
 */
function updatePlaylistBadge() {
    const badge = document.getElementById('playlistStatusBadge');
    if (badge && currentPlaylistData) {
        const status = currentPlaylistData.is_active ? 'Activa' : 'Inactiva';
        const className = currentPlaylistData.is_active ? 'bg-success' : 'bg-secondary';
        
        badge.textContent = status;
        badge.className = `badge ${className} ms-2`;
    }
}

/**
 * Actualizar estadísticas de la playlist
 */
function updatePlaylistStats() {
    if (!playlistVideos) return;
    
    const totalDuration = playlistVideos.reduce((sum, video) => sum + (video.duration || 0), 0);
    const avgDuration = playlistVideos.length > 0 ? totalDuration / playlistVideos.length : 0;
    
    // Actualizar elementos individuales
    updateElement('totalVideos', playlistVideos.length);
    updateElement('totalDuration', formatDuration(totalDuration));
    updateElement('avgDuration', formatDuration(avgDuration));
    updateElement('totalPlaylistDuration', formatDuration(totalDuration));
    
    // Mostrar/ocultar sección de estadísticas
    const statsSection = document.getElementById('playlistStats');
    if (statsSection) {
        statsSection.style.display = playlistVideos.length > 0 ? 'block' : 'none';
    }
}

/**
 * Actualizar contador de videos disponibles
 */
function updateAvailableVideoCount(count) {
    const countElement = document.getElementById('availableVideoCount');
    if (countElement) {
        countElement.textContent = `${count} video${count !== 1 ? 's' : ''}`;
    }
}

/**
 * Marcar como cambios no guardados
 */
function markAsUnsaved() {
    hasUnsavedChanges = true;
    
    // Agregar indicador visual
    const saveButton = document.querySelector('button[onclick="savePlaylistChanges()"]');
    if (saveButton && !saveButton.classList.contains('btn-warning')) {
        saveButton.classList.remove('btn-outline-secondary');
        saveButton.classList.add('btn-warning');
        
        const icon = saveButton.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-exclamation-triangle';
        }
    }
}

/**
 * Establecer estado de carga
 */
function setLoadingState(loading) {
    isLoading = loading;
    
    // Deshabilitar botones durante la carga
    const buttons = document.querySelectorAll('button[onclick*="addVideoToPlaylist"], button[onclick*="removeVideoFromPlaylist"], button[onclick*="savePlaylistChanges"]');
    buttons.forEach(button => {
        button.disabled = loading;
        if (loading) {
            button.classList.add('disabled');
        } else {
            button.classList.remove('disabled');
        }
    });
}

// ==========================================
// FUNCIONES AUXILIARES Y UTILIDADES
// ==========================================

/**
 * Formatear duración en segundos
 */
function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m`;
    } else {
        return `${secs}s`;
    }
}

/**
 * Formatear fecha para input datetime-local
 */
function formatDateTimeForInput(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        return date.toISOString().slice(0, 16);
    } catch (error) {
        console.warn('Error formateando fecha:', error);
        return '';
    }
}

/**
 * Obtener estado del video
 */
function getVideoStatus(video) {
    if (!video.is_active) {
        return { class: 'bg-secondary', text: 'Inactivo' };
    }
    
    if (video.expiration_date) {
        const now = new Date();
        const expiration = new Date(video.expiration_date);
        
        if (now > expiration) {
            return { class: 'bg-danger', text: 'Expirado' };
        }
    }
    
    return { class: 'bg-success', text: 'Activo' };
}

/**
 * Escapar HTML para prevenir XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Actualizar elemento del DOM
 */
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

/**
 * Mostrar toast notification
 */
function showToast(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    
    // Crear contenedor si no existe
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    const toastId = 'toast-' + Date.now();
    const bgColor = {
        success: '#198754',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#0dcaf0'
    }[type] || '#6c757d';
    
    const icon = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-triangle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    }[type] || 'fa-info-circle';
    
    const toastHTML = `
        <div id="${toastId}" class="toast show" role="alert" style="background-color: ${bgColor}; color: white; margin-bottom: 10px; min-width: 300px;">
            <div class="toast-body d-flex align-items-center">
                <i class="fas ${icon} me-2"></i>
                <span class="flex-grow-1">${message}</span>
                <button type="button" class="btn-close btn-close-white ms-2" onclick="document.getElementById('${toastId}').remove()"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        const toast = document.getElementById(toastId);
        if (toast) toast.remove();
    }, 5000);
}

/**
 * Mostrar estado de error
 */
function showErrorState(message) {
    const container = document.getElementById('playlistVideosList');
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger text-center m-3">
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
 * Vista previa de video específico
 */
function previewVideo(videoId) {
    console.log('▶️ Vista previa de video:', videoId);
    showToast('Vista previa de video - Funcionalidad en desarrollo', 'info');
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
    } else if (!hasUnsavedChanges) {
        showToast('No hay cambios para descartar', 'info');
    }
}

// ==========================================
// INICIALIZACIÓN Y EVENT LISTENERS
// ==========================================

/**
 * Inicializar editor de playlist
 */
function initializePlaylistEditor() {
    console.log('🎵 Inicializando Editor de Playlist...');
    
    try {
        // PRIMERO: Verificar si hay datos de playlist desde el template
        if (currentPlaylistData && currentPlaylistData.id) {
            console.log('📋 Usando datos del template para playlist:', currentPlaylistData.id);
            
            // Configurar interfaz con datos existentes
            setupEditMode();
            renderPlaylistVideos();
            updatePlaylistStats();
            
            // Luego cargar videos disponibles
            loadAvailableVideos();
            
        } else {
            // SEGUNDO: Intentar detectar ID desde URL si no hay datos del template
            const urlParams = new URLSearchParams(window.location.search);
            const playlistId = urlParams.get('id');
            
            if (playlistId) {
                console.log('🔄 No hay datos del template, cargando desde API - Playlist ID:', playlistId);
                loadPlaylistForEdit(playlistId);
            } else {
                console.log('🆕 Modo nueva playlist');
                // Solo cargar videos disponibles para nueva playlist
                loadAvailableVideos();
            }
        }
        
        // Configurar event listeners
        setupEventListeners();
        
        // Configurar advertencia de cambios no guardados
        window.addEventListener('beforeunload', function(e) {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
        
    } catch (error) {
        console.error('❌ Error inicializando editor:', error);
        showToast('Error al inicializar el editor', 'error');
    }
}

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    console.log('⚙️ Configurando event listeners...');
    
    // Búsqueda de videos
    const searchInput = document.getElementById('videoSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function(e) {
            filterAvailableVideos(e.target.value);
        }, 300));
    }
    
    // Limpiar búsqueda
    const clearSearchBtn = document.getElementById('clearVideoSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            if (searchInput) searchInput.value = '';
            filterAvailableVideos('');
        });
    }
    
    // Cambios en formulario
    const form = document.getElementById('playlistInfoForm');
    if (form) {
        form.addEventListener('change', markAsUnsaved);
        form.addEventListener('input', markAsUnsaved);
    }
    
    console.log('✅ Event listeners configurados');
}

/**
 * Filtrar videos disponibles
 */
function filterAvailableVideos(searchTerm) {
    // Implementación básica de filtrado
    renderAvailableVideos();
}

/**
 * Función debounce para optimizar búsquedas
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==========================================
// HACER FUNCIONES DISPONIBLES GLOBALMENTE
// ==========================================

// Exportar funciones al ámbito global
window.loadPlaylistForEdit = loadPlaylistForEdit;
window.loadAvailableVideos = loadAvailableVideos;
window.addVideoToPlaylist = addVideoToPlaylist;
window.removeVideoFromPlaylist = removeVideoFromPlaylist;
window.savePlaylistChanges = savePlaylistChanges;
window.updatePlaylistInfo = updatePlaylistInfo;
window.loadPlaylistSelector = loadPlaylistSelector;
window.previewPlaylist = previewPlaylist;
window.previewVideo = previewVideo;
window.clearPlaylist = clearPlaylist;
window.resetChanges = resetChanges;

// ==========================================
// AUTO-INICIALIZACIÓN
// ==========================================

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePlaylistEditor);
} else {
    // Si el DOM ya está listo, inicializar inmediatamente
    setTimeout(initializePlaylistEditor, 100);
}

console.log('✅ Editor de Playlist cargado correctamente');