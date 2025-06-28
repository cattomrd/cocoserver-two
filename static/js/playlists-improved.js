/**
 * PLAYLISTS-IMPROVED.JS - Gestión mejorada de listas de reproducción
 * Versión mejorada para vista de listas existentes
 */

console.log('🎵 Iniciando sistema de gestión de playlists mejorado...');

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let playlists = [];
let filteredPlaylists = [];
let currentPage = 1;
let pageSize = 24;
let totalPages = 1;
let currentView = 'table'; // 'table' o 'grid'
let isLoading = false;

// Configuración de API
const API_ENDPOINTS = {
    playlists: '/api/playlists',
    playlistById: (id) => `/api/playlists/${id}`,
    createPlaylist: '/api/playlists',
    updatePlaylist: (id) => `/api/playlists/${id}`,
    deletePlaylist: (id) => `/api/playlists/${id}`
};

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 Inicializando gestión de playlists...');
    
    // Configurar event listeners
    setupEventListeners();
    
    // Cargar playlists iniciales
    loadPlaylists();
    
    console.log('✅ Sistema de playlists inicializado');
});

// ==========================================
// CONFIGURACIÓN DE EVENT LISTENERS
// ==========================================
function setupEventListeners() {
    // Búsqueda
    const searchInput = document.getElementById('playlistSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    const clearSearchBtn = document.getElementById('clearPlaylistSearch');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
    }
    
    // Filtros
    const statusFilter = document.getElementById('playlistFilterStatus');
    if (statusFilter) {
        statusFilter.addEventListener('change', handleFilterChange);
    }
    
    const sortSelect = document.getElementById('playlistSortBy');
    if (sortSelect) {
        sortSelect.addEventListener('change', handleSortChange);
    }
    
    const pageSizeSelect = document.getElementById('playlistPageSize');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', handlePageSizeChange);
    }
    
    // Paginación
    setupPaginationListeners();
    
    // Formularios
    setupFormListeners();
}

function setupPaginationListeners() {
    const firstPageBtn = document.getElementById('firstPageBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const lastPageBtn = document.getElementById('lastPageBtn');
    const pageInput = document.getElementById('pageInput');
    
    if (firstPageBtn) firstPageBtn.addEventListener('click', () => goToPage(1));
    if (prevPageBtn) prevPageBtn.addEventListener('click', goToPreviousPage);
    if (nextPageBtn) nextPageBtn.addEventListener('click', goToNextPage);
    if (lastPageBtn) lastPageBtn.addEventListener('click', () => goToPage(totalPages));
    
    if (pageInput) {
        pageInput.addEventListener('change', function() {
            const page = parseInt(this.value);
            if (page >= 1 && page <= totalPages) {
                goToPage(page);
            } else {
                this.value = currentPage;
            }
        });
    }
}

function setupFormListeners() {
    // Formulario de crear playlist
    const createForm = document.getElementById('createPlaylistForm');
    if (createForm) {
        createForm.addEventListener('submit', handleCreatePlaylist);
    }
    
    // Formulario de editar playlist
    const editForm = document.getElementById('editPlaylistForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditPlaylist);
    }
    
    // Confirmación de eliminación
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', handleDeletePlaylist);
    }
}

