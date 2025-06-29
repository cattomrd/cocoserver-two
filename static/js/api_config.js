/**
 * API-CONFIG.JS - Configuración Global de API
 * Ubicación: static/js/api-config.js
 * 
 * IMPORTANTE: Este archivo debe cargarse ANTES que cualquier otro script
 */

(function() {
    'use strict';
    
    console.log('🔧 Inicializando configuración global de API...');
    
    // ==========================================
    // CONFIGURACIÓN DE API SEGURA
    // ==========================================
    
    function createSecureApiConfig() {
        const protocol = window.location.protocol;
        const host = window.location.host;
        const apiUrl = `${protocol}//${host}/api`;
        
        window.API_CONFIG = {
            BASE_URL: apiUrl,
            VIDEOS: { 
                LIST: `${apiUrl}/videos`,
                STREAM: (id) => `${apiUrl}/videos/${id}/stream`,
                GET_BY_ID: (id) => `${apiUrl}/videos/${id}`,
                DELETE: (id) => `${apiUrl}/videos/${id}`
            },
            PLAYLISTS: {
                LIST: `${apiUrl}/playlists`,
                GET_BY_ID: (id) => `${apiUrl}/playlists/${id}`,
                UPDATE: (id) => `${apiUrl}/playlists/${id}`,
                DELETE: (id) => `${apiUrl}/playlists/${id}`,
                ADD_VIDEO: (playlistId, videoId) => `${apiUrl}/playlists/${playlistId}/videos/${videoId}`,
                REMOVE_VIDEO: (playlistId, videoId) => `${apiUrl}/playlists/${playlistId}/videos/${videoId}`,
                CLEAR_VIDEOS: (playlistId) => `${apiUrl}/playlists/${playlistId}/videos/clear`
            },
            DEVICES: {
                LIST: `${apiUrl}/devices`,
                GET_BY_ID: (id) => `${apiUrl}/devices/${id}`
            },
            DEVICE_PLAYLISTS: {
                LIST: `${apiUrl}/device-playlists`,
                BY_PLAYLIST: (id) => `${apiUrl}/device-playlists?playlist_id=${id}`,
                CREATE: `${apiUrl}/device-playlists`,
                DELETE: (id) => `${apiUrl}/device-playlists/${id}`
            }
        };
        
        console.log('✅ API_CONFIG creado:', window.API_CONFIG.BASE_URL);
    }
    
    // ==========================================
    // SAFE FETCH ANTI-MIXED CONTENT
    // ==========================================
    
    function createSafeFetch() {
        window.safeFetch = function(url, options = {}) {
            // Convertir HTTP a HTTPS si es necesario
            if (window.location.protocol === 'https:' && url.startsWith('http://')) {
                url = url.replace('http://', 'https://');
                console.log('🔄 URL convertida a HTTPS:', url);
            }
            
            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            };
            
            return fetch(url, defaultOptions);
        };
        
        console.log('✅ safeFetch creado');
    }
    
    // ==========================================
    // FUNCIONES UTILITARIAS GLOBALES
    // ==========================================
    
    window.formatDuration = function(seconds) {
        if (!seconds || seconds === 0) return '0:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    };
    
    window.escapeHtml = function(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    };
    
    window.showToast = function(message, type = 'info', duration = 3000) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'position-fixed top-0 end-0 p-3';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }
        
        const toastId = 'toast-' + Date.now();
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-triangle',
            warning: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle'
        };
        
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast show align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0 mb-2`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="${iconMap[type] || iconMap.info} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="closeToast('${toastId}')"></button>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => window.closeToast(toastId), duration);
    };
    
    window.closeToast = function(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.remove();
        }
    };
    
    // ==========================================
    // FUNCIÓN PRINCIPAL: getPlaylistId
    // ==========================================
    
    window.getPlaylistId = function() {
        // Método 1: URL params
        const urlParams = new URLSearchParams(window.location.search);
        const idFromUrl = urlParams.get('id');
        
        // Método 2: Elemento oculto
        const idElement = document.getElementById('playlist-id');
        const idFromElement = idElement ? idElement.value : null;
        
        // Método 3: Datos JSON
        try {
            const playlistElement = document.getElementById('playlist-data');
            if (playlistElement && playlistElement.textContent) {
                const data = JSON.parse(playlistElement.textContent);
                const idFromData = data.id;
                
                if (idFromData) {
                    return idFromData;
                }
            }
        } catch (error) {
            console.warn('No se pudieron leer datos JSON de playlist');
        }
        
        // Método 4: Variable global
        const idFromGlobal = window.currentPlaylistId;
        
        const playlistId = idFromUrl || idFromElement || idFromGlobal;
        
        if (!playlistId) {
            console.error('❌ No se pudo determinar el ID de la playlist');
        } else {
            console.log('📌 ID de playlist encontrado:', playlistId);
        }
        
        return playlistId;
    };
    
    // ==========================================
    // INICIALIZACIÓN
    // ==========================================
    
    // Crear configuración API
    createSecureApiConfig();
    
    // Crear safeFetch
    createSafeFetch();
    
    // Inicializar variables globales
    window.availableVideos = window.availableVideos || [];
    window.playlistVideos = window.playlistVideos || [];
    window.currentPlaylistData = window.currentPlaylistData || null;
    window.hasChanges = window.hasChanges || false;
    window.isLoading = window.isLoading || false;
    window.assignedDevices = window.assignedDevices || [];
    
    console.log('✅ Configuración global de API inicializada');
    
})();