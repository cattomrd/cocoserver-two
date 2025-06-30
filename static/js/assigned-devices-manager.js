/**
 * ASSIGNED DEVICES MANAGER - GestiÃ³n de Dispositivos Asignados
 * Maneja la visualizaciÃ³n y gestiÃ³n de dispositivos ya asignados a la playlist
 */

// ==========================================
// VARIABLES GLOBALES PARA DISPOSITIVOS ASIGNADOS
// ==========================================
let assignedDevicesData = [];
let isLoadingAssignedDevices = false;

// ==========================================
// FUNCIONES PRINCIPALES PARA DISPOSITIVOS ASIGNADOS
// ==========================================

/**
 * Cargar dispositivos asignados a la playlist actual
 */
async function loadAssignedDevices() {
    const playlistId = getPlaylistId();
    if (!playlistId) {
        console.error('âŒ No se pudo determinar el ID de la playlist para cargar dispositivos');
        return;
    }
    
    if (isLoadingAssignedDevices) return;
    isLoadingAssignedDevices = true;
    
    console.log(`ðŸ”„ Cargando dispositivos asignados a playlist ${playlistId}...`);
    
    // Elementos del DOM
    const loadingElement = document.getElementById('loadingAssignedDevices');
    const tableElement = document.getElementById('assignedDevicesTable');
    const emptyElement = document.getElementById('assignedDevicesEmpty');
    const devicesList = document.getElementById('assignedDevicesList');
    
    // Mostrar estado de carga
    if (loadingElement) loadingElement.classList.remove('d-none');
    if (tableElement) tableElement.classList.add('d-none');
    if (emptyElement) emptyElement.classList.add('d-none');
    
    try {
        // Usar el endpoint correcto basado en la documentaciÃ³n del proyecto
        const url = `${API_URL}/device-playlists/playlist/${playlistId}/devices`;
        console.log(`ðŸ“¡ Cargando dispositivos desde: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudieron cargar los dispositivos asignados`);
        }
        
        // Procesar respuesta
        const data = await response.json();
        assignedDevicesData = Array.isArray(data) ? data : [];
        
        console.log(`âœ… Dispositivos asignados cargados: ${assignedDevicesData.length}`, assignedDevicesData);
        
        // Mostrar dispositivos o mensaje vacÃ­o
        if (assignedDevicesData.length === 0) {
            showEmptyAssignedDevices();
        } else {
            renderAssignedDevices();
        }
        
        // Actualizar contador en estadÃ­sticas
        updateAssignedDevicesCount(assignedDevicesData.length);
        
    } catch (error) {
        console.error('âŒ Error cargando dispositivos asignados:', error);
        showErrorAssignedDevices(error.message);
    } finally {
        isLoadingAssignedDevices = false;
        if (loadingElement) loadingElement.classList.add('d-none');
    }
}

/**
 * Renderizar tabla de dispositivos asignados
 */