// ==========================================
// CARGA DE DATOS
// ==========================================
async function loadPlaylists() {
    if (isLoading) return;
    
    console.log('📥 Cargando playlists...');
    setLoadingState(true);
    
    try {
        showToast('Cargando listas de reproducción...', 'info');
        
        const response = await fetch(API_ENDPOINTS.playlists, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        playlists = Array.isArray(data) ? data : (data.playlists || []);
        
        console.log(`✅ Cargadas ${playlists.length} playlists`);
        
        // Aplicar filtros y mostrar
        applyFiltersAndSort();
        
        showToast(`${playlists.length} listas cargadas correctamente`, 'success');
        
    } catch (error) {
        console.error('❌ Error cargando playlists:', error);
        showError('No se pudieron cargar las listas de reproducción');
    } finally {
        setLoadingState(false);
    }
}

// ==========================================
// FILTROS Y BÚSQUEDA
// ==========================================
function handleSearch() {
    console.log('🔍 Aplicando búsqueda...');
    applyFiltersAndSort();
}

function clearSearch() {
    const searchInput = document.getElementById('playlistSearchInput');
    if (searchInput) {
        searchInput.value = '';
        handleSearch();
    }
}

function handleFilterChange() {
    console.log('🎛️ Cambiando filtros...');
    applyFiltersAndSort();
}

function handleSortChange() {
    console.log('🔀 Cambiando ordenación...');
    applyFiltersAndSort();
}

function handlePageSizeChange() {
    const pageSizeSelect = document.getElementById('playlistPageSize');
    if (pageSizeSelect) {
        pageSize = pageSizeSelect.value === 'all' ? 9999 : parseInt(pageSizeSelect.value);
        currentPage = 1;
        applyFiltersAndSort();
    }
}

function applyFiltersAndSort() {
    console.log('🎯 Aplicando filtros y ordenación...');
    
    let filtered = [...playlists];
    
    // Aplicar búsqueda
    const searchTerm = document.getElementById('playlistSearchInput')?.value?.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(playlist => 
            playlist.title?.toLowerCase().includes(searchTerm) ||
            playlist.description?.toLowerCase().includes(searchTerm) ||
            playlist.created_at?.toLowerCase().includes(searchTerm)
        );
    }
    
    // Aplicar filtro de estado
    const statusFilter = document.getElementById('playlistFilterStatus')?.value || 'all';
    if (statusFilter !== 'all') {
        filtered = filtered.filter(playlist => {
            switch (statusFilter) {
                case 'active':
                    return playlist.is_active === true;
                case 'inactive':
                    return playlist.is_active === false;
                case 'expired':
                    return playlist.expiration_date && new Date(playlist.expiration_date) < new Date();
                default:
                    return true;
            }
        });
    }
    
    // Aplicar ordenación
    const sortBy = document.getElementById('playlistSortBy')?.value || 'created_desc';
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'created_desc':
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            case 'created_asc':
                return new Date(a.created_at || 0) - new Date(b.created_at || 0);
            case 'title_asc':
                return (a.title || '').localeCompare(b.title || '');
            case 'title_desc':
                return (b.title || '').localeCompare(a.title || '');
            case 'videos_desc':
                return (b.video_count || 0) - (a.video_count || 0);
            default:
                return 0;
        }
    });
    
    filteredPlaylists = filtered;
    calculatePagination();
    updateDisplay();
}

// ==========================================
// PAGINACIÓN
// ==========================================
function calculatePagination() {
    totalPages = pageSize === 9999 ? 1 : Math.ceil(filteredPlaylists.length / pageSize);
    if (currentPage > totalPages) {
        currentPage = Math.max(1, totalPages);
    }
}

function goToPage(page) {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
        currentPage = page;
        updateDisplay();
    }
}

function goToPreviousPage() {
    if (currentPage > 1) {
        goToPage(currentPage - 1);
    }
}

function goToNextPage() {
    if (currentPage < totalPages) {
        goToPage(currentPage + 1);
    }
}

// ==========================================
// ACTUALIZACIÓN DE LA INTERFAZ
// ==========================================
function updateDisplay() {
    updateStatistics();
    updatePagination();
    
    if (currentView === 'table') {
        renderTableView();
    } else {
        renderGridView();
    }
}

function updateStatistics() {
    const totalPlaylists = playlists.length;
    const activePlaylists = playlists.filter(p => p.is_active).length;
    const totalVideos = playlists.reduce((sum, p) => sum + (p.video_count || 0), 0);
    
    // Actualizar badges
    updateElement('playlistCountBadge', `${totalPlaylists} listas`);
    updateElement('activePlaylistsBadge', `${activePlaylists} activas`);
    updateElement('totalVideosBadge', `${totalVideos} videos`);
    
    // Información de paginación
    const start = pageSize === 9999 ? 1 : (currentPage - 1) * pageSize + 1;
    const end = pageSize === 9999 ? filteredPlaylists.length : Math.min(currentPage * pageSize, filteredPlaylists.length);
    const total = filteredPlaylists.length;
    
    updateElement('playlistPaginationInfo', `Mostrando ${start} - ${end} de ${total} resultados`);
}

