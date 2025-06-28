// ==========================================
// ARCHIVO: static/js/auth_fixed.js
// JavaScript de autenticación CORREGIDO
// ==========================================

class AuthManagerFixed {
    constructor() {
        this.tokenKey = 'auth_token';
        this.userKey = 'auth_user';
        this.isInitialized = false;
        
        this.init();
    }
    
    init() {
        if (this.isInitialized) return;
        
        console.log('🔐 Inicializando AuthManager...');
        
        // Verificar estado de autenticación al cargar
        this.checkAuthStatus();
        
        // Configurar interceptores de fetch
        this.setupFetchInterceptor();
        
        // Configurar logout automático en tabs
        this.setupStorageListener();
        
        this.isInitialized = true;
        console.log('✅ AuthManager inicializado');
    }
    
    /**
     * Verifica el estado de autenticación actual
     */
    checkAuthStatus() {
        const token = this.getToken();
        const user = this.getUser();
        
        if (token && user) {
            console.log('👤 Usuario autenticado:', user.username);
            this.updateAuthUI(true, user);
        } else {
            console.log('🚫 Usuario no autenticado');
            this.updateAuthUI(false);
            
            // Solo redirigir si estamos en una página protegida
            if (this.isProtectedPage()) {
                this.redirectToLogin();
            }
        }
    }
    
    /**
     * Verifica si la página actual requiere autenticación
     */
    isProtectedPage() {
        const path = window.location.pathname;
        const publicPaths = ['/login', '/ui/login', '/register', '/logout'];
        
        return !publicPaths.some(publicPath => path.startsWith(publicPath));
    }
    
    /**
     * Configurar interceptor de fetch para manejo automático de autenticación
     */
    setupFetchInterceptor() {
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = async function(url, options = {}) {
            // Agregar headers de autenticación automáticamente
            const token = self.getToken();
            if (token && !options.headers?.['Authorization']) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                };
            }
            
            try {
                const response = await originalFetch(url, options);
                
                // Manejar respuestas 401 automáticamente
                if (response.status === 401) {
                    console.warn('🚫 Token expirado o inválido');
                    self.handleTokenExpired();
                    
                    return new Response(
                        JSON.stringify({ error: 'Sesión expirada' }), 
                        {
                            status: 401,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                }
                
                return response;
            } catch (error) {
                console.error('❌ Error en fetch:', error);
                throw error;
            }
        };
    }
    
    /**
     * Configurar listener para cambios en localStorage entre pestañas
     */
    setupStorageListener() {
        const self = this;
        window.addEventListener('storage', (event) => {
            if (event.key === self.tokenKey || event.key === self.userKey) {
                if (!event.newValue) {
                    // Token eliminado en otra pestaña, hacer logout
                    console.log('🔄 Logout detectado en otra pestaña');
                    self.handleTokenExpired();
                }
            }
        });
    }
    
    /**
     * Manejar token expirado o inválido
     */
    handleTokenExpired() {
        console.log('⏰ Manejando token expirado...');
        
        // Limpiar datos locales
        this.clearAuth();
        
        // Actualizar UI
        this.updateAuthUI(false);
        
        // Redirigir solo si estamos en página protegida
        if (this.isProtectedPage()) {
            this.redirectToLogin();
        }
    }
    
    /**
     * Guardar datos de autenticación
     */
    saveAuth(authData) {
        if (!authData) {
            console.error('❌ Datos de autenticación inválidos');
            return false;
        }
        
        try {
            // Guardar token
            if (authData.session_token) {
                localStorage.setItem(this.tokenKey, authData.session_token);
            }
            
            // Guardar datos de usuario
            if (authData.user) {
                localStorage.setItem(this.userKey, JSON.stringify(authData.user));
            }
            
            console.log('✅ Datos de autenticación guardados');
            this.updateAuthUI(true, authData.user);
            
            return true;
        } catch (error) {
            console.error('❌ Error guardando autenticación:', error);
            return false;
        }
    }
    
    /**
     * Limpiar datos de autenticación
     */
    clearAuth() {
        console.log('🧹 Limpiando datos de autenticación...');
        
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        
        this.updateAuthUI(false);
    }
    
