/**
 * MAIN.JS - Archivo principal del sistema
 * Versión corregida sin errores de Mixed Content
 */

console.log('🚀 Iniciando sistema principal...');

// ==========================================
// VARIABLES GLOBALES
// ==========================================

let videos = [];
let playlists = [];
let devices = [];
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;

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
            VIDEOS: { 
                LIST: `${apiUrl}/videos`,
                GET_BY_ID: (id) => `${apiUrl}/videos/${id}`,
                DELETE: (id) => `${apiUrl}/videos/${id}`
            },
            PLAYLISTS: {
                LIST: `${apiUrl}/playlists`,
                GET_BY_ID: (id) => `${apiUrl}/playlists/${id}`,
                DELETE: (id) => `${apiUrl}/playlists/${id}`
            },
            DEVICES: {
                LIST: `${apiUrl}/devices`,
                GET_BY_ID: (id) => `${apiUrl}/devices/${id}`,
                DELETE: (id) => `${apiUrl}/devices/${id}`
            }
        };
    }
    return window.API_CONFIG;
}

// Asegurar configuración disponible
const API_CONFIG = ensureApiConfig();

// ==========================================
// INICIALIZACIÓN DEL SISTEMA
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 Inicializando interfaz principal...');
    
    // Determinar qué vista estamos cargando basado en la URL o elementos presentes
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('videos') || document.getElementById('videosList')) {
        console.log('📺 Cargando vista de videos...');
        loadVideos();
    }
    
    if (currentPath.includes('playlists') || document.getElementById('playlistsList')) {
        console.log('🎵 Cargando vista de playlists...');
        loadPlaylists();
    }
    
    if (currentPath.includes('devices') || document.getElementById('devicesList')) {
        console.log('📱 Cargando vista de dispositivos...');
        loadDevices();
    }
    
    // Configurar event listeners globales
    setupGlobalEventListeners();
    
    console.log('✅ Sistema principal inicializado');
});

// ==========================================
// FUNCIONES DE CARGA DE DATOS
// ==========================================

/**
 * Cargar lista de videos
 */
async function loadVideos() {
    console.log('📺 Cargando videos...');
    
    const videosList = document.getElementById('videosList');
    const videosLoading = document.getElementById('videosLoading');
    
    if (!videosList) {
        console.log('📺 Elemento videosList no encontrado, salteando carga');
        return;
    }
    
    // Mostrar loading
    if (videosLoading) {
        videosLoading.style.display = 'block';
    }
    
    try {
        const response = await safeFetch(API_CONFIG.VIDEOS.LIST);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudieron cargar los videos`);
        }
        
        const data = await response.json();
        videos = Array.isArray(data) ? data : (data.videos || []);
        
        console.log('✅ Videos cargados:', videos.length);
        
        renderVideos();
        showToast(`${videos.length} videos cargados correctamente`, 'success');
        
    } catch (error) {
        console.error('❌ Error cargando videos:', error);
        
        if (videosList) {
            videosList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Error al cargar videos</strong><br>
                            ${error.message}
                        </div>
                    </td>
                </tr>
            `;
        }
        
        showToast(`Error al cargar videos: ${error.message}`, 'error');
    } finally {
        if (videosLoading) {
            videosLoading.style.display = 'none';
        }
    }
}

/**
 * Cargar lista de playlists
 */
async function loadPlaylists() {
    console.log('🎵 Cargando playlists...');
    
    const playlistsList = document.getElementById('playlistsList');
    const playlistsLoading = document.getElementById('playlistsLoading');
    
    if (!playlistsList) {
        console.log('🎵 Elemento playlistsList no encontrado, salteando carga');
        return;
    }
    
    // Mostrar loading
    if (playlistsLoading) {
        playlistsLoading.style.display = 'block';
    }
    
    try {
        const response = await safeFetch(API_CONFIG.PLAYLISTS.LIST);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudieron cargar las playlists`);
        }
        
        const data = await response.json();
        playlists = Array.isArray(data) ? data : (data.playlists || []);
        
        console.log('✅ Playlists cargadas:', playlists.length);
        
        renderPlaylists();
        showToast(`${playlists.length} playlists cargadas correctamente`, 'success');
        
    } catch (error) {
        console.error('❌ Error cargando playlists:', error);
        
        if (playlistsList) {
            playlistsList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Error al cargar listas</strong><br>
                            ${error.message}
                        </div>
                    </td>
                </tr>
            `;
        }
        
        showToast(`Error al cargar listas: ${error.message}`, 'error');
    } finally {
        if (playlistsLoading) {
            playlistsLoading.style.display = 'none';
        }
    }
}

