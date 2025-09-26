# 🎯 EJEMPLO DE CONFIGURACIÓN DE PERMISOS PARA VENDEDOR

## Configuración Personalizada para Vendedor

Para configurar un agente específicamente como **VENDEDOR** con acceso solo a módulos de ventas y atención al cliente:

### Endpoint para Configurar Vendedor

```bash
PUT /api/module-permissions/user/vendedor@empresa.com
Content-Type: application/json
Authorization: Bearer {admin_token}

{
  "permissions": {
    "modules": {
      "dashboard": { "read": true, "write": false, "configure": false },
      "conversations": { "read": true, "write": true, "configure": false },
      "chat": { "read": true, "write": true, "configure": false },
      "contacts": { "read": true, "write": true, "configure": false },
      "clients": { "read": true, "write": true, "configure": false },
      "campaigns": { "read": true, "write": true, "configure": false },
      "phone": { "read": true, "write": true, "configure": false },
      "knowledge-base": { "read": true, "write": false, "configure": false },
      "copilot": { "read": true, "write": false, "configure": false },
      "notifications": { "read": true, "write": false, "configure": false },
      
      "team": { "read": false, "write": false, "configure": false },
      "hr": { "read": false, "write": false, "configure": false },
      "analytics": { "read": false, "write": false, "configure": false },
      "ai": { "read": false, "write": false, "configure": false },
      "settings": { "read": false, "write": false, "configure": false },
      "internal-chat": { "read": false, "write": false, "configure": false },
      "supervision": { "read": false, "write": false, "configure": false },
      "providers": { "read": false, "write": false, "configure": false },
      "warehouse": { "read": false, "write": false, "configure": false },
      "shipping": { "read": false, "write": false, "configure": false },
      "services": { "read": false, "write": false, "configure": false }
    }
  }
}
```

### Configuración para Agente de RRHH

```bash
PUT /api/module-permissions/user/rrhh@empresa.com
Content-Type: application/json
Authorization: Bearer {admin_token}

{
  "permissions": {
    "modules": {
      "dashboard": { "read": true, "write": false, "configure": false },
      "hr": { "read": true, "write": true, "configure": false },
      "team": { "read": true, "write": false, "configure": false },
      "notifications": { "read": true, "write": false, "configure": false },
      "analytics": { "read": true, "write": false, "configure": false },
      
      "conversations": { "read": false, "write": false, "configure": false },
      "chat": { "read": false, "write": false, "configure": false },
      "contacts": { "read": false, "write": false, "configure": false },
      "clients": { "read": false, "write": false, "configure": false },
      "campaigns": { "read": false, "write": false, "configure": false },
      "phone": { "read": false, "write": false, "configure": false },
      "knowledge-base": { "read": true, "write": false, "configure": false },
      "copilot": { "read": false, "write": false, "configure": false },
      "ai": { "read": false, "write": false, "configure": false },
      "settings": { "read": false, "write": false, "configure": false },
      "internal-chat": { "read": true, "write": true, "configure": false },
      "supervision": { "read": false, "write": false, "configure": false },
      "providers": { "read": false, "write": false, "configure": false },
      "warehouse": { "read": false, "write": false, "configure": false },
      "shipping": { "read": false, "write": false, "configure": false },
      "services": { "read": false, "write": false, "configure": false }
    }
  }
}
```

### Verificar Permisos de un Usuario

```bash
GET /api/module-permissions/user/vendedor@empresa.com
Authorization: Bearer {admin_token}
```

### Obtener Mis Permisos (desde el frontend)

```bash
GET /api/module-permissions/my-permissions
Authorization: Bearer {user_token}
```

## Respuesta Típica del Sistema

```json
{
  "success": true,
  "data": {
    "permissions": {
      "modules": {
        "dashboard": { "read": true, "write": false, "configure": false },
        "conversations": { "read": true, "write": true, "configure": false },
        "chat": { "read": true, "write": true, "configure": false },
        "contacts": { "read": true, "write": true, "configure": false },
        "clients": { "read": true, "write": true, "configure": false },
        "campaigns": { "read": true, "write": true, "configure": false }
      }
    },
    "accessibleModules": [
      {
        "id": "dashboard",
        "name": "Dashboard",
        "description": "Panel principal con métricas y estadísticas",
        "icon": "dashboard",
        "path": "/dashboard",
        "permissions": { "read": true, "write": false, "configure": false }
      },
      {
        "id": "conversations",
        "name": "Chat",
        "description": "Conversaciones y mensajería",
        "icon": "chat",
        "path": "/conversations",
        "permissions": { "read": true, "write": true, "configure": false }
      }
    ],
    "totalAccessible": 6
  },
  "message": "Mis permisos de módulos obtenidos exitosamente"
}
```
