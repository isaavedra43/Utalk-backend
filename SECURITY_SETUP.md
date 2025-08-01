# 🔧 GUÍA DE CONFIGURACIÓN DE SEGURIDAD

## 🎯 VARIABLES DE ENTORNO CRÍTICAS

### **OBLIGATORIAS PARA PRODUCCIÓN:**

```bash
# 🔐 AUTENTICACIÓN JWT
JWT_SECRET=your-super-secure-jwt-secret-256-bits-minimum
# Generar con: openssl rand -base64 32

# 🔗 TWILIO WEBHOOK SECURITY
TWILIO_AUTH_TOKEN=your-twilio-auth-token-from-console
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# 🚦 RATE LIMITING PERSISTENTE
REDIS_URL=redis://user:pass@host:port/db
# O alternativo:
REDISCLOUD_URL=redis://user:pass@host:port/db

# 🌐 CORS Y FRONTEND
FRONTEND_URL=https://your-frontend-domain.com,https://your-staging.com
# Separar múltiples dominios con comas

# 🔒 FIRESTORE
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
# O usar variables directas:
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
```

### **OPCIONALES PERO RECOMENDADAS:**

```bash
# 📊 LOGGING Y MONITOREO
LOG_LEVEL=info                    # debug|info|warn|error
ENABLE_REQUEST_LOGGING=true
SECURITY_LOG_RETENTION_DAYS=90

# 🚦 RATE LIMITING CUSTOMIZATION
RATE_LIMIT_REDIS_PREFIX=utalk_rl  # Prefix para keys de Redis
RATE_LIMIT_MEMORY_FILE=./temp/rate-limits.json

# 🔐 SEGURIDAD ADICIONAL
ENFORCE_HTTPS=true               # Forzar HTTPS en producción
SECURE_COOKIES=true              # Cookies seguras
HELMET_CSP_ENABLED=true          # Content Security Policy

# 🌍 INTERNACIONALIZACIÓN
DEFAULT_TIMEZONE=UTC
LOCALE=es-ES
```

---

## 🚀 CONFIGURACIÓN POR AMBIENTE

### **🧪 DESARROLLO (LOCAL):**

```bash
# .env.development
NODE_ENV=development
JWT_SECRET=development-jwt-secret-not-for-production
TWILIO_AUTH_TOKEN=test_token_or_real_for_testing
REDIS_URL=redis://localhost:6379/0
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true

# 🔒 Seguridad relajada para desarrollo
ENFORCE_HTTPS=false
SECURE_COOKIES=false
WEBHOOK_SIGNATURE_REQUIRED=false  # Solo para testing
```

### **🧪 STAGING:**

```bash
# .env.staging
NODE_ENV=staging
JWT_SECRET=staging-secure-jwt-secret-different-from-prod
TWILIO_AUTH_TOKEN=your-staging-twilio-token
REDIS_URL=redis://staging-redis:6379/0
FRONTEND_URL=https://staging.yourapp.com
LOG_LEVEL=info

# 🔒 Seguridad casi completa
ENFORCE_HTTPS=true
SECURE_COOKIES=true
WEBHOOK_SIGNATURE_REQUIRED=true
```

### **🚀 PRODUCCIÓN:**

```bash
# .env.production
NODE_ENV=production
JWT_SECRET=production-ultra-secure-jwt-secret-32-chars-minimum
TWILIO_AUTH_TOKEN=your-production-twilio-token
REDIS_URL=redis://prod-redis-cluster:6379/0
FRONTEND_URL=https://app.yourcompany.com
LOG_LEVEL=warn

# 🔒 Seguridad máxima
ENFORCE_HTTPS=true
SECURE_COOKIES=true
WEBHOOK_SIGNATURE_REQUIRED=true
HELMET_CSP_ENABLED=true
SECURITY_LOG_RETENTION_DAYS=365
```

---

## 🛠️ COMANDOS DE CONFIGURACIÓN

### **1. 🔐 INICIALIZACIÓN DE SEGURIDAD**

```bash
# Instalar dependencias de seguridad
npm install rate-limit-redis redis helmet compression

# Verificar configuración
npm run security:check

# Generar secretos seguros
npm run security:generate-secrets

# Verificar conectividad Redis
npm run security:test-redis
```

### **2. 🧪 TESTING DE SEGURIDAD**

```bash
# Ejecutar todos los tests de seguridad
npm run test:security

# Tests específicos
npm run test:webhook-security
npm run test:authorization
npm run test:rate-limiting

# Tests de penetración básicos
npm run test:penetration

# Verificar configuración de producción
npm run security:production-check
```

### **3. 📊 MONITOREO Y MÉTRICAS**

```bash
# Ver estadísticas de rate limiting
curl http://localhost:3001/api/internal/security/rate-limits

# Ver estadísticas de autorización
curl http://localhost:3001/api/internal/security/authorization

# Ver eventos de seguridad (últimas 24h)
curl http://localhost:3001/api/internal/security/events

# Exportar logs de seguridad
npm run security:export-logs --days=7
```

