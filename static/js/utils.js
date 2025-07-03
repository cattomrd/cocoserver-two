/**
 * UTILS.JS - Funciones de Utilidad Compartidas
 * 
 * Este archivo contiene funciones de utilidad reutilizables que se usan
 * en múltiples partes de la aplicación. Incluye formateo, validación,
 * manipulación de DOM, y funciones auxiliares.
 * 
 * FUNCIONALIDADES:
 * - Formateo de datos (fechas, tamaños, duración)
 * - Validación de inputs
 * - Manipulación de DOM
 * - Manejo de errores
 * - Toast notifications
 * - Utilidades de arrastrar y soltar
 * - Funciones de texto y strings
 * 
 * INSTRUCCIONES:
 * 1. Guarda este archivo como static/js/utils.js
 * 2. Carga después de api-config.js
 * 3. Se puede usar en cualquier parte de la aplicación
 */

console.log('🛠️ Cargando utilidades compartidas...');

(function() {
    'use strict';

    // ==========================================
    // FORMATEO DE DATOS
    // ==========================================

    /**
     * Formatear duración en segundos a formato legible
     */
    function formatDuration(seconds, options = {}) {
        const { 
            showSeconds = true, 
            shortFormat = false,
            showZero = false 
        } = options;
        
        if (!seconds || isNaN(seconds)) {
            return showZero ? '0s' : 'N/A';
        }
        
        const totalSeconds = Math.floor(seconds);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const remainingSeconds = totalSeconds % 60;
        
        const parts = [];
        
        if (hours > 0) {
            parts.push(`${hours}${shortFormat ? 'h' : ' hora'}${hours !== 1 && !shortFormat ? 's' : ''}`);
        }
        
        if (minutes > 0 || (hours > 0 && remainingSeconds > 0)) {
            parts.push(`${minutes}${shortFormat ? 'm' : ' minuto'}${minutes !== 1 && !shortFormat ? 's' : ''}`);
        }
        
        if (showSeconds && (remainingSeconds > 0 || (hours === 0 && minutes === 0))) {
            parts.push(`${remainingSeconds}${shortFormat ? 's' : ' segundo'}${remainingSeconds !== 1 && !shortFormat ? 's' : ''}`);
        }
        
        return parts.join(' ') || (showZero ? '0s' : 'N/A');
    }

    /**
     * Formatear tamaño de archivo en bytes a formato legible
     */
    function formatFileSize(bytes, decimals = 1) {
        if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
    }

    /**
     * Formatear fecha de manera inteligente
     */
    function formatDate(dateInput, options = {}) {
        const {
            includeTime = true,
            relative = true,
            format = 'smart'
        } = options;
        
        if (!dateInput) return 'N/A';
        
        try {
            const date = new Date(dateInput);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
            const diffMinutes = Math.floor(diffTime / (1000 * 60));
            
            // Formato relativo para fechas recientes
            if (relative && format === 'smart') {
                if (diffMinutes < 1) {
                    return 'Ahora mismo';
                } else if (diffMinutes < 60) {
                    return `Hace ${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
                } else if (diffHours < 24) {
                    return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
                } else if (diffDays === 1) {
                    return includeTime ? 
                        `Ayer a las ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` :
                        'Ayer';
                } else if (diffDays < 7) {
                    return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
                }
            }
            
            // Formato estándar
            const dateOptions = {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            };
            
            if (includeTime) {
                dateOptions.hour = '2-digit';
                dateOptions.minute = '2-digit';
            }
            
            return date.toLocaleDateString('es-ES', dateOptions);
            
        } catch (error) {
            console.warn('Error formateando fecha:', error);
            return 'Fecha inválida';
        }
    }

    /**
     * Formatear número con separadores de miles
     */
    function formatNumber(number, options = {}) {
        const { decimals = 0, locale = 'es-ES', currency = null } = options;
        
        if (isNaN(number)) return 'N/A';
        
        const formatOptions = {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        };
        
        if (currency) {
            formatOptions.style = 'currency';
            formatOptions.currency = currency;
        }
        
        return new Intl.NumberFormat(locale, formatOptions).format(number);
    }

    // ==========================================
    // VALIDACIÓN DE DATOS
    // ==========================================

    /**
     * Validar email
     */
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validar URL
     */
    function isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validar que un string no esté vacío
     */
    function isNotEmpty(value) {
        return value && typeof value === 'string' && value.trim().length > 0;
    }

    /**
     * Validar número en rango
     */
    function isInRange(number, min, max) {
        return !isNaN(number) && number >= min && number <= max;
    }

    /**
     * Sanitizar HTML básico
     */
    function sanitizeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    // ==========================================
    // MANIPULACIÓN DE DOM
    // ==========================================

    /**
     * Crear elemento DOM con atributos y contenido
     */
    function createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        Object.keys(attributes).forEach(key => {
            if (key === 'className') {
                element.className = attributes[key];
            } else if (key === 'innerHTML') {
                element.innerHTML = attributes[key];
            } else if (key === 'textContent') {
                element.textContent = attributes[key];
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });
        
        if (content) {
            element.innerHTML = content;
        }
        
        return element;
    }

    /**
     * Mostrar/ocultar elemento
     */
    function toggleElement(element, show) {
        if (!element) return;
        
        if (typeof show === 'boolean') {
            element.style.display = show ? '' : 'none';
        } else {
            element.style.display = element.style.display === 'none' ? '' : 'none';
        }
    }

    /**
     * Agregar clase con animación
     */
    function addClassWithAnimation(element, className, duration = 300) {
        if (!element) return;
        
        element.classList.add(className);
        
        if (duration > 0) {
            setTimeout(() => {
                element.classList.remove(className);
            }, duration);
        }
    }

    /**
     * Scroll suave a elemento
     */
    function scrollToElement(element, options = {}) {
        if (!element) return;
        
        const { offset = 0, behavior = 'smooth' } = options;
        
        const elementPosition = element.offsetTop + offset;
        
        window.scrollTo({
            top: elementPosition,
            behavior
        });
    }

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================

    /**
     * Sistema de toast notifications mejorado
     */
    function showToast(message, type = 'info', options = {}) {
        const {
            duration = 5000,
            position = 'top-right',
            closable = true,
            icon = null
        } = options;
        
        // Crear contenedor si no existe
        let container = document.getElementById('toast-container');
        if (!container) {
            container = createElement('div', {
                id: 'toast-container',
                className: `toast-container position-fixed ${position}`,
                style: 'z-index: 9999; pointer-events: none;'
            });
            document.body.appendChild(container);
        }
        
        // Mapear tipos a clases de Bootstrap
        const typeMap = {
            success: 'bg-success',
            error: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-info',
            primary: 'bg-primary',
            secondary: 'bg-secondary'
        };
        
        // Mapear tipos a iconos
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-triangle',
            warning: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle',
            primary: 'fas fa-bell',
            secondary: 'fas fa-comment'
        };
        
        const alertClass = typeMap[type] || typeMap.info;
        const toastIcon = icon || iconMap[type] || iconMap.info;
        
        // Crear toast
        const toast = createElement('div', {
            className: `toast align-items-center text-white ${alertClass} border-0 mb-2`,
            style: 'pointer-events: auto;',
            role: 'alert'
        });
        
        const toastContent = `
            <div class="d-flex">
                <div class="toast-body d-flex align-items-center">
                    <i class="${toastIcon} me-2"></i>
                    ${sanitizeHtml(message)}
                </div>
                ${closable ? `
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                            aria-label="Close" onclick="this.parentElement.parentElement.remove()">
                    </button>
                ` : ''}
            </div>
        `;
        
        toast.innerHTML = toastContent;
        
        // Agregar animación de entrada
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease-in-out';
        
        container.appendChild(toast);
        
        // Animar entrada
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        // Auto-remover
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    // Animar salida
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(100%)';
                    
                    setTimeout(() => {
                        if (toast.parentElement) {
                            toast.remove();
                        }
                    }, 300);
                }
            }, duration);
        }
        
        return toast;
    }

    // ==========================================
    // UTILIDADES DE ARRASTRAR Y SOLTAR
    // ==========================================

    /**
     * Configurar drag and drop en elementos
     */
    function setupDragAndDrop(container, options = {}) {
        const {
            dragSelector = '.draggable',
            onDragStart = null,
            onDragEnd = null,
            onDrop = null,
            placeholder = null
        } = options;
        
        let draggedElement = null;
        let placeholderElement = null;
        
        // Configurar elementos arrastrables
        function setupDraggableElements() {
            const draggables = container.querySelectorAll(dragSelector);
            
            draggables.forEach(element => {
                element.draggable = true;
                
                element.addEventListener('dragstart', (e) => {
                    draggedElement = element;
                    element.classList.add('dragging');
                    
                    if (placeholder) {
                        placeholderElement = createElement('div', {
                            className: 'drag-placeholder',
                            style: 'height: 2px; background: #007bff; margin: 4px 0;'
                        });
                    }
                    
                    if (onDragStart) onDragStart(element, e);
                });
                
                element.addEventListener('dragend', (e) => {
                    element.classList.remove('dragging');
                    
                    if (placeholderElement && placeholderElement.parentElement) {
                        placeholderElement.remove();
                    }
                    
                    draggedElement = null;
                    placeholderElement = null;
                    
                    if (onDragEnd) onDragEnd(element, e);
                });
            });
        }
        
        // Configurar zona de drop
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            const afterElement = getDragAfterElement(container, e.clientY);
            
            if (placeholderElement) {
                if (afterElement == null) {
                    container.appendChild(placeholderElement);
                } else {
                    container.insertBefore(placeholderElement, afterElement);
                }
            }
        });
        
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (draggedElement) {
                const afterElement = getDragAfterElement(container, e.clientY);
                
                if (afterElement == null) {
                    container.appendChild(draggedElement);
                } else {
                    container.insertBefore(draggedElement, afterElement);
                }
                
                if (onDrop) onDrop(draggedElement, afterElement);
            }
        });
        
        // Función auxiliar para determinar posición de drop
        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll(`${dragSelector}:not(.dragging)`)];
            
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
        
        // Inicializar
        setupDraggableElements();
        
        // Retornar función para re-inicializar (útil cuando se agregan nuevos elementos)
        return setupDraggableElements;
    }

    // ==========================================
    // UTILIDADES DE TEXTO
    // ==========================================

    /**
     * Truncar texto a una longitud específica
     */
    function truncateText(text, maxLength, suffix = '...') {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    /**
     * Capitalizar primera letra
     */
    function capitalize(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    /**
     * Convertir a slug URL-friendly
     */
    function slugify(text) {
        return text
            .toString()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }

    /**
     * Highlight de texto en búsquedas
     */
    function highlightText(text, search) {
        if (!search) return text;
        
        const regex = new RegExp(`(${search})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // ==========================================
    // UTILIDADES DE PERFORMANCE
    // ==========================================

    /**
     * Debounce - retrasa la ejecución hasta que paren las llamadas
     */
    function debounce(func, wait, immediate = false) {
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
     * Throttle - limita la ejecución a una vez por período
     */
    function throttle(func, limit) {
        let inThrottle;
        
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ==========================================
    // MANEJO DE ERRORES
    // ==========================================

    /**
     * Manejar errores de manera consistente
     */
    function handleError(error, context = '') {
        console.error(`❌ Error${context ? ` en ${context}` : ''}:`, error);
        
        let message = 'Ha ocurrido un error inesperado';
        
        if (error.message) {
            message = error.message;
        } else if (typeof error === 'string') {
            message = error;
        }
        
        showToast(message, 'error', { duration: 8000 });
        
        // Log adicional para debugging
        if (typeof error === 'object') {
            console.error('Detalles del error:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                context
            });
        }
    }

    /**
     * Wrapper para funciones async con manejo de errores
     */
    function withErrorHandling(asyncFunc, context = '') {
        return async function(...args) {
            try {
                return await asyncFunc.apply(this, args);
            } catch (error) {
                handleError(error, context);
                throw error; // Re-lanzar para que el caller pueda manejarlo si es necesario
            }
        };
    }

    // ==========================================
    // UTILIDADES DE DATOS
    // ==========================================

    /**
     * Deep clone de objetos
     */
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => deepClone(item));
        if (typeof obj === 'object') {
            const copy = {};
            Object.keys(obj).forEach(key => {
                copy[key] = deepClone(obj[key]);
            });
            return copy;
        }
    }

    /**
     * Comparar objetos por igualdad profunda
     */
    function deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a !== typeof b) return false;
        
        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            
            if (keysA.length !== keysB.length) return false;
            
            return keysA.every(key => deepEqual(a[key], b[key]));
        }
        
        return false;
    }

    // ==========================================
    // EXPORTACIÓN GLOBAL
    // ==========================================

    // Crear objeto de utilidades global
    window.Utils = {
        // Formateo
        formatDuration,
        formatFileSize,
        formatDate,
        formatNumber,
        
        // Validación
        isValidEmail,
        isValidUrl,
        isNotEmpty,
        isInRange,
        sanitizeHtml,
        
        // DOM
        createElement,
        toggleElement,
        addClassWithAnimation,
        scrollToElement,
        
        // Toast
        showToast,
        
        // Drag & Drop
        setupDragAndDrop,
        
        // Texto
        truncateText,
        capitalize,
        slugify,
        highlightText,
        
        // Performance
        debounce,
        throttle,
        
        // Errores
        handleError,
        withErrorHandling,
        
        // Datos
        deepClone,
        deepEqual
    };

    // Funciones de compatibilidad (para scripts existentes)
    window.formatDuration = formatDuration;
    window.formatFileSize = formatFileSize;
    window.formatDate = formatDate;
    window.showToast = showToast;
    window.debounce = debounce;
    window.throttle = throttle;
    window.escapeHtml = sanitizeHtml;

    console.log('✅ Utilidades compartidas cargadas correctamente');
    console.log('🔧 Funciones disponibles:', Object.keys(window.Utils));

})();

// ==========================================
// INICIALIZACIÓN AUTOMÁTICA
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🛠️ Utilidades inicializadas y listas para usar');
    
    // Configurar manejo global de errores
    window.addEventListener('error', function(event) {
        console.error('Error global capturado:', event.error);
    });
    
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Promise rechazada no manejada:', event.reason);
        event.preventDefault(); // Prevenir que aparezca en la consola
    });
});