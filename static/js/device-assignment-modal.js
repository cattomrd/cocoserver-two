/**
 * DEVICE ASSIGNMENT MODAL - Modal de Asignación de Dispositivos
 * 
 * Este archivo maneja específicamente el modal para asignar/desasignar dispositivos
 * a listas de reproducción. Incluye funcionalidades de búsqueda, filtrado,
 * selección múltiple y guardado de cambios.
 * 
 * FUNCIONALIDADES:
 * - Modal Bootstrap completamente funcional
 * - Búsqueda en tiempo real de dispositivos
 * - Filtros por estado y asignación
 * - Selección múltiple con "Seleccionar todos"
 * - Vista previa de cambios pendientes
 * - Guardado batch de asignaciones
 * - Manejo robusto de errores
 * - Integración con assigned-devices-manager.js
 * 
 * INSTRUCCIONES:
 * 1. Guarda este archivo como static/js/device-assignment-modal.js
 * 2. Carga después de assigned-devices-manager.js
 * 3. Asegúrate de que el HTML del modal esté presente
 */

console.log('🔧 Cargando módulo del modal de asignación de dispositivos...');

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
 * Realizar petición fetch segura
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

        console.log(`🔒 [Modal] Fetch a: ${url}`);
        const response = await fetch(url, finalOptions);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
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

// API Endpoints - usar configuración global si existe
const MODAL_API = window.API_CONFIG || {
    DEVICES: {
        LIST: buildApiUrl('/devices'),
        PLAYLIST_DEVICES: (playlistId) => buildApiUrl(`/device-playlists/playlist/${playlistId}/devices`),
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
        console.log(`🔒 [Modal] Contexto ${secure ? 'SEGURO' : 'INSEGURO'}`);
        
        // Configurar event listeners
        setupDeviceModalEventListeners();
        
        // Configurar eventos del modal Bootstrap
        setupModalEvents();
        
        console.log('✅ [Modal] Modal inicializado correctamente');
        
    } catch (error) {
        console.error('❌ [Modal] Error inicializando modal:', error);
        showModalError('Error de inicialización', error.message);
    }
}

/**
 * Configurar event listeners del modal
 */
