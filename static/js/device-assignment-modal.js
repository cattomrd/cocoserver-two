/**
 * DEVICE ASSIGNMENT MODAL - Gestión de Asignación de Dispositivos a Playlists
 *
 * Este archivo contiene toda la funcionalidad para el modal que permite
 * asignar y desasignar dispositivos a listas de reproducción.
 *
 * Endpoints utilizados:
 * - GET /api/devices/ - Obtener todos los dispositivos
 * - GET /api/device-playlists/playlist/{playlist_id}/devices - Obtener dispositivos asignados
 * - POST /api/device-playlists/ - Asignar dispositivo a playlist
 * - DELETE /api/device-playlists/{device_id}/{playlist_id} - Desasignar dispositivo
 */

console.log('🚀 Inicializando módulo de asignación de dispositivos...');

// ==========================================
// VARIABLES GLOBALES
// ==========================================

// Estado del modal
let allDevices = [];
let assignedDeviceIds = [];
let pendingChanges = new Set();
let filteredDevices = [];

// Estado de filtros
let searchTerm = '';
let statusFilter = 'all';

// Estado de carga
let isLoading = false;
let initialized = false;

// ==========================================
// CONFIGURACIÓN DE API
// ==========================================

/**
 * Construir URL de API
 * @param {string} endpoint - Endpoint de la API
 * @returns {string} URL completa
 */
function buildApiUrl(endpoint) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
}

// Endpoints de la API
const API = {
    DEVICES: {
        LIST: buildApiUrl('/devices/'),
    },
    DEVICE_PLAYLISTS: {
        ASSIGN: buildApiUrl('/device-playlists/'),
        UNASSIGN: (deviceId, playlistId) => buildApiUrl(`/device-playlists/${deviceId}/${playlistId}`),
        GET_DEVICES: (playlistId) => buildApiUrl(`/device-playlists/playlist/${playlistId}/devices`)
    }
};

// ==========================================
// FUNCIONES DE RED
// ==========================================

/**
 * Realizar petición fetch con manejo de errores
 * @param {string} url - URL a la que realizar la petición
 * @param {Object} options - Opciones para fetch
 * @returns {Promise} Promesa con la respuesta
 */
async function fetchWithErrorHandling(url, options = {}) {
    console.log(`📡 Fetch a: ${url}`, options.method || 'GET');
    
    const defaultOptions = {
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        // Si la respuesta no es exitosa, intentar obtener mensaje de error
        if (!response.ok) {
            let errorMsg = `Error ${response.status}: ${response.statusText}`;
            
            try {
                // Intentar obtener mensaje de error del cuerpo
                const errorBody = await response.json();
                if (errorBody.detail) {
                    errorMsg = errorBody.detail;
                }
            } catch (e) {
                // Si no es JSON, intentar obtener texto
                try {
                    const errorText = await response.text();
                    if (errorText) {
                        errorMsg = errorText;
                    }
                } catch (textError) {
                    // Si tampoco podemos obtener texto, usar mensaje genérico
                }
            }
            
            throw new Error(errorMsg);
        }
        
        return response;
    } catch (error) {
        console.error('❌ Error en fetch:', error);
        throw error;
    }
}

// ==========================================
// FUNCIONES PRINCIPALES
// ==========================================

/**
 * Inicializar el modal de asignación de dispositivos
 */
async function initializeDeviceAssignmentModal() {
    if (initialized) return;
    
    console.log('🔧 Inicializando modal de asignación de dispositivos...');
    
    try {
        // Configurar eventos del modal
        setupModalEvents();
        
        // Configurar listeners para filtros
        setupFilterListeners();
        
        // Configurar botones de acción
        setupActionButtons();
        
        initialized = true;
        console.log('✅ Modal inicializado correctamente');
    } catch (error) {
        console.error('❌ Error inicializando modal:', error);
        showModalError('Error de inicialización', error.message);
    }
}

/**
 * Configurar eventos del modal
 */
