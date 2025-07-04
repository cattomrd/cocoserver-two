console.log('📺 Cargando módulo de gestión de dispositivos asignados...');

// ==========================================
// VARIABLES GLOBALES PARA DISPOSITIVOS ASIGNADOS
// ==========================================
let assignedDevicesData = [];
let isLoadingAssignedDevices = false;

// API Configuration - usar la global si existe

// API Configuration - usar la global si existe
const ASSIGNED_DEVICES_API = window.API_CONFIG ? {
    DEVICES: {
        PLAYLIST_DEVICES: (playlistId) => {
            if (window.API_CONFIG.DEVICE_PLAYLISTS && window.API_CONFIG.DEVICE_PLAYLISTS.PLAYLIST_DEVICES) {
                return window.API_CONFIG.DEVICE_PLAYLISTS.PLAYLIST_DEVICES(playlistId);
            }
            // Fallback si no existe
            return `${window.location.origin}/api/device-playlists/playlist/${playlistId}/devices`;
        },
        UNASSIGN: (deviceId, playlistId) => {
            if (window.API_CONFIG.DEVICE_PLAYLISTS && window.API_CONFIG.DEVICE_PLAYLISTS.UNASSIGN) {
                return window.API_CONFIG.DEVICE_PLAYLISTS.UNASSIGN(deviceId, playlistId);
            }
            // Fallback si no existe
            return `${window.location.origin}/api/device-playlists/${deviceId}/${playlistId}`;
        }
    }
} : {
    // Configuración por defecto si no hay API_CONFIG
    DEVICES: {
        PLAYLIST_DEVICES: (playlistId) => `${window.location.origin}/api/device-playlists/playlist/${playlistId}/devices`,
        UNASSIGN: (deviceId, playlistId) => `${window.location.origin}/api/device-playlists/${deviceId}/${playlistId}`
    }
};


// ==========================================
// FUNCIONES PRINCIPALES PARA DISPOSITIVOS ASIGNADOS
// ==========================================

/**
 * Cargar dispositivos asignados a la playlist actual
 */
async function loadAssignedDevices() {
    const playlistId = getPlaylistId();
    if (!playlistId) {
        console.error('❌ No se pudo determinar el ID de la playlist para cargar dispositivos');
        return;
    }
    
    if (isLoadingAssignedDevices) return;
    isLoadingAssignedDevices = true;
    
    console.log(`📺 Cargando dispositivos asignados a playlist ${playlistId}...`);
    
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
        // Usar el endpoint correcto
        const url = ASSIGNED_DEVICES_API.DEVICES.PLAYLIST_DEVICES(playlistId);
        console.log(`📡 Cargando dispositivos desde: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudieron cargar los dispositivos asignados`);
        }
        
        // Procesar respuesta
        const data = await response.json();
        assignedDevicesData = Array.isArray(data) ? data : (data.devices || data.data || []);
        
        console.log(`✅ Dispositivos asignados cargados: ${assignedDevicesData.length}`, assignedDevicesData);
        
        // Ocultar loading
        if (loadingElement) loadingElement.classList.add('d-none');
        
        if (assignedDevicesData.length === 0) {
            showEmptyAssignedDevices();
        } else {
            showAssignedDevicesTable();
        }
        
        // Actualizar contador en estadísticas
        updateAssignedDevicesCount(assignedDevicesData.length);
        
    } catch (error) {
        console.error('❌ Error cargando dispositivos asignados:', error);
        
        // Ocultar loading
        if (loadingElement) loadingElement.classList.add('d-none');
        
        // Mostrar error
        showErrorAssignedDevices(error.message);
        
    } finally {
        isLoadingAssignedDevices = false;
    }
}

/**
 * Mostrar tabla de dispositivos asignados
 */
