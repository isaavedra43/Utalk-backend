# 📱 GUÍA COMPLETA DE INTEGRACIÓN PARA APLICACIÓN MÓVIL

## 🎯 RESUMEN EJECUTIVO

Tu backend de Utalk está **COMPLETAMENTE PREPARADO** para recibir tanto aplicaciones web como móviles de manera simultánea. He implementado un sistema robusto de autenticación que soporta múltiples plataformas sin romper la funcionalidad existente.

## 🔧 CONFIGURACIONES IMPLEMENTADAS

### 1. **CORS Configurado para Múltiples Orígenes**
- ✅ Soporte para aplicaciones web existentes
- ✅ Soporte para aplicaciones móviles (React Native, Flutter, Ionic, etc.)
- ✅ Headers específicos para dispositivos móviles
- ✅ Configuración para desarrollo local y producción

### 2. **Sistema de Autenticación Dual**
- ✅ JWT con refresh tokens
- ✅ Detección automática de tipo de cliente
- ✅ Configuración específica por plataforma
- ✅ Rate limiting adaptado para móviles

### 3. **Middleware Especializado**
- ✅ Validación de dispositivos móviles
- ✅ Extracción de información de dispositivo
- ✅ Optimización de respuestas para móviles
- ✅ Configuración de tokens por plataforma

## 🚀 ENDPOINTS DISPONIBLES

### **Base URL**: `https://utalk-backend-production.up.railway.app/api/auth`

### 1. **LOGIN** - `POST /login`
```json
{
  "email": "usuario@ejemplo.com",
  "password": "tu_password"
}
```

**Headers Requeridos para Móviles:**
```
X-Device-ID: unique_device_identifier
X-Device-Type: mobile|web|react-native|flutter|ionic
X-Platform: ios|android|web|desktop
X-App-Version: 1.0.0
X-Client-Type: mobile|web|react-native|flutter|ionic|capacitor|expo
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Login exitoso",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "refreshExpiresIn": "7d",
  "user": {
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario",
    "role": "admin|agent|viewer",
    "isActive": true,
    "permissions": {},
    "modulePermissions": {
      "email": "usuario@ejemplo.com",
      "role": "admin",
      "isImmuneUser": false,
      "accessibleModules": [],
      "permissions": {
        "basic": {
          "read": true,
          "write": true,
          "approve": true,
          "configure": true
        },
        "modules": {}
      }
    }
  },
  "deviceInfo": {
    "deviceId": "mobile_abc123_xyz789",
    "deviceType": "mobile",
    "platform": "ios",
    "appVersion": "1.0.0",
    "clientType": "react-native",
    "loginAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. **REFRESH TOKEN** - `POST /refresh`
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Token renovado exitosamente",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "user": {
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario",
    "role": "admin"
  }
}
```

### 3. **VALIDAR TOKEN** - `POST /validate-token`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Respuesta:**
```json
{
  "success": true,
  "user": {
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario",
    "role": "admin",
    "isActive": true,
    "permissions": [],
    "avatar": null,
    "lastLoginAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "sessionValid": true,
  "validatedAt": "2024-01-15T10:35:00.000Z"
}
```

### 4. **LOGOUT** - `POST /logout`
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "invalidateAll": false
}
```

### 5. **PERFIL** - `GET /profile`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 6. **SESIONES ACTIVAS** - `GET /sessions`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📱 IMPLEMENTACIÓN EN APLICACIÓN MÓVIL

### **React Native / Expo**

```javascript
// Configuración de la API
const API_BASE_URL = 'https://utalk-backend-production.up.railway.app/api/auth';

// Headers para móviles
const getMobileHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Device-ID': await AsyncStorage.getItem('deviceId') || generateDeviceId(),
  'X-Device-Type': 'react-native',
  'X-Platform': Platform.OS, // 'ios' o 'android'
  'X-App-Version': '1.0.0',
  'X-Client-Type': 'react-native'
});

