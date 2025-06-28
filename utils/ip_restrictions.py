# utils/ip_restrictions.py - Middleware para restricciones de IP

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
import ipaddress
import logging
from typing import List, Union

logger = logging.getLogger(__name__)

class IPRestrictionMiddleware:
    """
    Middleware para restringir acceso a rutas específicas basado en direcciones IP
    """
    
    def __init__(self, 
                 allowed_networks: List[str] = None, 
                 restricted_paths: List[str] = None,
                 allowed_ips: List[str] = None):
        """
        Inicializar el middleware de restricción de IP
        
        Args:
            allowed_networks: Lista de redes permitidas en formato CIDR (ej: "192.168.36.128/25")
            restricted_paths: Lista de paths que requieren restricción de IP
            allowed_ips: Lista de IPs específicas permitidas
        """
        self.allowed_networks = []
        self.restricted_paths = restricted_paths or ["/docs", "/redoc", "/openapi.json"]
        self.allowed_ips = set(allowed_ips or [])
        
        # Convertir las redes a objetos de ipaddress para validación
        if allowed_networks:
            for network in allowed_networks:
                try:
                    self.allowed_networks.append(ipaddress.ip_network(network, strict=False))
                    logger.info(f"✅ Red permitida configurada: {network}")
                except ValueError as e:
                    logger.error(f"❌ Error configurando red {network}: {e}")
        
        logger.info(f"🔒 Middleware IP configurado para rutas: {self.restricted_paths}")
        logger.info(f"🔒 Redes permitidas: {[str(net) for net in self.allowed_networks]}")
        logger.info(f"🔒 IPs específicas permitidas: {self.allowed_ips}")

    def get_client_ip(self, request: Request) -> str:
        """
        Obtener la IP real del cliente considerando proxies y headers
        """
        # Buscar en headers comunes de proxies
        forwarded_headers = [
            "X-Forwarded-For",
            "X-Real-IP", 
            "X-Client-IP",
            "CF-Connecting-IP",  # Cloudflare
            "True-Client-IP",    # Akamai
        ]
        
        for header in forwarded_headers:
            if header in request.headers:
                # X-Forwarded-For puede tener múltiples IPs separadas por comas
                ip_list = request.headers[header].split(',')
                client_ip = ip_list[0].strip()
                if client_ip:
                    return client_ip
        
        # Fallback a la IP de la conexión directa
        return request.client.host if request.client else "unknown"

    def is_ip_allowed(self, client_ip: str) -> bool:
        """
        Verificar si una IP está permitida según las reglas configuradas
        """
        try:
            client_ip_obj = ipaddress.ip_address(client_ip)
            
            # Verificar IPs específicas permitidas
            if client_ip in self.allowed_ips:
                return True
            
            # Verificar si la IP está en alguna de las redes permitidas
            for network in self.allowed_networks:
                if client_ip_obj in network:
                    return True
            
            return False
            
        except ValueError:
            logger.warning(f"⚠️ IP inválida recibida: {client_ip}")
            return False

    def should_restrict_path(self, path: str) -> bool:
        """
        Verificar si un path debe tener restricción de IP
        """
        return any(path.startswith(restricted_path) for restricted_path in self.restricted_paths)

    async def __call__(self, request: Request, call_next):
        """
        Procesar la request y aplicar restricciones de IP si es necesario
        """
        path = request.url.path
        
        # Si el path no requiere restricción, continuar normalmente
        if not self.should_restrict_path(path):
            return await call_next(request)
        
        # Obtener IP del cliente
        client_ip = self.get_client_ip(request)
        
        # Log del intento de acceso
        logger.info(f"🔍 Intento de acceso a {path} desde IP: {client_ip}")
        
        # Verificar si la IP está permitida
        if not self.is_ip_allowed(client_ip):
            logger.warning(f"🚫 Acceso denegado a {path} desde IP no autorizada: {client_ip}")
            
            # Respuesta de acceso denegado
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "detail": "Acceso denegado: IP no autorizada para acceder a la documentación",
                    "error_code": "IP_NOT_AUTHORIZED",
                    "client_ip": client_ip,
                    "timestamp": request.state.__dict__.get("timestamp", "unknown")
                }
            )
        
        # IP permitida, continuar con la request
        logger.info(f"✅ Acceso permitido a {path} desde IP autorizada: {client_ip}")
        return await call_next(request)


# Función de utilidad para crear el middleware fácilmente
def create_ip_restriction_middleware(
    allowed_networks: List[str] = None,
    restricted_paths: List[str] = None,
    allowed_ips: List[str] = None
) -> IPRestrictionMiddleware:
    """
    Función de utilidad para crear una instancia del middleware de restricción de IP
    
    Args:
        allowed_networks: Lista de redes en formato CIDR (ej: ["192.168.36.128/25", "10.0.0.0/8"])
        restricted_paths: Lista de paths a restringir (por defecto: documentación)
        allowed_ips: Lista de IPs específicas permitidas
    
    Returns:
        IPRestrictionMiddleware: Instancia configurada del middleware
    """
    return IPRestrictionMiddleware(
        allowed_networks=allowed_networks,
        restricted_paths=restricted_paths,
        allowed_ips=allowed_ips
    )


# Configuraciones predefinidas
class IPRestrictionPresets:
    """
    Configuraciones predefinidas para diferentes escenarios
    """
    
    @staticmethod
    def documentation_only(allowed_networks: List[str] = None, allowed_ips: List[str] = None):
        """
        Restricción solo para documentación (Swagger/ReDoc)
        """
        return create_ip_restriction_middleware(
            allowed_networks=allowed_networks,
            restricted_paths=["/docs", "/redoc", "/openapi.json"],
            allowed_ips=allowed_ips
        )
    
    @staticmethod
    def admin_panel(allowed_networks: List[str] = None, allowed_ips: List[str] = None):
        """
        Restricción para panel de administración
        """
        return create_ip_restriction_middleware(
            allowed_networks=allowed_networks,
            restricted_paths=["/admin", "/ui/admin", "/docs", "/redoc"],
            allowed_ips=allowed_ips
        )
    
    @staticmethod
    def api_management(allowed_networks: List[str] = None, allowed_ips: List[str] = None):
        """
        Restricción para gestión de API y documentación
        """
        return create_ip_restriction_middleware(
            allowed_networks=allowed_networks,
            restricted_paths=["/docs", "/redoc", "/openapi.json", "/api/admin"],
            allowed_ips=allowed_ips
        )


# Ejemplo de uso en configuración
if __name__ == "__main__":
    # Ejemplo de configuración
    middleware = IPRestrictionPresets.documentation_only(
        allowed_networks=["192.168.36.128/25", "10.0.0.0/8"],
        allowed_ips=["127.0.0.1", "192.168.1.100"]
    )
    print("Middleware configurado correctamente")