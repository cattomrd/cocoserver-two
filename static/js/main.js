// =============================================
// MAIN.JS CORREGIDO Y MEJORADO - V2.0
// =============================================

// ===== CONFIGURACIÃ“N GLOBAL =====
const API_URL = '/api';

// Variables globales - Asegurar que estÃ¡n en window
window.allVideos = [];
window.allPlaylists = [];
window.currentPlaylistId = null;

// Variables de paginaciÃ³n de videos
window.videoPagination = {
    currentPage: 1,
    pageSize: 25,
    totalItems: 0,
    totalPages: 1,
    filteredData: [],
    searchTerm: '',
    filter: 'all',
    sortField: 'title',
    sortOrder: 'asc'
};

// Aliases para compatibilidad
let allVideos = window.allVideos;
let allPlaylists = window.allPlaylists;
let currentPlaylistId = window.currentPlaylistId;
let videoPagination = window.videoPagination;

console.log('Main.js v2.0 - Inicializando...');

// ===== FUNCIONES HELPER MEJORADAS =====

function safeElementOperation(elementId, operation) {
    try {
        const element = document.getElementById(elementId);
        if (element) {
            operation(element);
            return true;
        } else {
            console.warn(`Elemento no encontrado: ${elementId}`);
        }
        return false;
    } catch (error) {
        console.error(`Error al operar con elemento ${elementId}:`, error);
        return false;
    }
}

