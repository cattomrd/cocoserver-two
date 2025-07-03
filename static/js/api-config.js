/**
 * API-CONFIG.JS - Configuración Completa de API
 * 
 * Este archivo centraliza toda la configuración de endpoints de API
 * y proporciona funciones utilitarias para hacer peticiones seguras.
 * 
 * FUNCIONALIDADES:
 * - Configuración automática de URLs base
 * - Endpoints organizados por módulo
 * - Funciones de fetch seguras con retry
 * - Manejo de errores centralizado
 * - Detección de contexto HTTPS
 * - Interceptores de request/response
 * 
 * INSTRUCCIONES:
 * 1. Guarda este archivo como static/js/api-config.js
 * 2. Carga ANTES que cualquier otro script de la aplicación
 * 3. Se auto-configura según el entorno
 */

console.log('🔧 Cargando configuración de API...');

(function() {
    'use strict';

    // ==========================================
    // DETECCIÓN DE ENTORNO Y CONFIGURACIÓN BASE
    // ==========================================

    /**
     * Detectar entorno y configurar URLs base
     */
    function detectEnvironment() {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        const port = window.location.port;
        
        // Construir URL base
        let baseUrl = `${protocol}//${hostname}`;
        if (port && port !== '80' && port !== '443') {
            baseUrl += `:${port}`;
        }
        
        // Detectar tipo de entorno
        let environment = 'production';
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            environment = 'development';
        } else if (hostname.includes('test') || hostname.includes('staging')) {
            environment = 'staging';
        }
        
        return {
            baseUrl,
            apiUrl: `${baseUrl}/api`,
            environment,
            isSecure: protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1',
            hostname,
            protocol,
            port
        };
    }

    const ENV = detectEnvironment();
    console.log('🌐 Entorno detectado:', ENV);

    // ==========================================
    // CONFIGURACIÓN DE ENDPOINTS
    // ==========================================

    /**
     * Configuración centralizada de todos los endpoints de API
     */
    const API_ENDPOINTS = {
        // URLs base
        BASE_URL: ENV.baseUrl,
        API_URL: ENV.apiUrl,
        
        // Autenticación
        AUTH: {
            LOGIN: `${ENV.apiUrl}/auth/login`,
            LOGOUT: `${ENV.apiUrl}/auth/logout`,
            REFRESH: `${ENV.apiUrl}/auth/refresh`,
            USER: `${ENV.apiUrl}/auth/user`
        },
        
        // Videos
        VIDEOS: {
            LIST: `${ENV.apiUrl}/videos`,
            GET_BY_ID: (id) => `${ENV.apiUrl}/videos/${id}`,
            CREATE: `${ENV.apiUrl}/videos`,
            UPDATE: (id) => `${ENV.apiUrl}/videos/${id}`,
            DELETE: (id) => `${ENV.apiUrl}/videos/${id}`,
            UPLOAD: `${ENV.apiUrl}/videos/upload`,
            THUMBNAIL: (id) => `${ENV.apiUrl}/videos/${id}/thumbnail`,
            STREAM: (id) => `${ENV.apiUrl}/videos/${id}/stream`
        },
        
        // Playlists
        PLAYLISTS: {
            LIST: `${ENV.apiUrl}/playlists`,
            GET_BY_ID: (id) => `${ENV.apiUrl}/playlists/${id}`,
            CREATE: `${ENV.apiUrl}/playlists`,
            UPDATE: (id) => `${ENV.apiUrl}/playlists/${id}`,
            DELETE: (id) => `${ENV.apiUrl}/playlists/${id}`,
            
            // Videos en playlist
            VIDEOS: (playlistId) => `${ENV.apiUrl}/playlists/${playlistId}/videos`,
            ADD_VIDEO: (playlistId, videoId) => `${ENV.apiUrl}/playlists/${playlistId}/videos/${videoId}`,
            REMOVE_VIDEO: (playlistId, videoId) => `${ENV.apiUrl}/playlists/${playlistId}/videos/${videoId}`,
            UPDATE_ORDER: (playlistId) => `${ENV.apiUrl}/playlists/${playlistId}/video-order`,
            REORDER_VIDEOS: (playlistId) => `${ENV.apiUrl}/playlists/${playlistId}/reorder`,
            
            // Dispositivos de playlist
            DEVICES: (playlistId) => `${ENV.apiUrl}/playlists/${playlistId}/devices`,
            ASSIGN_DEVICE: (playlistId, deviceId) => `${ENV.apiUrl}/playlists/${playlistId}/devices/${deviceId}`,
            UNASSIGN_DEVICE: (playlistId, deviceId) => `${ENV.apiUrl}/playlists/${playlistId}/devices/${deviceId}`
        },
        
        // Dispositivos
        DEVICES: {
            LIST: `${ENV.apiUrl}/devices`,
            GET_BY_ID: (id) => `${ENV.apiUrl}/devices/${id}`,
            CREATE: `${ENV.apiUrl}/devices`,
            UPDATE: (id) => `${ENV.apiUrl}/devices/${id}`,
            DELETE: (id) => `${ENV.apiUrl}/devices/${id}`,
            
            // Estado del dispositivo
            STATUS: (id) => `${ENV.apiUrl}/devices/${id}/status`,
            PING: (id) => `${ENV.apiUrl}/devices/${id}/ping`,
            RESTART: (id) => `${ENV.apiUrl}/devices/${id}/restart`,
            
            // Playlists del dispositivo
            PLAYLISTS: (deviceId) => `${ENV.apiUrl}/devices/${deviceId}/playlists`
        },
        
        // Asignaciones dispositivo-playlist
        DEVICE_PLAYLISTS: {
            LIST: `${ENV.apiUrl}/device-playlists`,
            ASSIGN: `${ENV.apiUrl}/device-playlists`,
            UNASSIGN: (deviceId, playlistId) => `${ENV.apiUrl}/device-playlists/${deviceId}/${playlistId}`,
            BY_DEVICE: (deviceId) => `${ENV.apiUrl}/device-playlists/device/${deviceId}`,
            BY_PLAYLIST: (playlistId) => `${ENV.apiUrl}/device-playlists/playlist/${playlistId}`,
            PLAYLIST_DEVICES: (playlistId) => `${ENV.apiUrl}/device-playlists/playlist/${playlistId}/devices`,
            DEVICE_PLAYLISTS: (deviceId) => `${ENV.apiUrl}/device-playlists/device/${deviceId}/playlists`
        },
        
        // Archivos estáticos
        STATIC: {
            IMAGES: `${ENV.baseUrl}/static/images`,
            CSS: `${ENV.baseUrl}/static/css`,
            JS: `${ENV.baseUrl}/static/js`,
            UPLOADS: `${ENV.baseUrl}/static/uploads`,
            THUMBNAILS: `${ENV.baseUrl}/static/thumbnails`
        },
        
        // Diagnósticos y sistema
        SYSTEM: {
            HEALTH: `${ENV.apiUrl}/health`,
            DIAGNOSTICS: `${ENV.apiUrl}/diagnostics`,
            VERSION: `${ENV.apiUrl}/version`,
            STATS: `${ENV.apiUrl}/stats`
        }
    };

    // ==========================================
    // CONFIGURACIÓN DE FETCH SEGURO
    // ==========================================

    /**
     * Configuración por defecto para requests
     */
    const DEFAULT_FETCH_CONFIG = {
        timeout: 30000, // 30 segundos
        retries: 3,
        retryDelay: 1000, // 1 segundo
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(ENV.isSecure && {
                'X-Requested-With': 'XMLHttpRequest'
            })
        },
        credentials: 'same-origin'
    };

    /**
     * Realizar petición HTTP con reintentos y manejo de errores
     */
    async function secureFetch(url, options = {}) {
        const config = {
            ...DEFAULT_FETCH_CONFIG,
            ...options,
            headers: {
                ...DEFAULT_FETCH_CONFIG.headers,
                ...options.headers
            }
        };

        const { timeout, retries, retryDelay, ...fetchOptions } = config;

        console.log(`🔒 [API] ${fetchOptions.method || 'GET'} ${url}`);

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                // Crear promise con timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                // Log de respuesta
                console.log(`📡 [API] ${response.status} ${url}`);

                if (!response.ok) {
                    const errorData = await response.text();
                    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    
                    try {
                        const jsonError = JSON.parse(errorData);
                        errorMessage = jsonError.message || jsonError.detail || errorMessage;
                    } catch {
                        if (errorData) errorMessage = errorData;
                    }

                    throw new APIError(errorMessage, response.status, url);
                }

                return response;

            } catch (error) {
                console.warn(`⚠️ [API] Intento ${attempt + 1}/${retries + 1} falló:`, error.message);

                // Si es el último intento o no es un error de red, lanzar error
                if (attempt === retries || !isNetworkError(error)) {
                    throw error;
                }

                // Esperar antes del siguiente intento
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
                }
            }
        }
    }

    /**
     * Clase de error personalizada para API
     */
    class APIError extends Error {
        constructor(message, status, url) {
            super(message);
            this.name = 'APIError';
            this.status = status;
            this.url = url;
        }
    }

    /**
     * Verificar si un error es de red (reintentar)
     */
    function isNetworkError(error) {
        return error.name === 'TypeError' || 
               error.name === 'NetworkError' ||
               error.message.includes('fetch') ||
               error.message.includes('network') ||
               error.message.includes('Failed to fetch');
    }

    // ==========================================
    // FUNCIONES DE CONVENIENCIA
    // ==========================================

    /**
     * GET request simplificado
     */
    async function apiGet(endpoint, options = {}) {
        const response = await secureFetch(endpoint, {
            method: 'GET',
            ...options
        });
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }

    /**
     * POST request simplificado
     */
    async function apiPost(endpoint, data = null, options = {}) {
        const response = await secureFetch(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : null,
            ...options
        });
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }

    /**
     * PUT request simplificado
     */
    async function apiPut(endpoint, data = null, options = {}) {
        const response = await secureFetch(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : null,
            ...options
        });
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }

    /**
     * DELETE request simplificado
     */
    async function apiDelete(endpoint, options = {}) {
        const response = await secureFetch(endpoint, {
            method: 'DELETE',
            ...options
        });
        
        if (response.status === 204) {
            return true; // No content
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }

    /**
     * Upload de archivos
     */
    async function apiUpload(endpoint, file, additionalData = {}) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Agregar datos adicionales
        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });

        const response = await secureFetch(endpoint, {
            method: 'POST',
            body: formData,
            headers: {
                // No establecer Content-Type para FormData
                'Accept': 'application/json'
            }
        });

        return await response.json();
    }

    // ==========================================
    // INTERCEPTORES
    // ==========================================

    /**
     * Interceptor de request (se ejecuta antes de cada petición)
     */
    function addRequestInterceptor(interceptor) {
        if (typeof interceptor === 'function') {
            requestInterceptors.push(interceptor);
        }
    }

    /**
     * Interceptor de response (se ejecuta después de cada petición)
     */
    function addResponseInterceptor(interceptor) {
        if (typeof interceptor === 'function') {
            responseInterceptors.push(interceptor);
        }
    }

    const requestInterceptors = [];
    const responseInterceptors = [];

    // ==========================================
    // FUNCIONES DE UTILIDAD
    // ==========================================

    /**
     * Construir URL con parámetros de query
     */
    function buildUrl(baseUrl, params = {}) {
        const url = new URL(baseUrl);
        
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });
        
        return url.toString();
    }

    /**
     * Verificar si estamos en contexto seguro
     */
    function isSecureContext() {
        return ENV.isSecure;
    }

    /**
     * Obtener información del entorno
     */
    function getEnvironment() {
        return { ...ENV };
    }

    /**
     * Obtener URL base de la API
     */
    function getApiUrl() {
        return ENV.apiUrl;
    }

    /**
     * Obtener URL base del sitio
     */
    function getBaseUrl() {
        return ENV.baseUrl;
    }

    // ==========================================
    // CONFIGURACIÓN GLOBAL
    // ==========================================

    /**
     * Configurar timeout global
     */
    function setTimeout(newTimeout) {
        DEFAULT_FETCH_CONFIG.timeout = newTimeout;
    }

    /**
     * Configurar reintentos globales
     */
    function setRetries(newRetries) {
        DEFAULT_FETCH_CONFIG.retries = newRetries;
    }

    /**
     * Configurar headers globales
     */
    function setGlobalHeaders(headers) {
        Object.assign(DEFAULT_FETCH_CONFIG.headers, headers);
    }

    // ==========================================
    // EXPORTACIÓN GLOBAL
    // ==========================================

    // Crear objeto de configuración global
    window.API_CONFIG = API_ENDPOINTS;
    
    // Crear objeto de funciones de API
    window.API = {
        // Funciones básicas
        fetch: secureFetch,
        get: apiGet,
        post: apiPost,
        put: apiPut,
        delete: apiDelete,
        upload: apiUpload,
        
        // Utilidades
        buildUrl,
        isSecureContext,
        getEnvironment,
        getApiUrl,
        getBaseUrl,
        
        // Configuración
        setTimeout,
        setRetries,
        setGlobalHeaders,
        
        // Interceptores
        addRequestInterceptor,
        addResponseInterceptor,
        
        // Endpoints
        endpoints: API_ENDPOINTS,
        
        // Clases
        APIError
    };

    // Funciones de compatibilidad (para scripts existentes)
    window.secureFetch = secureFetch;
    window.isSecureContext = isSecureContext;
    window.getSecureBaseUrl = getBaseUrl;
    window.buildApiUrl = (endpoint) => `${ENV.apiUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

    // ==========================================
    // INICIALIZACIÓN
    // ==========================================

    // Interceptor por defecto para logging
    addResponseInterceptor((response, url) => {
        if (response.ok) {
            console.log(`✅ [API] ${response.status} ${url}`);
        } else {
            console.error(`❌ [API] ${response.status} ${url}`);
        }
    });

    // Interceptor para manejar errores de autenticación
    addResponseInterceptor((response, url) => {
        if (response.status === 401) {
            console.warn('🔐 [API] Token expirado o no válido');
            // Aquí podrías redirigir al login o renovar token
        }
    });

    console.log('✅ Configuración de API cargada correctamente');
    console.log('🔗 Endpoints disponibles:', Object.keys(API_ENDPOINTS));
    console.log('🌐 Entorno:', ENV.environment);
    console.log('🔒 Contexto seguro:', ENV.isSecure);

})();

// ==========================================
// EJEMPLO DE USO
// ==========================================

/*
// Usar la API en tu código:

// GET simple
const videos = await API.get(API_CONFIG.VIDEOS.LIST);

// POST con datos
const newPlaylist = await API.post(API_CONFIG.PLAYLISTS.CREATE, {
    title: 'Mi Nueva Lista',
    description: 'Descripción de la lista'
});

// PUT para actualizar
const updatedPlaylist = await API.put(API_CONFIG.PLAYLISTS.UPDATE(1), {
    title: 'Título Actualizado'
});

// DELETE
await API.delete(API_CONFIG.PLAYLISTS.DELETE(1));

// URL con parámetros
const videosUrl = API.buildUrl(API_CONFIG.VIDEOS.LIST, {
    limit: 50,
    search: 'mi video'
});
const videos = await API.get(videosUrl);

// Upload de archivo
const file = document.getElementById('fileInput').files[0];
const result = await API.upload(API_CONFIG.VIDEOS.UPLOAD, file, {
    title: 'Mi Video',
    description: 'Descripción del video'
});

// Manejo de errores
try {
    const data = await API.get('/endpoint-que-no-existe');
} catch (error) {
    if (error instanceof API.APIError) {
        console.error('Error de API:', error.status, error.message);
    } else {
        console.error('Error de red:', error.message);
    }
}
*/