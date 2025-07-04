/**
 * DEVICE ASSIGNMENT MODAL - Modal de Asignación de Dispositivos
 * 
 * Este archivo corrige problemas de carga de datos en el modal para asignar/desasignar 
 * dispositivos a listas de reproducción.
 */

console.log('🔧 Cargando módulo del modal de asignación de dispositivos (versión corregida)...');

// ==========================================
// FUNCIONES DE SEGURIDAD HTTPS
// ==========================================

/**
 * Verificar si estamos en un contexto seguro
 */
function isSecureContext() {
    try {
        return window.location.protocol === 'https:' || 
               window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname === '0.0.0.0';
    } catch (error) {
        console.warn('⚠️ [Modal] Error verificando contexto seguro:', error);
        return false;
    }
}

/**
 * Obtener URL base segura
 */
function getSecureBaseUrl() {
    try {
        return window.location.origin;
    } catch (error) {
        console.error('❌ [Modal] Error obteniendo URL base:', error);
        return '';
    }
}

/**
 * Construir URL de API
 */
function buildApiUrl(endpoint = '') {
    const baseUrl = getSecureBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return `${baseUrl}/api${cleanEndpoint}`;
}

/**
 * Realizar petición fetch segura con mejor manejo de errores
 */
async function secureFetch(url, options = {}) {
    try {
        const defaultOptions = {
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
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

        console.log(`🔒 [Modal] Fetch a: ${url}`, finalOptions.method || 'GET');
        const response = await fetch(url, finalOptions);
        
        if (!response.ok) {
            let errorMessage;
            try {
                // Intentar parsear respuesta como JSON
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || `Error HTTP ${response.status}`;
            } catch (e) {
                // Si no es JSON, obtener texto
                const errorText = await response.text();
                errorMessage = errorText || `Error HTTP ${response.status}`;
            }
            throw new Error(errorMessage);
        }
        
        return response;
    } catch (error) {
        console.error(`❌ [Modal] Error en fetch:`, error);
        throw error;
    }
}

// ==========================================
// VARIABLES GLOBALES DEL MODAL
// ==========================================
let allDevicesForAssignment = [];
let filteredDevicesForAssignment = [];
let currentAssignedDeviceIds = [];
let pendingDeviceChanges = new Set();
let isLoadingDevices = false;
let currentSearchTerm = '';
let currentStatusFilter = 'all';

// API Endpoints - Configuración explícita para evitar dependencias
const MODAL_API = {
    DEVICES: {
        LIST: buildApiUrl('/devices'),
        PLAYLIST_DEVICES: (playlistId) => buildApiUrl(`/playlists/${playlistId}/devices`),
        ASSIGN: buildApiUrl('/device-playlists'),
        UNASSIGN: (deviceId, playlistId) => buildApiUrl(`/device-playlists/${deviceId}/${playlistId}`)
    }
};

console.log('🔧 [Modal] API configurada:', MODAL_API);

// ==========================================
// FUNCIONES PRINCIPALES DEL MODAL
// ==========================================

/**
 * Inicializar el modal de asignación de dispositivos
 */
function initializeDeviceAssignmentModal() {
    console.log('🚀 [Modal] Inicializando modal de asignación de dispositivos...');
    
    try {
        // Verificar contexto de seguridad
        const secure = isSecureContext();
        console.log(`🔒 [Modal] Contexto ${secure ? 'seguro' : 'no seguro'}`);
        
        // Configurar eventos del modal
        setupModalEvents();
        
        // Configurar listeners para filtros y búsquedas
        setupFilterListeners();
        
        // Configurar botones de acciones
        setupActionButtons();
        
        console.log('✅ [Modal] Modal inicializado correctamente');
    } catch (error) {
        console.error('❌ [Modal] Error inicializando modal:', error);
        showModalError('Error de inicialización', error.message);
    }
}

/**
 * Configurar eventos del modal
 */
function setupModalEvents() {
    const modal = document.getElementById('assignDeviceModal');
    if (!modal) {
        console.error('❌ [Modal] No se encontró el elemento modal #assignDeviceModal');
        return;
    }
    
    // Cuando se abre el modal
    modal.addEventListener('show.bs.modal', async () => {
        console.log('📂 [Modal] Abriendo modal...');
        
        // Mostrar indicador de carga
        showLoading(true);
        
        try {
            // Obtener ID de la playlist actual
            const playlistId = getPlaylistId();
            if (!playlistId) {
                throw new Error('No se pudo obtener el ID de la playlist');
            }
            
            console.log(`🔍 [Modal] Cargando datos para playlist ID: ${playlistId}`);
            
            // Cargar dispositivos disponibles
            await loadDevicesForAssignment();
            
            // Cargar dispositivos asignados
            await loadCurrentAssignedDevices();
            
            // Actualizar UI con los datos cargados
            updateModalUI();
            
            // Ocultar indicador de carga
            showLoading(false);
        } catch (error) {
            console.error('❌ [Modal] Error al abrir modal:', error);
            showModalError('Error cargando datos', error.message);
            showLoading(false);
        }
    });
    
    // Cuando se cierra el modal
    modal.addEventListener('hidden.bs.modal', () => {
        console.log('📫 [Modal] Cerrando modal...');
        resetModal();
    });
    
    console.log('✅ [Modal] Eventos del modal configurados');
}

/**
 * Cargar dispositivos disponibles para asignación
 */
async function loadDevicesForAssignment() {
    if (isLoadingDevices) return;
    
    console.log('📥 [Modal] Cargando dispositivos disponibles...');
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
        // Realizar petición a la API
        const response = await secureFetch(MODAL_API.DEVICES.LIST);
        
        // Debug para ver la estructura de la respuesta
        const rawData = await response.text();
        console.log(`📋 [Modal] Respuesta raw de API:`, rawData.substring(0, 100) + '...');
        
        // Parsear la respuesta
        const data = JSON.parse(rawData);
        
        console.log(`📋 [Modal] Respuesta de API:`, data);
        
        // Validar la estructura de la respuesta
        if (!data) {
            throw new Error('La API no devolvió datos');
        }
        
        // La respuesta puede ser array directo o objeto con propiedad devices
        allDevicesForAssignment = Array.isArray(data) ? data : (data.devices || []);
        
        if (!Array.isArray(allDevicesForAssignment)) {
            console.error('❌ [Modal] Estructura de datos inválida:', data);
            throw new Error('Formato de datos inválido desde la API');
        }
        
        console.log(`✅ [Modal] ${allDevicesForAssignment.length} dispositivos cargados`);
        
        // Aplicar filtros y mostrar
        filterAndDisplayDevices();
        
    } catch (error) {
        console.error('❌ [Modal] Error cargando dispositivos:', error);
        showDevicesError(error.message);
    } finally {
        isLoadingDevices = false;
    }
}

