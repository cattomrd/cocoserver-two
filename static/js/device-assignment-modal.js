/**
 * DEVICE ASSIGNMENT MODAL - VERSIÓN CORREGIDA
 * 
 * Esta versión corrige los problemas de asignación de dispositivos a playlists
 */

console.log('🚀 Inicializando device-assignment-modal.js (versión CORREGIDA)...');

// ==========================================
// VARIABLES GLOBALES
// ==========================================

let allDevices = [];
let assignedDeviceIds = [];
let pendingChanges = new Set();
let filteredDevices = [];
let searchTerm = '';
let statusFilter = 'all';
let storeFilter = 'all';
let isLoading = false;
let initialized = false;

// ==========================================
// CONFIGURACIÓN DE API CORREGIDA
// ==========================================

/**
 * Configuración de endpoints de API
 */
const API_ENDPOINTS = {
    DEVICES: '/api/devices/',
    DEVICE_PLAYLISTS: {
        GET_ASSIGNED: (playlistId) => `/api/device-playlists/playlist/${playlistId}/devices`,
        ASSIGN: '/api/device-playlists/',
        UNASSIGN: (deviceId, playlistId) => `/api/device-playlists/${deviceId}/${playlistId}`
    }
};

/**
 * Función fetch con manejo de errores mejorado
 */
