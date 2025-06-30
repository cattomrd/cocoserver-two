/**
 * DEVICE ASSIGNMENT MODAL - Código JavaScript para el Modal de Asignación de Dispositivos
 * Gestiona la asignación de dispositivos a listas de reproducción
 * Versión con soporte HTTPS completo
 */

// ==========================================
// FUNCIONES DE SEGURIDAD HTTPS
// ==========================================

/**
 * Funciones de seguridad compartidas - Si no están disponibles desde otros archivos
 */
if (typeof getSecureBaseUrl === 'undefined') {
    /**
     * Obtener la URL base con el protocolo correcto
     */
    function getSecureBaseUrl() {
        const protocol = window.location.protocol;
        const host = window.location.host;
        return `${protocol}//${host}`;
    }
}

if (typeof buildApiUrl === 'undefined') {
    /**
     * Construir URL de API de manera segura
     */
    function buildApiUrl(endpoint = '') {
        const baseUrl = getSecureBaseUrl();
        return `${baseUrl}/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    }
}

if (typeof isSecureContext === 'undefined') {
    /**
     * Verificar si estamos en un contexto seguro
     */
    function isSecureContext() {
        return window.location.protocol === 'https:' || 
               window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1';
    }
}

if (typeof secureFetch === 'undefined') {
    /**
     * Realizar petición fetch de manera segura
     */
    async function secureFetch(url, options = {}) {
        try {
            // Configurar opciones por defecto para HTTPS
            const secureOptions = {
                credentials: 'same-origin',
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    // Agregar headers de seguridad si estamos en HTTPS
                    ...(isSecureContext() && {
                        'X-Requested-With': 'XMLHttpRequest'
                    }),
                    ...options.headers
                }
            };

            console.log(`🔒 [Modal] Petición segura a: ${url}`);
            const response = await fetch(url, secureOptions);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ [Modal] Error HTTP ${response.status}: ${errorText}`);
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            // Si estamos en HTTPS y hay error de mixed content, avisar
            if (isSecureContext() && url.startsWith('http:')) {
                console.error('🚨 [Modal] Error de contenido mixto detectado');
                throw new Error('Error de seguridad: contenido HTTP en página HTTPS');
            }
            throw error;
        }
    }
}

// ==========================================
// VARIABLES GLOBALES PARA EL MODAL
// ==========================================
let allDevicesForAssignment = [];
let filteredDevicesForAssignment = [];
let currentAssignedDeviceIds = [];
let pendingDeviceChanges = new Set();
let isLoadingDevices = false;

// API URL base - Usando función segura
const MODAL_API_URL = buildApiUrl();

// Endpoints específicos para el modal
const MODAL_API_ENDPOINTS = {
    devices: `${MODAL_API_URL}/devices`,
    playlistDevices: (playlistId) => `${MODAL_API_URL}/playlists/${playlistId}/devices`,
    assignDevice: `${MODAL_API_URL}/device-playlists`,
    unassignDevice: (deviceId, playlistId) => `${MODAL_API_URL}/device-playlists/${deviceId}/${playlistId}`
};

// ==========================================
// FUNCIONES PRINCIPALES DEL MODAL
// ==========================================

/**
 * Inicializar el modal de asignación de dispositivos
 */
function initializeDeviceAssignmentModal() {
    console.log('🔧 [Modal] Inicializando modal de asignación de dispositivos...');
    
    // Mostrar estado de seguridad
    const secureContext = isSecureContext();
    console.log(`🔒 [Modal] Inicializando en contexto ${secureContext ? 'SEGURO' : 'INSEGURO'}`);
    
    // Configurar event listeners del modal
    setupDeviceModalEventListeners();
    
    // Cargar dispositivos cuando se abra el modal
    const deviceModal = document.getElementById('assignDeviceModal');
    if (deviceModal) {
        deviceModal.addEventListener('show.bs.modal', async function() {
            console.log('📺 [Modal] Abriendo modal de asignación de dispositivos...');
            try {
                showModalSecurityStatus();
                await loadDevicesForAssignment();
                await loadCurrentAssignedDevices();
            } catch (error) {
                console.error('❌ [Modal] Error al abrir modal:', error);
                if (error.message.includes('seguridad') || error.message.includes('HTTPS')) {
                    showModalSecurityWarning();
                }
            }
        });
        
        deviceModal.addEventListener('hidden.bs.modal', function() {
            console.log('📺 [Modal] Cerrando modal de asignación de dispositivos...');
            resetDeviceAssignmentModal();
        });
    }
    
    console.log('✅ [Modal] Modal de asignación de dispositivos inicializado');
}

