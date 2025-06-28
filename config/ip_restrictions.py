# config/ip_restrictions.py - Configuración centralizada de restricciones de IP

import os
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

class IPConfig:
    """
    Configuración centralizada para restricciones de IP
    """
    
    # ========================================
    # CONFIGURACIÓN BÁSICA
    # ========================================
    
    # Activar/desactivar restricciones de IP globalmente
    ENABLE_IP_RESTRICTIONS = os.getenv("ENABLE_IP_RESTRICTIONS", "true").lower() == "true"
    
    # Modo estricto: si está activado, solo permite las IPs/redes configuradas
    STRICT_MODE = os.getenv("IP_STRICT_MODE", "false").lower() == "true"
    
    # ========================================
    # REDES PERMITIDAS (FORMATO CIDR)
    # ========================================
    
    # Redes permitidas por defecto
    DEFAULT_ALLOWED_NETWORKS = [
        "127.0.0.0/8",        # Localhost IPv4
        "::1/128",            # Localhost IPv6
        "192.168.0.0/16",     # Red privada clase C
        "10.0.0.0/8",         # Red privada clase A
        "172.16.0.0/12",      # Red privada clase B
    ]
    
    # Redes específicas del proyecto (configurable por variables de entorno)
    PROJECT_ALLOWED_NETWORKS = [
        "192.168.36.128/25",  # Red específica mencionada en el ejemplo
    ]
    
    # Redes adicionales desde variables de entorno
    ENV_ALLOWED_NETWORKS = []
    if os.getenv("ALLOWED_NETWORKS"):
        ENV_ALLOWED_NETWORKS = [
            net.strip() for net in os.getenv("ALLOWED_NETWORKS").split(",")
            if net.strip()
        ]
    
    # Combinar todas las redes permitidas
    ALLOWED_NETWORKS = DEFAULT_ALLOWED_NETWORKS + PROJECT_ALLOWED_NETWORKS + ENV_ALLOWED_NETWORKS
    
    # ========================================
    # IPS ESPECÍFICAS PERMITIDAS
    # ========================================
    
    # IPs específicas por defecto
    DEFAULT_ALLOWED_IPS = [
        "127.0.0.1",
        "::1",
    ]
    
    # IPs adicionales desde variables de entorno
    ENV_ALLOWED_IPS = []
    if os.getenv("ALLOWED_IPS"):
        ENV_ALLOWED_IPS = [
            ip.strip() for ip in os.getenv("ALLOWED_IPS").split(",")
            if ip.strip()
        ]
    
    # Combinar todas las IPs permitidas
    ALLOWED_IPS = DEFAULT_ALLOWED_IPS + ENV_ALLOWED_IPS
    
    # ========================================
    # RUTAS RESTRINGIDAS
    # ========================================
    
    # Rutas de documentación (siempre restringidas)
    DOCUMENTATION_PATHS = [
        "/docs",
        "/redoc", 
        "/openapi.json",
    ]
    
    # Rutas de administración
    ADMIN_PATHS = [
        "/admin",
        "/ui/admin",
        "/api/admin",
    ]
    
    # Rutas de gestión de sistema
    SYSTEM_PATHS = [
        "/api/system",
        "/api/config",
        "/api/logs",
    ]
    
    # Configuración por tipo de restricción
    RESTRICTION_PROFILES = {
        "documentation_only": DOCUMENTATION_PATHS,
        "admin_panel": DOCUMENTATION_PATHS + ADMIN_PATHS,
        "system_management": DOCUMENTATION_PATHS + ADMIN_PATHS + SYSTEM_PATHS,
        "custom": []  # Se configura dinámicamente
    }
    
    # Perfil activo (configurable por variable de entorno)
    ACTIVE_PROFILE = os.getenv("IP_RESTRICTION_PROFILE", "documentation_only")
    
    # Rutas adicionales desde variables de entorno
    ENV_RESTRICTED_PATHS = []
    if os.getenv("RESTRICTED_PATHS"):
        ENV_RESTRICTED_PATHS = [
            path.strip() for path in os.getenv("RESTRICTED_PATHS").split(",")
            if path.strip()
        ]
    
    # Obtener rutas restringidas según el perfil activo
    @classmethod
    def get_restricted_paths(cls) -> List[str]:
        """Obtener las rutas restringidas según el perfil activo"""
        profile_paths = cls.RESTRICTION_PROFILES.get(cls.ACTIVE_PROFILE, cls.DOCUMENTATION_PATHS)
        return list(set(profile_paths + cls.ENV_RESTRICTED_PATHS))
    
    # ========================================
    # CONFIGURACIÓN DE LOGGING
    # ========================================
    
    # Activar logging detallado de accesos
    LOG_ACCESS_ATTEMPTS = os.getenv("LOG_IP_ACCESS_ATTEMPTS", "true").lower() == "true"
    
    # Activar logging de IPs bloqueadas
    LOG_BLOCKED_IPS = os.getenv("LOG_BLOCKED_IPS", "true").lower() == "true"
    
    # Activar logging de IPs permitidas
    LOG_ALLOWED_IPS = os.getenv("LOG_ALLOWED_IPS", "false").lower() == "true"
    
    # ========================================
    # MÉTODOS DE UTILIDAD
    # ========================================
    
    @classmethod
    def get_config_summary(cls) -> Dict[str, Any]:
        """Obtener un resumen de la configuración actual"""
        return {
            "enabled": cls.ENABLE_IP_RESTRICTIONS,
            "strict_mode": cls.STRICT_MODE,
            "active_profile": cls.ACTIVE_PROFILE,
            "allowed_networks_count": len(cls.ALLOWED_NETWORKS),
            "allowed_ips_count": len(cls.ALLOWED_IPS),
            "restricted_paths_count": len(cls.get_restricted_paths()),
            "logging": {
                "access_attempts": cls.LOG_ACCESS_ATTEMPTS,
                "blocked_ips": cls.LOG_BLOCKED_IPS,
                "allowed_ips": cls.LOG_ALLOWED_IPS,
            }
        }
    
    @classmethod
    def validate_config(cls) -> List[str]:
        """Validar la configuración y retornar errores si los hay"""
        errors = []
        
        # Validar que al menos hay una red o IP permitida
        if not cls.ALLOWED_NETWORKS and not cls.ALLOWED_IPS:
            errors.append("No hay redes ni IPs permitidas configuradas")
        
        # Validar que el perfil activo existe
        if cls.ACTIVE_PROFILE not in cls.RESTRICTION_PROFILES:
            errors.append(f"Perfil '{cls.ACTIVE_PROFILE}' no existe")
        
        # Validar formato de redes (básico)
        for network in cls.ALLOWED_NETWORKS:
            if '/' not in network and not network.count('.') == 3:
                errors.append(f"Red '{network}' tiene formato inválido")
        
        return errors
    
    @classmethod
    def print_config(cls):
        """Imprimir la configuración actual de forma legible"""
        print("=" * 60)
        print("🔒 CONFIGURACIÓN DE RESTRICCIONES DE IP")
        print("=" * 60)
        print(f"Estado: {'✅ ACTIVADO' if cls.ENABLE_IP_RESTRICTIONS else '❌ DESACTIVADO'}")
        print(f"Modo estricto: {'✅ SÍ' if cls.STRICT_MODE else '❌ NO'}")
        print(f"Perfil activo: {cls.ACTIVE_PROFILE}")
        print()
        
        print("📍 REDES PERMITIDAS:")
        for network in cls.ALLOWED_NETWORKS:
            print(f"   • {network}")
        print()
        
        print("📍 IPS ESPECÍFICAS PERMITIDAS:")
        for ip in cls.ALLOWED_IPS:
            print(f"   • {ip}")
        print()
        
        print("🚫 RUTAS RESTRINGIDAS:")
        for path in cls.get_restricted_paths():
            print(f"   • {path}")
        print()
        
        errors = cls.validate_config()
        if errors:
            print("⚠️  ERRORES EN LA CONFIGURACIÓN:")
            for error in errors:
                print(f"   • {error}")
        else:
            print("✅ Configuración válida")
        print("=" * 60)