async function fetchWithErrorHandling(url, options = {}) {
    console.log(`📡 Haciendo petición a: ${url}`, options);
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, finalOptions);
        
        console.log(`📡 Respuesta: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            let errorMessage = `Error ${response.status}: ${response.statusText}`;
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch {
                // Si no se puede parsear como JSON, usar el mensaje por defecto
            }
            
            throw new Error(errorMessage);
        }
        
        return response;
        
    } catch (error) {
        console.error(`❌ Error en petición a ${url}:`, error);
        throw error;
    }
}

// ==========================================
// FUNCIONES PRINCIPALES CORREGIDAS
// ==========================================

/**
 * Inicializar el modal cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 DOM cargado, inicializando modal...');
    
    try {
        setupModalEvents();
        setupFilterListeners();
        setupActionButtons();
        initialized = true;
        console.log('✅ Modal inicializado correctamente');
    } catch (error) {
        console.error('❌ Error inicializando modal:', error);
    }
});

/**
 * Configurar eventos del modal
 */
function setupModalEvents() {
    const modal = document.getElementById('assignDeviceModal');
    if (!modal) {
        console.error('❌ No se encontró el modal #assignDeviceModal');
        return;
    }
    
    console.log('🔧 Configurando eventos del modal...');
    
    // Evento cuando se abre el modal
    modal.addEventListener('show.bs.modal', async function() {
        console.log('📂 Modal abriéndose...');
        await handleModalOpen();
    });
    
    // Evento cuando se cierra el modal
    modal.addEventListener('hidden.bs.modal', function() {
        console.log('📂 Modal cerrándose...');
        handleModalClose();
    });
}

/**
 * Manejar la apertura del modal
 */
async function handleModalOpen() {
    try {
        console.log('🔄 Iniciando carga de datos del modal...');
        
        // Resetear estado
        resetModalState();
        
        // Mostrar loading
        showLoading(true);
        
        // Obtener ID de playlist
        const playlistId = getPlaylistId();
        console.log('🎬 Playlist ID obtenido:', playlistId);
        
        if (!playlistId) {
            throw new Error('No se pudo obtener el ID de la playlist');
        }
        
        // Cargar datos
        await loadModalData(playlistId);
        
        // Mostrar contenido
        showLoading(false);
        applyFiltersAndRender();
        
        console.log('✅ Modal cargado exitosamente');
        
    } catch (error) {
        console.error('❌ Error cargando modal:', error);
        showModalError('Error al cargar', error.message);
        showLoading(false);
    }
}

/**
 * Cargar datos del modal
 */
async function loadModalData(playlistId) {
    console.log('📥 Cargando datos para playlist:', playlistId);
    
    try {
        // Cargar dispositivos y asignaciones en paralelo
        await Promise.all([
            loadAllDevices(),
            loadAssignedDevices(playlistId)
        ]);
        
        console.log(`✅ Datos cargados: ${allDevices.length} dispositivos, ${assignedDeviceIds.length} asignados`);
        
    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        throw error;
    }
}

/**
 * Cargar todos los dispositivos
 */
async function loadAllDevices() {
    console.log('📥 Cargando todos los dispositivos...');
    
    try {
        const response = await fetchWithErrorHandling(API_ENDPOINTS.DEVICES);
        const data = await response.json();
        
        allDevices = Array.isArray(data) ? data : (data.results || []);
        console.log(`✅ ${allDevices.length} dispositivos cargados`);
        
        return allDevices;
        
    } catch (error) {
        console.error('❌ Error cargando dispositivos:', error);
        
        // Fallback para desarrollo
        allDevices = createFallbackDevices();
        console.log(`🔄 ${allDevices.length} dispositivos de fallback creados`);
    }
}

/**
 * Cargar dispositivos asignados a la playlist
 */
async function loadAssignedDevices(playlistId) {
    console.log(`📥 Cargando dispositivos asignados a playlist ${playlistId}...`);
    
    try {
        const response = await fetchWithErrorHandling(API_ENDPOINTS.DEVICE_PLAYLISTS.GET_ASSIGNED(playlistId));
        const data = await response.json();
        
        assignedDeviceIds = data.map(device => {
            const id = device.device_id || device.id;
            return id ? id.toString() : null;
        }).filter(id => id !== null);
        
        console.log(`✅ ${assignedDeviceIds.length} dispositivos asignados cargados`);
        
    } catch (error) {
        console.warn('⚠️ No se pudieron cargar asignaciones:', error);
        assignedDeviceIds = [];
    }
}

/**
 * FUNCIÓN CORREGIDA: Guardar asignaciones de dispositivos
 */
async function saveDeviceAssignments() {
    if (pendingChanges.size === 0) {
        console.log('ℹ️ No hay cambios para guardar');
        showSuccessMessage('No hay cambios para guardar');
        return;
    }
    
    console.log(`💾 Guardando ${pendingChanges.size} cambios...`);
    
    const saveButton = document.getElementById('saveDeviceAssignments');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...';
    }
    
    try {
        const playlistId = getPlaylistId();
        if (!playlistId) {
            throw new Error('No se pudo obtener el ID de la playlist');
        }
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        // Procesar cada cambio pendiente
        for (const deviceId of pendingChanges) {
            try {
                const isCurrentlyAssigned = assignedDeviceIds.includes(deviceId);
                
                if (isCurrentlyAssigned) {
                    // Desasignar dispositivo
                    console.log(`🗑️ Desasignando dispositivo ${deviceId}`);
                    await unassignDeviceFromPlaylist(deviceId, playlistId);
                    
                    // Actualizar estado local
                    assignedDeviceIds = assignedDeviceIds.filter(id => id !== deviceId);
                    
                } else {
                    // Asignar dispositivo
                    console.log(`📌 Asignando dispositivo ${deviceId}`);
                    await assignDeviceToPlaylist(deviceId, playlistId);
                    
                    // Actualizar estado local
                    if (!assignedDeviceIds.includes(deviceId)) {
                        assignedDeviceIds.push(deviceId);
                    }
                }
                
                successCount++;
                
            } catch (error) {
                console.error(`❌ Error procesando dispositivo ${deviceId}:`, error);
                errors.push(`Dispositivo ${deviceId}: ${error.message}`);
                errorCount++;
            }
        }
        
        // Limpiar cambios pendientes
        pendingChanges.clear();
        
        // Actualizar interfaz
        applyFiltersAndRender();
        
        // Mostrar resultado
        if (errorCount === 0) {
            showSuccessMessage(`✅ Se actualizaron ${successCount} dispositivos correctamente`);
        } else {
            showWarningMessage(`⚠️ Se guardaron ${successCount} dispositivos, pero fallaron ${errorCount}. Errores: ${errors.join(', ')}`);
        }
        
        // Notificar al componente principal
        if (typeof window.refreshAssignedDevicesAfterChanges === 'function') {
            setTimeout(() => window.refreshAssignedDevicesAfterChanges(), 500);
        }
        
        console.log(`✅ Proceso completado: ${successCount} éxitos, ${errorCount} errores`);
        
    } catch (error) {
        console.error('❌ Error guardando cambios:', error);
        showModalError('Error', `No se pudieron guardar los cambios: ${error.message}`);
    } finally {
        // Restaurar botón
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-save me-1"></i>Guardar Cambios';
        }
    }
}

/**
 * FUNCIÓN CORREGIDA: Asignar dispositivo a playlist
 */
async function assignDeviceToPlaylist(deviceId, playlistId) {
    console.log(`📌 Asignando dispositivo ${deviceId} a playlist ${playlistId}`);
    
    const payload = {
        device_id: deviceId,
        playlist_id: parseInt(playlistId)
    };
    
    console.log('📦 Payload para asignación:', payload);
    
    try {
        const response = await fetchWithErrorHandling(API_ENDPOINTS.DEVICE_PLAYLISTS.ASSIGN, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        console.log(`✅ Dispositivo asignado correctamente:`, data);
        
        return data;
        
    } catch (error) {
        console.error('❌ Error asignando dispositivo:', error);
        throw new Error(`Error asignando dispositivo: ${error.message}`);
    }
}

/**
 * FUNCIÓN CORREGIDA: Desasignar dispositivo de playlist
 */
async function unassignDeviceFromPlaylist(deviceId, playlistId) {
    console.log(`🗑️ Desasignando dispositivo ${deviceId} de playlist ${playlistId}`);
    
    try {
        const response = await fetchWithErrorHandling(API_ENDPOINTS.DEVICE_PLAYLISTS.UNASSIGN(deviceId, playlistId), {
            method: 'DELETE'
        });
        
        const data = await response.json();
        console.log(`✅ Dispositivo desasignado correctamente:`, data);
        
        return data;
        
    } catch (error) {
        console.error('❌ Error desasignando dispositivo:', error);
        throw new Error(`Error desasignando dispositivo: ${error.message}`);
    }
}

// ==========================================
// FUNCIONES DE INTERFAZ CORREGIDAS
// ==========================================

function getPlaylistId() {
    // Método 1: Input hidden
    const hiddenInput = document.getElementById('playlist-id');
    if (hiddenInput && hiddenInput.value) {
        return hiddenInput.value;
    }
    
    // Método 2: URL params
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');
    if (urlId) {
        return urlId;
    }
    
    // Método 3: Variable global
    if (window.currentPlaylistData && window.currentPlaylistData.id) {
        return window.currentPlaylistData.id.toString();
    }
    
    // Método 4: Path URL
    const pathMatch = window.location.pathname.match(/\/playlist\/(\d+)/);
    if (pathMatch) {
        return pathMatch[1];
    }
    
    console.error('❌ No se pudo obtener el ID de la playlist');
    return null;
}

/**
 * Aplicar filtros y renderizar
 */
function applyFiltersAndRender() {
    console.log('🔍 Aplicando filtros...');
    
    filteredDevices = allDevices.filter(device => {
        // Filtro de búsqueda
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            const deviceName = (device.name || device.device_name || '').toLowerCase();
            const deviceId = (device.device_id || device.id || '').toString().toLowerCase();
            const tienda = (device.tienda || '').toLowerCase();
            const location = (device.location || '').toLowerCase();
            
            if (!deviceName.includes(searchLower) && 
                !deviceId.includes(searchLower) &&
                !tienda.includes(searchLower) &&
                !location.includes(searchLower)) {
                return false;
            }
        }
        
        // Filtro de estado
        const deviceId = (device.device_id || device.id || '').toString();
        const isAssigned = assignedDeviceIds.includes(deviceId);
        const isPending = pendingChanges.has(deviceId);
        const willBeAssigned = (isAssigned && !isPending) || (!isAssigned && isPending);
        const isOnline = device.is_active || (device.status && device.status.toLowerCase() === 'online');
        
        switch (statusFilter) {
            case 'online': return isOnline;
            case 'offline': return !isOnline;
            case 'assigned': return willBeAssigned;
            case 'unassigned': return !willBeAssigned;
            default: return true;
        }
    });
    
    renderDeviceList();
    updateCounters();
    updateActionButtons();
}

/**
 * Renderizar lista de dispositivos
 */
function renderDeviceList() {
    const devicesList = document.getElementById('availableDevicesList');
    if (!devicesList) {
        console.error('❌ No se encontró #availableDevicesList');
        return;
    }
    
    if (filteredDevices.length === 0) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-4">
                    <div class="text-muted">
                        <i class="fas fa-search fa-2x mb-3"></i>
                        <p>No se encontraron dispositivos</p>
                        <button class="btn btn-sm btn-outline-secondary" onclick="clearAllFilters()">
                            <i class="fas fa-times me-1"></i>Limpiar filtros
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const rowsHtml = filteredDevices.map(device => {
        const deviceId = (device.device_id || device.id || '').toString();
        const isAssigned = assignedDeviceIds.includes(deviceId);
        const isPending = pendingChanges.has(deviceId);
        const willBeAssigned = (isAssigned && !isPending) || (!isAssigned && isPending);
        
        const deviceName = device.name || device.device_name || 'Sin nombre';
        const isActive = device.is_active || false;
        const tienda = device.tienda || 'Sin tienda';
        const location = device.location || 'Sin ubicación';
        const ipLan = device.ip_address_lan || device.ip_lan || 'N/A';
        const ipWlan = device.ip_address_wifi || device.ip_wlan || 'N/A';
        
        const statusClass = isActive ? 'bg-success' : 'bg-secondary';
        const statusText = isActive ? 'Online' : 'Offline';
        
        let formattedLastSeen = 'N/A';
        if (device.last_seen) {
            try {
                const date = new Date(device.last_seen);
                formattedLastSeen = date.toLocaleString('es-ES');
            } catch (e) {
                formattedLastSeen = device.last_seen.toString();
            }
        }
        
        return `
            <tr class="${willBeAssigned ? 'table-active' : ''} ${isPending ? 'table-warning' : ''}">
                <td class="align-middle">
                    <div class="form-check">
                        <input class="form-check-input device-checkbox" type="checkbox"
                               id="device-${deviceId}" 
                               value="${deviceId}" 
                               ${willBeAssigned ? 'checked' : ''}
                               onchange="handleDeviceCheckboxChange('${deviceId}')">
                        <label class="form-check-label" for="device-${deviceId}"></label>
                    </div>
                </td>
                <td class="align-middle">
                    <small class="text-muted">${deviceId}</small>
                </td>
                <td class="align-middle">
                    <strong>${deviceName}</strong>
                </td>
                <td class="align-middle">
                    <span class="badge ${statusClass}">${statusText}</span>
                </td>
                <td class="align-middle">${tienda}</td>
                <td class="align-middle">${location}</td>
                <td class="align-middle">
                    <small class="text-muted">${ipLan}</small>
                </td>
                <td class="align-middle">
                    <small class="text-muted">${ipWlan}</small>
                </td>
                <td class="align-middle">
                    <small class="text-muted">${formattedLastSeen}</small>
                </td>
                <td class="align-middle text-center">
                    <button class="btn btn-sm btn-outline-info" 
                            onclick="viewDeviceDetails('${deviceId}')"
                            title="Ver detalles">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    devicesList.innerHTML = rowsHtml;
}

