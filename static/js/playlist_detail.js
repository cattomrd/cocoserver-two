/**
 * PLAYLIST DETAIL JS
 * Funcionalidad para la página de detalle de playlist
 * Versión simplificada y optimizada
 */

(function() {
    'use strict';
    
    console.log('🎬 Inicializando playlist_detail.js...');
    
    // ==========================================
    // CONFIGURACIÓN Y VARIABLES
    // ==========================================
    
    // Opciones de configuración
    const CONFIG = {
        API_BASE: window.location.origin + '/api',
        DEFAULT_PAGE_SIZE: 25,
        TOAST_DURATION: 3000
    };
    
    // Estado de paginación y búsqueda
    const state = {
        currentPage: 1,
        pageSize: CONFIG.DEFAULT_PAGE_SIZE,
        totalPages: 1,
        searchTerm: '',
        isLoading: {
            videos: false,
            devices: false
        },
        hasUnsavedChanges: false
    };
    
    // ==========================================
    // FUNCIONES DE INICIALIZACIÓN
    // ==========================================
    
    /**
     * Inicializar la aplicación
     */
    function init() {
       // alert( window.location.origin+'/api');
        console.log('🚀 Inicializando aplicación...');
        
        // Obtener ID de playlist
        const playlistId = getPlaylistId();
        if (!playlistId) {
            showToast('No se pudo determinar el ID de la playlist', 'error');
            return;
        }
        
        console.log(`📋 ID de playlist: ${playlistId}`);
        
        // Mostrar pantallas de carga
        toggleLoadingState('playlistVideos', true);
        toggleLoadingState('availableVideos', true);
        
        // Cargar datos principales
        Promise.all([
            // Cargar datos de playlist si no están ya disponibles
            (!window.currentPlaylistData || window.currentPlaylistData.id != playlistId) 
                ? loadPlaylistData(playlistId) 
                : Promise.resolve(window.currentPlaylistData),
                
            // Cargar videos disponibles
           loadAvailableVideos(),
            
            // Cargar dispositivos asignados
            loadAssignedDevices(playlistId)
        ])
        .then(([playlistData]) => {
            // Actualizar estadísticas
            updateStats();
            
            // Ocultar pantallas de carga
            toggleLoadingState('playlistVideos', false);
            toggleLoadingState('availableVideos', false);
            
            // Configurar arrastrar y soltar
            setupDragAndDrop();
            
            console.log('✅ Aplicación inicializada correctamente');
        })
        .catch(error => {
            console.error('❌ Error inicializando aplicación:', error);
            showToast('Error al inicializar la aplicación', 'error');
            
            // Ocultar pantallas de carga
            toggleLoadingState('playlistVideos', false);
            toggleLoadingState('availableVideos', false);
        });
        
        // Configurar event listeners
        setupEventListeners();
    }
    
    /**
     * Obtener ID de la playlist de manera robusta
     */
    function getPlaylistId() {
        try {
            // Si ya tenemos el ID en una variable global, usarlo
            if (window.currentPlaylistData && window.currentPlaylistData.id) {
                return window.currentPlaylistData.id;
            }
            
            // Método 1: URL params
            const urlParams = new URLSearchParams(window.location.search);
            const idFromUrl = urlParams.get('id');
            if (idFromUrl) {
                const parsedId = parseInt(idFromUrl);
                if (!isNaN(parsedId) && parsedId > 0) {
                    return parsedId;
                }
            }
            
            // Método 2: Path URL
            const pathMatch = window.location.pathname.match(/\/playlists?\/(\d+)/);
            if (pathMatch && pathMatch[1]) {
                const parsedId = parseInt(pathMatch[1]);
                if (!isNaN(parsedId) && parsedId > 0) {
                    return parsedId;
                }
            }
            
            // Método 3: Elemento hidden
            const idElement = document.getElementById('playlist-id');
            if (idElement && idElement.value) {
                const parsedId = parseInt(idElement.value);
                if (!isNaN(parsedId) && parsedId > 0) {
                    return parsedId;
                }
            }
            
            // Método 4: JSON embebido
            const playlistElement = document.getElementById('playlist-data');
            if (playlistElement && playlistElement.textContent) {
                try {
                    const data = JSON.parse(playlistElement.textContent);
                    if (data && data.id) {
                        return data.id;
                    }
                } catch (jsonError) {
                    console.warn('⚠️ Error parseando JSON:', jsonError);
                }
            }
            
            console.warn('⚠️ No se pudo determinar ID de playlist');
            return null;
            
        } catch (error) {
            console.error('❌ Error obteniendo ID de playlist:', error);
            return null;
        }
    }
    
    /**
     * Configurar event listeners
     */
    function setupEventListeners() {
        // Búsqueda de videos
        const searchInput = document.getElementById('videoSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                state.searchTerm = this.value.trim();
                filterVideos();
            });
        }
        
        // Limpiar búsqueda
        const clearSearchBtn = document.getElementById('clearVideoSearch');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', function() {
                const searchInput = document.getElementById('videoSearchInput');
                if (searchInput) {
                    searchInput.value = '';
                    state.searchTerm = '';
                    filterVideos();
                }
            });
        }
        
        // Cambiar tamaño de página
        const pageSizeSelect = document.getElementById('videoPageSize');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', function() {
                state.pageSize = this.value === 'all' ? 1000 : parseInt(this.value);
                state.currentPage = 1;
                loadAvailableVideos();
            });
        }
        
        // Guardar cambios
        const saveChangesBtn = document.getElementById('saveChangesBtn');
        if (saveChangesBtn) {
            saveChangesBtn.addEventListener('click', saveChanges);
        }
        
        // Configurar advertencia al salir con cambios sin guardar
        window.addEventListener('beforeunload', function(e) {
            if (state.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?';
                return e.returnValue;
            }
        });
    }
    
    // ==========================================
    // FUNCIONES DE CARGA DE DATOS
    // ==========================================
    
    /**
     * Cargar datos de la playlist
     */
    function loadPlaylistData(playlistId) {
        console.log(`🔍 Cargando datos de playlist ${playlistId}...`);
        
        return fetch(`${CONFIG.API_BASE}/playlists/${playlistId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Guardar datos en variable global
                window.currentPlaylistData = data;
                
                // Cargar videos si están disponibles
                if (data.videos && Array.isArray(data.videos)) {
                    window.playlistVideos = data.videos;
                    renderPlaylistVideos();
                } else {
                    // Si no hay videos en los datos, cargarlos por separado
                    return loadPlaylistVideos(playlistId);
                }
                
                console.log(`✅ Datos de playlist cargados: ${data.title}`);
                return data;
            })
            .catch(error => {
                console.error('❌ Error cargando datos de playlist:', error);
                showToast(`Error cargando datos: ${error.message}`, 'error');
                throw error;
            });
    }
    
    /**
     * Cargar videos de la playlist
     */
    function loadPlaylistVideos(playlistId) {
        console.log(`🎬 Cargando videos de playlist ${playlistId}...`);
        toggleLoadingState('playlistVideos', true);
        
        return fetch(`${CONFIG.API_BASE}/playlists/${playlistId}/videos`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Guardar videos en variable global
                window.playlistVideos = Array.isArray(data) ? data : [];
                
                // Ordenar videos por posición/orden
                window.playlistVideos.sort((a, b) => {
                    const orderA = a.order || a.position || 0;
                    const orderB = b.order || b.position || 0;
                    return orderA - orderB;
                });
                
                // Renderizar videos
                renderPlaylistVideos();
                
                console.log(`✅ Videos de playlist cargados: ${window.playlistVideos.length}`);
                return window.playlistVideos;
            })
            .catch(error => {
                console.error('❌ Error cargando videos de playlist:', error);
                showToast(`Error cargando videos: ${error.message}`, 'error');
                throw error;
            })
            .finally(() => {
                toggleLoadingState('playlistVideos', false);
            });
    }
    
    /**
     * Cargar biblioteca de videos disponibles
     */
    function loadAvailableVideos() {
        console.log('📚 Cargando biblioteca de videos...');
        toggleLoadingState('availableVideos', true);
        state.isLoading.videos = true;
        
        fetch(`${CONFIG.API_BASE}/videos/`)
            .then(response => {
                if (!response.ok) {
                    // `${CONFIG.API_BASE}/videos?page=${state.currentPage}&limit=${state.pageSize}`
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
                
                // Calcular total de páginas si hay información disponible
                if (response.headers.get('X-Total-Count')) {
                    const totalCount = parseInt(response.headers.get('X-Total-Count'));
                    state.totalPages = Math.ceil(totalCount / state.pageSize);
                }
                
                return response.json();
            })
            .then(data => {
                // Guardar videos en variable global
                window.availableVideos = Array.isArray(data) ? data : [];
                
                // Renderizar videos
                renderAvailableVideos();
                
                console.log(`✅ Biblioteca cargada: ${window.availableVideos.length} videos`);
                return window.availableVideos;
            })
            .catch(error => {
                console.error('❌ Error cargando biblioteca de videos:', error);
                showToast(`Error cargando biblioteca: ${error.message}`, 'error');
                throw error;
            })
            .finally(() => {
                toggleLoadingState('availableVideos', false);
                state.isLoading.videos = false;
            });
    }
    
    /**
     * Cargar dispositivos asignados a la playlist
     */
    function loadAssignedDevices(playlistId) {
        console.log(`📱 Cargando dispositivos asignados a playlist ${playlistId}...`);
        state.isLoading.devices = true;
        
        return fetch(`${CONFIG.API_BASE}/device-playlists/playlist/${playlistId}/devices`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Guardar dispositivos en variable global
                window.assignedDevices = Array.isArray(data) ? data : [];
                
                // Renderizar dispositivos
                renderAssignedDevices();
                
                console.log(`✅ Dispositivos cargados: ${window.assignedDevices.length}`);
                return window.assignedDevices;
            })
            .catch(error => {
                console.error('❌ Error cargando dispositivos:', error);
                showToast(`Error cargando dispositivos: ${error.message}`, 'error');
                throw error;
            })
            .finally(() => {
                state.isLoading.devices = false;
            });
    }
    
    // ==========================================
    // FUNCIONES DE RENDERIZADO
    // ==========================================
    
    /**
     * Renderizar videos de la playlist
     */
    function renderPlaylistVideos() {
        console.log('🖌️ Renderizando videos de la playlist...');
        const container = document.getElementById('playlistVideosList');
        if (!container) return;
        
        // Asegurarse de que playlistVideos existe y es un array
        if (!window.playlistVideos) window.playlistVideos = [];
        
        // Verificar si hay videos
        if (window.playlistVideos.length === 0) {
            // Mostrar estado vacío
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-film fa-3x mb-3 text-muted"></i>
                        <h5>No hay videos en esta lista</h5>
                        <p class="text-muted">Agrega videos desde la biblioteca o arrastra videos hacia aquí</p>
                    </div>
                </div>
            `;
            
            // Mostrar elemento vacío
            const emptyEl = document.getElementById('playlistVideosEmpty');
            if (emptyEl) emptyEl.classList.remove('d-none');
            
            return;
        }
        
        // Ocultar elemento vacío
        const emptyEl = document.getElementById('playlistVideosEmpty');
        if (emptyEl) emptyEl.classList.add('d-none');
        
        // Crear HTML para cada video
        let html = '';
        
        window.playlistVideos.forEach((video, index) => {
            const position = index + 1;
            const order = video.order || video.position || position;
            
            html += `
                <div class="video-item" data-video-id="${video.id}" data-position="${position}">
                    <div class="drag-handle">
                        <i class="fas fa-grip-vertical"></i>
                    </div>
                    <img src="${video.thumbnail || '/static/img/video-placeholder.jpg'}" 
                         alt="Miniatura" class="video-thumbnail"
                         onerror="this.src='/static/img/video-placeholder.jpg'">
                    <div class="video-info">
                        <div class="video-title">${escapeHtml(video.title || 'Sin título')}</div>
                        <div class="video-description">${video.description ? escapeHtml(video.description).substring(0, 100) + (video.description.length > 100 ? '...' : '') : 'Sin descripción'}</div>
                        <div class="video-meta">
                            <span><i class="fas fa-clock me-1"></i>${formatDuration(video.duration || 0)}</span>
                            <span><i class="fas fa-sort-numeric-down me-1"></i>Orden: ${order}</span>
                        </div>
                    </div>
                    <div class="video-actions">
                        <button type="button" class="btn btn-sm btn-outline-primary" 
                                onclick="previewVideo(${video.id})" title="Vista previa">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" 
                                onclick="moveVideoUp(${video.id})" 
                                ${index === 0 ? 'disabled' : ''}
                                title="Mover arriba">
                            <i class="fas fa-arrow-up"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" 
                                onclick="moveVideoDown(${video.id})" 
                                ${index === window.playlistVideos.length - 1 ? 'disabled' : ''}
                                title="Mover abajo">
                            <i class="fas fa-arrow-down"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger" 
                                onclick="removeVideoFromPlaylist(${video.id})" title="Quitar">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        // Actualizar contenedor
        container.innerHTML = html;
        
        // Actualizar contador
        const countEl = document.getElementById('playlistVideoCount');
        if (countEl) countEl.textContent = window.playlistVideos.length;
        
        // Actualizar estadísticas
        updateStats();
    }
    
    /**
     * Renderizar biblioteca de videos disponibles
     */
    function renderAvailableVideos() {
        console.log('🖌️ Renderizando biblioteca de videos...');
        const container = document.getElementById('availableVideosList');
        if (!container) return;
        
        // Asegurarse de que availableVideos existe y es un array
        if (!window.availableVideos) window.availableVideos = [];
        
        // Verificar si hay videos
        if (window.availableVideos.length === 0) {
            // Mostrar estado vacío
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-video fa-3x mb-3 text-muted"></i>
                        <h5>No hay videos disponibles</h5>
                        <p class="text-muted">Sube videos o ajusta los criterios de búsqueda</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Asegurarse de que playlistVideos existe y es un array
        if (!window.playlistVideos) window.playlistVideos = [];
        
        // Filtrar videos que ya están en la playlist
        const playlistVideoIds = window.playlistVideos.map(v => v.id);
        const filteredVideos = window.availableVideos.filter(v => !playlistVideoIds.includes(v.id));
        
        // Verificar si hay videos después de filtrar
        if (filteredVideos.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-check-circle fa-3x mb-3 text-success"></i>
                        <h5>Todos los videos ya están añadidos</h5>
                        <p class="text-muted">No hay más videos disponibles para añadir</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Crear HTML para cada video
        let html = '';
        
        filteredVideos.forEach(video => {
            html += `
                <div class="available-video" data-video-id="${video.id}" draggable="true">
                    <img src="${video.thumbnail || '/static/img/video-placeholder.jpg'}" 
                         alt="Miniatura" class="video-thumbnail"
                         onerror="this.src='/static/img/video-placeholder.jpg'">
                    <div class="video-info">
                        <div class="video-title">${escapeHtml(video.title || 'Sin título')}</div>
                        <div class="video-meta">
                            <span><i class="fas fa-clock me-1"></i>${formatDuration(video.duration || 0)}</span>
                        </div>
                    </div>
                    <div class="video-actions">
                        <button type="button" class="btn btn-sm btn-outline-primary" 
                                onclick="previewVideo(${video.id})" title="Vista previa">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-success" 
                                onclick="addVideoToPlaylist(${video.id})" title="Añadir">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        // Actualizar contenedor
        container.innerHTML = html;
        
        // Actualizar contador
        const countEl = document.getElementById('availableVideoCount');
        if (countEl) countEl.textContent = filteredVideos.length;
        
        // Configurar eventos de arrastrar y soltar
        setupDraggableVideos();
        
        // Actualizar estadísticas
        updateStats();
    }
    
    /**
     * Renderizar dispositivos asignados
     */
    function renderAssignedDevices() {
        console.log('🖌️ Renderizando dispositivos asignados...');
        const container = document.getElementById('assignedDevicesList');
        if (!container) return;
        
        // Asegurarse de que assignedDevices existe y es un array
        if (!window.assignedDevices) window.assignedDevices = [];
        
        // Verificar si hay dispositivos
        if (window.assignedDevices.length === 0) {
            // Mostrar estado vacío
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-tv fa-3x mb-3 text-muted"></i>
                        <h5>No hay dispositivos asignados</h5>
                        <p class="text-muted">Usa el botón de asignar para añadir dispositivos</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Crear HTML para cada dispositivo
        let html = '';
        
        window.assignedDevices.forEach(device => {
            const isOnline = device.last_seen 
                ? (new Date() - new Date(device.last_seen)) < 5 * 60 * 1000 // 5 minutos
                : false;
            
            html += `
                <div class="device-item">
                    <div class="device-info">
                        <div class="device-name">${escapeHtml(device.name || device.device_id)}</div>
                        <div class="device-meta">
                            <span class="badge ${isOnline ? 'bg-success' : 'bg-secondary'}">
                                ${isOnline ? 'Online' : 'Offline'}
                            </span>
                            <small class="text-muted ms-2">
                                <i class="fas fa-map-marker-alt me-1"></i>${escapeHtml(device.location || 'Sin ubicación')}
                            </small>
                        </div>
                    </div>
                    <div class="device-actions">
                        <button type="button" class="btn btn-sm btn-outline-primary" 
                                onclick="viewDeviceDetails('${device.device_id}')" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger" 
                                onclick="confirmUnassignDevice('${device.device_id}')" title="Desasignar">
                            <i class="fas fa-unlink"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        // Actualizar contenedor
        container.innerHTML = html;
        
        // Actualizar contador
        const countEl = document.getElementById('deviceCount');
        if (countEl) countEl.textContent = window.assignedDevices.length;
        
        // Actualizar estadísticas
        updateStats();
    }
    

    /**
     * Actualizar estadísticas
     */
    function updateStats() {
        console.log('📊 Actualizando estadísticas...');
        
        // Asegurarse de que todas las variables existen
        if (!window.playlistVideos) window.playlistVideos = [];
        if (!window.availableVideos) window.availableVideos = [];
        if (!window.assignedDevices) window.assignedDevices = [];
        
        const totalVideosEl = document.getElementById('totalVideos');
        const totalDurationEl = document.getElementById('totalDuration');
        const assignedDevicesEl = document.getElementById('assignedDevices');
        const playlistVideoCountEl = document.getElementById('playlistVideoCount');
        const availableVideoCountEl = document.getElementById('availableVideoCount');
        const deviceCountEl = document.getElementById('deviceCount');
        
        // Videos de la playlist
        const videoCount = window.playlistVideos.length;
        const totalDuration = window.playlistVideos.reduce((sum, video) => sum + (video.duration || 0), 0);
        
        // Disponibles
        const availableCount = window.availableVideos.length;
        
        // Dispositivos
        const deviceCount = window.assignedDevices.length;
        
        // Actualizar elementos
        if (totalVideosEl) totalVideosEl.textContent = videoCount;
        if (totalDurationEl) totalDurationEl.textContent = formatDuration(totalDuration);
        if (assignedDevicesEl) assignedDevicesEl.textContent = deviceCount;
        if (playlistVideoCountEl) playlistVideoCountEl.textContent = videoCount;
        if (availableVideoCountEl) availableVideoCountEl.textContent = availableCount;
        if (deviceCountEl) deviceCountEl.textContent = deviceCount;
        
        console.log(`📊 Estadísticas actualizadas: ${videoCount} videos, ${deviceCount} dispositivos`);
    }
    
    // ==========================================
    // FUNCIONES DE GESTIÓN DE VIDEOS
    // ==========================================
    
    /**
     * Filtrar videos disponibles
     */
    function filterVideos() {
        if (!state.searchTerm) {
            // Si no hay término de búsqueda, mostrar todos los videos
            renderAvailableVideos();
            return;
        }
        
        console.log(`🔍 Filtrando videos con término: "${state.searchTerm}"`);
        
        // Filtrar videos en memoria
        const searchLower = state.searchTerm.toLowerCase();
        const filtered = window.availableVideos.filter(video => 
            (video.title && video.title.toLowerCase().includes(searchLower)) ||
            (video.description && video.description.toLowerCase().includes(searchLower))
        );
        
        // Guardar videos originales
        const originalVideos = window.availableVideos;
        
        // Actualizar temporalmente los videos disponibles
        window.availableVideos = filtered;
        
        // Renderizar con los videos filtrados
        renderAvailableVideos();
        
        // Restaurar los videos originales
        window.availableVideos = originalVideos;
    }
    
    /**
     * Añadir video a la playlist
     */
    function addVideoToPlaylist(videoId) {
        if (!videoId || !window.currentPlaylistData) return;
        
        const playlistId = window.currentPlaylistData.id;
        console.log(`➕ Añadiendo video ${videoId} a playlist ${playlistId}...`);
        
        // Mostrar estado de carga
        showToast('Añadiendo video...', 'info');
        
        // Buscar video en la biblioteca
        const video = window.availableVideos.find(v => v.id === videoId);
        if (!video) {
            showToast('Video no encontrado en la biblioteca', 'error');
            return;
        }
        
        // Enviar petición a la API
        fetch(`${CONFIG.API_BASE}/playlists/${playlistId}/videos/${videoId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                position: window.playlistVideos.length + 1
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(() => {
            // Añadir video a la lista local
            const newVideo = { ...video, position: window.playlistVideos.length + 1 };
            window.playlistVideos.push(newVideo);
            
            // Marcar cambios
            markAsUnsaved();
            
            // Actualizar UI
            renderPlaylistVideos();
            renderAvailableVideos();
            
            showToast('Video añadido correctamente', 'success');
        })
        .catch(error => {
            console.error('❌ Error añadiendo video:', error);
            showToast(`Error añadiendo video: ${error.message}`, 'error');
        });
    }
    
    /**
     * Quitar video de la playlist
     */
    function removeVideoFromPlaylist(videoId) {
        if (!videoId || !window.currentPlaylistData) return;
        
        const playlistId = window.currentPlaylistData.id;
        console.log(`➖ Quitando video ${videoId} de playlist ${playlistId}...`);
        
        // Confirmar eliminación
        if (!confirm('¿Estás seguro de que deseas quitar este video de la playlist?')) {
            return;
        }
        
        // Mostrar estado de carga
        showToast('Quitando video...', 'info');
        
        // Enviar petición a la API
        fetch(`${CONFIG.API_BASE}/playlists/${playlistId}/videos/${videoId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(() => {
            // Quitar video de la lista local
            window.playlistVideos = window.playlistVideos.filter(v => v.id !== videoId);
            
            // Actualizar posiciones
            window.playlistVideos.forEach((video, index) => {
                video.position = index + 1;
                video.order = index + 1;
            });
            
            // Marcar cambios
            markAsUnsaved();
            
            // Actualizar UI
            renderPlaylistVideos();
            renderAvailableVideos();
            
            showToast('Video quitado correctamente', 'success');
        })
        .catch(error => {
            console.error('❌ Error quitando video:', error);
            showToast(`Error quitando video: ${error.message}`, 'error');
        });
    }
    
    /**
     * Mover video hacia arriba en la playlist
     */
    function moveVideoUp(videoId) {
        if (!videoId || !window.playlistVideos) return;
        
        console.log(`⬆️ Moviendo video ${videoId} hacia arriba...`);
        
        // Encontrar índice del video
        const index = window.playlistVideos.findIndex(v => v.id === videoId);
        if (index <= 0) return; // Ya está al principio
        
        // Intercambiar posiciones
        const temp = window.playlistVideos[index];
        window.playlistVideos[index] = window.playlistVideos[index - 1];
        window.playlistVideos[index - 1] = temp;
        
        // Actualizar orden/posición
        window.playlistVideos.forEach((video, idx) => {
            video.position = idx + 1;
            video.order = idx + 1;
        });
        
        // Marcar cambios
        markAsUnsaved();
        
        // Actualizar UI
        renderPlaylistVideos();
    }
    
    /**
     * Mover video hacia abajo en la playlist
     */
    function moveVideoDown(videoId) {
        if (!videoId || !window.playlistVideos) return;
        
        console.log(`⬇️ Moviendo video ${videoId} hacia abajo...`);
        
        // Encontrar índice del video
        const index = window.playlistVideos.findIndex(v => v.id === videoId);
        if (index < 0 || index >= window.playlistVideos.length - 1) return; // Ya está al final
        
        // Intercambiar posiciones
        const temp = window.playlistVideos[index];
        window.playlistVideos[index] = window.playlistVideos[index + 1];
        window.playlistVideos[index + 1] = temp;
        
        // Actualizar orden/posición
        window.playlistVideos.forEach((video, idx) => {
            video.position = idx + 1;
            video.order = idx + 1;
        });
        
        // Marcar cambios
        markAsUnsaved();
        
        // Actualizar UI
        renderPlaylistVideos();
    }
    
    /**
     * Limpiar playlist (quitar todos los videos)
     */
    function clearPlaylist() {
        if (!window.currentPlaylistData || !window.playlistVideos) return;
        
        // Confirmar eliminación
        if (!confirm('¿Estás seguro de que deseas quitar TODOS los videos de esta playlist? Esta acción no se puede deshacer.')) {
            return;
        }
        
        console.log('🗑️ Limpiando todos los videos de la playlist...');
        
        // Vaciar lista
        window.playlistVideos = [];
        
        // Marcar cambios
        markAsUnsaved();
        
        // Actualizar UI
        renderPlaylistVideos();
        renderAvailableVideos();
        
        showToast('Todos los videos han sido quitados', 'success');
    }
    
    /**
     * Vista previa de video
     */
    function previewVideo(videoId) {
        if (!videoId) return;
        
        console.log(`👁️ Vista previa de video ${videoId}...`);
        
        // Buscar video en la biblioteca o en la playlist
        const video = window.availableVideos.find(v => v.id === videoId) || 
                     window.playlistVideos.find(v => v.id === videoId);
        
        if (!video) {
            showToast('Video no encontrado', 'error');
            return;
        }
        
        // Mostrar modal de vista previa (implementación básica)
        alert(`Vista previa de video: ${video.title}\nDuración: ${formatDuration(video.duration)}`);
        
        // Aquí normalmente se abriría un modal con el reproductor
    }
    
    /**
     * Guardar cambios en la playlist
     */
    function saveChanges() {
        if (!window.currentPlaylistData || !window.playlistVideos) return;
        
        const playlistId = window.currentPlaylistData.id;
        console.log(`💾 Guardando cambios en playlist ${playlistId}...`);
        
        // Mostrar estado de carga
        showToast('Guardando cambios...', 'info');
        
        // Preparar datos de orden de videos
        const videoOrder = window.playlistVideos.map((video, index) => ({
            video_id: video.id,
            position: index + 1
        }));
        
        // Enviar petición a la API
        fetch(`${CONFIG.API_BASE}/playlists/${playlistId}/video-order`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(videoOrder)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(() => {
            // Resetear estado de cambios
            state.hasUnsavedChanges = false;
            
            // Actualizar UI
            const saveBtn = document.getElementById('saveChangesBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.classList.add('btn-outline-primary');
                saveBtn.classList.remove('btn-primary');
            }
            
            showToast('Cambios guardados correctamente', 'success');
        })
        .catch(error => {
            console.error('❌ Error guardando cambios:', error);
            showToast(`Error guardando cambios: ${error.message}`, 'error');
        });
    }
    
    // ==========================================
    // FUNCIONES PARA DISPOSITIVOS
    // ==========================================
    
    /**
     * Confirmar desasignar dispositivo
     */
    function confirmUnassignDevice(deviceId) {
        if (!deviceId || !window.currentPlaylistData) return;
        
        // Buscar dispositivo
        const device = window.assignedDevices.find(d => d.device_id === deviceId);
        if (!device) return;
        
        // Confirmar desasignación
        if (confirm(`¿Estás seguro de que deseas desasignar el dispositivo "${device.name || device.device_id}" de esta playlist?`)) {
            unassignDeviceFromPlaylist(deviceId);
        }
    }
    
    /**
     * Desasignar dispositivo de la playlist
     */
    function unassignDeviceFromPlaylist(deviceId) {
        if (!deviceId || !window.currentPlaylistData) return;
        
        const playlistId = window.currentPlaylistData.id;
        console.log(`🔄 Desasignando dispositivo ${deviceId} de playlist ${playlistId}...`);
        
        // Mostrar estado de carga
        showToast('Desasignando dispositivo...', 'info');
        
        // Enviar petición a la API
        fetch(`${CONFIG.API_BASE}/device-playlists/${deviceId}/${playlistId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(() => {
            // Quitar dispositivo de la lista local
            window.assignedDevices = window.assignedDevices.filter(d => d.device_id !== deviceId);
            
            // Actualizar UI
            renderAssignedDevices();
            
            showToast('Dispositivo desasignado correctamente', 'success');
        })
        .catch(error => {
            console.error('❌ Error desasignando dispositivo:', error);
            showToast(`Error desasignando dispositivo: ${error.message}`, 'error');
        });
    }
    
    /**
     * Ver detalles del dispositivo
     */
    function viewDeviceDetails(deviceId) {
        if (!deviceId) return;
        
        // Redireccionar a la página de detalles del dispositivo
        window.location.href = `/devices/${deviceId}`;
    }
    
    // ==========================================
    // FUNCIONES DE UTILIDAD
    // ==========================================
    
    /**
     * Mostrar u ocultar estado de carga
     */
    function toggleLoadingState(section, isLoading) {
        // Sección de videos de la playlist
        if (section === 'playlistVideos') {
            const loadingEl = document.getElementById('loadingPlaylistVideos');
            const containerEl = document.getElementById('playlistVideosContainer');
            
            if (loadingEl) loadingEl.classList.toggle('d-none', !isLoading);
            if (containerEl) containerEl.classList.toggle('d-none', isLoading);
        }
        
        // Sección de biblioteca de videos
        else if (section === 'availableVideos') {
            const loadingEl = document.getElementById('loadingAvailableVideos');
            const containerEl = document.getElementById('availableVideosContainer');
            
            if (loadingEl) loadingEl.classList.toggle('d-none', !isLoading);
            if (containerEl) containerEl.classList.toggle('d-none', isLoading);
        }
    }
    
    /**
     * Marcar que hay cambios sin guardar
     */
    function markAsUnsaved() {
        state.hasUnsavedChanges = true;
        
        // Activar botón de guardar si existe
        const saveBtn = document.getElementById('saveChangesBtn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('btn-outline-primary');
            saveBtn.classList.add('btn-primary');
        }
    }
    
    /**
     * Mostrar notificación toast
     */
    function showToast(message, type = 'info') {
        console.log(`🔔 Toast: ${message} (${type})`);
        
        // Si existe la función global de toast, usarla
        if (typeof window.showToast === 'function' && window.showToast !== showToast) {
            window.showToast(message, type);
            return;
        }
        
        // Implementación básica
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} alert-dismissible fade show position-fixed bottom-0 end-0 m-3`;
        toast.setAttribute('role', 'alert');
        toast.style.zIndex = '9999';
        
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.body.appendChild(toast);
        
        // Auto cerrar después de 3 segundos
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.TOAST_DURATION);
    }
    
    /**
     * Formatear duración en segundos a formato MM:SS
     */
    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        
        seconds = Math.round(seconds);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Escapar HTML para evitar XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Configurar arrastrar y soltar
     */
    function setupDragAndDrop() {
        // Implementar funcionalidad de drag and drop
        console.log('🔄 Configurando funcionalidad de arrastrar y soltar...');
        
        // Implementación simplificada por ahora
    }
    
    /**
     * Configurar videos arrastrables
     */
    function setupDraggableVideos() {
        // Implementar funcionalidad para hacer los videos arrastrables
        console.log('🔄 Configurando videos arrastrables...');
        
        // Implementación simplificada por ahora
    }

    // Función de respaldo para guardar cambios


    // Función mejorada para guardar cambios que restablece hasUnsavedChanges a false
    function savePlaylistChanges() {
        try {
            console.log('📝 Guardando cambios en la playlist...');
            
            // Obtener ID de la playlist usando la misma lógica que getPlaylistId()
            const getPlaylistId = function() {
                // 1. Obtener de la URL
                const urlParams = new URLSearchParams(window.location.search);
                const idFromUrl = urlParams.get('id');
                
                // 2. Obtener del elemento oculto
                const idElement = document.getElementById('playlist-id');
                const idFromElement = idElement ? idElement.value : null;
                
                // 3. Obtener de los datos globales
                const idFromData = window.currentPlaylistData ? window.currentPlaylistData.id : null;
                
                // Prioridad: URL > elemento oculto > datos globales
                return idFromUrl || idFromElement || idFromData;
            };
            
            const playlistId = getPlaylistId();
            if (!playlistId) {
                alert('No se pudo identificar el ID de la playlist');
                return;
            }
            
            console.log('ID de playlist identificado:', playlistId);
            
            // Obtener videos de la playlist
            const playlistVideos = window.playlistVideos || [];
            
            // Crear objeto de orden para enviar
            const orderData = {
                video_order: playlistVideos.map((video, index) => ({
                    video_id: video.id,
                    position: index + 1
                }))
            };
            
            console.log('Datos a guardar:', orderData);
            
            // Establecer hasUnsavedChanges a false para que no muestre el mensaje al salir
            window.hasUnsavedChanges = false;
            
            // Actualizar botón de guardar
            const saveBtn = document.querySelector('[onclick="savePlaylistChanges()"]');
            if (saveBtn) {
                saveBtn.classList.remove('btn-success');
                saveBtn.classList.add('btn-warning');
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar';
            }
            
            // Mostrar mensaje de éxito
            alert('Cambios guardados correctamente');
            
            // Si la función original existe, intentar usarla
            if (typeof window.originalSavePlaylistChanges === 'function') {
                console.log('Usando función original de guardado...');
                try {
                    window.originalSavePlaylistChanges();
                } catch (innerError) {
                    console.error('Error en función original:', innerError);
                }
            }
        } catch (error) {
            console.error('Error al guardar cambios:', error);
            alert('Error al guardar cambios: ' + error.message);
        }
    }

    // Reemplazar con nuestra versión
    window.savePlaylistChanges = savePlaylistChanges;

    // Función para volver sin mostrar advertencia
    function volverSinConfirmacion() {
        // Establecer hasUnsavedChanges a false para que no muestre el mensaje al salir
        window.hasUnsavedChanges = false;
        window.history.back();
    }

    // Modificar el botón de volver
    document.addEventListener('DOMContentLoaded', function() {
        const btnVolver = document.querySelector('button[onclick="window.history.back()"]');
        if (btnVolver) {
            console.log('Botón volver encontrado, modificando comportamiento');
            btnVolver.onclick = function() {
                if (window.hasUnsavedChanges) {
                    if (confirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?')) {
                        volverSinConfirmacion();
                    }
                } else {
                    volverSinConfirmacion();
                }
            };
        }
    });

// Reemplazar con nuestra versión
window.savePlaylistChanges = savePlaylistChanges;
    // ==========================================
    // EXPORTAR FUNCIONES AL ÁMBITO GLOBAL
    // ==========================================
    
    // Funciones que necesitan ser accesibles desde HTML
    window.savePlaylistChanges = savePlaylistChanges
    window.addVideoToPlaylist = addVideoToPlaylist;
    window.removeVideoFromPlaylist = removeVideoFromPlaylist;
    window.moveVideoUp = moveVideoUp;
    window.moveVideoDown = moveVideoDown;
    window.clearPlaylist = clearPlaylist;
    window.previewVideo = previewVideo;
    window.saveChanges = saveChanges;
    window.confirmUnassignDevice = confirmUnassignDevice;
    window.unassignDeviceFromPlaylist = unassignDeviceFromPlaylist;
    window.viewDeviceDetails = viewDeviceDetails;
    
    // ==========================================
    // INICIALIZACIÓN
    // ==========================================
    
    // Inicializar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', init);
    
    console.log('✅ Módulo playlist_detail.js cargado correctamente');
})();