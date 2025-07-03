/**
 * PLAYLIST DETAIL - JAVASCRIPT COMPLETO Y FUNCIONAL
 * 
 * Este archivo contiene toda la funcionalidad necesaria para que el template
 * playlist_detail.html funcione correctamente, incluyendo:
 * 
 * 1. Gestión de videos de la playlist
 * 2. Biblioteca de videos disponibles
 * 3. Modal de asignación de dispositivos
 * 4. Dispositivos asignados
 * 5. Funciones de utilidad
 * 
 * INSTRUCCIONES DE USO:
 * 1. Guarda este código en static/js/playlist_detail_complete.js
 * 2. Carga este archivo en tu template DESPUÉS de api-config.js
 * 3. Asegúrate de que el template tenga los elementos HTML correctos
 */

console.log('🎬 Cargando JavaScript completo para playlist_detail...');

// ==========================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// ==========================================

// Estado de la aplicación
let currentPlaylistData = null;
let playlistVideos = [];
let availableVideos = [];
let assignedDevices = [];
let allDevicesForAssignment = [];
let filteredDevicesForAssignment = [];
let currentAssignedDeviceIds = [];
let pendingDeviceChanges = new Set();

// Estado de paginación y búsqueda
let currentPage = 1;
let pageSize = 25;
let totalPages = 1;
let searchTerm = '';
let isLoadingVideos = false;
let isLoadingDevices = false;

// Estado de cambios
let hasUnsavedChanges = false;

// API Configuration - Verificar y crear si no existe
if (typeof window.API_CONFIG === 'undefined') {
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
            REMOVE_VIDEO: (playlistId, videoId) => `${apiUrl}/playlists/${playlistId}/videos/${videoId}`,
            UPDATE_ORDER: (id) => `${apiUrl}/playlists/${id}/video-order`
        },
        DEVICES: {
            LIST: `${apiUrl}/devices`,
            PLAYLIST_DEVICES: (playlistId) => `${apiUrl}/device-playlists/playlist/${playlistId}/devices`,
            ASSIGN: `${apiUrl}/device-playlists`,
            UNASSIGN: (deviceId, playlistId) => `${apiUrl}/device-playlists/${deviceId}/${playlistId}`
        }
    };
}

// ==========================================
// FUNCIÓN getPlaylistId ROBUSTA
// ==========================================