/**
 * Cargar dispositivos actualmente asignados
 */
async function loadCurrentAssignedDevices() {
    console.log('📋 [Modal] Cargando dispositivos asignados...');
    
    const playlistId = getPlaylistId();
    if (!playlistId) {
        console.error('❌ [Modal] ID de playlist no encontrado');
        return;
    }
    
    try {
        // Intentar la URL principal primero
        const url = MODAL_API.DEVICES.PLAYLIST_DEVICES(playlistId);
        console.log(`🔍 [Modal] Consultando URL: ${url}`);
        
        try {
            const response = await secureFetch(url);
            const assignedDevices = await response.json();
            
            // Extraer IDs de dispositivos asignados
            currentAssignedDeviceIds = assignedDevices.map(device => 
                device.device_id || device.id || device.mac_address
            ).filter(id => id); // Filtrar valores vacíos
            
            console.log(`✅ [Modal] ${currentAssignedDeviceIds.length} dispositivos asignados identificados`);
            
        } catch (error) {
            console.warn(`⚠️ [Modal] Error con URL principal, probando URL alternativa:`, error);
            
            // Probar URL alternativa si la primera falla
            const alternativeUrl = buildApiUrl(`/device-playlists/playlist/${playlistId}/devices`);
            console.log(`🔍 [Modal] Consultando URL alternativa: ${alternativeUrl}`);
            
            const altResponse = await secureFetch(alternativeUrl);
            const assignedDevices = await altResponse.json();
            
            // Extraer IDs de dispositivos asignados
            currentAssignedDeviceIds = assignedDevices.map(device => 
                device.device_id || device.id || device.mac_address
            ).filter(id => id);
            
            console.log(`✅ [Modal] ${currentAssignedDeviceIds.length} dispositivos asignados identificados (alt)`);
        }
        alert(MODAL_API.DEVICES.PLAYLIST_DEVICES(playlistId));
        // Actualizar interfaz de usuario
        updateDeviceCheckboxes();
        
    } catch (error) {
        console.error('❌ [Modal] Error cargando dispositivos asignados:', error);
        showDevicesError(`Error cargando dispositivos asignados: ${error.message}`);
    }
}