function isExpired(dateString) {
    if (!dateString) return false;
    try {
        const expirationDate = new Date(dateString);
        const now = new Date();
        return expirationDate < now;
    } catch (e) {
        console.error("Error al verificar expiraciÃ³n:", e);
        return false;
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Sin fecha';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Fecha invÃ¡lida';
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
        return 'Error de formato';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    console.log(`Toast (${type}): ${message}`);
    
    if (window.bootstrap && typeof bootstrap.Toast === 'function') {
        try {
            const container = document.querySelector('.toast-container') || (() => {
                const newContainer = document.createElement('div');
                newContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
                newContainer.style.zIndex = '9999';
                document.body.appendChild(newContainer);
                return newContainer;
            })();
            
            const toastEl = document.createElement('div');
            const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
            toastEl.className = `toast align-items-center text-white ${bgClass} border-0`;
            toastEl.setAttribute('role', 'alert');
            toastEl.setAttribute('aria-live', 'assertive');
            toastEl.setAttribute('aria-atomic', 'true');
            
            toastEl.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            `;
            
            container.appendChild(toastEl);
            
            const toast = new bootstrap.Toast(toastEl, {
                autohide: true,
                delay: type === 'error' ? 7000 : 4000
            });
            toast.show();
            
            toastEl.addEventListener('hidden.bs.toast', () => {
                toastEl.remove();
            });
        } catch (e) {
            console.error("Error al crear toast de Bootstrap:", e);
            alert(message);
        }
    } else {
        alert(message);
    }
}

// ===== FUNCIONES DE PAGINACIÃ“N CORREGIDAS =====

window.applyFiltersAndDisplayPage = function() {
    console.log('=== APLICANDO FILTROS ===');
    
    // Verificar que allVideos existe y es un array
    if (!window.allVideos || !Array.isArray(window.allVideos)) {
        console.warn('allVideos no estÃ¡ disponible o no es un array');
        window.allVideos = [];
        allVideos = window.allVideos;
    }
    
    if (window.allVideos.length === 0) {
        console.warn('No hay videos cargados');
        const videosList = document.getElementById('videosList');
        if (videosList) {
            videosList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <div class="text-muted">
                            <i class="fas fa-info-circle fa-3x mb-3"></i>
                            <p class="mb-0">No hay videos disponibles</p>
                            <p class="small">Sube tu primer video para comenzar</p>
                        </div>
                    </td>
                </tr>
            `;
        }
        updatePaginationInfo();
        updatePaginationButtons();
        return;
    }
    
    let filtered = [...window.allVideos];

    // Aplicar filtro de estado
    if (videoPagination.filter === 'active') {
        filtered = filtered.filter(video => !video.expiration_date || new Date(video.expiration_date) >= new Date());
    } else if (videoPagination.filter === 'expired') {
        filtered = filtered.filter(video => video.expiration_date && new Date(video.expiration_date) < new Date());
    }

    // Aplicar filtro de bÃºsqueda
    if (videoPagination.searchTerm && videoPagination.searchTerm.trim()) {
        const searchLower = videoPagination.searchTerm.toLowerCase();
        filtered = filtered.filter(video => 
            (video.title || '').toLowerCase().includes(searchLower) ||
            (video.description || '').toLowerCase().includes(searchLower) ||
            (video.filename || '').toLowerCase().includes(searchLower)
        );
    }

    // Ordenar los datos
    filtered.sort((a, b) => {
        let aValue = a[videoPagination.sortField] || '';
        let bValue = b[videoPagination.sortField] || '';
        
        if (videoPagination.sortField.includes('date') || videoPagination.sortField.includes('_date')) {
            aValue = new Date(aValue || 0);
            bValue = new Date(bValue || 0);
        } else {
            aValue = aValue.toString().toLowerCase();
            bValue = bValue.toString().toLowerCase();
        }
        
        if (videoPagination.sortOrder === 'desc') {
            return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
    });

    videoPagination.filteredData = filtered;
    videoPagination.totalItems = filtered.length;
    videoPagination.totalPages = Math.ceil(videoPagination.totalItems / videoPagination.pageSize);
    
    // Ajustar pÃ¡gina actual si es necesario
    if (videoPagination.currentPage > videoPagination.totalPages && videoPagination.totalPages > 0) {
        videoPagination.currentPage = videoPagination.totalPages;
    }
    if (videoPagination.currentPage < 1) {
        videoPagination.currentPage = 1;
    }

    // Actualizar display
    displayCurrentPage();
    updatePaginationInfo();
    updatePaginationButtons();
    
    console.log(`Filtros aplicados: ${filtered.length} de ${window.allVideos.length} videos`);
};

window.displayCurrentPage = function() {
    const startIndex = (videoPagination.currentPage - 1) * videoPagination.pageSize;
    const endIndex = Math.min(startIndex + videoPagination.pageSize, videoPagination.totalItems);
    const pageData = videoPagination.filteredData.slice(startIndex, endIndex);

    const videosList = document.getElementById('videosList');
    if (!videosList) {
        console.error('videosList no encontrado');
        return;
    }
    
    if (pageData.length === 0) {
        videosList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5">
                    <div class="text-muted">
                        <i class="fas fa-search fa-3x mb-3"></i>
                        <p class="mb-0">No se encontraron videos</p>
                        ${videoPagination.searchTerm ? '<p class="small">Intenta con otros tÃ©rminos de bÃºsqueda</p>' : ''}
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const rows = pageData.map(video => {
        const videoExpired = video.expiration_date && isExpired(video.expiration_date);
        return `
            <tr class="${videoExpired ? 'table-warning' : ''}">
                <td>
                    <strong>${escapeHtml(video.title || video.filename || 'Sin tÃ­tulo')}</strong>
                    ${video.filename && video.title !== video.filename ? 
                        `<br><small class="text-muted">${escapeHtml(video.filename)}</small>` : ''}
                </td>
                <td>
                    <span class="text-muted">${escapeHtml(video.description || 'Sin descripciÃ³n')}</span>
                </td>
                <td>
                    <small class="text-muted">${formatDate(video.upload_date || video.created_at)}</small>
                </td>
                <td>
                    ${video.expiration_date ? 
                        `<span class="badge ${videoExpired ? 'bg-danger' : 'bg-info'}">
                            ${videoExpired ? 'Expirado' : 'Expira'}: ${formatDate(video.expiration_date)}
                        </span>` : 
                        '<span class="text-muted">Sin expiraciÃ³n</span>'}
                </td>
                <td>
                    <span class="badge ${videoExpired ? 'bg-danger' : 'bg-success'}">
                        ${videoExpired ? 'Expirado' : 'Activo'}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="downloadVideo(${video.id})" title="Descargar">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="editVideo(${video.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteVideo(${video.id})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    videosList.innerHTML = rows;
};

window.updatePaginationInfo = function() {
    const startItem = videoPagination.totalItems > 0 ? 
        (videoPagination.currentPage - 1) * videoPagination.pageSize + 1 : 0;
    const endItem = Math.min(videoPagination.currentPage * videoPagination.pageSize, videoPagination.totalItems);
    
    safeElementOperation('videoCountBadge', element => {
        element.textContent = `${videoPagination.totalItems} video${videoPagination.totalItems !== 1 ? 's' : ''}`;
    });
    
    safeElementOperation('videoPaginationInfo', element => {
        element.textContent = `Mostrando ${startItem} - ${endItem} de ${videoPagination.totalItems} resultados`;
    });
};

window.updatePaginationButtons = function() {
    safeElementOperation('firstVideoPageBtn', element => {
        element.disabled = videoPagination.currentPage <= 1;
    });
    
    safeElementOperation('prevVideoPageBtn', element => {
        element.disabled = videoPagination.currentPage <= 1;
    });
    
    safeElementOperation('nextVideoPageBtn', element => {
        element.disabled = videoPagination.currentPage >= videoPagination.totalPages;
    });
    
    safeElementOperation('lastVideoPageBtn', element => {
        element.disabled = videoPagination.currentPage >= videoPagination.totalPages;
    });
    
    safeElementOperation('videoPageInput', element => {
        element.value = videoPagination.currentPage;
        element.max = videoPagination.totalPages || 1;
    });
    
    safeElementOperation('totalVideoPages', element => {
        element.textContent = videoPagination.totalPages || 1;
    });
    
    safeElementOperation('videoPaginationFooter', element => {
        const startItem = videoPagination.totalItems > 0 ?
            (videoPagination.currentPage - 1) * videoPagination.pageSize + 1 : 0;
        const endItem = Math.min(videoPagination.currentPage * videoPagination.pageSize, videoPagination.totalItems);
        element.innerHTML = `
            PÃ¡gina ${videoPagination.currentPage} de ${videoPagination.totalPages || 1} 
            <span class="text-primary">(${startItem}-${endItem} de ${videoPagination.totalItems})</span>
        `;
    });
};

// ===== FUNCIONES DE NAVEGACIÃ“N =====

window.goToVideoPage = function(page) {
    page = parseInt(page);
    if (page >= 1 && page <= videoPagination.totalPages && page !== videoPagination.currentPage) {
        videoPagination.currentPage = page;
        displayCurrentPage();
        updatePaginationInfo();
        updatePaginationButtons();
    }
};

window.goToFirstVideoPage = function() {
    window.goToVideoPage(1);
};

window.goToPrevVideoPage = function() {
    if (videoPagination.currentPage > 1) {
        window.goToVideoPage(videoPagination.currentPage - 1);
    }
};

window.goToNextVideoPage = function() {
    if (videoPagination.currentPage < videoPagination.totalPages) {
        window.goToVideoPage(videoPagination.currentPage + 1);
    }
};

window.goToLastVideoPage = function() {
    window.goToVideoPage(videoPagination.totalPages);
};

window.sortVideoTable = function(field) {
    if (videoPagination.sortField === field) {
        videoPagination.sortOrder = videoPagination.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        videoPagination.sortField = field;
        videoPagination.sortOrder = 'asc';
    }
    
    applyFiltersAndDisplayPage();
    
    // Actualizar iconos de ordenamiento
    document.querySelectorAll('#videosTable th .fas').forEach(icon => {
        icon.className = 'fas fa-sort ms-1';
    });
    
    const currentButton = document.querySelector(`button[onclick="sortVideoTable('${field}')"] .fas`);
    if (currentButton) {
        currentButton.className = `fas fa-sort-${videoPagination.sortOrder === 'asc' ? 'up' : 'down'} ms-1`;
    }
};

// ===== GESTIÃ“N DE VIDEOS CORREGIDA =====

window.loadVideos = async function(filter = 'all') {
    console.log('=== CARGANDO VIDEOS ===');
    
    const videosList = document.getElementById('videosList');
    if (!videosList) {
        console.error("Elemento videosList no encontrado");
        return;
    }
    
    try {
        // Mostrar indicador de carga
        videosList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-3">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mt-2">Cargando videos...</p>
                </td>
            </tr>
        `;
        
        // Cargar videos desde la API
        console.log('Solicitando videos a:', `${API_URL}/videos/`);
        const response = await fetch(`${API_URL}/videos/`);
        
        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
        }
        
        const responseData = await response.json();
        console.log('Respuesta de la API:', responseData);
        
        // Manejar diferentes formatos de respuesta
        if (Array.isArray(responseData)) {
            window.allVideos = responseData;
        } else if (responseData.items && Array.isArray(responseData.items)) {
            window.allVideos = responseData.items;
        } else if (responseData.data && Array.isArray(responseData.data)) {
            window.allVideos = responseData.data;
        } else {
            throw new Error('Formato de respuesta no vÃ¡lido');
        }
        
        allVideos = window.allVideos;
        
        console.log(`Videos cargados: ${window.allVideos.length}`);
        
        // Configurar filtro inicial
        videoPagination.filter = filter;
        videoPagination.currentPage = 1;
        
        // Aplicar filtros
        setTimeout(() => {
            applyFiltersAndDisplayPage();
        }, 100);
        
        console.log('=== VIDEOS CARGADOS CORRECTAMENTE ===');
        
    } catch (error) {
        console.error('Error al cargar videos:', error);
        videosList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5">
                    <div class="alert alert-danger mb-0">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Error al cargar videos</strong><br>
                        ${error.message}<br>
                        <small class="text-muted">Verifica la conexiÃ³n a la API: ${API_URL}/videos/</small>
                    </div>
                </td>
            </tr>
        `;
        
        // Inicializar array vacÃ­o en caso de error
        window.allVideos = [];
        allVideos = window.allVideos;
        
        // Actualizar paginaciÃ³n incluso en error
        updatePaginationInfo();
        updatePaginationButtons();
    }
};

// ===== FUNCIÃ“N DE DESCARGA MEJORADA =====
window.downloadVideo = async function(videoId) {
    console.log('Descargando video:', videoId);
    
    try {
        // Verificar que el video existe en la lista local
        const video = window.allVideos.find(v => v.id === videoId);
        if (!video) {
            throw new Error('Video no encontrado en la lista local');
        }
        
        // Mostrar indicador de descarga
        showToast(`Preparando descarga: ${video.title || video.filename}`, 'info');
        
        // Primero verificar informaciÃ³n del video
        const infoUrl = `${API_URL}/videos/${videoId}/info`;
        console.log('Verificando informaciÃ³n del video:', infoUrl);
        
        const infoResponse = await fetch(infoUrl);
        if (infoResponse.ok) {
            const videoInfo = await infoResponse.json();
            console.log('InformaciÃ³n del video:', videoInfo);
            
            if (!videoInfo.file_exists) {
                throw new Error(`El archivo del video no existe en el servidor`);
            }
            
            if (videoInfo.is_expired) {
                throw new Error(`El video ha expirado: ${videoInfo.expiration_date}`);
            }
        } else {
            console.warn('No se pudo verificar informaciÃ³n del video, continuando con descarga...');
        }
        
        // URL de descarga
        const downloadUrl = `${API_URL}/videos/${videoId}/download`;
        console.log('URL de descarga:', downloadUrl);
        
        // Verificar que el endpoint responde
        const headResponse = await fetch(downloadUrl, { method: 'HEAD' });
        if (!headResponse.ok) {
            if (headResponse.status === 404) {
                throw new Error('Video no encontrado en el servidor (404)');
            } else if (headResponse.status === 403) {
                throw new Error('Video expirado o sin permisos (403)');
            } else {
                throw new Error(`Error del servidor: ${headResponse.status} ${headResponse.statusText}`);
            }
        }
        
        // Crear elemento de descarga temporal
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = video.filename || `video_${videoId}`;
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        showToast(`Descarga iniciada: ${video.title || video.filename}`, 'success');
        
    } catch (error) {
        console.error('Error al descargar video:', error);
        showToast(`Error al descargar video: ${error.message}`, 'error');
        
        // Mostrar informaciÃ³n adicional de diagnÃ³stico
        if (error.message.includes('404') || error.message.includes('no encontrado')) {
            showToast('Ejecuta el diagnÃ³stico de videos para mÃ¡s informaciÃ³n', 'info');
        }
    }
};

// ===== FUNCIÃ“N DE SUBIDA CORREGIDA =====
window.uploadVideo = async function(formData) {
    console.log('=== INICIANDO SUBIDA DE VIDEO CORREGIDA ===');
    
    const progressBar = document.querySelector('#uploadProgress .progress-bar');
    const progressContainer = document.getElementById('uploadProgress');
    
    try {
        if (progressContainer) {
            progressContainer.classList.remove('d-none');
            if (progressBar) {
                progressBar.style.width = '0%';
                progressBar.textContent = '0%';
                progressBar.setAttribute('aria-valuenow', '0');
            }
        }
        
        // Verificar que formData tenga los campos necesarios
        const title = formData.get('title');
        const file = formData.get('file');
        
        if (!title || !title.trim()) {
            throw new Error('El tÃ­tulo es obligatorio');
        }
        
        if (!file || file.size === 0) {
            throw new Error('Debe seleccionar un archivo de video');
        }
        
        console.log('Datos del formulario:');
        console.log('- TÃ­tulo:', title);
        console.log('- Archivo:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log('- DescripciÃ³n:', formData.get('description') || 'Sin descripciÃ³n');
        console.log('- ExpiraciÃ³n:', formData.get('expiration_date') || 'Sin expiraciÃ³n');
        
        // IMPORTANTE: Crear un nuevo FormData con SOLO los campos vÃ¡lidos segÃºn el modelo Video
        const cleanFormData = new FormData();
        
        // Agregar solo los campos permitidos
        cleanFormData.append('title', title);
        cleanFormData.append('file', file);
        
        // Campos opcionales (solo si existen y no son vacÃ­os)
        if (formData.get('description')) {
            cleanFormData.append('description', formData.get('description'));
        }
        
        if (formData.get('expiration_date')) {
            cleanFormData.append('expiration_date', formData.get('expiration_date'));
        }
        
        // DEPURACIÃ“N: Verificar que no haya 'filename' u otros campos no vÃ¡lidos
        console.log('=== VERIFICANDO CAMPOS DE FORMDATA LIMPIO ===');
        for (const pair of cleanFormData.entries()) {
            console.log(`Campo: ${pair[0]}, Tipo: ${typeof pair[1]}`);
            if (pair[0] === 'filename') {
                console.error('âš ï¸ ADVERTENCIA: Se detectÃ³ campo "filename" que no deberÃ­a existir');
                // Eliminar el campo problemÃ¡tico
                cleanFormData.delete('filename');
            }
        }
        
        // IMPORTANTE: Verificar que no se incluyÃ³ el campo 'filename'
        if (cleanFormData.has('filename')) {
            console.error('âš ï¸ ERROR: Se ha detectado el campo "filename" que causa el error.');
            cleanFormData.delete('filename');
            console.log('Campo "filename" eliminado del FormData.');
        }
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${window.location.origin}/api/videos/`, true);
            
            // Progreso de subida
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && progressBar) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressBar.style.width = percentComplete + '%';
                    progressBar.textContent = percentComplete + '%';
                    progressBar.setAttribute('aria-valuenow', percentComplete);
                    console.log(`Progreso de subida: ${percentComplete}%`);
                }
            };
            
            xhr.onload = () => {
                console.log('Respuesta del servidor:', xhr.status, xhr.statusText);
                
                if (xhr.status === 200 || xhr.status === 201) {
                    let responseData;
                    try {
                        responseData = JSON.parse(xhr.responseText);
                        console.log('Video subido exitosamente:', responseData);
                    } catch (e) {
                        console.warn('No se pudo parsear respuesta JSON, pero la subida fue exitosa');
                    }
                    
                    showToast('Video subido correctamente', 'success');
                    
                    // Limpiar formulario
                    if (document.getElementById('videoUploadForm')) {
                        document.getElementById('videoUploadForm').reset();
                    }
                    
                    // Cerrar formulario colapsable
                    const uploadForm = document.getElementById('uploadForm');
                    if (uploadForm && window.bootstrap) {
                        try {
                            const collapse = bootstrap.Collapse.getInstance(uploadForm);
                            if (collapse) {
                                collapse.hide();
                            }
                        } catch (e) {
                            console.warn("No se pudo cerrar el formulario automÃ¡ticamente:", e);
                        }
                    }
                    
                    // Recargar videos despuÃ©s de un breve delay
                    setTimeout(() => {
                        if (typeof window.loadVideos === 'function') {
                            window.loadVideos();
                        }
                    }, 1000);
                    
                    resolve(responseData);
                } else {
                    console.log('Respuesta del servidor:', xhr.status, xhr.statusText);
                    console.log('Texto de respuesta:', xhr.responseText);
                    
                    let errorMessage = 'Error al crear video';
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        errorMessage = errorData.detail || errorMessage;
                    } catch (e) {
                        console.warn('No se pudo parsear respuesta de error');
                    }
                    
                    console.error('Error en la subida:', errorMessage);
                    showToast(errorMessage, 'error');
                    
                    reject(new Error(errorMessage));
                }
                
                // Ocultar barra de progreso
                if (progressContainer) {
                    setTimeout(() => {
                        progressContainer.classList.add('d-none');
                    }, 1000);
                }
            };
            
            xhr.onerror = () => {
                console.error('Error de red al subir el video');
                showToast('Error de red al subir el video', 'error');
                
                if (progressContainer) {
                    progressContainer.classList.add('d-none');
                }
                
                reject(new Error('Error de red al subir el video'));
            };
            
            // IMPORTANTE: Usar el FormData limpio (sin campos no vÃ¡lidos)
            console.log('Enviando peticiÃ³n de subida con FormData limpio...');
            xhr.send(cleanFormData);
        });
        
    } catch (error) {
        console.error('Error al preparar la subida:', error);
        showToast(`Error: ${error.message}`, 'error');
        
        if (progressContainer) {
            progressContainer.classList.add('d-none');
        }
        
        throw error;
    }
};

