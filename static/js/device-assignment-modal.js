/**
 * DEVICE ASSIGNMENT MODAL - Código JavaScript para el Modal de Asignación de Dispositivos
 * Gestiona la asignación de dispositivos a listas de reproducción
 */

// ==========================================
// VARIABLES GLOBALES PARA EL MODAL
// ==========================================
let allDevicesForAssignment = [];
let filteredDevicesForAssignment = [];
let currentAssignedDeviceIds = [];
let pendingDeviceChanges = new Set();
let isLoadingDevices = false;

// ==========================================
// FUNCIONES PRINCIPALES DEL MODAL
// ==========================================

/**
 * Inicializar el modal de asignación de dispositivos
 */
function initializeDeviceAssignmentModal() {
    console.log('🔧 Inicializando modal de asignación de dispositivos...');
    
    // Configurar event listeners del modal
    setupDeviceModalEventListeners();
    
    // Cargar dispositivos cuando se abra el modal
    const deviceModal = document.getElementById('assignDeviceModal');
    if (deviceModal) {
        deviceModal.addEventListener('show.bs.modal', async function() {
            console.log('📺 Abriendo modal de asignación de dispositivos...');
            await loadDevicesForAssignment();
            await loadCurrentAssignedDevices();
        });
        
        deviceModal.addEventListener('hidden.bs.modal', function() {
            console.log('📺 Cerrando modal de asignación de dispositivos...');
            resetDeviceAssignmentModal();
        });
    }
    
    console.log('✅ Modal de asignación de dispositivos inicializado');
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
}

/**
 * Cargar todos los dispositivos disponibles para asignación
 */
async function loadDevicesForAssignment() {
    console.log('📺 Cargando dispositivos para asignación...');
    
    if (isLoadingDevices) return;
    isLoadingDevices = true;
    
    const devicesList = document.getElementById('availableDevicesList');
    if (!devicesList) {
        console.error('❌ Elemento availableDevicesList no encontrado');
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
        const response = await fetch(`${API_URL}/devices`);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudieron cargar los dispositivos`);
        }
        
        const data = await response.json();
        allDevicesForAssignment = Array.isArray(data) ? data : (data.devices || []);
        
        console.log(`✅ Dispositivos cargados: ${allDevicesForAssignment.length}`);
        
        // Aplicar filtros iniciales
        filterDevicesInModal();
        
    } catch (error) {
        console.error('❌ Error cargando dispositivos:', error);
        devicesList.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-3 text-danger">
                    <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                    <p class="mb-1">Error cargando dispositivos</p>
                    <p class="small text-muted mb-2">${error.message}</p>
                    <button class="btn btn-sm btn-outline-primary" onclick="loadDevicesForAssignment()">
                        <i class="fas fa-sync"></i> Reintentar
                    </button>
                </td>
            </tr>
        `;
    } finally {
        isLoadingDevices = false;
    }
}

/**
 * Cargar dispositivos actualmente asignados a la playlist
 */
