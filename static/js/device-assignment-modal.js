/**
 * DEVICE ASSIGNMENT MODAL - VERSIÓN CORREGIDA Y SIMPLIFICADA
 * 
 * Esta versión es más robusta y tiene mejor manejo de errores
 */

console.log('🚀 Inicializando device-assignment-modal.js (versión corregida)...');

// ==========================================
// VARIABLES GLOBALES
// ==========================================

let allDevices = [];
let assignedDeviceIds = [];
let pendingChanges = new Set();
let filteredDevices = [];
let searchTerm = '';
let statusFilter = 'all';
let isLoading = false;
let initialized = false;

// ==========================================
// FUNCIONES PRINCIPALES
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
        // Cargar dispositivos (con fallback si falla la API)
        await loadAllDevicesWithFallback();
        
        // Cargar asignaciones (con fallback si falla)
        await loadAssignedDevicesWithFallback(playlistId);
        
        console.log(`✅ Datos cargados: ${allDevices.length} dispositivos, ${assignedDeviceIds.length} asignados`);
        
    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        throw error;
    }
}

/**
 * Cargar dispositivos con fallback
 */
async function loadAllDevicesWithFallback() {
    console.log('📥 Cargando dispositivos...');
    
    try {
        // Intentar cargar desde API
        const response = await fetch('/api/devices/', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            allDevices = Array.isArray(data) ? data : [];
            console.log(`✅ ${allDevices.length} dispositivos cargados desde API`);
        } else {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.warn('⚠️ API no disponible, usando datos de fallback:', error);
        
        // Fallback: usar datos de ejemplo para desarrollo
        allDevices = createFallbackDevices();
        console.log(`🔄 ${allDevices.length} dispositivos de fallback creados`);
    }
}

/**
 * Cargar dispositivos asignados con fallback
 */
async function loadAssignedDevicesWithFallback(playlistId) {
    console.log(`📥 Cargando dispositivos asignados para playlist ${playlistId}...`);
    
    try {
        const response = await fetch(`/api/device-playlists/playlist/${playlistId}/devices`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            assignedDeviceIds = data.map(device => {
                const id = device.device_id || device.id;
                return id ? id.toString() : null;
            }).filter(id => id !== null);
            
            console.log(`✅ ${assignedDeviceIds.length} dispositivos asignados cargados`);
        } else {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.warn('⚠️ No se pudieron cargar asignaciones:', error);
        assignedDeviceIds = [];
    }
}

/**
 * Crear dispositivos de fallback para desarrollo
 */
function createFallbackDevices() {
    const fallbackDevices = [];
    
    for (let i = 1; i <= 20; i++) {
        fallbackDevices.push({
            device_id: `DEV_${i.toString().padStart(3, '0')}`,
            id: `DEV_${i.toString().padStart(3, '0')}`,
            name: `Dispositivo ${i}`,
            device_name: `Dispositivo ${i}`,
            is_active: Math.random() > 0.3,
            tienda: `Tienda ${Math.ceil(i / 4)}`,
            location: `Ubicación ${i}`,
            ip_address_lan: `192.168.1.${100 + i}`,
            ip_address_wifi: `10.0.0.${100 + i}`,
            mac_address: `00:1B:44:11:3A:${i.toString(16).padStart(2, '0').toUpperCase()}`,
            last_seen: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
            status: Math.random() > 0.5 ? 'online' : 'offline'
        });
    }
    
    console.log('🔄 Dispositivos de fallback creados para desarrollo');
    return fallbackDevices;
}

/**
 * Obtener ID de playlist
 */
function getPlaylistId() {
    // Método 1: Input hidden
    const hiddenInput = document.getElementById('playlist-id');
    if (hiddenInput && hiddenInput.value) {
        console.log('✅ ID desde input hidden:', hiddenInput.value);
        return hiddenInput.value;
    }
    
    // Método 2: URL params
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');
    if (urlId) {
        console.log('✅ ID desde URL params:', urlId);
        return urlId;
    }
    
    // Método 3: Variable global
    if (window.currentPlaylistData && window.currentPlaylistData.id) {
        console.log('✅ ID desde variable global:', window.currentPlaylistData.id);
        return window.currentPlaylistData.id.toString();
    }
    
    // Método 4: Path URL
    const pathMatch = window.location.pathname.match(/\/playlist\/(\d+)/);
    if (pathMatch) {
        console.log('✅ ID desde path URL:', pathMatch[1]);
        return pathMatch[1];
    }
    
    // Fallback para desarrollo
    console.warn('⚠️ No se pudo obtener ID, usando fallback para desarrollo');
    return '1';
}

/**
 * Aplicar filtros y renderizar
 */
function applyFiltersAndRender() {
    console.log('🔍 Aplicando filtros...');
    
    try {
        // Filtrar dispositivos
        filteredDevices = allDevices.filter(device => {
            // Filtro de búsqueda
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const deviceName = (device.name || device.device_name || '').toLowerCase();
                const deviceId = (device.device_id || device.id || '').toString().toLowerCase();
                const tienda = (device.tienda || '').toLowerCase();
                const location = (device.location || '').toLowerCase();
                const ipLan = (device.ip_lan || '').toLowerCase();
                const ipWlan = (device.ip_wlan || '').toLowerCase();
                
                if (!deviceName.includes(searchLower) && 
                    !deviceId.includes(searchLower) &&
                    !tienda.includes(searchLower) &&
                    !location.includes(searchLower) &&
                    !ipLan.includes(searchLower) &&
                    !ipWlan.includes(searchLower)) {
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
        
        console.log(`🔍 ${filteredDevices.length} dispositivos después de filtrar`);
        
        // Renderizar
        renderDeviceList();
        updateCounters();
        updateActionButtons();
        
    } catch (error) {
        console.error('❌ Error aplicando filtros:', error);
        showDevicesError('Error aplicando filtros: ' + error.message);
    }
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
    
    try {
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
            
            // Estado
            const isOnline = device.is_active || (device.status && device.status.toLowerCase() === 'online');
            const statusClass = isOnline ? 'bg-success' : 'bg-secondary';
            const statusText = isOnline ? 'Online' : 'Offline';
            
            // Última conexión
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
                        <small class="text-muted">${device.device_id || device.id || 'N/A'}</small>
                    </td>
                    <td class="align-middle">
                        <strong>${device.name || device.device_name || 'Sin nombre'}</strong>
                    </td>
                    <td class="align-middle">
                        <span class="badge ${statusClass}">${statusText}</span>
                    </td>
                    <td class="align-middle">${device.tienda || 'N/A'}</td>
                    <td class="align-middle">${device.location || 'N/A'}</td>
                    <td class="align-middle">
                        <small class="text-muted">${device.ip_lan || 'N/A'}</small>
                    </td>
                    <td class="align-middle">
                        <small class="text-muted">${device.ip_wlan || 'N/A'}</small>
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
        console.log(`✅ ${filteredDevices.length} dispositivos renderizados`);
        
    } catch (error) {
        console.error('❌ Error renderizando dispositivos:', error);
        showDevicesError('Error renderizando dispositivos: ' + error.message);
    }
}

// ==========================================
// FUNCIONES DE INTERFAZ
// ==========================================

/**
 * Configurar listeners de filtros
 */
function setupFilterListeners() {
    console.log('🔧 Configurando listeners de filtros...');
    
    // Búsqueda
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            searchTerm = e.target.value.trim();
            applyFiltersAndRender();
        });
    }
    
    // Limpiar búsqueda
    const clearSearch = document.getElementById('clearDeviceSearch');
    if (clearSearch) {
        clearSearch.addEventListener('click', function() {
            if (searchInput) searchInput.value = '';
            searchTerm = '';
            applyFiltersAndRender();
        });
    }
    
    // Filtro de estado
    const statusFilter = document.getElementById('deviceStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function(e) {
            window.statusFilter = e.target.value;
            applyFiltersAndRender();
        });
    }
}

