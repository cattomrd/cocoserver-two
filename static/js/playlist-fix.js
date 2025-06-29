/**
 * PLAYLISTS-FIX.JS - Corrección para la vista de listas de reproducción
 * 
 * Este script corrige:
 * 1. El problema de "Mixed Content" en la carga de playlists
 * 2. El problema de la tabla que no muestra contenido sin recargar
 * 3. El problema de redirección incorrecta al editar una playlist
 * 
 * Para usar esta solución, inserta este script justo antes del cierre de </body>
 * en el template de playlists.html
 */

// Función auto-ejecutable para evitar conflictos
(function() {
    // ====================================================
    // CONFIGURACIÓN Y FUNCIONES BÁSICAS
    // ====================================================
    
    console.log('🔧 Iniciando correcciones para la vista de playlists...');
    
    // Obtener URL base segura para la API
    const getSecureApiUrl = () => {
        return window.location.origin + '/api';
    };
    
    // API URL segura
    const API_URL = getSecureApiUrl();
    console.log('🔧 API_URL configurada como:', API_URL);
    
    // Redefinir endpoints de API seguros
    const API_ENDPOINTS = {
        playlists: `${API_URL}/playlists`,
        playlistById: (id) => `${API_URL}/playlists/${id}`,
        playlistVideos: (id) => `${API_URL}/playlists/${id}/videos`,
        createPlaylist: `${API_URL}/playlists`,
        updatePlaylist: (id) => `${API_URL}/playlists/${id}`,
        deletePlaylist: (id) => `${API_URL}/playlists/${id}`
    };
    
    // Límites conocidos de la API
    const API_LIMITS = {
        maxItems: 1000 // Límite máximo de items permitido por la API
    };
    
    // Variables de estado para playlists
    let allPlaylists = [];
    let filteredPlaylists = [];
    let currentPage = 1;
    let pageSize = 24;
    let totalPages = 1;
    let currentFilter = 'all';
    let searchTerm = '';
    
    // Exponer a window para compatibilidad
    window.allPlaylists = allPlaylists;
    
    // ====================================================
    // FUNCIÓN SEGURA PARA FETCH
    // ====================================================
    
    /**
     * Realiza una petición fetch con manejo mejorado de errores y soporte HTTPS
     */
    async function safeFetch(url, options = {}) {
        try {
            console.log(`🔄 safeFetch: ${options.method || 'GET'} ${url}`);
            
            // Asegurar que la URL usa el protocolo correcto
            let secureUrl = url;
            
            // Si es una URL absoluta con HTTP, convertir a HTTPS o relativa
            if (url.startsWith('http:') && window.location.protocol === 'https:') {
                // Si es del mismo dominio, usar URL relativa
                if (url.includes(window.location.hostname)) {
                    const urlObj = new URL(url);
                    secureUrl = urlObj.pathname + urlObj.search;
                } else {
                    // Si es de otro dominio, convertir a HTTPS
                    secureUrl = url.replace('http:', 'https:');
                }
                console.log(`🔧 URL corregida: ${url} -> ${secureUrl}`);
            }
            
            // Realizar la petición
            const response = await fetch(secureUrl, options);
            
            // Manejar errores HTTP
            if (!response.ok) {
                let errorMessage = `Error ${response.status}`;
                
                try {
                    // Intentar obtener detalles del error
                    const contentType = response.headers.get('Content-Type');
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        errorMessage = errorData.detail || errorData.message || errorMessage;
                    } else {
                        const errorText = await response.text();
                        if (errorText) errorMessage += `: ${errorText}`;
                    }
                } catch (e) {
                    console.warn('No se pudo obtener detalles del error:', e);
                }
                
                throw new Error(errorMessage);
            }
            
            return response;
        } catch (error) {
            console.error(`❌ Error en safeFetch para ${url}:`, error);
            throw error;
        }
    }
    
    // ====================================================
    // FUNCIONES PRINCIPALES PARA PLAYLISTS
    // ====================================================
    
    /**
     * Carga todas las playlists con un método seguro
     */
    async function loadPlaylists() {
        console.log('📋 Cargando playlists de forma segura...');
        
        const playlistsList = document.getElementById('playlistsList');
        if (!playlistsList) {
            console.error("Elemento playlistsList no encontrado");
            return;
        }
        
        try {
            // Mostrar indicador de carga
            playlistsList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-3">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p class="mt-2">Cargando listas de reproducción...</p>
                    </td>
                </tr>
            `;
            
            // Usar límite seguro
            const limit = API_LIMITS.maxItems || 1000;
            const response = await safeFetch(`${API_URL}/playlists/?limit=${limit}`);
            const data = await response.json();
            
            // Guardar playlists en variables globales
            allPlaylists = Array.isArray(data) ? data : (data.items || []);
            window.allPlaylists = allPlaylists;
            
            console.log(`✅ Cargadas ${allPlaylists.length} playlists`);
            
            // Filtrar y mostrar playlists
            filterAndDisplayPlaylists();
            
            return allPlaylists;
            
        } catch (error) {
            console.error('❌ Error cargando playlists:', error);
            if (playlistsList) {
                playlistsList.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-5">
                            <div class="alert alert-danger mb-0">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                <strong>Error al cargar listas</strong><br>
                                ${error.message}
                            </div>
                            <button class="btn btn-outline-primary mt-3" onclick="reloadPlaylists()">
                                <i class="fas fa-sync"></i> Reintentar
                            </button>
                        </td>
                    </tr>
                `;
            }
            return [];
        }
    }
    
    /**
     * Filtra y muestra las playlists según criterios
     */
    function filterAndDisplayPlaylists() {
        console.log('🔍 Filtrando y mostrando playlists...');
        
        const playlistsList = document.getElementById('playlistsList');
        if (!playlistsList) {
            console.error("Elemento playlistsList no encontrado");
            return;
        }
        
        if (!allPlaylists || allPlaylists.length === 0) {
            playlistsList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="alert alert-info mb-0">
                            <i class="fas fa-info-circle me-2"></i>
                            No hay listas de reproducción disponibles
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Filtrar según criterios
        filteredPlaylists = [...allPlaylists];
        
        // Filtrar por estado si hay un filtro activo
        if (currentFilter === 'active') {
            filteredPlaylists = filteredPlaylists.filter(playlist => 
                playlist.is_active && (!playlist.expiration_date || new Date(playlist.expiration_date) > new Date())
            );
        } else if (currentFilter === 'inactive') {
            filteredPlaylists = filteredPlaylists.filter(playlist => 
                !playlist.is_active || (playlist.expiration_date && new Date(playlist.expiration_date) <= new Date())
            );
        }
        
        // Filtrar por término de búsqueda
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredPlaylists = filteredPlaylists.filter(playlist => 
                (playlist.title && playlist.title.toLowerCase().includes(term)) || 
                (playlist.description && playlist.description.toLowerCase().includes(term))
            );
        }
        
        // Calcular paginación
        totalPages = Math.ceil(filteredPlaylists.length / pageSize) || 1;
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        
        // Obtener datos para la página actual
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, filteredPlaylists.length);
        const pageData = filteredPlaylists.slice(startIndex, endIndex);
        
        // Crear filas HTML
        let html = '';
        pageData.forEach(playlist => {
            const isExpired = playlist.expiration_date ? new Date(playlist.expiration_date) < new Date() : false;
            const isActive = playlist.is_active && !isExpired;
            
            html += `
                <tr class="${isActive ? '' : 'table-warning'}">
                    <td>${playlist.title || ''}</td>
                    <td>${playlist.description || '<span class="text-muted">Sin descripción</span>'}</td>
                    <td>${formatDate(playlist.created_at)}</td>
                    <td>${playlist.expiration_date ? formatDate(playlist.expiration_date) : '<span class="text-muted">Sin expiración</span>'}</td>
                    <td>
                        <span class="badge ${isActive ? 'bg-success' : 'bg-danger'}">
                            ${isActive ? 'Activa' : 'Inactiva'}
                        </span>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-info" onclick="viewPlaylist(${playlist.id})">
                                <i class="fas fa-eye"></i> Ver
                            </button>
                            <button class="btn btn-outline-primary" onclick="editPlaylist(${playlist.id})">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button class="btn btn-outline-danger" onclick="deletePlaylist(${playlist.id}, '${playlist.title}')">
                                <i class="fas fa-trash"></i> Eliminar
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        // Mostrar filas en la tabla
        playlistsList.innerHTML = html;
        
        // Actualizar información de paginación
        updatePaginationInfo();
    }
    
    /**
     * Actualiza la información de paginación
     */
    function updatePaginationInfo() {
        // Actualizar contador de playlists
        const playlistCountBadge = document.getElementById('playlistCountBadge');
        if (playlistCountBadge) {
            playlistCountBadge.textContent = `${filteredPlaylists.length} lista${filteredPlaylists.length !== 1 ? 's' : ''}`;
        }
        
        // Actualizar información de paginación
        const paginationInfo = document.getElementById('playlistPaginationInfo');
        if (paginationInfo) {
            const startIndex = filteredPlaylists.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
            const endIndex = Math.min(startIndex + pageSize - 1, filteredPlaylists.length);
            paginationInfo.textContent = `Mostrando ${startIndex} - ${endIndex} de ${filteredPlaylists.length} resultados`;
        }
        
        // Actualizar botones de paginación
        updatePaginationButtons();
    }
    
    /**
     * Actualiza los estados de los botones de paginación
     */
    function updatePaginationButtons() {
        const firstBtn = document.getElementById('firstPlaylistPageBtn');
        const prevBtn = document.getElementById('prevPlaylistPageBtn');
        const nextBtn = document.getElementById('nextPlaylistPageBtn');
        const lastBtn = document.getElementById('lastPlaylistPageBtn');
        const pageInput = document.getElementById('playlistPageInput');
        
        const isFirstPage = currentPage <= 1;
        const isLastPage = currentPage >= totalPages;
        
        // Deshabilitar/habilitar botones según corresponda
        if (firstBtn) firstBtn.disabled = isFirstPage;
        if (prevBtn) prevBtn.disabled = isFirstPage;
        if (nextBtn) nextBtn.disabled = isLastPage;
        if (lastBtn) lastBtn.disabled = isLastPage;
        
        // Actualizar input de página
        if (pageInput) {
            pageInput.value = currentPage;
            pageInput.max = totalPages;
        }
    }
    
    // ====================================================
    // FUNCIONES DE NAVEGACIÓN Y FILTRADO
    // ====================================================
    
    /**
     * Aplica un filtro a las playlists
     */
    function filterPlaylists(filter) {
        currentFilter = filter || 'all';
        currentPage = 1;
        filterAndDisplayPlaylists();
    }
    
    /**
     * Aplica un término de búsqueda a las playlists
     */
    function searchPlaylists(term) {
        searchTerm = term || '';
        currentPage = 1;
        filterAndDisplayPlaylists();
    }
    
    /**
     * Navega a la primera página
     */
    function goToFirstPage() {
        if (currentPage > 1) {
            currentPage = 1;
            filterAndDisplayPlaylists();
        }
    }
    
    /**
     * Navega a la página anterior
     */
    function goToPrevPage() {
        if (currentPage > 1) {
            currentPage--;
            filterAndDisplayPlaylists();
        }
    }
    
    /**
     * Navega a la página siguiente
     */
    function goToNextPage() {
        if (currentPage < totalPages) {
            currentPage++;
            filterAndDisplayPlaylists();
        }
    }
    
    /**
     * Navega a la última página
     */
    function goToLastPage() {
        if (currentPage < totalPages) {
            currentPage = totalPages;
            filterAndDisplayPlaylists();
        }
    }
    
    /**
     * Navega a una página específica
     */
    function goToPage(page) {
        page = parseInt(page);
        if (!isNaN(page) && page >= 1 && page <= totalPages) {
            currentPage = page;
            filterAndDisplayPlaylists();
        }
    }
    
    // ====================================================
    // FUNCIONES DE ACCIÓN PARA PLAYLISTS
    // ====================================================
    
    /**
     * Abre la vista de detalle de una playlist
     */
    function viewPlaylist(id) {
        // Redireccionar a la página de detalle
        window.location.href = `/ui/playlist_detail?id=${id}`;
    }
    
    /**
     * Abre la vista de edición de una playlist
     */
    function editPlaylist(id) {
        // Redireccionar a la página de edición
        window.location.href = `/ui/playlist_detail?id=${id}`;
    }
    
    /**
     * Muestra el modal de confirmación para eliminar una playlist
     */
    function deletePlaylist(id, title) {
        // Configurar modal de confirmación
        const deletePlaylistName = document.getElementById('deletePlaylistName');
        if (deletePlaylistName) {
            deletePlaylistName.textContent = title || `Playlist #${id}`;
        }
        
        // Configurar botón de confirmación
        const confirmDeleteBtn = document.getElementById('confirmDeletePlaylistBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.onclick = function() {
                confirmDeletePlaylist(id);
            };
        }
        
        // Mostrar modal
        const deleteModal = new bootstrap.Modal(document.getElementById('deletePlaylistModal'));
        deleteModal.show();
    }
    
    /**
     * Ejecuta la eliminación de una playlist
     */
    async function confirmDeletePlaylist(id) {
        try {
            console.log('🗑️ Eliminando playlist:', id);
            
            // Realizar petición DELETE
            const response = await safeFetch(`${API_URL}/playlists/${id}`, {
                method: 'DELETE'
            });
            
            // Cerrar modal
            const deleteModal = bootstrap.Modal.getInstance(document.getElementById('deletePlaylistModal'));
            if (deleteModal) {
                deleteModal.hide();
            }
            
            // Mostrar mensaje de éxito
            showToast('Lista de reproducción eliminada correctamente', 'success');
            
            // Recargar playlists
            setTimeout(() => {
                loadPlaylists();
            }, 500);
            
        } catch (error) {
            console.error('Error al eliminar playlist:', error);
            showToast(`Error: ${error.message}`, 'error');
        }
    }
    
    // ====================================================
    // FUNCIONES AUXILIARES
    // ====================================================
    
    /**
     * Formatea una fecha para mostrar
     */
    function formatDate(dateString) {
        if (!dateString) return 'Sin fecha';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'Fecha inválida';
            }
            return date.toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            console.error("Error al formatear fecha:", e);
            return dateString;
        }
    }
    
    /**
     * Muestra un mensaje toast
     */
    function showToast(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Verificar si Bootstrap está disponible
        if (typeof bootstrap !== 'undefined') {
            // Crear contenedor de toasts si no existe
            let toastContainer = document.getElementById('toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container';
                toastContainer.className = 'position-fixed top-0 end-0 p-3';
                toastContainer.style.zIndex = '1090';
                document.body.appendChild(toastContainer);
            }
            
            // Crear elemento toast
            const toastId = 'toast-' + Date.now();
            const toastEl = document.createElement('div');
            toastEl.id = toastId;
            toastEl.className = `toast ${
                type === 'error' ? 'bg-danger text-white' : 
                type === 'success' ? 'bg-success text-white' : 
                type === 'warning' ? 'bg-warning' : 'bg-info text-white'
            }`;
            toastEl.setAttribute('role', 'alert');
            toastEl.setAttribute('aria-live', 'assertive');
            toastEl.setAttribute('aria-atomic', 'true');
            
            const icon = type === 'error' ? 'exclamation-triangle' : 
                        type === 'success' ? 'check-circle' : 
                        type === 'warning' ? 'exclamation-circle' : 'info-circle';
            
            toastEl.innerHTML = `
                <div class="toast-header">
                    <i class="fas fa-${icon} me-2"></i>
                    <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                    <small>Ahora</small>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            `;
            
            toastContainer.appendChild(toastEl);
            
            // Mostrar toast
            const toast = new bootstrap.Toast(toastEl, {
                animation: true,
                autohide: true,
                delay: 5000
            });
            
            toast.show();
            
            // Eliminar después de cerrar
            toastEl.addEventListener('hidden.bs.toast', () => {
                toastEl.remove();
            });
        } else {
            // Fallback si no hay Bootstrap
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }
    
    // ====================================================
    // INICIALIZACIÓN Y EXPORTACIÓN
    // ====================================================
    
    /**
     * Inicializa los eventos y carga las playlists
     */
    function initialize() {
        console.log('🚀 Inicializando vista de playlists...');
        
        // Configurar eventos de filtros
        const filterStatus = document.getElementById('playlistFilterStatus');
        if (filterStatus) {
            filterStatus.addEventListener('change', function() {
                filterPlaylists(this.value);
            });
        }
        
        // Configurar eventos de búsqueda
        const searchInput = document.getElementById('playlistSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                if (this.value.length >= 3 || this.value.length === 0) {
                    searchPlaylists(this.value);
                }
            });
        }
        
        // Configurar eventos de paginación
        const pageInput = document.getElementById('playlistPageInput');
        if (pageInput) {
            pageInput.addEventListener('change', function() {
                goToPage(this.value);
            });
        }
        
        // Configurar botón de limpieza de búsqueda
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', function() {
                if (searchInput) {
                    searchInput.value = '';
                    searchPlaylists('');
                }
            });
        }
        
        // Configurar formulario de creación
        const createPlaylistForm = document.getElementById('createPlaylistForm');
        if (createPlaylistForm) {
            createPlaylistForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                try {
                    const formData = new FormData(this);
                    const playlistData = {
                        title: formData.get('title'),
                        description: formData.get('description'),
                        expiration_date: formData.get('expiration_date') || null,
                        is_active: formData.has('is_active')
                    };
                    
                    // Validar título
                    if (!playlistData.title || !playlistData.title.trim()) {
                        throw new Error('El título es obligatorio');
                    }
                    
                    // Enviar datos a la API
                    const response = await safeFetch(API_ENDPOINTS.createPlaylist, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(playlistData)
                    });
                    
                    const result = await response.json();
                    
                    // Cerrar modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('createPlaylistModal'));
                    if (modal) {
                        modal.hide();
                    }
                    
                    // Resetear formulario
                    this.reset();
                    
                    // Mostrar mensaje de éxito
                    showToast('Lista de reproducción creada correctamente', 'success');
                    
                    // Recargar playlists
                    setTimeout(() => {
                        loadPlaylists();
                    }, 500);
                    
                } catch (error) {
                    console.error('Error al crear playlist:', error);
                    showToast(`Error: ${error.message}`, 'error');
                }
            });
        }
        
        // Cargar playlists
        loadPlaylists();
        
        console.log('✅ Vista de playlists inicializada correctamente');
    }
    
    // Exportar funciones a window para acceso global
    window.viewPlaylist = viewPlaylist;
    window.editPlaylist = editPlaylist;
    window.deletePlaylist = deletePlaylist;
    window.loadPlaylists = loadPlaylists;
    window.goToFirstPlaylistPage = goToFirstPage;
    window.goToPrevPlaylistPage = goToPrevPage;
    window.goToNextPlaylistPage = goToNextPage;
    window.goToLastPlaylistPage = goToLastPage;
    window.goToPlaylistPage = goToPage;
    window.reloadPlaylists = loadPlaylists;
    
    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // Si el DOM ya está cargado, inicializar inmediatamente
        initialize();
    }
    
    console.log('🔧 Correcciones para la vista de playlists aplicadas correctamente');
})();