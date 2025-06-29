/**
 * DASHBOARD-FIX.JS - Corrección para problemas de Mixed Content en dashboard
 * 
 * Este script corrige el problema de "Mixed Content" que ocurre cuando
 * se intenta cargar recursos HTTP desde una página HTTPS.
 * 
 * Actualización: Ahora también respeta los límites de la API (máximo 1000 items)
 */

// ==========================================
// CONFIGURACIÓN SEGURA DE APIS
// ==========================================

// Asegurar que siempre usamos el protocolo correcto (HTTPS o HTTP)
// basándonos en el protocolo actual de la página
const secureApiUrl = () => {
    // Usar el origen de la ventana actual que incluye el protocolo correcto
    return window.location.origin + '/api';
};

// Definir endpoints seguros que usarán el protocolo correcto
const SECURE_API_ENDPOINTS = {
    videos: `${secureApiUrl()}/videos`,
    playlists: `${secureApiUrl()}/playlists`,
    devices: `${secureApiUrl()}/devices`,
    users: `${secureApiUrl()}/users`,
    statistics: `${secureApiUrl()}/statistics`
};

// Límites de la API
const API_LIMITS = {
    maxItems: 1000 // Límite máximo de items permitido por la API
};

console.log('🔧 Inicializando corrección para dashboard...');

// ==========================================
// FUNCIÓN SAFEFETCH - IMPLEMENTACIÓN SEGURA DE FETCH
// ==========================================

/**
 * Implementación segura de fetch que corrige URLs para evitar Mixed Content
 * @param {string} url - URL a consultar
 * @param {object} options - Opciones para fetch
 * @returns {Promise} - Promesa con la respuesta
 */
window.safeFetch = async function(url, options = {}) {
    console.log(`🔄 safeFetch: ${options.method || 'GET'} ${url}`);
    
    try {
        // Verificar si es una URL absoluta y si usa HTTP en vez de HTTPS
        if (url.startsWith('http:') && window.location.protocol === 'https:') {
            console.log('⚠️ Detectada URL HTTP en página HTTPS, corrigiendo...');
            
            // Si es del mismo dominio, usar URL relativa
            if (url.includes(window.location.hostname)) {
                const urlObj = new URL(url);
                url = urlObj.pathname + urlObj.search;
                console.log('🔧 URL corregida a relativa:', url);
            } else {
                // Si es de otro dominio, convertir a HTTPS
                url = url.replace('http:', 'https:');
                console.log('🔧 URL corregida a HTTPS:', url);
            }
        }
        
        // Realizar la petición
        const response = await fetch(url, options);
        
        // Verificar respuesta
        if (!response.ok) {
            // Si hay un error HTTP, obtener más información
            const contentType = response.headers.get('content-type');
            let errorMessage = `Error HTTP ${response.status}`;
            
            // Intentar parsear el error como JSON si corresponde
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                
                // Formatear mensaje de error para errores de validación (422)
                if (response.status === 422 && errorData.detail && Array.isArray(errorData.detail)) {
                    const validationErrors = errorData.detail.map(err => {
                        if (err.loc && err.loc.length > 1 && err.loc[0] === 'query' && err.loc[1] === 'limit') {
                            return `El límite máximo es ${err.ctx?.le || 1000} items`;
                        }
                        return err.msg || 'Error de validación';
                    }).join(', ');
                    
                    errorMessage = `Error de validación: ${validationErrors}`;
                } else {
                    errorMessage = `Error ${response.status}: ${JSON.stringify(errorData)}`;
                }
            } else {
                // Si no es JSON, obtener el texto de error
                const errorText = await response.text();
                errorMessage = `Error ${response.status}: ${errorText}`;
            }
            
            throw new Error(errorMessage);
        }
        
        return response;
    } catch (error) {
        console.error('❌ Error en safeFetch:', error);
        throw error;
    }
};

// ==========================================
// REEMPLAZAR FUNCIONES DEL DASHBOARD
// ==========================================

// Guardar referencia a las funciones originales si existen
const originalLoadStatistics = window.loadStatistics;
const originalUpdateSystemStatus = window.updateSystemStatus;

/**
 * Función corregida para cargar estadísticas
 */
