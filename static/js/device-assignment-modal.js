/**
 * DEVICE ASSIGNMENT MODAL - VERSIÓN DEBUG PARA IPs
 * 
 * Esta versión incluye logs detallados para diagnosticar por qué las IPs no se muestran
 */

console.log('🚀 Inicializando device-assignment-modal.js (versión DEBUG)...');

// ==========================================
// VARIABLES GLOBALES
// ==========================================

let allDevices = [];
let assignedDeviceIds = [];
let pendingChanges = new Set();
let filteredDevices = [];
let searchTerm = '';
let statusFilter = 'all';
let storeFilter = 'all';  // 🆕 Nuevo filtro de tienda
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
        
        // DEBUG: Mostrar estadísticas de carga
        console.log('📊 ESTADÍSTICAS DE CARGA:');
        console.log(`  - Total dispositivos cargados: ${allDevices.length}`);
        console.log(`  - Dispositivos asignados: ${assignedDeviceIds.length}`);
        console.log(`  - Dispositivos sin asignar: ${allDevices.length - assignedDeviceIds.length}`);
        
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
 * Cargar datos del modal con DEBUG
 */
async function loadModalData(playlistId) {
    console.log('📥 Cargando datos para playlist:', playlistId);
    
    try {
        // Cargar dispositivos (con fallback si falla la API)
        await loadAllDevicesWithDebug();
        
        // Cargar asignaciones (con fallback si falla)
        await loadAssignedDevicesWithFallback(playlistId);
        
        console.log(`✅ Datos cargados: ${allDevices.length} dispositivos, ${assignedDeviceIds.length} asignados`);
        
        // 🔍 DEBUG: Analizar los primeros dispositivos
        debugDeviceStructure();
        
        // 🆕 Cargar filtro de tiendas después de cargar dispositivos
        loadStoreFilter();
        
    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        throw error;
    }
}

/**
 * 🔍 DEBUG: Analizar estructura de dispositivos
 */
function debugDeviceStructure() {
    console.log('🔍 === DEBUG: ANÁLISIS DE ESTRUCTURA DE DISPOSITIVOS ===');
    
    if (allDevices.length === 0) {
        console.log('⚠️ No hay dispositivos para analizar');
        return;
    }
    
    // Analizar los primeros 3 dispositivos
    const sampleDevices = allDevices.slice(0, 3);
    
    sampleDevices.forEach((device, index) => {
        console.log(`\n🔍 DISPOSITIVO ${index + 1}:`);
        console.log('Device completo:', device);
        
        // Verificar campos específicos
        console.log('📊 Campos de IP:');
        console.log('  - ip_address_lan:', device.ip_address_lan, '(tipo:', typeof device.ip_address_lan, ')');
        console.log('  - ip_address_wifi:', device.ip_address_wifi, '(tipo:', typeof device.ip_address_wifi, ')');
        
        // Verificar otros campos similares
        console.log('📊 Otros campos de IP (por si hay variaciones):');
        console.log('  - ip_lan:', device.ip_lan);
        console.log('  - ip_wlan:', device.ip_wlan);
        console.log('  - ip_address:', device.ip_address);
        console.log('  - wifi_ip:', device.wifi_ip);
        
        // Verificar todos los campos que empiezan con 'ip'
        const ipFields = Object.keys(device).filter(key => key.toLowerCase().includes('ip'));
        console.log('📊 Todos los campos que contienen "ip":', ipFields);
        ipFields.forEach(field => {
            console.log(`  - ${field}:`, device[field]);
        });
        
        console.log('📊 Otros campos importantes:');
        console.log('  - device_id:', device.device_id);
        console.log('  - name:', device.name);
        console.log('  - is_active:', device.is_active);
        console.log('  - tienda:', device.tienda);
        console.log('  - location:', device.location);
    });
    
    console.log('\n🔍 === FIN DEBUG ===');
}

/**
 * Cargar dispositivos con DEBUG detallado - SIN LÍMITE
 */
