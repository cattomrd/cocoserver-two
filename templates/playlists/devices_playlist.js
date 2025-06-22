/**
 * IMPLEMENTACIÓN CORRECTA PARA API DE DISPOSITIVOS
 * 
 * Este código utiliza el endpoint correcto proporcionado por el backend:
 * /api/device-playlists/playlist/{playlist_id}/devices
 */

// Definición correcta de endpoints para API de dispositivos
const DEVICE_API_ENDPOINTS = {
    // Endpoints para dispositivos
    devices: `${API_URL}/devices`,
    deviceById: (id) => `${API_URL}/devices/${id}`,
    
    // Endpoint correcto para dispositivos por playlist
    playlistDevices: (id) => `${API_URL}/device-playlists/playlist/${id}/devices`,
    
    // Endpoints para asignar/desasignar (ajustar según la API real)
    assignDevice: (playlistId, deviceId) => `${API_URL}/device-playlists/assign`,
    unassignDevice: (playlistId, deviceId) => `${API_URL}/device-playlists/unassign`
};

/**
 * Cargar dispositivos asignados a la playlist actual
 * Usando el endpoint correcto
 */
async function loadAssignedDevices() {
    const playlistId = getPlaylistId();
    if (!playlistId) {
        console.error('❌ No se pudo determinar el ID de la playlist para cargar dispositivos');
        return;
    }
    
    console.log(`🔄 Cargando dispositivos asignados a playlist ${playlistId}...`);
    
    // Mostrar estado de carga
    const loadingElement = document.getElementById('loadingAssignedDevices');
    const tableElement = document.getElementById('assignedDevicesTable');
    const emptyElement = document.getElementById('assignedDevicesEmpty');
    
    if (loadingElement) loadingElement.classList.remove('d-none');
    if (tableElement) tableElement.classList.add('d-none');
    if (emptyElement) emptyElement.classList.add('d-none');
    
    try {
        // Usar el endpoint correcto
        const url = DEVICE_API_ENDPOINTS.playlistDevices(playlistId);
        console.log(`📡 Cargando dispositivos desde: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudieron cargar los dispositivos`);
        }
        
        // Procesar respuesta
        const data = await response.json();
        assignedDevices = Array.isArray(data) ? data : (data.devices || []);
        
        console.log(`✅ Dispositivos asignados cargados:`, assignedDevices);
        
        // Actualizar UI
        renderAssignedDevices();
        
    } catch (error) {
        console.error('❌ Error cargando dispositivos asignados:', error);
        showToast(`Error al cargar dispositivos: ${error.message}`, 'error');
        
        // Mostrar error en la UI
        if (loadingElement) loadingElement.classList.add('d-none');
        if (emptyElement) {
            emptyElement.classList.remove('d-none');
            emptyElement.innerHTML = `
                <i class="fas fa-exclamation-triangle fa-2x text-danger mb-3"></i>
                <p class="text-danger mb-2">Error al cargar dispositivos asignados</p>
                <p class="text-muted mb-2">${error.message}</p>
                <button class="btn btn-sm btn-outline-primary" onclick="loadAssignedDevices()">
                    <i class="fas fa-sync me-1"></i> Reintentar
                </button>
            `;
        }
    } finally {
        // Ocultar estado de carga
        if (loadingElement) loadingElement.classList.add('d-none');
    }
}

/**
 * Asignar dispositivo a la playlist
 */
async function assignDeviceAPI(playlistId, deviceId) {
    // Usar el endpoint correcto para asignar
    const url = DEVICE_API_ENDPOINTS.assignDevice(playlistId, deviceId);
    console.log(`📡 Asignando dispositivo: ${url}`);
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        // Ajustar según la estructura esperada por la API
        body: JSON.stringify({
            device_id: deviceId,
            playlist_id: playlistId
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}`);
    }
    
    return await response.json();
}

/**
 * Desasignar dispositivo de la playlist
 */
async function unassignDeviceAPI(playlistId, deviceId) {
    // Usar el endpoint correcto para desasignar
    const url = DEVICE_API_ENDPOINTS.unassignDevice(playlistId, deviceId);
    console.log(`📡 Desasignando dispositivo: ${url}`);
    
    const response = await fetch(url, {
        method: 'POST', // O DELETE, según la API
        headers: {
            'Content-Type': 'application/json'
        },
        // Ajustar según la estructura esperada por la API
        body: JSON.stringify({
            device_id: deviceId,
            playlist_id: playlistId
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}`);
    }
    
    return true;
}

/**
 * Guardar cambios en asignaciones de dispositivos
 * Versión actualizada para trabajar con el endpoint correcto
 */
async function saveDeviceAssignments() {
    if (deviceAssignmentUpdates.size === 0) {
        console.log('✅ No hay cambios en asignaciones para guardar');
        return;
    }
    
    const playlistId = getPlaylistId();
    if (!playlistId) {
        showToast('No se pudo determinar el ID de la playlist', 'error');
        return;
    }
    
    console.log(`💾 Guardando cambios en asignaciones para playlist ${playlistId}...`);
    
    // Deshabilitar botón de guardar
    const saveButton = document.getElementById('saveDeviceAssignments');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Guardando...
        `;
    }
    
    try {
        // Procesar cada cambio de asignación
        const promises = [];
        
        for (const deviceId of deviceAssignmentUpdates) {
            // Verificar si debe asignar o desasignar
            const isCurrentlyAssigned = assignedDevices.some(d => (d.device_id || d.id) === deviceId);
            
            // Realizar petición a la API
            if (isCurrentlyAssigned) {
                // Desasignar dispositivo
                promises.push(unassignDeviceAPI(playlistId, deviceId));
            } else {
                // Asignar dispositivo
                promises.push(assignDeviceAPI(playlistId, deviceId));
            }
        }
        
        // Esperar a que todas las peticiones terminen
        await Promise.all(promises);
        
        // Limpiar estado
        deviceAssignmentUpdates.clear();
        deviceAssignmentsChanged = false;
        
        // Actualizar lista de dispositivos asignados
        await loadAssignedDevices();
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('assignDeviceModal'));
        if (modal) modal.hide();
        
        showToast('Asignaciones de dispositivos actualizadas', 'success');
        
    } catch (error) {
        console.error('❌ Error guardando asignaciones:', error);
        showToast(`Error al guardar asignaciones: ${error.message}`, 'error');
    } finally {
        // Restaurar botón de guardar
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = `<i class="fas fa-save me-1"></i> Guardar Asignaciones`;
            saveButton.classList.add('btn-primary');
            saveButton.classList.remove('btn-warning');
        }
        
        // Actualizar UI
        updateDeviceAssignmentUI();
    }
}