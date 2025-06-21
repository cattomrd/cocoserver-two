/**
 * FUNCIONES COMUNES PARA SISTEMA DE PLAYLISTS
 * Archivo: static/js/playlist-common.js
 * Funciones reutilizables para playlist.html y edit-playlist.html
 */

// ==========================================
// CONSTANTES GLOBALES
// ==========================================

const PLAYLIST_CONFIG = {
    MAX_VIDEOS: 100,
    MAX_DURATION: 7200, // 2 horas en segundos
    AUTO_SAVE_INTERVAL: 30000, // 30 segundos
    DEBOUNCE_DELAY: 300,
    SUPPORTED_FORMATS: ['mp4', 'avi', 'mov', 'wmv', 'webm', 'mkv'],
    THUMBNAIL_SIZE: { width: 80, height: 60 },
    PAGE_SIZES: [12, 24, 48, 96],
    STATUSES: {
        active: { class: 'bg-success', text: 'Activa' },
        inactive: { class: 'bg-secondary', text: 'Inactiva' },
        expired: { class: 'bg-danger', text: 'Expirada' },
        scheduled: { class: 'bg-warning', text: 'Programada' }
    }
};

// ==========================================
// UTILIDADES GENERALES
// ==========================================

/**
 * Función debounce para optimizar llamadas a API
 */
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

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
 * Formatear duración en segundos a formato legible
 */
function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m`;
    if (hours === 0 && minutes === 0) result = `${secs}s`;
    
    return result.trim();
}

/**
 * Formatear fecha para mostrar
 */
function formatDate(dateString, options = {}) {
    if (!dateString) return 'No disponible';
    
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options
    };
    
    return new Date(dateString).toLocaleDateString('es-ES', defaultOptions);
}

/**
 * Formatear fecha y hora
 */
function formatDateTime(dateString) {
    return formatDate(dateString, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formatear fecha para input datetime-local
 */
function formatDateTimeLocal(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toISOString().slice(0, 16);
}

/**
 * Validar formato de archivo de video
 */
function isValidVideoFormat(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    return PLAYLIST_CONFIG.SUPPORTED_FORMATS.includes(extension);
}

/**
 * Obtener tamaño de archivo legible
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==========================================
// GESTIÓN DE ESTADO DE PLAYLIST
// ==========================================

/**
 * Determinar estado de una playlist
 */
function getPlaylistStatus(playlist) {
    if (!playlist) return 'inactive';
    
    const now = new Date();
    const startDate = playlist.start_date ? new Date(playlist.start_date) : null;
    const expirationDate = playlist.expiration_date ? new Date(playlist.expiration_date) : null;
    
    if (!playlist.is_active) return 'inactive';
    if (expirationDate && now > expirationDate) return 'expired';
    if (startDate && now < startDate) return 'scheduled';
    return 'active';
}

/**
 * Obtener badge HTML para estado
 */
function getStatusBadge(status) {
    const config = PLAYLIST_CONFIG.STATUSES[status] || PLAYLIST_CONFIG.STATUSES.inactive;
    return `<span class="badge ${config.class}">${config.text}</span>`;
}

/**
 * Validar datos de playlist
 */
function validatePlaylistData(playlistData) {
    const errors = [];
    
    if (!playlistData.title || playlistData.title.trim().length === 0) {
        errors.push('El título es obligatorio');
    }
    
    if (playlistData.title && playlistData.title.length > 255) {
        errors.push('El título no puede tener más de 255 caracteres');
    }
    
    if (playlistData.description && playlistData.description.length > 1000) {
        errors.push('La descripción no puede tener más de 1000 caracteres');
    }
    
    if (playlistData.start_date && playlistData.expiration_date) {
        const start = new Date(playlistData.start_date);
        const end = new Date(playlistData.expiration_date);
        if (start >= end) {
            errors.push('La fecha de expiración debe ser posterior a la fecha de inicio');
        }
    }
    
    return errors;
}

// ==========================================
// GESTIÓN DE TOASTS Y NOTIFICACIONES
// ==========================================

/**
 * Sistema unificado de notificaciones
 */
class PlaylistNotifications {
    constructor(containerId = 'toast-container') {
        this.container = this.getOrCreateContainer(containerId);
        this.toastCount = 0;
    }
    
    getOrCreateContainer(containerId) {
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }
        return container;
    }
    
    show(message, type = 'info', options = {}) {
        const toast = this.createToast(message, type, options);
        this.container.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast, {
            autohide: options.autohide !== false,
            delay: options.delay || 5000
        });
        
        bsToast.show();
        
        // Limpiar después de ocultar
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
        
        return bsToast;
    }
    
    createToast(message, type, options) {
        const toastId = `toast-${++this.toastCount}`;
        const iconClass = this.getIconClass(type);
        const headerClass = this.getHeaderClass(type);
        
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="toast-header ${headerClass}">
                <i class="${iconClass} me-2"></i>
                <strong class="me-auto">${options.title || 'Sistema'}</strong>
                <small class="text-muted">${options.time || 'ahora'}</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${escapeHtml(message)}
            </div>
        `;
        
        return toast;
    }
    
    getIconClass(type) {
        const icons = {
            success: 'fas fa-check-circle text-success',
            error: 'fas fa-exclamation-triangle text-danger',
            warning: 'fas fa-exclamation-circle text-warning',
            info: 'fas fa-info-circle text-primary',
            loading: 'fas fa-spinner fa-spin text-primary'
        };
        return icons[type] || icons.info;
    }
    
    getHeaderClass(type) {
        return type === 'error' ? 'bg-danger text-white' :
               type === 'success' ? 'bg-success text-white' :
               type === 'warning' ? 'bg-warning' : '';
    }
    
    // Métodos de conveniencia
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }
    
    error(message, options = {}) {
        return this.show(message, 'error', options);
    }
    
    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }
    
    info(message, options = {}) {
        return this.show(message, 'info', options);
    }
    
    loading(message, options = {}) {
        return this.show(message, 'loading', { autohide: false, ...options });
    }
}

