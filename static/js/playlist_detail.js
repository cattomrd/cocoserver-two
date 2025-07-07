/**
 * PLAYLIST DETAIL JS
 * Funcionalidad para la página de detalle de playlist
 * Versión optimizada y corregida
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
    
    // Estado de la aplicación
    const state = {
        currentPage: 1,
        pageSize: CONFIG.DEFAULT_PAGE_SIZE,
        totalPages: 1,
        searchTerm: '',
        isLoading: {
            playlist: false,
            videos: false,
            devices: false
        },
        hasUnsavedChanges: false
    };
    
    // Variables globales de datos (inicializadas si no existen)
    window.currentPlaylistData = window.currentPlaylistData || {};
    window.playlistVideos = window.playlistVideos || [];
    
    // ==========================================
    // FUNCIONES DE INICIALIZACIÓN
    // ==========================================
    
    /**
     * Inicializar la aplicación
     */
    function init() {
        console.log('🚀 Inicializando aplicación de playlist_detail...');
        
        // Obtener ID de playlist
        const playlistId = getPlaylistId();
        if (!playlistId) {
            showToast('No se pudo determinar el ID de la playlist', 'error');
            return;
        }
        
        console.log(`📋 ID de playlist: ${playlistId}`);
        
        // Cargar datos desde el template si están disponibles
        loadDataFromTemplate();
        
        // Mostrar pantallas de carga
        toggleLoadingState('playlistVideos', true);
        toggleLoadingState('availableVideos', true);
        
        // Cargar datos completos de la playlist si son necesarios
        if (!window.currentPlaylistData || !window.currentPlaylistData.id || window.currentPlaylistData.id != playlistId) {
            loadPlaylistData(playlistId);
        } else {
            console.log('📋 Usando datos de playlist ya cargados:', window.currentPlaylistData.title);
            renderPlaylistDetails();
            renderPlaylistVideos();
            toggleLoadingState('playlistVideos', false);
        }
        
        // Cargar videos disponibles
        loadAvailableVideos();
        
        // Inicializar manejadores de eventos
        setupEventListeners();
        
        // Actualizar estadísticas
        updatePlaylistStats();
    }
    
    /**
     * Configurar event listeners
     */
    function setupEventListeners() {
        // Formulario principal de playlist
        const playlistForm = document.getElementById('playlistForm');
        if (playlistForm) {
            playlistForm.addEventListener('submit', savePlaylist);
        }
        
        // Botón de guardar cambios
        const saveBtn = document.getElementById('savePlaylistBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', savePlaylist);
        }
        
        // Toggle de modo edición
        const editToggle = document.getElementById('toggleEditModeBtn');
        if (editToggle) {
            editToggle.addEventListener('click', toggleEditMode);
        }
        
        // Agregar video a playlist
        const addVideoBtn = document.getElementById('addVideoToPlaylistBtn');
        if (addVideoBtn) {
            addVideoBtn.addEventListener('click', addSelectedVideoToPlaylist);
        }
        
        // Ordenar videos (drag & drop)
        initDragAndDrop();
        
        // Búsqueda de videos
        const videoSearchInput = document.getElementById('videoSearchInput');
        if (videoSearchInput) {
            videoSearchInput.addEventListener('input', function() {
                const searchTerm = this.value.trim().toLowerCase();
                state.searchTerm = searchTerm;
                filterAvailableVideos(searchTerm);
            });
        }
        
        console.log('✅ Event listeners configurados');
    }
    
    // ==========================================
    // FUNCIONES PARA OBTENER DATOS
    // ==========================================
    
    /**
     * Obtener el ID de la playlist actual
     */
    function getPlaylistId() {
        // 1. Intentar desde el input hidden
        const hiddenInput = document.getElementById('playlist-id');
        if (hiddenInput && hiddenInput.value) {
            console.log('✅ [getPlaylistId] ID desde input hidden:', hiddenInput.value);
            return hiddenInput.value;
        }
        
        // 2. Intentar desde la URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id');
        if (urlId) {
            console.log('✅ [getPlaylistId] ID de URL:', urlId);
            return urlId;
        }
        
        // 3. Intentar desde currentPlaylistData
        if (window.currentPlaylistData && window.currentPlaylistData.id) {
            console.log('✅ [getPlaylistId] ID desde datos actuales:', window.currentPlaylistData.id);
            return window.currentPlaylistData.id;
        }
        
        console.error('❌ [getPlaylistId] No se pudo obtener el ID de la playlist');
        return null;
    }
    
    /**
     * Cargar datos desde el template
     */
    function loadDataFromTemplate() {
        try {
            const playlistElement = document.getElementById('playlist-data');
            if (playlistElement && playlistElement.textContent) {
                let jsonText = playlistElement.textContent.trim();
                
                // Corregir posibles errores en el JSON
                jsonText = jsonText
                    .replace(/"([^"]+)":\s*,/g, '"$1": null,')  // Reemplazar ": ," con ": null,"
                    .replace(/,\s*}/g, '}')                     // Eliminar comas antes de }
                    .replace(/,\s*]/g, ']');                    // Eliminar comas antes de ]
                
                const templateData = JSON.parse(jsonText);
                if (templateData && templateData.id) {
                    window.currentPlaylistData = templateData;
                    window.playlistVideos = templateData.videos || [];
                    
                    console.log('📋 Datos de playlist cargados desde template:', templateData.title);
                    return true;
                }
            }
        } catch (error) {
            console.warn('⚠️ Error cargando datos desde template:', error);
        }
        return false;
    }
    
    /**
     * Cargar datos completos de la playlist desde la API
     */
    async function loadPlaylistData(playlistId) {
        if (!playlistId) return;
        
        toggleLoadingState('playlist', true);
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/playlists/${playlistId}`);
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            window.currentPlaylistData = data;
            window.playlistVideos = data.videos || [];
            
            console.log('📋 Datos de playlist cargados desde API:', data.title);
            
            // Renderizar datos
            renderPlaylistDetails();
            renderPlaylistVideos();
            updatePlaylistStats();
            
        } catch (error) {
            console.error('❌ Error cargando datos de playlist:', error);
            showToast(`Error cargando playlist: ${error.message}`, 'error');
        } finally {
            toggleLoadingState('playlist', false);
            toggleLoadingState('playlistVideos', false);
        }
    }
    
    /**
     * Cargar videos disponibles para agregar a la playlist
     */
    async function loadAvailableVideos() {
        toggleLoadingState('availableVideos', true);
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/videos/?limit=1000`);
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const videos = await response.json();
            console.log(`📋 Videos disponibles cargados: ${videos.length}`);
            
            renderAvailableVideos(videos);
            
        } catch (error) {
            console.error('❌ Error cargando videos disponibles:', error);
            showToast(`Error cargando videos: ${error.message}`, 'error');
        } finally {
            toggleLoadingState('availableVideos', false);
        }
    }
    
    // ==========================================
    // FUNCIONES DE RENDERIZADO
    // ==========================================
    
    /**
     * Renderizar detalles de la playlist en el formulario
     */
    function renderPlaylistDetails() {
        const data = window.currentPlaylistData;
        if (!data || !data.id) return;
        
        // Título y descripción
        const titleInput = document.getElementById('playlist_title');
        const descriptionInput = document.getElementById('playlist_description');
        
        if (titleInput) titleInput.value = data.title || '';
        if (descriptionInput) descriptionInput.value = data.description || '';
        
        // Estado activo
        const activeCheckbox = document.getElementById('playlist_is_active');
        if (activeCheckbox) activeCheckbox.checked = !!data.is_active;
        
        // Fechas
        const startDateInput = document.getElementById('playlist_start_date');
        const expirationDateInput = document.getElementById('playlist_expiration_date');
        
        if (startDateInput && data.start_date) {
            startDateInput.value = formatDateForInput(new Date(data.start_date));
        }
        
        if (expirationDateInput && data.expiration_date) {
            expirationDateInput.value = formatDateForInput(new Date(data.expiration_date));
        }
        
        console.log('✅ Detalles de playlist renderizados');
    }
    
    /**
     * Renderizar videos de la playlist
     */
    function renderPlaylistVideos() {
        const videosContainer = document.getElementById('playlistVideosList');
        if (!videosContainer) return;
        
        const videos = window.playlistVideos || [];
        
        if (videos.length === 0) {
            videosContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    Esta lista de reproducción no tiene videos. Agrega videos desde la biblioteca.
                </div>
            `;
            return;
        }
        
        // Ordenar videos por posición
        videos.sort((a, b) => (a.position || 0) - (b.position || 0));
        
        // Generar HTML de los videos
        const videosHTML = videos.map((video, index) => `
            <div class="playlist-video-item" data-video-id="${video.id}" data-position="${video.position || index}">
                <div class="row align-items-center">
                    <div class="col-auto">
                        <div class="video-handle">
                            <i class="fas fa-grip-vertical text-muted"></i>
                        </div>
                    </div>
                    <div class="col-auto">
                        <span class="video-position">${index + 1}</span>
                    </div>
                    <div class="col">
                        <h6 class="mb-1">${video.title || 'Sin título'}</h6>
                        <small class="text-muted">${formatDuration(video.duration || 0)}</small>
                    </div>
                    <div class="col-auto">
                        <div class="btn-group">
                            <button type="button" class="btn btn-sm btn-outline-primary" 
                                    onclick="previewVideo(${video.id})" title="Vista previa">
                                <i class="fas fa-play"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger" 
                                    onclick="removeVideoFromPlaylist(${video.id})" title="Quitar de la lista">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        videosContainer.innerHTML = videosHTML;
        
        // Reinicializar drag & drop después de renderizar
        initDragAndDrop();
        
        console.log('✅ Videos de playlist renderizados');
    }
    
    /**
     * Renderizar videos disponibles para agregar
     */
    function renderAvailableVideos(videos) {
        const videosContainer = document.getElementById('availableVideosList');
        if (!videosContainer) return;
        
        if (!videos || videos.length === 0) {
            videosContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    No hay videos disponibles en la biblioteca.
                </div>
            `;
            return;
        }
        
        // Filtrar videos que ya están en la playlist
        const playlistVideoIds = (window.playlistVideos || []).map(v => v.id);
        const availableVideos = videos.filter(v => !playlistVideoIds.includes(v.id));
        
        if (availableVideos.length === 0) {
            videosContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-check-circle me-2"></i>
                    Todos los videos ya están en esta lista de reproducción.
                </div>
            `;
            return;
        }
        
        // Generar HTML de los videos disponibles
        const videosHTML = availableVideos.map(video => `
            <div class="available-video-item" data-video-id="${video.id}">
                <div class="row align-items-center">
                    <div class="col-auto">
                        <div class="form-check">
                            <input class="form-check-input video-checkbox" type="checkbox" 
                                   value="${video.id}" id="video_${video.id}">
                        </div>
                    </div>
                    <div class="col">
                        <h6 class="mb-1">${video.title || 'Sin título'}</h6>
                        <small class="text-muted">${formatDuration(video.duration || 0)}</small>
                    </div>
                    <div class="col-auto">
                        <button type="button" class="btn btn-sm btn-outline-primary" 
                                onclick="previewVideo(${video.id})" title="Vista previa">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        videosContainer.innerHTML = videosHTML;
        
        console.log('✅ Videos disponibles renderizados');
    }
    
    /**
     * Filtrar videos disponibles por término de búsqueda
     */
    function filterAvailableVideos(searchTerm) {
        const videoItems = document.querySelectorAll('.available-video-item');
        if (!videoItems.length) return;
        
        if (!searchTerm) {
            // Mostrar todos
            videoItems.forEach(item => item.style.display = '');
            return;
        }
        
        // Filtrar por título
        videoItems.forEach(item => {
            const title = item.querySelector('h6').textContent.toLowerCase();
            item.style.display = title.includes(searchTerm) ? '' : 'none';
        });
    }
    
    // ==========================================
    // FUNCIONES PARA EDITAR Y GUARDAR
    // ==========================================
    
    /**
     * Guardar cambios en la playlist
     */
    async function savePlaylist(event) {
        if (event) event.preventDefault();
        
        const playlistId = getPlaylistId();
        if (!playlistId) {
            showToast('No se pudo determinar el ID de la playlist', 'error');
            return;
        }
        
        // Obtener datos del formulario
        const title = document.getElementById('playlist_title')?.value || '';
        const description = document.getElementById('playlist_description')?.value || '';
        const isActive = document.getElementById('playlist_is_active')?.checked || false;
        const startDate = document.getElementById('playlist_start_date')?.value || null;
        const expirationDate = document.getElementById('playlist_expiration_date')?.value || null;
        
        // Validar título
        if (!title.trim()) {
            showToast('El título es obligatorio', 'error');
            return;
        }
        
        // Preparar datos para enviar
        const playlistData = {
            title: title,
            description: description,
            is_active: isActive,
            start_date: startDate,
            expiration_date: expirationDate
        };
        
        try {
            showToast('Guardando cambios...', 'info');
            
            // Enviar datos a la API
            const response = await fetch(`${CONFIG.API_BASE}/playlists/${playlistId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(playlistData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
            }
            
            const updatedData = await response.json();
            
            // Actualizar datos locales
            window.currentPlaylistData = {
                ...window.currentPlaylistData,
                ...updatedData
            };
            
            // Actualizar UI
            renderPlaylistDetails();
            updatePlaylistStats();
            
            // Resetear estado de guardado
            state.hasUnsavedChanges = false;
            updateSaveButtonState(false);
            
            showToast('Playlist actualizada correctamente', 'success');
            
        } catch (error) {
            console.error('❌ Error guardando playlist:', error);
            showToast(`Error al guardar: ${error.message}`, 'error');
        }
    }
    
    /**
     * Actualizar el orden de los videos en la playlist
     */
    async function updatePlaylistVideoOrder() {
        const playlistId = getPlaylistId();
        if (!playlistId) return;
        
        // Obtener el nuevo orden de los videos
        const videoItems = document.querySelectorAll('.playlist-video-item');
        const videoOrder = Array.from(videoItems).map((item, index) => ({
            video_id: parseInt(item.dataset.videoId),
            position: index
        }));
        
        try {
            // Enviar nuevo orden a la API usando PUT en lugar de POST
            const response = await fetch(`${CONFIG.API_BASE}/playlists/${playlistId}/reorder`, {
                method: 'PUT',  // Cambio de POST a PUT para coincidir con el endpoint
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ videos: videoOrder })
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            // Actualizar datos locales
            window.playlistVideos.forEach(video => {
                const order = videoOrder.find(v => v.video_id === video.id);
                if (order) {
                    video.position = order.position;
                }
            });
            
            showToast('Orden de videos actualizado', 'success');
            
        } catch (error) {
            console.error('❌ Error actualizando orden:', error);
            showToast(`Error: ${error.message}`, 'error');
        }
    }
    
    /**
     * Agregar video seleccionado a la playlist
     */
    async function addSelectedVideoToPlaylist() {
        const playlistId = getPlaylistId();
        if (!playlistId) return;
        
        // Obtener videos seleccionados
        const selectedCheckboxes = document.querySelectorAll('.video-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            showToast('Selecciona al menos un video para agregar', 'warning');
            return;
        }
        
        const videoIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
        
        try {
            showToast(`Agregando ${videoIds.length} video(s)...`, 'info');
            
            // Para cada video seleccionado
            for (const videoId of videoIds) {
                // Enviar solicitud a la API
                const response = await fetch(`${CONFIG.API_BASE}/playlists/${playlistId}/videos/${videoId}`, {
                    method: 'POST'
                });
                
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
            }
            
            showToast(`${videoIds.length} video(s) agregados correctamente`, 'success');
            
            // Recargar datos de la playlist
            await loadPlaylistData(playlistId);
            
            // Recargar videos disponibles
            await loadAvailableVideos();
            
        } catch (error) {
            console.error('❌ Error agregando videos:', error);
            showToast(`Error: ${error.message}`, 'error');
        }
    }
    
    /**
     * Quitar video de la playlist
     */
    async function removeVideoFromPlaylist(videoId) {
        if (!confirm('¿Estás seguro de quitar este video de la lista de reproducción?')) {
            return;
        }
        
        const playlistId = getPlaylistId();
        if (!playlistId) return;
        
        try {
            // Enviar solicitud a la API
            const response = await fetch(`${CONFIG.API_BASE}/playlists/${playlistId}/videos/${videoId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            // Actualizar datos locales
            window.playlistVideos = window.playlistVideos.filter(v => v.id !== videoId);
            
            // Actualizar UI
            renderPlaylistVideos();
            updatePlaylistStats();
            
            // Recargar videos disponibles
            await loadAvailableVideos();
            
            showToast('Video eliminado de la lista', 'success');
            
        } catch (error) {
            console.error('❌ Error eliminando video:', error);
            showToast(`Error: ${error.message}`, 'error');
        }
    }
    
    // ==========================================
    // FUNCIONES DE UTILIDAD
    // ==========================================
    
    /**
     * Formatear duración en segundos a formato mm:ss
     */
    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Formatear fecha para input type="date"
     */
    function formatDateForInput(date) {
        if (!date || !(date instanceof Date) || isNaN(date)) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }
    
    /**
     * Mostrar notificación toast
     */
    function showToast(message, type = 'info') {
        // Si hay una función global de toast, usarla
        if (window.showToast) {
            window.showToast(message, type);
            return;
        }
        
        // Implementación básica de toast
        const toastContainer = document.getElementById('toastContainer') || document.createElement('div');
        if (!document.getElementById('toastContainer')) {
            toastContainer.id = 'toastContainer';
            toastContainer.style.position = 'fixed';
            toastContainer.style.top = '20px';
            toastContainer.style.right = '20px';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast bg-${type} text-white`;
        toast.innerHTML = `
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Mostrar y ocultar después de un tiempo
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toastContainer.removeChild(toast);
            }, 500);
        }, CONFIG.TOAST_DURATION);
    }
    
    /**
     * Cambiar estado de carga
     */
    function toggleLoadingState(section, isLoading) {
        if (section === 'playlist') {
            const container = document.getElementById('playlistDetailsLoading');
            if (container) {
                container.style.display = isLoading ? 'block' : 'none';
            }
        } else if (section === 'playlistVideos') {
            const container = document.getElementById('playlistVideosLoading');
            if (container) {
                container.style.display = isLoading ? 'block' : 'none';
            }
            
            const content = document.getElementById('playlistVideosList');
            if (content) {
                content.style.display = isLoading ? 'none' : 'block';
            }
        } else if (section === 'availableVideos') {
            const container = document.getElementById('availableVideosLoading');
            if (container) {
                container.style.display = isLoading ? 'block' : 'none';
            }
            
            const content = document.getElementById('availableVideosList');
            if (content) {
                content.style.display = isLoading ? 'none' : 'block';
            }
        }
        
        // Actualizar estado
        state.isLoading[section] = isLoading;
    }
    
    /**
     * Inicializar funcionalidad de drag & drop
     */
    function initDragAndDrop() {
        const container = document.getElementById('playlistVideosList');
        if (!container) return;
        
        // Implementación básica (reemplazar con librería si se prefiere)
        const items = container.querySelectorAll('.playlist-video-item');
        
        items.forEach(item => {
            const handle = item.querySelector('.video-handle');
            if (!handle) return;
            
            handle.addEventListener('mousedown', function(e) {
                e.preventDefault();
                
                const originalIndex = Array.from(container.children).indexOf(item);
                let currentY = e.clientY;
                
                // Estilo de arrastre
                item.classList.add('dragging');
                
                // Funciones para el arrastre
                function onMouseMove(e) {
                    const delta = e.clientY - currentY;
                    currentY = e.clientY;
                    
                    // Encontrar posición de destino
                    const siblings = Array.from(container.children);
                    const currentIndex = siblings.indexOf(item);
                    let targetIndex = currentIndex;
                    
                    if (delta < 0 && currentIndex > 0) {
                        // Mover hacia arriba
                        targetIndex = currentIndex - 1;
                    } else if (delta > 0 && currentIndex < siblings.length - 1) {
                        // Mover hacia abajo
                        targetIndex = currentIndex + 1;
                    }
                    
                    // Realizar el intercambio si es necesario
                    if (targetIndex !== currentIndex) {
                        if (targetIndex < currentIndex) {
                            container.insertBefore(item, siblings[targetIndex]);
                        } else {
                            container.insertBefore(item, siblings[targetIndex].nextSibling);
                        }
                        
                        // Actualizar posiciones
                        updatePositionNumbers();
                    }
                }
                
                function onMouseUp() {
                    item.classList.remove('dragging');
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    
                    // Verificar si cambió la posición
                    const newIndex = Array.from(container.children).indexOf(item);
                    if (newIndex !== originalIndex) {
                        // Marcar cambios como no guardados
                        state.hasUnsavedChanges = true;
                        updateSaveButtonState(true);
                        
                        // Guardar nuevo orden
                        updatePlaylistVideoOrder();
                    }
                }
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
        
        // Actualizar números de posición
        updatePositionNumbers();
    }
    
    /**
     * Actualizar números de posición
     */
    function updatePositionNumbers() {
        const items = document.querySelectorAll('.playlist-video-item');
        items.forEach((item, index) => {
            const positionEl = item.querySelector('.video-position');
            if (positionEl) {
                positionEl.textContent = index + 1;
            }
        });
    }
    
    /**
     * Actualizar estadísticas de la playlist
     */
    function updatePlaylistStats() {
        const videos = window.playlistVideos || [];
        
        // Estadísticas principales
        const videoCount = videos.length;
        const totalDuration = videos.reduce((total, video) => total + (video.duration || 0), 0);
        
        // Actualizar UI
        const videoCountEl = document.getElementById('statVideoCount');
        const durationEl = document.getElementById('statTotalDuration');
        
        if (videoCountEl) {
            videoCountEl.textContent = videoCount;
        }
        
        if (durationEl) {
            // Convertir segundos a formato de tiempo
            const hours = Math.floor(totalDuration / 3600);
            const mins = Math.floor((totalDuration % 3600) / 60);
            const secs = Math.floor(totalDuration % 60);
            
            let formattedTime = '';
            if (hours > 0) {
                formattedTime = `${hours}h ${mins}m`;
            } else {
                formattedTime = `${mins}m ${secs}s`;
            }
            
            durationEl.textContent = formattedTime;
        }
    }
    
    /**
     * Cambiar entre modo edición y visualización
     */
    function toggleEditMode() {
        const isEditMode = document.body.classList.toggle('edit-mode');
        
        // Cambiar texto del botón
        const editBtn = document.getElementById('toggleEditModeBtn');
        if (editBtn) {
            editBtn.innerHTML = isEditMode ? 
                '<i class="fas fa-eye me-2"></i>Modo Visualización' : 
                '<i class="fas fa-edit me-2"></i>Modo Edición';
        }
        
        // Habilitar/deshabilitar campos
        const inputs = document.querySelectorAll('.playlist-form-control');
        inputs.forEach(input => {
            input.disabled = !isEditMode;
        });
        
        // Mostrar/ocultar botones de acción
        const actionBtns = document.querySelectorAll('.edit-action');
        actionBtns.forEach(btn => {
            btn.style.display = isEditMode ? 'inline-flex' : 'none';
        });
    }
    
    /**
     * Actualizar estado del botón de guardar
     */
    function updateSaveButtonState(hasChanges) {
        state.hasUnsavedChanges = hasChanges;
        
        const saveBtn = document.getElementById('savePlaylistBtn');
        if (saveBtn) {
            saveBtn.disabled = !hasChanges;
            
            if (hasChanges) {
                saveBtn.classList.add('btn-pulse');
            } else {
                saveBtn.classList.remove('btn-pulse');
            }
        }
    }
    
    /**
     * Marcar formulario como con cambios sin guardar
     */
    function markAsUnsaved() {
        updateSaveButtonState(true);
    }
    
    // ==========================================
    // EXPOSICIÓN DE FUNCIONES GLOBALES
    // ==========================================
    
    // Exponer funciones necesarias globalmente
    window.getPlaylistId = getPlaylistId;
    window.savePlaylist = savePlaylist;
    window.removeVideoFromPlaylist = removeVideoFromPlaylist;
    window.addSelectedVideoToPlaylist = addSelectedVideoToPlaylist;
    window.toggleEditMode = toggleEditMode;
    window.markAsUnsaved = markAsUnsaved;
    window.formatDuration = formatDuration;
    window.formatDateForInput = formatDateForInput;
    window.updatePlaylistStats = updatePlaylistStats;
    window.showToast = showToast;
    window.previewVideo = function(videoId) {
        console.log('Reproduciendo video:', videoId);
        // Implementar lógica de previsualización
    };
    
    // ==========================================
    // INICIALIZACIÓN AUTOMÁTICA
    // ==========================================
    
    // Inicializar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', init);
    
    console.log('✅ playlist_detail.js cargado correctamente');
})();