/**
 * Cargar lista de dispositivos
 */
async function loadDevices() {
    console.log('📱 Cargando dispositivos...');
    
    const devicesList = document.getElementById('devicesList');
    const devicesLoading = document.getElementById('devicesLoading');
    
    if (!devicesList) {
        console.log('📱 Elemento devicesList no encontrado, salteando carga');
        return;
    }
    
    // Mostrar loading
    if (devicesLoading) {
        devicesLoading.style.display = 'block';
    }
    
    try {
        const response = await safeFetch(API_CONFIG.DEVICES.LIST);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudieron cargar los dispositivos`);
        }
        
        const data = await response.json();
        devices = Array.isArray(data) ? data : (data.devices || []);
        
        console.log('✅ Dispositivos cargados:', devices.length);
        
        renderDevices();
        showToast(`${devices.length} dispositivos cargados correctamente`, 'success');
        
    } catch (error) {
        console.error('❌ Error cargando dispositivos:', error);
        
        if (devicesList) {
            devicesList.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-5">
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Error al cargar dispositivos</strong><br>
                            ${error.message}
                        </div>
                    </td>
                </tr>
            `;
        }
        
        showToast(`Error al cargar dispositivos: ${error.message}`, 'error');
    } finally {
        if (devicesLoading) {
            devicesLoading.style.display = 'none';
        }
    }
}

// ==========================================
// FUNCIONES DE RENDERIZADO
// ==========================================

/**
 * Renderizar lista de videos
 */