function setupModalEvents() {
    const modal = document.getElementById('assignDeviceModal');
    if (!modal) {
        console.error('❌ No se encontró el elemento modal #assignDeviceModal');
        return;
    }
    
    // Cuando se abre el modal
    modal.addEventListener('show.bs.modal', async () => {
        console.log('📂 Modal abriéndose...');
        resetModalState();
        showLoading(true);
        
        try {
            // Obtener ID de la playlist
            const playlistId = getPlaylistId();
            if (!playlistId) {
                throw new Error('No se pudo obtener el ID de la playlist');
            }
            
            console.log(`🎬 Cargando datos para playlist ID: ${playlistId}`);
            
            // Cargar datos en paralelo
            await Promise.all([
                loadAllDevices(),
                loadAssignedDevices(playlistId)
            ]);
            
            // Aplicar filtros y mostrar dispositivos
            applyFiltersAndRender();
            
            showLoading(false);
        } catch (error) {
            console.error('❌ Error al cargar datos:', error);
            showModalError('Error al cargar datos', error.message);
            showLoading(false);
        }
    });
    
    // Cuando se cierra el modal
    modal.addEventListener('hidden.bs.modal', () => {
        console.log('📂 Modal cerrándose...');
        resetModalState();
    });
}



/**
 * Cargar todos los dispositivos
 */
async function loadAllDevices() {
    if (isLoading) return;
    
    console.log('📥 Cargando todos los dispositivos...');
    isLoading = true;
    
    try {
        const response = await fetchWithErrorHandling(API.DEVICES.LIST);
        const data = await response.json();
        
        allDevices = Array.isArray(data) ? data : [];
        console.log(`✅ ${allDevices.length} dispositivos cargados`);
        
        return allDevices;
    } catch (error) {
        console.error('❌ Error cargando dispositivos:', error);
        showDevicesError(`Error cargando dispositivos: ${error.message}`);
        throw error;
    } finally {
        isLoading = false;
    }
}

/**
 * Cargar dispositivos asignados a la playlist
 * @param {string} playlistId - ID de la playlist
 */
async function loadAssignedDevices(playlistId) {
    console.log(`📥 Cargando dispositivos asignados a playlist ${playlistId}...`);
    
    try {
        const response = await fetchWithErrorHandling(API.DEVICE_PLAYLISTS.GET_DEVICES(playlistId));
        const data = await response.json();
        
        // Extraer IDs de dispositivos
        assignedDeviceIds = data.map(device => {
            // Asegurarse de que tenemos el ID correcto
            const id = device.device_id || device.id;
            return id ? id.toString() : null;
        }).filter(id => id !== null);
        
        console.log(`✅ ${assignedDeviceIds.length} dispositivos asignados:`, assignedDeviceIds);
        
        return assignedDeviceIds;
    } catch (error) {
        console.error('❌ Error cargando dispositivos asignados:', error);
        showDevicesError(`Error cargando dispositivos asignados: ${error.message}`);
        throw error;
    }
}

/**
 * Aplicar filtros y renderizar la lista de dispositivos
 */