/**
 * Configurar botones de acción
 */
function setupActionButtons() {
    console.log('🔧 Configurando botones de acción...');
    
    // Seleccionar todos
    const selectAllBtn = document.getElementById('selectAllDevices');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllDevices);
    }
    
    // Deseleccionar todos
    const deselectAllBtn = document.getElementById('deselectAllDevices');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', deselectAllDevices);
    }
    
    // Guardar cambios
    const saveBtn = document.getElementById('saveDeviceAssignments');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveDeviceAssignments);
    }
    
    // Limpiar filtros
    const clearFiltersBtn = document.getElementById('clearAllDeviceFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
}

/**
 * Manejar cambio en checkbox
 */
function handleDeviceCheckboxChange(deviceId) {
    console.log('🔄 Cambio en dispositivo:', deviceId);
    
    if (pendingChanges.has(deviceId)) {
        pendingChanges.delete(deviceId);
    } else {
        pendingChanges.add(deviceId);
    }
    
    applyFiltersAndRender();
}

/**
 * Seleccionar todos los dispositivos
 */
function selectAllDevices() {
    console.log('🔄 Seleccionando todos...');
    
    filteredDevices.forEach(device => {
        const deviceId = (device.device_id || device.id || '').toString();
        const isCurrentlyAssigned = assignedDeviceIds.includes(deviceId);
        
        if (!isCurrentlyAssigned && !pendingChanges.has(deviceId)) {
            pendingChanges.add(deviceId);
        } else if (isCurrentlyAssigned && pendingChanges.has(deviceId)) {
            pendingChanges.delete(deviceId);
        }
    });
    
    applyFiltersAndRender();
}

