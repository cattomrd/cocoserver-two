/**
 * PLAYLIST DETAIL JS
 * Funcionalidad para la página de detalle de playlist
 * Versión optimizada y corregida - FINAL
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
        hasUnsavedChanges: false,
        isEditMode: false
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
        
        console.log('✅ Inicialización completada');
    }
    
    /**
     * Configurar event listeners principales de la página
     */
    function setupEventListeners() {
        console.log('🔧 Configurando event listeners...');
        
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
        
        // ✅ CRÍTICO: Event listeners para detectar cambios en el formulario
        const formFields = [
            'playlist_title',
            'playlist_description', 
            'playlist_is_active',
            'playlist_start_datetime',
            'playlist_expiration_datetime'
        ];
        
        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Agregar listeners para diferentes tipos de eventos
                field.addEventListener('input', markAsUnsaved);
                field.addEventListener('change', markAsUnsaved);
                field.addEventListener('keyup', markAsUnsaved);
                console.log('✅ Event listener agregado a:', fieldId);
            } else {
                console.warn('⚠️ Campo no encontrado:', fieldId);
            }
        });
        
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
        
        // Configurar modal de video
        setupVideoModalListeners();
        
        console.log('✅ Event listeners configurados');
    }
    
    /**
     * Configurar event listeners para el modal de video
     */
    function setupVideoModalListeners() {
        const videoModal = document.getElementById('videoPreviewModal');
        const videoPlayer = document.getElementById('previewVideoPlayer');
        
        if (videoModal && videoPlayer) {
            // Limpiar video cuando se cierre el modal
            videoModal.addEventListener('hidden.bs.modal', function() {
                console.log('🎬 Cerrando modal de video - limpiando recursos');
                videoPlayer.pause();
                videoPlayer.src = '';
                const source = videoPlayer.querySelector('source');
                if (source) {
                    source.src = '';
                }
                videoPlayer.load(); // Limpiar completamente
            });
            
            // Opcional: Pausar video cuando se oculte el modal
            videoModal.addEventListener('hide.bs.modal', function() {
                if (!videoPlayer.paused) {
                    videoPlayer.pause();
                }
            });
            
            console.log('✅ Event listeners del modal de video configurados');
        }
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
        
        // Fechas - USAR LOS IDs CORRECTOS DEL TEMPLATE
        const startDateInput = document.getElementById('playlist_start_datetime');
        const expirationDateInput = document.getElementById('playlist_expiration_datetime');
        
        // 🔍 DEBUGGING: Mostrar datos que llegan del servidor
        console.log('📅 Datos del servidor:');
        console.log('  Start Date (raw):', data.start_date);
        console.log('  Expiration Date (raw):', data.expiration_date);
        
        if (startDateInput && data.start_date) {
            const formattedStart = formatDateForInput(data.start_date);
            console.log('  Start Date (formatted):', formattedStart);
            startDateInput.value = formattedStart;
        }
        
        if (expirationDateInput && data.expiration_date) {
            const formattedExpiration = formatDateForInput(data.expiration_date);
            console.log('  Expiration Date (formatted):', formattedExpiration);
            expirationDateInput.value = formattedExpiration;
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
                            <button type="button" class="btn btn-sm btn-outline-danger edit-action" 
                                    style="display: none;"
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
        
        // Obtener datos del formulario - USAR LOS IDs CORRECTOS
        const title = document.getElementById('playlist_title')?.value || '';
        const description = document.getElementById('playlist_description')?.value || '';
        const isActive = document.getElementById('playlist_is_active')?.checked || false;
        const startDate = document.getElementById('playlist_start_datetime')?.value || null;
        const expirationDate = document.getElementById('playlist_expiration_datetime')?.value || null;
        
        // 🔍 DEBUGGING: Mostrar valores originales
        console.log('📅 Valores del formulario:');
        console.log('  Start Date (input):', startDate);
        console.log('  Expiration Date (input):', expirationDate);
        
        // Validar título
        if (!title.trim()) {
            showToast('El título es obligatorio', 'error');
            return;
        }
        
        // Preparar datos para enviar - USAR CONVERSIÓN CORRECTA DE FECHAS
        const startDateFormatted = formatDateForServer(startDate);
        const expirationDateFormatted = formatDateForServer(expirationDate);
        
        // 🔍 DEBUGGING: Mostrar valores convertidos
        console.log('📅 Valores para enviar al servidor:');
        console.log('  Start Date (converted):', startDateFormatted);
        console.log('  Expiration Date (converted):', expirationDateFormatted);
        
        const playlistData = {
            title: title,
            description: description,
            is_active: isActive,
            start_date: startDateFormatted,
            expiration_date: expirationDateFormatted
        };
        
        // 🔍 DEBUGGING: Mostrar objeto completo
        console.log('📤 Enviando al servidor:', playlistData);
        
        try {
            showToast('Guardando cambios...', 'info');
            
            // Deshabilitar botón mientras se guarda
            const saveBtn = document.getElementById('savePlaylistBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Guardando...';
            }
            
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
        } finally {
            // Restaurar botón
            const saveBtn = document.getElementById('savePlaylistBtn');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Guardar';
                updateSaveButtonState(state.hasUnsavedChanges);
            }
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
            // Enviar nuevo orden a la API
            const response = await fetch(`${CONFIG.API_BASE}/playlists/${playlistId}/reorder`, {
                method: 'PUT',
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
    // FUNCIONES DE UTILIDAD - CORREGIDAS
    // ==========================================
    
    /**
     * Formatear duración en segundos a formato legible
     */
    function formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0m';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return `${secs}s`;
        }
    }
    
    /**
     * Formatear fecha para input type="datetime-local" (sin conversión de zona horaria)
     */
    function formatDateForInput(dateString) {
        if (!dateString) return '';
        
        try {
            console.log('🔍 formatDateForInput - Input:', dateString);
            
            // Si la fecha ya viene en formato YYYY-MM-DDTHH:MM, usarla directamente
            if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)) {
                const result = dateString.slice(0, 16); // Tomar solo YYYY-MM-DDTHH:MM
                console.log('🔍 formatDateForInput - Output (direct):', result);
                return result;
            }
            
            // Si viene en formato ISO, crear Date pero mantener hora local
            const dateObj = new Date(dateString);
            
            // Verificar que es una fecha válida
            if (isNaN(dateObj.getTime())) return '';
            
            // Obtener componentes en hora local (no UTC)
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            
            // Formato YYYY-MM-DDTHH:MM (requerido por datetime-local)
            const result = `${year}-${month}-${day}T${hours}:${minutes}`;
            console.log('🔍 formatDateForInput - Output (converted):', result);
            return result;
            
        } catch (error) {
            console.warn('Error formateando fecha:', error);
            return '';
        }
    }
    
    /**
     * Formatear fecha para envío al servidor (sin conversión de zona horaria)
     */
    function formatDateForServer(dateTimeLocalValue) {
        if (!dateTimeLocalValue) return null;
        
        try {
            console.log('🔍 formatDateForServer - Input:', dateTimeLocalValue);
            
            // datetime-local viene en formato YYYY-MM-DDTHH:MM
            // Lo enviamos tal como está para que el servidor lo interprete como hora local
            // Agregar segundos si no los tiene
            let result;
            if (dateTimeLocalValue.length === 16) {
                result = dateTimeLocalValue + ':00';  // Agregar :00 para segundos
            } else {
                result = dateTimeLocalValue;
            }
            
            console.log('🔍 formatDateForServer - Output:', result);
            return result;
            
        } catch (error) {
            console.warn('Error convirtiendo fecha para servidor:', error);
            return null;
        }
    }
    
    /**
     * Mostrar notificación toast
     */
    function showToast(message, type = 'info') {
        console.log(`🍞 Toast [${type}]: ${message}`);
        
        // Si hay una función global de toast, usarla
        if (window.showToast && typeof window.showToast === 'function') {
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
        toast.className = `toast show bg-${type} text-white`;
        toast.style.minWidth = '300px';
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
                if (toast.parentNode) {
                    toastContainer.removeChild(toast);
                }
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
        const videoCountBadge = document.getElementById('videoCountBadge');
        
        if (videoCountEl) {
            videoCountEl.textContent = videoCount;
        }
        
        if (videoCountBadge) {
            videoCountBadge.textContent = videoCount;
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
        state.isEditMode = !state.isEditMode;
        const isEditMode = state.isEditMode;
        
        console.log(`🔄 Alternando modo edición: ${isEditMode ? 'ON' : 'OFF'}`);
        
        // Cambiar clase del body
        document.body.classList.toggle('edit-mode', isEditMode);
        
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
        
        // Actualizar estado del botón guardar
        updateSaveButtonState(state.hasUnsavedChanges && isEditMode);
        
        console.log(`✅ Modo edición ${isEditMode ? 'activado' : 'desactivado'}`);
    }
    
    /**
     * Actualizar estado del botón de guardar
     */
    function updateSaveButtonState(hasChanges) {
        state.hasUnsavedChanges = hasChanges;
        
        const saveBtn = document.getElementById('savePlaylistBtn');
        const unsavedIndicator = document.getElementById('unsavedIndicator');
        const detailsPanel = document.getElementById('playlistDetailsPanel');
        
        if (saveBtn) {
            // El botón se habilita si estamos en modo edición Y hay cambios
            const shouldEnable = state.isEditMode && hasChanges;
            saveBtn.disabled = !shouldEnable;
            
            if (shouldEnable) {
                saveBtn.classList.add('btn-pulse');
                console.log('✅ Botón guardar ACTIVADO');
            } else {
                saveBtn.classList.remove('btn-pulse');
                console.log('✅ Botón guardar DESACTIVADO');
            }
        } else {
            console.error('❌ Botón guardar no encontrado');
        }
        
        // Mostrar/ocultar indicador de cambios sin guardar
        if (unsavedIndicator) {
            unsavedIndicator.style.display = hasChanges ? 'inline' : 'none';
        }
        
        // Agregar clase visual al panel
        if (detailsPanel) {
            if (hasChanges) {
                detailsPanel.classList.add('unsaved-changes');
            } else {
                detailsPanel.classList.remove('unsaved-changes');
            }
        }
    }
    
    /**
     * Marcar formulario como con cambios sin guardar
     */
    function markAsUnsaved() {
        console.log('📝 Detectado cambio en formulario - activando botón guardar');
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
    window.formatDateForServer = formatDateForServer;
    window.updatePlaylistStats = updatePlaylistStats;
    window.showToast = showToast;
    /**
     * Construir URL del video para reproducción
     */
    function buildVideoUrl(videoData) {
        if (!videoData) return null;
        
        // Opción 1: Si ya es una URL completa
        if (videoData.file_path && videoData.file_path.startsWith('http')) {
            return videoData.file_path;
        }
        
        // Opción 2: Endpoint de streaming de la API
        if (videoData.id) {
            return `${CONFIG.API_BASE}/videos/${videoData.id}/stream`;
        }
        
        // Opción 3: Ruta directa al archivo (si está en carpeta pública)
        if (videoData.file_path) {
            // Limpiar la ruta y construir URL
            const cleanPath = videoData.file_path.replace(/^.*[\\\/]/, ''); // Solo nombre del archivo
            return `${window.location.origin}/uploads/${cleanPath}`;
        }
        
        return null;
    }
    
    /**
     * Mostrar vista previa de un video
     */
    async function previewVideo(videoId) {
        console.log('🎬 Reproduciendo video:', videoId);
        
        try {
            // Mostrar loading en el modal
            const modal = document.getElementById('videoPreviewModal');
            const modalTitle = document.getElementById('previewVideoTitle');
            const modalDescription = document.getElementById('previewVideoDescription');
            const videoPlayer = document.getElementById('previewVideoPlayer');
            
            if (!modal || !videoPlayer) {
                showToast('Error: Modal de previsualización no encontrado', 'error');
                return;
            }
            
            // Limpiar contenido anterior
            modalTitle.textContent = 'Cargando...';
            modalDescription.textContent = '';
            videoPlayer.src = '';
            
            // Mostrar el modal
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
            
            // Buscar datos del video en los datos locales primero
            let videoData = null;
            
            // Buscar en videos de la playlist
            if (window.playlistVideos) {
                videoData = window.playlistVideos.find(v => v.id == videoId);
                console.log('📹 Video encontrado en playlist:', videoData);
            }
            
            // Si no está en la playlist, buscar en la API
            if (!videoData) {
                console.log('📹 Video no encontrado en playlist, consultando API...');
                showToast('Obteniendo información del video...', 'info');
                
                const response = await fetch(`${CONFIG.API_BASE}/videos/${videoId}`);
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
                
                videoData = await response.json();
                console.log('📹 Video obtenido de API:', videoData);
            }
            
            if (!videoData) {
                throw new Error('No se pudo obtener la información del video');
            }
            
            // Actualizar información del modal
            modalTitle.textContent = videoData.title || 'Video sin título';
            modalDescription.textContent = videoData.description || 'Sin descripción';
            
            // Construir URL del video
            const videoUrl = buildVideoUrl(videoData);
            
            if (!videoUrl) {
                throw new Error('No se pudo construir la URL del video');
            }
            
            console.log('📹 Intentando cargar video desde:', videoUrl);
            
            // Configurar el source del video
            const videoSource = videoPlayer.querySelector('source');
            if (videoSource) {
                videoSource.src = videoUrl;
                videoSource.type = 'video/mp4'; // Asegurar tipo MIME
            } else {
                videoPlayer.src = videoUrl;
            }
            
            // Agregar event listeners para debugging
            const handleLoadStart = () => {
                console.log('📹 Iniciando carga del video...');
                modalTitle.textContent = (videoData.title || 'Video sin título') + ' (Cargando...)';
            };
            
            const handleLoadedData = () => {
                console.log('📹 Video cargado correctamente');
                modalTitle.textContent = videoData.title || 'Video sin título';
                showToast('Video cargado correctamente', 'success');
            };
            
            const handleError = (e) => {
                console.error('❌ Error cargando video:', e);
                console.error('❌ URL que falló:', videoUrl);
                
                // Intentar URL alternativa
                const alternativeUrl = `${window.location.origin}/static/videos/${videoData.id}.mp4`;
                console.log('📹 Intentando URL alternativa:', alternativeUrl);
                
                if (videoSource) {
                    videoSource.src = alternativeUrl;
                } else {
                    videoPlayer.src = alternativeUrl;
                }
                
                videoPlayer.load();
                modalTitle.textContent = (videoData.title || 'Video sin título') + ' (Reintentando...)';
            };
            
            // Limpiar listeners anteriores
            videoPlayer.removeEventListener('loadstart', handleLoadStart);
            videoPlayer.removeEventListener('loadeddata', handleLoadedData);
            videoPlayer.removeEventListener('error', handleError);
            
            // Agregar nuevos listeners
            videoPlayer.addEventListener('loadstart', handleLoadStart);
            videoPlayer.addEventListener('loadeddata', handleLoadedData);
            videoPlayer.addEventListener('error', handleError);
            
            // Recargar el video para aplicar el nuevo source
            videoPlayer.load();
            
        } catch (error) {
            console.error('❌ Error en vista previa:', error);
            showToast(`Error: ${error.message}`, 'error');
            
            // Actualizar modal con error
            const modalTitle = document.getElementById('previewVideoTitle');
            const modalDescription = document.getElementById('previewVideoDescription');
            
            if (modalTitle) modalTitle.textContent = 'Error al cargar video';
            if (modalDescription) modalDescription.textContent = error.message;
        }
    }
    
    // ==========================================
    // INICIALIZACIÓN AUTOMÁTICA
    // ==========================================
    
    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM ya está listo
        init();
    }
    
    console.log('✅ playlist_detail.js cargado correctamente');
})();