function applyFiltersAndRender() {
    console.log('🔍 Aplicando filtros...');
    
    // Filtrar dispositivos según criterios
    filteredDevices = allDevices.filter(device => {
        // Filtrar por término de búsqueda
        if (searchTerm) {
            const deviceName = (device.name || device.device_name || '').toLowerCase();
            const deviceLocation = (device.location || device.tienda || '').toLowerCase();
            const deviceId = (device.device_id || device.id || '').toString().toLowerCase();
            
            if (!deviceName.includes(searchTerm.toLowerCase()) && 
                !deviceLocation.includes(searchTerm.toLowerCase()) &&
                !deviceId.includes(searchTerm.toLowerCase())) {
                return false;
            }
        }
        
        // Determinar estado del dispositivo para filtrado
        const deviceId = (device.device_id || device.id || '').toString();
        const isAssigned = assignedDeviceIds.includes(deviceId);
        const isPending = pendingChanges.has(deviceId);
        const willBeAssigned = (isAssigned && !isPending) || (!isAssigned && isPending);
        
        // Determinar si está online/offline para filtrado
        let isOnline = false;
        if (device.status) {
            const status = device.status.toLowerCase();
            isOnline = (status === 'online' || status === 'connected' || status === 'active');
        } else if (device.is_active === true || device.active === true) {
            isOnline = true;
        }
        
        // Aplicar filtro según selección
        switch (statusFilter) {
            case 'online':
                return isOnline;
            case 'offline':
                return !isOnline;
            case 'assigned':
                return willBeAssigned;
            case 'unassigned':
                return !willBeAssigned;
            default:
                return true;
        }
    });
    
    console.log(`🔍 ${filteredDevices.length} dispositivos después de filtrar`);
    
    // Renderizar la lista
    renderDeviceList();
    
    // Actualizar contadores y estado de botones
    updateDeviceCounter();
    updateActionButtonsState();
}

/**
 * Renderizar la lista de dispositivos
 */