async function loadCurrentAssignedDevices() {
    console.log('📺 Cargando dispositivos asignados actuales...');
    
    const playlistId = getPlaylistId();
    if (!playlistId) {
        console.error('❌ No se pudo obtener el ID de playlist');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}/devices`);
        
        if (response.ok) {
            const assignedDevices = await response.json();
            currentAssignedDeviceIds = assignedDevices.map(device => 
                device.device_id || device.id || device.mac_address
            );
            console.log(`✅ Dispositivos asignados cargados: ${currentAssignedDeviceIds.length}`);
        } else {
            console.warn('⚠️ No se pudieron cargar dispositivos asignados');
            currentAssignedDeviceIds = [];
        }
        
    } catch (error) {
        console.error('❌ Error cargando dispositivos asignados:', error);
        currentAssignedDeviceIds = [];
    }
}

/**
 * Filtrar dispositivos según búsqueda y estado
 */
function filterDevicesInModal(searchTerm = '') {
    console.log('🔍 Filtrando dispositivos en modal...');
    
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
    
    console.log(`🔍 Dispositivos filtrados: ${filteredDevicesForAssignment.length}`);
    
    // Renderizar dispositivos filtrados
    renderFilteredDevices();
}

/**
 * Renderizar la lista de dispositivos filtrados
 */
function renderFilteredDevices() {
    const devicesList = document.getElementById('availableDevicesList');
    if (!devicesList) {
        console.error('❌ Elemento availableDevicesList no encontrado');
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
        
        return `
            <tr ${hasPendingChange ? 'class="table-warning"' : ''}>
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
                            <h6 class="mb-0">${escapeHtml(device.name || 'Sin nombre')}</h6>
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
    console.log(`📺 Checkbox cambiado para dispositivo: ${deviceId}`);
    
    if (pendingDeviceChanges.has(deviceId)) {
        // Si ya estaba en cambios pendientes, quitarlo (volver al estado original)
        pendingDeviceChanges.delete(deviceId);
    } else {
        // Añadir a cambios pendientes
        pendingDeviceChanges.add(deviceId);
    }
    
    console.log(`📺 Cambios pendientes: ${pendingDeviceChanges.size}`);
    
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
    console.log('💾 Guardando cambios de asignación de dispositivos...');
    
    if (pendingDeviceChanges.size === 0) {
        showToast('No hay cambios pendientes para guardar', 'warning');
        return;
    }
    
    const playlistId = getPlaylistId();
    if (!playlistId) {
        showToast('Error: No se pudo determinar el ID de la playlist', 'error');
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
        
        // Procesar cada cambio pendiente
        for (const deviceId of pendingDeviceChanges) {
            const isCurrentlyAssigned = currentAssignedDeviceIds.includes(deviceId);
            
            if (isCurrentlyAssigned) {
                // Desasignar dispositivo
                console.log(`📺 Desasignando dispositivo: ${deviceId}`);
                promises.push(unassignDeviceFromPlaylist(playlistId, deviceId));
            } else {
                // Asignar dispositivo
                console.log(`📺 Asignando dispositivo: ${deviceId}`);
                promises.push(assignDeviceToPlaylist(playlistId, deviceId));
            }
        }
        
        // Esperar a que todas las peticiones terminen
        const results = await Promise.allSettled(promises);
        
        // Verificar si hubo errores
        const failedOperations = results.filter(result => result.status === 'rejected');
        
        if (failedOperations.length > 0) {
            console.error('❌ Algunas operaciones fallaron:', failedOperations);
            showToast(`${pendingDeviceChanges.size - failedOperations.length}/${pendingDeviceChanges.size} cambios guardados correctamente`, 'warning');
        } else {
            showToast('Todas las asignaciones de dispositivos se guardaron correctamente', 'success');
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
        console.error('❌ Error guardando asignaciones:', error);
        showToast(`Error al guardar asignaciones: ${error.message}`, 'error');
    } finally {
        // Restaurar botón de guardar
        updateSaveButtonState();
    }
}

/**
 * Asignar dispositivo a playlist
 */
async function assignDeviceToPlaylist(playlistId, deviceId) {
    const response = await fetch(`${API_URL}/device-playlists`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            device_id: deviceId,
            playlist_id: parseInt(playlistId)
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error asignando dispositivo ${deviceId}: ${errorText}`);
    }
    
    return await response.json();
}

/**
 * Desasignar dispositivo de playlist
 */
async function unassignDeviceFromPlaylist(playlistId, deviceId) {
    const response = await fetch(`${API_URL}/device-playlists/${deviceId}/${playlistId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error desasignando dispositivo ${deviceId}: ${errorText}`);
    }
    
    return true;
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
    console.log('🔄 Reseteando modal de asignación de dispositivos...');
    
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

// ==========================================
// INICIALIZACIÓN
// ==========================================

/**
 * Inicializar cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('📺 Inicializando módulo de asignación de dispositivos...');
    initializeDeviceAssignmentModal();
});

console.log('✅ Módulo de asignación de dispositivos cargado correctamente');