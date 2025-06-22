// ==========================================
// FUNCIONES CORREGIDAS PARA EDIT-PLAYLIST.HTML
// ==========================================

// Variables globales
let currentPlaylistData = null;
let availableVideos = [];
let playlistVideos = [];
let hasUnsavedChanges = false;
let sortableAvailable, sortablePlaylist;

// ==========================================
// FUNCIÓN PRINCIPAL: CARGAR PLAYLIST CON VIDEOS ASIGNADOS
// ==========================================

/**
 * Cargar playlist para edición con todos sus videos asignados
 */
async function loadPlaylistForEdit(playlistId) {
    if (!playlistId) {
        console.warn('❌ No se proporcionó ID de playlist');
        return;
    }

    try {
        showToast('Cargando lista para editar...', 'info');
        console.log('🎵 Cargando playlist:', playlistId);

        // 1. Cargar datos básicos de la playlist
        const playlistResponse = await fetch(`/api/playlists/${playlistId}`);
        if (!playlistResponse.ok) {
            throw new Error(`Error al cargar playlist: ${playlistResponse.status}`);
        }
        
        currentPlaylistData = await playlistResponse.json();
        console.log('✅ Playlist cargada:', currentPlaylistData);

        // 2. Cargar videos asignados a esta playlist
        const videosResponse = await fetch(`/api/playlists/${playlistId}/videos`);
        if (!videosResponse.ok) {
            throw new Error(`Error al cargar videos: ${videosResponse.status}`);
        }

        const videosData = await videosResponse.json();
        playlistVideos = Array.isArray(videosData) ? videosData : (videosData.videos || []);
        console.log('✅ Videos de playlist cargados:', playlistVideos.length);

        // 3. Actualizar la interfaz
        setupEditMode();
        renderPlaylistVideos();
        updatePlaylistStats();

        // 4. Cargar videos disponibles (excluyendo los que ya están en la playlist)
        await loadAvailableVideos();

        showToast('Lista cargada correctamente', 'success');

    } catch (error) {
        console.error('❌ Error cargando playlist:', error);
        showToast('Error al cargar la lista de reproducción', 'error');
        
        // Mostrar estado de error
        showPlaylistError('No se pudo cargar la lista de reproducción');
    }
}

// ==========================================
// FUNCIÓN CLAVE: RENDERIZAR VIDEOS DE LA PLAYLIST
// ==========================================

/**
 * Renderizar videos que están asignados a la playlist actual
 */
function renderPlaylistVideos() {
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
        return (a.order || a.playlist_order || 0) - (b.order || b.playlist_order || 0);
    });

    // Generar HTML para cada video
    const videosHTML = sortedVideos.map((video, index) => {
        const order = video.order || video.playlist_order || (index + 1);
        const duration = formatDuration(video.duration || 0);
        const thumbnailUrl = video.thumbnail_url || video.thumbnail || '/static/images/default-video.jpg';
        const status = getVideoStatus(video);

        return `
        <div class="playlist-video-item mb-2" data-video-id="${video.id}" data-order="${order}">
            <div class="card border-0 shadow-sm">
                <div class="card-body p-3">
                    <div class="row align-items-center">
                        <!-- Orden y Drag Handle -->
                        <div class="col-auto">
                            <div class="d-flex align-items-center">
                                <div class="drag-handle me-2" title="Arrastrar para reordenar">
                                    <i class="fas fa-grip-vertical text-muted"></i>
                                </div>
                                <div class="order-badge">
                                    <span class="badge bg-primary">${order}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Thumbnail -->
                        <div class="col-auto">
                            <div class="position-relative">
                                <img src="${thumbnailUrl}" 
                                     alt="${escapeHtml(video.title)}" 
                                     class="img-thumbnail"
                                     style="width: 80px; height: 60px; object-fit: cover;">
                                <div class="position-absolute bottom-0 end-0 bg-dark text-white px-1"
                                     style="font-size: 0.7rem; border-radius: 2px;">
                                    ${duration}
                                </div>
                            </div>
                        </div>

                        <!-- Información del Video -->
                        <div class="col">
                            <div class="row">
                                <div class="col-md-8">
                                    <h6 class="mb-1 fw-bold">${escapeHtml(video.title)}</h6>
                                    <p class="mb-1 text-muted small">
                                        ${escapeHtml(video.description || 'Sin descripción')}
                                    </p>
                                    <div class="d-flex align-items-center">
                                        <span class="badge ${status.class} me-2">${status.text}</span>
                                        ${video.tags ? video.tags.split(',').map(tag => 
                                            `<span class="badge bg-light text-dark me-1">${tag.trim()}</span>`
                                        ).join('') : ''}
                                    </div>
                                </div>
                                <div class="col-md-4 text-end">
                                    <!-- Acciones -->
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-outline-primary" 
                                                onclick="previewVideoInPlaylist(${video.id})"
                                                title="Vista previa">
                                            <i class="fas fa-play"></i>
                                        </button>
                                        <button class="btn btn-outline-secondary" 
                                                onclick="editVideoInPlaylist(${video.id})"
                                                title="Editar">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-outline-danger" 
                                                onclick="removeVideoFromPlaylist(${video.id})"
                                                title="Quitar de la lista">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                    <!-- Info adicional -->
                                    <div class="small text-muted mt-1">
                                        ${video.file_size ? formatFileSize(video.file_size) : ''}
                                    </div>
                                </div>
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

    // Reinicializar drag & drop para la nueva lista
    initializePlaylistSortable();
}

// ==========================================
// FUNCIÓN: CARGAR VIDEOS DISPONIBLES (MEJORADA)
// ==========================================

/**
 * Cargar videos disponibles (excluyendo los que ya están en la playlist)
 */
async function loadAvailableVideos() {
    const loadingElement = document.getElementById('loadingAvailableVideos');
    const availableVideosList = document.getElementById('availableVideosList');

    if (!availableVideosList) {
        console.error('❌ availableVideosList no encontrado');
        return;
    }

    // Mostrar loading
    if (loadingElement) {
        loadingElement.style.display = 'block';
        loadingElement.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
                <p class="mt-2 text-muted">Cargando videos disponibles...</p>
            </div>
        `;
    }

    try {
        console.log('🎬 Cargando videos disponibles...');
        
        const response = await fetch('/api/videos');
        if (!response.ok) {
            throw new Error(`Error al cargar videos: ${response.status}`);
        }

        const data = await response.json();
        availableVideos = Array.isArray(data) ? data : (data.videos || []);
        
        console.log('✅ Videos disponibles cargados:', availableVideos.length);

        // Renderizar videos disponibles
        renderAvailableVideos();

        // Ocultar loading
        if (loadingElement) loadingElement.style.display = 'none';

    } catch (error) {
        console.error('❌ Error cargando videos disponibles:', error);
        
        if (loadingElement) {
            loadingElement.innerHTML = `
                <div class="text-center py-3 text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p class="mt-2">Error al cargar videos</p>
                    <button class="btn btn-sm btn-outline-primary" onclick="loadAvailableVideos()">
                        <i class="fas fa-retry"></i> Reintentar
                    </button>
                </div>
            `;
        }
    }
}