function updatePagination() {
    const pageInput = document.getElementById('pageInput');
    const totalPagesSpan = document.getElementById('totalPages');
    
    if (pageInput) pageInput.value = currentPage;
    if (totalPagesSpan) totalPagesSpan.textContent = totalPages;
    
    // Habilitar/deshabilitar botones
    const firstPageBtn = document.getElementById('firstPageBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const lastPageBtn = document.getElementById('lastPageBtn');
    
    const isFirstPage = currentPage === 1;
    const isLastPage = currentPage === totalPages || totalPages === 0;
    
    if (firstPageBtn) firstPageBtn.disabled = isFirstPage;
    if (prevPageBtn) prevPageBtn.disabled = isFirstPage;
    if (nextPageBtn) nextPageBtn.disabled = isLastPage;
    if (lastPageBtn) lastPageBtn.disabled = isLastPage;
}

function renderTableView() {
    const tbody = document.getElementById('playlistsTableBody');
    if (!tbody) return;
    
    // Calcular elementos para la página actual
    const startIndex = pageSize === 9999 ? 0 : (currentPage - 1) * pageSize;
    const endIndex = pageSize === 9999 ? filteredPlaylists.length : startIndex + pageSize;
    const pageData = filteredPlaylists.slice(startIndex, endIndex);
    
    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <i class="fas fa-search fa-2x text-muted mb-2"></i>
                    <p class="text-muted mb-0">No se encontraron listas de reproducción</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = pageData.map(playlist => `
        <tr>
            <td>
                <div class="d-flex align-items-center">
                    <div class="playlist-thumbnail me-3">
                        <i class="fas fa-list-alt fa-2x text-primary"></i>
                    </div>
                    <div>
                        <h6 class="mb-1">${escapeHtml(playlist.title || 'Sin título')}</h6>
                        <small class="text-muted">ID: ${playlist.id}</small>
                    </div>
                </div>
            </td>
            <td>
                <span class="text-muted">${escapeHtml(playlist.description || 'Sin descripción')}</span>
            </td>
            <td>
                <small class="text-muted">
                    ${playlist.created_at ? formatDate(playlist.created_at) : 'N/A'}
                </small>
            </td>
            <td>
                <span class="video-count-badge">${playlist.video_count || 0}</span>
            </td>
            <td>
                ${getStatusBadge(playlist)}
            </td>
            <td>
                <div class="btn-group btn-group-sm playlist-actions" role="group">
                    <button type="button" class="btn btn-outline-primary" 
                            onclick="viewPlaylist(${playlist.id})" title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button type="button" class="btn btn-outline-warning" 
                            onclick="editPlaylist(${playlist.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger" 
                            onclick="confirmDeletePlaylist(${playlist.id}, '${escapeHtml(playlist.title)}')" title="Eliminar">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderGridView() {
    const container = document.getElementById('playlistsGridContainer');
    if (!container) return;
    
    // Calcular elementos para la página actual
    const startIndex = pageSize === 9999 ? 0 : (currentPage - 1) * pageSize;
    const endIndex = pageSize === 9999 ? filteredPlaylists.length : startIndex + pageSize;
    const pageData = filteredPlaylists.slice(startIndex, endIndex);
    
    if (pageData.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-search fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">No se encontraron listas de reproducción</h5>
                <p class="text-muted">Intenta ajustar los filtros de búsqueda.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pageData.map(playlist => `
        <div class="col-xl-3 col-lg-4 col-md-6 col-sm-12 mb-4">
            <div class="card playlist-card h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="flex-grow-1">
                            <h6 class="card-title mb-2">${escapeHtml(playlist.title || 'Sin título')}</h6>
                            <p class="card-text text-muted small">${escapeHtml(playlist.description || 'Sin descripción')}</p>
                        </div>
                        ${getStatusBadge(playlist)}
                    </div>
                    
                    <div class="row text-center mb-3">
                        <div class="col-6">
                            <div class="border-end">
                                <div class="h5 mb-0 text-primary">${playlist.video_count || 0}</div>
                                <small class="text-muted">Videos</small>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="h6 mb-0 text-muted">${playlist.created_at ? formatDate(playlist.created_at) : 'N/A'}</div>
                            <small class="text-muted">Creada</small>
                        </div>
                    </div>
                </div>
                
                <div class="card-footer bg-transparent">
                    <div class="d-grid gap-2">
                        <div class="btn-group btn-group-sm" role="group">
                            <button type="button" class="btn btn-outline-primary" 
                                   < onclick="viewPlaylist(${playlist.id})">>
                                <i class="fas fa-eye me-1"></i>Ver
                            </button>
                            <button type="button" class="btn btn-outline-warning" 
                                    onclick="editPlaylist(${playlist.id})">
                                <i class="fas fa-edit me-1"></i>Editar
                            </button>
                            <button type="button" class="btn btn-outline-danger" 
                                    onclick="confirmDeletePlaylist(${playlist.id}, '${escapeHtml(playlist.title)}')">
                                <i class="fas fa-trash-alt me-1"></i>Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// CAMBIO DE VISTA
// ==========================================
function switchToTableView() {
    currentView = 'table';
    document.getElementById('tableView').classList.remove('d-none');
    document.getElementById('gridView').classList.add('d-none');
    document.getElementById('tableViewBtn').classList.add('active');
    document.getElementById('gridViewBtn').classList.remove('active');
    renderTableView();
}

function switchToGridView() {
    currentView = 'grid';
    document.getElementById('tableView').classList.add('d-none');
    document.getElementById('gridView').classList.remove('d-none');
    document.getElementById('gridViewBtn').classList.add('active');
    document.getElementById('tableViewBtn').classList.remove('active');
    renderGridView();
}

// ==========================================
// ACCIONES DE PLAYLIST
// ==========================================
function viewPlaylist(playlistId) {
    console.log('👁️ Viendo playlist:', playlistId);
    window.location.href = `/ui/playlists/${playlistId}`;
}

async function editPlaylist(playlistId) {
    console.log('✏️ Editando playlist:', playlistId);
    
    try {
        const response = await fetch(API_ENDPOINTS.playlistById(playlistId), {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const playlist = await response.json();
        
        // Llenar el formulario de edición
        document.getElementById('editPlaylistId').value = playlist.id;
        document.getElementById('editPlaylistTitle').value = playlist.title || '';
        document.getElementById('editPlaylistDescription').value = playlist.description || '';
        document.getElementById('editPlaylistActive').checked = playlist.is_active || false;
        
        if (playlist.expiration_date) {
            const date = new Date(playlist.expiration_date);
            document.getElementById('editPlaylistExpiration').value = date.toISOString().slice(0, 16);
        }
        
        document.getElementById('editPlaylistPriority').value = playlist.priority || 2;
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('editPlaylistModal'));
        modal.show();
        
    } catch (error) {
        console.error('❌ Error cargando playlist para editar:', error);
        showError('No se pudo cargar la información de la playlist');
    }
}

function confirmDeletePlaylist(playlistId, playlistName) {
    console.log('🗑️ Confirmando eliminación de playlist:', playlistId);
    
    document.getElementById('deletePlaylistName').textContent = playlistName;
    document.getElementById('confirmDeleteBtn').dataset.playlistId = playlistId;
    
    const modal = new bootstrap.Modal(document.getElementById('deletePlaylistModal'));
    modal.show();
}

// ==========================================
// MANEJO DE FORMULARIOS
// ==========================================
async function handleCreatePlaylist(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    try {
        setFormLoading(form, true);
        
        const playlistData = {
            title: formData.get('title'),
            description: formData.get('description'),
            is_active: formData.has('is_active'),
            expiration_date: formData.get('expiration_date') || null,
            priority: parseInt(formData.get('priority')) || 2
        };
        
        const response = await fetch(API_ENDPOINTS.createPlaylist, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(playlistData)
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const newPlaylist = await response.json();
        
        showToast('Lista de reproducción creada exitosamente', 'success');
        
        // Cerrar modal y limpiar formulario
        const modal = bootstrap.Modal.getInstance(document.getElementById('createPlaylistModal'));
        modal.hide();
        form.reset();
        
        // Recargar listas
        await loadPlaylists();
        
    } catch (error) {
        console.error('❌ Error creando playlist:', error);
        showError('No se pudo crear la lista de reproducción');
    } finally {
        setFormLoading(form, false);
    }
}

async function handleEditPlaylist(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const playlistId = document.getElementById('editPlaylistId').value;
    
    try {
        setFormLoading(form, true);
        
        const playlistData = {
            title: formData.get('title'),
            description: formData.get('description'),
            is_active: formData.has('is_active'),
            expiration_date: formData.get('expiration_date') || null,
            priority: parseInt(formData.get('priority')) || 2
        };
        
        const response = await fetch(API_ENDPOINTS.updatePlaylist(playlistId), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(playlistData)
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        showToast('Lista de reproducción actualizada exitosamente', 'success');
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editPlaylistModal'));
        modal.hide();
        
        // Recargar listas
        await loadPlaylists();
        
    } catch (error) {
        console.error('❌ Error actualizando playlist:', error);
        showError('No se pudo actualizar la lista de reproducción');
    } finally {
        setFormLoading(form, false);
    }
}

async function handleDeletePlaylist() {
    const playlistId = document.getElementById('confirmDeleteBtn').dataset.playlistId;
    
    try {
        const response = await fetch(API_ENDPOINTS.deletePlaylist(playlistId), {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        showToast('Lista de reproducción eliminada exitosamente', 'success');
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('deletePlaylistModal'));
        modal.hide();
        
        // Recargar listas
        await loadPlaylists();
        
    } catch (error) {
        console.error('❌ Error eliminando playlist:', error);
        showError('No se pudo eliminar la lista de reproducción');
    }
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
function getStatusBadge(playlist) {
    if (!playlist.is_active) {
        return '<span class="badge bg-secondary">Inactiva</span>';
    }
    
    if (playlist.expiration_date && new Date(playlist.expiration_date) < new Date()) {
        return '<span class="badge bg-danger">Expirada</span>';
    }
    
    return '<span class="badge bg-success">Activa</span>';
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return 'Fecha inválida';
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? text.replace(/[&<>"']/g, (m) => map[m]) : '';
}

function getAuthHeaders() {
    // Implementación básica - ajustar según tu sistema de autenticación
    const token = localStorage.getItem('auth_token') || '';
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function setLoadingState(loading) {
    isLoading = loading;
    const loadingRow = document.getElementById('loadingRow');
    if (loadingRow) {
        loadingRow.style.display = loading ? '' : 'none';
    }
}

function setFormLoading(form, loading) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll('input, textarea, select, button');
    
    inputs.forEach(input => {
        input.disabled = loading;
    });
    
    if (submitBtn) {
        if (loading) {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Procesando...';
        } else {
            submitBtn.innerHTML = submitBtn.dataset.originalText || 'Guardar';
        }
    }
}

function updateElement(id, content) {
    const element = document.getElementById(id);
    if (element) {
        element.innerHTML = content;
    }
}

function showToast(message, type = 'info') {
    // Implementación básica de toast - puedes usar tu sistema preferido
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Si tienes Bootstrap Toast, puedes implementarlo aquí
    // Por ahora usamos alert para propósitos de demostración
    if (type === 'error') {
        alert(`Error: ${message}`);
    }
}

function showError(message) {
    showToast(message, 'error');
}

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

// Exponer funciones globalmente para uso en HTML
window.viewPlaylist = viewPlaylist;
window.editPlaylist = editPlaylist;
window.confirmDeletePlaylist = confirmDeletePlaylist;
window.switchToTableView = switchToTableView;
window.switchToGridView = switchToGridView;

console.log('✅ Sistema de gestión de playlists cargado completamente');