function getPlaylistId() {
    try {
        // Método 1: URL params
        const urlParams = new URLSearchParams(window.location.search);
        const idFromUrl = urlParams.get('id');
        if (idFromUrl) {
            const parsedId = parseInt(idFromUrl);
            if (!isNaN(parsedId) && parsedId > 0) {
                return parsedId;
            }
        }
        
        // Método 2: Path URL
        const pathMatch = window.location.pathname.match(/\/playlists?\/(\d+)/);
        if (pathMatch && pathMatch[1]) {
            const parsedId = parseInt(pathMatch[1]);
            if (!isNaN(parsedId) && parsedId > 0) {
                return parsedId;
            }
        }
        
        // Método 3: Elemento hidden
        const idElement = document.getElementById('playlist-id');
        if (idElement && idElement.value) {
            const parsedId = parseInt(idElement.value);
            if (!isNaN(parsedId) && parsedId > 0) {
                return parsedId;
            }
        }
        
        // Método 4: Variables globales
        if (window.currentPlaylistId) {
            const parsedId = parseInt(window.currentPlaylistId);
            if (!isNaN(parsedId) && parsedId > 0) {
                return parsedId;
            }
        }
        
        // Método 5: JSON corregido
        const playlistElement = document.getElementById('playlist-data');
        if (playlistElement && playlistElement.textContent) {
            try {
                let jsonText = playlistElement.textContent.trim();
                
                // Corregir JSON malformado
                jsonText = jsonText
                    .replace(/"([^"]+)":\s*,/g, '"$1": null,')
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']')
                    .replace(/:\s*undefined/g, ': null');
                
                const templateData = JSON.parse(jsonText);
                if (templateData && templateData.id) {
                    const parsedId = parseInt(templateData.id);
                    if (!isNaN(parsedId) && parsedId > 0) {
                        // Actualizar datos globales
                        window.currentPlaylistData = templateData;
                        window.currentPlaylistId = parsedId;
                        return parsedId;
                    }
                }
            } catch (jsonError) {
                // Último recurso: regex
                const idMatch = playlistElement.textContent.match(/"id":\s*(\d+)/);
                if (idMatch && idMatch[1]) {
                    const parsedId = parseInt(idMatch[1]);
                    if (!isNaN(parsedId) && parsedId > 0) {
                        return parsedId;
                    }
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error obteniendo ID de playlist:', error);
        return null;
    }
}

// ==========================================
// FUNCIONES DE SEGURIDAD HTTPS
// ==========================================

function isSecureContext() {
    try {
        return window.location.protocol === 'https:' || 
               window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname === '0.0.0.0';
    } catch (error) {
        return false;
    }
}

async function secureFetch(url, options = {}) {
    try {
        const defaultOptions = {
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                ...(isSecureContext() && {
                    'X-Requested-With': 'XMLHttpRequest'
                })
            }
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        const response = await fetch(url, finalOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
    } catch (error) {
        console.error(`❌ Error en fetch:`, error);
        throw error;
    }
}

// ==========================================
// GESTIÓN DE VIDEOS DE LA PLAYLIST
// ==========================================

/**
 * Cargar videos disponibles desde la API
 */
async function loadAvailableVideos() {
    if (isLoadingVideos) return;
    
    console.log('📥 Cargando videos disponibles...');
    isLoadingVideos = true;
    
    // Mostrar loading
    showLoadingState('loadingAvailableVideos', true);
    showLoadingState('availableVideosContainer', false);
    
    try {
        const response = await secureFetch(window.API_CONFIG.VIDEOS.LIST);
        const data = await response.json();
        
        availableVideos = Array.isArray(data) ? data : (data.videos || []);
        
        console.log(`✅ ${availableVideos.length} videos disponibles cargados`);
        
        // Mostrar videos
        showLoadingState('loadingAvailableVideos', false);
        showLoadingState('availableVideosContainer', true);
        
        displayAvailableVideos();
        updatePlaylistStats();
        
    } catch (error) {
        console.error('❌ Error cargando videos:', error);
        showLoadingState('loadingAvailableVideos', false);
        showToast('Error al cargar videos disponibles', 'error');
    } finally {
        isLoadingVideos = false;
    }
}

/**
 * Mostrar videos disponibles
 */
function displayAvailableVideos() {
    const container = document.getElementById('availableVideosList');
    if (!container) return;
    
    // Aplicar filtros
    let filteredVideos = availableVideos;
    
    if (searchTerm) {
        filteredVideos = availableVideos.filter(video =>
            video.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            video.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    
    // Paginación
    if (pageSize !== 'all') {
        totalPages = Math.ceil(filteredVideos.length / parseInt(pageSize));
        const startIndex = (currentPage - 1) * parseInt(pageSize);
        const endIndex = startIndex + parseInt(pageSize);
        filteredVideos = filteredVideos.slice(startIndex, endIndex);
    } else {
        totalPages = 1;
        currentPage = 1;
    }
    
    if (filteredVideos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-video"></i>
                <h5>No se encontraron videos</h5>
                <p class="text-muted">Intenta ajustar tu búsqueda</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredVideos.map(video => `
        <div class="available-video" data-video-id="${video.id}">
            <img src="${video.thumbnail || '/static/images/video-placeholder.png'}" 
                 alt="Thumbnail" class="video-thumbnail"
                 onerror="this.src='/static/images/video-placeholder.png'">
            <div class="video-info flex-grow-1">
                <div class="video-title">${escapeHtml(video.title || 'Sin título')}</div>
                <div class="video-description text-truncate-2">
                    ${escapeHtml(video.description || 'Sin descripción')}
                </div>
                <div class="video-meta">
                    <span><i class="fas fa-clock me-1"></i>${formatDuration(video.duration)}</span>
                    ${video.file_size ? `<span><i class="fas fa-file me-1"></i>${formatFileSize(video.file_size)}</span>` : ''}
                </div>
            </div>
            <div class="video-actions">
                <button class="btn btn-sm btn-success" onclick="addVideoToPlaylist(${video.id})" title="Agregar a playlist">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="btn btn-sm btn-info" onclick="previewVideo(${video.id})" title="Vista previa">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    updatePagination();
}

/**
 * Actualizar videos de la playlist
 */
function updatePlaylistVideosTable() {
    const container = document.getElementById('playlistVideosList');
    const emptyState = document.getElementById('playlistVideosEmpty');
    
    if (!container) return;
    
    if (!playlistVideos || playlistVideos.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    container.innerHTML = playlistVideos.map((video, index) => `
        <div class="video-item" data-video-id="${video.id}" data-order="${index + 1}">
            <div class="drag-handle" title="Arrastrar para reordenar">
                <i class="fas fa-grip-vertical"></i>
            </div>
            <img src="${video.thumbnail || '/static/images/video-placeholder.png'}" 
                 alt="Thumbnail" class="video-thumbnail"
                 onerror="this.src='/static/images/video-placeholder.png'">
            <div class="video-info flex-grow-1">
                <div class="video-title">${escapeHtml(video.title || 'Sin título')}</div>
                <div class="video-description text-truncate-2">
                    ${escapeHtml(video.description || 'Sin descripción')}
                </div>
                <div class="video-meta">
                    <span><i class="fas fa-sort me-1"></i>Posición ${index + 1}</span>
                    <span><i class="fas fa-clock me-1"></i>${formatDuration(video.duration)}</span>
                    ${video.file_size ? `<span><i class="fas fa-file me-1"></i>${formatFileSize(video.file_size)}</span>` : ''}
                </div>
            </div>
            <div class="video-actions">
                <button class="btn btn-sm btn-primary" onclick="moveVideoUp(${index})" 
                        ${index === 0 ? 'disabled' : ''} title="Mover arriba">
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="btn btn-sm btn-primary" onclick="moveVideoDown(${index})" 
                        ${index === playlistVideos.length - 1 ? 'disabled' : ''} title="Mover abajo">
                    <i class="fas fa-arrow-down"></i>
                </button>
                <button class="btn btn-sm btn-info" onclick="previewVideo(${video.id})" title="Vista previa">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="removeVideoFromPlaylist(${video.id})" title="Remover">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    updatePlaylistStats();
}

/**
 * Agregar video a la playlist
 */
function addVideoToPlaylist(videoId) {
    const video = availableVideos.find(v => v.id === videoId);
    if (!video) {
        showToast('Video no encontrado', 'error');
        return;
    }
    
    // Verificar si ya está en la playlist
    if (playlistVideos.some(v => v.id === videoId)) {
        showToast('El video ya está en la playlist', 'warning');
        return;
    }
    
    // Agregar video con orden
    const newVideo = {
        ...video,
        order: playlistVideos.length + 1,
        position: playlistVideos.length + 1
    };
    
    playlistVideos.push(newVideo);
    
    updatePlaylistVideosTable();
    markAsUnsaved();
    showToast(`Video "${video.title}" agregado a la playlist`, 'success');
}

/**
 * Remover video de la playlist
 */
function removeVideoFromPlaylist(videoId) {
    const videoIndex = playlistVideos.findIndex(v => v.id === videoId);
    if (videoIndex === -1) return;
    
    const video = playlistVideos[videoIndex];
    playlistVideos.splice(videoIndex, 1);
    
    // Reordenar posiciones
    playlistVideos.forEach((v, index) => {
        v.order = index + 1;
        v.position = index + 1;
    });
    
    updatePlaylistVideosTable();
    markAsUnsaved();
    showToast(`Video "${video.title}" removido de la playlist`, 'success');
}

/**
 * Mover video hacia arriba
 */
function moveVideoUp(index) {
    if (index <= 0) return;
    
    [playlistVideos[index], playlistVideos[index - 1]] = 
    [playlistVideos[index - 1], playlistVideos[index]];
    
    // Actualizar posiciones
    playlistVideos.forEach((v, i) => {
        v.order = i + 1;
        v.position = i + 1;
    });
    
    updatePlaylistVideosTable();
    markAsUnsaved();
}

/**
 * Mover video hacia abajo
 */
function moveVideoDown(index) {
    if (index >= playlistVideos.length - 1) return;
    
    [playlistVideos[index], playlistVideos[index + 1]] = 
    [playlistVideos[index + 1], playlistVideos[index]];
    
    // Actualizar posiciones
    playlistVideos.forEach((v, i) => {
        v.order = i + 1;
        v.position = i + 1;
    });
    
    updatePlaylistVideosTable();
    markAsUnsaved();
}

/**
 * Limpiar playlist
 */
function clearPlaylist() {
    if (playlistVideos.length === 0) {
        showToast('La playlist ya está vacía', 'info');
        return;
    }
    
    if (confirm('¿Estás seguro de que deseas limpiar todos los videos de la playlist?')) {
        playlistVideos = [];
        updatePlaylistVideosTable();
        markAsUnsaved();
        showToast('Playlist limpiada', 'success');
    }
}

/**
 * Vista previa de video
 */
function previewVideo(videoId) {
    const video = availableVideos.find(v => v.id === videoId) || 
                  playlistVideos.find(v => v.id === videoId);
    
    if (!video) {
        showToast('Video no encontrado', 'error');
        return;
    }
    
    const modal = document.getElementById('videoPreviewModal');
    const videoElement = document.getElementById('previewVideo');
    const titleElement = document.getElementById('previewVideoTitle');
    const descriptionElement = document.getElementById('previewVideoDescription');
    
    if (modal && videoElement) {
        if (titleElement) titleElement.textContent = video.title || 'Sin título';
        if (descriptionElement) descriptionElement.textContent = video.description || 'Sin descripción';
        
        videoElement.src = video.file_path || '';
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
}

/**
 * Vista previa de toda la playlist
 */
function previewPlaylist() {
    if (!playlistVideos || playlistVideos.length === 0) {
        showToast('No hay videos en la playlist para previsualizar', 'warning');
        return;
    }
    
    // Crear ventana de preview
    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    
    const playlistHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Vista Previa - ${currentPlaylistData?.title || 'Playlist'}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="bg-light">
            <div class="container py-4">
                <h2>${currentPlaylistData?.title || 'Playlist'}</h2>
                <p class="text-muted">${currentPlaylistData?.description || ''}</p>
                <div class="row">
                    ${playlistVideos.map((video, index) => `
                        <div class="col-md-6 mb-3">
                            <div class="card">
                                <div class="card-body">
                                    <h6>${index + 1}. ${video.title || 'Sin título'}</h6>
                                    <p class="small text-muted">${video.description || 'Sin descripción'}</p>
                                    <small class="text-info">${formatDuration(video.duration)}</small>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </body>
        </html>
    `;
    
    previewWindow.document.write(playlistHtml);
    previewWindow.document.close();
}

// ==========================================
// GESTIÓN DE DISPOSITIVOS ASIGNADOS
// ==========================================

/**
 * Cargar dispositivos asignados a la playlist
 */
async function loadAssignedDevices() {
    const playlistId = getPlaylistId();
    if (!playlistId) return;
    
    console.log(`📺 Cargando dispositivos asignados a playlist ${playlistId}...`);
    
    const loadingElement = document.getElementById('loadingAssignedDevices');
    const tableElement = document.getElementById('assignedDevicesTable');
    const emptyElement = document.getElementById('assignedDevicesEmpty');
    
    // Mostrar loading
    if (loadingElement) loadingElement.classList.remove('d-none');
    if (tableElement) tableElement.classList.add('d-none');
    if (emptyElement) emptyElement.classList.add('d-none');
    
    try {
        const url = window.API_CONFIG.DEVICES.PLAYLIST_DEVICES(playlistId);
        const response = await secureFetch(url);
        const data = await response.json();
        
        assignedDevices = Array.isArray(data) ? data : (data.devices || []);
        
        console.log(`✅ ${assignedDevices.length} dispositivos asignados cargados`);
        
        // Ocultar loading
        if (loadingElement) loadingElement.classList.add('d-none');
        
        if (assignedDevices.length === 0) {
            if (emptyElement) emptyElement.classList.remove('d-none');
        } else {
            displayAssignedDevices();
            if (tableElement) tableElement.classList.remove('d-none');
        }
        
        updatePlaylistStats();
        
    } catch (error) {
        console.error('❌ Error cargando dispositivos asignados:', error);
        if (loadingElement) loadingElement.classList.add('d-none');
        if (emptyElement) {
            emptyElement.classList.remove('d-none');
            emptyElement.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-danger"></i>
                    <h5>Error al cargar dispositivos</h5>
                    <p class="text-muted">${error.message}</p>
                    <button class="btn btn-outline-primary" onclick="loadAssignedDevices()">
                        <i class="fas fa-sync me-1"></i>Reintentar
                    </button>
                </div>
            `;
        }
    }
}

/**
 * Mostrar dispositivos asignados
 */
function displayAssignedDevices() {
    const tbody = document.getElementById('assignedDevicesList');
    if (!tbody || !assignedDevices) return;
    
    tbody.innerHTML = assignedDevices.map(device => `
        <tr>
            <td>
                <div class="device-info">
                    <div class="device-name">${escapeHtml(device.name || 'Sin nombre')}</div>
                    <small class="text-muted">${escapeHtml(device.mac_address || '')}</small>
                </div>
            </td>
            <td>
                <small class="text-muted">${escapeHtml(device.location || device.tienda || 'Sin ubicación')}</small>
            </td>
            <td>
                <span class="badge ${device.status === 'online' ? 'bg-success' : 'bg-secondary'}">
                    ${device.status === 'online' ? 'En línea' : 'Fuera de línea'}
                </span>
            </td>
            <td>
                <small class="text-muted">${formatDate(device.last_seen || device.updated_at)}</small>
            </td>
            <td class="text-end">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-info" onclick="viewDeviceDetails('${device.device_id || device.id}')" 
                            title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline-danger" 
                            onclick="confirmUnassignDevice('${device.device_id || device.id}', '${escapeHtml(device.name)}')" 
                            title="Desasignar">
                        <i class="fas fa-unlink"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Confirmar desasignación de dispositivo
 */
function confirmUnassignDevice(deviceId, deviceName) {
    if (confirm(`¿Estás seguro de que deseas desasignar el dispositivo "${deviceName}"?`)) {
        unassignDeviceFromPlaylist(deviceId);
    }
}

/**
 * Desasignar dispositivo de playlist
 */
async function unassignDeviceFromPlaylist(deviceId) {
    const playlistId = getPlaylistId();
    if (!playlistId) return;
    
    try {
        const url = window.API_CONFIG.DEVICES.UNASSIGN(deviceId, playlistId);
        await secureFetch(url, { method: 'DELETE' });
        
        showToast('Dispositivo desasignado correctamente', 'success');
        
        // Recargar dispositivos asignados
        await loadAssignedDevices();
        
    } catch (error) {
        console.error('❌ Error desasignando dispositivo:', error);
        showToast('Error al desasignar dispositivo', 'error');
    }
}

/**
 * Ver detalles del dispositivo
 */
function viewDeviceDetails(deviceId) {
    const detailsUrl = `/ui/devices/${deviceId}`;
    window.open(detailsUrl, '_blank');
}

// ==========================================
// MODAL DE ASIGNACIÓN DE DISPOSITIVOS
// ==========================================

/**
 * Inicializar modal de asignación de dispositivos
 */
function initializeDeviceAssignmentModal() {
    console.log('🔧 Inicializando modal de asignación de dispositivos...');
    
    const modal = document.getElementById('assignDeviceModal');
    if (!modal) return;
    
    // Configurar eventos del modal
    modal.addEventListener('show.bs.modal', async () => {
        console.log('📂 Abriendo modal de asignación...');
        try {
            await loadDevicesForAssignment();
            await loadCurrentAssignedDevices();
        } catch (error) {
            console.error('❌ Error abriendo modal:', error);
            showModalError('Error cargando datos', error.message);
        }
    });
    
    modal.addEventListener('hidden.bs.modal', () => {
        console.log('📫 Cerrando modal de asignación...');
        resetDeviceAssignmentModal();
    });
    
    // Configurar event listeners
    setupDeviceModalEventListeners();
}

/**
 * Configurar event listeners del modal
 */
function setupDeviceModalEventListeners() {
    // Búsqueda
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            filterDevicesInModal(e.target.value);
        }, 300));
    }
    
    // Limpiar búsqueda
    const clearSearch = document.getElementById('clearDeviceSearch');
    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            filterDevicesInModal('');
        });
    }
    
    // Filtro de estado
    const statusFilter = document.getElementById('deviceStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            filterDevicesInModal();
        });
    }
    
    // Limpiar filtros
    const clearFilters = document.getElementById('clearDeviceFilters');
    if (clearFilters) {
        clearFilters.addEventListener('click', clearAllDeviceFilters);
    }
    
    // Seleccionar todos
    const selectAll = document.getElementById('selectAllDevices');
    if (selectAll) {
        selectAll.addEventListener('change', handleSelectAllDevices);
    }
    
    // Botón guardar
    const saveBtn = document.getElementById('saveDeviceAssignments');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveDeviceAssignments_Click);
    }
}

/**
 * Cargar dispositivos para asignación
 */
async function loadDevicesForAssignment() {
    if (isLoadingDevices) return;
    
    console.log('📥 Cargando dispositivos para asignación...');
    isLoadingDevices = true;
    
    const devicesList = document.getElementById('availableDevicesList');
    if (devicesList) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mt-2 text-muted small mb-0">Cargando dispositivos...</p>
                </td>
            </tr>
        `;
    }
    
    try {
        const response = await secureFetch(window.API_CONFIG.DEVICES.LIST);
        const data = await response.json();
        
        allDevicesForAssignment = Array.isArray(data) ? data : (data.devices || []);
        
        console.log(`✅ ${allDevicesForAssignment.length} dispositivos cargados para asignación`);
        
        filterDevicesInModal();
        
    } catch (error) {
        console.error('❌ Error cargando dispositivos:', error);
        
        if (devicesList) {
            devicesList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <i class="fas fa-exclamation-triangle fa-2x text-danger mb-2"></i>
                        <p class="text-danger mb-1">Error cargando dispositivos</p>
                        <p class="small text-muted mb-2">${escapeHtml(error.message)}</p>
                        <button class="btn btn-sm btn-outline-primary" onclick="loadDevicesForAssignment()">
                            <i class="fas fa-sync"></i> Reintentar
                        </button>
                    </td>
                </tr>
            `;
        }
    } finally {
        isLoadingDevices = false;
    }
}