# ========================================
# CONFIGURACIONES PREDEFINIDAS PARA DIFERENTES ENTORNOS
# ========================================

class EnvironmentConfigs:
    """Configuraciones predefinidas para diferentes entornos"""
    
    @staticmethod
    def development():
        """Configuración para desarrollo local"""
        return {
            "allowed_networks": ["127.0.0.0/8", "192.168.0.0/16", "10.0.0.0/8"],
            "allowed_ips": ["127.0.0.1", "::1"],
            "restricted_paths": ["/docs", "/redoc"],
            "strict_mode": False
        }
    
    @staticmethod
    def testing():
        """Configuración para entorno de testing"""
        return {
            "allowed_networks": ["127.0.0.0/8", "192.168.0.0/16"],
            "allowed_ips": ["127.0.0.1"],
            "restricted_paths": ["/docs", "/redoc", "/openapi.json"],
            "strict_mode": True
        }
    
    @staticmethod
    def production():
        """Configuración para producción"""
        return {
            "allowed_networks": ["192.168.36.0/24", "192.168.235.0/24"],  # Solo red específica
            "allowed_ips": [],
            "restricted_paths": ["/docs", "/redoc", "/openapi.json", "/admin"],
            "strict_mode": True
        }
    
    @staticmethod
    def corporate():
        """Configuración para entorno corporativo"""
        return {
            "allowed_networks": [
                "192.168.235.0/24",   # Red específica del proyecto
                "10.0.0.0/8",          # Red corporativa
                "172.16.0.0/12",
                    # Red adicional corporativa
            ],
            "allowed_ips": ["192.168.36.150", "192.168.36.151","192.168.235.16"],  # IPs específicas de administradores
            "restricted_paths": ["/docs", "/redoc", "/openapi.json", "/admin", "/api/admin"],
            "strict_mode": True
        }


