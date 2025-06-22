/**
 * PLAYLIST_DETAIL.JS - Gestor de Detalles de Playlist
 * Versión corregida con todas las soluciones implementadas
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

function filterAvailableVideos(searchTerm) {
    console.log(`🔍 Filtrando videos por: "${searchTerm}"`);
    
    const availableVideosList = document.getElementById('availableVideosList');
    if (!availableVideosList) {
        console.error('❌ Elemento availableVideosList no encontrado');
        return;
    }

    // Si no hay videos disponibles, no hacer nada
    if (!availableVideos || availableVideos.length === 0) {
        return;
    }

    // Obtener todos los videos que no están en la playlist actual
    const playlistVideoIds = playlistVideos.map(v => parseInt(v.id));
    let videosDisponibles = availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id)));
    
    // Si hay un término de búsqueda, filtrar por título y descripción
    if (searchTerm && searchTerm.trim() !== '') {
        searchTerm = searchTerm.toLowerCase().trim();
        
        // Filtrar videos que contienen el término de búsqueda en el título o descripción
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

    // Si no hay resultados, mostrar mensaje
    if (videosDisponibles.length === 0) {
        availableVideosList.innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-search text-muted mb-2"></i>
                <p class="small text-muted mb-1">No se encontraron videos con "${searchTerm}"</p>
                <button class="btn btn-sm btn-outline-secondary btn-xs" onclick="clearVideoSearch()">
                    <i class="fas fa-times me-1"></i> Limpiar
                </button>
            </div>
        `;
        return;
    }

    // Generar HTML para cada video disponible - VERSIÓN SUPER COMPACTA
    const videosHTML = videosDisponibles.map(video => {
        const duration = formatDuration(video.duration || 0);
        
        // Determinar estado del video (reducimos a solo un indicador de color)
        let statusColor = 'bg-success';
        if (!video.is_active) {
            statusColor = 'bg-secondary';
        } else if (video.expiration_date && new Date() > new Date(video.expiration_date)) {
            statusColor = 'bg-danger';
        }

        // Si hay búsqueda activa, resaltar las coincidencias en el título
        let title = escapeHtml(video.title);
        if (searchTerm && searchTerm.trim() !== '') {
            // Resaltar coincidencia (solo para visualización, no afecta la funcionalidad)
            const regex = new RegExp('(' + escapeHtml(searchTerm) + ')', 'gi');
            title = title.replace(regex, '<span class="highlight-search">$1</span>');
        }

        return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="card border-0 shadow-sm">
                <div class="card-body d-flex align-items-center">
                    <div class="status-indicator me-2" style="width:3px;height:20px;background-color:var(--bs-${statusColor.replace('bg-', '')})"></div>
                    <div class="flex-grow-1 overflow-hidden">
                        <h6 class="video-title">${title}</h6>
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
    
    // Actualizar contador con filtro aplicado si hay búsqueda
    if (searchTerm && searchTerm.trim() !== '') {
        const countElement = document.getElementById('availableVideoCount');
        if (countElement) {
            countElement.innerHTML = `${videosDisponibles.length}/${availableVideos.length - playlistVideoIds.length}`;
        }
        
        // Agregar clase para mostrar que hay un filtro activo
        const searchInput = document.getElementById('videoSearch');
        if (searchInput) {
            searchInput.classList.add('active-filter');
        }
    } else {
        // Actualizar contador normal
        updateAvailableVideoCount(videosDisponibles.length);
        
        // Quitar clase de filtro activo
        const searchInput = document.getElementById('videoSearch');
        if (searchInput) {
            searchInput.classList.remove('active-filter');
        }
    }
}

/**
 * Estilos adicionales para el formato compacto y la búsqueda
 */
