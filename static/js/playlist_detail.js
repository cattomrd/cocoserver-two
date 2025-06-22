/**
 * PLAYLIST_DETAIL.JS - Gestor de Detalles de Playlist
 * Versión corregida y unificada
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

// Variables de paginación para la biblioteca de videos
const paginationState = {
    currentPage: 1,
    pageSize: 25,
    totalPages: 1,
    filteredVideos: []
};

// API URL base
const API_URL = window.location.origin + '/api';

// Endpoints estructurados para llamadas a la API
const API_ENDPOINTS = {
    videos: `${API_URL}/videos`,
    playlists: `${API_URL}/playlists`,
    playlistById: (id) => `${API_URL}/playlists/${id}`,
    playlistVideos: (id) => `${API_URL}/playlists/${id}/videos`,
    addVideoToPlaylist: (playlistId, videoId) => `${API_URL}/playlists/${playlistId}/videos/${videoId}`,
    removeVideoFromPlaylist: (playlistId, videoId) => `${API_URL}/playlists/${playlistId}/videos/${videoId}`,
    clearPlaylistVideos: (playlistId) => `${API_URL}/playlists/${playlistId}/videos/clear`,
    updateVideoOrder: (playlistId) => `${API_URL}/playlists/${playlistId}/video-order`,
    updatePlaylist: (id) => `${API_URL}/playlists/${id}`
};

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
    
    // Método 3: Obtener de la variable global
    const idFromGlobal = window.currentPlaylistId || 
                        (window.currentPlaylistData ? window.currentPlaylistData.id : null);
    console.log(`🔹 ID de variable global: ${idFromGlobal}`);
    
    // Método 4: Extraer del path de la URL (en caso de rutas como /playlists/123/detail)
    const pathMatch = window.location.pathname.match(/\/playlists\/(\d+)/);
    const idFromPath = pathMatch ? pathMatch[1] : null;
    console.log(`🔹 ID del path: ${idFromPath}`);
    
    // Usar el primer valor válido que encontremos
    const playlistId = idFromUrl || idFromElement || idFromGlobal || idFromPath;
    
    if (!playlistId) {
        console.error('❌ No se pudo determinar el ID de playlist de ninguna fuente');
        return null;
    }
    
    console.log(`✅ ID de playlist encontrado: ${playlistId}`);
    return playlistId;
}

// ==========================================
// FUNCIONES PRINCIPALES - CARGA DE DATOS
// ==========================================

/**
 * Cargar datos completos de la playlist para edición
 */