function renderAssignedDevices() {
    const tableElement = document.getElementById('assignedDevicesTable');
    const emptyElement = document.getElementById('assignedDevicesEmpty');
    const devicesList = document.getElementById('assignedDevicesList');
    
    if (!devicesList) {
        console.error('âŒ Elemento assignedDevicesList no encontrado');
        return;
    }
    
    // Mostrar tabla y ocultar mensaje vacÃ­o
    if (tableElement) tableElement.classList.remove('d-none');
    if (emptyElement) emptyElement.classList.add('d-none');
    
    // Generar HTML para cada dispositivo
    const devicesHTML = assignedDevicesData.map(device => {
        // Determinar estado del dispositivo
        const statusClass = device.is_active ? 'bg-success' : 'bg-danger';
        const statusText = device.is_active ? 'Activo' : 'Inactivo';
        
        // Formatear Ãºltima conexiÃ³n
        let lastConnection = 'Nunca';
        if (device.last_seen) {
            try {
                const date = new Date(device.last_seen);
                lastConnection = date.toLocaleDateString('es-ES') + ' ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            } catch (e) {
                lastConnection = 'Fecha invÃ¡lida';
            }
        }
        
        return `
            <tr class="${device.is_active ? '' : 'table-warning'}">
                <td>
                    <div class="d-flex align-items-center">
                        <i class="fas fa-tv text-primary me-2"></i>
                        <div>
                            <h6 class="mb-0">${escapeHtml(device.name || 'Sin nombre')}</h6>
                            <small class="text-muted">${escapeHtml(device.device_id || device.mac_address || '')}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <div>
                        <span class="fw-bold">${escapeHtml(device.location || 'Sin ubicaciÃ³n')}</span>
                        ${device.tienda ? `<br><small class="text-muted">${escapeHtml(device.tienda)}</small>` : ''}
                    </div>
                </td>
                <td>
                    <span class="badge ${statusClass}">${statusText}</span>
                </td>
                <td>
                    <small class="text-muted">${lastConnection}</small>
                </td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" 
                                onclick="viewDeviceDetails('${device.device_id || device.mac_address}')"
                                title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger" 
                                onclick="confirmUnassignDevice('${device.device_id || device.mac_address}', '${escapeHtml(device.name || device.device_id)}')"
                                title="Desasignar dispositivo">
                            <i class="fas fa-unlink"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    devicesList.innerHTML = devicesHTML;
    
    console.log(`âœ… ${assignedDevicesData.length} dispositivos renderizados en la tabla`);
}

/**
 * Mostrar mensaje cuando no hay dispositivos asignados
 */
function showEmptyAssignedDevices() {
    const tableElement = document.getElementById('assignedDevicesTable');
    const emptyElement = document.getElementById('assignedDevicesEmpty');
    
    if (tableElement) tableElement.classList.add('d-none');
    if (emptyElement) {
        emptyElement.classList.remove('d-none');
        emptyElement.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-tv fa-2x text-muted mb-3"></i>
                <p class="text-muted mb-2">No hay dispositivos asignados a esta lista</p>
                <button class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#assignDeviceModal">
                    <i class="fas fa-plus-circle me-1"></i> Asignar Dispositivo
                </button>
            </div>
        `;
    }
    
    console.log('ðŸ“º Mostrando mensaje de dispositivos vacÃ­o');
}

/**
 * Mostrar error al cargar dispositivos asignados
 */
function showErrorAssignedDevices(errorMessage) {
    const tableElement = document.getElementById('assignedDevicesTable');
    const emptyElement = document.getElementById('assignedDevicesEmpty');
    
    if (tableElement) tableElement.classList.add('d-none');
    if (emptyElement) {
        emptyElement.classList.remove('d-none');
        emptyElement.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-exclamation-triangle fa-2x text-danger mb-3"></i>
                <p class="text-danger mb-2">Error al cargar dispositivos asignados</p>
                <p class="text-muted mb-3">${escapeHtml(errorMessage)}</p>
                <button class="btn btn-sm btn-outline-primary" onclick="loadAssignedDevices()">
                    <i class="fas fa-sync me-1"></i> Reintentar
                </button>
            </div>
        `;
    }
    
    showToast(`Error al cargar dispositivos: ${errorMessage}`, 'error');
}

/**
 * Actualizar contador de dispositivos en estadÃ­sticas
 */
function updateAssignedDevicesCount(count) {
    const countElement = document.getElementById('assignedDevices');
    if (countElement) {
        countElement.textContent = count;
        console.log(`ðŸ“Š Contador de dispositivos actualizado: ${count}`);
    }
}

// ==========================================
// FUNCIONES DE GESTIÃ“N DE DISPOSITIVOS
// ==========================================

/**
 * Confirmar desasignaciÃ³n de dispositivo
 */
function confirmUnassignDevice(deviceId, deviceName) {
    if (confirm(`Â¿EstÃ¡s seguro de que deseas desasignar el dispositivo "${deviceName}" de esta lista de reproducciÃ³n?`)) {
        unassignDeviceFromPlaylist(deviceId);
    }
}

/**
 * Desasignar dispositivo de la playlist
 */
async function unassignDeviceFromPlaylist(deviceId) {
    const playlistId = getPlaylistId();
    if (!playlistId) {
        showToast('Error: No se pudo determinar el ID de la playlist', 'error');
        return;
    }
    
    console.log(`ðŸ”„ Desasignando dispositivo ${deviceId} de playlist ${playlistId}...`);
    
    try {
        // Mostrar loading en el botÃ³n
        const buttonElement = document.querySelector(`button[onclick*="confirmUnassignDevice('${deviceId}'"]`);
        if (buttonElement) {
            buttonElement.disabled = true;
            buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        // Usar el endpoint correcto para desasignar
        const url = `${API_URL}/device-playlists/${deviceId}/${playlistId}`;
        console.log(`ðŸ“¡ Desasignando dispositivo: ${url}`);
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Error ${response.status}`);
        }
        
        showToast('Dispositivo desasignado correctamente', 'success');
        
        // Recargar lista de dispositivos asignados
        await loadAssignedDevices();
        
        // Actualizar datos del modal de asignaciÃ³n si estÃ¡ abierto
        if (document.getElementById('assignDeviceModal').classList.contains('show')) {
            await loadCurrentAssignedDevices();
            filterDevicesInModal();
        }
        
    } catch (error) {
        console.error('âŒ Error desasignando dispositivo:', error);
        showToast(`Error al desasignar dispositivo: ${error.message}`, 'error');
        
        // Restaurar botÃ³n
        const buttonElement = document.querySelector(`button[onclick*="confirmUnassignDevice('${deviceId}'"]`);
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<i class="fas fa-unlink"></i>';
        }
    }
}