// ===== FUNCIONES DE EDICIÃ“N Y ELIMINACIÃ“N =====

window.editVideo = async function(videoId) {
    console.log("Editando video:", videoId);
    
    try {
        const video = window.allVideos.find(v => v.id === videoId);
        if (!video) {
            throw new Error('Video no encontrado en los datos cargados');
        }
        
        // Llenar formulario de ediciÃ³n
        safeElementOperation('editVideoId', element => element.value = video.id);
        safeElementOperation('editVideoTitle', element => element.value = video.title || '');
        safeElementOperation('editVideoDescription', element => element.value = video.description || '');
        
        // Manejar fecha de expiraciÃ³n
        safeElementOperation('editVideoExpiration', element => {
            if (video.expiration_date) {
                try {
                    const date = new Date(video.expiration_date);
                    if (!isNaN(date.getTime())) {
                        const localDatetime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                            .toISOString()
                            .slice(0, 16);
                        element.value = localDatetime;
                    } else {
                        element.value = '';
                    }
                } catch (e) {
                    console.error("Error al procesar fecha de expiraciÃ³n:", e);
                    element.value = '';
                }
            } else {
                element.value = '';
            }
        });
        
        // Mostrar modal
        const editModal = document.getElementById('editVideoModal');
        if (!editModal) {
            throw new Error('No se encontrÃ³ el modal de ediciÃ³n de videos');
        }
        
        if (window.bootstrap) {
            const modal = new bootstrap.Modal(editModal);
            modal.show();
            
            // Enfocar el primer campo despuÃ©s de mostrar el modal
            setTimeout(() => {
                const titleInput = document.getElementById('editVideoTitle');
                if (titleInput) titleInput.focus();
            }, 300);
        } else {
            throw new Error('Bootstrap no estÃ¡ disponible');
        }
        
    } catch (error) {
        console.error('Error al preparar el video para ediciÃ³n:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
};

window.saveVideoChanges = async function() {
    console.log("Guardando cambios de video...");
    
    try {
        const videoId = document.getElementById('editVideoId')?.value;
        const title = document.getElementById('editVideoTitle')?.value?.trim();
        const description = document.getElementById('editVideoDescription')?.value?.trim();
        const expirationDate = document.getElementById('editVideoExpiration')?.value;
        
        if (!videoId) {
            throw new Error('ID de video no vÃ¡lido');
        }
        
        if (!title) {
            throw new Error('El tÃ­tulo no puede estar vacÃ­o');
        }
        
        const updateData = {
            title,
            description: description || null,
            expiration_date: expirationDate || null
        };
        
        console.log('Datos a actualizar:', updateData);
        
        const response = await fetch(`${API_URL}/videos/${videoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
        });
        
        if (!response.ok) {
            let errorMessage = `Error (${response.status}): ${response.statusText}`;
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                console.warn('No se pudo parsear error de respuesta');
            }
            
            throw new Error(errorMessage);
        }
        
        const updatedVideo = await response.json();
        console.log('Video actualizado:', updatedVideo);
        
        // Cerrar modal
        const modalElement = document.getElementById('editVideoModal');
        if (modalElement && window.bootstrap) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        }
        
        showToast('Video actualizado correctamente', 'success');
        
        // Recargar videos
        setTimeout(() => {
            loadVideos();
        }, 500);
        
    } catch (error) {
        console.error('Error al guardar cambios del video:', error);
        showToast(`Error al guardar cambios: ${error.message}`, 'error');
    }
};

window.deleteVideo = async function(videoId) {
    const video = window.allVideos.find(v => v.id === videoId);
    const videoName = video ? (video.title || video.filename || `Video ${videoId}`) : `Video ${videoId}`;
    
    if (!confirm(`Â¿EstÃ¡s seguro de que deseas eliminar "${videoName}"?\n\nEsta acciÃ³n no se puede deshacer.`)) {
        return;
    }
    
    try {
        console.log('Eliminando video:', videoId);
        
        const response = await fetch(`${API_URL}/videos/${videoId}`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            let errorMessage = `Error (${response.status}): ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                console.warn('No se pudo parsear error de respuesta');
            }
            throw new Error(errorMessage);
        }
        
        showToast(`Video "${videoName}" eliminado correctamente`, 'success');
        
        // Recargar videos
        setTimeout(() => {
            loadVideos();
        }, 500);
        
    } catch (error) {
        console.error('Error al eliminar video:', error);
        showToast(`Error al eliminar el video: ${error.message}`, 'error');
    }
};

// ===== FUNCIONES ESPECÃFICAS PARA TEMPLATES =====

// Estas funciones son llamadas por los templates y deben sobrescribir los placeholders

window.filterVideos = function(searchTerm) {
    console.log('Aplicando filtro de bÃºsqueda:', searchTerm);
    videoPagination.searchTerm = (searchTerm || '').toLowerCase().trim();
    videoPagination.currentPage = 1;
    applyFiltersAndDisplayPage();
};

window.filterVideosByExpiration = function(filter) {
    console.log('Aplicando filtro de expiraciÃ³n:', filter);
    videoPagination.filter = filter || 'all';
    videoPagination.currentPage = 1;
    applyFiltersAndDisplayPage();
};

window.setVideoPageSize = function(pageSize) {
    console.log('Configurando tamaÃ±o de pÃ¡gina:', pageSize);
    videoPagination.pageSize = parseInt(pageSize) || 25;
    videoPagination.currentPage = 1;
    applyFiltersAndDisplayPage();
};

// ===== EVENT LISTENERS CORREGIDOS =====

function setupVideoEventListeners() {
    console.log('Configurando event listeners de videos...');
    
    // Remover listeners existentes primero para evitar duplicados
    removeVideoEventListeners();
    
    // BÃºsqueda de videos con debounce
    const videoSearchInput = document.getElementById('videoSearchInput');
    if (videoSearchInput) {
        const searchHandler = debounce((e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            console.log('Buscando videos desde input:', searchTerm);
            window.filterVideos(searchTerm);
        }, 300);
        
        videoSearchInput.addEventListener('input', searchHandler);
        videoSearchInput._searchHandler = searchHandler; // Guardar referencia para cleanup
    }

    // Limpiar bÃºsqueda
    const clearVideoSearch = document.getElementById('clearVideoSearch');
    if (clearVideoSearch) {
        const clearHandler = () => {
            console.log('Limpiando bÃºsqueda de videos');
            const searchInput = document.getElementById('videoSearchInput');
            if (searchInput) {
                searchInput.value = '';
                window.filterVideos('');
            }
        };
        
        clearVideoSearch.addEventListener('click', clearHandler);
        clearVideoSearch._clearHandler = clearHandler;
    }

    // Filtro de estado
    const videoFilterExpiration = document.getElementById('videoFilterExpiration');
    if (videoFilterExpiration) {
        const filterHandler = (e) => {
            console.log('Cambiando filtro de videos desde select:', e.target.value);
            window.filterVideosByExpiration(e.target.value);
        };
        
        videoFilterExpiration.addEventListener('change', filterHandler);
        videoFilterExpiration._filterHandler = filterHandler;
    }

    // Selector de tamaÃ±o de pÃ¡gina
    const videoPageSizeSelect = document.getElementById('videoPageSizeSelect');
    if (videoPageSizeSelect) {
        const pageSizeHandler = (e) => {
            const newSize = parseInt(e.target.value);
            console.log('Cambiando tamaÃ±o de pÃ¡gina desde select:', newSize);
            window.setVideoPageSize(newSize);
        };
        
        videoPageSizeSelect.addEventListener('change', pageSizeHandler);
        videoPageSizeSelect._pageSizeHandler = pageSizeHandler;
    }

    // Input de pÃ¡gina
    const videoPageInput = document.getElementById('videoPageInput');
    if (videoPageInput) {
        const pageInputHandler = (e) => {
            const page = parseInt(e.target.value);
            if (page && page >= 1 && page <= videoPagination.totalPages) {
                goToVideoPage(page);
            }
        };
        
        videoPageInput.addEventListener('change', pageInputHandler);
        videoPageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                pageInputHandler(e);
            }
        });
        videoPageInput._pageInputHandler = pageInputHandler;
    }
    
    console.log('Event listeners de videos configurados correctamente');
}