/**
 * Filtrar y mostrar dispositivos
 */
function filterAndDisplayDevices() {
    console.log('🔍 [Modal] Filtrando dispositivos...');
    
    // Aplicar filtros actuales
    filteredDevicesForAssignment = allDevicesForAssignment.filter(device => {
        // Filtrar por texto de búsqueda
        if (currentSearchTerm) {
            const searchTermLower = currentSearchTerm.toLowerCase();
            const deviceName = (device.name || device.device_name || '').toLowerCase();
            const deviceLocation = (device.location || device.tienda || '').toLowerCase();
            const deviceMac = (device.mac_address || '').toLowerCase();
            
            if (!deviceName.includes(searchTermLower) && 
                !deviceLocation.includes(searchTermLower) && 
                !deviceMac.includes(searchTermLower)) {
                return false;
            }
        }
        
        // Filtrar por estado
        switch (currentStatusFilter) {
            case 'online':
                return device.status === 'online' || device.status === 'connected';
            case 'offline':
                return device.status === 'offline' || device.status === 'disconnected';
            case 'assigned':
                return currentAssignedDeviceIds.includes(device.id || device.device_id || device.mac_address);
            case 'unassigned':
                return !currentAssignedDeviceIds.includes(device.id || device.device_id || device.mac_address);
            case 'all':
            default:
                return true;
        }
    });
    
    console.log(`🔍 [Modal] ${filteredDevicesForAssignment.length} dispositivos después de filtrar`);
    
    // Actualizar UI
    renderDevicesList();
}

/**
 * Renderizar lista de dispositivos
 */