/**
 * Cargar dispositivos actualmente asignados
 */
async function loadCurrentAssignedDevices() {
    console.log('📋 Cargando dispositivos asignados actuales...');
    
    const playlistId = getPlaylistId();
    if (!playlistId) return;
    
    try {
        const url = window.API_CONFIG.DEVICES.PLAYLIST_DEVICES(playlistId);
        const response = await secureFetch(url);
        const assignedDevices = await response.json();
        
        currentAssignedDeviceIds = assignedDevices.map(device => 
            device.device_id || device.id || device.mac_address
        ).filter(id => id);
        
        console.log(`✅ ${currentAssignedDeviceIds.length} dispositivos asignados identificados`);
        
    } catch (error) {
        console.error('❌ Error cargando dispositivos asignados:', error);
        currentAssignedDeviceIds = [];
    }
}

/**
 * Filtrar dispositivos en el modal
 */
function filterDevicesInModal(searchTerm = '') {
    const statusFilter = document.getElementById('deviceStatusFilter');
    const currentStatusFilter = statusFilter ? statusFilter.value : 'all';
    
    // Aplicar filtros
    filteredDevicesForAssignment = allDevicesForAssignment.filter(device => {
        // Filtro de búsqueda
        if (searchTerm) {
            const searchableText = [
                device.name || '',
                device.mac_address || '',
                device.location || '',
                device.tienda || ''
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(searchTerm.toLowerCase())) {
                return false;
            }
        }
        
        // Filtro de estado
        const deviceId = device.id || device.mac_address;
        const isAssigned = currentAssignedDeviceIds.includes(deviceId);
        
        switch (currentStatusFilter) {
            case 'online':
                return device.status === 'online';
            case 'offline':
                return device.status !== 'online';
            case 'assigned':
                return isAssigned;
            case 'unassigned':
                return !isAssigned;
            default:
                return true;
        }
    });
    
    displayFilteredDevices();
    updateModalStatistics();
}