function applyCompactStyles() {
    // Crear elemento de estilo
    const styleElement = document.createElement('style');
    styleElement.textContent = `
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
        
        /* Animación de carga más sutil */
        .spinner-border-sm {
            width: 1rem;
            height: 1rem;
            border-width: 0.15em;
        }
        
        /* Virtual scrolling para muchos elementos */
        #availableVideosList {
            contain: strict;
        }
        
        /* Botones más compactos */
        .btn-xs {
            padding: 0.15rem 0.4rem;
            font-size: 0.75rem;
            line-height: 1.2;
        }
        
        /* Tarjetas de video más eficientes */
        .video-card .card-body {
            padding: 0.35rem 0.5rem;
        }
        
        /* Mostrar la barra de desplazamiento solo al hacer hover */
        #availableVideosContainer::-webkit-scrollbar {
            width: 5px;
        }
        
        #availableVideosContainer::-webkit-scrollbar-thumb {
            background-color: rgba(0,0,0,0.2);
            border-radius: 5px;
        }
        
        #availableVideosContainer::-webkit-scrollbar-track {
            background-color: transparent;
        }
        
        #availableVideosContainer {
            scrollbar-width: thin;
            scrollbar-color: rgba(0,0,0,0.2) transparent;
        }
    `;
    
    // Añadir al head del documento
    document.head.appendChild(styleElement);
    
    console.log('✅ Estilos compactos aplicados');
}

/**
 * Inicialización optimizada 
 * Agregar esto a la función existente de inicialización
 */
document.addEventListener('DOMContentLoaded', function() {
    // Aplicar estilos compactos
    applyCompactStyles();
    
    // Resto del código de inicialización...
});
/**
 * Función para limpiar la búsqueda de videos
 */
function clearVideoSearch() {
    const searchInput = document.getElementById('videoSearch');
    if (searchInput) {
        searchInput.value = '';
        // Disparar un evento input para activar el filtrado
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
    }
    
    // Mostrar todos los videos disponibles
    filterAvailableVideos('');
}