// Instancia global
const notifications = new PlaylistNotifications();

// Función de conveniencia global
function showToast(message, type = 'info', options = {}) {
    return notifications.show(message, type, options);
}

// ==========================================
// GESTIÓN DE CARGA Y SPINNERS
// ==========================================

/**
 * Manager de estados de carga
 */
class LoadingManager {
    constructor() {
        this.loadingStates = new Map();
    }
    
    show(elementId, message = 'Cargando...') {
        const element = document.getElementById(elementId);
        if (!element) return false;
        
        // Guardar contenido original
        this.loadingStates.set(elementId, element.innerHTML);
        
        // Mostrar spinner
        element.innerHTML = `
            <div class="d-flex align-items-center justify-content-center py-4">
                <div class="spinner-border text-primary me-3" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
                <span class="text-muted">${escapeHtml(message)}</span>
            </div>
        `;
        
        return true;
    }
    
    hide(elementId, content = null) {
        const element = document.getElementById(elementId);
        if (!element) return false;
        
        if (content !== null) {
            element.innerHTML = content;
        } else {
            const originalContent = this.loadingStates.get(elementId);
            if (originalContent) {
                element.innerHTML = originalContent;
                this.loadingStates.delete(elementId);
            }
        }
        
        return true;
    }
    
    isLoading(elementId) {
        return this.loadingStates.has(elementId);
    }
}

// Instancia global
const loadingManager = new LoadingManager();

// Funciones de conveniencia
function showLoading(elementId, message) {
    return loadingManager.show(elementId, message);
}

function hideLoading(elementId, content) {
    return loadingManager.hide(elementId, content);
}

// ==========================================
// CLIENTE API PARA PLAYLISTS
// ==========================================

/**
 * Cliente API unificado para operaciones de playlist
 */