/**
 * Mostrar dispositivos filtrados
 */
function displayFilteredDevices() {
    const devicesList = document.getElementById('availableDevicesList');
    if (!devicesList) return;
    
    if (filteredDevicesForAssignment.length === 0) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <i class="fas fa-search fa-2x text-muted mb-2"></i>
                    <p class="text-muted">No se encontraron dispositivos</p>
                    <button class="btn btn-sm btn-outline-secondary" onclick="clearAllDeviceFilters()">
                        <i class="fas fa-eraser me-1"></i>Limpiar Filtros
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    devicesList.innerHTML = filteredDevicesForAssignment.map(device => {
        const deviceId = device.id || device.mac_address;
        const isAssigned = currentAssignedDeviceIds.includes(deviceId);
        const hasPendingChange = pendingDeviceChanges.has(deviceId);
        const willBeAssigned = hasPendingChange ? !isAssigned : isAssigned;
        
        const statusBadge = device.status === 'online' ? 
            '<span class="badge bg-success">En línea</span>' :
            '<span class="badge bg-secondary">Fuera de línea</span>';
        
        const assignmentBadge = willBeAssigned ?
            '<span class="badge bg-primary">Asignado</span>' :
            '<span class="badge bg-outline-secondary">No asignado</span>';
        
        const rowClass = hasPendingChange ? 'pending-change' : '';
        
        return `
            <tr class="${rowClass}">
                <td>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" 
                               id="device_${deviceId}" 
                               value="${deviceId}"
                               ${willBeAssigned ? 'checked' : ''}
                               onchange="handleDeviceCheckboxChange('${deviceId}')">
                    </div>
                </td>
                <td>
                    <div class="fw-semibold">${escapeHtml(device.name || 'Sin nombre')}</div>
                    <small class="text-muted">${escapeHtml(device.mac_address || '')}</small>
                </td>
                <td>${statusBadge}</td>
                <td>${assignmentBadge}</td>
                <td>
                    <small class="text-muted">${escapeHtml(device.location || device.tienda || 'Sin ubicación')}</small>
                </td>
                <td>
                    <small class="text-muted">${formatDate(device.last_seen || device.updated_at)}</small>
                </td>
            </tr>
        `;
    }).join('');
    
    updateSaveButtonState();
}