function renderDeviceList() {
    const devicesList = document.getElementById('availableDevicesList');
    if (!devicesList) {
        console.error('❌ No se encontró el elemento #availableDevicesList');
        return;
    }
    
    // Si no hay dispositivos después de filtrar
    if (filteredDevices.length === 0) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="text-muted">
                        <i class="fas fa-search fa-2x mb-3"></i>
                        <p>No se encontraron dispositivos con los filtros actuales</p>
                        <button class="btn btn-sm btn-outline-secondary" onclick="clearAllDeviceFilters()">
                            <i class="fas fa-times me-1"></i>Limpiar filtros
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Construir filas HTML
    const rowsHtml = filteredDevices.map(device => {
        const deviceId = (device.device_id || device.id || '').toString();
        const isAssigned = assignedDeviceIds.includes(deviceId);
        const isPending = pendingChanges.has(deviceId);
        const willBeAssigned = (isAssigned && !isPending) || (!isAssigned && isPending);
        
        // Determinar estado y clase CSS
        let statusClass = 'bg-secondary';
        let statusText = 'Desconocido';
        
        // Detectar el estado real del dispositivo
        if (device.status) {
            const status = device.status.toLowerCase();
            
            if (status === 'online' || status === 'connected' || status === 'active') {
                statusClass = 'bg-success';
                statusText = 'Online';
            } else if (status === 'offline' || status === 'disconnected' || status === 'inactive') {
                statusClass = 'bg-secondary';
                statusText = 'Offline';
            } else if (status === 'warning' || status === 'pending') {
                statusClass = 'bg-warning text-dark';
                statusText = status.charAt(0).toUpperCase() + status.slice(1);
            } else if (status === 'error' || status === 'failed') {
                statusClass = 'bg-danger';
                statusText = 'Error';
            } else {
                // Otros estados
                statusText = status.charAt(0).toUpperCase() + status.slice(1);
            }
        } else if (device.is_active === true || device.active === true) {
            statusClass = 'bg-success';
            statusText = 'Activo';
        } else if (device.is_active === false || device.active === false) {
            statusClass = 'bg-secondary';
            statusText = 'Inactivo';
        }
        
        // Formatear última conexión
        const lastSeen = device.last_seen || device.updated_at || 'Desconocida';
        let formattedLastSeen = 'Desconocida';
        
        if (typeof lastSeen === 'string') {
            // Intentar formatear la fecha si es una string válida
            try {
                const date = new Date(lastSeen);
                if (!isNaN(date.getTime())) {
                    // Si es una fecha válida, formatearla bien
                    formattedLastSeen = date.toLocaleString('es-ES', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else {
                    formattedLastSeen = lastSeen;
                }
            } catch (e) {
                formattedLastSeen = lastSeen;
            }
        }
        
        return `
            <tr class="${willBeAssigned ? 'table-active' : ''} ${isPending ? 'border-warning' : ''}">
                <td class="align-middle">
                    <div class="form-check">
                        <input class="form-check-input device-checkbox" type="checkbox" 
                               id="device-${deviceId}" 
                               value="${deviceId}" 
                               ${willBeAssigned ? 'checked' : ''}
                               onchange="handleDeviceCheckboxChange('${deviceId}')">
                        <label class="form-check-label" for="device-${deviceId}">
                            ${device.name || device.device_name || 'Sin nombre'}
                        </label>
                        ${isPending ? '<span class="badge bg-warning text-dark ms-2">Cambio pendiente</span>' : ''}
                    </div>
                </td>
                <td class="align-middle">${device.location || device.tienda || 'Sin ubicación'}</td>
                <td class="align-middle">
                    <span class="badge ${statusClass}">${statusText}</span>
                </td>
                <td class="align-middle small">${formattedLastSeen}</td>
                <td class="align-middle">${device.device_id || device.id || 'Sin ID'}</td>
                <td class="align-middle text-end">
                    <button class="btn btn-sm btn-outline-secondary" 
                            onclick="viewDeviceDetails('${deviceId}')">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Actualizar la tabla
    devicesList.innerHTML = rowsHtml;
}

/**
 * Manejar cambio en checkbox de dispositivo
 * @param {string} deviceId - ID del dispositivo
 */
function handleDeviceCheckboxChange(deviceId) {
    console.log(`🔄 Cambio en dispositivo: ${deviceId}`);
    
    // Añadir o quitar del conjunto de cambios pendientes
    if (pendingChanges.has(deviceId)) {
        pendingChanges.delete(deviceId);
    } else {
        pendingChanges.add(deviceId);
    }
    
    // Actualizar UI
    applyFiltersAndRender();
}

/**
 * Guardar cambios en asignaciones de dispositivos
 */
async function saveDeviceAssignments() {
    if (pendingChanges.size === 0) {
        console.log('ℹ️ No hay cambios pendientes para guardar');
        return;
    }
    
    const playlistId = getPlaylistId();
    if (!playlistId) {
        showModalError('Error', 'No se pudo obtener el ID de la playlist');
        return;
    }
    
    console.log(`💾 Guardando cambios para ${pendingChanges.size} dispositivos...`);
    
    // Deshabilitar botón de guardar y mostrar spinner
    const saveButton = document.getElementById('saveDeviceAssignments');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Guardando...
        `;
    }
    
    // Contadores para resultados
    let successCount = 0;
    let errorCount = 0;
    
    try {
        // Procesar cada dispositivo con cambios pendientes
        const promises = Array.from(pendingChanges).map(async (deviceId) => {
            const isCurrentlyAssigned = assignedDeviceIds.includes(deviceId);
            
            try {
                if (isCurrentlyAssigned) {
                    // Desasignar dispositivo
                    await unassignDeviceFromPlaylist(deviceId, playlistId);
                } else {
                    // Asignar dispositivo
                    await assignDeviceToPlaylist(deviceId, playlistId);
                }
                
                successCount++;
                return { success: true, deviceId };
            } catch (error) {
                errorCount++;
                console.error(`❌ Error procesando dispositivo ${deviceId}:`, error);
                return { success: false, deviceId, error };
            }
        });
        
        // Esperar a que todas las operaciones terminen
        const results = await Promise.all(promises);
        
        // Actualizar estado
        pendingChanges.clear();
        await loadAssignedDevices(playlistId);
        applyFiltersAndRender();
        
        // Mostrar mensaje de resultado
        if (errorCount === 0) {
            showSuccessMessage(`Cambios guardados correctamente. Se actualizaron ${successCount} dispositivos.`);
        } else {
            showWarningMessage(`Se guardaron ${successCount} dispositivos, pero fallaron ${errorCount}. Revise la consola para más detalles.`);
        }
        
        // Notificar al componente principal si existe
        if (typeof window.refreshAssignedDevicesAfterChanges === 'function') {
            setTimeout(() => window.refreshAssignedDevicesAfterChanges(), 500);
        }
        
    } catch (error) {
        console.error('❌ Error guardando cambios:', error);
        showModalError('Error', `No se pudieron guardar los cambios: ${error.message}`);
    } finally {
        // Restaurar botón
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = `<i class="fas fa-save me-1"></i> Guardar Cambios`;
        }
    }
}

/**
 * Asignar dispositivo a playlist
 * @param {string} deviceId - ID del dispositivo
 * @param {string} playlistId - ID de la playlist
 */
async function assignDeviceToPlaylist(deviceId, playlistId) {
    console.log(`📌 Asignando dispositivo ${deviceId} a playlist ${playlistId}`);
    
    const payload = {
        device_id: deviceId,
        playlist_id: parseInt(playlistId)
    };
    
    try {
        const response = await fetchWithErrorHandling(API.DEVICE_PLAYLISTS.ASSIGN, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        console.log(`✅ Dispositivo asignado correctamente:`, data);
        
        return data;
    } catch (error) {
        console.error('❌ Error asignando dispositivo:', error);
        throw error;
    }
}

/**
 * Desasignar dispositivo de playlist
 * @param {string} deviceId - ID del dispositivo
 * @param {string} playlistId - ID de la playlist
 */
async function unassignDeviceFromPlaylist(deviceId, playlistId) {
    console.log(`🗑️ Desasignando dispositivo ${deviceId} de playlist ${playlistId}`);
    
    try {
        const response = await fetchWithErrorHandling(API.DEVICE_PLAYLISTS.UNASSIGN(deviceId, playlistId), {
            method: 'DELETE'
        });
        
        const data = await response.json();
        console.log(`✅ Dispositivo desasignado correctamente:`, data);
        
        return data;
    } catch (error) {
        console.error('❌ Error desasignando dispositivo:', error);
        throw error;
    }
}

// ==========================================
// FUNCIONES DE INTERFAZ DE USUARIO
// ==========================================

/**
 * Configurar listeners para filtros
 */
function setupFilterListeners() {
    // Búsqueda
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            searchTerm = e.target.value.trim();
            applyFiltersAndRender();
        }, 300));
    }
    
    // Limpiar búsqueda
    const clearSearch = document.getElementById('clearDeviceSearch');
    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            searchTerm = '';
            applyFiltersAndRender();
        });
    }
    
    // Filtro de estado
    const statusFilterSelect = document.getElementById('deviceStatusFilter');
    if (statusFilterSelect) {
        statusFilterSelect.addEventListener('change', (e) => {
            statusFilter = e.target.value;
            applyFiltersAndRender();
        });
    }
}

