/**
 * FUNCIÓN getPlaylistId ROBUSTA - MANEJA ERRORES DE JSON MALFORMADO
 * 
 * Esta función reemplaza todas las implementaciones existentes de getPlaylistId
 * y maneja de forma segura el JSON malformado que está causando el error.
 * 
 * INSTRUCCIONES DE USO:
 * 1. Agregar este código al inicio de playlist_detail.js
 * 2. Reemplazar cualquier otra función getPlaylistId existente
 * 3. Asegurarse de que se carga antes que assigned-devices-manager.js
 */

/**
 * Obtener ID de playlist de manera robusta con múltiples fallbacks
 */
function getPlaylistId() {
    console.log('🔍 [getPlaylistId] Iniciando búsqueda de ID de playlist...');
    
    try {
        // ==========================================
        // MÉTODO 1: OBTENER DE LA URL (MÁS CONFIABLE)
        // ==========================================
        const urlParams = new URLSearchParams(window.location.search);
        const idFromUrl = urlParams.get('id');
        
        if (idFromUrl) {
            const parsedId = parseInt(idFromUrl);
            if (!isNaN(parsedId) && parsedId > 0) {
                console.log(`✅ [getPlaylistId] ID obtenido de URL: ${parsedId}`);
                return parsedId;
            }
        }
        
        // ==========================================
        // MÉTODO 2: EXTRAER DEL PATH DE LA URL
        // ==========================================
        const pathMatch = window.location.pathname.match(/\/playlists?\/(\d+)/);
        if (pathMatch && pathMatch[1]) {
            const parsedId = parseInt(pathMatch[1]);
            if (!isNaN(parsedId) && parsedId > 0) {
                console.log(`✅ [getPlaylistId] ID obtenido del path: ${parsedId}`);
                return parsedId;
            }
        }
        
        // ==========================================
        // MÉTODO 3: ELEMENTO HIDDEN INPUT
        // ==========================================
        const idElement = document.getElementById('playlist-id');
        if (idElement && idElement.value) {
            const parsedId = parseInt(idElement.value);
            if (!isNaN(parsedId) && parsedId > 0) {
                console.log(`✅ [getPlaylistId] ID obtenido de elemento hidden: ${parsedId}`);
                return parsedId;
            }
        }
        
        // ==========================================
        // MÉTODO 4: VARIABLES GLOBALES
        // ==========================================
        if (window.currentPlaylistId) {
            const parsedId = parseInt(window.currentPlaylistId);
            if (!isNaN(parsedId) && parsedId > 0) {
                console.log(`✅ [getPlaylistId] ID obtenido de variable global: ${parsedId}`);
                return parsedId;
            }
        }
        
        if (window.currentPlaylistData && window.currentPlaylistData.id) {
            const parsedId = parseInt(window.currentPlaylistData.id);
            if (!isNaN(parsedId) && parsedId > 0) {
                console.log(`✅ [getPlaylistId] ID obtenido de datos globales: ${parsedId}`);
                return parsedId;
            }
        }
        
        // ==========================================
        // MÉTODO 5: PARSEAR JSON DE MANERA SEGURA
        // ==========================================
        const playlistElement = document.getElementById('playlist-data');
        if (playlistElement && playlistElement.textContent) {
            try {
                console.log('🔍 [getPlaylistId] Intentando parsear JSON...');
                
                // Limpiar el JSON antes de parsearlo
                let jsonText = playlistElement.textContent.trim();
                
                // Detectar y corregir el error específico: "field": ,
                console.log('🔧 [getPlaylistId] Corrigiendo JSON malformado...');
                
                // Patrón para encontrar campos con comas sin valor
                const malformedPattern = /"([^"]+)":\s*,/g;
                let correctedJson = jsonText;
                let corrections = 0;
                
                // Reemplazar campos malformados con null
                correctedJson = correctedJson.replace(malformedPattern, (match, fieldName) => {
                    corrections++;
                    console.log(`🔧 [getPlaylistId] Corrigiendo campo malformado: "${fieldName}": , -> "${fieldName}": null`);
                    return `"${fieldName}": null,`;
                });
                
                // Otros patrones comunes de JSON malformado
                correctedJson = correctedJson
                    .replace(/,\s*}/g, '}')  // Eliminar comas antes de cierre
                    .replace(/,\s*]/g, ']')  // Eliminar comas antes de cierre de array
                    .replace(/:\s*,/g, ': null,');  // Campos sin valor
                
                if (corrections > 0) {
                    console.log(`🔧 [getPlaylistId] JSON corregido con ${corrections} correcciones`);
                }
                
                // Intentar parsear el JSON corregido
                const templateData = JSON.parse(correctedJson);
                
                if (templateData && templateData.id) {
                    const parsedId = parseInt(templateData.id);
                    if (!isNaN(parsedId) && parsedId > 0) {
                        console.log(`✅ [getPlaylistId] ID obtenido de JSON corregido: ${parsedId}`);
                        
                        // Guardar los datos corregidos para uso futuro
                        window.currentPlaylistData = templateData;
                        if (templateData.videos) {
                            window.playlistVideos = templateData.videos;
                        }
                        
                        return parsedId;
                    }
                }
                
            } catch (jsonError) {
                console.warn('⚠️ [getPlaylistId] Error parseando JSON incluso después de correcciones:', jsonError.message);
                
                // Intentar extraer ID del JSON malformado usando regex como último recurso
                try {
                    console.log('🔍 [getPlaylistId] Intentando extraer ID con regex...');
                    const idMatch = playlistElement.textContent.match(/"id":\s*(\d+)/);
                    if (idMatch && idMatch[1]) {
                        const parsedId = parseInt(idMatch[1]);
                        if (!isNaN(parsedId) && parsedId > 0) {
                            console.log(`✅ [getPlaylistId] ID extraído con regex: ${parsedId}`);
                            return parsedId;
                        }
                    }
                } catch (regexError) {
                    console.warn('⚠️ [getPlaylistId] Error extrayendo ID con regex:', regexError.message);
                }
            }
        }
        
        // ==========================================
        // MÉTODO 6: META TAGS (SI EXISTEN)
        // ==========================================
        const metaPlaylistId = document.querySelector('meta[name="playlist-id"]');
        if (metaPlaylistId && metaPlaylistId.content) {
            const parsedId = parseInt(metaPlaylistId.content);
            if (!isNaN(parsedId) && parsedId > 0) {
                console.log(`✅ [getPlaylistId] ID obtenido de meta tag: ${parsedId}`);
                return parsedId;
            }
        }
        
        // ==========================================
        // MÉTODO 7: DATA ATTRIBUTES
        // ==========================================
        const bodyElement = document.body;
        if (bodyElement && bodyElement.dataset.playlistId) {
            const parsedId = parseInt(bodyElement.dataset.playlistId);
            if (!isNaN(parsedId) && parsedId > 0) {
                console.log(`✅ [getPlaylistId] ID obtenido de data attribute: ${parsedId}`);
                return parsedId;
            }
        }
        
        // ==========================================
        // NO SE ENCONTRÓ ID
        // ==========================================
        console.error('❌ [getPlaylistId] No se pudo obtener ID de playlist desde ninguna fuente');
        console.log('🔍 [getPlaylistId] Fuentes verificadas: URL, path, elemento hidden, variables globales, JSON, meta tags, data attributes');
        
        return null;
        
    } catch (error) {
        console.error('❌ [getPlaylistId] Error general en función:', error);
        return null;
    }
}