function renderVideos() {
    const videosList = document.getElementById('videosList');
    if (!videosList) return;
    
    if (videos.length === 0) {
        videosList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5">
                    <div class="text-muted">
                        <i class="fas fa-video fa-3x mb-3"></i>
                        <p class="mb-0">No hay videos disponibles</p>
                        <small>Sube tu primer video para comenzar</small>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const videosHTML = videos.map(video => {
        const duration = formatDuration(video.duration);
        const uploadDate = formatDate(video.upload_date);
        
        return `
            <tr class="video-row" data-video-id="${video.id}">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="video-thumbnail me-3">
                            <i class="fas fa-play-circle fa-2x text-primary"></i>
                        </div>
                        <div>
                            <h6 class="mb-1">${escapeHtml(video.title)}</h6>
                            <small class="text-muted">ID: ${video.id}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="text-muted">${video.description ? escapeHtml(video.description) : 'Sin descripción'}</span>
                </td>
                <td>
                    <small class="text-muted">${duration}</small>
                </td>
                <td>
                    <small class="text-muted">${uploadDate}</small>
                </td>
                <td>
                    <span class="badge ${video.is_active ? 'bg-success' : 'bg-secondary'}">
                        ${video.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="previewVideo(${video.id})" title="Vista previa">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="editVideo(${video.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteVideo(${video.id})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    videosList.innerHTML = videosHTML;
}

/**
 * Renderizar lista de playlists
 */
function renderPlaylists() {
    const playlistsList = document.getElementById('playlistsList');
    if (!playlistsList) return;
    
    if (playlists.length === 0) {
        playlistsList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5">
                    <div class="text-muted">
                        <i class="fas fa-list-alt fa-3x mb-3"></i>
                        <p class="mb-0">No hay listas de reproducción</p>
                        <small>Crea tu primera lista para comenzar</small>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const playlistsHTML = playlists.map(playlist => {
        const isActive = isPlaylistActive(playlist);
        const isExpired = playlist.expiration_date && new Date(playlist.expiration_date) < new Date();
        const videoCount = playlist.videos ? playlist.videos.length : 0;
        const creationDate = formatDate(playlist.creation_date);
        
        return `
            <tr class="playlist-row" data-playlist-id="${playlist.id}">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="playlist-thumbnail me-3">
                            <i class="fas fa-list-alt fa-2x text-primary"></i>
                        </div>
                        <div>
                            <h6 class="mb-1">${escapeHtml(playlist.title)}</h6>
                            <small class="text-muted">ID: ${playlist.id}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="text-muted">${playlist.description ? escapeHtml(playlist.description) : 'Sin descripción'}</span>
                </td>
                <td>
                    <small class="text-muted">${creationDate}</small>
                    ${playlist.expiration_date ? `<br><small class="text-${isExpired ? 'danger' : 'info'}">${isExpired ? 'Expiró' : 'Expira'}: ${formatDate(playlist.expiration_date)}</small>` : ''}
                </td>
                <td>
                    <span class="badge bg-info">${videoCount}</span>
                </td>
                <td>
                    <span class="badge ${isActive && !isExpired ? 'bg-success' : isExpired ? 'bg-danger' : 'bg-secondary'}">
                        ${isExpired ? 'Expirada' : isActive ? 'Activa' : 'Inactiva'}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="openPlaylistDetail(${playlist.id})" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="editPlaylist(${playlist.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deletePlaylist(${playlist.id})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    playlistsList.innerHTML = playlistsHTML;
}

/**
 * Renderizar lista de dispositivos
 */
function renderDevices() {
    const devicesList = document.getElementById('devicesList');
    if (!devicesList) return;
    
    if (devices.length === 0) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5">
                    <div class="text-muted">
                        <i class="fas fa-mobile-alt fa-3x mb-3"></i>
                        <p class="mb-0">No hay dispositivos registrados</p>
                        <small>Registra tu primer dispositivo para comenzar</small>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const devicesHTML = devices.map(device => {
        const lastSeen = device.last_seen ? formatDate(device.last_seen) : 'Nunca';
        const isOnline = device.is_online || false;
        
        return `
            <tr class="device-row" data-device-id="${device.id}">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="device-icon me-3">
                            <i class="fas fa-mobile-alt fa-2x text-primary"></i>
                        </div>
                        <div>
                            <h6 class="mb-1">${escapeHtml(device.name)}</h6>
                            <small class="text-muted">${device.identifier}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="text-muted">${device.description ? escapeHtml(device.description) : 'Sin descripción'}</span>
                </td>
                <td>
                    <small class="text-muted">${lastSeen}</small>
                </td>
                <td>
                    <span class="badge ${isOnline ? 'bg-success' : 'bg-secondary'}">
                        ${isOnline ? 'En línea' : 'Desconectado'}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="viewDevice(${device.id})" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="editDevice(${device.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteDevice(${device.id})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    devicesList.innerHTML = devicesHTML;
}

// ==========================================
// FUNCIONES DE ACCIÓN - VIDEOS
// ==========================================

/**
 * Vista previa de video
 */
function previewVideo(videoId) {
    console.log('▶️ Vista previa de video:', videoId);
    
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

/**
 * Editar video
 */
function editVideo(videoId) {
    console.log('✏️ Editando video:', videoId);
    window.location.href = `/ui/edit_video?id=${videoId}`;
}

/**
 * Eliminar video
 */
async function deleteVideo(videoId) {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    
    const confirmMessage = `¿Estás seguro de que quieres eliminar el video "${video.title}"?\n\nEsta acción no se puede deshacer.`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        showToast('Eliminando video...', 'info');
        
        const response = await safeFetch(API_CONFIG.VIDEOS.DELETE(videoId), {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudo eliminar el video`);
        }
        
        showToast('Video eliminado correctamente', 'success');
        
        // Recargar la lista
        await loadVideos();
        
    } catch (error) {
        console.error('❌ Error eliminando video:', error);
        showToast(`Error al eliminar video: ${error.message}`, 'error');
    }
}

// ==========================================
// FUNCIONES DE ACCIÓN - PLAYLISTS
// ==========================================

/**
 * Ver detalles de playlist
 */
function openPlaylistDetail(playlistId) {
    console.log('👁️ Abriendo detalles de playlist:', playlistId);
    window.location.href = `/ui/playlist_detail?id=${playlistId}`;
}

/**
 * Editar playlist
 */
function editPlaylist(playlistId) {
    console.log('✏️ Editando playlist:', playlistId);
    window.location.href = `/ui/edit_playlist?id=${playlistId}`;
}

/**
 * Eliminar playlist
 */
async function deletePlaylist(playlistId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    const confirmMessage = `¿Estás seguro de que quieres eliminar la playlist "${playlist.title}"?\n\nEsta acción no se puede deshacer.`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        showToast('Eliminando playlist...', 'info');
        
        const response = await safeFetch(API_CONFIG.PLAYLISTS.DELETE(playlistId), {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudo eliminar la playlist`);
        }
        
        showToast('Playlist eliminada correctamente', 'success');
        
        // Recargar la lista
        await loadPlaylists();
        
    } catch (error) {
        console.error('❌ Error eliminando playlist:', error);
        showToast(`Error al eliminar playlist: ${error.message}`, 'error');
    }
}

// ==========================================
// FUNCIONES DE ACCIÓN - DISPOSITIVOS
// ==========================================

/**
 * Ver detalles de dispositivo
 */
function viewDevice(deviceId) {
    console.log('👁️ Viendo dispositivo:', deviceId);
    window.location.href = `/ui/device_detail?id=${deviceId}`;
}

/**
 * Editar dispositivo
 */
function editDevice(deviceId) {
    console.log('✏️ Editando dispositivo:', deviceId);
    window.location.href = `/ui/edit_device?id=${deviceId}`;
}

/**
 * Eliminar dispositivo
 */
async function deleteDevice(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;
    
    const confirmMessage = `¿Estás seguro de que quieres eliminar el dispositivo "${device.name}"?\n\nEsta acción no se puede deshacer.`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        showToast('Eliminando dispositivo...', 'info');
        
        const response = await safeFetch(API_CONFIG.DEVICES.DELETE(deviceId), {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudo eliminar el dispositivo`);
        }
        
        showToast('Dispositivo eliminado correctamente', 'success');
        
        // Recargar la lista
        await loadDevices();
        
    } catch (error) {
        console.error('❌ Error eliminando dispositivo:', error);
        showToast(`Error al eliminar dispositivo: ${error.message}`, 'error');
    }
}

// ==========================================
// EVENT LISTENERS GLOBALES
// ==========================================

function setupGlobalEventListeners() {
    // Búsqueda en tiempo real para videos
    const videoSearchInput = document.getElementById('videoSearchInput');
    if (videoSearchInput) {
        videoSearchInput.addEventListener('input', debounce(filterVideos, 300));
    }
    
    // Búsqueda en tiempo real para playlists
    const playlistSearchInput = document.getElementById('playlistSearchInput');
    if (playlistSearchInput) {
        playlistSearchInput.addEventListener('input', debounce(filterPlaylists, 300));
    }
    
    // Búsqueda en tiempo real para dispositivos
    const deviceSearchInput = document.getElementById('deviceSearchInput');
    if (deviceSearchInput) {
        deviceSearchInput.addEventListener('input', debounce(filterDevices, 300));
    }
    
    // Botones de actualización
    const refreshButtons = document.querySelectorAll('[data-action="refresh"]');
    refreshButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.getAttribute('data-type');
            switch (type) {
                case 'videos': loadVideos(); break;
                case 'playlists': loadPlaylists(); break;
                case 'devices': loadDevices(); break;
                default: location.reload();
            }
        });
    });
}

