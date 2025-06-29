/**
 * PLAYLIST_DETAIL.JS - Gestor de Detalles de Playlist
 * Versión corregida sin errores de Mixed Content
 */

console.log('🎵 Cargando Editor de Playlist...');

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let currentPlaylistData = null;
let availableVideos = [];
let playlistVideos = [];
let hasChanges = false;
let isLoading = false;
// Variables para gestión de dispositivos
let assignedDevices = [];
let allDevices = [];
let deviceAssignmentsChanged = false;
let deviceAssignmentUpdates = new Set(); // Para mantener track de cambios en asignaciones

// Variables de paginación para la biblioteca de videos
const paginationState = {
    currentPage: 1,
    pageSize: 25,
    totalPages: 1,
    filteredVideos: []
};

// ==========================================
// CONFIGURACIÓN DE API - SIN MIXED CONTENT
// ==========================================

/**
 * Función para obtener la URL base de la API de manera segura
 * Evita errores de Mixed Content usando el mismo protocolo que la página
 */
const getApiUrl = () => {
    const protocol = window.location.protocol; // 'https:' o 'http:'
    const host = window.location.host;
    return `${protocol}//${host}/api`;
};

// Endpoints estructurados para llamadas a la API
const API_ENDPOINTS = {
    videos: `${getApiUrl()}/videos`,
    playlists: `${getApiUrl()}/playlists`,
    playlistById: (id) => `${getApiUrl()}/playlists/${id}`,
    playlistVideos: (id) => `${getApiUrl()}/playlists/${id}/videos`,
    addVideoToPlaylist: (playlistId, videoId) => `${getApiUrl()}/playlists/${playlistId}/videos/${videoId}`,
    removeVideoFromPlaylist: (playlistId, videoId) => `${getApiUrl()}/playlists/${playlistId}/videos/${videoId}`,
    clearPlaylistVideos: (playlistId) => `${getApiUrl()}/playlists/${playlistId}/videos/clear`,
    updateVideoOrder: (playlistId) => `${getApiUrl()}/playlists/${playlistId}/video-order`,
    updatePlaylist: (id) => `${getApiUrl()}/playlists/${id}`,
    // Endpoints para dispositivos
    devices: `${getApiUrl()}/devices`,
    devicePlaylists: `${getApiUrl()}/device-playlists`,
    assignDevice: `${getApiUrl()}/device-playlists`,
    unassignDevice: (assignmentId) => `${getApiUrl()}/device-playlists/${assignmentId}`
};

console.log('🔧 API Endpoints configurados (HTTPS-safe):', API_ENDPOINTS);

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
// FUNCIÓN PARA OBTENER ID DE PLAYLIST
// ==========================================

/**
 * Función para obtener de manera robusta el ID de la playlist actual
 */
function getPlaylistId() {
    console.log('🔍 Obteniendo ID de playlist...');
    
    // Método 1: Obtener de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    console.log(`🔹 ID de URL: ${idFromUrl}`);
    
    // Método 2: Obtener del elemento oculto
    const idElement = document.getElementById('playlist-id');
    const idFromElement = idElement ? idElement.value : null;
    console.log(`🔹 ID de elemento oculto: ${idFromElement}`);
    
    // Método 3: Obtener de los datos globales
    const idFromData = currentPlaylistData ? currentPlaylistData.id : null;
    console.log(`🔹 ID de datos globales: ${idFromData}`);
    
    // Método 4: Obtener de la variable global del window
    const idFromWindow = window.currentPlaylistId || null;
    console.log(`🔹 ID de window: ${idFromWindow}`);
    
    // Prioridad: URL > elemento oculto > datos globales > window
    const playlistId = idFromUrl || idFromElement || idFromData || idFromWindow;
    
    console.log(`✅ ID final de playlist: ${playlistId}`);
    
    if (!playlistId) {
        console.error('❌ No se pudo determinar el ID de la playlist');
        showToast('Error: No se pudo identificar la playlist', 'error');
    }
    
    return playlistId;
}

// ==========================================
// FUNCIONES DE INICIALIZACIÓN
// ==========================================

/**
 * Inicialización automática al cargar el DOM
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando playlist detail...');
    
    // Configurar el ID de la playlist desde la URL
    setupPlaylistIdElement();
    
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
    
    // Configurar event listeners
    setupEventListeners();
    
    console.log('✅ Playlist detail inicializado');
});

/**
 * Función para crear elemento oculto con ID de playlist
 */
function setupPlaylistIdElement() {
    // Obtener ID de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const playlistId = urlParams.get('id');
    
    if (playlistId) {
        console.log(`📌 ID de playlist detectado en URL: ${playlistId}`);
        window.currentPlaylistId = playlistId;
        
        // Crear elemento oculto si no existe
        if (!document.getElementById('playlist-id')) {
            console.log('📌 Creando elemento oculto para ID de playlist');
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.id = 'playlist-id';
            hiddenInput.value = playlistId;
            document.body.appendChild(hiddenInput);
        } else {
            // Asegurarse de que tenga el valor correcto
            document.getElementById('playlist-id').value = playlistId;
        }
    } else {
        console.warn('⚠️ No se detectó ID de playlist en la URL');
    }
}