function renderDevicesList() {
    const devicesList = document.getElementById('availableDevicesList');
    if (!devicesList) {
        console.error('❌ [Modal] No se encontró el elemento para la lista de dispositivos');
        return;
    }
    
    // Si no hay dispositivos después de filtrar
    if (filteredDevicesForAssignment.length === 0) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <h6 class="mt-3">No se encontraron dispositivos</h6>
                        <p class="text-muted small mb-0">Intenta con otros términos de búsqueda o cambia los filtros</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Construir filas HTML
    const rowsHtml = filteredDevicesForAssignment.map(device => {
        const deviceId = device.id || device.device_id || device.mac_address;
        const isAssigned = currentAssignedDeviceIds.includes(deviceId);
        const isPending = pendingDeviceChanges.has(deviceId);
        const willBeAssigned = (isAssigned && !isPending) || (!isAssigned && isPending);
        
        const statusClass = device.status === 'online' || device.status === 'connected' ? 
            'bg-success' : 'bg-secondary';
        
        const lastSeen = device.last_seen || device.updated_at || 'Desconocido';
        const formattedLastSeen = lastSeen instanceof Date ? 
            lastSeen.toLocaleString() : typeof lastSeen === 'string' ? 
            lastSeen : 'Desconocido';
        
        return `
            <tr class="${willBeAssigned ? 'table-active' : ''} ${isPending ? 'pending-change' : ''}">
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
                    <span class="badge ${statusClass}">${device.status || 'Desconocido'}</span>
                </td>
                <td class="align-middle">${formattedLastSeen}</td>
                <td class="align-middle">${device.mac_address || 'Sin MAC'}</td>
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
    
    // Actualizar contador
    updateDeviceCounter();
}

/**
 * Actualizar checkboxes de dispositivos
 */
function updateDeviceCheckboxes() {
    // Por cada dispositivo filtrado
    filteredDevicesForAssignment.forEach(device => {
        const deviceId = device.id || device.device_id || device.mac_address;
        const checkbox = document.getElementById(`device-${deviceId}`);
        
        if (checkbox) {
            const isAssigned = currentAssignedDeviceIds.includes(deviceId);
            const isPending = pendingDeviceChanges.has(deviceId);
            const willBeAssigned = (isAssigned && !isPending) || (!isAssigned && isPending);
            
            checkbox.checked = willBeAssigned;
        }
    });
    
    // Actualizar contador
    updateDeviceCounter();
}

/**
 * Actualizar contador de dispositivos
 */
function updateDeviceCounter() {
    const counter = document.getElementById('deviceCounter');
    if (counter) {
        const totalDevices = filteredDevicesForAssignment.length;
        const selectedDevices = getSelectedDevicesCount();
        
        counter.textContent = `${selectedDevices} seleccionados de ${totalDevices} dispositivos`;
    }
    
    // Actualizar también el botón de guardar
    updateSaveButtonState();
}

/**
 * Obtener cuenta de dispositivos seleccionados
 */
function getSelectedDevicesCount() {
    // Contar los dispositivos que estarán asignados después de los cambios
    return filteredDevicesForAssignment.reduce((count, device) => {
        const deviceId = device.id || device.device_id || device.mac_address;
        const isAssigned = currentAssignedDeviceIds.includes(deviceId);
        const isPending = pendingDeviceChanges.has(deviceId);
        const willBeAssigned = (isAssigned && !isPending) || (!isAssigned && isPending);
        
        return willBeAssigned ? count + 1 : count;
    }, 0);
}

/**
 * Actualizar estado del botón de guardar
 */
function updateSaveButtonState() {
    const saveButton = document.getElementById('saveDeviceAssignments');
    if (saveButton) {
        const hasPendingChanges = pendingDeviceChanges.size > 0;
        
        saveButton.disabled = !hasPendingChanges;
        saveButton.innerHTML = hasPendingChanges ? 
            `<i class="fas fa-save me-1"></i> Guardar Cambios (${pendingDeviceChanges.size})` : 
            `<i class="fas fa-save me-1"></i> Guardar Cambios`;
    }
}

/**
 * Manejar cambio en checkbox de dispositivo
 */
function handleDeviceCheckboxChange(deviceId) {
    console.log(`🔄 [Modal] Cambio en dispositivo: ${deviceId}`);
    
    // Invertir estado en pendingChanges
    if (pendingDeviceChanges.has(deviceId)) {
        pendingDeviceChanges.delete(deviceId);
    } else {
        pendingDeviceChanges.add(deviceId);
    }
    
    // Actualizar UI
    updateDeviceCheckboxes();
}

/**
 * Guardar asignaciones de dispositivos
 */
async function saveDeviceAssignments_Click() {
    if (pendingDeviceChanges.size === 0) {
        console.log('ℹ️ [Modal] No hay cambios pendientes para guardar');
        return;
    }
    
    console.log(`🔄 [Modal] Guardando cambios para ${pendingDeviceChanges.size} dispositivos...`);
    
    const playlistId = getPlaylistId();
    if (!playlistId) {
        showModalError('Error al guardar', 'No se pudo obtener el ID de la playlist');
        return false;
    }
    
    // Mostrar loading
    const saveButton = document.getElementById('saveDeviceAssignments');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Guardando...
        `;
    }
    
    // Procesar cambios
    let successCount = 0;
    let errorCount = 0;
    
    try {
        // Crear lista de promesas para procesar en paralelo
        const promises = Array.from(pendingDeviceChanges).map(async (deviceId) => {
            const isCurrentlyAssigned = currentAssignedDeviceIds.includes(deviceId);
            
            try {
                if (isCurrentlyAssigned) {
                    // Desasignar
                    await unassignDeviceFromPlaylist(deviceId, playlistId);
                } else {
                    // Asignar
                    await assignDeviceToPlaylist(deviceId, playlistId);
                }
                successCount++;
                return { success: true, deviceId };
            } catch (error) {
                errorCount++;
                console.error(`❌ [Modal] Error procesando dispositivo ${deviceId}:`, error);
                return { success: false, deviceId, error };
            }
        });
        
        // Esperar a que se completen todas las operaciones
        const results = await Promise.all(promises);
        
        console.log(`✅ [Modal] Cambios guardados: ${successCount} exitosos, ${errorCount} errores`);
        
        // Mostrar mensaje de resultado
        if (errorCount === 0) {
            showSuccessMessage(`¡Cambios guardados! Se actualizaron ${successCount} dispositivos.`);
        } else {
            showWarningMessage(`Se guardaron ${successCount} dispositivos, pero ${errorCount} fallaron. Revise la consola para más detalles.`);
        }
        
        // Recargar datos
        pendingDeviceChanges.clear();
        await loadCurrentAssignedDevices();
        
        // Notificar al gestor de dispositivos para que actualice la vista principal
        if (typeof refreshAssignedDevicesAfterChanges === 'function') {
            setTimeout(refreshAssignedDevicesAfterChanges, 500);
        }
        
        return true;
    } catch (error) {
        console.error('❌ [Modal] Error guardando cambios:', error);
        showModalError('Error guardando cambios', error.message);
        return false;
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
 */
async function assignDeviceToPlaylist(deviceId, playlistId) {
    console.log(`📌 [Modal] Asignando dispositivo ${deviceId} a playlist ${playlistId}`);
    
    const payload = {
        device_id: deviceId,
        playlist_id: playlistId
    };
    
    try {
        await secureFetch(MODAL_API.DEVICES.ASSIGN, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        console.log(`✅ [Modal] Dispositivo asignado correctamente`);
        return true;
    } catch (error) {
        console.error('❌ [Modal] Error asignando dispositivo:', error);
        throw error;
    }
}

/**
 * Desasignar dispositivo de playlist
 */
async function unassignDeviceFromPlaylist(deviceId, playlistId) {
    console.log(`🗑️ [Modal] Desasignando dispositivo ${deviceId} de playlist ${playlistId}`);
    
    try {
        await secureFetch(MODAL_API.DEVICES.UNASSIGN(deviceId, playlistId), {
            method: 'DELETE'
        });
        
        console.log(`✅ [Modal] Dispositivo desasignado correctamente`);
        return true;
    } catch (error) {
        console.error('❌ [Modal] Error desasignando dispositivo:', error);
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
            currentSearchTerm = e.target.value.trim();
            filterAndDisplayDevices();
        }, 300));
    }
    
    // Limpiar búsqueda
    const clearSearch = document.getElementById('clearDeviceSearch');
    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            currentSearchTerm = '';
            filterAndDisplayDevices();
        });
    }
    
    // Filtro de estado
    const statusFilter = document.getElementById('deviceStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            currentStatusFilter = e.target.value;
            filterAndDisplayDevices();
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
        saveBtn.addEventListener('click', saveDeviceAssignments_Click);
    }
    
    // Limpiar filtros
    const clearFiltersBtn = document.getElementById('clearAllFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
}