/**
 * Manejar cambio en checkbox de dispositivo
 */
function handleDeviceCheckboxChange(deviceId) {
    const wasAssigned = currentAssignedDeviceIds.includes(deviceId);
    const checkbox = document.getElementById(`device_${deviceId}`);
    const isNowChecked = checkbox ? checkbox.checked : false;
    
    if (isNowChecked !== wasAssigned) {
        pendingDeviceChanges.add(deviceId);
    } else {
        pendingDeviceChanges.delete(deviceId);
    }
    
    updateSaveButtonState();
    updateModalStatistics();
    
    // Actualizar clase de la fila
    const row = checkbox?.closest('tr');
    if (row) {
        if (pendingDeviceChanges.has(deviceId)) {
            row.classList.add('pending-change');
        } else {
            row.classList.remove('pending-change');
        }
    }
}

/**
 * Manejar seleccionar todos
 */
function handleSelectAllDevices() {
    const selectAllCheckbox = document.getElementById('selectAllDevices');
    const isChecked = selectAllCheckbox?.checked || false;
    
    filteredDevicesForAssignment.forEach(device => {
        const deviceId = device.id || device.mac_address;
        const checkbox = document.getElementById(`device_${deviceId}`);
        
        if (checkbox) {
            checkbox.checked = isChecked;
            handleDeviceCheckboxChange(deviceId);
        }
    });
}