function removeVideoEventListeners() {
    // Remover listeners existentes para evitar duplicados
    const elements = [
        { id: 'videoSearchInput', handler: '_searchHandler' },
        { id: 'clearVideoSearch', handler: '_clearHandler' },
        { id: 'videoFilterExpiration', handler: '_filterHandler' },
        { id: 'videoPageSizeSelect', handler: '_pageSizeHandler' },
        { id: 'videoPageInput', handler: '_pageInputHandler' }
    ];
    
    elements.forEach(({ id, handler }) => {
        const element = document.getElementById(id);
        if (element && element[handler]) {
            element.removeEventListener(element[handler].eventType || 'input', element[handler]);
            delete element[handler];
        }
    });
}

// FunciÃ³n debounce para optimizar bÃºsquedas
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

// ===== GESTIÃ“N DE PLAYLISTS =====

window.loadPlaylists = async function(filter = 'all') {
    console.log("Cargando playlists con filtro:", filter);
    
    const playlistsList = document.getElementById('playlistsList');
    if (!playlistsList) {
        console.error("Elemento playlistsList no encontrado");
        return;
    }
    
    try {
        playlistsList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-3">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mt-2">Cargando listas de reproducciÃ³n...</p>
                </td>
            </tr>
        `;
        
        const response = await fetch(`${API_URL}/playlists/`);
        
        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
        }
        
        window.allPlaylists = await response.json();
        allPlaylists = window.allPlaylists;
        
        if (!Array.isArray(window.allPlaylists)) {
            throw new Error("Formato de datos invÃ¡lido");
        }
        
        console.log(`Playlists cargadas: ${window.allPlaylists.length}`);
        
        // Aplicar filtro si existe funciÃ³n de paginaciÃ³n de playlists
        if (typeof window.loadPlaylistsWithPagination === 'function') {
            return window.loadPlaylistsWithPagination(filter);
        }
        
        // Fallback: mostrar playlists bÃ¡sico
        let filteredPlaylists = window.allPlaylists;
        if (filter === 'active') {
            filteredPlaylists = window.allPlaylists.filter(playlist => 
                playlist.is_active && (!playlist.expiration_date || !isExpired(playlist.expiration_date))
            );
        } else if (filter === 'inactive') {
            filteredPlaylists = window.allPlaylists.filter(playlist => 
                !playlist.is_active || (playlist.expiration_date && isExpired(playlist.expiration_date))
            );
        }
        
        safeElementOperation('playlistCountBadge', element => {
            element.textContent = `${filteredPlaylists.length} listas`;
        });
        
        if (filteredPlaylists.length === 0) {
            playlistsList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <div class="text-muted">
                            <i class="fas fa-list fa-3x mb-3"></i>
                            <p class="mb-0">No hay listas de reproducciÃ³n disponibles</p>
                            <p class="small">Â¡Crea tu primera lista!</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        const playlistsHTML = filteredPlaylists.map(playlist => {
            const isActive = playlist.is_active && (!playlist.expiration_date || !isExpired(playlist.expiration_date));
            const videoCount = playlist.videos ? playlist.videos.length : 0;
            
            return `
                <tr class="${isActive ? '' : 'table-warning'}">
                    <td>
                        <strong>${escapeHtml(playlist.title || 'Sin tÃ­tulo')}</strong>
                    </td>
                    <td>
                        <span class="text-muted">${escapeHtml(playlist.description || 'Sin descripciÃ³n')}</span>
                    </td>
                    <td>
                        <span class="badge bg-info">${videoCount} videos</span>
                    </td>
                    <td>
                        ${playlist.expiration_date ? 
                            `<small class="text-muted">${isExpired(playlist.expiration_date) ? 'ExpirÃ³' : 'Expira'}: ${formatDate(playlist.expiration_date)}</small>` : 
                            '<small class="text-muted">Sin expiraciÃ³n</small>'}
                    </td>
                    <td>
                        <span class="badge ${isActive ? 'bg-success' : 'bg-danger'}">
                            ${isActive ? 'Activa' : 'Inactiva'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="openPlaylistDetail(${playlist.id})">
                            <i class="fas fa-eye"></i> Ver Detalles
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        playlistsList.innerHTML = playlistsHTML;
        
    } catch (error) {
        console.error('Error al cargar playlists:', error);
        
        playlistsList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5">
                    <div class="alert alert-danger mb-0">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Error al cargar listas</strong><br>
                        ${error.message}
                    </div>
                </td>
            </tr>
        `;
        
        showToast(`Error al cargar listas: ${error.message}`, 'error');
    }
};

// ===== FUNCIONES PLACEHOLDER PARA PLAYLISTS =====
// (Las funciones completas de playlists estÃ¡n en el archivo original)

window.openPlaylistDetail = window.openPlaylistDetail || function(playlistId) {
    console.log('openPlaylistDetail placeholder - ID:', playlistId);
    showToast('FunciÃ³n de detalles de playlist no implementada', 'error');
};

window.createPlaylist = window.createPlaylist || function(playlistData) {
    console.log('createPlaylist placeholder');
    showToast('FunciÃ³n de crear playlist no implementada', 'error');
};

// ===== INICIALIZACIÃ“N MEJORADA =====

// ===== INICIALIZACIÃ“N MEJORADA =====

// FunciÃ³n para sobrescribir placeholders del template
function overridePlaceholderFunctions() {
    console.log('Sobrescribiendo funciones placeholder...');
    
    // Forzar sobrescritura de funciones placeholder de videos_v2.html
    window.filterVideos = function(searchTerm) {
        console.log('Aplicando filtro de bÃºsqueda:', searchTerm);
        videoPagination.searchTerm = (searchTerm || '').toLowerCase().trim();
        videoPagination.currentPage = 1;
        applyFiltersAndDisplayPage();
    };

    window.filterVideosByExpiration = function(filter) {
        console.log('Aplicando filtro de expiraciÃ³n:', filter);
        videoPagination.filter = filter || 'all';
        videoPagination.currentPage = 1;
        applyFiltersAndDisplayPage();
    };

    window.setVideoPageSize = function(pageSize) {
        console.log('Configurando tamaÃ±o de pÃ¡gina:', pageSize);
        videoPagination.pageSize = parseInt(pageSize) || 25;
        videoPagination.currentPage = 1;
        applyFiltersAndDisplayPage();
    };

    window.uploadVideo = uploadVideo;
    window.saveVideoChanges = saveVideoChanges;
    
    console.log('Funciones placeholder sobrescritas correctamente');
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('=== INICIALIZANDO APLICACIÃ“N ===');
    
    // Sobrescribir funciones placeholder PRIMERO
    overridePlaceholderFunctions();
    
    // Verificar Bootstrap
    if (!window.bootstrap) {
        console.error('Bootstrap no estÃ¡ disponible');
        showToast('Bootstrap no estÃ¡ cargado correctamente', 'error');
    }
    
    // Detectar pÃ¡gina actual
    const currentPath = window.location.pathname;
    console.log('PÃ¡gina actual:', currentPath);
    
    // Configurar segÃºn el tipo de pÃ¡gina
    if (currentPath.includes('/videos') || document.getElementById('videosList')) {
        console.log('Configurando pÃ¡gina de videos...');
        
        // Configurar formulario de subida
        const videoUploadForm = document.getElementById('videoUploadForm');
        if (videoUploadForm) {
            videoUploadForm.addEventListener('submit', function(e) {
                e.preventDefault();
                console.log('Procesando subida de video...');
                
                const formData = new FormData(this);
                
                // Validar campos requeridos
                const title = formData.get('title');
                const file = formData.get('file');
                
                if (!title || !title.trim()) {
                    showToast('El tÃ­tulo es obligatorio', 'error');
                    return;
                }
                
                if (!file || file.size === 0) {
                    showToast('Debe seleccionar un archivo de video', 'error');
                    return;
                }
                
                // Validar tamaÃ±o de archivo (ej: mÃ¡ximo 500MB)
                const maxSize = 500 * 1024 * 1024; // 500MB
                if (file.size > maxSize) {
                    showToast('El archivo es demasiado grande. MÃ¡ximo 500MB', 'error');
                    return;
                }
                
                uploadVideo(formData).catch(error => {
                    console.error('Error en subida:', error);
                });
            });
        }
        
        // Configurar botones de ediciÃ³n
        const saveVideoBtn = document.getElementById('saveVideoChangesBtn');
        if (saveVideoBtn) {
            saveVideoBtn.addEventListener('click', saveVideoChanges);
        }
        
        // Cargar videos y configurar listeners
        setTimeout(() => {
            loadVideos();
            setupVideoEventListeners();
        }, 200); // Aumentar delay para asegurar sobrescritura
        
    } else if (currentPath.includes('/playlists') || document.getElementById('playlistsList')) {
        console.log('Configurando pÃ¡gina de playlists...');
        
        // Cargar playlists
        setTimeout(() => {
            loadPlaylists();
        }, 100);
        
    } else if (document.querySelector('.nav-pills') || document.querySelector('[data-bs-toggle="tab"]')) {
        console.log('Configurando pÃ¡gina con pestaÃ±as...');
        
        // Configurar navegaciÃ³n por pestaÃ±as
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', function(e) {
                const target = e.target.getAttribute('data-bs-target') || e.target.getAttribute('href');
                console.log('PestaÃ±a activada:', target);
                
                if (target === '#videos') {
                    setTimeout(() => {
                        overridePlaceholderFunctions(); // Sobrescribir de nuevo
                        loadVideos();
                        setupVideoEventListeners();
                    }, 200);
                } else if (target === '#playlists') {
                    setTimeout(() => {
                        loadPlaylists();
                    }, 100);
                }
            });
        });
        
        // Cargar datos de la pestaÃ±a activa
        const activeTab = document.querySelector('.nav-link.active');
        if (activeTab) {
            const target = activeTab.getAttribute('data-bs-target') || activeTab.getAttribute('href');
            if (target === '#videos') {
                setTimeout(() => {
                    overridePlaceholderFunctions();
                    loadVideos();
                    setupVideoEventListeners();
                }, 200);
            } else if (target === '#playlists') {
                setTimeout(() => {
                    loadPlaylists();
                }, 100);
            }
        }
    }
    
    // Configurar formularios generales
    const playlistCreateForm = document.getElementById('playlistCreateForm');
    if (playlistCreateForm) {
        playlistCreateForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Creando playlist...');
            if (typeof createPlaylist === 'function') {
                createPlaylist();
            } else {
                showToast('FunciÃ³n de crear playlist no disponible', 'error');
            }
        });
    }
    
    console.log('=== APLICACIÃ“N INICIALIZADA ===');
});

// TambiÃ©n sobrescribir inmediatamente al cargar el script
setTimeout(overridePlaceholderFunctions, 100);

// ===== FUNCIÃ“N DE DIAGNÃ“STICO MEJORADA =====

window.debugVideoSystem = function() {
    console.log('=== DIAGNÃ“STICO DEL SISTEMA DE VIDEOS ===');
    console.log('API_URL:', API_URL);
    console.log('allVideos.length:', window.allVideos.length);
    console.log('videoPagination:', videoPagination);
    console.log('Elementos del DOM:');
    console.log('- videosList:', !!document.getElementById('videosList'));
    console.log('- videoSearchInput:', !!document.getElementById('videoSearchInput'));
    console.log('- videoFilterExpiration:', !!document.getElementById('videoFilterExpiration'));
    console.log('- videoUploadForm:', !!document.getElementById('videoUploadForm'));
    console.log('Funciones disponibles:');
    console.log('- loadVideos:', typeof window.loadVideos);
    console.log('- uploadVideo:', typeof window.uploadVideo);
    console.log('- downloadVideo:', typeof window.downloadVideo);
    console.log('- editVideo:', typeof window.editVideo);
    console.log('- deleteVideo:', typeof window.deleteVideo);
    console.log('- applyFiltersAndDisplayPage:', typeof window.applyFiltersAndDisplayPage);
    console.log('=== FIN DIAGNÃ“STICO ===');
};

window.diagnoseVideoSystem = async function() {
    console.log('=== EJECUTANDO DIAGNÃ“STICO COMPLETO ===');
    
    try {
        showToast('Ejecutando diagnÃ³stico del sistema...', 'info');
        
        const response = await fetch(`${API_URL}/videos/debug/diagnose`);
        if (!response.ok) {
            throw new Error(`Error en diagnÃ³stico: ${response.status} ${response.statusText}`);
        }
        
        const diagnosis = await response.json();
        console.log('DiagnÃ³stico completo:', diagnosis);
        
        // Mostrar resultados en consola
        console.log('ðŸ“Š RESULTADOS DEL DIAGNÃ“STICO:');
        console.log(`   Base de datos: ${diagnosis.database?.total_videos || 0} videos`);
        console.log(`   Directorio uploads: ${diagnosis.filesystem?.upload_dir_exists ? 'âœ…' : 'âŒ'}`);
        console.log(`   Archivos en uploads: ${diagnosis.filesystem?.files_count || 0}`);
        console.log(`   Videos sin ruta: ${diagnosis.videos?.without_path || 0}`);
        console.log(`   Archivos faltantes: ${diagnosis.videos?.missing_files || 0}`);
        console.log(`   Videos expirados: ${diagnosis.videos?.expired || 0}`);
        
        if (diagnosis.issues && diagnosis.issues.length > 0) {
            console.log('âŒ PROBLEMAS ENCONTRADOS:');
            diagnosis.issues.forEach(issue => console.log(`   - ${issue}`));
            
            const issuesList = diagnosis.issues.join('\n- ');
            showToast(`Problemas encontrados:\n- ${issuesList}`, 'error');
            
            // Preguntar si quiere intentar reparar
            if (confirm('Se encontraron problemas. Â¿Deseas intentar repararlos automÃ¡ticamente?')) {
                await repairVideoSystem();
            }
        } else {
            console.log('âœ… No se encontraron problemas');
            showToast('âœ… Sistema de videos en buen estado', 'success');
        }
        
        return diagnosis;
        
    } catch (error) {
        console.error('Error en diagnÃ³stico:', error);
        showToast(`Error en diagnÃ³stico: ${error.message}`, 'error');
        return null;
    }
};

window.repairVideoSystem = async function() {
    console.log('=== REPARANDO SISTEMA DE VIDEOS ===');
    
    try {
        showToast('Intentando reparar rutas de archivos...', 'info');
        
        const response = await fetch(`${API_URL}/videos/debug/fix-paths`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`Error en reparaciÃ³n: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Resultado de reparaciÃ³n:', result);
        
        if (result.fixed_count > 0) {
            console.log(`âœ… Se repararon ${result.fixed_count} rutas de archivo`);
            showToast(`âœ… Se repararon ${result.fixed_count} rutas de archivo`, 'success');
            
            // Recargar videos despuÃ©s de la reparaciÃ³n
            setTimeout(() => {
                loadVideos();
            }, 1000);
        } else {
            console.log('â„¹ï¸ No se encontraron rutas para reparar');
            showToast('â„¹ï¸ No se encontraron rutas para reparar', 'info');
        }
        
        return result;
        
    } catch (error) {
        console.error('Error en reparaciÃ³n:', error);
        showToast(`Error en reparaciÃ³n: ${error.message}`, 'error');
        return null;
    }
};

window.checkVideoInfo = async function(videoId) {
    console.log(`=== VERIFICANDO INFO DEL VIDEO ${videoId} ===`);
    
    try {
        const response = await fetch(`${API_URL}/videos/${videoId}/info`);
        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }
        
        const info = await response.json();
        console.log('InformaciÃ³n del video:', info);
        
        console.log(`ðŸ“‹ DETALLES DEL VIDEO ${videoId}:`);
        console.log(`   TÃ­tulo: ${info.title}`);
        console.log(`   Archivo: ${info.filename}`);
        console.log(`   Ruta: ${info.file_path}`);
        console.log(`   Existe: ${info.file_exists ? 'âœ…' : 'âŒ'}`);
        console.log(`   TamaÃ±o BD: ${info.file_size_db} bytes`);
        console.log(`   TamaÃ±o real: ${info.file_size_actual} bytes`);
        console.log(`   Expirado: ${info.is_expired ? 'âœ…' : 'âŒ'}`);
        
        if (!info.file_exists) {
            showToast(`âŒ Video ${videoId}: archivo no encontrado`, 'error');
        } else if (info.is_expired) {
            showToast(`â° Video ${videoId}: ha expirado`, 'error');
        } else {
            showToast(`âœ… Video ${videoId}: OK`, 'success');
        }
        
        return info;
        
    } catch (error) {
        console.error('Error al verificar video:', error);
        showToast(`Error al verificar video ${videoId}: ${error.message}`, 'error');
        return null;
    }
};

// Hacer funciones disponibles globalmente - FORZAR SOBRESCRITURA
window.loadVideos = loadVideos;
window.uploadVideo = uploadVideo;
window.downloadVideo = downloadVideo;
window.editVideo = editVideo;
window.saveVideoChanges = saveVideoChanges;
window.deleteVideo = deleteVideo;
window.loadPlaylists = loadPlaylists;
window.applyFiltersAndDisplayPage = applyFiltersAndDisplayPage;
window.displayCurrentPage = displayCurrentPage;
window.updatePaginationInfo = updatePaginationInfo;
window.updatePaginationButtons = updatePaginationButtons;

console.log('=== MAIN.JS V2.0 CARGADO COMPLETAMENTE ===');