/**
 * Función auxiliar para corregir JSON malformado
 */
function fixMalformedJson(jsonString) {
    if (!jsonString) return jsonString;
    
    try {
        console.log('🔧 [fixMalformedJson] Iniciando corrección de JSON...');
        
        let fixed = jsonString.trim();
        let corrections = 0;
        
        // Lista de correcciones comunes para JSON malformado
        const fixes = [
            // Corregir campos con comas sin valor: "field": ,
            {
                pattern: /"([^"]+)":\s*,/g,
                replacement: '"$1": null,',
                description: 'Campos con valor vacío'
            },
            // Corregir múltiples comas: ,,
            {
                pattern: /,+/g,
                replacement: ',',
                description: 'Múltiples comas consecutivas'
            },
            // Corregir comas antes de cierre de objeto
            {
                pattern: /,(\s*})/g,
                replacement: '$1',
                description: 'Comas antes de cierre de objeto'
            },
            // Corregir comas antes de cierre de array
            {
                pattern: /,(\s*])/g,
                replacement: '$1',
                description: 'Comas antes de cierre de array'
            },
            // Corregir valores undefined
            {
                pattern: /:\s*undefined/g,
                replacement: ': null',
                description: 'Valores undefined'
            },
            // Corregir comillas simples (JSON requiere comillas dobles)
            {
                pattern: /'([^']*)'/g,
                replacement: '"$1"',
                description: 'Comillas simples'
            }
        ];
        
        // Aplicar cada corrección
        fixes.forEach(fix => {
            const matches = fixed.match(fix.pattern);
            if (matches) {
                corrections += matches.length;
                fixed = fixed.replace(fix.pattern, fix.replacement);
                console.log(`🔧 [fixMalformedJson] Corregido: ${fix.description} (${matches.length} instancias)`);
            }
        });
        
        if (corrections > 0) {
            console.log(`✅ [fixMalformedJson] JSON corregido con ${corrections} correcciones total`);
        } else {
            console.log('✅ [fixMalformedJson] JSON no necesitaba correcciones');
        }
        
        return fixed;
        
    } catch (error) {
        console.error('❌ [fixMalformedJson] Error corrigiendo JSON:', error);
        return jsonString; // Devolver original si falla la corrección
    }
}