/**
 * Mostrar estado de seguridad en el modal
 */
function showModalSecurityStatus() {
    const modalHeader = document.querySelector('#assignDeviceModal .modal-header');
    if (!modalHeader || document.getElementById('modalSecurityIndicator')) return;
    
    const secureContext = isSecureContext();
    const protocol = window.location.protocol.toUpperCase();
    
    const securityIndicator = document.createElement('small');
    securityIndicator.id = 'modalSecurityIndicator';
    securityIndicator.className = `ms-auto ${secureContext ? 'text-success' : 'text-warning'}`;
    securityIndicator.innerHTML = secureContext ? 
        `<i class="fas fa-lock me-1"></i>${protocol}` :
        `<i class="fas fa-unlock me-1"></i>${protocol}`;
    
    modalHeader.appendChild(securityIndicator);
}

/**
 * Mostrar advertencia de seguridad en el modal
 */
function showModalSecurityWarning() {
    const modalBody = document.querySelector('#assignDeviceModal .modal-body');
    if (!modalBody || document.getElementById('modalSecurityWarning')) return;
    
    const warningElement = document.createElement('div');
    warningElement.id = 'modalSecurityWarning';
    warningElement.className = 'alert alert-warning alert-dismissible fade show';
    warningElement.innerHTML = `
        <i class="fas fa-shield-alt me-2"></i>
        <strong>Advertencia de Seguridad:</strong>
        Se detectaron problemas de seguridad. Verifique su configuración HTTPS.
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    modalBody.insertBefore(warningElement, modalBody.firstChild);
}

/**
 * Configurar todos los event listeners del modal
 */
function setupDeviceModalEventListeners() {
    // Buscador de dispositivos
    const deviceSearchInput = document.getElementById('deviceSearchInput');
    if (deviceSearchInput) {
        deviceSearchInput.addEventListener('input', debounce(function(e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterDevicesInModal(searchTerm);
        }, 300));
    }
    
    // Botón para limpiar búsqueda
    const clearDeviceSearch = document.getElementById('clearDeviceSearch');
    if (clearDeviceSearch) {
        clearDeviceSearch.addEventListener('click', function() {
            if (deviceSearchInput) {
                deviceSearchInput.value = '';
                filterDevicesInModal('');
            }
        });
    }
    
    // Filtro de estado
    const deviceStatusFilter = document.getElementById('deviceStatusFilter');
    if (deviceStatusFilter) {
        deviceStatusFilter.addEventListener('change', function() {
            filterDevicesInModal();
        });
    }
    
    // Botón para guardar asignaciones
    const saveDeviceAssignments = document.getElementById('saveDeviceAssignments');
    if (saveDeviceAssignments) {
        saveDeviceAssignments.addEventListener('click', saveDeviceAssignments_Click);
    }
    
    console.log('✅ [Modal] Event listeners configurados');
}

/**
 * Cargar todos los dispositivos disponibles para asignación
 */
async function loadDevicesForAssignment() {
    console.log('📺 [Modal] Cargando dispositivos para asignación...');
    
    if (isLoadingDevices) return;
    isLoadingDevices = true;
    
    const devicesList = document.getElementById('availableDevicesList');
    if (!devicesList) {
        console.error('❌ [Modal] Elemento availableDevicesList no encontrado');
        return;
    }
    
    // Mostrar estado de carga
    devicesList.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-3">
                <div class="spinner-border spinner-border-sm text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
                <p class="mt-1 text-muted small mb-0">Cargando dispositivos...</p>
            </td>
        </tr>
    `;
    
    try {
        const url = MODAL_API_ENDPOINTS.devices;
        console.log(`🔡 [Modal] Cargando desde: ${url}`);
        
        const response = await secureFetch(url);
        
        const data = await response.json();
        allDevicesForAssignment = Array.isArray(data) ? data : (data.devices || []);
        
        console.log(`✅ [Modal] Dispositivos cargados: ${allDevicesForAssignment.length}`);
        
        // Aplicar filtros iniciales
        filterDevicesInModal();
        
    } catch (error) {
        console.error('❌ [Modal] Error cargando dispositivos:', error);
        
        const isSecurityError = error.message.includes('seguridad') || error.message.includes('HTTPS');
        const errorIcon = isSecurityError ? 'fa-shield-alt' : 'fa-exclamation-triangle';
        const errorClass = isSecurityError ? 'text-warning' : 'text-danger';
        
        devicesList.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-3 ${errorClass}">
                    <i class="fas ${errorIcon} fa-2x mb-2"></i>
                    <p class="mb-1">Error cargando dispositivos</p>
                    <p class="small text-muted mb-2">${escapeHtml(error.message)}</p>
                    ${isSecurityError ? `
                        <div class="alert alert-warning text-start mb-2">
                            <small><strong>Problema de seguridad:</strong> Verifique configuración HTTPS</small>
                        </div>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-primary" onclick="loadDevicesForAssignment()">
                        <i class="fas fa-sync"></i> Reintentar
                    </button>
                </td>
            </tr>
        `;
        
        // Mostrar advertencia de seguridad si es necesario
        if (isSecurityError) {
            showModalSecurityWarning();
        }
        
    } finally {
        isLoadingDevices = false;
    }
}

/**
 * Cargar dispositivos actualmente asignados a la playlist
 */
async function loadCurrentAssignedDevices() {
    console.log('📺 [Modal] Cargando dispositivos asignados actuales...');
    
    const playlistId = getPlaylistId();
    if (!playlistId) {
        console.error('❌ [Modal] No se pudo obtener el ID de playlist');
        return;
    }
    
    try {
        const url = MODAL_API_ENDPOINTS.playlistDevices(playlistId);
        console.log(`🔡 [Modal] Cargando dispositivos asignados desde: ${url}`);
        
        const response = await secureFetch(url);
        
        const assignedDevices = await response.json();
        currentAssignedDeviceIds = assignedDevices.map(device => 
            device.device_id || device.id || device.mac_address
        );
        
        console.log(`✅ [Modal] Dispositivos asignados cargados: ${currentAssignedDeviceIds.length}`);
        
    } catch (error) {
        console.error('❌ [Modal] Error cargando dispositivos asignados:', error);
        currentAssignedDeviceIds = [];
        
        // Si es un error de seguridad, mostrar advertencia
        if (error.message.includes('seguridad') || error.message.includes('HTTPS')) {
            showModalSecurityWarning();
        }
    }
}

/**
 * Filtrar dispositivos según búsqueda y estado
 */
function filterDevicesInModal(searchTerm = '') {
    console.log('🔍 [Modal] Filtrando dispositivos en modal...');
    
    const deviceStatusFilter = document.getElementById('deviceStatusFilter');
    const statusFilter = deviceStatusFilter ? deviceStatusFilter.value : 'all';
    
    // Si no hay término de búsqueda, usar el valor actual del input
    if (!searchTerm) {
        const deviceSearchInput = document.getElementById('deviceSearchInput');
        searchTerm = deviceSearchInput ? deviceSearchInput.value.toLowerCase().trim() : '';
    }
    
    // Aplicar filtros
    filteredDevicesForAssignment = allDevicesForAssignment.filter(device => {
        // Filtro por búsqueda
        let matchesSearch = true;
        if (searchTerm) {
            const name = (device.name || '').toLowerCase();
            const location = (device.location || '').toLowerCase();
            const mac = (device.mac_address || '').toLowerCase();
            
            matchesSearch = name.includes(searchTerm) || 
                           location.includes(searchTerm) || 
                           mac.includes(searchTerm);
        }
        
        // Filtro por estado
        let matchesStatus = true;
        const deviceId = device.device_id || device.id || device.mac_address;
        const isCurrentlyAssigned = currentAssignedDeviceIds.includes(deviceId);
        
        switch (statusFilter) {
            case 'active':
                matchesStatus = device.is_active === true;
                break;
            case 'inactive':
                matchesStatus = device.is_active === false;
                break;
            case 'unassigned':
                matchesStatus = !isCurrentlyAssigned;
                break;
            case 'all':
            default:
                matchesStatus = true;
                break;
        }
        
        return matchesSearch && matchesStatus;
    });
    
    console.log(`🔍 [Modal] Dispositivos filtrados: ${filteredDevicesForAssignment.length}`);
    
    // Renderizar dispositivos filtrados
    renderFilteredDevices();
}

/**
 * Renderizar la lista de dispositivos filtrados
 */
function renderFilteredDevices() {
    const devicesList = document.getElementById('availableDevicesList');
    if (!devicesList) {
        console.error('❌ [Modal] Elemento availableDevicesList no encontrado');
        return;
    }
    
    if (filteredDevicesForAssignment.length === 0) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-3">
                    <i class="fas fa-search text-muted mb-2"></i>
                    <p class="small text-muted mb-1">No se encontraron dispositivos</p>
                    <button class="btn btn-sm btn-outline-secondary" onclick="clearDeviceFilters()">
                        <i class="fas fa-times me-1"></i> Limpiar filtros
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    // Generar HTML para cada dispositivo
    const devicesHTML = filteredDevicesForAssignment.map(device => {
        const deviceId = device.device_id || device.id || device.mac_address;
        const isCurrentlyAssigned = currentAssignedDeviceIds.includes(deviceId);
        const hasPendingChange = pendingDeviceChanges.has(deviceId);
        
        // Determinar el estado del checkbox
        let isChecked = isCurrentlyAssigned;
        if (hasPendingChange) {
            isChecked = !isCurrentlyAssigned; // Toggle del estado actual
        }
        
        // Determinar el estado visual del dispositivo
        let statusBadge = '';
        let assignedBadge = '';
        
        if (device.is_active) {
            statusBadge = '<span class="badge bg-success">Activo</span>';
        } else {
            statusBadge = '<span class="badge bg-danger">Inactivo</span>';
        }
        
        if (isCurrentlyAssigned && !hasPendingChange) {
            assignedBadge = '<span class="badge bg-primary">Asignado</span>';
        } else if (!isCurrentlyAssigned && hasPendingChange) {
            assignedBadge = '<span class="badge bg-warning">Pendiente</span>';
        } else if (isCurrentlyAssigned && hasPendingChange) {
            assignedBadge = '<span class="badge bg-danger">Será removido</span>';
        } else {
            assignedBadge = '<span class="badge bg-secondary">No asignado</span>';
        }
        
        // Indicador de seguridad del dispositivo
        const securityIndicator = device.supports_https ? 
            '<i class="fas fa-lock text-success ms-1" title="Soporte HTTPS"></i>' : 
            '<i class="fas fa-unlock text-warning ms-1" title="Sin soporte HTTPS"></i>';
        
        return `
            <tr ${hasPendingChange ? 'class="table-warning"' : ''} data-device-id="${deviceId}">
                <td>
                    <div class="form-check">
                        <input class="form-check-input device-checkbox" 
                               type="checkbox" 
                               value="${deviceId}"
                               id="device-${deviceId}"
                               ${isChecked ? 'checked' : ''}
                               onchange="handleDeviceCheckboxChange('${deviceId}')">
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <i class="fas fa-tv text-primary me-2"></i>
                        <div>
                            <h6 class="mb-0">
                                ${escapeHtml(device.name || 'Sin nombre')}
                                ${securityIndicator}
                            </h6>
                            <small class="text-muted">${escapeHtml(device.mac_address || '')}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <div>
                        <span class="fw-bold">${escapeHtml(device.location || 'Sin ubicación')}</span>
                        ${device.tienda ? `<br><small class="text-muted">${escapeHtml(device.tienda)}</small>` : ''}
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td>${assignedBadge}</td>
            </tr>
        `;
    }).join('');
    
    devicesList.innerHTML = devicesHTML;
    
    // Actualizar estado del botón de guardar
    updateSaveButtonState();
}

/**
 * Manejar cambio en checkbox de dispositivo
 */
function handleDeviceCheckboxChange(deviceId) {
    console.log(`📺 [Modal] Checkbox cambiado para dispositivo: ${deviceId}`);
    
    if (pendingDeviceChanges.has(deviceId)) {
        // Si ya estaba en cambios pendientes, quitarlo (volver al estado original)
        pendingDeviceChanges.delete(deviceId);
    } else {
        // Añadir a cambios pendientes
        pendingDeviceChanges.add(deviceId);
    }
    
    console.log(`📺 [Modal] Cambios pendientes: ${pendingDeviceChanges.size}`);
    
    // Re-renderizar para actualizar el estado visual
    renderFilteredDevices();
}

/**
 * Actualizar estado del botón de guardar
 */
function updateSaveButtonState() {
    const saveButton = document.getElementById('saveDeviceAssignments');
    if (!saveButton) return;
    
    if (pendingDeviceChanges.size > 0) {
        saveButton.disabled = false;
        saveButton.innerHTML = `<i class="fas fa-save me-1"></i> Guardar Cambios (${pendingDeviceChanges.size})`;
        saveButton.classList.remove('btn-primary');
        saveButton.classList.add('btn-warning');
    } else {
        saveButton.disabled = true;
        saveButton.innerHTML = `<i class="fas fa-save me-1"></i> Guardar Asignaciones`;
        saveButton.classList.remove('btn-warning');
        saveButton.classList.add('btn-primary');
    }
}

/**
 * Manejar click en botón de guardar asignaciones
 */
async function saveDeviceAssignments_Click() {
    console.log('💾 [Modal] Guardando cambios de asignación de dispositivos...');
    
    if (pendingDeviceChanges.size === 0) {
        const message = 'No hay cambios pendientes para guardar';
        if (typeof showToast === 'function') {
            showToast(message, 'warning');
        } else {
            alert(message);
        }
        return;
    }
    
    const playlistId = getPlaylistId();
    if (!playlistId) {
        const message = 'Error: No se pudo determinar el ID de la playlist';
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            alert(message);
        }
        return;
    }
    
    const saveButton = document.getElementById('saveDeviceAssignments');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = `
            <div class="spinner-border spinner-border-sm me-2" role="status">
                <span class="visually-hidden">Guardando...</span>
            </div>
            Guardando...
        `;
    }
    
    try {
        const promises = [];
        const operationDetails = [];
        
        // Procesar cada cambio pendiente
        for (const deviceId of pendingDeviceChanges) {
            const isCurrentlyAssigned = currentAssignedDeviceIds.includes(deviceId);
            
            if (isCurrentlyAssigned) {
                // Desasignar dispositivo
                console.log(`📺 [Modal] Desasignando dispositivo: ${deviceId}`);
                promises.push(unassignDeviceFromPlaylistSecure(playlistId, deviceId));
                operationDetails.push({ deviceId, operation: 'unassign' });
            } else {
                // Asignar dispositivo
                console.log(`📺 [Modal] Asignando dispositivo: ${deviceId}`);
                promises.push(assignDeviceToPlaylistSecure(playlistId, deviceId));
                operationDetails.push({ deviceId, operation: 'assign' });
            }
        }
        
        // Esperar a que todas las peticiones terminen
        const results = await Promise.allSettled(promises);
        
        // Verificar si hubo errores
        const failedOperations = results.filter(result => result.status === 'rejected');
        const securityErrors = failedOperations.filter(op => 
            op.reason.message.includes('seguridad') || op.reason.message.includes('HTTPS')
        );
        
        if (failedOperations.length > 0) {
            console.error('❌ [Modal] Algunas operaciones fallaron:', failedOperations);
            
            const successCount = pendingDeviceChanges.size - failedOperations.length;
            const message = `${successCount}/${pendingDeviceChanges.size} cambios guardados correctamente`;
            
            if (typeof showToast === 'function') {
                showToast(message, 'warning');
            } else {
                alert(message);
            }
            
            // Si hay errores de seguridad, mostrar advertencia
            if (securityErrors.length > 0) {
                showModalSecurityWarning();
            }
        } else {
            const message = 'Todas las asignaciones de dispositivos se guardaron correctamente';
            if (typeof showToast === 'function') {
                showToast(message, 'success');
            } else {
                console.log(`✅ [Modal] ${message}`);
            }
        }
        
        // Limpiar estado
        pendingDeviceChanges.clear();
        
        // Recargar dispositivos asignados
        await loadCurrentAssignedDevices();
        
        // Re-aplicar filtros para refrescar la vista
        filterDevicesInModal();
        
        // Si todas las operaciones fueron exitosas, cerrar el modal
        if (failedOperations.length === 0) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('assignDeviceModal'));
            if (modal) {
                modal.hide();
            }
        }
        
    } catch (error) {
        console.error('❌ [Modal] Error guardando asignaciones:', error);
        
        const message = `Error al guardar asignaciones: ${error.message}`;
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            alert(message);
        }
        
        // Si es un error de seguridad, mostrar advertencia
        if (error.message.includes('seguridad') || error.message.includes('HTTPS')) {
            showModalSecurityWarning();
        }
        
    } finally {
        // Restaurar botón de guardar
        updateSaveButtonState();
    }
}