---

## 🔧 CONFIGURACIÓN DETALLADA

### **1. 🚦 RATE LIMITING PERSONALIZADO**

**Archivo:** `src/config/rateLimits.js`

```javascript
// Personalizar limits por endpoint
const customRateLimits = {
  // Webhook crítico - muy restrictivo
  webhook: {
    windowMs: 1 * 60 * 1000,      // 1 minuto
    max: 30,                      // 30 requests por IP
    message: 'Webhook rate limit exceeded'
  },

  // Login - anti brute force
  login: {
    windowMs: 15 * 60 * 1000,     // 15 minutos
    max: 3,                       // 3 intentos por IP+email
    skipSuccessfulRequests: true   // No contar logins exitosos
  },

  // Mensajes - dinámico por rol
  messages: {
    windowMs: 1 * 60 * 1000,      // 1 minuto
    max: (req) => {
      if (req.user?.role === 'admin') return 100;
      if (req.user?.role === 'agent') return 60;
      return 30;
    }
  },

  // Subida de archivos - muy restrictivo
  media: {
    windowMs: 10 * 60 * 1000,     // 10 minutos
    max: 5,                       // 5 uploads por usuario
    keyGenerator: (req) => `media:${req.user?.id || req.ip}`
  }
};

module.exports = customRateLimits;
```

### **2. 🔒 PERMISOS GRANULARES**

**Archivo:** `src/config/permissions.js`

```javascript
// Matriz de permisos por rol
const rolePermissions = {
  admin: {
    conversations: ['create', 'read', 'update', 'delete', 'assign'],
    messages: ['create', 'read', 'update', 'delete'],
    contacts: ['create', 'read', 'update', 'delete'],
    media: ['upload', 'read', 'delete'],
    users: ['create', 'read', 'update', 'delete']
  },

  agent: {
    conversations: ['create', 'read', 'update', 'assign'],
    messages: ['create', 'read', 'update', 'delete_own'],
    contacts: ['create', 'read', 'update'],
    media: ['upload', 'read', 'delete_own'],
    users: ['read_basic']
  },

  viewer: {
    conversations: ['read_assigned'],
    messages: ['read'],
    contacts: ['read'],
    media: ['read'],
    users: ['read_own']
  }
};

// Validaciones específicas
const resourceValidators = {
  conversation: {
    read: (user, resource) => {
      if (user.role === 'admin') return true;
      if (resource.assignedToId === user.id) return true;
      if (resource.participants?.includes(user.id)) return true;
      return false;
    },

    write: (user, resource) => {
      if (user.role === 'viewer') return false;
      if (user.role === 'admin') return true;
      return resource.assignedToId === user.id;
    }
  }
};

module.exports = { rolePermissions, resourceValidators };
```

### **3. 🔐 WEBHOOK SECURITY**

**Configuración avanzada para múltiples proveedores:**

```javascript
// src/config/webhookProviders.js
const webhookProviders = {
  twilio: {
    signatureHeader: 'x-twilio-signature',
    algorithm: 'sha1',
    secretEnvVar: 'TWILIO_AUTH_TOKEN',
    validateSignature: (signature, url, body, secret) => {
      const expectedSignature = crypto
        .createHmac('sha1', secret)
        .update(url + body, 'utf-8')
        .digest('base64');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'base64'),
        Buffer.from(expectedSignature, 'base64')
      );
    }
  },

  stripe: {
    signatureHeader: 'stripe-signature',
    algorithm: 'sha256',
    secretEnvVar: 'STRIPE_WEBHOOK_SECRET',
    validateSignature: (signature, url, body, secret) => {
      // Implementar validación de Stripe
      return stripe.webhooks.constructEvent(body, signature, secret);
    }
  }
};

module.exports = webhookProviders;
```

---

## 📊 MONITOREO Y ALERTAS

### **1. 🚨 CONFIGURACIÓN DE ALERTAS**

```javascript
// src/config/securityAlerts.js
const alertThresholds = {
  // Rate limiting
  rateLimitExceeded: {
    threshold: 10,              // 10 intentos en ventana
    windowMs: 5 * 60 * 1000,    // 5 minutos
    severity: 'HIGH',
    action: 'email_security_team'
  },

  // Webhook spoofing
  webhookSpoofing: {
    threshold: 3,               // 3 intentos en ventana
    windowMs: 1 * 60 * 1000,    // 1 minuto
    severity: 'CRITICAL',
    action: 'immediate_alert'
  },

  // Unauthorized access
  unauthorizedAccess: {
    threshold: 5,               // 5 intentos en ventana
    windowMs: 10 * 60 * 1000,   // 10 minutos
    severity: 'HIGH',
    action: 'log_and_email'
  },

  // Suspicious user agents
  suspiciousUserAgent: {
    patterns: [
      /bot/i, /crawler/i, /spider/i, /scanner/i,
      /sqlmap/i, /nmap/i, /nikto/i
    ],
    severity: 'MEDIUM',
    action: 'log_and_monitor'
  }
};

module.exports = alertThresholds;
```