// Función de Login
const login = async (email, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: getMobileHeaders(),
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Guardar tokens
      await AsyncStorage.setItem('accessToken', data.accessToken);
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      
      return data;
    } else {
      throw new Error(data.error?.message || 'Error en login');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Función para renovar token
const refreshToken = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    
    const response = await fetch(`${API_BASE_URL}/refresh`, {
      method: 'POST',
      headers: getMobileHeaders(),
      body: JSON.stringify({ refreshToken })
    });
    
    const data = await response.json();
    
    if (data.success) {
      await AsyncStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) {
        await AsyncStorage.setItem('refreshToken', data.refreshToken);
      }
      return data.accessToken;
    } else {
      throw new Error('Token refresh failed');
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    throw error;
  }
};

// Función para hacer peticiones autenticadas
const authenticatedRequest = async (url, options = {}) => {
  let accessToken = await AsyncStorage.getItem('accessToken');
  
  const requestOptions = {
    ...options,
    headers: {
      ...getMobileHeaders(),
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers
    }
  };
  
  let response = await fetch(url, requestOptions);
  
  // Si el token expiró, intentar renovarlo
  if (response.status === 401) {
    try {
      accessToken = await refreshToken();
      requestOptions.headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(url, requestOptions);
    } catch (refreshError) {
      // Redirigir al login
      await AsyncStorage.clear();
      // navigation.navigate('Login');
      throw refreshError;
    }
  }
  
  return response;
};
```

### **Flutter**

```dart
// Configuración de la API
class ApiService {
  static const String baseUrl = 'https://utalk-backend-production.up.railway.app/api/auth';
  
  // Headers para móviles
  static Map<String, String> getMobileHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Device-ID': DeviceInfoService.getDeviceId(),
      'X-Device-Type': 'flutter',
      'X-Platform': Platform.isIOS ? 'ios' : 'android',
      'X-App-Version': '1.0.0',
      'X-Client-Type': 'flutter',
    };
  }
  
  // Función de Login
  static Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/login'),
        headers: getMobileHeaders(),
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );
      
      final data = jsonDecode(response.body);
      
      if (data['success'] == true) {
        // Guardar tokens
        await SecureStorage.setItem('accessToken', data['accessToken']);
        await SecureStorage.setItem('refreshToken', data['refreshToken']);
        await SecureStorage.setItem('user', jsonEncode(data['user']));
        
        return data;
      } else {
        throw Exception(data['error']?['message'] ?? 'Error en login');
      }
    } catch (e) {
      print('Login error: $e');
      rethrow;
    }
  }
  
  // Función para renovar token
  static Future<String> refreshToken() async {
    try {
      final refreshToken = await SecureStorage.getItem('refreshToken');
      
      final response = await http.post(
        Uri.parse('$baseUrl/refresh'),
        headers: getMobileHeaders(),
        body: jsonEncode({'refreshToken': refreshToken}),
      );
      
      final data = jsonDecode(response.body);
      
      if (data['success'] == true) {
        await SecureStorage.setItem('accessToken', data['accessToken']);
        if (data['refreshToken'] != null) {
          await SecureStorage.setItem('refreshToken', data['refreshToken']);
        }
        return data['accessToken'];
      } else {
        throw Exception('Token refresh failed');
      }
    } catch (e) {
      print('Refresh token error: $e');
      rethrow;
    }
  }
}
```

## 🔐 SEGURIDAD IMPLEMENTADA

### **1. Validación de Dispositivos**
- ✅ Validación de tipos de cliente soportados
- ✅ Validación de plataformas soportadas
- ✅ Generación automática de Device ID único
- ✅ Tracking de información de dispositivo

### **2. Rate Limiting Adaptado**
- ✅ Límites específicos para móviles
- ✅ Identificación por Device ID
- ✅ Configuración por operación (login, API)

### **3. Tokens Seguros**
- ✅ JWT con firma segura
- ✅ Refresh tokens con rotación
- ✅ Invalidación por logout
- ✅ Configuración específica por plataforma

### **4. CORS Configurado**
- ✅ Orígenes permitidos para desarrollo y producción
- ✅ Headers específicos para móviles
- ✅ Soporte para WebSockets

## 🌐 CONFIGURACIÓN DE VARIABLES DE ENTORNO

Agrega estas variables a tu archivo `.env`:

```bash
# URLs de aplicaciones móviles (cuando las tengas)
MOBILE_APP_URL=https://tu-app-movil.com
MOBILE_APP_URL_2=https://tu-app-movil-2.com

