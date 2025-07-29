# 🔍 **ENDPOINT VALIDATE-TOKEN - DOCUMENTACIÓN COMPLETA**

## **🎯 PROPÓSITO**

El endpoint `/api/auth/validate-token` es **CRÍTICO** para mantener la sesión de usuario activa al refrescar la página o reconectar después de períodos de inactividad. Implementa las mejores prácticas de JWT refresh authentication [[JWT Token Refresh](https://dev.to/jagadeesh_m_1339dae1f9e1f/jwt-token-refresh-authentication-made-simple-31ke)] sin renovar el token.

### **🚀 CASOS DE USO PRINCIPALES**
- **Restaurar sesión**: Al refrescar página en SPA (React, Vue, Angular)
- **Validar estado**: Verificar si el usuario sigue autenticado
- **Reconexión**: Después de suspensión del dispositivo o pérdida de red
- **Health check**: Verificación periódica de autenticación

---

## **📡 ESPECIFICACIÓN TÉCNICA**

### **Endpoint**
```http
GET /api/auth/validate-token
```

### **Headers Requeridos**
```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### **Características**
- ✅ **No renueva tokens** (solo valida)
- ✅ **Respuesta rápida** (< 200ms)
- ✅ **Logs de auditoría** completos
- ✅ **Rate limiting** aplicado
- ✅ **Manejo de errores** estructurado

---

## **📤 RESPUESTAS**

### **✅ TOKEN VÁLIDO (200 OK)**

```json
{
  "success": true,
  "data": {
    "user": {
      "email": "usuario@ejemplo.com",
      "name": "Usuario Ejemplo",
      "role": "agent",
      "isActive": true,
      "permissions": ["conversations.read", "messages.write"],
      "avatar": "https://ejemplo.com/avatar.jpg",
      "lastLoginAt": "2024-01-15T09:00:00Z",
      "createdAt": "2024-01-10T10:00:00Z"
    },
    "sessionValid": true,
    "validatedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Token válido - sesión activa",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **❌ SIN TOKEN (401 Unauthorized)**

```json
{
  "success": false,
  "error": "NO_TOKEN",
  "message": "No se encontró token de autenticación en la petición",
  "suggestion": "Incluye el header Authorization: Bearer {token} en tu petición",
  "docs": "https://api.utalk.com/docs/authentication",
  "help": "Si necesitas ayuda, contacta soporte@utalk.com y menciona 'NO_TOKEN'",
  "details": {
    "headerPresent": false
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **❌ TOKEN EXPIRADO (401 Unauthorized)**

```json
{
  "success": false,
  "error": "TOKEN_EXPIRED",
  "message": "El token ha expirado",
  "suggestion": "Inicia sesión nuevamente para renovar tu sesión",
  "docs": "https://api.utalk.com/docs/authentication/expired",
  "help": "Si necesitas ayuda, contacta soporte@utalk.com y menciona 'TOKEN_EXPIRED'",
  "details": {
    "jwtError": "TokenExpiredError",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **❌ TOKEN MALFORMADO (401 Unauthorized)**

```json
{
  "success": false,
  "error": "MALFORMED_TOKEN",
  "message": "El formato del token es inválido",
  "suggestion": "Verifica que el token esté correctamente formateado",
  "docs": "https://api.utalk.com/docs/authentication/format",
  "help": "Si necesitas ayuda, contacta soporte@utalk.com y menciona 'MALFORMED_TOKEN'",
  "details": {
    "jwtError": "JsonWebTokenError",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **❌ USUARIO NO ENCONTRADO (401 Unauthorized)**

```json
{
  "success": false,
  "error": "USER_NOT_FOUND",
  "message": "El usuario asociado al token no existe",
  "suggestion": "El usuario puede haber sido eliminado. Inicia sesión nuevamente",
  "docs": "https://api.utalk.com/docs/authentication/user-not-found",
  "help": "Si necesitas ayuda, contacta soporte@utalk.com y menciona 'USER_NOT_FOUND'",
  "details": {
    "email": "usuario@ejemplo.com"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **❌ USUARIO INACTIVO (401 Unauthorized)**

```json
{
  "success": false,
  "error": "USER_INACTIVE",
  "message": "Tu cuenta ha sido desactivada",
  "suggestion": "Contacta al administrador para reactivar tu cuenta",
  "docs": "https://api.utalk.com/docs/authentication/inactive",
  "help": "Si necesitas ayuda, contacta soporte@utalk.com y menciona 'USER_INACTIVE'",
  "details": {
    "email": "usuario@ejemplo.com",
    "isActive": false
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## **💻 EJEMPLOS DE INTEGRACIÓN**

### **JavaScript/Fetch**

```javascript
const validateToken = async () => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    console.log('No hay token guardado');
    return null;
  }

  try {
    const response = await fetch('/api/auth/validate-token', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ Sesión válida:', data.data.user);
      return data.data.user;
    } else {
      console.log('❌ Token inválido:', data.error);
      
      // Limpiar token inválido
      localStorage.removeItem('authToken');
      
      // Redirigir a login si es necesario
      if (data.error === 'TOKEN_EXPIRED' || data.error === 'USER_NOT_FOUND') {
        window.location.href = '/login';
      }
      
      return null;
    }
  } catch (error) {
    console.error('Error validando token:', error);
    return null;
  }
};

// Usar al cargar la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  const user = await validateToken();
  
  if (user) {
    // Usuario autenticado - mostrar app
    showApp(user);
  } else {
    // Usuario no autenticado - mostrar login
    showLogin();
  }
});
```

### **React Hook**

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

const useAuthValidation = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const validateToken = async () => {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get('/api/auth/validate-token', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setUser(response.data.data.user);
        setError(null);
      }
    } catch (err) {
      const errorCode = err.response?.data?.error;
      
      // Limpiar token en errores de autenticación
      if (['TOKEN_EXPIRED', 'USER_NOT_FOUND', 'USER_INACTIVE'].includes(errorCode)) {
        localStorage.removeItem('authToken');
      }
      
      setError(err.response?.data);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    validateToken();
  }, []);

  return { user, loading, error, validateToken };
};

// Usar en componentes
const App = () => {
  const { user, loading, error } = useAuthValidation();

  if (loading) {
    return <div>Validando sesión...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Dashboard user={user} />;
};
```

### **Axios Interceptor (Automático)**

```javascript
import axios from 'axios';

// Configurar interceptor para validación automática
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si el token expiró en cualquier petición
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Intentar validar token
        const validateResponse = await axios.get('/api/auth/validate-token');
        
        if (validateResponse.data.success) {
          // Token aún válido, reintentar petición original
          return axios(originalRequest);
        }
      } catch (validateError) {
        // Token inválido - limpiar y redirigir
        localStorage.removeItem('authToken');
        window.location.href = '/login';
        return Promise.reject(validateError);
      }
    }

    return Promise.reject(error);
  }
);
```

### **cURL**

```bash
# Token válido
curl -X GET "http://localhost:3001/api/auth/validate-token" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"

# Sin token
curl -X GET "http://localhost:3001/api/auth/validate-token" \
  -H "Content-Type: application/json"

# Token malformado
curl -X GET "http://localhost:3001/api/auth/validate-token" \
  -H "Authorization: Bearer token-invalido" \
  -H "Content-Type: application/json"
```

---

## **🔒 CONSIDERACIONES DE SEGURIDAD**

### **✅ Buenas Prácticas Implementadas**
- **Rate limiting**: Máximo 60 solicitudes/minuto por IP
- **Logs de auditoría**: Todas las validaciones se registran
- **No exposición de datos**: Los errores no revelan información interna
- **Verificación de usuario**: Confirma que el usuario existe y está activo
- **Headers seguros**: Requiere HTTPS en producción

### **🚨 Importante**
- **NO renueva tokens**: Este endpoint solo valida, no extiende la expiración
- **NO crea sesiones**: Solo confirma el estado actual
- **NO almacena estado**: Es completamente stateless
- **SI falla la validación**: El frontend debe manejar logout/redirect

---

## **📊 CASOS DE ERROR COMUNES**

| Error | Causa | Solución Frontend |
|-------|-------|-------------------|
| `NO_TOKEN` | Header Authorization ausente | Verificar almacenamiento de token |
| `EMPTY_TOKEN` | Token vacío o null | Limpiar storage y redirigir a login |
| `TOKEN_EXPIRED` | Token vencido | Limpiar storage y redirigir a login |
| `MALFORMED_TOKEN` | Token corrupto | Limpiar storage y redirigir a login |
| `USER_NOT_FOUND` | Usuario eliminado | Limpiar storage y redirigir a login |
| `USER_INACTIVE` | Cuenta desactivada | Mostrar mensaje específico |
| `VALIDATION_ERROR` | Error interno | Reintentar o mostrar error genérico |

---

## **🚀 FLUJO RECOMENDADO PARA FRONTEND**

```mermaid
graph TD
    A[Página cargada] --> B{¿Hay token?}
    B -->|No| C[Mostrar login]
    B -->|Sí| D[Validar token]
    D --> E{¿Respuesta OK?}
    E -->|Sí| F[Mostrar app con usuario]
    E -->|No| G{¿Error recuperable?}
    G -->|Sí| H[Reintentar validación]
    G -->|No| I[Limpiar token y mostrar login]
    H --> D
```

### **Implementación del Flujo**

```javascript
const initializeApp = async () => {
  // 1. Verificar token en localStorage
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    showLogin();
    return;
  }

  // 2. Validar token con el servidor
  try {
    const user = await validateToken();
    
    if (user) {
      // 3. Token válido - inicializar app
      initializeUserSession(user);
      showApp(user);
    } else {
      // 4. Token inválido - mostrar login
      showLogin();
    }
  } catch (error) {
    // 5. Error de red - mostrar offline o reintentar
    if (error.name === 'NetworkError') {
      showOfflineMessage();
    } else {
      showLogin();
    }
  }
};
```

---

## **🧪 TESTING**

### **Unit Tests**
```javascript
describe('Validate Token Endpoint', () => {
  test('debe aceptar token válido', async () => {
    const response = await request(app)
      .get('/api/auth/validate-token')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBeDefined();
  });

  test('debe rechazar token expirado', async () => {
    const response = await request(app)
      .get('/api/auth/validate-token')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
    
    expect(response.body.error).toBe('TOKEN_EXPIRED');
  });
});
```

### **Integration Tests**
```javascript
describe('Auth Flow Integration', () => {
  test('login → validate → logout flow', async () => {
    // 1. Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'password' });
    
    const token = loginResponse.body.data.token;
    
    // 2. Validate
    const validateResponse = await request(app)
      .get('/api/auth/validate-token')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(validateResponse.body.success).toBe(true);
  });
});
```

---

## **📈 MÉTRICAS Y MONITOREO**

### **Métricas Importantes**
- **Tiempo de respuesta**: < 200ms en percentil 95
- **Rate de éxito**: > 99% para tokens válidos
- **Rate de error**: < 1% para errores internos
- **Validaciones por minuto**: Monitorear picos de tráfico

### **Logs de Auditoría**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Token validado exitosamente",
  "email": "usuario@ejemplo.com",
  "role": "agent",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "responseTime": "45ms"
}
```

---

## **🔧 CONFIGURACIÓN DE PRODUCCIÓN**

### **Variables de Entorno**
```bash
JWT_SECRET=tu-secreto-super-seguro-de-32-chars
JWT_EXPIRES_IN=24h
RATE_LIMIT_VALIDATE_TOKEN=60  # requests per minute
LOG_LEVEL=info
```

### **Nginx Configuration**
```nginx
location /api/auth/validate-token {
    limit_req zone=auth burst=10 nodelay;
    proxy_pass http://backend;
    proxy_set_header Authorization $http_authorization;
}
```

---

*Documentación generada v1.0.0 - Última actualización: 2024-01-15* 