function showAssignedDevicesTable() {
    const tableElement = document.getElementById('assignedDevicesTable');
    const emptyElement = document.getElementById('assignedDevicesEmpty');
    const devicesList = document.getElementById('assignedDevicesList');
    
    if (tableElement) tableElement.classList.remove('d-none');
    if (emptyElement) emptyElement.classList.add('d-none');
    
    if (!devicesList) {
        console.error('❌ Elemento assignedDevicesList no encontrado');
        return;
    }
    
    // Renderizar dispositivos
    const devicesHTML = assignedDevicesData.map(device => {
        const deviceId = device.device_id || device.id || device.mac_address;
        const deviceName = device.name || device.device_name || 'Dispositivo sin nombre';
        const deviceMac = device.mac_address || device.device_id || 'Sin MAC';
        const deviceLocation = device.location || device.tienda || device.store || 'Sin ubicación';
        const deviceStatus = device.status || device.device_status || 'unknown';
        const lastSeen = device.last_seen || device.updated_at || device.last_connection;
        
        // Determinar estado
        const isOnline = deviceStatus === 'online' || deviceStatus === 'active';
        const statusClass = isOnline ? 'bg-success' : 'bg-secondary';
        const statusText = isOnline ? 'En línea' : 'Fuera de línea';
        const statusIcon = isOnline ? 'fas fa-circle' : 'fas fa-circle';
        
        return `
            <tr data-device-id="${deviceId}">
                <td>
                    <div class="device-info">
                        <div class="device-name fw-semibold text-dark">
                            ${escapeHtml(deviceName)}
                        </div>
                        <small class="text-muted">
                            <i class="fas fa-network-wired me-1"></i>
                            ${escapeHtml(deviceMac)}
                        </small>
                    </div>
                </td>
                <td>
                    <div class="device-location">
                        <i class="fas fa-map-marker-alt me-1 text-muted"></i>
                        <span class="text-muted">${escapeHtml(deviceLocation)}</span>
                    </div>
                </td>
                <td>
                    <span class="badge ${statusClass}">
                        <i class="${statusIcon} me-1"></i>
                        ${statusText}
                    </span>
                </td>
                <td>
                    <small class="text-muted">
                        <i class="fas fa-clock me-1"></i>
                        ${formatDate(lastSeen)}
                    </small>
                </td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-info" 
                                onclick="viewDeviceDetails('${deviceId}')" 
                                title="Ver detalles del dispositivo">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-warning" 
                                onclick="testDeviceConnection('${deviceId}')" 
                                title="Probar conexión">
                            <i class="fas fa-wifi"></i>
                        </button>
                        <button class="btn btn-outline-danger" 
                                onclick="confirmUnassignDevice('${deviceId}', '${escapeHtml(deviceName)}')" 
                                title="Desasignar dispositivo">
                            <i class="fas fa-unlink"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    devicesList.innerHTML = devicesHTML;
    
    console.log(`✅ ${assignedDevicesData.length} dispositivos renderizados en la tabla`);
}

/**
 * Mostrar estado vacío de dispositivos asignados
 */
function showEmptyAssignedDevices() {
    const tableElement = document.getElementById('assignedDevicesTable');
    const emptyElement = document.getElementById('assignedDevicesEmpty');
    
    if (tableElement) tableElement.classList.add('d-none');
    if (emptyElement) {
        emptyElement.classList.remove('d-none');
        emptyElement.innerHTML = `
            <div class="empty-state text-center py-4">
                <i class="fas fa-tv fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">No hay dispositivos asignados</h5>
                <p class="text-muted mb-3">
                    Asigna dispositivos para que puedan reproducir esta lista de reproducción
                </p>
                <button class="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#assignDeviceModal">
                    <i class="fas fa-plus-circle me-1"></i> Asignar Dispositivo
                </button>
            </div>
        `;
    }
    
    console.log('📺 Mostrando mensaje de dispositivos vacío');
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
 * Actualizar contador de dispositivos en estadísticas
 */
function updateAssignedDevicesCount(count) {
    const countElement = document.getElementById('assignedDevices');
    const deviceCountElement = document.getElementById('deviceCount');
    
    if (countElement) {
        countElement.textContent = count;
        console.log(`📊 Contador de dispositivos actualizado: ${count}`);
    }
    
    if (deviceCountElement) {
        deviceCountElement.textContent = count;
    }
}

// ==========================================
// FUNCIONES DE GESTIÓN DE DISPOSITIVOS
// ==========================================

/**
 * Confirmar desasignación de dispositivo
 */
function confirmUnassignDevice(deviceId, deviceName) {
    if (confirm(`¿Estás seguro de que deseas desasignar el dispositivo "${deviceName}"?\n\nEste dispositivo ya no podrá reproducir esta lista de reproducción.`)) {
        unassignDeviceFromPlaylist(deviceId);
    }
}

/**
 * Desasignar dispositivo de la playlist
 */
async function unassignDeviceFromPlaylist(deviceId) {
    const playlistId = getPlaylistId();
    if (!playlistId) {
        console.error('❌ No se pudo obtener el ID de la playlist');
        showToast('Error: No se pudo obtener el ID de la playlist', 'error');
        return;
    }
    
    console.log(`🔗 Desasignando dispositivo ${deviceId} de playlist ${playlistId}...`);
    
    // Deshabilitar botón temporalmente
    const buttonElement = document.querySelector(`button[onclick*="confirmUnassignDevice('${deviceId}'"]`);
    if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    try {
        const url = ASSIGNED_DEVICES_API.DEVICES.UNASSIGN(deviceId, playlistId);
        console.log(`📡 Desasignando desde: ${url}`);
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        console.log('✅ Dispositivo desasignado correctamente');
        
        // Mostrar mensaje de éxito
        showToast('Dispositivo desasignado correctamente', 'success');
        
        // Recargar la lista de dispositivos asignados
        await loadAssignedDevices();
        
    } catch (error) {
        console.error('❌ Error desasignando dispositivo:', error);
        showToast(`Error al desasignar dispositivo: ${error.message}`, 'error');
        
        // Restaurar botón
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
    // Redirigir a la página de detalles del dispositivo
    const detailsUrl = `/ui/devices/${deviceId}`;
    window.open(detailsUrl, '_blank');
}

/**
 * Probar conexión del dispositivo
 */
async function testDeviceConnection(deviceId) {
    console.log(`🔍 Probando conexión del dispositivo ${deviceId}...`);
    
    // Buscar el dispositivo en los datos
    const device = assignedDevicesData.find(d => 
        d.device_id === deviceId || d.id === deviceId || d.mac_address === deviceId
    );
    
    if (!device) {
        showToast('Dispositivo no encontrado', 'error');
        return;
    }
    
    // Por ahora, mostrar información básica del dispositivo
    // En una implementación real, esto haría un ping o test de conectividad
    const deviceInfo = `
        Información del Dispositivo:
        
        Nombre: ${device.name || 'Sin nombre'}
        MAC: ${device.mac_address || 'Sin MAC'}
        Estado: ${device.status || 'Desconocido'}
        Ubicación: ${device.location || device.tienda || 'Sin ubicación'}
        Última conexión: ${formatDate(device.last_seen || device.updated_at)}
    `;
    
    alert(deviceInfo);
}

// ==========================================
// FUNCIONES DE INTEGRACIÓN
// ==========================================

/**
 * Recargar dispositivos asignados después de cambios en asignaciones
 */
async function refreshAssignedDevicesAfterChanges() {
    console.log('🔄 Recargando dispositivos asignados después de cambios...');
    await loadAssignedDevices();
}

/**
 * Inicializar gestión de dispositivos asignados
 */
function initializeAssignedDevicesManager() {
    console.log('🔧 Inicializando gestor de dispositivos asignados...');
    
    // Cargar dispositivos asignados al inicializar
    loadAssignedDevices();
    
    // Configurar integración con el modal
    setupModalIntegration();
    
    console.log('✅ Gestor de dispositivos asignados inicializado');
}

// ==========================================
// INTEGRACIÓN CON EL MODAL DE ASIGNACIÓN
// ==========================================

/**
 * Integrar con el modal de asignación de dispositivos para recargar automáticamente
 */
function setupModalIntegration() {
    // Escuchar el evento de cierre del modal de asignación
    const assignModal = document.getElementById('assignDeviceModal');
    if (assignModal) {
        assignModal.addEventListener('hidden.bs.modal', function() {
            // Recargar dispositivos asignados cuando se cierre el modal
            setTimeout(loadAssignedDevices, 500);
        });
    }
    
    // Override seguro de la función de guardado del modal si existe
    const checkForModalSaveFunction = () => {
        if (typeof window.saveDeviceAssignments_Click === 'function') {
            const originalSaveFunction = window.saveDeviceAssignments_Click;
            window.saveDeviceAssignments_Click = async function() {
                const result = await originalSaveFunction();
                // Recargar dispositivos asignados después de guardar
                setTimeout(loadAssignedDevices, 1000);
                return result;
            };
            console.log('✅ Función de guardado del modal integrada');
        } else {
            // Intentar nuevamente después de un tiempo
            setTimeout(checkForModalSaveFunction, 1000);
        }
    };
    
    // Iniciar verificación
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

/**
 * Formatear fecha de manera legible
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Hoy ' + date.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else if (diffDays === 1) {
            return 'Ayer ' + date.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else if (diffDays < 7) {
            return `Hace ${diffDays} días`;
        } else {
            return date.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    } catch (error) {
        return 'Fecha inválida';
    }
}

/**
 * Mostrar toast notification (usar función global si existe)
 */
function showToast(message, type = 'info') {
    // Si existe función global de toast, usarla
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
        window.showToast(message, type);
        return;
    }
    
    // Toast simple como fallback
    console.log(`📢 [AssignedDevices] Toast ${type}: ${message}`);
    
    const alertClass = type === 'error' ? 'danger' : type;
    const toast = document.createElement('div');
    toast.className = `alert alert-${alertClass} position-fixed`;
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    toast.innerHTML = `
        <strong><i class="fas fa-tv me-2"></i>Dispositivos:</strong> ${message}
        <button type="button" class="btn-close float-end" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// ==========================================
// VERIFICACIÓN DE DEPENDENCIAS
// ==========================================

/**
 * Verificar que las dependencias necesarias estén disponibles
 */
function checkDependencies() {
    console.log('🔍 Verificando dependencias...');
    
    // Verificar getPlaylistId
    if (typeof getPlaylistId !== 'function') {
        console.error('❌ Función getPlaylistId no disponible');
        return false;
    }
    
    // Verificar Bootstrap para modales
    if (typeof bootstrap === 'undefined') {
        console.warn('⚠️ Bootstrap no detectado, algunos elementos pueden no funcionar');
    }
    
    // Verificar elementos DOM esenciales
    const requiredElements = [
        'assignedDevicesTable',
        'assignedDevicesEmpty',
        'assignedDevicesList'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        console.warn('⚠️ Elementos DOM faltantes:', missingElements);
    }
    
    console.log('✅ Verificación de dependencias completada');
    return true;
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

/**
 * Inicializar cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('📺 Inicializando módulo de dispositivos asignados...');
    
    // Pequeño delay para asegurar que otros scripts se hayan cargado
    setTimeout(() => {
        if (checkDependencies()) {
            initializeAssignedDevicesManager();
        } else {
            console.error('❌ No se pudo inicializar debido a dependencias faltantes');
        }
    }, 500);
});

// Hacer funciones disponibles globalmente
window.loadAssignedDevices = loadAssignedDevices;
window.confirmUnassignDevice = confirmUnassignDevice;
window.unassignDeviceFromPlaylist = unassignDeviceFromPlaylist;
window.viewDeviceDetails = viewDeviceDetails;
window.testDeviceConnection = testDeviceConnection;
window.refreshAssignedDevicesAfterChanges = refreshAssignedDevicesAfterChanges;

console.log('✅ Módulo de gestión de dispositivos asignados cargado correctamente');