/**
 * Configurar botones de acción
 */
function setupActionButtons() {
    // Seleccionar todos
    const selectAllBtn = document.getElementById('selectAllDevices');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', handleSelectAllDevices);
    }
    
    // Deseleccionar todos
    const deselectAllBtn = document.getElementById('deselectAllDevices');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', handleDeselectAllDevices);
    }
    
    // Guardar cambios
    const saveBtn = document.getElementById('saveDeviceAssignments');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveDeviceAssignments);
    }
    
    // Limpiar filtros
    const clearFiltersBtn = document.getElementById('clearAllDeviceFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllDeviceFilters);
    }
}

/**
 * Seleccionar todos los dispositivos filtrados
 */
function handleSelectAllDevices() {
    console.log('🔄 Seleccionando todos los dispositivos filtrados...');
    
    filteredDevices.forEach(device => {
        const deviceId = (device.device_id || device.id || '').toString();
        const isCurrentlyAssigned = assignedDeviceIds.includes(deviceId);
        
        // Si no está asignado, marcarlo para asignar
        if (!isCurrentlyAssigned && !pendingChanges.has(deviceId)) {
            pendingChanges.add(deviceId);
        }
        // Si está asignado y pendiente para desasignar, cancelar ese cambio
        else if (isCurrentlyAssigned && pendingChanges.has(deviceId)) {
            pendingChanges.delete(deviceId);
        }
    });
    
    // Actualizar UI
    applyFiltersAndRender();
}