    /**
     * Obtener token actual
     */
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }
    
    /**
     * Obtener datos de usuario
     */
    getUser() {
        try {
            const userData = localStorage.getItem(this.userKey);
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('❌ Error obteniendo datos de usuario:', error);
            return null;
        }
    }
    
    /**
     * Verificar si está autenticado
     */
    isAuthenticated() {
        return !!(this.getToken() && this.getUser());
    }
    
    /**
     * Actualizar interfaz según estado de autenticación
     */
    updateAuthUI(isAuth = false, user = null) {
        console.log('🎨 Actualizando UI de autenticación:', isAuth);
        
        // Elementos que solo se muestran cuando está autenticado
        const authElements = document.querySelectorAll('.auth-only');
        // Elementos que solo se muestran cuando NO está autenticado  
        const noAuthElements = document.querySelectorAll('.no-auth-only');
        // Elementos para mostrar nombre de usuario
        const userNameElements = document.querySelectorAll('.user-name');
        
        // Mostrar/ocultar elementos según autenticación
        authElements.forEach(el => {
            el.style.display = isAuth ? '' : 'none';
        });
        
        noAuthElements.forEach(el => {
            el.style.display = isAuth ? 'none' : '';
        });
        
        // Actualizar nombre de usuario
        if (user && userNameElements.length > 0) {
            userNameElements.forEach(el => {
                el.textContent = user.username || user.email || 'Usuario';
            });
        }
        
        // Mostrar elementos de admin si corresponde
        const adminElements = document.querySelectorAll('.admin-only');
        if (isAuth && user && user.is_admin) {
            adminElements.forEach(el => el.style.display = '');
        } else {
            adminElements.forEach(el => el.style.display = 'none');
        }
    }
    
    /**
     * Redirigir a página de login
     */
    redirectToLogin() {
        const currentPath = window.location.pathname;
        // Actualizado para usar /ui/login
        const nextParam = currentPath !== '/ui/login' && currentPath !== '/login' ? `?next=${encodeURIComponent(currentPath)}` : '';
        
        console.log('🔀 Redirigiendo a login...');
        window.location.href = `/ui/login${nextParam}`;
    }
    
    /**
     * Hacer logout
     */
    async logout() {
        console.log('🚪 Iniciando logout...');
        
        try {
            // Llamar al endpoint de logout del servidor
            await fetch('/api/logout', {
                method: 'GET',
                credentials: 'include' // Incluir cookies
            });
        } catch (error) {
            console.warn('⚠️ Error en logout del servidor:', error);
        }
        
        // Limpiar datos locales
        this.clearAuth();
        
        // Redirigir a login
        window.location.href = '/ui/login';
    }
    
    /**
     * Login con credenciales
     */
    async login(username, password) {
        console.log('🔑 Intentando login para:', username);
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    username: username,
                    password: password
                }),
                credentials: 'include' // Incluir cookies
            });
            
            // Verificar si la respuesta es válida
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Login exitoso');
                this.saveAuth(data);
                return { success: true, message: data.message };
            } else {
                console.warn('❌ Login fallido:', data.message);
                return { success: false, message: data.message };
            }
            
        } catch (error) {
            console.error('❌ Error en login:', error);
            return { success: false, message: `Error de conexión: ${error.message}` };
        }
    }
}

// Crear instancia global
const authManager = new AuthManagerFixed();

// Configurar eventos globales
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM cargado, configurando eventos de auth...');
    
    // Botón de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            authManager.logout();
        });
    }
    
    // Formulario de login si existe
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username')?.value;
            const password = document.getElementById('password')?.value;
            
            if (!username || !password) {
                alert('Por favor, completa todos los campos');
                return;
            }
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Iniciando sesión...';
                
                const result = await authManager.login(username, password);
                
                if (result.success) {
                    // Redirigir a la página siguiente
                    const urlParams = new URLSearchParams(window.location.search);
                    const nextUrl = urlParams.get('next') || '/ui/dashboard';
                    window.location.href = nextUrl;
                } else {
                    alert(result.message || 'Error de autenticación');
                }
                
            } catch (error) {
                console.error('Error en login:', error);
                alert('Error de conexión');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
});

// Exponer globalmente
window.authManager = authManager;