/**
 * Actualizar estado del botón guardar
 */
function updateSaveButtonState() {
    const saveBtn = document.getElementById('saveDeviceAssignments');
    const changesInfo = document.getElementById('changesInfo');
    
    if (saveBtn) {
        saveBtn.disabled = pendingDeviceChanges.size === 0;
        
        if (pendingDeviceChanges.size > 0) {
            saveBtn.innerHTML = `<i class="fas fa-save me-1"></i>Guardar Cambios (${pendingDeviceChanges.size})`;
            saveBtn.className = 'btn btn-warning';
        } else {
            saveBtn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar Cambios';
            saveBtn.className = 'btn btn-primary';
        }
    }
    
    if (changesInfo) {
        if (pendingDeviceChanges.size > 0) {
            changesInfo.textContent = `${pendingDeviceChanges.size} cambio(s) pendiente(s)`;
            changesInfo.className = 'text-warning fw-semibold';
        } else {
            changesInfo.textContent = 'No hay cambios pendientes';
            changesInfo.className = 'text-muted';
        }
    }
}

/**
 * Actualizar estadísticas del modal
 */
function updateModalStatistics() {
    const totalBadge = document.getElementById('totalDevicesBadge');
    const onlineBadge = document.getElementById('onlineDevicesBadge');
    const assignedBadge = document.getElementById('assignedDevicesBadge');
    const pendingBadge = document.getElementById('pendingChangesBadge');
    const paginationInfo = document.getElementById('devicesPaginationInfo');
    
    if (totalBadge) {
        totalBadge.innerHTML = `<i class="fas fa-tv me-1"></i>${filteredDevicesForAssignment.length} dispositivos`;
    }
    
    if (onlineBadge) {
        const onlineCount = filteredDevicesForAssignment.filter(d => d.status === 'online').length;
        onlineBadge.innerHTML = `<i class="fas fa-circle me-1"></i>${onlineCount} en línea`;
    }
    
    if (assignedBadge) {
        const assignedCount = filteredDevicesForAssignment.filter(d => {
            const deviceId = d.id || d.mac_address;
            return currentAssignedDeviceIds.includes(deviceId);
        }).length;
        assignedBadge.innerHTML = `<i class="fas fa-link me-1"></i>${assignedCount} asignados`;
    }
    
    if (pendingBadge) {
        pendingBadge.innerHTML = `<i class="fas fa-clock me-1"></i>${pendingDeviceChanges.size} cambios pendientes`;
        pendingBadge.className = pendingDeviceChanges.size > 0 ? 'badge bg-warning' : 'badge bg-info';
    }
    
    if (paginationInfo) {
        paginationInfo.textContent = `Mostrando ${filteredDevicesForAssignment.length} de ${allDevicesForAssignment.length} dispositivos`;
    }
}

/**
 * Limpiar todos los filtros del modal
 */
function clearAllDeviceFilters() {
    const searchInput = document.getElementById('deviceSearchInput');
    const statusFilter = document.getElementById('deviceStatusFilter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'all';
    
    filterDevicesInModal('');
}

/**
 * Guardar asignaciones de dispositivos
 */
async function saveDeviceAssignments_Click() {
    if (pendingDeviceChanges.size === 0) {
        console.log('📝 No hay cambios para guardar');
        return;
    }
    
    console.log(`💾 Guardando ${pendingDeviceChanges.size} cambios...`);
    
    const saveBtn = document.getElementById('saveDeviceAssignments');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Guardando...';
    }
    
    const playlistId = getPlaylistId();
    if (!playlistId) {
        showToast('Error: No se pudo obtener el ID de la playlist', 'error');
        return;
    }
    
    try {
        let successCount = 0;
        let errorCount = 0;
        
        for (const deviceId of pendingDeviceChanges) {
            const checkbox = document.getElementById(`device_${deviceId}`);
            if (!checkbox) continue;
            
            const isChecked = checkbox.checked;
            const wasAssigned = currentAssignedDeviceIds.includes(deviceId);
            
            try {
                if (isChecked && !wasAssigned) {
                    // Asignar dispositivo
                    await assignDeviceToPlaylist(deviceId, playlistId);
                    successCount++;
                } else if (!isChecked && wasAssigned) {
                    // Desasignar dispositivo
                    await unassignDeviceFromPlaylist(deviceId);
                    successCount++;
                }
            } catch (error) {
                console.error(`❌ Error procesando dispositivo ${deviceId}:`, error);
                errorCount++;
            }
        }
        
        // Limpiar cambios pendientes
        pendingDeviceChanges.clear();
        
        // Recargar datos
        await loadCurrentAssignedDevices();
        filterDevicesInModal();
        
        // Mostrar resultado
        if (errorCount === 0) {
            showToast(`✅ Todos los cambios guardados correctamente (${successCount})`, 'success');
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('assignDeviceModal'));
            if (modal) modal.hide();
            
            // Recargar dispositivos asignados en la página principal
            await loadAssignedDevices();
        } else {
            showToast(`⚠️ ${successCount} cambios guardados, ${errorCount} errores`, 'warning');
        }
        
    } catch (error) {
        console.error('❌ Error general guardando:', error);
        showToast(`Error guardando cambios: ${error.message}`, 'error');
    } finally {
        updateSaveButtonState();
    }
}