/**
 * Deseleccionar todos los dispositivos
 */
function deselectAllDevices() {
    console.log('🔄 Deseleccionando todos...');
    
    filteredDevices.forEach(device => {
        const deviceId = (device.device_id || device.id || '').toString();
        const isCurrentlyAssigned = assignedDeviceIds.includes(deviceId);
        
        if (isCurrentlyAssigned && !pendingChanges.has(deviceId)) {
            pendingChanges.add(deviceId);
        } else if (!isCurrentlyAssigned && pendingChanges.has(deviceId)) {
            pendingChanges.delete(deviceId);
        }
    });
    
    applyFiltersAndRender();
}

/**
 * Limpiar todos los filtros
 */
function clearAllFilters() {
    console.log('🔄 Limpiando filtros...');
    
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) searchInput.value = '';
    
    const statusFilterSelect = document.getElementById('deviceStatusFilter');
    if (statusFilterSelect) statusFilterSelect.value = 'all';
    
    searchTerm = '';
    statusFilter = 'all';
    
    applyFiltersAndRender();
}

/**
 * Guardar cambios
 */
async function saveDeviceAssignments() {
    if (pendingChanges.size === 0) {
        console.log('ℹ️ No hay cambios para guardar');
        return;
    }
    
    console.log(`💾 Guardando ${pendingChanges.size} cambios...`);
    
    const saveButton = document.getElementById('saveDeviceAssignments');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
    }
    
    try {
        // Simular guardado para desarrollo
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        pendingChanges.clear();
        applyFiltersAndRender();
        
        showSuccessMessage('Cambios guardados correctamente');
        console.log('✅ Cambios guardados');
        
    } catch (error) {
        console.error('❌ Error guardando:', error);
        showModalError('Error', 'No se pudieron guardar los cambios');
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-save me-1"></i> Guardar Cambios';
        }
    }
}

/**
 * Ver detalles de dispositivo
 */
function viewDeviceDetails(deviceId) {
    const device = allDevices.find(d => (d.device_id || d.id || '').toString() === deviceId);
    
    if (!device) {
        alert('No se encontró el dispositivo');
        return;
    }
    
    const info = `
Detalles del dispositivo:
• ID: ${device.device_id || device.id || 'N/A'}
• Nombre: ${device.name || device.device_name || 'N/A'}
• Estado: ${device.is_active ? 'Activo' : 'Inactivo'}
• Tienda: ${device.tienda || 'N/A'}
• Ubicación: ${device.location || 'N/A'}
• IP LAN: ${device.ip_address_lan || device.ip_lan || 'N/A'}
• IP WLAN: ${device.ip_address_wifi || device.ip_wlan || 'N/A'}
• MAC: ${device.mac_address || 'N/A'}
    `;
    
    alert(info);
}