async function loadPlaylistData(playlistId) {
    if (!playlistId || isLoading) return;
    
    console.log('🎵 Cargando playlist para editar:', playlistId);
    showLoadingState('Cargando datos de la playlist...');
    
    try {
        // Construir la URL manualmente
        const url = API_ENDPOINTS.playlistById(playlistId);
        console.log(`📡 Fetch: ${url}`);
        
        const response = await fetch(`${url}?include_videos=true`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Error cargando playlist (${response.status}): ${errorText}`);
            throw new Error(`Error al cargar playlist: ${response.status}`);
        }
        
        currentPlaylistData = await response.json();
        console.log(`✅ Playlist cargada:`, currentPlaylistData);
        
        // Guardar videos de la playlist
        if (currentPlaylistData.videos && Array.isArray(currentPlaylistData.videos)) {
            playlistVideos = currentPlaylistData.videos;
            console.log(`✅ Videos de playlist cargados: ${playlistVideos.length}`);
        } else {
            playlistVideos = [];
            console.log(`⚠️ La playlist no tiene videos`);
        }
        
        // Configurar modo de edición
        setupEditMode(currentPlaylistData.title);
        
        // Mostrar videos en la tabla
        updatePlaylistVideosTable();
        
        // Cargar videos disponibles
        loadAvailableVideos();
        
        // Ocultar estado de carga
        hideLoadingState('Playlist cargada correctamente');
        
    } catch (error) {
        console.error('Error loading playlist data:', error);
        hideLoadingState(`Error al cargar la playlist: ${error.message}`, 'error');
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

// ==========================================
// FUNCIONES DE RENDERIZADO Y PAGINACIÓN
// ==========================================

/**
 * Renderiza los videos disponibles con paginación
 */
function renderAvailableVideos() {
    console.log('🎨 Renderizando videos disponibles (con paginación)...');
    
    const availableVideosList = document.getElementById('availableVideosList');
    if (!availableVideosList) {
        console.error('❌ Elemento availableVideosList no encontrado');
        return;
    }

    if (!availableVideos || availableVideos.length === 0) {
        availableVideosList.innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-video-slash text-muted mb-2"></i>
                <p class="small text-muted mb-1">No hay videos disponibles</p>
                <button class="btn btn-sm btn-outline-primary btn-xs" onclick="loadAvailableVideos()">
                    <i class="fas fa-sync me-1"></i> Recargar
                </button>
            </div>
        `;
        updatePaginationControls(0);
        return;
    }

    // Filtrar videos que ya están en la playlist
    const playlistVideoIds = playlistVideos.map(v => parseInt(v.id));
    const videosDisponibles = paginationState.filteredVideos;

    if (videosDisponibles.length === 0) {
        availableVideosList.innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-check-circle text-success mb-2"></i>
                <p class="small text-success mb-1">Todos los videos están en la lista</p>
            </div>
        `;
        updatePaginationControls(0);
        return;
    }

    // Obtener solo los videos de la página actual
    const startIndex = (paginationState.currentPage - 1) * paginationState.pageSize;
    const endIndex = Math.min(startIndex + paginationState.pageSize, videosDisponibles.length);
    const videosEnPagina = videosDisponibles.slice(startIndex, endIndex);
    
    // Generar HTML para cada video de la página actual
    const videosHTML = videosEnPagina.map(video => {
        // Determinar estado del video (reducimos a solo un indicador de color)
        let statusColor = 'bg-success';
        if (!video.is_active) {
            statusColor = 'bg-secondary';
        } else if (video.expiration_date && new Date() > new Date(video.expiration_date)) {
            statusColor = 'bg-danger';
        }

        return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="card border-0 shadow-sm">
                <div class="card-body d-flex align-items-center">
                    <div class="status-indicator me-2" style="width:3px;height:20px;background-color:var(--bs-${statusColor.replace('bg-', '')})"></div>
                    <div class="flex-grow-1 overflow-hidden">
                        <h6 class="video-title">${escapeHtml(video.title)}</h6>
                    </div>
                    <div class="flex-shrink-0 ms-1">
                        <button class="btn btn-primary btn-sm btn-xs p-1" 
                                onclick="addVideoToPlaylist(${video.id})"
                                title="Agregar a la lista">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    availableVideosList.innerHTML = videosHTML;
    
    // Actualizar los controles de paginación
    updatePaginationControls(videosDisponibles.length);
    
    // Actualizar contador
    updateAvailableVideoCount(videosDisponibles.length);
}

/**
 * Actualiza los controles de paginación
 */
function updatePaginationControls(totalItems) {
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageIndicator = document.getElementById('pageIndicator');
    
    // Calcular número total de páginas
    paginationState.totalPages = Math.max(1, Math.ceil(totalItems / paginationState.pageSize));
    
    // Actualizar textos
    if (currentPageEl) currentPageEl.textContent = paginationState.currentPage;
    if (totalPagesEl) totalPagesEl.textContent = paginationState.totalPages;
    if (pageIndicator) pageIndicator.textContent = paginationState.currentPage;
    
    // Habilitar/deshabilitar botones
    if (prevPageBtn) prevPageBtn.disabled = paginationState.currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = paginationState.currentPage >= paginationState.totalPages;
    
    // Si no hay elementos o solo hay una página, ocultar controles de paginación
    const paginationContainer = document.querySelector('.pagination-container');
    if (paginationContainer) {
        paginationContainer.style.display = totalItems > 0 && paginationState.totalPages > 1 ? 'block' : 'none';
    }
}

/**
 * Cambia a la página anterior
 */
function goToPrevPage() {
    if (paginationState.currentPage > 1) {
        paginationState.currentPage--;
        renderAvailableVideos();
    }
}

/**
 * Cambia a la página siguiente
 */
function goToNextPage() {
    if (paginationState.currentPage < paginationState.totalPages) {
        paginationState.currentPage++;
        renderAvailableVideos();
    }
}

/**
 * Cambia el tamaño de página
 */
function changePageSize(newSize) {
    paginationState.pageSize = parseInt(newSize);
    paginationState.currentPage = 1; // Volver a la primera página
    renderAvailableVideos();
}

/**
 * Renderiza los videos filtrados según el término de búsqueda
 */
function filterAvailableVideos(searchTerm) {
    console.log(`🔍 Filtrando videos por: "${searchTerm}"`);
    
    // Si no hay videos disponibles, no hacer nada
    if (!availableVideos || availableVideos.length === 0) {
        return;
    }

    // Obtener todos los videos que no están en la playlist actual
    const playlistVideoIds = playlistVideos.map(v => parseInt(v.id));
    let videosDisponibles = availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id)));
    
    // Si hay un término de búsqueda, filtrar por título, descripción y nombre de archivo
    if (searchTerm && searchTerm.trim() !== '') {
        searchTerm = searchTerm.toLowerCase().trim();
        
        videosDisponibles = videosDisponibles.filter(video => {
            const title = (video.title || '').toLowerCase();
            const description = (video.description || '').toLowerCase();
            const filename = (video.filename || '').toLowerCase();
            
            return title.includes(searchTerm) || 
                   description.includes(searchTerm) || 
                   filename.includes(searchTerm);
        });
        
        console.log(`🔍 Resultados de búsqueda: ${videosDisponibles.length} videos encontrados`);
    }

    // Actualizar estado de paginación
    paginationState.filteredVideos = videosDisponibles;
    paginationState.totalPages = Math.ceil(videosDisponibles.length / paginationState.pageSize);
    paginationState.currentPage = 1; // Volver a la primera página al filtrar
    
    // Si no hay resultados, mostrar mensaje
    if (videosDisponibles.length === 0) {
        const availableVideosList = document.getElementById('availableVideosList');
        if (availableVideosList) {
            availableVideosList.innerHTML = `
                <div class="text-center py-3">
                    <i class="fas fa-search text-muted mb-2"></i>
                    <p class="small text-muted mb-1">No se encontraron videos${searchTerm ? ` con "${searchTerm}"` : ''}</p>
                    <button class="btn btn-sm btn-outline-secondary btn-xs" onclick="clearVideoSearch()">
                        <i class="fas fa-times me-1"></i> Limpiar
                    </button>
                </div>
            `;
        }
        updatePaginationControls(0);
        return;
    }
    
    // Actualizar contador con información de filtro si es necesario
    const countElement = document.getElementById('availableVideoCount');
    if (countElement) {
        if (searchTerm && searchTerm.trim() !== '') {
            const totalVideos = availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id))).length;
            countElement.innerHTML = `${videosDisponibles.length}/${totalVideos}`;
            
            // Agregar clase para mostrar que hay un filtro activo
            const searchInput = document.getElementById('videoSearch');
            if (searchInput) {
                searchInput.classList.add('active-filter');
            }
        } else {
            countElement.textContent = `${videosDisponibles.length} videos`;
            
            // Quitar clase de filtro activo
            const searchInput = document.getElementById('videoSearch');
            if (searchInput) {
                searchInput.classList.remove('active-filter');
            }
        }
    }
    
    // Renderizar los resultados
    renderAvailableVideos();
}

/**
 * Limpia la búsqueda y muestra todos los videos disponibles
 */
function clearVideoSearch() {
    const searchInput = document.getElementById('videoSearch');
    if (searchInput) {
        searchInput.value = '';
        searchInput.classList.remove('active-filter');
        
        // Restablecer la paginación
        paginationState.currentPage = 1;
        
        // Cargar todos los videos disponibles
        const playlistVideoIds = playlistVideos.map(v => parseInt(v.id));
        paginationState.filteredVideos = availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id)));
        
        filterAvailableVideos('');
    }
}

/**
 * Configurar event listeners para la paginación
 */
function setupPaginationEventListeners() {
    // Botones de paginación
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageSizeSelector = document.getElementById('pageSizeSelector');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', goToPrevPage);
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', goToNextPage);
    }
    
    if (pageSizeSelector) {
        pageSizeSelector.addEventListener('change', function() {
            changePageSize(this.value);
        });
    }
}

/**
 * Renderizar videos de la playlist
 */
function updatePlaylistVideosTable() {
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

    // Versión compacta
    const videosHTML = sortedVideos.map((video, index) => {
        const order = video.order || (index + 1);
        const duration = formatDuration(video.duration || 0);
        const status = getVideoStatus(video);

        return `
        <div class="playlist-video-item mb-1" data-video-id="${video.id}" data-order="${order}">
            <div class="card border-0 shadow-sm">
                <div class="card-body p-2">
                    <div class="row align-items-center">
                        <div class="col-auto">
                            <div class="d-flex align-items-center">
                                <div class="drag-handle me-2" title="Arrastrar para reordenar">
                                    <i class="fas fa-grip-vertical text-muted"></i>
                                </div>
                                <span class="badge bg-primary order-badge">${order}</span>
                            </div>
                        </div>
                        <div class="col">
                            <h6 class="mb-0 fw-bold">${escapeHtml(video.title)}</h6>
                            <div class="d-flex align-items-center">
                                <span class="badge ${status.class} me-2">${status.text}</span>
                                <small class="text-muted">${duration}</small>
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
    
    // Actualizar estadísticas
    updatePlaylistStats();
    
    // Actualizar videos disponibles para reflejar los cambios
    const playlistVideoIds = playlistVideos.map(v => parseInt(v.id));
    paginationState.filteredVideos = availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id)));
    paginationState.totalPages = Math.ceil(paginationState.filteredVideos.length / paginationState.pageSize);
    
    // Renderizar videos disponibles nuevamente
    renderAvailableVideos();
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
            throw new Error('Error al añadir video');
        }
        
        const result = await response.json();
        console.log(`✅ Video añadido con éxito:`, result);
        
        // Buscar el video en la lista de videos disponibles
        const video = availableVideos.find(v => v.id === videoId);
        if (video) {
            // Añadir el orden desde la respuesta si está disponible
            const videoWithOrder = {
                ...video,
                order: result.order || playlistVideos.length + 1
            };
            
            // Añadir a la lista de videos de la playlist
            playlistVideos.push(videoWithOrder);
            
            // Actualizar la interfaz
            updatePlaylistVideosTable();
            showToast(`Video "${video.title}" añadido a la lista`, 'success');
            
            // Marcar que hay cambios pendientes
            hasChanges = true;
        } else {
            // Si no encontramos el video en la lista disponible, recargar datos
            await loadPlaylistData(playlistId);
            showToast(`Video añadido a la lista`, 'success');
        }
        
    } catch (error) {
        console.error('Error adding video:', error);
        showToast(`Error al añadir video: ${error.message}`, 'error');
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
        
        console.log(`🎬 Eliminando video ${videoId} de playlist ${playlistId}`);
        
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
            throw new Error('Failed to remove video');
        }
        
        // Eliminar el video de la lista
        playlistVideos = playlistVideos.filter(video => video.id !== videoId);
        
        // Actualizar la interfaz
        updatePlaylistVideosTable();
        showToast('Video eliminado de la lista', 'success');
        
        // Marcar que hay cambios pendientes
        hasChanges = true;
        
    } catch (error) {
        console.error('Error removing video:', error);
        showToast(`Error al eliminar video: ${error.message}`, 'error');
    }
}