async function loadAllDevicesWithDebug() {
    console.log('📥 Cargando TODOS los dispositivos desde API...');
    
    try {
        // Intentar cargar desde API con límite muy alto para obtener todos
        const apiUrl = '/api/devices/?limit=999999';
        console.log('🌐 Haciendo petición a:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 Respuesta de API:', {
            status: response.status,
            statusText: response.statusText,
            headers: {
                'content-type': response.headers.get('content-type')
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('📦 Datos recibidos de API:', data);
            console.log('📦 Tipo de datos:', typeof data, 'Es array:', Array.isArray(data));
            
            if (Array.isArray(data)) {
                allDevices = data;
                console.log(`✅ ${allDevices.length} dispositivos cargados desde API`);
                
                // Debug del primer dispositivo
                if (allDevices.length > 0) {
                    console.log('🔍 Primer dispositivo recibido:', allDevices[0]);
                }
            } else {
                console.warn('⚠️ Los datos no son un array:', data);
                // Si data tiene una propiedad que contiene los dispositivos
                if (data.devices && Array.isArray(data.devices)) {
                    allDevices = data.devices;
                    console.log(`✅ ${allDevices.length} dispositivos cargados desde data.devices`);
                } else if (data.results && Array.isArray(data.results)) {
                    allDevices = data.results;
                    console.log(`✅ ${allDevices.length} dispositivos cargados desde data.results`);
                } else {
                    throw new Error('Estructura de datos desconocida');
                }
            }
        } else {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.warn('⚠️ API no disponible o error, probando método alternativo...', error);
        
        // Método alternativo: Intentar sin límite explícito
        try {
            console.log('🔄 Probando petición sin parámetros de límite...');
            const response2 = await fetch('/api/devices/', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (response2.ok) {
                const data = await response2.json();
                if (Array.isArray(data)) {
                    allDevices = data;
                    console.log(`✅ ${allDevices.length} dispositivos cargados con método alternativo`);
                    return;
                }
            }
        } catch (error2) {
            console.warn('⚠️ Método alternativo también falló:', error2);
        }
        
        // Fallback final: usar datos de ejemplo para desarrollo
        allDevices = createDebugFallbackDevices();
        console.log(`🔄 ${allDevices.length} dispositivos de fallback creados`);
    }
}

/**
 * Crear dispositivos de fallback con DEBUG (más de 100 para probar contadores)
 */
function createDebugFallbackDevices() {
    console.log('🔄 Creando dispositivos de fallback para debug (>100 dispositivos)...');
    
    const fallbackDevices = [];
    
    // Crear 150 dispositivos para probar que funciona con más de 100
    for (let i = 1; i <= 150; i++) {
        // 🆕 Crear variedad de tiendas para probar el filtro
        const tiendas = [
            'Tienda Centro', 'Tienda Norte', 'Tienda Sur', 'Tienda Este', 'Tienda Oeste',
            'Sucursal Principal', 'Sucursal Mall', 'Sucursal Plaza', 'Tienda Express',
            'Outlet Centro', 'Megatienda', 'Tienda Compacta', 'Supermercado Central',
            'Farmacia Norte', 'Librería Sur'
        ];
        
        const device = {
            device_id: `DEV_${i.toString().padStart(3, '0')}`,
            id: `DEV_${i.toString().padStart(3, '0')}`,
            name: `Dispositivo Debug ${i}`,
            device_name: `Dispositivo Debug ${i}`,
            is_active: Math.random() > 0.3,
            tienda: tiendas[i % tiendas.length],  // 🆕 Usar variedad de tiendas
            location: `Ubicación ${i}`,
            ip_address_lan: `192.168.${Math.floor(i/254) + 1}.${(i % 254) + 1}`,
            ip_address_wifi: `10.0.${Math.floor(i/254) + 1}.${(i % 254) + 1}`,
            mac_address: `00:1B:44:11:3A:${(i % 256).toString(16).padStart(2, '0').toUpperCase()}`,
            last_seen: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
            status: Math.random() > 0.5 ? 'online' : 'offline'
        };
        
        fallbackDevices.push(device);
    }
    
    console.log('🔍 Dispositivo de fallback de ejemplo:', fallbackDevices[0]);
    console.log(`🔄 ${fallbackDevices.length} dispositivos de fallback creados para desarrollo`);
    return fallbackDevices;
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
 * 🆕 Cargar filtro de tiendas desde la API híbrida
 */
async function loadStoreFilter() {
    console.log('🏪 Cargando filtro de tiendas desde API...');
    
    const storeFilterSelect = document.getElementById('deviceStoreFilter');
    if (!storeFilterSelect) {
        console.error('❌ No se encontró el select de tiendas #deviceStoreFilter');
        return;
    }
    
    try {
        // 🎯 USAR ENDPOINT HÍBRIDO que maneja tabla vacía automáticamente
        console.log('🌐 Solicitando tiendas desde /api/tiendas/hybrid');
        const response = await fetch('/api/tiendas/hybrid', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const tiendas = await response.json();
            console.log('📦 Tiendas recibidas de API híbrida:', tiendas);
            
            if (Array.isArray(tiendas) && tiendas.length > 0) {
                // Limpiar opciones existentes (excepto "Todas las tiendas")
                storeFilterSelect.innerHTML = '<option value="all" selected>Todas las tiendas</option>';
                
                // Ordenar tiendas alfabéticamente por nombre
                const sortedTiendas = tiendas.sort((a, b) => {
                    const nameA = (a.tienda || '').toLowerCase();
                    const nameB = (b.tienda || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });
                
                // Agregar opciones de tiendas
                sortedTiendas.forEach(tienda => {
                    if (tienda.tienda && tienda.tienda.trim() !== '') {
                        const option = document.createElement('option');
                        option.value = tienda.tienda.trim();
                        
                        // Mostrar nombre y ubicación si está disponible
                        const displayText = tienda.location && tienda.location.trim() !== '' 
                            ? `${tienda.tienda} (${tienda.location})`
                            : tienda.tienda;
                        
                        option.textContent = displayText;
                        option.setAttribute('data-tienda-id', tienda.id);
                        storeFilterSelect.appendChild(option);
                    }
                });
                
                console.log(`✅ Filtro de tiendas cargado desde API híbrida con ${sortedTiendas.length} opciones`);
                
                // 🔍 Verificar si las tiendas tienen ID temporal (extraídas de dispositivos)
                const hasTemporaryIds = sortedTiendas.some(t => typeof t.id === 'number' && t.id <= sortedTiendas.length);
                if (hasTemporaryIds && !tiendas[0]?.location) {
                    console.warn('⚠️ Tiendas extraídas de dispositivos (tabla tiendas vacía). Considera ejecutar sincronización.');
                    showTiendasSyncWarning();
                }
                
            } else {
                console.warn('⚠️ No se recibieron tiendas del endpoint híbrido, usando método de fallback');
                loadStoreFilterFromDevices();
            }
            
        } else {
            console.warn(`⚠️ Error en API híbrida (${response.status}), probando endpoint estándar`);
            await loadStoreFilterFromStandardAPI();
        }
        
    } catch (error) {
        console.warn('⚠️ Error cargando tiendas desde API híbrida, probando endpoint estándar:', error);
        await loadStoreFilterFromStandardAPI();
    }
}

/**
 * 🔄 Método alternativo: usar endpoint estándar /api/tiendas/
 */
async function loadStoreFilterFromStandardAPI() {
    console.log('🔄 Intentando endpoint estándar /api/tiendas/...');
    
    try {
        const response = await fetch('/api/tiendas/', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const tiendas = await response.json();
            console.log('📦 Tiendas recibidas de API estándar:', tiendas);
            
            if (Array.isArray(tiendas) && tiendas.length > 0) {
                populateStoreDropdown(tiendas);
                console.log(`✅ Filtro de tiendas cargado desde API estándar con ${tiendas.length} opciones`);
            } else {
                console.warn('⚠️ Tabla tiendas está vacía, usando método de fallback');
                showTiendasSyncWarning();
                loadStoreFilterFromDevices();
            }
        } else {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.warn('⚠️ Error con API estándar, usando método de fallback:', error);
        loadStoreFilterFromDevices();
    }
}

/**
 * 🎨 Poblar dropdown con tiendas (función auxiliar)
 */
function populateStoreDropdown(tiendas) {
    const storeFilterSelect = document.getElementById('deviceStoreFilter');
    if (!storeFilterSelect) return;
    
    // Limpiar opciones existentes (excepto "Todas las tiendas")
    storeFilterSelect.innerHTML = '<option value="all" selected>Todas las tiendas</option>';
    
    // Ordenar tiendas alfabéticamente por nombre
    const sortedTiendas = tiendas.sort((a, b) => {
        const nameA = (a.tienda || '').toLowerCase();
        const nameB = (b.tienda || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });
    
    // Agregar opciones de tiendas
    sortedTiendas.forEach(tienda => {
        if (tienda.tienda && tienda.tienda.trim() !== '') {
            const option = document.createElement('option');
            option.value = tienda.tienda.trim();
            
            // Mostrar nombre y ubicación si está disponible
            const displayText = tienda.location && tienda.location.trim() !== '' 
                ? `${tienda.tienda} (${tienda.location})`
                : tienda.tienda;
            
            option.textContent = displayText;
            option.setAttribute('data-tienda-id', tienda.id);
            storeFilterSelect.appendChild(option);
        }
    });
}

/**
 * ⚠️ Mostrar advertencia sobre sincronización de tiendas
 */
function showTiendasSyncWarning() {
    console.warn('⚠️ La tabla tiendas parece estar vacía o desactualizada');
    
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) {
        alertsContainer.innerHTML = `
            <div class="alert alert-warning alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Tabla de tiendas no sincronizada:</strong> 
                Las tiendas se están extrayendo de dispositivos. 
                <a href="#" onclick="syncTiendasFromDevices()" class="alert-link">Sincronizar ahora</a>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}

/**
 * 🔄 Sincronizar tiendas desde dispositivos (llamada al endpoint)
 */
async function syncTiendasFromDevices() {
    console.log('🔄 Sincronizando tiendas desde dispositivos...');
    
    try {
        const response = await fetch('/api/tiendas/sync-from-devices', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Sincronización completada:', result);
            
            // Mostrar mensaje de éxito
            const alertsContainer = document.getElementById('deviceModalAlerts');
            if (alertsContainer) {
                alertsContainer.innerHTML = `
                    <div class="alert alert-success alert-dismissible fade show" role="alert">
                        <i class="fas fa-check-circle me-2"></i>
                        <strong>Sincronización completada:</strong> 
                        ${result.created} tiendas creadas, ${result.existing} ya existían.
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                `;
            }
            
            // Recargar el filtro de tiendas
            await loadStoreFilter();
            
        } else {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('❌ Error sincronizando tiendas:', error);
        
        const alertsContainer = document.getElementById('deviceModalAlerts');
        if (alertsContainer) {
            alertsContainer.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    <strong>Error en sincronización:</strong> ${error.message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        }
    }
}

/**
 * 🔄 Método de fallback: cargar tiendas desde dispositivos (método anterior)
 */
function loadStoreFilterFromDevices() {
    console.log('🔄 Cargando filtro de tiendas desde dispositivos (fallback)...');
    
    const storeFilterSelect = document.getElementById('deviceStoreFilter');
    if (!storeFilterSelect) return;
    
    try {
        // Obtener tiendas únicas de todos los dispositivos (método original)
        const stores = new Set();
        
        allDevices.forEach(device => {
            const tienda = device.tienda || device.store || '';
            if (tienda && tienda.trim() !== '' && tienda.trim().toLowerCase() !== 'sin tienda') {
                stores.add(tienda.trim());
            }
        });
        
        // Convertir a array y ordenar
        const sortedStores = Array.from(stores).sort();
        
        console.log(`🔄 ${sortedStores.length} tiendas extraídas de dispositivos:`, sortedStores);
        
        // Limpiar opciones existentes (excepto "Todas las tiendas")
        storeFilterSelect.innerHTML = '<option value="all" selected>Todas las tiendas</option>';
        
        // Agregar opciones de tiendas
        sortedStores.forEach(store => {
            const option = document.createElement('option');
            option.value = store;
            option.textContent = store;
            storeFilterSelect.appendChild(option);
        });
        
        console.log(`✅ Filtro de tiendas cargado con método fallback: ${sortedStores.length} opciones`);
        
    } catch (error) {
        console.error('❌ Error en método fallback para cargar tiendas:', error);
    }
}
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
 * Aplicar filtros y renderizar con DEBUG
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
                const ipLan = (device.ip_address_lan || device.ip_lan || '').toLowerCase();
                const ipWlan = (device.ip_address_wifi || device.ip_wlan || '').toLowerCase();
                
                if (!deviceName.includes(searchLower) && 
                    !deviceId.includes(searchLower) &&
                    !tienda.includes(searchLower) &&
                    !location.includes(searchLower) &&
                    !ipLan.includes(searchLower) &&
                    !ipWlan.includes(searchLower)) {
                    return false;
                }
            }
            
            // 🆕 Filtro de tienda
            if (storeFilter !== 'all') {
                const deviceStore = device.tienda || device.store || '';
                if (deviceStore.trim() !== storeFilter) {
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
        
        // Renderizar con debug
        renderDeviceListWithDebug();
        updateCounters();
        updateActionButtons();
        
    } catch (error) {
        console.error('❌ Error aplicando filtros:', error);
        showDevicesError('Error aplicando filtros: ' + error.message);
    }
}

/**
 * Renderizar lista de dispositivos con DEBUG extensivo
 */
function renderDeviceListWithDebug() {
    console.log('🎨 Renderizando lista de dispositivos...');
    
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
        
        const rowsHtml = filteredDevices.map((device, index) => {
            // DEBUG: Log de cada dispositivo al renderizar
            if (index < 3) { // Solo los primeros 3 para no saturar
                console.log(`🔍 Renderizando dispositivo ${index + 1}:`, {
                    device_id: device.device_id,
                    ip_address_lan: device.ip_address_lan,
                    ip_address_wifi: device.ip_address_wifi,
                    name: device.name,
                    is_active: device.is_active
                });
            }
            
            const deviceId = (device.device_id || device.id || '').toString();
            const isAssigned = assignedDeviceIds.includes(deviceId);
            const isPending = pendingChanges.has(deviceId);
            const willBeAssigned = (isAssigned && !isPending) || (!isAssigned && isPending);
            
            // Datos del dispositivo según el orden solicitado - CON DEBUG
            const deviceIdDisplay = device.device_id || device.id || 'Sin ID';
            const deviceName = device.name || device.device_name || 'Sin nombre';
            const isActive = device.is_active || device.active || false;
            const tienda = device.tienda || device.store || 'Sin tienda';
            const location = device.location || device.ubicacion || 'Sin ubicación';
            
            // 🔍 DIAGNÓSTICO DE IPs - CON MÚLTIPLES FALLBACKS
            let ipLan = 'N/A';
            let ipWlan = 'N/A';
            
            // Intentar múltiples campos para IP LAN
            if (device.ip_address_lan) {
                ipLan = device.ip_address_lan;
            } else if (device.ip_lan) {
                ipLan = device.ip_lan;
            } else if (device.ip_address) {
                ipLan = device.ip_address;
            } else if (device.ipAddressLan) {
                ipLan = device.ipAddressLan;
            }
            
            // Intentar múltiples campos para IP WiFi
            if (device.ip_address_wifi) {
                ipWlan = device.ip_address_wifi;
            } else if (device.ip_wlan) {
                ipWlan = device.ip_wlan;
            } else if (device.wifi_ip) {
                ipWlan = device.wifi_ip;
            } else if (device.ipAddressWifi) {
                ipWlan = device.ipAddressWifi;
            }
            
            // DEBUG: Log de las IPs encontradas
            if (index < 3) {
                console.log(`🔍 IPs para dispositivo ${deviceId}:`, {
                    ipLan: ipLan,
                    ipWlan: ipWlan,
                    campos_disponibles: Object.keys(device).filter(k => k.toLowerCase().includes('ip'))
                });
            }
            
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
                        <small class="text-muted">${deviceIdDisplay}</small>
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
                        <small class="text-muted ${ipLan === 'N/A' ? 'text-danger' : ''}">${ipLan}</small>
                    </td>
                    <td class="align-middle">
                        <small class="text-muted ${ipWlan === 'N/A' ? 'text-danger' : ''}">${ipWlan}</small>
                    </td>
                    <td class="align-middle">
                        <small class="text-muted">${formattedLastSeen}</small>
                    </td>
                    <td class="align-middle text-center">
                        <button class="btn btn-sm btn-outline-info" 
                                onclick="viewDeviceDetailsDebug('${deviceId}')"
                                title="Ver detalles">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        devicesList.innerHTML = rowsHtml;
        console.log(`✅ ${filteredDevices.length} dispositivos renderizados`);
        
        // Debug final de IPs
        const ipLanElements = devicesList.querySelectorAll('td:nth-child(7)');
        const ipWlanElements = devicesList.querySelectorAll('td:nth-child(8)');
        
        console.log('🔍 IPs renderizadas en la tabla:');
        console.log('  - Columnas IP LAN encontradas:', ipLanElements.length);
        console.log('  - Columnas IP WLAN encontradas:', ipWlanElements.length);
        
        if (ipLanElements.length > 0) {
            console.log('  - Primera IP LAN renderizada:', ipLanElements[0].textContent.trim());
        }
        if (ipWlanElements.length > 0) {
            console.log('  - Primera IP WLAN renderizada:', ipWlanElements[0].textContent.trim());
        }
        
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
            console.log('🔍 Búsqueda actualizada:', searchTerm);
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
    const statusFilterSelect = document.getElementById('deviceStatusFilter');
    if (statusFilterSelect) {
        statusFilterSelect.addEventListener('change', function(e) {
            statusFilter = e.target.value;
            console.log('🔍 Filtro de estado actualizado:', statusFilter);
            applyFiltersAndRender();
        });
    }
    
    // 🆕 Filtro de tienda
    const storeFilterSelect = document.getElementById('deviceStoreFilter');
    if (storeFilterSelect) {
        storeFilterSelect.addEventListener('change', function(e) {
            storeFilter = e.target.value;
            console.log('🏪 Filtro de tienda actualizado:', storeFilter);
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
 * Ver detalles de dispositivo con DEBUG
 */
function viewDeviceDetailsDebug(deviceId) {
    const device = allDevices.find(d => (d.device_id || d.id || '').toString() === deviceId);
    
    if (!device) {
        alert('No se encontró el dispositivo');
        return;
    }
    
    console.log('🔍 Detalles completos del dispositivo:', device);
    
    // Mostrar TODOS los campos que contienen 'ip'
    const ipFields = Object.keys(device).filter(key => key.toLowerCase().includes('ip'));
    
    let ipFieldsInfo = ipFields.map(field => `  • ${field}: ${device[field]}`).join('\n');
    if (ipFieldsInfo === '') {
        ipFieldsInfo = '  • No se encontraron campos de IP';
    }
    
    const info = `
DIAGNÓSTICO COMPLETO DEL DISPOSITIVO

Información Básica:
• ID: ${device.device_id || device.id || 'N/A'}
• Nombre: ${device.name || device.device_name || 'N/A'}
• Estado: ${device.is_active ? 'Activo' : 'Inactivo'}
• Tienda: ${device.tienda || 'N/A'}
• Ubicación: ${device.location || 'N/A'}

Campos de IP encontrados:
${ipFieldsInfo}

Otros campos relevantes:
• MAC: ${device.mac_address || 'N/A'}
• Última conexión: ${device.last_seen || 'N/A'}
• Status: ${device.status || 'N/A'}

TOTAL DE CAMPOS: ${Object.keys(device).length}
    `;
    
    alert(info);
}

// Resto de funciones (simplificadas para enfocarse en el debug)
function handleDeviceCheckboxChange(deviceId) {
    if (pendingChanges.has(deviceId)) {
        pendingChanges.delete(deviceId);
    } else {
        pendingChanges.add(deviceId);
    }
    applyFiltersAndRender();
}

function selectAllDevices() {
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

function deselectAllDevices() {
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

function clearAllFilters() {
    console.log('🔄 Limpiando todos los filtros...');
    
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) searchInput.value = '';
    
    const statusFilterSelect = document.getElementById('deviceStatusFilter');
    if (statusFilterSelect) statusFilterSelect.value = 'all';
    
    // 🆕 Limpiar filtro de tienda
    const storeFilterSelect = document.getElementById('deviceStoreFilter');
    if (storeFilterSelect) storeFilterSelect.value = 'all';
    
    searchTerm = '';
    statusFilter = 'all';
    storeFilter = 'all';  // 🆕 Resetear filtro de tienda
    
    applyFiltersAndRender();
}

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

// ==========================================
// FUNCIONES DE UTILIDAD
// ==========================================

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
    storeFilter = 'all';  // 🆕 Resetear filtro de tienda
    
    const alertsContainer = document.getElementById('deviceModalAlerts');
    if (alertsContainer) alertsContainer.innerHTML = '';
}

function handleModalClose() {
    resetModalState();
}

function updateCounters() {
    const counter = document.getElementById('deviceCounter');
    const pagination = document.getElementById('devicesPaginationInfo');
    
    const selectedCount = getSelectedCount();
    const filteredCount = filteredDevices.length;
    const totalCount = allDevices.length;
    
    console.log('📊 Actualizando contadores:', {
        seleccionados: selectedCount,
        filtrados: filteredCount,
        total: totalCount
    });
    
    if (counter) {
        counter.textContent = `${selectedCount} seleccionados de ${filteredCount} dispositivos`;
    }
    
    if (pagination) {
        pagination.textContent = `Mostrando ${filteredCount} de ${totalCount} dispositivos totales`;
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
            `<i class="fas fa-save me-1"></i> Guardar Cambios (${pendingChanges.size})` : 
            '<i class="fas fa-save me-1"></i> Guardar Cambios';
    }
}

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

window.handleDeviceCheckboxChange = handleDeviceCheckboxChange;
window.selectAllDevices = selectAllDevices;
window.deselectAllDevices = deselectAllDevices;
window.clearAllFilters = clearAllFilters;
window.saveDeviceAssignments = saveDeviceAssignments;
window.viewDeviceDetailsDebug = viewDeviceDetailsDebug;

console.log('✅ Device assignment modal (versión DEBUG) cargado');