/**
 * Configurar event listeners principales
 */
function setupEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Event listener para el formulario principal (si existe)
    const playlistForm = document.getElementById('playlistForm');
    if (playlistForm) {
        playlistForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Event listeners para filtros de videos
    const videoSearchInput = document.getElementById('videoSearchInput');
    if (videoSearchInput) {
        videoSearchInput.addEventListener('input', debounce(filterAvailableVideos, 300));
    }
    
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
        if (hasChanges) {
            e.preventDefault();
            e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?';
        }
    });
}

// ==========================================
// FUNCIONES DE CARGA DE DATOS
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
        
        // 4. Cargar dispositivos asignados
        await loadAssignedDevices();
        
        // 5. Actualizar interfaz
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
        
        // Actualizar estado de paginación
        const playlistVideoIds = playlistVideos.map(v => parseInt(v.id));
        paginationState.filteredVideos = availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id)));
        paginationState.totalPages = Math.ceil(paginationState.filteredVideos.length / paginationState.pageSize);
        paginationState.currentPage = 1;
        
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

/**
 * Cargar dispositivos asignados a la playlist
 */
async function loadAssignedDevices() {
    console.log('📱 Cargando dispositivos asignados...');
    
    const playlistId = getPlaylistId();
    if (!playlistId) return;
    
    try {
        const response = await fetch(`${API_ENDPOINTS.devicePlaylists}?playlist_id=${playlistId}`);
        
        if (!response.ok) {
            console.warn('⚠️ No se pudieron cargar dispositivos asignados');
            return;
        }
        
        const assignments = await response.json();
        assignedDevices = Array.isArray(assignments) ? assignments : [];
        
        console.log('✅ Dispositivos asignados cargados:', assignedDevices.length);
        
        // Renderizar dispositivos asignados si existe el contenedor
        renderAssignedDevices();
        
    } catch (error) {
        console.warn('⚠️ Error cargando dispositivos asignados:', error);
    }
}

// ==========================================
// FUNCIONES DE RENDERIZADO
// ==========================================

/**
 * Renderiza los videos disponibles con paginación
 */
