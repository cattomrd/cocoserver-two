 // Variables globales
let playlists = [];
let videos = [];
let editorPlaylistVideos = [];
let selectedVideos = new Set();
let sidebarHidden = false;
let currentView = 'table';
let playlistToDelete = null;
let editingPlaylistId = null;

// Datos de ejemplo
const samplePlaylists = [
    {
        id: 1,
        title: "Presentaciones Corporativas",
        description: "Videos institucionales y presentaciones de la empresa",
        is_active: true,
        created_at: "2024-01-15T10:30:00",
        expiration_date: null,
        video_count: 5,
        total_duration: 900
    },
    {
        id: 2,
        title: "Tutoriales de Producto",
        description: "Guías paso a paso para el uso del producto",
        is_active: true,
        created_at: "2024-02-01T14:15:00",
        expiration_date: "2024-12-31T23:59:00",
        video_count: 8,
        total_duration: 1800
    },
    {
        id: 3,
        title: "Campañas Publicitarias",
        description: "Material promocional y publicitario",
        is_active: false,
        created_at: "2024-01-20T09:00:00",
        expiration_date: "2024-06-30T23:59:00",
        video_count: 3,
        total_duration: 450
    }
];

const sampleVideos = [
    { id: 1, title: "Video Tutorial 1", description: "Tutorial básico", duration: 180, file_size: 15728640 },
    { id: 2, title: "Presentación Corporativa", description: "Presentación empresa", duration: 300, file_size: 52428800 },
    { id: 3, title: "Demo del Producto", description: "Demostración producto", duration: 240, file_size: 31457280 },
    { id: 4, title: "Webinar Marketing", description: "Webinar de marketing", duration: 1800, file_size: 157286400 },
    { id: 5, title: "Tutorial Avanzado", description: "Tutorial avanzado", duration: 420, file_size: 73400320 }
];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeLayout();
    loadData();
    initializeEventListeners();
    window.addEventListener('resize', handleResize);
});

// Layout y sidebar
function initializeLayout() {
    if (window.innerWidth <= 768) {
        sidebarHidden = true;
        applySidebarState();
    }
}

function handleResize() {
    if (window.innerWidth <= 768 && !sidebarHidden) {
        sidebarHidden = true;
        applySidebarState();
    }
}

function toggleSidebar() {
    sidebarHidden = !sidebarHidden;
    applySidebarState();
}

function applySidebarState() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleIcon = document.getElementById('sidebarToggleIcon');
    
    if (sidebarHidden) {
        sidebar.classList.add('hidden');
        mainContent.classList.add('expanded');
        toggleIcon.className = 'fas fa-bars';
    } else {
        sidebar.classList.remove('hidden');
        mainContent.classList.remove('expanded');
        toggleIcon.className = 'fas fa-times';
    }
}

// Event listeners
function initializeEventListeners() {
    document.getElementById('sidebarToggle').onclick = toggleSidebar;
    document.getElementById('playlistSearchInput').addEventListener('input', handleSearch);
    document.getElementById('clearPlaylistSearch').onclick = clearSearch;
    document.getElementById('playlistFilterStatus').addEventListener('change', handleFilter);
    document.getElementById('savePlaylistBtn').onclick = savePlaylist;
    document.getElementById('saveEditorPlaylistBtn').onclick = saveEditorPlaylist;
    document.getElementById('editorVideoSearch').addEventListener('input', handleEditorVideoSearch);
}

// Cargar datos
async function loadData() {
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        playlists = samplePlaylists;
        videos = sampleVideos;
        renderPlaylists();
        updatePlaylistCount();
    } catch (error) {
        console.error('Error al cargar datos:', error);
        showToast('Error al cargar las listas de reproducción', 'error');
    }
}

// Renderizar listas
function renderPlaylists(filteredPlaylists = null) {
    const playlistsToRender = filteredPlaylists || playlists;
    
    if (currentView === 'table') {
        renderPlaylistsTable(playlistsToRender);
    } else {
        renderPlaylistsCards(playlistsToRender);
    }
}