# ========================================
# FUNCIONES DE UTILIDAD
# ========================================

def load_environment_config(env_name: str) -> Dict[str, Any]:
    """
    Cargar configuración para un entorno específico
    
    Args:
        env_name: Nombre del entorno ('development', 'testing', 'production', 'corporate')
    
    Returns:
        Diccionario con la configuración del entorno
    """
    env_configs = {
        'development': EnvironmentConfigs.development(),
        'testing': EnvironmentConfigs.testing(),
        'production': EnvironmentConfigs.production(),
        'corporate': EnvironmentConfigs.corporate(),
    }
    
    return env_configs.get(env_name, EnvironmentConfigs.development())


# def create_env_file_template():
#     """Crear un template de archivo .env para configuración de IP"""
#     template = """
# # ========================================
# # CONFIGURACIÓN DE RESTRICCIONES DE IP
# # ========================================

# # Activar/desactivar restricciones de IP
# ENABLE_IP_RESTRICTIONS=true

# # Modo estricto (solo permite IPs/redes configuradas)
# IP_STRICT_MODE=false

# # Perfil de restricción activo
# # Opciones: documentation_only, admin_panel, system_management, custom
# IP_RESTRICTION_PROFILE=documentation_only

# # Redes permitidas (separadas por comas, formato CIDR)
# ALLOWED_NETWORKS=192.168.36.128/25,10.0.0.0/8,172.16.0.0/12

# # IPs específicas permitidas (separadas por comas)
# ALLOWED_IPS=192.168.1.100,192.168.1.101

# # Rutas adicionales a restringir (separadas por comas)
# RESTRICTED_PATHS=/api/admin,/api/system

# # Configuración de logging
# LOG_IP_ACCESS_ATTEMPTS=true
# LOG_BLOCKED_IPS=true
# LOG_ALLOWED_IPS=false
# """
    
#     return template.strip()


# ========================================
# EJECUCIÓN COMO SCRIPT INDEPENDIENTE
# ========================================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "validate":
            # Validar configuración
            errors = IPConfig.validate_config()
            if errors:
                print("❌ Errores en la configuración:")
                for error in errors:
                    print(f"   • {error}")
                sys.exit(1)
            else:
                print("✅ Configuración válida")
                sys.exit(0)
        
        elif sys.argv[1] == "show":
            # Mostrar configuración actual
            IPConfig.print_config()
            sys.exit(0)
        
        elif sys.argv[1] == "env-template":
            # Generar template de .env
            print(create_env_file_template())
            sys.exit(0)
        
        elif sys.argv[1] == "test-env":
            # Probar configuración de entorno
            env_name = sys.argv[2] if len(sys.argv) > 2 else "development"
            config = load_environment_config(env_name)
            print(f"Configuración para entorno '{env_name}':")
            for key, value in config.items():
                print(f"   {key}: {value}")
            sys.exit(0)
    
    # Por defecto, mostrar configuración
    IPConfig.print_config()