/**
 * Asignar dispositivo a playlist de manera segura
 */
async function assignDeviceToPlaylistSecure(playlistId, deviceId) {
    const url = MODAL_API_ENDPOINTS.assignDevice;
    console.log(`🔡 [Modal] Asignando dispositivo a: ${url}`);
    
    const response = await secureFetch(url, {
        method: 'POST',
        body: JSON.stringify({
            device_id: deviceId,
            playlist_id: parseInt(playlistId)
        })
    });
    
    return await response.json();
}

/**
 * Desasignar dispositivo de playlist de manera segura
 */
async function unassignDeviceFromPlaylistSecure(playlistId, deviceId) {
    const url = MODAL_API_ENDPOINTS.unassignDevice(deviceId, playlistId);
    console.log(`🔡 [Modal] Desasignando dispositivo de: ${url}`);
    
    const response = await secureFetch(url, {
        method: 'DELETE'
    });
    
    return true;
}

/**
 * Funciones de compatibilidad (mantienen la interfaz original)
 */
async function assignDeviceToPlaylist(playlistId, deviceId) {
    return await assignDeviceToPlaylistSecure(playlistId, deviceId);
}

async function unassignDeviceFromPlaylist(playlistId, deviceId) {
    return await unassignDeviceFromPlaylistSecure(playlistId, deviceId);
}