### **2. 📈 MÉTRICAS DE SEGURIDAD**

```javascript
// Dashboard de métricas en tiempo real
GET /api/internal/security/dashboard

{
  "realtime": {
    "activeConnections": 45,
    "requestsPerMinute": 1247,
    "rateLimitHits": 3,
    "authenticatedUsers": 23
  },
  
  "last24h": {
    "totalRequests": 1789456,
    "blockedRequests": 234,
    "webhookSpoofingAttempts": 7,
    "unauthorizedAttempts": 45,
    "rateLimitExceeded": 156
  },
  
  "performance": {
    "authValidationAvgMs": 45,
    "permissionCheckAvgMs": 12,
    "rateLimitCheckAvgMs": 3
  }
}
```

---

## 🔄 MANTENIMIENTO DE SEGURIDAD

### **TAREAS DIARIAS:**
```bash
# Verificar logs de seguridad
npm run security:check-logs

# Revisar métricas de rate limiting
npm run security:rate-limit-stats

# Verificar conectividad Redis
npm run security:health-check
```

### **TAREAS SEMANALES:**
```bash
# Rotar logs de seguridad
npm run security:rotate-logs

# Actualizar dependencias de seguridad
npm audit fix

# Ejecutar tests de penetración
npm run security:penetration-test
```

### **TAREAS MENSUALES:**
```bash
# Auditoría completa de seguridad
npm run security:full-audit

# Revisar y actualizar configuraciones
npm run security:config-review

# Generar reporte de seguridad
npm run security:generate-report
```

---

## 🚨 PROCEDIMIENTOS DE EMERGENCIA

### **EN CASO DE ATAQUE DDoS:**
```bash
# 1. Activar rate limiting agresivo
npm run security:emergency-rate-limit

# 2. Bloquear IPs sospechosas
npm run security:block-ips --file=suspicious-ips.txt

# 3. Activar modo de solo lectura
npm run security:readonly-mode

# 4. Notificar equipo de seguridad
npm run security:emergency-alert
```

### **EN CASO DE WEBHOOK SPOOFING:**
```bash
# 1. Verificar firma Twilio
npm run security:verify-twilio-config

# 2. Rotar Auth Token si es necesario
# (Hacer en Twilio Console + actualizar env vars)

# 3. Revisar logs de intentos maliciosos
npm run security:analyze-webhook-logs

# 4. Fortalecer validación
npm run security:strengthen-webhook-validation
```

### **EN CASO DE ACCESO NO AUTORIZADO:**
```bash
# 1. Revocar tokens comprometidos
npm run security:revoke-tokens --user=compromised-user-id

# 2. Auditar actividad del usuario
npm run security:audit-user --user=compromised-user-id

# 3. Cambiar secretos críticos
npm run security:rotate-secrets

# 4. Forzar re-autenticación
npm run security:force-reauth --all-users
```

---

## ✅ CHECKLIST DE DESPLIEGUE

### **ANTES DE DESPLEGAR A PRODUCCIÓN:**

- [ ] ✅ Todas las variables de entorno configuradas
- [ ] ✅ Redis configurado y accesible
- [ ] ✅ Twilio Auth Token válido
- [ ] ✅ JWT Secret único y seguro (32+ caracteres)
- [ ] ✅ HTTPS habilitado y certificados válidos
- [ ] ✅ CORS configurado con dominios específicos
- [ ] ✅ Tests de seguridad pasando (100%)
- [ ] ✅ Rate limiting configurado apropiadamente
- [ ] ✅ Logging de seguridad habilitado
- [ ] ✅ Monitoreo y alertas configuradas
- [ ] ✅ Backups de configuración realizados
- [ ] ✅ Documentación actualizada
- [ ] ✅ Equipo de seguridad notificado

### **DESPUÉS DEL DESPLIEGUE:**

- [ ] ✅ Verificar endpoint de health check
- [ ] ✅ Probar autenticación funcional
- [ ] ✅ Verificar webhook Twilio funcionando
- [ ] ✅ Confirmar rate limiting activo
- [ ] ✅ Revisar logs por errores de configuración
- [ ] ✅ Probar casos de uso críticos
- [ ] ✅ Verificar métricas de seguridad
- [ ] ✅ Confirmar alertas funcionando

---

## 📞 SOPORTE DE SEGURIDAD

**Canal de Escalación:**
1. **Slack:** `#security-incidents`
2. **Email:** `security@company.com`
3. **On-call:** Security Officer
4. **Emergencia:** CTO/CEO

**Información para Reportes:**
- Timestamp del incidente
- Tipo de problema de seguridad
- IPs involucradas
- Usuarios afectados
- Logs relevantes
- Impacto estimado

---

> **⚠️ RECORDATORIO CRÍTICO:**
> 
> - **NUNCA** commitear secretos en el código
> - **SIEMPRE** usar HTTPS en producción
> - **VERIFICAR** configuraciones antes de desplegar
> - **ROTAR** secretos regularmente
> - **MONITOREAR** logs de seguridad diariamente 