function renderAvailableVideos() {
    const container = document.getElementById('availableVideosList');
    if (!container) {
        console.warn('⚠️ Contenedor availableVideosList no encontrado');
        return;
    }
    
    const { filteredVideos, currentPage, pageSize } = paginationState;
    
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
    
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageVideos = filteredVideos.slice(start, end);
    
    container.innerHTML = pageVideos.map(video => `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card h-100 video-card">
                <div class="position-relative">
                    <div class="video-thumbnail-placeholder">
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
                        ${video.description ? escapeHtml(video.description).substring(0, 100) + '...' : 'Sin descripción'}
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
    
    // Actualizar información de paginación
    updateVideoPaginationInfo();
}

/**
 * Renderiza los videos de la playlist actual
 */
function renderPlaylistVideos() {
    const container = document.getElementById('playlistVideosList');
    if (!container) {
        console.warn('⚠️ Contenedor playlistVideosList no encontrado');
        return;
    }
    
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
    
    // Ordenar videos por el campo 'order' si existe
    const sortedVideos = [...playlistVideos].sort((a, b) => {
        const orderA = a.order || a.playlist_order || 0;
        const orderB = b.order || b.playlist_order || 0;
        return orderA - orderB;
    });
    
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
                    ${sortedVideos.map((video, index) => `
                        <tr data-video-id="${video.id}">
                            <td>
                                <span class="badge bg-secondary">${index + 1}</span>
                            </td>
                            <td>
                                <div class="d-flex align-items-center">
                                    <div class="video-thumbnail-small me-3">
                                        <i class="fas fa-play-circle fa-2x text-primary"></i>
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

/**
 * Renderizar dispositivos asignados
 */
function renderAssignedDevices() {
    const container = document.getElementById('assignedDevicesList');
    if (!container) return;
    
    if (assignedDevices.length === 0) {
        container.innerHTML = `
            <div class="text-center py-3 text-muted">
                <i class="fas fa-mobile-alt fa-2x mb-2"></i>
                <p class="mb-0">No hay dispositivos asignados</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = assignedDevices.map(assignment => `
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
                <h6 class="mb-1">${escapeHtml(assignment.device_name || 'Dispositivo sin nombre')}</h6>
                <small class="text-muted">ID: ${assignment.device_id}</small>
            </div>
            <button class="btn btn-sm btn-outline-danger" 
                    onclick="unassignDevice(${assignment.id})"
                    title="Desasignar">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// ==========================================
// FUNCIONES DE GESTIÓN DE PLAYLIST
// ==========================================

/**
 * Agregar video a la playlist
 */
async function addVideoToPlaylist(videoId) {
    try {
        // Obtener el ID de la playlist
        const playlistId = getPlaylistId();
        
        if (!playlistId) {
            throw new Error('No se pudo determinar el ID de la playlist');
        }
        
        console.log(`🎬 Añadiendo video ${videoId} a playlist ${playlistId}`);
        
        // Construir la URL con el formato correcto
        const url = API_ENDPOINTS.addVideoToPlaylist(playlistId, videoId);
        console.log(`📡 URL de la API: ${url}`);
        
        // Realizar petición POST sin body (ya que los IDs están en la URL)
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
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
            showToast('Video agregado a la playlist', 'success');
            
            // Marcar que hay cambios
            markAsUnsaved();
        }
        
        // Actualizar videos disponibles
        updateAvailableVideosList();
        
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
        // Obtener el ID de la playlist
        const playlistId = getPlaylistId();
        
        if (!playlistId) {
            throw new Error('No se pudo determinar el ID de la playlist');
        }
        
        console.log(`🗑️ Eliminando video ${videoId} de playlist ${playlistId}`);
        
        // Construir la URL correcta
        const url = API_ENDPOINTS.removeVideoFromPlaylist(playlistId, videoId);
        console.log(`📡 URL de la API: ${url}`);
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Error de API (${response.status}): ${errorText}`);
            throw new Error('Failed to remove video from playlist');
        }
        
        // Actualizar la interfaz
        playlistVideos = playlistVideos.filter(v => parseInt(v.id) !== parseInt(videoId));
        renderPlaylistVideos();
        showToast('Video eliminado de la playlist', 'success');
        
        // Marcar que hay cambios
        markAsUnsaved();
        
        // Actualizar videos disponibles
        updateAvailableVideosList();
        
    } catch (error) {
        console.error('❌ Error eliminando video:', error);
        showToast(`Error al eliminar video: ${error.message}`, 'error');
    }
}

/**
 * Limpiar toda la playlist
 */
async function clearPlaylist() {
    if (playlistVideos.length === 0) {
        showToast('La playlist ya está vacía', 'info');
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar todos los videos de la playlist?')) {
        return;
    }
    
    try {
        // Obtener el ID de la playlist
        const playlistId = getPlaylistId();
        
        if (!playlistId) {
            throw new Error('No se pudo determinar el ID de la playlist');
        }
        
        console.log(`🎬 Limpiando todos los videos de playlist ${playlistId}`);
        
        // Construir la URL correcta
        const url = API_ENDPOINTS.clearPlaylistVideos(playlistId);
        console.log(`📡 URL de la API: ${url}`);
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Error de API (${response.status}): ${errorText}`);
            throw new Error('Failed to clear playlist');
        }
        
        // Actualizar la interfaz
        playlistVideos = [];
        renderPlaylistVideos();
        showToast('Todos los videos han sido eliminados de la playlist', 'success');
        
        // Marcar que hay cambios pendientes
        markAsUnsaved();
        
        // Actualizar videos disponibles
        updateAvailableVideosList();
        
    } catch (error) {
        console.error('❌ Error clearing playlist:', error);
        showToast(`Error al limpiar la playlist: ${error.message}`, 'error');
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
    
    // Actualizar estadísticas
    updatePlaylistStats();
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
    
    // Actualizar título con contador
    const playlistTitle = document.getElementById('playlistTitle');
    if (playlistTitle && currentPlaylistData) {
        const baseTitle = currentPlaylistData.title || 'Playlist sin nombre';
        document.querySelector('h1')?.textContent = `${baseTitle} (${videoCount} videos)`;
    }
}

/**
 * Actualizar lista de videos disponibles
 */
function updateAvailableVideosList() {
    // Actualizar estadísticas
    updatePlaylistStats();
    
    // Actualizar videos disponibles para reflejar los cambios
    const playlistVideoIds = playlistVideos.map(v => parseInt(v.id));
    paginationState.filteredVideos = availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id)));
    paginationState.totalPages = Math.ceil(paginationState.filteredVideos.length / paginationState.pageSize);
    
    // Renderizar videos disponibles nuevamente
    renderAvailableVideos();
}

/**
 * Marcar formulario como modificado
 */
function markAsUnsaved() {
    hasChanges = true;
    
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
        hasChanges = false;
        
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
        const videoUrl = `${getApiUrl()}/videos/${videoId}/stream`;
        
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

/**
 * Previsualiza la playlist completa
 */
function previewPlaylist() {
    if (!playlistVideos || playlistVideos.length === 0) {
        showToast('No hay videos en la playlist para previsualizar', 'warning');
        return;
    }
    
    const modal = document.getElementById('playlistPreviewModal');
    if (!modal) {
        showToast('El modal de vista previa no está disponible', 'error');
        return;
    }
    
    try {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        showToast('Vista previa iniciada', 'success');
    } catch (error) {
        console.error('Error mostrando vista previa:', error);
        showToast('Error al mostrar vista previa', 'error');
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

console.log('✅ Script de playlist detail cargado correctamente (sin Mixed Content)');