/**
 * Eliminar todos los videos de la playlist
 */
async function clearPlaylist() {
    try {
        if (!confirm('¿Estás seguro de que deseas eliminar todos los videos de esta lista?')) {
            return;
        }
        
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
        updatePlaylistVideosTable();
        showToast('Todos los videos han sido eliminados de la lista', 'success');
        
        // Marcar que hay cambios pendientes
        hasChanges = true;
        
    } catch (error) {
        console.error('Error clearing playlist:', error);
        showToast(`Error al limpiar la lista: ${error.message}`, 'error');
    }
}

/**
 * Actualizar el orden de los videos
 */
async function updateVideoOrder(videoId, newOrder) {
    try {
        // Obtener el ID de la playlist
        const playlistId = getPlaylistId();
        
        if (!playlistId) {
            throw new Error('No se pudo determinar el ID de la playlist');
        }
        
        console.log(`🎬 Actualizando orden de video ${videoId} a ${newOrder} en playlist ${playlistId}`);
        
        // Construir la URL correcta
        const url = API_ENDPOINTS.updateVideoOrder(playlistId);
        console.log(`📡 URL de la API: ${url}`);
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videos: [
                    { video_id: videoId, order: newOrder }
                ]
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Error de API (${response.status}): ${errorText}`);
            throw new Error('Failed to update video order');
        }
        
        // Actualizar el orden en la lista local
        const video = playlistVideos.find(v => v.id === videoId);
        if (video) {
            video.order = newOrder;
        }
        
        // Ordenar la lista por el nuevo orden
        playlistVideos.sort((a, b) => a.order - b.order);
        
        // Actualizar la interfaz
        updatePlaylistVideosTable();
        
        // Marcar que hay cambios pendientes
        hasChanges = true;
        
    } catch (error) {
        console.error('Error updating video order:', error);
        showToast(`Error al actualizar el orden: ${error.message}`, 'error');
    }
}

/**
 * Actualiza el orden de múltiples videos a la vez
 */
async function updateVideoOrderBatch(updates) {
    try {
        const playlistId = getPlaylistId();
        if (!playlistId) {
            throw new Error('No se pudo determinar el ID de la playlist');
        }
        
        console.log(`🎬 Actualizando orden de ${updates.length} videos`);
        
        const url = `${API_URL}/playlists/${playlistId}/video-order`;
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videos: updates
            })
        });
        
        if (!response.ok) {
            throw new Error('Error al actualizar el orden');
        }
        
        // Actualizar los datos locales
        updates.forEach(update => {
            const video = playlistVideos.find(v => v.id === update.video_id);
            if (video) {
                video.order = update.order;
            }
        });
        
        // Ordenar la lista
        playlistVideos.sort((a, b) => a.order - b.order);
        
        showToast('Orden actualizado', 'success');
        
    } catch (error) {
        console.error('Error updating video order:', error);
        showToast('Error al actualizar el orden', 'error');
    }
}

/**
 * Guardar cambios en la playlist
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
        
        const form = document.getElementById('playlistForm');
        if (!form) {
            throw new Error('Formulario de playlist no encontrado');
        }
        
        const titleInput = document.getElementById('playlistTitle');
        const descInput = document.getElementById('playlistDescription');
        const statusSelect = document.getElementById('playlistStatus');
        const startDateInput = document.getElementById('playlistStartDate');
        const expDateInput = document.getElementById('playlistExpDate');
        
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
// FUNCIONES DE INTERFAZ Y UTILIDADES
// ==========================================

/**
 * Configurar modo de edición
 */
function setupEditMode(playlistTitle) {
    console.log(`⚙️ Configurando modo edición para: ${playlistTitle}`);
    
    // Actualizar título de la página
    document.title = `Editando: ${playlistTitle}`;
    
    // Buscar el formulario por su ID
    const playlistForm = document.getElementById('playlistForm');
    
    if (!playlistForm) {
        console.error(' ❌ Formulario de playlist no encontrado');
        
        // Alternativa: Crear el formulario dinámicamente si no existe
        createPlaylistFormDynamic();
        return;
    }
    
    // Si el formulario existe, rellenarlo con los datos de la playlist
    fillPlaylistForm();
}

/**
 * Crear formulario de playlist dinámicamente
 */
function createPlaylistFormDynamic() {
    console.log('🔄 Creando formulario de playlist dinámicamente');
    
    // Buscar el contenedor donde se insertará el formulario
    const formContainer = document.querySelector('.playlist-form-container') || 
                          document.querySelector('.card-body') ||
                          document.querySelector('#playlistDetailContent');
    
    if (!formContainer) {
        console.error('❌ No se encontró un contenedor adecuado para el formulario');
        showToast('Error: No se pudo crear el formulario de edición', 'error');
        return;
    }
    
    // Crear el formulario HTML
    const formHTML = `
        <form id="playlistForm" class="needs-validation">
            <div class="row g-3 mb-3">
                <div class="col-md-6">
                    <label for="playlistTitle" class="form-label">Título de la lista</label>
                    <input type="text" class="form-control" id="playlistTitle" required>
                </div>
                <div class="col-md-6">
                    <label for="playlistStatus" class="form-label">Estado</label>
                    <select class="form-select" id="playlistStatus">
                        <option value="true">Activa</option>
                        <option value="false">Inactiva</option>
                    </select>
                </div>
            </div>
            
            <div class="mb-3">
                <label for="playlistDescription" class="form-label">Descripción</label>
                <textarea class="form-control" id="playlistDescription" rows="2"></textarea>
            </div>
            
            <div class="row g-3 mb-3">
                <div class="col-md-6">
                    <label for="playlistStartDate" class="form-label">Fecha de inicio (opcional)</label>
                    <input type="datetime-local" class="form-control" id="playlistStartDate">
                </div>
                <div class="col-md-6">
                    <label for="playlistExpDate" class="form-label">Fecha de expiración (opcional)</label>
                    <input type="datetime-local" class="form-control" id="playlistExpDate">
                </div>
            </div>
            
            <div class="d-flex justify-content-end mt-3">
                <button type="button" class="btn btn-secondary me-2" onclick="resetChanges()">
                    <i class="fas fa-undo"></i> Descartar cambios
                </button>
                <button type="button" class="btn btn-primary" onclick="savePlaylistChanges()">
                    <i class="fas fa-save"></i> Guardar cambios
                </button>
            </div>
        </form>
    `;
    
    // Insertar el formulario al principio del contenedor
    formContainer.insertAdjacentHTML('afterbegin', formHTML);
    
    // Ahora que el formulario existe, intentar rellenarlo
    fillPlaylistForm();
}

/**
 * Rellenar el formulario con los datos de la playlist
 */
function fillPlaylistForm() {
    // Solo proceder si tenemos datos de playlist
    if (!currentPlaylistData) {
        console.error('❌ No hay datos de playlist para rellenar el formulario');
        return;
    }
    
    // Buscar el formulario por su ID (que ahora debería existir)
    const playlistForm = document.getElementById('playlistForm');
    
    if (!playlistForm) {
        console.error('❌ Formulario de playlist no encontrado después de la creación dinámica');
        return;
    }
    
    console.log('✅ Rellenando formulario con datos de la playlist');
    
    // Rellenar campos de texto
    const titleInput = document.getElementById('playlistTitle');
    const descInput = document.getElementById('playlistDescription');
    const statusSelect = document.getElementById('playlistStatus');
    const startDateInput = document.getElementById('playlistStartDate');
    const expDateInput = document.getElementById('playlistExpDate');
    
    // Verificar que los elementos existen antes de asignar valores
    if (titleInput) titleInput.value = currentPlaylistData.title || '';
    if (descInput) descInput.value = currentPlaylistData.description || '';
    if (statusSelect) statusSelect.value = currentPlaylistData.is_active.toString();
    
    // Formatear y asignar fechas si existen
    if (startDateInput && currentPlaylistData.start_date) {
        startDateInput.value = formatDateForInput(currentPlaylistData.start_date);
    }
    
    if (expDateInput && currentPlaylistData.expiration_date) {
        expDateInput.value = formatDateForInput(currentPlaylistData.expiration_date);
    }
    
    console.log('✅ Formulario rellenado correctamente');
}

/**
 * Restablecer cambios
 */
function resetChanges() {
    console.log('🔄 Restableciendo cambios...');
    
    // Recargar datos originales de la playlist
    if (currentPlaylistData && currentPlaylistData.id) {
        loadPlaylistData(currentPlaylistData.id);
    }
    
    // Restablecer interfaz
    hasChanges = false;
    
    showToast('Cambios descartados', 'info');
}

/**
 * Actualizar título de la página
 */
function updatePageTitle() {
    const titleElement = document.getElementById('pageTitle');
    if (titleElement && currentPlaylistData) {
        titleElement.textContent = `Editar Lista: ${currentPlaylistData.title}`;
    }
    
    // Actualizar también el título del documento
    if (currentPlaylistData) {
        document.title = `Editando: ${currentPlaylistData.title}`;
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
    const emptyStatsMessage = document.getElementById('emptyStatsMessage');
    
    if (statsSection) {
        statsSection.style.display = playlistVideos.length > 0 ? 'block' : 'none';
    }
    
    if (emptyStatsMessage) {
        emptyStatsMessage.style.display = playlistVideos.length > 0 ? 'none' : 'block';
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
 * Manejar imágenes faltantes
 */
function fixMissingImages() {
    // Placeholder SVG para imágenes faltantes
    const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmaWxsPSIjOTk5OTk5Ij5ObyBUaHVtYm5haWw8L3RleHQ+PHBhdGggZD0ibTEzNSw5MCBhMTUsMTUgMCAxLDEgNTAsMCBhMTUsMTUgMCAxLDEgLTUwLDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzk5OTk5OSIgc3Ryb2tlLXdpZHRoPSI1Ii8+PHBhdGggZD0ibTE0MiwxMDUgbDM2LC0zMCIgc3Ryb2tlPSIjOTk5OTk5IiBzdHJva2Utd2lkdGg9IjUiLz48L3N2Zz4=';
    
    // Configurar todas las imágenes con default-video.jpg para usar el placeholder
    document.querySelectorAll('img[src*="default-video.jpg"]').forEach(img => {
        img.src = placeholderImage;
    });
    
    // Configurar manejador de error para todas las imágenes
    document.querySelectorAll('img').forEach(img => {
        if (!img.hasAttribute('data-error-handled')) {
            img.setAttribute('data-error-handled', 'true');
            img.onerror = function() {
                this.onerror = null; // Prevenir bucle infinito
                this.src = placeholderImage;
            };
        }
    });
}

/**
 * Mostrar estado de carga
 */
function showLoadingState(message) {
    console.log('📢 INFO:', message);
    const loadingElement = document.getElementById('loadingIndicator');
    if (loadingElement) {
        loadingElement.innerHTML = `
            <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <span>${message}</span>
        `;
        loadingElement.classList.remove('d-none');
    }
    isLoading = true;
}

/**
 * Ocultar estado de carga
 */
function hideLoadingState(message, type = 'success') {
    console.log(`📢 ${type.toUpperCase()}:`, message);
    const loadingElement = document.getElementById('loadingIndicator');
    if (loadingElement) {
        loadingElement.classList.add('d-none');
    }
    isLoading = false;
    
    if (message) {
        showToast(message, type);
    }
}

/**
 * Establecer estado de carga
 */
function setLoadingState(loading) {
    isLoading = loading;
    
    // Deshabilitar botones durante la carga
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.disabled = loading;
    });
}

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
function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    // Convertir a objeto Date
    const date = new Date(dateString);
    
    // Verificar que es una fecha válida
    if (isNaN(date.getTime())) return '';
    
    // Formatear como YYYY-MM-DDTHH:MM (formato requerido por datetime-local)
    return date.toISOString().slice(0, 16);
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
    console.log('📢 ERROR: Ha ocurrido un error inesperado');
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

/**
 * Aplicar estilos para la versión compacta
 */
function applyStyles() {
    // Crear elemento de estilo
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Estilos para la versión compacta */
        .video-card, .playlist-video-item {
            transition: all 0.2s ease;
        }
        
        .video-card:hover, .playlist-video-item:hover {
            transform: translateX(5px);
            background-color: rgba(0, 123, 255, 0.05);
        }
        
        /* Estilos para resaltar búsquedas */
        .highlight-search {
            background-color: rgba(255, 193, 7, 0.3);
            font-weight: bold;
        }
        
        /* Indicador de filtro activo */
        #videoSearch.active-filter {
            background-color: #fff8e1;
            border-color: #ffc107;
        }
        
        /* Botones más compactos */
        .btn-xs {
            padding: 0.15rem 0.4rem;
            font-size: 0.75rem;
            line-height: 1.2;
        }
    `;
    
    // Añadir al head del documento
    document.head.appendChild(styleElement);
    
    console.log('✅ Estilos aplicados');
}

// ==========================================
// FUNCIONES ADICIONALES
// ==========================================

/**
 * Vista previa de video
 */
function previewVideo(videoId) {
    console.log('▶️ Vista previa de video:', videoId);
    
    const video = [...availableVideos, ...playlistVideos].find(v => v.id === videoId);
    if (!video || !video.file_path) {
        showToast('No se puede previsualizar este video', 'error');
        return;
    }
    
    const modal = document.getElementById('videoPreviewModal');
    const modalTitle = document.getElementById('videoPreviewModalTitle');
    const videoPlayer = document.getElementById('previewVideoPlayer');
    
    if (modal && videoPlayer) {
        // Actualizar título
        if (modalTitle) {
            modalTitle.textContent = `Vista Previa: ${video.title || 'Video'}`;
        }
        
        // Actualizar fuente del video
        const videoUrl = video.file_path.startsWith('http') ? 
            video.file_path : `/api/videos/${videoId}/stream`;
        
        videoPlayer.src = videoUrl;
        videoPlayer.load();
        
        // Mostrar modal
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Reproducir automáticamente
        videoPlayer.play().catch(e => console.log('Reproducción automática bloqueada por el navegador'));
    } else {
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

// ==========================================
// CONFIGURACIÓN DE EVENT LISTENERS
// ==========================================

/**
 * Configurar todos los event listeners necesarios
 */
function setupEventListeners() {
    console.log('⚙️ Configurando event listeners...');
    
    // Búsqueda de videos
    const searchInput = document.getElementById('videoSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function(e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterAvailableVideos(searchTerm);
        }, 300));
    }
    
    // Botón para limpiar búsqueda
    const clearSearchBtn = document.getElementById('clearVideoSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearVideoSearch);
    }
    
    // Paginación
    setupPaginationEventListeners();
    
    // Formulario
    const form = document.getElementById('playlistForm');
    if (form) {
        form.addEventListener('change', function() {
            hasChanges = true;
        });
    }
    
    // Advertir al salir con cambios sin guardar
    window.addEventListener('beforeunload', function(e) {
        if (hasChanges) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    });
    
    console.log('✅ Event listeners configurados');
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
// INICIALIZACIÓN
// ==========================================

/**
 * Inicializar editor de playlist
 */
function initializePlaylistEditor() {
    console.log('🎵 Inicializando Editor de Playlist...');
    
    try {
        // Verificar si hay un ID de playlist en la URL y configurarlo
        setupPlaylistIdElement();
        
        // Aplicar estilos
        applyStyles();
        
        // Configurar manejo de imágenes faltantes
        fixMissingImages();
        
        // Configurar event listeners
        setupEventListeners();
        
        // PRIMERO: Verificar si hay datos de playlist desde el template
        if (currentPlaylistData && currentPlaylistData.id) {
            console.log('📋 Usando datos del template para playlist:', currentPlaylistData.id);
            
            // Configurar interfaz con datos existentes
            setupEditMode(currentPlaylistData.title);
            updatePlaylistVideosTable();
            
            // Luego cargar videos disponibles
            loadAvailableVideos();
            
        } else {
            // SEGUNDO: Intentar detectar ID desde URL si no hay datos del template
            const playlistId = getPlaylistId();
            
            if (playlistId) {
                console.log('🔄 No hay datos del template, cargando desde API - Playlist ID:', playlistId);
                loadPlaylistData(playlistId);
            } else {
                console.log('🆕 Modo nueva playlist');
                // Solo cargar videos disponibles para nueva playlist
                loadAvailableVideos();
            }
        }
        
    } catch (error) {
        console.error('❌ Error inicializando editor:', error);
        showToast('Error al inicializar el editor: ' + error.message, 'error');
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializePlaylistEditor);

console.log('✅ Editor de Playlist cargado correctamente');