# Configuración de tokens para móviles
MOBILE_ACCESS_TOKEN_EXPIRY=7d
MOBILE_REFRESH_TOKEN_EXPIRY=30d

# Notificaciones push (para futuras implementaciones)
PUSH_NOTIFICATIONS_ENABLED=false
FCM_ENABLED=false
FCM_SERVER_KEY=tu_fcm_server_key
APNS_ENABLED=false
APNS_KEY_ID=tu_apns_key_id
APNS_TEAM_ID=tu_apns_team_id
```

## 🧪 TESTING

### **Endpoints de Prueba**

```bash
# Login desde aplicación móvil
curl -X POST https://utalk-backend-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Device-ID: test_device_123" \
  -H "X-Device-Type: mobile" \
  -H "X-Platform: ios" \
  -H "X-App-Version: 1.0.0" \
  -H "X-Client-Type: react-native" \
  -d '{
    "email": "admin@company.com",
    "password": "tu_password"
  }'

# Validar token
curl -X POST https://utalk-backend-production.up.railway.app/api/auth/validate-token \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -H "X-Device-Type: mobile" \
  -H "X-Platform: ios"

# Obtener perfil
curl -X GET https://utalk-backend-production.up.railway.app/api/auth/profile \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -H "X-Device-Type: mobile"
```

## 📊 MONITOREO Y LOGS

El sistema incluye logging completo para:
- ✅ Detección de dispositivos móviles
- ✅ Validación de tipos de cliente
- ✅ Configuración de tokens por plataforma
- ✅ Rate limiting específico
- ✅ Errores de autenticación móvil

## 🚨 MANEJO DE ERRORES

### **Códigos de Error Específicos para Móviles**

```json
{
  "success": false,
  "error": {
    "type": "CLIENT_ERROR",
    "code": "UNSUPPORTED_CLIENT_TYPE",
    "message": "Tipo de cliente 'invalid-type' no soportado",
    "supportedTypes": ["web", "mobile", "react-native", "flutter", "ionic", "capacitor", "expo"]
  }
}
```

```json
{
  "success": false,
  "error": {
    "type": "CLIENT_ERROR",
    "code": "UNSUPPORTED_PLATFORM",
    "message": "Plataforma 'invalid-platform' no soportada",
    "supportedPlatforms": ["ios", "android", "web", "desktop"]
  }
}
```

## 🔄 FLUJO COMPLETO DE AUTENTICACIÓN

### **1. Login Inicial**
1. App móvil envía credenciales con headers de dispositivo
2. Backend valida dispositivo y credenciales
3. Backend genera access token y refresh token
4. Backend responde con tokens y información de usuario
5. App móvil guarda tokens localmente

### **2. Peticiones Autenticadas**
1. App móvil incluye access token en header Authorization
2. Backend valida token y procesa petición
3. Si token expiró, app móvil usa refresh token
4. Backend renueva access token
5. App móvil actualiza token y reintenta petición

### **3. Logout**
1. App móvil envía refresh token para invalidar
2. Backend invalida refresh token
3. App móvil limpia tokens locales

## 🎯 PRÓXIMOS PASOS

1. **Implementar en tu aplicación móvil** usando los ejemplos de código
2. **Configurar variables de entorno** para URLs de producción
3. **Probar endpoints** con las herramientas de testing
4. **Implementar notificaciones push** (opcional)
5. **Configurar monitoreo** de métricas móviles

## ✅ COMPATIBILIDAD GARANTIZADA

- ✅ **Aplicaciones web existentes** siguen funcionando sin cambios
- ✅ **Aplicaciones móviles** pueden conectarse inmediatamente
- ✅ **Múltiples dispositivos** por usuario soportados
- ✅ **Sesiones simultáneas** web y móvil
- ✅ **Sin breaking changes** en funcionalidad existente

---

**Tu backend está 100% listo para recibir aplicaciones móviles. Solo necesitas implementar el cliente móvil usando esta documentación.**