/**
 * Manejar selección de todos los dispositivos
 */
function handleSelectAllDevices() {
    console.log('🔄 [Modal] Seleccionando todos los dispositivos filtrados...');
    
    // Para cada dispositivo filtrado
    filteredDevicesForAssignment.forEach(device => {
        const deviceId = device.id || device.device_id || device.mac_address;
        const isCurrentlyAssigned = currentAssignedDeviceIds.includes(deviceId);
        
        // Si no está asignado, agregarlo a pendingChanges
        if (!isCurrentlyAssigned && !pendingDeviceChanges.has(deviceId)) {
            pendingDeviceChanges.add(deviceId);
        }
        // Si está asignado y está en pendingChanges, quitarlo
        else if (isCurrentlyAssigned && pendingDeviceChanges.has(deviceId)) {
            pendingDeviceChanges.delete(deviceId);
        }
    });
    
    // Actualizar UI
    updateDeviceCheckboxes();
}

/**
 * Manejar deselección de todos los dispositivos
 */
function handleDeselectAllDevices() {
    console.log('🔄 [Modal] Deseleccionando todos los dispositivos filtrados...');
    
    // Para cada dispositivo filtrado
    filteredDevicesForAssignment.forEach(device => {
        const deviceId = device.id || device.device_id || device.mac_address;
        const isCurrentlyAssigned = currentAssignedDeviceIds.includes(deviceId);
        
        // Si está asignado, agregarlo a pendingChanges
        if (isCurrentlyAssigned && !pendingDeviceChanges.has(deviceId)) {
            pendingDeviceChanges.add(deviceId);
        }
        // Si no está asignado y está en pendingChanges, quitarlo
        else if (!isCurrentlyAssigned && pendingDeviceChanges.has(deviceId)) {
            pendingDeviceChanges.delete(deviceId);
        }
    });
    
    // Actualizar UI
    updateDeviceCheckboxes();
}

/**
 * Limpiar todos los filtros
 */
function clearAllFilters() {
    console.log('🔄 [Modal] Limpiando todos los filtros...');
    
    // Limpiar búsqueda
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) searchInput.value = '';
    currentSearchTerm = '';
    
    // Resetear filtro de estado
    const statusFilter = document.getElementById('deviceStatusFilter');
    if (statusFilter) statusFilter.value = 'all';
    currentStatusFilter = 'all';
    
    // Actualizar UI
    filterAndDisplayDevices();
}

/**
 * Mostrar mensaje de error en el modal
 */
function showModalError(title, message) {
    console.error(`❌ [Modal] Error: ${title} - ${message}`);
    
    // Crear alerta dentro del modal
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) {
        alertsContainer.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <strong>${title}</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    } else {
        // Fallback a alert si no existe el contenedor
        alert(`${title}: ${message}`);
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
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }
}