/**
 * Renderizar videos disponibles (excluyendo los que ya están en la playlist)
 */
function renderAvailableVideos() {
    const availableVideosList = document.getElementById('availableVideosList');
    
    if (!availableVideosList) {
        console.error('❌ availableVideosList no encontrado');
        return;
    }

    if (!availableVideos || availableVideos.length === 0) {
        availableVideosList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-video-slash fa-2x text-muted mb-2"></i>
                <p class="text-muted">No hay videos disponibles</p>
                <button class="btn btn-sm btn-primary" onclick="loadAvailableVideos()">
                    <i class="fas fa-sync me-1"></i> Recargar
                </button>
            </div>
        `;
        return;
    }

    // Filtrar videos que ya están en la playlist
    const playlistVideoIds = (playlistVideos || []).map(v => String(v.id));
    const videosDisponibles = availableVideos.filter(v => !playlistVideoIds.includes(String(v.id)));

    if (videosDisponibles.length === 0) {
        availableVideosList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-check-circle fa-2x text-success mb-2"></i>
                <p class="text-success">Todos los videos están en la lista</p>
                <button class="btn btn-sm btn-outline-primary" onclick="loadAvailableVideos()">
                    <i class="fas fa-sync me-1"></i> Recargar
                </button>
            </div>
        `;
        return;
    }

    // Generar HTML para videos disponibles
    const videosHTML = videosDisponibles.map(video => {
        const duration = formatDuration(video.duration || 0);
        const thumbnailUrl = video.thumbnail_url || video.thumbnail || '/static/images/default-video.jpg';
        const status = getVideoStatus(video);

        return `
        <div class="available-video-item mb-2" data-video-id="${video.id}">
            <div class="card border-0 shadow-sm">
                <div class="card-body p-2">
                    <div class="row align-items-center">
                        <div class="col-auto">
                            <img src="${thumbnailUrl}" 
                                 alt="${escapeHtml(video.title)}" 
                                 class="img-thumbnail"
                                 style="width: 50px; height: 37px; object-fit: cover;">
                        </div>
                        <div class="col">
                            <h6 class="mb-0 small fw-bold">${escapeHtml(video.title)}</h6>
                            ${video.description ? 
                                `<p class="mb-0 text-muted" style="font-size: 0.75rem;">${escapeHtml(video.description.substring(0, 50))}${video.description.length > 50 ? '...' : ''}</p>` : 
                                ''
                            }
                            <div class="d-flex align-items-center">
                                <span class="badge ${status.class} me-1" style="font-size: 0.6rem;">${status.text}</span>
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
}

// ==========================================
// FUNCIONES DE GESTIÓN DE VIDEOS EN PLAYLIST
// ==========================================

/**
 * Agregar video a la playlist
 */
async function addVideoToPlaylist(videoId) {
    if (!currentPlaylistData || !currentPlaylistData.id) {
        showToast('No hay una playlist seleccionada', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/playlists/${currentPlaylistData.id}/videos`, {
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
            throw new Error(`Error al agregar video: ${response.status}`);
        }

        showToast('Video agregado a la lista', 'success');
        hasUnsavedChanges = true;

        // Recargar los videos de la playlist
        await loadPlaylistForEdit(currentPlaylistData.id);

    } catch (error) {
        console.error('❌ Error agregando video:', error);
        showToast('Error al agregar el video', 'error');
    }
}

/**
 * Quitar video de la playlist
 */
async function removeVideoFromPlaylist(videoId) {
    if (!confirm('¿Estás seguro de quitar este video de la lista?')) return;

    try {
        const response = await fetch(`/api/playlists/${currentPlaylistData.id}/videos/${videoId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`Error al quitar video: ${response.status}`);
        }

        showToast('Video quitado de la lista', 'success');
        hasUnsavedChanges = true;

        // Quitar video de la lista local y re-renderizar
        playlistVideos = playlistVideos.filter(v => v.id !== videoId);
        renderPlaylistVideos();
        renderAvailableVideos(); // Actualizar videos disponibles
        updatePlaylistStats();

    } catch (error) {
        console.error('❌ Error quitando video:', error);
        showToast('Error al quitar el video', 'error');
    }
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function setupEditMode() {
    if (currentPlaylistData) {
        document.getElementById('pageTitle').textContent = `Editar Lista: ${currentPlaylistData.title}`;
        document.title = `Editor - ${currentPlaylistData.title}`;
        
        // Llenar formulario de información
        const form = document.getElementById('playlistInfoForm');
        if (form) {
            form.playlistTitle.value = currentPlaylistData.title || '';
            form.playlistDescription.value = currentPlaylistData.description || '';
            form.playlistActive.checked = currentPlaylistData.is_active || false;
            
            if (form.playlistStartDate) {
                form.playlistStartDate.value = currentPlaylistData.start_date ? 
                    formatDateTimeForInput(currentPlaylistData.start_date) : '';
            }
            if (form.playlistExpiration) {
                form.playlistExpiration.value = currentPlaylistData.expiration_date ? 
                    formatDateTimeForInput(currentPlaylistData.expiration_date) : '';
            }
        }
    }
}

function updatePlaylistStats() {
    const statsElement = document.getElementById('playlistStats');
    if (statsElement && playlistVideos) {
        const totalDuration = playlistVideos.reduce((sum, video) => sum + (video.duration || 0), 0);
        const totalSize = playlistVideos.reduce((sum, video) => sum + (video.file_size || 0), 0);
        
        statsElement.innerHTML = `
            <div class="row text-center">
                <div class="col">
                    <div class="h4 mb-0">${playlistVideos.length}</div>
                    <small>Videos</small>
                </div>
                <div class="col">
                    <div class="h4 mb-0">${formatDuration(totalDuration)}</div>
                    <small>Duración</small>
                </div>
                <div class="col">
                    <div class="h4 mb-0">${formatFileSize(totalSize)}</div>
                    <small>Tamaño</small>
                </div>
            </div>
        `;
    }
}

// Funciones auxiliares para formato
function formatDuration(seconds) {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDateTimeForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
}

function getVideoStatus(video) {
    const now = new Date();
    const expiration = video.expiration_date ? new Date(video.expiration_date) : null;
    
    if (expiration && now > expiration) {
        return { class: 'bg-danger', text: 'Expirado' };
    }
    return { class: 'bg-success', text: 'Activo' };
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    // Implementar toast notification según tu sistema
}

function showPlaylistError(message) {
    const container = document.getElementById('playlistVideosList');
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger text-center">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Error:</strong> ${message}
                <br>
                <button class="btn btn-outline-danger btn-sm mt-2" onclick="location.reload()">
                    <i class="fas fa-refresh"></i> Recargar Página
                </button>
            </div>
        `;
    }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

function initializePlaylistEditor() {
    console.log('🎵 Inicializando Editor de Playlist');
    
    try {
        // Detectar ID de playlist desde URL
        const urlParams = new URLSearchParams(window.location.search);
        const playlistId = urlParams.get('id');
        
        if (playlistId && !currentPlaylistData) {
            loadPlaylistForEdit(playlistId);
        } else if (currentPlaylistData && currentPlaylistData.id) {
            // Si ya hay datos de playlist, cargar sus videos
            loadPlaylistForEdit(currentPlaylistData.id);
        } else {
            // Cargar solo videos disponibles para nueva playlist
            loadAvailableVideos();
        }
        
    } catch (error) {
        console.error('Error inicializando editor:', error);
        showToast('Error al inicializar el editor', 'error');
    }
}

// Hacer funciones disponibles globalmente
window.loadPlaylistForEdit = loadPlaylistForEdit;
window.renderPlaylistVideos = renderPlaylistVideos;
window.loadAvailableVideos = loadAvailableVideos;
window.renderAvailableVideos = renderAvailableVideos;
window.addVideoToPlaylist = addVideoToPlaylist;
window.removeVideoFromPlaylist = removeVideoFromPlaylist;
window.updatePlaylistStats = updatePlaylistStats;
window.initializePlaylistEditor = initializePlaylistEditor;