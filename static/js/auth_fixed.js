/**
 * AuthManager Mínimo - Solo manejo de login, SIN verificaciones automáticas
 * Versión de emergencia para detener bucles de redirección
 */

console.log('🔥 CARGANDO AUTHMANAGER MÍNIMO - SIN AUTO-VERIFICACIONES');

class AuthManagerMinimal {
    constructor() {
        // NO inicializar automáticamente
        console.log('📦 AuthManager mínimo instanciado (sin auto-init)');
    }
    
    /**
     * Login manual - solo cuando se llama explícitamente
     */
    async login(username, password) {
        console.log('🔑 Login manual para:', username);
        
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
                credentials: 'include'
            });
            
            const data = await response.json();
            console.log('📡 Respuesta del servidor:', data);
            
            if (data.success) {
                console.log('✅ Login exitoso');
                return { success: true, message: data.message };
            } else {
                console.log('❌ Login fallido:', data.message);
                return { success: false, message: data.message };
            }
            
        } catch (error) {
            console.error('❌ Error en login:', error);
            return { success: false, message: 'Error de conexión' };
        }
    }
    
    /**
     * Logout manual
     */
    async logout() {
        console.log('🚪 Logout manual');
        
        try {
            await fetch('/logout', {
                method: 'GET',
                credentials: 'include'
            });
            console.log('✅ Logout completado');
        } catch (error) {
            console.log('⚠️ Error en logout:', error);
        }
        
        // Redirigir a login
        window.location.href = '/login';
    }
}

// Crear instancia PERO NO inicializar automáticamente
const authManager = new AuthManagerMinimal();

// SOLO manejar eventos de formularios, NADA MÁS
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM cargado - configurando SOLO eventos de formularios');
    
    // SOLO manejar el formulario de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log('📝 Configurando formulario de login');
        
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('🚀 Formulario enviado');
            
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
                    console.log('✅ Login exitoso, redirigiendo...');
                    
                    // Redirigir inmediatamente
                    const urlParams = new URLSearchParams(window.location.search);
                    const nextUrl = urlParams.get('next') || '/ui/dashboard';
                    
                    console.log('🔀 Redirigiendo a:', nextUrl);
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
    
    // SOLO manejar enlaces de logout
    const logoutLinks = document.querySelectorAll('a[href="/logout"], a[href*="logout"]');
    logoutLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            authManager.logout();
        });
    });
});

// Exponer globalmente para compatibilidad
window.authManager = authManager;

console.log('🔥 AuthManager MÍNIMO cargado - SIN verificaciones automáticas');
console.log('⚠️ Este AuthManager NO hace verificaciones automáticas de sesión');
console.log('✅ Solo maneja login/logout cuando se solicita explícitamente');