/**
 * Limpiar todos los filtros del modal
 */
function clearDeviceFilters() {
    const deviceSearchInput = document.getElementById('deviceSearchInput');
    const deviceStatusFilter = document.getElementById('deviceStatusFilter');
    
    if (deviceSearchInput) {
        deviceSearchInput.value = '';
    }
    
    if (deviceStatusFilter) {
        deviceStatusFilter.value = 'all';
    }
    
    // Re-aplicar filtros (que ahora estarán vacíos)
    filterDevicesInModal();
}

/**
 * Resetear el modal cuando se cierre
 */
function resetDeviceAssignmentModal() {
    console.log('🔄 [Modal] Reseteando modal de asignación de dispositivos...');
    
    // Limpiar datos
    allDevicesForAssignment = [];
    filteredDevicesForAssignment = [];
    currentAssignedDeviceIds = [];
    pendingDeviceChanges.clear();
    
    // Limpiar campos del formulario
    const deviceSearchInput = document.getElementById('deviceSearchInput');
    const deviceStatusFilter = document.getElementById('deviceStatusFilter');
    
    if (deviceSearchInput) {
        deviceSearchInput.value = '';
    }
    
    if (deviceStatusFilter) {
        deviceStatusFilter.value = 'all';
    }
    
    // Limpiar lista de dispositivos
    const devicesList = document.getElementById('availableDevicesList');
    if (devicesList) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-3">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mt-1 text-muted small mb-0">Cargando dispositivos...</p>
                </td>
            </tr>
        `;
    }
    
    // Limpiar indicadores de seguridad
    const securityIndicator = document.getElementById('modalSecurityIndicator');
    if (securityIndicator) {
        securityIndicator.remove();
    }
    
    const securityWarning = document.getElementById('modalSecurityWarning');
    if (securityWarning) {
        securityWarning.remove();
    }
    
    // Resetear botón de guardar
    updateSaveButtonState();
}

// ==========================================
// FUNCIONES UTILITARIAS
// ==========================================

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
 * Obtener ID de playlist - Fallback si no está disponible
 */
if (typeof getPlaylistId === 'undefined') {
    function getPlaylistId() {
        // Método simple de fallback
        const urlParams = new URLSearchParams(window.location.search);
        const idFromUrl = urlParams.get('id');
        
        if (idFromUrl) return idFromUrl;
        
        const pathMatch = window.location.pathname.match(/\/playlists\/(\d+)/);
        return pathMatch ? pathMatch[1] : null;
    }
}

// ==========================================
// MANEJO DE ERRORES GLOBALES
// ==========================================

/**
 * Manejador de errores específicos del modal
 */
window.addEventListener('error', function(event) {
    if (event.error && event.error.message && 
        (event.error.message.includes('Modal') || event.filename.includes('device_assignment'))) {
        console.error('🚨 [Modal] Error no capturado:', event.error);
        
        // Si es un error de seguridad, mostrar advertencia
        if (event.error.message.includes('seguridad') || event.error.message.includes('HTTPS')) {
            showModalSecurityWarning();
        }
    }
});

// ==========================================
// INICIALIZACIÓN
// ==========================================

/**
 * Inicializar cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('📺 [Modal] Inicializando módulo de asignación de dispositivos con soporte HTTPS...');
    
    // Verificar dependencias básicas
    if (typeof bootstrap === 'undefined') {
        console.warn('⚠️ [Modal] Bootstrap no detectado, algunas funcionalidades pueden no funcionar');
    }
    
    initializeDeviceAssignmentModal();
});

// Hacer funciones disponibles globalmente para compatibilidad
window.initializeDeviceAssignmentModal = initializeDeviceAssignmentModal;
window.loadDevicesForAssignment = loadDevicesForAssignment;
window.loadCurrentAssignedDevices = loadCurrentAssignedDevices;
window.filterDevicesInModal = filterDevicesInModal;
window.handleDeviceCheckboxChange = handleDeviceCheckboxChange;
window.saveDeviceAssignments_Click = saveDeviceAssignments_Click;
window.assignDeviceToPlaylist = assignDeviceToPlaylist;
window.unassignDeviceFromPlaylist = unassignDeviceFromPlaylist;
window.clearDeviceFilters = clearDeviceFilters;

// Funciones de seguridad también disponibles globalmente
window.getSecureBaseUrl = getSecureBaseUrl;
window.buildApiUrl = buildApiUrl;
window.isSecureContext = isSecureContext;
window.secureFetch = secureFetch;

console.log('✅ [Modal] Módulo de asignación de dispositivos con soporte HTTPS cargado correctamente');