/**
 * Deseleccionar todos los dispositivos filtrados
 */
function handleDeselectAllDevices() {
    console.log('🔄 Deseleccionando todos los dispositivos filtrados...');
    
    filteredDevices.forEach(device => {
        const deviceId = (device.device_id || device.id || '').toString();
        const isCurrentlyAssigned = assignedDeviceIds.includes(deviceId);
        
        // Si está asignado, marcarlo para desasignar
        if (isCurrentlyAssigned && !pendingChanges.has(deviceId)) {
            pendingChanges.add(deviceId);
        }
        // Si no está asignado y pendiente para asignar, cancelar ese cambio
        else if (!isCurrentlyAssigned && pendingChanges.has(deviceId)) {
            pendingChanges.delete(deviceId);
        }
    });
    
    // Actualizar UI
    applyFiltersAndRender();
}

/**
 * Limpiar todos los filtros
 */
function clearAllDeviceFilters() {
    console.log('🔄 Limpiando todos los filtros...');
    
    // Limpiar búsqueda
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) searchInput.value = '';
    searchTerm = '';
    
    // Resetear filtro de estado
    const statusFilterSelect = document.getElementById('deviceStatusFilter');
    if (statusFilterSelect) statusFilterSelect.value = 'all';
    statusFilter = 'all';
    
    // Actualizar UI
    applyFiltersAndRender();
}

/**
 * Actualizar contador de dispositivos
 */
function updateDeviceCounter() {
    const counter = document.getElementById('deviceCounter');
    if (!counter) return;
    
    const totalDevices = filteredDevices.length;
    const selectedCount = getSelectedDevicesCount();
    
    counter.textContent = `${selectedCount} seleccionados de ${totalDevices} dispositivos`;
}

/**
 * Obtener número de dispositivos seleccionados
 * @returns {number} Número de dispositivos seleccionados
 */
function getSelectedDevicesCount() {
    return filteredDevices.reduce((count, device) => {
        const deviceId = (device.device_id || device.id || '').toString();
        const isAssigned = assignedDeviceIds.includes(deviceId);
        const isPending = pendingChanges.has(deviceId);
        const willBeAssigned = (isAssigned && !isPending) || (!isAssigned && isPending);
        
        return willBeAssigned ? count + 1 : count;
    }, 0);
}

/**
 * Actualizar estado de botones de acción
 */
function updateActionButtonsState() {
    // Botón de guardar
    const saveButton = document.getElementById('saveDeviceAssignments');
    if (saveButton) {
        const hasPendingChanges = pendingChanges.size > 0;
        
        saveButton.disabled = !hasPendingChanges;
        saveButton.innerHTML = hasPendingChanges ? 
            `<i class="fas fa-save me-1"></i> Guardar Cambios (${pendingChanges.size})` : 
            `<i class="fas fa-save me-1"></i> Guardar Cambios`;
    }
}

/**
 * Mostrar mensaje de error en el modal
 * @param {string} title - Título del error
 * @param {string} message - Mensaje de error
 */
function showModalError(title, message) {
    console.error(`❌ Error: ${title} - ${message}`);
    
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (!alertsContainer) {
        alert(`${title}: ${message}`);
        return;
    }
    
    alertsContainer.innerHTML = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            <strong>${title}</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
}

/**
 * Mostrar mensaje de éxito
 * @param {string} message - Mensaje de éxito
 */