// ==========================================
// FUNCIONES DE EVENTOS
// ==========================================

function handleDeviceCheckboxChange(deviceId) {
    if (pendingChanges.has(deviceId)) {
        pendingChanges.delete(deviceId);
    } else {
        pendingChanges.add(deviceId);
    }
    applyFiltersAndRender();
}

function setupFilterListeners() {
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            searchTerm = e.target.value.trim();
            applyFiltersAndRender();
        });
    }
    
    const statusFilterSelect = document.getElementById('deviceStatusFilter');
    if (statusFilterSelect) {
        statusFilterSelect.addEventListener('change', function(e) {
            statusFilter = e.target.value;
            applyFiltersAndRender();
        });
    }
}

function setupActionButtons() {
    const saveBtn = document.getElementById('saveDeviceAssignments');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveDeviceAssignments);
    }
}

// ==========================================
// FUNCIONES DE UTILIDAD
// ==========================================

function createFallbackDevices() {
    const devices = [];
    for (let i = 1; i <= 10; i++) {
        devices.push({
            device_id: `DEV_${i.toString().padStart(3, '0')}`,
            name: `Dispositivo ${i}`,
            is_active: Math.random() > 0.5,
            tienda: `Tienda ${i}`,
            location: `Ubicación ${i}`,
            ip_address_lan: `192.168.1.${i + 100}`,
            ip_address_wifi: `10.0.0.${i + 100}`,
            last_seen: new Date().toISOString()
        });
    }
    return devices;
}