// ==========================================
// FUNCIONES DE FILTRADO
// ==========================================

function filterVideos(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    console.log('🔍 Filtrando videos:', searchTerm);
    
    const filteredVideos = videos.filter(video => 
        video.title.toLowerCase().includes(searchTerm) ||
        (video.description && video.description.toLowerCase().includes(searchTerm))
    );
    
    // Temporalmente reemplazar la lista global para el renderizado
    const originalVideos = videos;
    videos = filteredVideos;
    renderVideos();
    videos = originalVideos;
}

function filterPlaylists(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    console.log('🔍 Filtrando playlists:', searchTerm);
    
    const filteredPlaylists = playlists.filter(playlist => 
        playlist.title.toLowerCase().includes(searchTerm) ||
        (playlist.description && playlist.description.toLowerCase().includes(searchTerm))
    );
    
    // Temporalmente reemplazar la lista global para el renderizado
    const originalPlaylists = playlists;
    playlists = filteredPlaylists;
    renderPlaylists();
    playlists = originalPlaylists;
}

function filterDevices(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    console.log('🔍 Filtrando dispositivos:', searchTerm);
    
    const filteredDevices = devices.filter(device => 
        device.name.toLowerCase().includes(searchTerm) ||
        device.identifier.toLowerCase().includes(searchTerm) ||
        (device.description && device.description.toLowerCase().includes(searchTerm))
    );
    
    // Temporalmente reemplazar la lista global para el renderizado
    const originalDevices = devices;
    devices = filteredDevices;
    renderDevices();
    devices = originalDevices;
}

// ==========================================
// FUNCIONES UTILITARIAS
// ==========================================

function isPlaylistActive(playlist) {
    return playlist.is_active === true || playlist.is_active === 1;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

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

// Exponer funciones globalmente para compatibilidad
window.loadVideos = loadVideos;
window.loadPlaylists = loadPlaylists;
window.loadDevices = loadDevices;
window.openPlaylistDetail = openPlaylistDetail;
window.editPlaylist = editPlaylist;
window.deletePlaylist = deletePlaylist;
window.previewVideo = previewVideo;
window.editVideo = editVideo;
window.deleteVideo = deleteVideo;
window.viewDevice = viewDevice;
window.editDevice = editDevice;
window.deleteDevice = deleteDevice;

console.log('✅ Script principal cargado correctamente (sin Mixed Content)');