/**
 * Asignar dispositivo a playlist
 */
async function assignDeviceToPlaylist(deviceId, playlistId) {
    const response = await secureFetch(window.API_CONFIG.DEVICES.ASSIGN, {
        method: 'POST',
        body: JSON.stringify({
            device_id: deviceId,
            playlist_id: parseInt(playlistId)
        })
    });
    
    return await response.json();
}

/**
 * Resetear modal de asignación
 */
function resetDeviceAssignmentModal() {
    allDevicesForAssignment = [];
    filteredDevicesForAssignment = [];
    currentAssignedDeviceIds = [];
    pendingDeviceChanges.clear();
    
    const searchInput = document.getElementById('deviceSearchInput');
    const statusFilter = document.getElementById('deviceStatusFilter');
    const selectAll = document.getElementById('selectAllDevices');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'all';
    if (selectAll) selectAll.checked = false;
    
    updateSaveButtonState();
}

// ==========================================
// FUNCIONES PRINCIPALES DE LA APLICACIÓN
// ==========================================

/**
 * Guardar cambios de la playlist
 */
async function savePlaylistChanges() {
    const playlistId = getPlaylistId();
    if (!playlistId) {
        showToast('Error: No se pudo obtener el ID de la playlist', 'error');
        return;
    }
    
    if (!hasUnsavedChanges) {
        showToast('No hay cambios para guardar', 'info');
        return;
    }
    
    try {
        // Preparar datos para enviar
        const orderData = {
            videos: playlistVideos.map((video, index) => ({
                video_id: video.id,
                position: index + 1
            }))
        };
        
        // Enviar actualización de orden
        const response = await secureFetch(window.API_CONFIG.PLAYLISTS.UPDATE_ORDER(playlistId), {
            method: 'PUT',
            body: JSON.stringify(orderData)
        });
        
        if (response.ok) {
            hasUnsavedChanges = false;
            
            // Actualizar botón de guardar
            const saveBtn = document.querySelector('[onclick="savePlaylistChanges()"]');
            if (saveBtn) {
                saveBtn.classList.remove('btn-success');
                saveBtn.classList.add('btn-warning');
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar';
            }
            
            showToast('Cambios guardados correctamente', 'success');
        } else {
            throw new Error('Error al guardar cambios');
        }
        
    } catch (error) {
        console.error('❌ Error guardando cambios:', error);
        showToast('Error al guardar cambios', 'error');
    }
}

// ==========================================
// FUNCIONES DE UTILIDAD
// ==========================================

/**
 * Formatear duración en minutos y segundos
 */
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0m';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
    
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

/**
 * Formatear tamaño de archivo
 */
function formatFileSize(bytes) {
    if (!bytes) return 'N/A';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Formatear fecha
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        return new Date(dateString).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'Fecha inválida';
    }
}

/**
 * Escapar HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Debounce
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

/**
 * Mostrar/ocultar estado de carga
 */
function showLoadingState(elementId, show = true) {
    const element = document.getElementById(elementId);
    if (element) {
        if (show) {
            element.classList.remove('d-none');
        } else {
            element.classList.add('d-none');
        }
    }
}

/**
 * Mostrar toast notification
 */
function showToast(message, type = 'info') {
    console.log(`📢 Toast ${type}: ${message}`);
    
    const alertClass = type === 'error' ? 'danger' : type;
    const toast = document.createElement('div');
    toast.className = `alert alert-${alertClass} position-fixed fade-in`;
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close float-end" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

/**
 * Marcar como cambios sin guardar
 */
function markAsUnsaved() {
    hasUnsavedChanges = true;
    
    const saveBtn = document.querySelector('[onclick="savePlaylistChanges()"]');
    if (saveBtn) {
        saveBtn.classList.remove('btn-warning');
        saveBtn.classList.add('btn-success');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar *';
    }
}

/**
 * Actualizar estadísticas de la playlist
 */
function updatePlaylistStats() {
    const totalVideosEl = document.getElementById('totalVideos');
    const totalDurationEl = document.getElementById('totalDuration');
    const activeVideosEl = document.getElementById('activeVideos');
    const assignedDevicesEl = document.getElementById('assignedDevices');
    const playlistVideoCountEl = document.getElementById('playlistVideoCount');
    const availableVideoCountEl = document.getElementById('availableVideoCount');
    const deviceCountEl = document.getElementById('deviceCount');
    
    const videoCount = playlistVideos ? playlistVideos.length : 0;
    const totalDuration = playlistVideos ? 
        playlistVideos.reduce((sum, video) => sum + (video.duration || 0), 0) : 0;
    const availableCount = availableVideos ? availableVideos.length : 0;
    const deviceCount = assignedDevices ? assignedDevices.length : 0;
    
    if (totalVideosEl) totalVideosEl.textContent = videoCount;
    if (totalDurationEl) totalDurationEl.textContent = formatDuration(totalDuration);
    if (activeVideosEl) activeVideosEl.textContent = videoCount;
    if (assignedDevicesEl) assignedDevicesEl.textContent = deviceCount;
    if (playlistVideoCountEl) playlistVideoCountEl.textContent = videoCount;
    if (availableVideoCountEl) availableVideoCountEl.textContent = availableCount;
    if (deviceCountEl) deviceCountEl.textContent = deviceCount;
}

/**
 * Actualizar paginación
 */
function updatePagination() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const paginationInfo = document.getElementById('paginationInfo');
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (paginationInfo) paginationInfo.textContent = `Página ${currentPage} de ${totalPages}`;
}