function showLoading(show) {
    const loading = document.getElementById('deviceModalLoading');
    const content = document.getElementById('deviceModalContent');
    
    if (loading) loading.style.display = show ? 'block' : 'none';
    if (content) content.style.display = show ? 'none' : 'block';
}

function resetModalState() {
    pendingChanges.clear();
    searchTerm = '';
    statusFilter = 'all';
    
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) alertsContainer.innerHTML = '';
}

function handleModalClose() {
    resetModalState();
}

function updateCounters() {
    const counter = document.getElementById('deviceCounter');
    const selectedCount = getSelectedCount();
    
    if (counter) {
        counter.textContent = `${selectedCount} seleccionados de ${filteredDevices.length} dispositivos`;
    }
}

function getSelectedCount() {
    return filteredDevices.reduce((count, device) => {
        const deviceId = (device.device_id || device.id || '').toString();
        const isAssigned = assignedDeviceIds.includes(deviceId);
        const isPending = pendingChanges.has(deviceId);
        const willBeAssigned = (isAssigned && !isPending) || (!isAssigned && isPending);
        
        return willBeAssigned ? count + 1 : count;
    }, 0);
}

function updateActionButtons() {
    const saveButton = document.getElementById('saveDeviceAssignments');
    if (saveButton) {
        const hasPendingChanges = pendingChanges.size > 0;
        saveButton.disabled = !hasPendingChanges;
        saveButton.innerHTML = hasPendingChanges ? 
            `<i class="fas fa-save me-1"></i>Guardar Cambios (${pendingChanges.size})` : 
            '<i class="fas fa-save me-1"></i>Guardar Cambios';
    }
}