function renderPlaylistsTable(playlistsToRender) {
    const playlistsList = document.getElementById('playlistsList');
    
    if (playlistsToRender.length === 0) {
        playlistsList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5">
                    <i class="fas fa-list fa-3x mb-3 opacity-50"></i>
                    <h5>No hay listas de reproducción</h5>
                    <p>Crea tu primera lista para comenzar</p>
                </td>
            </tr>
        `;
        return;
    }
    
    playlistsList.innerHTML = '';
    playlistsToRender.forEach(playlist => {
        const row = createPlaylistRow(playlist);
        playlistsList.appendChild(row);
    });
}

function createPlaylistRow(playlist) {
    const tr = document.createElement('tr');
    const isExpired = playlist.expiration_date && new Date(playlist.expiration_date) < new Date();
    
    tr.innerHTML = `
        <td>
            <div class="fw-bold">${playlist.title}</div>
            <small class="text-muted d-block d-md-none">${playlist.description || 'Sin descripción'}</small>
        </td>
        <td class="d-mobile-none">${playlist.description || 'Sin descripción'}</td>
        <td>
            <span class="badge bg-info">${playlist.video_count} videos</span>
            <small class="d-block text-muted">${formatDuration(playlist.total_duration)}</small>
        </td>
        <td class="d-mobile-none">${formatDate(playlist.created_at)}</td>
        <td>
            <span class="badge ${playlist.is_active ? 'bg-success' : 'bg-secondary'}">
                ${playlist.is_active ? 'Activa' : 'Inactiva'}
            </span>
            ${isExpired ? '<br><span class="badge bg-danger mt-1">Expirada</span>' : ''}
        </td>
        <td>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary" onclick="viewPlaylistDetails(${playlist.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-outline-success" onclick="editPlaylistInEditor(${playlist.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-outline-warning" onclick="editPlaylist(${playlist.id})">
                    <i class="fas fa-cog"></i>
                </button>
                <button class="btn btn-outline-danger" onclick="deletePlaylist(${playlist.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
    
    return tr;
}

// Búsqueda y filtros
function handleSearch() {
    const searchTerm = document.getElementById('playlistSearchInput').value.toLowerCase().trim();
    const filter = document.getElementById('playlistFilterStatus').value;
    
    let filtered = playlists;
    
    if (searchTerm) {
        filtered = filtered.filter(playlist =>
            playlist.title.toLowerCase().includes(searchTerm) ||
            (playlist.description && playlist.description.toLowerCase().includes(searchTerm))
        );
    }
    
    filtered = applyStatusFilter(filtered, filter);
    renderPlaylists(filtered);
    updatePlaylistCount(filtered.length);
}

function handleFilter() {
    handleSearch();
}

function applyStatusFilter(playlistList, filter) {
    switch (filter) {
        case 'active':
            return playlistList.filter(playlist => playlist.is_active);
        case 'inactive':
            return playlistList.filter(playlist => !playlist.is_active);
        default:
            return playlistList;
    }
}

function clearSearch() {
    document.getElementById('playlistSearchInput').value = '';
    document.getElementById('playlistFilterStatus').value = 'all';
    renderPlaylists();
    updatePlaylistCount();
}

function updatePlaylistCount(count = null) {
    const badge = document.getElementById('playlistCountBadge');
    const playlistCount = count !== null ? count : playlists.length;
    badge.textContent = `${playlistCount} lista${playlistCount !== 1 ? 's' : ''}`;
}

// Toggle vista
function toggleView() {
    const tableView = document.getElementById('tableView');
    const cardView = document.getElementById('cardView');
    const toggleIcon = document.getElementById('viewToggleIcon');
    
    if (currentView === 'table') {
        currentView = 'card';
        tableView.style.display = 'none';
        cardView.style.display = 'block';
        toggleIcon.className = 'fas fa-table';
    } else {
        currentView = 'table';
        tableView.style.display = 'block';
        cardView.style.display = 'none';
        toggleIcon.className = 'fas fa-th';
    }
    
    renderPlaylists();
}

// CRUD Playlists
function showCreatePlaylist() {
    editingPlaylistId = null;
    document.getElementById('createPlaylistModalTitle').innerHTML = '<i class="fas fa-plus"></i> Crear Nueva Lista';
    document.getElementById('createPlaylistForm').reset();
    document.getElementById('editPlaylistId').value = '';
    document.getElementById('playlistActive').checked = true;
    
    const modal = new bootstrap.Modal(document.getElementById('createPlaylistModal'));
    modal.show();
}

function editPlaylist(playlistId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    editingPlaylistId = playlistId;
    document.getElementById('createPlaylistModalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Lista';
    
    document.getElementById('editPlaylistId').value = playlist.id;
    document.getElementById('playlistTitle').value = playlist.title;
    document.getElementById('playlistDescription').value = playlist.description || '';
    document.getElementById('playlistActive').checked = playlist.is_active;
    
    if (playlist.start_date) {
        document.getElementById('playlistStartDate').value = new Date(playlist.start_date).toISOString().slice(0, 16);
    }
    if (playlist.expiration_date) {
        document.getElementById('playlistExpiration').value = new Date(playlist.expiration_date).toISOString().slice(0, 16);
    }
    
    const modal = new bootstrap.Modal(document.getElementById('createPlaylistModal'));
    modal.show();
}

function savePlaylist() {
    const title = document.getElementById('playlistTitle').value.trim();
    const description = document.getElementById('playlistDescription').value.trim();
    const isActive = document.getElementById('playlistActive').checked;
    const startDate = document.getElementById('playlistStartDate').value;
    const expiration = document.getElementById('playlistExpiration').value;
    
    if (!title) {
        showToast('El título es requerido', 'error');
        return;
    }
    
    if (editingPlaylistId) {
        const playlistIndex = playlists.findIndex(p => p.id === editingPlaylistId);
        if (playlistIndex !== -1) {
            playlists[playlistIndex] = {
                ...playlists[playlistIndex],
                title: title,
                description: description,
                is_active: isActive,
                start_date: startDate || null,
                expiration_date: expiration || null
            };
            showToast('Lista actualizada exitosamente', 'success');
        }
    } else {
        const newPlaylist = {
            id: Date.now(),
            title: title,
            description: description,
            is_active: isActive,
            created_at: new Date().toISOString(),
            start_date: startDate || null,
            expiration_date: expiration || null,
            video_count: 0,
            total_duration: 0
        };
        
        playlists.unshift(newPlaylist);
        showToast('Lista creada exitosamente', 'success');
    }
    
    renderPlaylists();
    updatePlaylistCount();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('createPlaylistModal'));
    modal.hide();
}

function deletePlaylist(playlistId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    if (confirm(`¿Eliminar la lista "${playlist.title}"?`)) {
        const playlistIndex = playlists.findIndex(p => p.id === playlistId);
        playlists.splice(playlistIndex, 1);
        renderPlaylists();
        updatePlaylistCount();
        showToast('Lista eliminada', 'success');
    }
}

function viewPlaylistDetails(playlistId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    showToast(`Viendo detalles de: ${playlist.title}`, 'info');
}

// Editor Avanzado
function showPlaylistEditor() {
    editorPlaylistVideos = [];
    selectedVideos.clear();
    document.getElementById('editorPlaylistTitle').value = '';
    
    loadEditorVideos();
    updateEditorInfo();
    
    const modal = new bootstrap.Modal(document.getElementById('playlistEditorModal'));
    modal.show();
}

function editPlaylistInEditor(playlistId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    editingPlaylistId = playlistId;
    document.getElementById('editorPlaylistTitle').value = playlist.title;
    
    editorPlaylistVideos = videos.slice(0, playlist.video_count).map((video, index) => ({
        video_id: video.id,
        position: index + 1,
        video: video
    }));
    
    selectedVideos.clear();
    loadEditorVideos();
    renderEditorPlaylist();
    updateEditorInfo();
    
    const modal = new bootstrap.Modal(document.getElementById('playlistEditorModal'));
    modal.show();
}

function loadEditorVideos() {
    const videoLibrary = document.getElementById('editorVideoLibrary');
    videoLibrary.innerHTML = '';
    
    videos.forEach(video => {
        const videoElement = createEditorVideoElement(video);
        videoLibrary.appendChild(videoElement);
    });
}

function createEditorVideoElement(video) {
    const div = document.createElement('div');
    div.className = 'video-item';
    div.dataset.videoId = video.id;
    
    const isInPlaylist = editorPlaylistVideos.some(pv => pv.video_id === video.id);
    const isSelected = selectedVideos.has(video.id);
    
    if (isInPlaylist) div.classList.add('in-playlist');
    if (isSelected) div.classList.add('selected');
    
    div.innerHTML = `
        ${!isInPlaylist ? `
            <div class="selection-checkbox">
                ${isSelected ? '<i class="fas fa-check"></i>' : ''}
            </div>
        ` : ''}
        <div class="video-title">${video.title}</div>
        <div class="video-meta">
            <span class="video-duration">${formatDuration(video.duration)}</span>
            <small>${formatFileSize(video.file_size)}</small>
        </div>
        ${isInPlaylist ? '<div class="badge bg-success mt-2"><i class="fas fa-check"></i> En lista</div>' : ''}
    `;
    
    if (!isInPlaylist) {
        div.addEventListener('click', handleEditorVideoClick);
    }
    
    return div;
}

function handleEditorVideoClick() {
    const videoId = parseInt(this.dataset.videoId);
    
    if (selectedVideos.has(videoId)) {
        selectedVideos.delete(videoId);
        this.classList.remove('selected');
        this.querySelector('.selection-checkbox').innerHTML = '';
    } else {
        selectedVideos.add(videoId);
        this.classList.add('selected');
        this.querySelector('.selection-checkbox').innerHTML = '<i class="fas fa-check"></i>';
    }
    
    updateEditorSelectionInfo();
}

function updateEditorSelectionInfo() {
    const selectionInfo = document.getElementById('editorSelectionInfo');
    const selectedCount = document.getElementById('editorSelectedCount');
    const addSelectedBtn = document.getElementById('addSelectedVideosBtn');
    
    const count = selectedVideos.size;
    selectedCount.textContent = count;
    
    if (count > 0) {
        selectionInfo.style.display = 'block';
        addSelectedBtn.disabled = false;
    } else {
        selectionInfo.style.display = 'none';
        addSelectedBtn.disabled = true;
    }
}

function selectAllVisibleVideos() {
    const searchTerm = document.getElementById('editorVideoSearch').value.toLowerCase().trim();
    let visibleVideos = videos;
    
    if (searchTerm) {
        visibleVideos = videos.filter(video =>
            video.title.toLowerCase().includes(searchTerm)
        );
    }
    
    const availableVideos = visibleVideos.filter(v => !editorPlaylistVideos.some(pv => pv.video_id === v.id));
    
    if (availableVideos.length === 0) {
        showToast('No hay videos disponibles para seleccionar', 'info');
        return;
    }
    
    const allSelected = availableVideos.every(v => selectedVideos.has(v.id));
    
    if (allSelected) {
        availableVideos.forEach(video => selectedVideos.delete(video.id));
        showToast('Videos deseleccionados', 'info');
    } else {
        availableVideos.forEach(video => selectedVideos.add(video.id));
        showToast(`${availableVideos.length} videos seleccionados`, 'success');
    }
    
    loadEditorVideos();
    updateEditorSelectionInfo();
}

function addSelectedVideos() {
    if (selectedVideos.size === 0) return;
    
    const videosToAdd = videos.filter(v => selectedVideos.has(v.id));
    let addedCount = 0;
    
    videosToAdd.forEach(video => {
        if (!editorPlaylistVideos.find(pv => pv.video_id === video.id)) {
            const position = editorPlaylistVideos.length + 1;
            editorPlaylistVideos.push({
                video_id: video.id,
                position: position,
                video: video
            });
            addedCount++;
        }
    });
    
    if (addedCount > 0) {
        selectedVideos.clear();
        loadEditorVideos();
        renderEditorPlaylist();
        updateEditorInfo();
        updateEditorSelectionInfo();
        
        showToast(`${addedCount} video${addedCount !== 1 ? 's' : ''} agregado${addedCount !== 1 ? 's' : ''}`, 'success');
    }
}

function renderEditorPlaylist() {
    const dropZone = document.getElementById('editorDropZone');
    const playlistItems = document.getElementById('editorPlaylistItems');
    
    if (editorPlaylistVideos.length === 0) {
        dropZone.classList.remove('has-items');
        playlistItems.innerHTML = '';
    } else {
        dropZone.classList.add('has-items');
        playlistItems.innerHTML = '';
        
        editorPlaylistVideos.forEach((playlistVideo, index) => {
            const item = createEditorPlaylistItem(playlistVideo, index);
            playlistItems.appendChild(item);
        });
    }
}

function createEditorPlaylistItem(playlistVideo, index) {
    const div = document.createElement('div');
    div.className = 'playlist-item';
    div.dataset.position = index;
    
    div.innerHTML = `
        <div class="position-indicator">${index + 1}</div>
        <div class="flex-grow-1">
            <div class="fw-bold">${playlistVideo.video.title}</div>
            <div class="video-meta">
                <span class="video-duration">${formatDuration(playlistVideo.video.duration)}</span>
                <small class="ms-2">${formatFileSize(playlistVideo.video.file_size)}</small>
            </div>
        </div>
        <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary" onclick="moveEditorVideoUp(${index})" ${index === 0 ? 'disabled' : ''}>
                <i class="fas fa-arrow-up"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary" onclick="moveEditorVideoDown(${index})" ${index === editorPlaylistVideos.length - 1 ? 'disabled' : ''}>
                <i class="fas fa-arrow-down"></i>
            </button>
            <div class="remove-btn" onclick="removeFromEditorPlaylist(${index})">
                <i class="fas fa-trash"></i>
            </div>
        </div>
    `;
    
    return div;
}

function moveEditorVideoUp(index) {
    if (index > 0) {
        [editorPlaylistVideos[index], editorPlaylistVideos[index - 1]] = [editorPlaylistVideos[index - 1], editorPlaylistVideos[index]];
        renderEditorPlaylist();
        updateEditorInfo();
    }
}

function moveEditorVideoDown(index) {
    if (index < editorPlaylistVideos.length - 1) {
        [editorPlaylistVideos[index], editorPlaylistVideos[index + 1]] = [editorPlaylistVideos[index + 1], editorPlaylistVideos[index]];
        renderEditorPlaylist();
        updateEditorInfo();
    }
}

function removeFromEditorPlaylist(index) {
    editorPlaylistVideos.splice(index, 1);
    renderEditorPlaylist();
    updateEditorInfo();
    loadEditorVideos();
}

function clearEditorPlaylist() {
    if (editorPlaylistVideos.length === 0) {
        showToast('La lista ya está vacía', 'info');
        return;
    }
    
    if (confirm('¿Limpiar toda la lista?')) {
        editorPlaylistVideos = [];
        selectedVideos.clear();
        renderEditorPlaylist();
        updateEditorInfo();
        loadEditorVideos();
        updateEditorSelectionInfo();
        showToast('Lista limpiada', 'info');
    }
}

function clearVideoSelection() {
    selectedVideos.clear();
    loadEditorVideos();
    updateEditorSelectionInfo();
}

function handleEditorVideoSearch() {
    const searchTerm = document.getElementById('editorVideoSearch').value.toLowerCase().trim();
    const videoLibrary = document.getElementById('editorVideoLibrary');
    
    videoLibrary.innerHTML = '';
    
    let filteredVideos = videos;
    if (searchTerm) {
        filteredVideos = videos.filter(video =>
            video.title.toLowerCase().includes(searchTerm)
        );
    }
    
    filteredVideos.forEach(video => {
        const videoElement = createEditorVideoElement(video);
        videoLibrary.appendChild(videoElement);
    });
}

function updateEditorInfo() {
    const videoCount = document.getElementById('editorVideoCount');
    const totalDuration = document.getElementById('editorTotalDuration');
    const saveBtn = document.getElementById('saveEditorPlaylistBtn');
    
    videoCount.textContent = `${editorPlaylistVideos.length} video${editorPlaylistVideos.length !== 1 ? 's' : ''}`;
    
    const totalSeconds = editorPlaylistVideos.reduce((sum, pv) => sum + (pv.video.duration || 0), 0);
    totalDuration.textContent = formatDuration(totalSeconds);
    
    saveBtn.disabled = editorPlaylistVideos.length === 0;
}

function saveEditorPlaylist() {
    const title = document.getElementById('editorPlaylistTitle').value.trim();
    
    if (!title) {
        showToast('Por favor ingresa un título para la lista', 'error');
        return;
    }
    
    if (editorPlaylistVideos.length === 0) {
        showToast('Agrega al menos un video a la lista', 'error');
        return;
    }
    
    const totalDuration = editorPlaylistVideos.reduce((sum, pv) => sum + (pv.video.duration || 0), 0);
    
    if (editingPlaylistId) {
        const playlistIndex = playlists.findIndex(p => p.id === editingPlaylistId);
        if (playlistIndex !== -1) {
            playlists[playlistIndex] = {
                ...playlists[playlistIndex],
                title: title,
                video_count: editorPlaylistVideos.length,
                total_duration: totalDuration
            };
            showToast('Lista actualizada exitosamente', 'success');
        }
    } else {
        const newPlaylist = {
            id: Date.now(),
            title: title,
            description: '',
            is_active: true,
            created_at: new Date().toISOString(),
            expiration_date: null,
            video_count: editorPlaylistVideos.length,
            total_duration: totalDuration
        };
        
        playlists.unshift(newPlaylist);
        showToast('Lista creada exitosamente', 'success');
    }
    
    renderPlaylists();
    updatePlaylistCount();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('playlistEditorModal'));
    modal.hide();
}

// Utilidades
function refreshPlaylists() {
    showToast('Listas actualizadas', 'success');
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${getToastBootstrapClass(type)} border-0`;
    toast.setAttribute('role', 'alert');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas ${getToastIcon(type)} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

function getToastBootstrapClass(type) {
    const classes = {
        'success': 'success',
        'error': 'danger',
        'warning': 'warning',
        'info': 'info'
    };
    return classes[type] || 'info';
}

function getToastIcon(type) {
    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    return icons[type] || 'fa-info-circle';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}