/**
 * Mostrar mensaje de advertencia
 */
function showWarningMessage(message) {
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) {
        alertsContainer.innerHTML = `
            <div class="alert alert-warning alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }
}

/**
 * Mostrar error en la lista de dispositivos
 */
function showDevicesError(message) {
    const devicesList = document.getElementById('availableDevicesList');
    if (devicesList) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="empty-state text-danger">
                        <i class="fas fa-exclamation-circle"></i>
                        <h6 class="mt-3">Error cargando dispositivos</h6>
                        <p class="mb-2">${message}</p>
                        <button class="btn btn-sm btn-outline-secondary mt-2" onclick="loadDevicesForAssignment()">
                            <i class="fas fa-sync-alt me-1"></i> Reintentar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
}

/**
 * Mostrar/ocultar indicador de carga
 */
function showLoading(show) {
    const loadingIndicator = document.getElementById('deviceModalLoading');
    const contentContainer = document.getElementById('deviceModalContent');
    
    if (loadingIndicator) {
        loadingIndicator.classList.toggle('d-none', !show);
    }
    
    if (contentContainer) {
        contentContainer.classList.toggle('d-none', show);
    }
}

/**
 * Actualizar UI del modal
 */
function updateModalUI() {
    // Actualizar checkboxes
    updateDeviceCheckboxes();
    
    // Mostrar contenido
    const loadingIndicator = document.getElementById('deviceModalLoading');
    const contentContainer = document.getElementById('deviceModalContent');
    
    if (loadingIndicator) {
        loadingIndicator.classList.add('d-none');
    }
    
    if (contentContainer) {
        contentContainer.classList.remove('d-none');
    }
}

/**
 * Resetear modal a estado inicial
 */
function resetModal() {
    // Limpiar cambios pendientes
    pendingDeviceChanges.clear();
    
    // Limpiar búsqueda
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) searchInput.value = '';
    currentSearchTerm = '';
    
    // Resetear filtro de estado
    const statusFilter = document.getElementById('deviceStatusFilter');
    if (statusFilter) statusFilter.value = 'all';
    currentStatusFilter = 'all';
    
    // Limpiar alertas
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) {
        alertsContainer.innerHTML = '';
    }
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

/**
 * Función debounce para evitar múltiples llamadas
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
 * Obtener ID de la playlist actual
 */
function getPlaylistId() {
    // Método 1: Desde la variable global
    if (window.currentPlaylistData && window.currentPlaylistData.id) {
        return window.currentPlaylistData.id;
    }
    
    // Método 2: Desde función global
    if (typeof window.getPlaylistId === 'function') {
        return window.getPlaylistId();
    }
    
    // Método 3: Desde la URL
    const urlMatch = window.location.pathname.match(/\/playlists\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
    }
    
    console.error('❌ [Modal] No se pudo obtener el ID de la playlist');
    return null;
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

// Inicializar automáticamente cuando se cargue el documento
document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que otros scripts se carguen
    setTimeout(() => {
        try {
            console.log('🚀 [Modal] Inicialización automática...');
            initializeDeviceAssignmentModal();
        } catch (error) {
            console.error('❌ [Modal] Error en inicialización automática:', error);
        }
    }, 100);
});

// ==========================================
// EXPOSICIÓN GLOBAL
// ==========================================

// Hacer funciones disponibles globalmente
window.initializeDeviceAssignmentModal = initializeDeviceAssignmentModal;
window.loadDevicesForAssignment = loadDevicesForAssignment;
window.loadCurrentAssignedDevices = loadCurrentAssignedDevices;
window.handleDeviceCheckboxChange = handleDeviceCheckboxChange;
window.saveDeviceAssignments_Click = saveDeviceAssignments_Click;
window.assignDeviceToPlaylist = assignDeviceToPlaylist;
window.unassignDeviceFromPlaylist = unassignDeviceFromPlaylist;
window.clearAllFilters = clearAllFilters;
window.handleSelectAllDevices = handleSelectAllDevices;
window.handleDeselectAllDevices = handleDeselectAllDevices;

// Funciones de seguridad
window.isSecureContext = isSecureContext;
window.getSecureBaseUrl = getSecureBaseUrl;
window.buildApiUrl = buildApiUrl;
window.secureFetch = secureFetch;

console.log('✅ [Modal] Módulo de asignación de dispositivos cargado y configurado correctamente');