function setupSearchEventListeners() {
    // Búsqueda de videos
    const searchInput = document.getElementById('videoSearch');
    if (searchInput) {
        // Eliminar event listeners anteriores (por si acaso)
        searchInput.removeEventListener('input', handleSearchInput);
        
        // Agregar nuevo event listener con debounce
        searchInput.addEventListener('input', debounce(function(e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterAvailableVideos(searchTerm);
        }, 300));
    }
    
    // Botón para limpiar búsqueda
    const clearSearchBtn = document.getElementById('clearVideoSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.removeEventListener('click', clearVideoSearch);
        clearSearchBtn.addEventListener('click', clearVideoSearch);
    }
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

/**
 * Función para manejar la entrada de búsqueda (referencia para removeEventListener)
 */
function handleSearchInput(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    filterAvailableVideos(searchTerm);
}

/**
 * Estilos adicionales para la búsqueda
 */
function applySearchStyles() {
    // Añadir estilos para la búsqueda
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Estilos para la búsqueda */
        .video-search-container {
            position: relative;
            margin-bottom: 1rem;
        }
        
        .video-search-container.has-filter .form-control {
            background-color: #fff3cd;
            border-color: #ffc107;
        }
        
        .video-search-container .form-control:focus {
            box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
        }
        
        .video-search-container.has-filter .form-control:focus {
            box-shadow: 0 0 0 0.25rem rgba(255, 193, 7, 0.25);
        }
        
        #clearVideoSearchBtn {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: #6c757d;
            cursor: pointer;
            z-index: 10;
        }
        
        #clearVideoSearchBtn:hover {
            color: #dc3545;
        }
        
        /* Animación para resultados de búsqueda */
        @keyframes highlightResult {
            0% { transform: translateX(0); }
            5% { transform: translateX(5px); }
            10% { transform: translateX(0); }
        }
        
        .video-search-container.has-filter + #availableVideosList .video-card {
            animation: highlightResult 2s ease;
            border-left: 3px solid #ffc107;
        }
    `;
    
    // Añadir al head del documento
    document.head.appendChild(styleElement);
}

/**
 * Actualizar la inicialización para incluir la configuración de búsqueda
 * Añadir esto a la función de inicialización existente
 */
document.addEventListener('DOMContentLoaded', function() {
    // Aplicar estilos para la búsqueda
    applySearchStyles();
    
    // Configurar event listeners para la búsqueda
    setupSearchEventListeners();
    
    // Resto del código de inicialización...
});

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
    console.log('🎨 Renderizando videos disponibles (versión compacta)...');
    
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
        return;
    }

    // Filtrar videos que ya están en la playlist
    const playlistVideoIds = playlistVideos.map(v => parseInt(v.id));
    const videosDisponibles = availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id)));

    if (videosDisponibles.length === 0) {
        availableVideosList.innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-check-circle text-success mb-2"></i>
                <p class="small text-success mb-1">Todos los videos están en la lista</p>
            </div>
        `;
        return;
    }

    // Generar HTML para cada video disponible - VERSIÓN SUPER COMPACTA
    const videosHTML = videosDisponibles.map(video => {
        const duration = formatDuration(video.duration || 0);
        
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
    
    // Actualizar contador
    updateAvailableVideoCount(videosDisponibles.length);
}

/**
 * Función de filtrado mejorada para la vista compacta
 */
function filterAvailableVideos(searchTerm) {
    console.log(`🔍 Filtrando videos por: "${searchTerm}"`);
    
    const availableVideosList = document.getElementById('availableVideosList');
    if (!availableVideosList) {
        console.error('❌ Elemento availableVideosList no encontrado');
        return;
    }

    // Si no hay videos disponibles, no hacer nada
    if (!availableVideos || availableVideos.length === 0) {
        return;
    }

    // Obtener todos los videos que no están en la playlist actual
    const playlistVideoIds = playlistVideos.map(v => parseInt(v.id));
    let videosDisponibles = availableVideos.filter(v => !playlistVideoIds.includes(parseInt(v.id)));
    
    // Si hay un término de búsqueda, filtrar por título y descripción
    if (searchTerm && searchTerm.trim() !== '') {
        searchTerm = searchTerm.toLowerCase().trim();
        
        // Filtrar videos que contienen el término de búsqueda en el título o descripción
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

    // Si no hay resultados, mostrar mensaje
    if (videosDisponibles.length === 0) {
        availableVideosList.innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-search text-muted mb-2"></i>
                <p class="small text-muted mb-1">No se encontraron videos con "${searchTerm}"</p>
                <button class="btn btn-sm btn-outline-secondary btn-xs" onclick="clearVideoSearch()">
                    <i class="fas fa-times me-1"></i> Limpiar
                </button>
            </div>
        `;
        return;
    }

    // Generar HTML para cada video disponible - VERSIÓN SUPER COMPACTA
    const videosHTML = videosDisponibles.map(video => {
        const duration = formatDuration(video.duration || 0);
        
        // Determinar estado del video (reducimos a solo un indicador de color)
        let statusColor = 'bg-success';
        if (!video.is_active) {
            statusColor = 'bg-secondary';
        } else if (video.expiration_date && new Date() > new Date(video.expiration_date)) {
            statusColor = 'bg-danger';
        }

        // Si hay búsqueda activa, resaltar las coincidencias en el título
        let title = escapeHtml(video.title);
        if (searchTerm && searchTerm.trim() !== '') {
            // Resaltar coincidencia (solo para visualización, no afecta la funcionalidad)
            const regex = new RegExp('(' + escapeHtml(searchTerm) + ')', 'gi');
            title = title.replace(regex, '<span class="highlight-search">$1</span>');
        }

        return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="card border-0 shadow-sm">
                <div class="card-body d-flex align-items-center">
                    <div class="status-indicator me-2" style="width:3px;height:20px;background-color:var(--bs-${statusColor.replace('bg-', '')})"></div>
                    <div class="flex-grow-1 overflow-hidden">
                        <h6 class="video-title">${title}</h6>
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
    
    // Actualizar contador con filtro aplicado si hay búsqueda
    if (searchTerm && searchTerm.trim() !== '') {
        const countElement = document.getElementById('availableVideoCount');
        if (countElement) {
            countElement.innerHTML = `${videosDisponibles.length}/${availableVideos.length - playlistVideoIds.length}`;
        }
        
        // Agregar clase para mostrar que hay un filtro activo
        const searchInput = document.getElementById('videoSearch');
        if (searchInput) {
            searchInput.classList.add('active-filter');
        }
    } else {
        // Actualizar contador normal
        updateAvailableVideoCount(videosDisponibles.length);
        
        // Quitar clase de filtro activo
        const searchInput = document.getElementById('videoSearch');
        if (searchInput) {
            searchInput.classList.remove('active-filter');
        }
    }
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

    // Generar HTML para cada video disponible - VERSIÓN SIMPLIFICADA
    const videosHTML = videosDisponibles.map(video => {
        const duration = formatDuration(video.duration || 0);
        const status = getVideoStatus(video);

        return `
        <div class="video-card mb-1" data-video-id="${video.id}">
            <div class="card border-0 shadow-sm video-item-hover">
                <div class="card-body p-2">
                    <div class="row align-items-center">
                        <div class="col">
                            <h6 class="mb-0 fw-bold video-title">${escapeHtml(video.title)}</h6>
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
function updatePlaylistVideosTable() {
    console.log('🎬 Renderizando videos de la playlist (versión simplificada):', playlistVideos.length);
    
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

    // VERSIÓN SIMPLIFICADA - Solo nombres de videos
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
}

/**
 * Aplicar estilos CSS adicionales para la versión simplificada
 * Esta función se debe llamar cuando el DOM esté listo
 */
function applySimplifiedStyles() {
    // Crear elemento de estilo
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Estilos para la versión simplificada */
        .video-card, .playlist-video-item {
            transition: all 0.2s ease;
        }
        
        .video-card:hover, .playlist-video-item:hover {
            transform: translateX(5px);
            background-color: rgba(0, 123, 255, 0.05);
        }
        
        .video-card .card-body, .playlist-video-item .card-body {
            padding: 0.5rem !important;
        }
        
        /* Altura reducida para las filas */
        .video-card .row, .playlist-video-item .row {
            min-height: 40px;
        }
        
        /* Ajustes de espacio */
        .playlist-video-item .order-badge {
            min-width: 24px;
            text-align: center;
        }
        
        /* Eliminar padding innecesario */
        #availableVideosList, #playlistVideosList {
            padding: 0.5rem !important;
        }
        
        /* Mejorar la visualización en móviles */
        @media (max-width: 768px) {
            .video-title {
                font-size: 0.9rem;
            }
            
            .btn-group-sm > .btn {
                padding: 0.25rem 0.5rem;
                font-size: 0.75rem;
            }
        }
    `;
    
    // Añadir al head del documento
    document.head.appendChild(styleElement);
    
    console.log('✅ Estilos para versión simplificada aplicados');
}

/**
 * Añadir este código a la función de inicialización
 */
document.addEventListener('DOMContentLoaded', function() {
    // Aplicar estilos para la versión simplificada
    applySimplifiedStyles();
    
    // Resto del código de inicialización...
}); 

// ==========================================
// FUNCIONES DE GESTIÓN DE PLAYLIST
// ==========================================

/**
 * Agregar video a la playlist
 * Usa la API correcta: POST /api/playlists/{playlistId}/videos/{videoId}
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
            // No incluye body porque los IDs están en la URL
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
        loadingElement.style.display = 'block';
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
        loadingElement.style.display = 'none';
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

// ==========================================
// FUNCIONES ADICIONALES
// ==========================================

/**
 * Vista previa de video
 */
function previewVideo(videoId) {
    console.log('▶️ Vista previa de video:', videoId);
    showToast('Vista previa de video - Funcionalidad en desarrollo', 'info');
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
        }
    } else {
        console.warn('⚠️ No se detectó ID de playlist en la URL');
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
            setupEditMode(currentPlaylistData.title);
            updatePlaylistVideosTable();
            
            // Luego cargar videos disponibles
            loadAvailableVideos();
            
        } else {
            // SEGUNDO: Intentar detectar ID desde URL si no hay datos del template
            const urlParams = new URLSearchParams(window.location.search);
            const playlistId = urlParams.get('id');
            
            if (playlistId) {
                console.log('🔄 No hay datos del template, cargando desde API - Playlist ID:', playlistId);
                loadPlaylistData(playlistId);
            } else {
                console.log('🆕 Modo nueva playlist');
                // Solo cargar videos disponibles para nueva playlist
                loadAvailableVideos();
            }
        }
        
        // Configurar event listeners
        setupEventListeners();
        
        // Arreglar imágenes faltantes
        fixMissingImages();
        
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
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterVideos(searchTerm);
        });
    }
    
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
 * Filtrar videos por término de búsqueda
 */
function filterVideos(searchTerm) {
    // Implementación básica - en una versión completa filtrarías los videos mostrados
    if (!searchTerm) {
        showToast('Término de búsqueda borrado', 'info');
    } else {
        showToast(`Buscando: "${searchTerm}"`, 'info');
    }
}

// ==========================================
// AUTO-INICIALIZACIÓN
// ==========================================

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Configurar elemento de ID de playlist
    setupPlaylistIdElement();
    
    // Configurar manejo de imágenes faltantes
    fixMissingImages();
    
    // Inicializar editor
    initializePlaylistEditor();
});

console.log('✅ Editor de Playlist cargado correctamente');