class PlaylistAPI {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: this.defaultHeaders,
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
            
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }
    
    // Métodos para playlists
    async getPlaylists(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = `/playlists${queryString ? `?${queryString}` : ''}`;
        return this.request(endpoint);
    }
    
    async getPlaylist(id) {
        return this.request(`/playlists/${id}`);
    }
    
    async getPlaylistDetail(id) {
        return this.request(`/playlists/${id}/detail`);
    }
    
    async getPlaylistForEdit(id) {
        return this.request(`/playlists/${id}/edit`);
    }
    
    async createPlaylist(data) {
        return this.request('/playlists', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    async updatePlaylist(id, data) {
        return this.request(`/playlists/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    async deletePlaylist(id) {
        return this.request(`/playlists/${id}`, {
            method: 'DELETE'
        });
    }
    
    async publishPlaylist(id) {
        return this.request(`/playlists/${id}/publish`, {
            method: 'POST'
        });
    }
    
    // Métodos para videos en playlists
    async addVideoToPlaylist(playlistId, videoId) {
        return this.request(`/playlists/${playlistId}/videos/${videoId}`, {
            method: 'POST'
        });
    }
    
    async removeVideoFromPlaylist(playlistId, videoId) {
        return this.request(`/playlists/${playlistId}/videos/${videoId}`, {
            method: 'DELETE'
        });
    }
    
    async updateVideoOrder(playlistId, videoOrder) {
        return this.request(`/playlists/${playlistId}/video-order`, {
            method: 'PUT',
            body: JSON.stringify({ videos: videoOrder })
        });
    }
    
    // Métodos para búsqueda de videos
    async searchVideos(query, limit = 20) {
        const params = new URLSearchParams({ q: query, limit });
        return this.request(`/playlists/videos/search?${params}`);
    }
    
    async uploadVideo(formData) {
        return this.request('/playlists/videos/upload', {
            method: 'POST',
            headers: {}, // Permitir que el navegador configure Content-Type para FormData
            body: formData
        });
    }
    
    async addVideoFromUrl(videoData) {
        return this.request('/playlists/videos/from-url', {
            method: 'POST',
            body: JSON.stringify(videoData)
        });
    }
    
    // Método para estadísticas
    async getStats() {
        return this.request('/playlists/stats');
    }
}

// Instancia global
const playlistAPI = new PlaylistAPI();

// ==========================================
// UTILIDADES DE VALIDACIÓN
// ==========================================

/**
 * Validador de formularios
 */
class FormValidator {
    constructor(formId) {
        this.form = document.getElementById(formId);
        this.errors = [];
    }
    
    validateRequired(fieldId, message = 'Este campo es obligatorio') {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            this.addError(fieldId, message);
            return false;
        }
        this.removeError(fieldId);
        return true;
    }
    
    validateMaxLength(fieldId, maxLength, message = null) {
        const field = document.getElementById(fieldId);
        if (field && field.value.length > maxLength) {
            this.addError(fieldId, message || `Máximo ${maxLength} caracteres`);
            return false;
        }
        this.removeError(fieldId);
        return true;
    }
    
    validateDateRange(startFieldId, endFieldId, message = 'La fecha de fin debe ser posterior a la de inicio') {
        const startField = document.getElementById(startFieldId);
        const endField = document.getElementById(endFieldId);
        
        if (startField && endField && startField.value && endField.value) {
            const startDate = new Date(startField.value);
            const endDate = new Date(endField.value);
            
            if (startDate >= endDate) {
                this.addError(endFieldId, message);
                return false;
            }
        }
        
        this.removeError(endFieldId);
        return true;
    }
    
    validateUrl(fieldId, message = 'URL no válida') {
        const field = document.getElementById(fieldId);
        if (field && field.value) {
            try {
                new URL(field.value);
                this.removeError(fieldId);
                return true;
            } catch {
                this.addError(fieldId, message);
                return false;
            }
        }
        return true;
    }
    
    addError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        // Remover error anterior
        this.removeError(fieldId);
        
        // Añadir clase de error
        field.classList.add('is-invalid');
        
        // Crear elemento de feedback
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        feedback.textContent = message;
        feedback.id = `${fieldId}-error`;
        
        // Insertar después del campo
        field.parentNode.insertBefore(feedback, field.nextSibling);
        
        this.errors.push({ fieldId, message });
    }
    
    removeError(fieldId) {
        const field = document.getElementById(fieldId);
        const errorElement = document.getElementById(`${fieldId}-error`);
        
        if (field) {
            field.classList.remove('is-invalid');
        }
        
        if (errorElement) {
            errorElement.remove();
        }
        
        this.errors = this.errors.filter(error => error.fieldId !== fieldId);
    }
    
    clearAllErrors() {
        this.errors.forEach(error => this.removeError(error.fieldId));
        this.errors = [];
    }
    
    isValid() {
        return this.errors.length === 0;
    }
    
    getErrors() {
        return [...this.errors];
    }
}

// ==========================================
// CONFIGURACIÓN DE EVENTOS GLOBALES
// ==========================================

/**
 * Configuración de eventos comunes del DOM
 */
document.addEventListener('DOMContentLoaded', function() {
    // Configurar tooltips de Bootstrap si están disponibles
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
    
    // Configurar confirmaciones automáticas
    document.addEventListener('click', function(e) {
        if (e.target.matches('[data-confirm]')) {
            const message = e.target.getAttribute('data-confirm');
            if (!confirm(message)) {
                e.preventDefault();
                return false;
            }
        }
    });
    
    // Auto-formato de campos de duración
    document.addEventListener('input', function(e) {
        if (e.target.matches('[data-format="duration"]')) {
            const value = parseInt(e.target.value);
            if (!isNaN(value)) {
                const formatted = formatDuration(value);
                const display = e.target.nextElementSibling;
                if (display && display.classList.contains('duration-display')) {
                    display.textContent = formatted;
                }
            }
        }
    });
});

// ==========================================
// EXPORTAR PARA USO GLOBAL
// ==========================================

// Hacer disponibles las clases y funciones globalmente
window.PlaylistNotifications = PlaylistNotifications;
window.LoadingManager = LoadingManager;
window.PlaylistAPI = PlaylistAPI;
window.FormValidator = FormValidator;

// Instancias globales
window.notifications = notifications;
window.loadingManager = loadingManager;
window.playlistAPI = playlistAPI;

// Funciones de utilidad globales
window.formatDuration = formatDuration;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatDateTimeLocal = formatDateTimeLocal;
window.formatFileSize = formatFileSize;
window.escapeHtml = escapeHtml;
window.debounce = debounce;
window.getPlaylistStatus = getPlaylistStatus;
window.getStatusBadge = getStatusBadge;
window.validatePlaylistData = validatePlaylistData;
window.isValidVideoFormat = isValidVideoFormat;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;

// Configuración global
window.PLAYLIST_CONFIG = PLAYLIST_CONFIG;

console.log('🎵 Playlist Common JS cargado correctamente');