/**
 * Función para verificar si el ID obtenido es válido
 */
function isValidPlaylistId(id) {
    if (id === null || id === undefined) return false;
    
    const numericId = parseInt(id);
    return !isNaN(numericId) && numericId > 0;
}

/**
 * Función para debuggear problemas con getPlaylistId
 */
function debugPlaylistId() {
    console.log('🔍 [DEBUG] Información de debugging para getPlaylistId:');
    
    // URL actual
    console.log('📄 URL actual:', window.location.href);
    console.log('📄 Search params:', window.location.search);
    console.log('📄 Pathname:', window.location.pathname);
    
    // Elementos DOM
    const idElement = document.getElementById('playlist-id');
    const dataElement = document.getElementById('playlist-data');
    
    console.log('🏷️ Elemento playlist-id:', idElement ? idElement.value : 'No encontrado');
    console.log('📊 Elemento playlist-data:', dataElement ? 'Encontrado' : 'No encontrado');
    
    if (dataElement) {
        console.log('📊 Contenido playlist-data (primeros 200 chars):', 
            dataElement.textContent ? dataElement.textContent.substring(0, 200) + '...' : 'Vacío');
    }
    
    // Variables globales
    console.log('🌐 window.currentPlaylistId:', window.currentPlaylistId);
    console.log('🌐 window.currentPlaylistData:', window.currentPlaylistData ? 'Presente' : 'No presente');
    
    // Resultado de getPlaylistId
    const result = getPlaylistId();
    console.log('🎯 Resultado de getPlaylistId():', result);
    
    return result;
}

/**
 * Versión síncrona que cachea el resultado
 */
let cachedPlaylistId = null;
let cacheTime = 0;
const CACHE_DURATION = 30000; // 30 segundos

function getPlaylistIdCached() {
    const now = Date.now();
    
    // Si tenemos cache válido, usarlo
    if (cachedPlaylistId && (now - cacheTime) < CACHE_DURATION) {
        console.log(`🎯 [getPlaylistId] Usando ID cachado: ${cachedPlaylistId}`);
        return cachedPlaylistId;
    }
    
    // Obtener nuevo ID y cachearlo
    const id = getPlaylistId();
    if (id) {
        cachedPlaylistId = id;
        cacheTime = now;
        console.log(`💾 [getPlaylistId] ID cacheado: ${id}`);
    }
    
    return id;
}

// ==========================================
// EXPORTAR FUNCIONES
// ==========================================

// Hacer funciones disponibles globalmente
window.getPlaylistId = getPlaylistId;
window.getPlaylistIdCached = getPlaylistIdCached;
window.fixMalformedJson = fixMalformedJson;
window.debugPlaylistId = debugPlaylistId;
window.isValidPlaylistId = isValidPlaylistId;

// Para compatibilidad, también exportar como playlistId
window.playlistId = getPlaylistId;

console.log('✅ [getPlaylistId] Función robusta cargada correctamente');

// Auto-ejecutar para diagnosticar problemas inmediatamente
console.log('🔍 [getPlaylistId] Ejecutando diagnóstico automático...');
const initialId = getPlaylistId();
if (initialId) {
    console.log(`🎯 [getPlaylistId] ID inicial detectado: ${initialId}`);
} else {
    console.warn('⚠️ [getPlaylistId] No se pudo detectar ID inicial - revisa debugPlaylistId()');
}