window.loadStatistics = async function() {
    console.log('📊 Cargando estadísticas del dashboard...');
    
    try {
        // Usar safeFetch para evitar problemas de Mixed Content
        
        // Load videos count - usando limit=1 para optimizar la consulta
        const videosResponse = await window.safeFetch(`${secureApiUrl()}/videos?limit=1`);
        if (videosResponse.ok) {
            const videosData = await videosResponse.json();
            const totalVideosElement = document.getElementById('totalVideos');
            if (totalVideosElement) {
                // Si la API devuelve un campo "total_count", usarlo; de lo contrario, mostrar la longitud
                const totalCount = videosData.total_count || videosData.length || 0;
                totalVideosElement.textContent = totalCount;
            }
        }

        // Load playlists count - usando limit=1 para optimizar la consulta
        const playlistsResponse = await window.safeFetch(`${secureApiUrl()}/playlists?limit=1`);
        if (playlistsResponse.ok) {
            const playlistsData = await playlistsResponse.json();
            const totalPlaylistsElement = document.getElementById('totalPlaylists');
            if (totalPlaylistsElement) {
                // Si la API devuelve un campo "total_count", usarlo; de lo contrario, mostrar la longitud
                const totalCount = playlistsData.total_count || playlistsData.length || 0;
                totalPlaylistsElement.textContent = totalCount;
            }
        }

        // Load devices count - esta consulta suele ser pequeña y no necesita un límite
        const devicesResponse = await window.safeFetch(`${secureApiUrl()}/devices`);
        if (devicesResponse.ok) {
            const devicesData = await devicesResponse.json();
            const totalDevicesElement = document.getElementById('totalDevices');
            if (totalDevicesElement) {
                totalDevicesElement.textContent = devicesData.length || 0;
            }
            
            // Update device status
            const activeDevices = devicesData.filter(d => d.is_online).length;
            const activeDevicesElement = document.getElementById('activeDevices');
            if (activeDevicesElement) {
                activeDevicesElement.textContent = `${activeDevices}/${devicesData.length}`;
            }
            
            const deviceProgressElement = document.getElementById('deviceProgress');
            if (deviceProgressElement && devicesData.length > 0) {
                const percentage = (activeDevices / devicesData.length) * 100;
                deviceProgressElement.style.width = percentage + '%';
            }
        }

    } catch (error) {
        console.error('❌ Error cargando estadísticas:', error);
        showToast('Error cargando estadísticas del dashboard', 'error');
    }
};

/**
 * Función corregida para actualizar el estado del sistema
 */
window.updateSystemStatus = function() {
    console.log('🔄 Actualizando estado del sistema...');
    
    // Update API status usando safeFetch con limit=1 para optimizar
    window.safeFetch(`${secureApiUrl()}/videos?limit=1`)
        .then(response => {
            const statusElement = document.getElementById('apiStatus');
            if (statusElement) {
                if (response.ok) {
                    statusElement.textContent = 'Online';
                    statusElement.className = 'badge bg-success';
                } else {
                    statusElement.textContent = 'Error';
                    statusElement.className = 'badge bg-danger';
                }
            }
        })
        .catch(() => {
            const statusElement = document.getElementById('apiStatus');
            if (statusElement) {
                statusElement.textContent = 'Offline';
                statusElement.className = 'badge bg-danger';
            }
        });

    // Simulate storage usage
    const storageUsage = Math.floor(Math.random() * 80) + 10; // 10-90%
    const storageUsageElement = document.getElementById('storageUsage');
    if (storageUsageElement) {
        storageUsageElement.textContent = storageUsage + '%';
    }
    
    const storageProgressElement = document.getElementById('storageProgress');
    if (storageProgressElement) {
        storageProgressElement.style.width = storageUsage + '%';
    }
    
    const totalStorageElement = document.getElementById('totalStorage');
    if (totalStorageElement) {
        totalStorageElement.textContent = storageUsage + '%';
    }
};

// ==========================================
// FUNCIÓN PARA MOSTRAR TOASTS
// ==========================================

/**
 * Muestra un toast con un mensaje
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de toast (success, error, info, warning)
 */
window.showToast = window.showToast || function(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Si Bootstrap está disponible, crear un toast
    if (typeof bootstrap !== 'undefined') {
        // Crear elemento toast
        const toastContainer = document.getElementById('toastContainer') || createToastContainer();
        const toastId = 'toast-' + Date.now();
        
        const bgClass = {
            'success': 'bg-success',
            'error': 'bg-danger',
            'warning': 'bg-warning',
            'info': 'bg-info'
        }[type] || 'bg-info';
        
        const icon = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        }[type] || 'fa-info-circle';
        
        // Crear elemento HTML
        const toastElement = document.createElement('div');
        toastElement.id = toastId;
        toastElement.className = `toast align-items-center text-white ${bgClass} border-0`;
        toastElement.setAttribute('role', 'alert');
        toastElement.setAttribute('aria-live', 'assertive');
        toastElement.setAttribute('aria-atomic', 'true');
        
        toastElement.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas ${icon} me-2"></i> ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        toastContainer.appendChild(toastElement);
        
        // Mostrar toast
        const toast = new bootstrap.Toast(toastElement, {
            animation: true,
            autohide: true,
            delay: 3000
        });
        
        toast.show();
    }
};

/**
 * Crea un contenedor para toasts si no existe
 */
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}

console.log('✅ Corrección para dashboard cargada correctamente');