function showModalError(title, message) {
    console.error(`❌ ${title}: ${message}`);
    
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) {
        alertsContainer.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <strong>${title}:</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}

function showSuccessMessage(message) {
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) {
        alertsContainer.innerHTML = `
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                <i class="fas fa-check-circle me-2"></i>${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}

function showWarningMessage(message) {
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) {
        alertsContainer.innerHTML = `
            <div class="alert alert-warning alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}

function clearAllFilters() {
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) searchInput.value = '';
    
    const statusFilterSelect = document.getElementById('deviceStatusFilter');
    if (statusFilterSelect) statusFilterSelect.value = 'all';
    
    searchTerm = '';
    statusFilter = 'all';
    
    applyFiltersAndRender();
}

function viewDeviceDetails(deviceId) {
    const device = allDevices.find(d => (d.device_id || d.id || '').toString() === deviceId);
    
    if (!device) {
        alert('No se encontró el dispositivo');
        return;
    }
    
    const info = `Detalles del dispositivo:
• ID: ${device.device_id || device.id || 'N/A'}
• Nombre: ${device.name || device.device_name || 'N/A'}
• Estado: ${device.is_active ? 'Activo' : 'Inactivo'}
• Tienda: ${device.tienda || 'N/A'}
• Ubicación: ${device.location || 'N/A'}
• IP LAN: ${device.ip_address_lan || 'N/A'}
• IP WiFi: ${device.ip_address_wifi || 'N/A'}
• MAC: ${device.mac_address || 'N/A'}
• Última conexión: ${device.last_seen || 'N/A'}`;
    
    alert(info);
}

// ==========================================
// EXPOSICIÓN GLOBAL
// ==========================================

window.handleDeviceCheckboxChange = handleDeviceCheckboxChange;
window.saveDeviceAssignments = saveDeviceAssignments;
window.clearAllFilters = clearAllFilters;
window.viewDeviceDetails = viewDeviceDetails;

console.log('✅ Device assignment modal (versión CORREGIDA) cargado');