/**
 * Navegación de páginas
 */
function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayAvailableVideos();
    }
}

function goToNextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        displayAvailableVideos();
    }
}

function changePageSize() {
    const pageSizeSelect = document.getElementById('videoPageSize');
    if (pageSizeSelect) {
        pageSize = pageSizeSelect.value;
        currentPage = 1;
        displayAvailableVideos();
    }
}

/**
 * Filtrar videos disponibles
 */
function filterAvailableVideos() {
    const searchInput = document.getElementById('videoSearchInput');
    searchTerm = searchInput ? searchInput.value.trim() : '';
    currentPage = 1;
    displayAvailableVideos();
}

function clearVideoSearch() {
    const searchInput = document.getElementById('videoSearchInput');
    if (searchInput) {
        searchInput.value = '';
        searchTerm = '';
        currentPage = 1;
        displayAvailableVideos();
    }
}

/**
 * Mostrar error en modal
 */
function showModalError(title, message) {
    const modalBody = document.querySelector('#assignDeviceModal .modal-body');
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="alert alert-danger">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>${title}</h6>
                <p class="mb-0">${escapeHtml(message)}</p>
            </div>
            <div class="text-center">
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-sync me-2"></i>Recargar Página
                </button>
            </div>
        `;
    }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

/**
 * Inicializar aplicación cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎬 Inicializando aplicación playlist_detail...');
    
    try {
        // Cargar datos iniciales si están disponibles en el template
        const playlistElement = document.getElementById('playlist-data');
        if (playlistElement && playlistElement.textContent) {
            try {
                let jsonText = playlistElement.textContent.trim();
                
                // Corregir JSON malformado
                jsonText = jsonText
                    .replace(/"([^"]+)":\s*,/g, '"$1": null,')
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                
                const templateData = JSON.parse(jsonText);
                if (templateData && templateData.id) {
                    currentPlaylistData = templateData;
                    playlistVideos = templateData.videos || [];
                    
                    console.log('📋 Datos de playlist cargados desde template:', templateData.title);
                    
                    // Actualizar interfaz
                    updatePlaylistVideosTable();
                    updatePlaylistStats();
                }
            } catch (error) {
                console.warn('⚠️ Error cargando datos desde template:', error);
            }
        }
        
        // Configurar event listeners
        const searchInput = document.getElementById('videoSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(filterAvailableVideos, 300));
        }
        
        const clearSearch = document.getElementById('clearVideoSearch');
        if (clearSearch) {
            clearSearch.addEventListener('click', clearVideoSearch);
        }
        
        const pageSizeSelect = document.getElementById('videoPageSize');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', changePageSize);
        }
        
        // Inicializar modal de asignación de dispositivos
        initializeDeviceAssignmentModal();
        
        // Cargar datos iniciales
        loadAvailableVideos();
        loadAssignedDevices();
        
        // Configurar advertencia de salida
        window.addEventListener('beforeunload', function(e) {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?';
            }
        });
        
        console.log('✅ Aplicación playlist_detail inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando aplicación:', error);
        showToast('Error al inicializar la aplicación', 'error');
    }
});

// ==========================================
// EXPORTAR FUNCIONES GLOBALES
// ==========================================

// Hacer todas las funciones disponibles globalmente
window.getPlaylistId = getPlaylistId;
window.loadAvailableVideos = loadAvailableVideos;
window.addVideoToPlaylist = addVideoToPlaylist;
window.removeVideoFromPlaylist = removeVideoFromPlaylist;
window.moveVideoUp = moveVideoUp;
window.moveVideoDown = moveVideoDown;
window.clearPlaylist = clearPlaylist;
window.previewVideo = previewVideo;
window.previewPlaylist = previewPlaylist;
window.savePlaylistChanges = savePlaylistChanges;
window.loadAssignedDevices = loadAssignedDevices;
window.confirmUnassignDevice = confirmUnassignDevice;
window.unassignDeviceFromPlaylist = unassignDeviceFromPlaylist;
window.viewDeviceDetails = viewDeviceDetails;
window.initializeDeviceAssignmentModal = initializeDeviceAssignmentModal;
window.handleDeviceCheckboxChange = handleDeviceCheckboxChange;
window.handleSelectAllDevices = handleSelectAllDevices;
window.saveDeviceAssignments_Click = saveDeviceAssignments_Click;
window.clearAllDeviceFilters = clearAllDeviceFilters;
window.filterAvailableVideos = filterAvailableVideos;
window.clearVideoSearch = clearVideoSearch;
window.goToPrevPage = goToPrevPage;
window.goToNextPage = goToNextPage;
window.changePageSize = changePageSize;
window.updatePlaylistStats = updatePlaylistStats;
window.markAsUnsaved = markAsUnsaved;
window.showToast = showToast;
window.formatDuration = formatDuration;

// Variables globales
window.currentPlaylistData = currentPlaylistData;
window.playlistVideos = playlistVideos;
window.availableVideos = availableVideos;
window.assignedDevices = assignedDevices;

console.log('✅ JavaScript completo de playlist_detail cargado correctamente');