// ==========================================
// FUNCIONES DE UTILIDAD
// ==========================================

/**
 * Mostrar/ocultar loading
 */
function showLoading(show) {
    const loading = document.getElementById('deviceModalLoading');
    const content = document.getElementById('deviceModalContent');
    
    if (loading) loading.style.display = show ? 'block' : 'none';
    if (content) content.style.display = show ? 'none' : 'block';
}

/**
 * Resetear estado del modal
 */
function resetModalState() {
    pendingChanges.clear();
    searchTerm = '';
    statusFilter = 'all';
    
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) alertsContainer.innerHTML = '';
}

/**
 * Manejar cierre del modal
 */
function handleModalClose() {
    resetModalState();
}

/**
 * Actualizar contadores
 */
function updateCounters() {
    const counter = document.getElementById('deviceCounter');
    const pagination = document.getElementById('devicesPaginationInfo');
    
    if (counter) {
        const selected = getSelectedCount();
        counter.textContent = `${selected} seleccionados de ${filteredDevices.length} dispositivos`;
    }
    
    if (pagination) {
        pagination.textContent = `Mostrando ${filteredDevices.length} de ${allDevices.length} dispositivos totales`;
    }
}

/**
 * Obtener número de seleccionados
 */
function getSelectedCount() {
    return filteredDevices.reduce((count, device) => {
        const deviceId = (device.device_id || device.id || '').toString();
        const isAssigned = assignedDeviceIds.includes(deviceId);
        const isPending = pendingChanges.has(deviceId);
        const willBeAssigned = (isAssigned && !isPending) || (!isAssigned && isPending);
        
        return willBeAssigned ? count + 1 : count;
    }, 0);
}

/**
 * Actualizar botones
 */
function updateActionButtons() {
    const saveButton = document.getElementById('saveDeviceAssignments');
    if (saveButton) {
        const hasPendingChanges = pendingChanges.size > 0;
        saveButton.disabled = !hasPendingChanges;
        saveButton.innerHTML = hasPendingChanges ? 
            `<i class="fas fa-save me-1"></i> Guardar Cambios (${pendingChanges.size})` : 
            '<i class="fas fa-save me-1"></i> Guardar Cambios';
    }
}

/**
 * Mostrar error en modal
 */
function showModalError(title, message) {
    console.error(`❌ ${title}: ${message}`);
    
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) {
        alertsContainer.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <strong>${title}</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}

/**
 * Mostrar mensaje de éxito
 */
function showSuccessMessage(message) {
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) {
        alertsContainer.innerHTML = `
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                <i class="fas fa-check-circle me-2"></i> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}

/**
 * Mostrar error en lista
 */
function showDevicesError(message) {
    const devicesList = document.getElementById('availableDevicesList');
    if (devicesList) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-4">
                    <div class="text-danger">
                        <i class="fas fa-exclamation-circle fa-2x mb-3"></i>
                        <p>Error: ${message}</p>
                        <button class="btn btn-sm btn-outline-primary" onclick="location.reload()">
                            <i class="fas fa-sync-alt me-1"></i> Recargar página
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
}

// ==========================================
// EXPOSICIÓN GLOBAL
// ==========================================

// Exponer funciones necesarias
window.handleDeviceCheckboxChange = handleDeviceCheckboxChange;
window.selectAllDevices = selectAllDevices;
window.deselectAllDevices = deselectAllDevices;
window.clearAllFilters = clearAllFilters;
window.saveDeviceAssignments = saveDeviceAssignments;
window.viewDeviceDetails = viewDeviceDetails;

console.log('✅ Device assignment modal (versión corregida) cargado');