function showSuccessMessage(message) {
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (!alertsContainer) return;
    
    alertsContainer.innerHTML = `
        <div class="alert alert-success alert-dismissible fade show" role="alert">
            <i class="fas fa-check-circle me-2"></i> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
}

/**
 * Mostrar mensaje de advertencia
 * @param {string} message - Mensaje de advertencia
 */
function showWarningMessage(message) {
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (!alertsContainer) return;
    
    alertsContainer.innerHTML = `
        <div class="alert alert-warning alert-dismissible fade show" role="alert">
            <i class="fas fa-exclamation-triangle me-2"></i> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
}

/**
 * Mostrar error en la lista de dispositivos
 * @param {string} message - Mensaje de error
 */
function showDevicesError(message) {
    const devicesList = document.getElementById('availableDevicesList');
    if (!devicesList) return;
    
    devicesList.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-4">
                <div class="text-danger">
                    <i class="fas fa-exclamation-circle fa-2x mb-3"></i>
                    <p>Error cargando dispositivos</p>
                    <p class="small mb-3">${message}</p>
                    <button class="btn btn-sm btn-outline-secondary" onclick="loadAllDevices().then(() => applyFiltersAndRender())">
                        <i class="fas fa-sync-alt me-1"></i> Reintentar
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Mostrar u ocultar indicador de carga
 * @param {boolean} show - Mostrar u ocultar
 */
function showLoading(show) {
    const loadingIndicator = document.getElementById('deviceModalLoading');
    const contentContainer = document.getElementById('deviceModalContent');
    
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'block' : 'none';
    }
    
    if (contentContainer) {
        contentContainer.style.display = show ? 'none' : 'block';
    }
}

/**
 * Resetear estado del modal
 */
function resetModalState() {
    // Limpiar datos
    pendingChanges.clear();
    searchTerm = '';
    statusFilter = 'all';
    
    // Limpiar UI
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) searchInput.value = '';
    
    const statusFilterSelect = document.getElementById('deviceStatusFilter');
    if (statusFilterSelect) statusFilterSelect.value = 'all';
    
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) alertsContainer.innerHTML = '';
}

/**
 * Ver detalles de un dispositivo
 * @param {string} deviceId - ID del dispositivo
 */
function viewDeviceDetails(deviceId) {
    console.log(`🔍 Ver detalles del dispositivo: ${deviceId}`);
    
    // Buscar el dispositivo
    const device = allDevices.find(d => (d.device_id || d.id || '').toString() === deviceId);
    
    if (!device) {
        console.error(`❌ No se encontró el dispositivo con ID: ${deviceId}`);
        return;
    }
    
    // Mostrar información en un modal o alert
    alert(`Detalles del dispositivo ${device.name || device.device_name || deviceId}:
- ID: ${device.device_id || device.id || 'N/A'}
- Ubicación: ${device.location || 'N/A'}
- Estado: ${device.status || 'Desconocido'}
- Última conexión: ${device.last_seen || device.updated_at || 'Desconocida'}
- MAC: ${device.mac_address || 'N/A'}`);
}

// ==========================================
// FUNCIONES DE UTILIDAD
// ==========================================

/**
 * Función debounce para limitar frecuencia de llamadas
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} Función con debounce
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

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando device-assignment-modal.js...');
    
    // Esperar un momento para asegurar que todos los elementos estén disponibles
    setTimeout(() => {
        initializeDeviceAssignmentModal();
    }, 100);
});

// ==========================================
// EXPOSICIÓN GLOBAL
// ==========================================

// Exponer funciones al ámbito global
window.initializeDeviceAssignmentModal = initializeDeviceAssignmentModal;
window.handleDeviceCheckboxChange = handleDeviceCheckboxChange;
window.handleSelectAllDevices = handleSelectAllDevices;
window.handleDeselectAllDevices = handleDeselectAllDevices;
window.clearAllDeviceFilters = clearAllDeviceFilters;
window.saveDeviceAssignments = saveDeviceAssignments;
window.viewDeviceDetails = viewDeviceDetails;

console.log('✅ Módulo de asignación de dispositivos cargado correctamente');