function setupDeviceModalEventListeners() {
    console.log('🔧 [Modal] Configurando event listeners...');
    
    try {
        // Búsqueda de dispositivos
        const searchInput = document.getElementById('deviceSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                currentSearchTerm = e.target.value.toLowerCase().trim();
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
        
        // Limpiar todos los filtros
        const clearFilters = document.getElementById('clearDeviceFilters');
        if (clearFilters) {
            clearFilters.addEventListener('click', clearAllFilters);
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
        
        console.log('✅ [Modal] Event listeners configurados');
        
    } catch (error) {
        console.error('❌ [Modal] Error configurando event listeners:', error);
    }
}

/**
 * Configurar eventos del modal Bootstrap
 */
function setupModalEvents() {
    const modal = document.getElementById('assignDeviceModal');
    if (!modal) {
        console.error('❌ [Modal] Elemento del modal no encontrado');
        return;
    }
    
    // Cuando se abre el modal
    modal.addEventListener('show.bs.modal', async () => {
        console.log('📂 [Modal] Abriendo modal...');
        try {
            showModalSecurityStatus();
            await loadDevicesForAssignment();
            await loadCurrentAssignedDevices();
        } catch (error) {
            console.error('❌ [Modal] Error al abrir modal:', error);
            showModalError('Error cargando datos', error.message);
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
    
    console.log('📥 [Modal] Cargando dispositivos...');
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
        const response = await secureFetch(MODAL_API.DEVICES.LIST);
        const data = await response.json();
        
        // La respuesta puede ser array directo o objeto con propiedad devices
        allDevicesForAssignment = Array.isArray(data) ? data : (data.devices || []);
        
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
        const response = await secureFetch(MODAL_API.DEVICES.PLAYLIST_DEVICES(playlistId));
        const assignedDevices = await response.json();
        
        // Extraer IDs de dispositivos asignados
        currentAssignedDeviceIds = assignedDevices.map(device => 
            device.device_id || device.id || device.mac_address
        ).filter(id => id); // Filtrar valores vacíos
        
        console.log(`✅ [Modal] ${currentAssignedDeviceIds.length} dispositivos asignados identificados`);
        
    } catch (error) {
        console.error('❌ [Modal] Error cargando dispositivos asignados:', error);
        currentAssignedDeviceIds = [];
    }
}

/**
 * Filtrar y mostrar dispositivos
 */
function filterAndDisplayDevices() {
    console.log(`🔍 [Modal] Filtrando dispositivos (${allDevicesForAssignment.length} total)...`);
    
    // Aplicar filtros
    filteredDevicesForAssignment = allDevicesForAssignment.filter(device => {
        // Filtro de búsqueda
        if (currentSearchTerm) {
            const searchableText = [
                device.name || '',
                device.mac_address || '',
                device.location || '',
                device.tienda || ''
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(currentSearchTerm)) {
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
    
    console.log(`🎯 [Modal] ${filteredDevicesForAssignment.length} dispositivos después del filtro`);
    
    // Mostrar dispositivos
    displayDevices();
    
    // Actualizar estadísticas
    updateModalStatistics();
}

/**
 * Mostrar dispositivos en la tabla
 */
function displayDevices() {
    const devicesList = document.getElementById('availableDevicesList');
    if (!devicesList) return;
    
    if (filteredDevicesForAssignment.length === 0) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <i class="fas fa-search fa-2x text-muted mb-3"></i>
                    <p class="text-muted mb-2">No se encontraron dispositivos</p>
                    <button class="btn btn-sm btn-outline-secondary" onclick="clearAllFilters()">
                        <i class="fas fa-eraser me-1"></i>Limpiar Filtros
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    const devicesHTML = filteredDevicesForAssignment.map(device => {
        const deviceId = device.id || device.mac_address;
        const isAssigned = currentAssignedDeviceIds.includes(deviceId);
        const hasPendingChange = pendingDeviceChanges.has(deviceId);
        const willBeAssigned = hasPendingChange ? !isAssigned : isAssigned;
        
        // Estado del dispositivo
        const isOnline = device.status === 'online';
        const statusBadge = isOnline ? 
            '<span class="badge bg-success"><i class="fas fa-circle me-1"></i>En línea</span>' :
            '<span class="badge bg-secondary"><i class="fas fa-circle me-1"></i>Fuera de línea</span>';
        
        // Estado de asignación
        const assignmentBadge = willBeAssigned ?
            '<span class="badge bg-primary">Asignado</span>' :
            '<span class="badge bg-outline-secondary">No asignado</span>';
        
        // Clase para cambios pendientes
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
    
    devicesList.innerHTML = devicesHTML;
    updateSaveButtonState();
}

/**
 * Manejar cambio en checkbox de dispositivo
 */
function handleDeviceCheckboxChange(deviceId) {
    console.log(`🔄 [Modal] Cambio en dispositivo: ${deviceId}`);
    
    const wasAssigned = currentAssignedDeviceIds.includes(deviceId);
    const checkbox = document.getElementById(`device_${deviceId}`);
    const isNowChecked = checkbox ? checkbox.checked : false;
    
    // Si el estado cambió respecto al original, marcar como pendiente
    if (isNowChecked !== wasAssigned) {
        pendingDeviceChanges.add(deviceId);
    } else {
        pendingDeviceChanges.delete(deviceId);
    }
    
    console.log(`📝 [Modal] Cambios pendientes: ${pendingDeviceChanges.size}`);
    
    // Actualizar UI
    updateSaveButtonState();
    updateModalStatistics();
    
    // Re-aplicar estilos a la fila
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
 * Manejar seleccionar todos los dispositivos
 */
function handleSelectAllDevices() {
    const selectAllCheckbox = document.getElementById('selectAllDevices');
    const isChecked = selectAllCheckbox?.checked || false;
    
    console.log(`🔄 [Modal] Seleccionar todos: ${isChecked}`);
    
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
    // Total de dispositivos
    const totalBadge = document.getElementById('totalDevicesBadge');
    if (totalBadge) {
        totalBadge.innerHTML = `<i class="fas fa-tv me-1"></i>${filteredDevicesForAssignment.length} dispositivos`;
    }
    
    // Dispositivos en línea
    const onlineBadge = document.getElementById('onlineDevicesBadge');
    if (onlineBadge) {
        const onlineCount = filteredDevicesForAssignment.filter(d => d.status === 'online').length;
        onlineBadge.innerHTML = `<i class="fas fa-circle me-1"></i>${onlineCount} en línea`;
    }
    
    // Dispositivos asignados
    const assignedBadge = document.getElementById('assignedDevicesBadge');
    if (assignedBadge) {
        const assignedCount = filteredDevicesForAssignment.filter(d => {
            const deviceId = d.id || d.mac_address;
            return currentAssignedDeviceIds.includes(deviceId);
        }).length;
        assignedBadge.innerHTML = `<i class="fas fa-link me-1"></i>${assignedCount} asignados`;
    }
    
    // Cambios pendientes
    const pendingBadge = document.getElementById('pendingChangesBadge');
    if (pendingBadge) {
        pendingBadge.innerHTML = `<i class="fas fa-clock me-1"></i>${pendingDeviceChanges.size} cambios pendientes`;
        pendingBadge.className = pendingDeviceChanges.size > 0 ? 'badge bg-warning' : 'badge bg-info';
    }
    
    // Información de paginación
    const paginationInfo = document.getElementById('devicesPaginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = `Mostrando ${filteredDevicesForAssignment.length} de ${allDevicesForAssignment.length} dispositivos`;
    }
}

/**
 * Limpiar todos los filtros
 */
function clearAllFilters() {
    console.log('🧹 [Modal] Limpiando todos los filtros...');
    
    const searchInput = document.getElementById('deviceSearchInput');
    const statusFilter = document.getElementById('deviceStatusFilter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'all';
    
    currentSearchTerm = '';
    currentStatusFilter = 'all';
    
    filterAndDisplayDevices();
}

/**
 * Guardar asignaciones de dispositivos
 */
async function saveDeviceAssignments_Click() {
    if (pendingDeviceChanges.size === 0) {
        console.log('📝 [Modal] No hay cambios para guardar');
        showToast('No hay cambios para guardar', 'info');
        return;
    }
    
    console.log(`💾 [Modal] Guardando ${pendingDeviceChanges.size} cambios...`);
    
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
                    await unassignDeviceFromPlaylist(deviceId, playlistId);
                    successCount++;
                }
            } catch (error) {
                console.error(`❌ [Modal] Error procesando dispositivo ${deviceId}:`, error);
                errorCount++;
            }
        }
        
        // Limpiar cambios pendientes
        pendingDeviceChanges.clear();
        
        // Recargar datos
        await loadCurrentAssignedDevices();
        filterAndDisplayDevices();
        
        // Mostrar resultado
        if (errorCount === 0) {
            showToast(`✅ Todos los cambios guardados correctamente (${successCount})`, 'success');
            
            // Cerrar modal si todo fue exitoso
            const modal = bootstrap.Modal.getInstance(document.getElementById('assignDeviceModal'));
            if (modal) modal.hide();
            
            // Recargar dispositivos asignados en la página principal
            if (typeof refreshAssignedDevicesAfterChanges === 'function') {
                refreshAssignedDevicesAfterChanges();
            }
        } else {
            showToast(`⚠️ ${successCount} cambios guardados, ${errorCount} errores`, 'warning');
        }
        
    } catch (error) {
        console.error('❌ [Modal] Error general guardando:', error);
        showToast(`Error guardando cambios: ${error.message}`, 'error');
    } finally {
        updateSaveButtonState();
    }
}

/**
 * Asignar dispositivo a playlist
 */
async function assignDeviceToPlaylist(deviceId, playlistId) {
    const response = await secureFetch(MODAL_API.DEVICES.ASSIGN, {
        method: 'POST',
        body: JSON.stringify({
            device_id: deviceId,
            playlist_id: parseInt(playlistId)
        })
    });
    
    console.log(`✅ [Modal] Dispositivo ${deviceId} asignado`);
    return await response.json();
}

/**
 * Desasignar dispositivo de playlist
 */
async function unassignDeviceFromPlaylist(deviceId, playlistId) {
    const response = await secureFetch(MODAL_API.DEVICES.UNASSIGN(deviceId, playlistId), {
        method: 'DELETE'
    });
    
    console.log(`✅ [Modal] Dispositivo ${deviceId} desasignado`);
    return response.ok;
}

/**
 * Mostrar estado de seguridad en el modal
 */
function showModalSecurityStatus() {
    try {
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
        
    } catch (error) {
        console.warn('⚠️ [Modal] Error mostrando estado de seguridad:', error);
    }
}

/**
 * Resetear modal
 */
function resetModal() {
    console.log('🔄 [Modal] Reseteando modal...');
    
    // Limpiar datos
    allDevicesForAssignment = [];
    filteredDevicesForAssignment = [];
    currentAssignedDeviceIds = [];
    pendingDeviceChanges.clear();
    currentSearchTerm = '';
    currentStatusFilter = 'all';
    
    // Limpiar formulario
    const searchInput = document.getElementById('deviceSearchInput');
    const statusFilter = document.getElementById('deviceStatusFilter');
    const selectAll = document.getElementById('selectAllDevices');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'all';
    if (selectAll) selectAll.checked = false;
    
    // Limpiar tabla
    const devicesList = document.getElementById('availableDevicesList');
    if (devicesList) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <p class="text-muted mb-0">El modal se ha reseteado</p>
                </td>
            </tr>
        `;
    }
    
    // Resetear botones
    updateSaveButtonState();
    
    // Limpiar indicadores de seguridad
    const securityIndicator = document.getElementById('modalSecurityIndicator');
    if (securityIndicator) {
        securityIndicator.remove();
    }
}

// ==========================================
// FUNCIONES DE UTILIDAD
// ==========================================

/**
 * Debounce para optimizar búsquedas
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
 * Escapar HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
 * Mostrar toast
 */
function showToast(message, type = 'info') {
    console.log(`📢 [Modal] Toast ${type}: ${message}`);
    
    // Si existe función global de toast, usarla
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
        window.showToast(message, type);
        return;
    }
    
    // Toast simple como fallback
    const alertClass = type === 'error' ? 'danger' : type;
    const toast = document.createElement('div');
    toast.className = `alert alert-${alertClass} position-fixed`;
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    toast.innerHTML = `
        <strong><i class="fas fa-tv me-2"></i>Dispositivos:</strong> ${message}
        <button type="button" class="btn-close float-end" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

/**
 * Mostrar error en dispositivos
 */
function showDevicesError(message) {
    const devicesList = document.getElementById('availableDevicesList');
    if (devicesList) {
        devicesList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <i class="fas fa-exclamation-triangle fa-2x text-danger mb-3"></i>
                    <p class="text-danger mb-2">Error cargando dispositivos</p>
                    <p class="text-muted small mb-3">${escapeHtml(message)}</p>
                    <button class="btn btn-sm btn-outline-primary" onclick="loadDevicesForAssignment()">
                        <i class="fas fa-sync me-1"></i>Reintentar
                    </button>
                </td>
            </tr>
        `;
    }
}

/**
 * Mostrar error general del modal
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
 * Inicializar cuando DOM esté listo
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('📺 [Modal] DOM listo, inicializando...');
    
    // Verificar Bootstrap
    if (typeof bootstrap === 'undefined') {
        console.warn('⚠️ [Modal] Bootstrap no detectado');
    }
    
    // Verificar getPlaylistId
    if (typeof getPlaylistId !== 'function') {
        console.error('❌ [Modal] Función getPlaylistId no disponible');
        return;
    }
    
    // Pequeño delay para asegurar que otros scripts se carguen
    setTimeout(() => {
        try {
            initializeDeviceAssignmentModal();
        } catch (error) {
            console.error('❌ [Modal] Error en inicialización automática:', error);
            showModalError('Error de Inicialización', error.message);
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

// Funciones de seguridad
window.isSecureContext = isSecureContext;
window.getSecureBaseUrl = getSecureBaseUrl;
window.buildApiUrl = buildApiUrl;
window.secureFetch = secureFetch;

console.log('✅ [Modal] Módulo de asignación de dispositivos cargado y configurado correctamente');