/**
 * Ver detalles del dispositivo
 */
function viewDeviceDetails(deviceId) {
    // Redirigir a la pÃ¡gina de detalles del dispositivo
    const detailsUrl = `/ui/devices/${deviceId}`;
    window.open(detailsUrl, '_blank');
}

// ==========================================
// FUNCIONES DE INTEGRACIÃ“N
// ==========================================

/**
 * Recargar dispositivos asignados despuÃ©s de cambios en asignaciones
 */
async function refreshAssignedDevicesAfterChanges() {
    console.log('ðŸ”„ Recargando dispositivos asignados despuÃ©s de cambios...');
    await loadAssignedDevices();
}

/**
 * Inicializar gestiÃ³n de dispositivos asignados
 */
function initializeAssignedDevicesManager() {
    console.log('ðŸ”§ Inicializando gestor de dispositivos asignados...');
    
    // Cargar dispositivos asignados al inicializar
    loadAssignedDevices();
    
    // Configurar integraciÃ³n con el modal
    setupModalIntegration();
    
    console.log('âœ… Gestor de dispositivos asignados inicializado');
}

// ==========================================
// INTEGRACIÃ“N CON EL MODAL DE ASIGNACIÃ“N
// ==========================================

/**
 * Integrar con el modal de asignaciÃ³n de dispositivos para recargar automÃ¡ticamente
 */
function setupModalIntegration() {
    // Escuchar el evento de cierre del modal de asignaciÃ³n
    const assignModal = document.getElementById('assignDeviceModal');
    if (assignModal) {
        assignModal.addEventListener('hidden.bs.modal', function() {
            // Recargar dispositivos asignados cuando se cierre el modal
            setTimeout(loadAssignedDevices, 500);
        });
    }
    
    // Override seguro de la funciÃ³n de guardado del modal si existe
    const checkForModalSaveFunction = () => {
        if (typeof window.saveDeviceAssignments_Click === 'function') {
            const originalSaveFunction = window.saveDeviceAssignments_Click;
            window.saveDeviceAssignments_Click = async function() {
                const result = await originalSaveFunction();
                // Recargar dispositivos asignados despuÃ©s de guardar
                setTimeout(loadAssignedDevices, 1000);
                return result;
            };
            console.log('âœ… FunciÃ³n de guardado del modal integrada');
        } else {
            // Intentar nuevamente despuÃ©s de un tiempo
            setTimeout(checkForModalSaveFunction, 1000);
        }
    };
    
    // Iniciar verificaciÃ³n
    checkForModalSaveFunction();
}

// ==========================================
// FUNCIONES UTILITARIAS
// ==========================================

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
// INICIALIZACIÃ“N
// ==========================================

/**
 * Inicializar cuando el DOM estÃ© listo
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('ðŸ“º Inicializando mÃ³dulo de dispositivos asignados...');
    
    // PequeÃ±o delay para asegurar que otros scripts se hayan cargado
    setTimeout(initializeAssignedDevicesManager, 500);
});

// Hacer funciones disponibles globalmente
window.loadAssignedDevices = loadAssignedDevices;
window.confirmUnassignDevice = confirmUnassignDevice;
window.unassignDeviceFromPlaylist = unassignDeviceFromPlaylist;
window.viewDeviceDetails = viewDeviceDetails;
window.refreshAssignedDevicesAfterChanges = refreshAssignedDevicesAfterChanges;

console.log('âœ… MÃ³dulo de gestiÃ³n de dispositivos asignados cargado correctamente');