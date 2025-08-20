# 🚀 OPERACIÓN, KPIs, OBSERVABILIDAD Y RUNBOOKS - UTalk Backend

## 📋 LOGGING Y TRAZABILIDAD

### 📝 Logging Estructurado
```javascript
// Configuración de Winston
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'utalk-backend',
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});
```

### 🆔 Request ID Tracking
```javascript
// Middleware de correlación
const { v4: uuidv4 } = require('uuid');

app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  
  // Agregar requestId a todos los logs
  req.logger = logger.child({ requestId: req.requestId });
  
  next();
});

// Uso en logs
req.logger.info('API request', {
  method: req.method,
  path: req.path,
  userAgent: req.headers['user-agent'],
  ip: req.ip,
  userId: req.user?.id
});
```

### 🔗 Correlación RT/REST
```javascript
// Correlación entre Socket.IO y REST
socket.on('message:send', async (data) => {
  const requestId = uuidv4();
  
  logger.info('Socket message received', {
    requestId,
    socketId: socket.id,
    userId: socket.userId,
    messageId: data.messageId,
    conversationId: data.conversationId
  });
  
  // Pasar requestId a servicios
  const result = await MessageService.sendMessage(data, { requestId });
  
  logger.info('Socket message processed', {
    requestId,
    messageId: result.id,
    status: result.status
  });
});
```

### 📊 Retención de Logs
- **Development**: 7 días
- **Staging**: 30 días
- **Production**: 90 días
- **Error logs**: 1 año
- **Audit logs**: 2 años

---

## 📈 MÉTRICAS TÉCNICAS (SLIs)

### 🎯 Service Level Indicators

#### ⚡ Latencia
```javascript
// Métricas de latencia
const latencyMetrics = {
  // REST API
  restP50: 150,   // 50% de requests < 150ms
  restP95: 400,   // 95% de requests < 400ms
  restP99: 800,   // 99% de requests < 800ms
  
  // WebSocket
  wsP50: 50,      // 50% de eventos < 50ms
  wsP95: 200,     // 95% de eventos < 200ms
  wsP99: 500,     // 99% de eventos < 500ms
  
  // Database
  dbP50: 20,      // 50% de queries < 20ms
  dbP95: 100,     // 95% de queries < 100ms
  dbP99: 300      // 99% de queries < 300ms
};
```

#### ❌ Tasa de Error
```javascript
// Métricas de errores
const errorMetrics = {
  // HTTP Errors
  errorRate4xx: 0.05,    // < 5% errores 4xx
  errorRate5xx: 0.01,    // < 1% errores 5xx
  
  // WebSocket Errors
  wsErrorRate: 0.02,     // < 2% errores de socket
  wsDisconnectRate: 0.05, // < 5% desconexiones
  
  // Database Errors
  dbErrorRate: 0.001,    // < 0.1% errores de DB
  
  // External API Errors
  twilioErrorRate: 0.02, // < 2% errores de Twilio
  openaiErrorRate: 0.03  // < 3% errores de OpenAI
};
```

#### 🔄 Throughput
```javascript
// Métricas de throughput
const throughputMetrics = {
  // Requests per second
  rps: 1000,             // 1000 requests/segundo
  
  // WebSocket events per second
  wsEventsPerSecond: 500, // 500 eventos/segundo
  
  // Messages per second
  messagesPerSecond: 200, // 200 mensajes/segundo
  
  // Concurrent connections
  maxConcurrentConnections: 10000 // 10k conexiones simultáneas
};
```

### 🎯 Service Level Objectives (SLOs)

#### 📊 SLOs por Servicio
```javascript
const slos = {
  // API REST
  apiAvailability: 0.999,    // 99.9% disponibilidad
  apiLatency: 0.95,          // 95% requests < 400ms
  apiErrorRate: 0.01,        // < 1% errores 5xx
  
  // WebSocket
  wsAvailability: 0.999,     // 99.9% disponibilidad
  wsLatency: 0.95,           // 95% eventos < 200ms
  wsErrorRate: 0.02,         // < 2% errores
  
  // Database
  dbAvailability: 0.9999,    // 99.99% disponibilidad
  dbLatency: 0.95,           // 95% queries < 100ms
  dbErrorRate: 0.001,        // < 0.1% errores
  
  // External APIs
  twilioAvailability: 0.99,  // 99% disponibilidad
  openaiAvailability: 0.99,  // 99% disponibilidad
  firebaseAvailability: 0.9999 // 99.99% disponibilidad
};
```

#### 🚨 Alertas Automáticas
```javascript
// Configuración de alertas
const alerts = {
  // Latencia alta
  highLatency: {
    condition: 'p95_latency > 400ms for 5 minutes',
    severity: 'warning',
    notification: 'slack#ops-alerts'
  },
  
  // Error rate alto
  highErrorRate: {
    condition: 'error_rate > 1% for 2 minutes',
    severity: 'critical',
    notification: 'slack#ops-alerts, pagerduty'
  },
  
  // Disponibilidad baja
  lowAvailability: {
    condition: 'availability < 99% for 1 minute',
    severity: 'critical',
    notification: 'slack#ops-alerts, pagerduty, sms'
  },
  
  // Memory usage alto
  highMemoryUsage: {
    condition: 'memory_usage > 85% for 10 minutes',
    severity: 'warning',
    notification: 'slack#ops-alerts'
  }
};
```

---

## 📊 KPIs DE NEGOCIO (CON FÓRMULAS)

### 🎯 Métricas de Conversaciones

#### ⏱️ TMO Bot (Tiempo Medio de Respuesta del Bot)
```javascript
// Fórmula: Suma de tiempos de respuesta / Número de mensajes
const calculateTMO = (messages) => {
  const botMessages = messages.filter(m => m.botResponse);
  const totalTime = botMessages.reduce((sum, msg) => {
    return sum + (msg.botResponseTime || 0);
  }, 0);
  
  return botMessages.length > 0 ? totalTime / botMessages.length : 0;
};

// Objetivo: < 2 segundos
const tmoTarget = 2000; // ms
```

#### 🎯 FCR (First Contact Resolution)
```javascript
// Fórmula: Conversaciones resueltas en primer contacto / Total de conversaciones
const calculateFCR = (conversations) => {
  const resolvedFirstContact = conversations.filter(c => 
    c.resolvedInFirstContact && c.status === 'closed'
  );
  
  return conversations.length > 0 
    ? resolvedFirstContact.length / conversations.length 
    : 0;
};

// Objetivo: > 70%
const fcrTarget = 0.70; // 70%
```

#### ⏱️ ASA Agente (Average Speed of Answer)
```javascript
// Fórmula: Suma de tiempos de respuesta de agentes / Número de respuestas
const calculateASA = (agentResponses) => {
  const totalTime = agentResponses.reduce((sum, response) => {
    return sum + (response.responseTime || 0);
  }, 0);
  
  return agentResponses.length > 0 
    ? totalTime / agentResponses.length 
    : 0;
};

// Objetivo: < 30 segundos
const asaTarget = 30000; // ms
```

### 📈 Métricas de Escalamiento

#### 🚨 Tasa de Escalamiento
```javascript
// Fórmula: Conversaciones escaladas / Total de conversaciones
const calculateEscalationRate = (conversations) => {
  const escalated = conversations.filter(c => c.status === 'escalated');
  
  return conversations.length > 0 
    ? escalated.length / conversations.length 
    : 0;
};

// Objetivo: < 20%
const escalationTarget = 0.20; // 20%
```

#### ⏰ Tiempo hasta Escalamiento
```javascript
// Fórmula: Promedio de tiempo desde inicio hasta escalamiento
const calculateTimeToEscalation = (escalations) => {
  const escalationTimes = escalations.map(e => {
    return e.escalatedAt - e.conversationCreatedAt;
  });
  
  return escalationTimes.length > 0 
    ? escalationTimes.reduce((sum, time) => sum + time, 0) / escalationTimes.length 
    : 0;
};

// Objetivo: > 5 minutos
const timeToEscalationTarget = 300000; // 5 minutos
```

### 📨 Métricas de Mensajes

#### ❌ Entregas Fallidas
```javascript
// Fórmula: Mensajes fallidos / Total de mensajes enviados
const calculateDeliveryFailureRate = (messages) => {
  const outboundMessages = messages.filter(m => m.direction === 'outbound');
  const failedMessages = outboundMessages.filter(m => m.status === 'failed');
  
  return outboundMessages.length > 0 
    ? failedMessages.length / outboundMessages.length 
    : 0;
};

// Objetivo: < 1%
const deliveryFailureTarget = 0.01; // 1%
```

#### 📎 Porcentaje de Mensajes con Media
```javascript
// Fórmula: Mensajes con media / Total de mensajes
const calculateMediaMessageRate = (messages) => {
  const messagesWithMedia = messages.filter(m => m.mediaId);
  
  return messages.length > 0 
    ? messagesWithMedia.length / messages.length 
    : 0;
};

// Objetivo: < 30%
const mediaMessageTarget = 0.30; // 30%
```

### 😊 Métricas de Satisfacción

#### ⭐ CSAT (Customer Satisfaction)
```javascript
// Fórmula: Evaluaciones positivas / Total de evaluaciones
const calculateCSAT = (ratings) => {
  const positiveRatings = ratings.filter(r => r.score >= 4); // 4-5 estrellas
  
  return ratings.length > 0 
    ? positiveRatings.length / ratings.length 
    : 0;
};

// Objetivo: > 85%
const csatTarget = 0.85; // 85%
```

#### 📊 NPS (Net Promoter Score)
```javascript
// Fórmula: (Promoters - Detractors) / Total de respuestas
const calculateNPS = (responses) => {
  const promoters = responses.filter(r => r.score >= 9).length;
  const detractors = responses.filter(r => r.score <= 6).length;
  
  return responses.length > 0 
    ? ((promoters - detractors) / responses.length) * 100 
    : 0;
};

// Objetivo: > 50
const npsTarget = 50;
```

---

## 🔄 CI/CD

### 🌿 Ramas y Flujo
```javascript
// Configuración de ramas
const branches = {
  main: {
    protection: true,
    requiredReviews: 2,
    requiredStatusChecks: ['tests', 'lint', 'security'],
    autoMerge: false
  },
  develop: {
    protection: true,
    requiredReviews: 1,
    requiredStatusChecks: ['tests', 'lint'],
    autoMerge: true
  },
  feature: {
    pattern: 'feature/*',
    protection: false,
    autoDelete: true
  },
  hotfix: {
    pattern: 'hotfix/*',
    protection: true,
    requiredReviews: 2,
    autoDelete: true
  }
};
```

### 📋 PR Checklist
```markdown
## Pull Request Checklist

### ✅ Funcionalidad
- [ ] Funcionalidad implementada correctamente
- [ ] Tests unitarios pasando
- [ ] Tests de integración pasando
- [ ] Tests de performance pasando

### 🔒 Seguridad
- [ ] No hay vulnerabilidades de seguridad
- [ ] Inputs validados y sanitizados
- [ ] Autenticación y autorización verificadas
- [ ] Secrets no expuestos

### 📚 Documentación
- [ ] Código documentado
- [ ] APIs documentadas
- [ ] README actualizado
- [ ] Changelog actualizado

### 🧪 Testing
- [ ] Coverage > 80%
- [ ] Tests de edge cases
- [ ] Tests de error scenarios
- [ ] Performance tests

### 🚀 Deployment
- [ ] Variables de entorno configuradas
- [ ] Migraciones de base de datos
- [ ] Rollback plan preparado
- [ ] Monitoring configurado
```

### 🚀 Tests Obligatorios
```javascript
// package.json scripts
{
  "scripts": {
    "test": "jest --coverage --coverageThreshold='{\"global\":{\"branches\":80,\"functions\":80,\"lines\":80,\"statements\":80}}'",
    "test:integration": "jest --config jest.integration.config.js",
    "test:performance": "artillery run tests/performance/load-test.yml",
    "test:security": "npm audit && snyk test",
    "lint": "eslint src/ --ext .js,.ts",
    "lint:fix": "eslint src/ --ext .js,.ts --fix",
    "type-check": "tsc --noEmit",
    "build": "npm run lint && npm run test && npm run type-check"
  }
}
```

### 📦 Versionado y Despliegue
```javascript
// Semantic Versioning
const versioning = {
  major: 'breaking changes',
  minor: 'new features (backward compatible)',
  patch: 'bug fixes (backward compatible)'
};

// Railway deployment
const deployment = {
  automatic: true,
  branch: 'main',
  environment: 'production',
  healthCheck: '/health',
  rollback: {
    automatic: true,
    threshold: '5% error rate for 2 minutes'
  }
};
```

### 🔄 Migraciones de Esquema
```javascript
// Firebase Firestore migrations
const migrations = {
  // Migración automática
  autoMigrate: true,
  
  // Backup antes de migración
  backupBeforeMigration: true,
  
  // Rollback automático en caso de error
  autoRollback: true,
  
  // Validación post-migración
  validateAfterMigration: true
};

// Ejemplo de migración
const migrationExample = {
  version: '1.2.0',
  description: 'Add user preferences field',
  up: async (db) => {
    const users = await db.collection('users').get();
    const batch = db.batch();
    
    users.forEach(doc => {
      if (!doc.data().preferences) {
        batch.update(doc.ref, {
          preferences: {
            language: 'es',
            timezone: 'America/Mexico_City',
            notifications: {
              email: true,
              push: true
            }
          }
        });
      }
    });
    
    await batch.commit();
  },
  down: async (db) => {
    // Rollback logic
  }
};
```

---

## 🔐 GESTIÓN DE SECRETOS

### 🔒 Variables por Ambiente
```bash
# Development (.env.local)
NODE_ENV=development
JWT_SECRET=dev-secret-key
FIREBASE_PROJECT_ID=utalk-dev
TWILIO_ACCOUNT_SID=AC123456789
TWILIO_AUTH_TOKEN=dev-auth-token
OPENAI_API_KEY=sk-dev-key

# Staging (Railway Variables)
NODE_ENV=staging
JWT_SECRET=staging-secret-key
FIREBASE_PROJECT_ID=utalk-staging
TWILIO_ACCOUNT_SID=AC123456789
TWILIO_AUTH_TOKEN=staging-auth-token
OPENAI_API_KEY=sk-staging-key

# Production (Railway Variables)
NODE_ENV=production
JWT_SECRET=prod-secret-key
FIREBASE_PROJECT_ID=utalk-prod
TWILIO_ACCOUNT_SID=AC123456789
TWILIO_AUTH_TOKEN=prod-auth-token
OPENAI_API_KEY=sk-prod-key
```

### 🔄 Rotación de Secretos
```javascript
// Política de rotación
const secretRotation = {
  jwtSecret: {
    frequency: '90 days',
    autoRotation: true,
    gracePeriod: '7 days'
  },
  apiKeys: {
    frequency: '180 days',
    autoRotation: false,
    manualRotation: true
  },
  databaseCredentials: {
    frequency: '365 days',
    autoRotation: true,
    gracePeriod: '30 days'
  }
};

// Proceso de rotación
const rotationProcess = {
  1. 'Generate new secret',
  2. 'Update in secret manager',
  3. 'Deploy with new secret',
  4. 'Verify functionality',
  5. 'Remove old secret',
  6. 'Update documentation'
};
```

### 🔐 Política de Acceso
```javascript
// Niveles de acceso
const accessLevels = {
  admin: {
    description: 'Full system access',
    permissions: ['read', 'write', 'delete', 'admin'],
    secrets: ['all']
  },
  developer: {
    description: 'Development and deployment',
    permissions: ['read', 'write'],
    secrets: ['dev', 'staging']
  },
  operator: {
    description: 'Operations and monitoring',
    permissions: ['read'],
    secrets: ['monitoring']
  },
  readonly: {
    description: 'Read-only access',
    permissions: ['read'],
    secrets: ['logs', 'metrics']
  }
};
```

---

## 💾 BACKUPS Y DR

### 🔄 Backups de Firestore
```javascript
// Configuración de backups
const firestoreBackup = {
  // Backup automático
  automatic: true,
  frequency: 'daily',
  retention: '30 days',
  
  // Collections a respaldar
  collections: [
    'users',
    'conversations',
    'messages',
    'media',
    'escalations',
    'botRuns'
  ],
  
  // Excluir datos sensibles
  exclude: [
    'users.password',
    'users.refreshTokens',
    'messages.metadata.sensitive'
  ]
};

// Proceso de backup
const backupProcess = {
  1. 'Export collections to JSON',
  2. 'Compress with gzip',
  3. 'Upload to Google Cloud Storage',
  4. 'Verify backup integrity',
  5. 'Update backup metadata',
  6. 'Clean old backups'
};
```

### 📦 Backups de Storage
```javascript
// Configuración de Firebase Storage
const storageBackup = {
  // Backup automático
  automatic: true,
  frequency: 'daily',
  retention: '90 days',
  
  // Tipos de archivo
  includeTypes: ['image/*', 'audio/*', 'video/*', 'application/pdf'],
  excludeTypes: ['application/octet-stream'],
  
  // Tamaño máximo
  maxFileSize: '100MB'
};

// Proceso de restauración
const restoreProcess = {
  1. 'Verify backup integrity',
  2. 'Stop application',
  3. 'Restore from backup',
  4. 'Verify data consistency',
  5. 'Start application',
  6. 'Run health checks'
};
```

### 🚨 Disaster Recovery
```javascript
// Plan de DR
const disasterRecovery = {
  // RTO (Recovery Time Objective)
  rto: '4 hours',
  
  // RPO (Recovery Point Objective)
  rpo: '1 hour',
  
  // Procedimientos
  procedures: {
    'database-failure': {
      steps: [
        'Switch to backup database',
        'Update connection strings',
        'Verify data integrity',
        'Monitor performance'
      ],
      estimatedTime: '30 minutes'
    },
    'storage-failure': {
      steps: [
        'Switch to backup storage',
        'Update storage URLs',
        'Verify file accessibility',
        'Monitor uploads'
      ],
      estimatedTime: '15 minutes'
    },
    'complete-failure': {
      steps: [
        'Activate DR environment',
        'Restore from latest backup',
        'Update DNS records',
        'Verify all services'
      ],
      estimatedTime: '2 hours'
    }
  }
};
```

---

## 📋 RUNBOOKS (PASO A PASO)

### 🚨 "No llegan mensajes de WhatsApp"

#### 🔍 Diagnóstico
```bash
# 1. Verificar logs de webhook
grep "twilio.*webhook" logs/combined.log | tail -20

# 2. Verificar estado de Twilio
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/AC123456789/Messages.json" \
  -u "AC123456789:auth_token"

# 3. Verificar configuración de webhook
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/AC123456789/IncomingPhoneNumbers.json" \
  -u "AC123456789:auth_token"
```

#### 🛠️ Solución
```bash
# 1. Verificar que el webhook esté configurado correctamente
# URL: https://utalk-backend.railway.app/webhooks/twilio/whatsapp

# 2. Verificar que el servidor esté respondiendo
curl -X POST https://utalk-backend.railway.app/webhooks/twilio/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM123&From=whatsapp:+1234567890&Body=Test"

# 3. Verificar logs del servidor
tail -f logs/combined.log | grep "webhook"

# 4. Si el problema persiste, reiniciar el servicio
railway service restart
```

### 🚨 "Eventos RT sin acks"

#### 🔍 Diagnóstico
```bash
# 1. Verificar conexiones Socket.IO
curl -X GET "https://utalk-backend.railway.app/health/socket"

# 2. Verificar logs de Socket.IO
grep "socket.*ack" logs/combined.log | tail -20

# 3. Verificar estado de Redis
redis-cli ping
redis-cli info clients
```

#### 🛠️ Solución
```bash
# 1. Verificar que Redis esté funcionando
redis-cli ping

# 2. Limpiar conexiones huérfanas
redis-cli client list | grep "idle=3600" | awk '{print $1}' | cut -d= -f2 | xargs -I {} redis-cli client kill id {}

# 3. Reiniciar Socket.IO service
railway service restart

# 4. Verificar reconexiones de clientes
tail -f logs/combined.log | grep "reconnect"
```

### 🚨 "Login falla 401"

#### 🔍 Diagnóstico
```bash
# 1. Verificar logs de autenticación
grep "auth.*401" logs/combined.log | tail -20

# 2. Verificar configuración JWT
echo $JWT_SECRET | wc -c

# 3. Verificar base de datos
curl -X GET "https://utalk-backend.railway.app/health/database"
```

#### 🛠️ Solución
```bash
# 1. Verificar que JWT_SECRET esté configurado
railway variables list | grep JWT_SECRET

# 2. Si no está configurado, generarlo
openssl rand -base64 32

# 3. Configurar la variable
railway variables set JWT_SECRET="nuevo_secret_generado"

# 4. Reiniciar el servicio
railway service restart

# 5. Verificar que el login funcione
curl -X POST https://utalk-backend.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 🚨 "Media no descarga"

#### 🔍 Diagnóstico
```bash
# 1. Verificar logs de media
grep "media.*download" logs/combined.log | tail -20

# 2. Verificar Firebase Storage
curl -X GET "https://storage.googleapis.com/storage/v1/b/utalk-media/o"

# 3. Verificar URLs firmadas
curl -X GET "https://utalk-backend.railway.app/api/media/test-id"
```

#### 🛠️ Solución
```bash
# 1. Verificar configuración de Firebase
railway variables list | grep FIREBASE

# 2. Regenerar URLs firmadas
curl -X POST https://utalk-backend.railway.app/api/media/regenerate-urls \
  -H "Authorization: Bearer admin_token"

# 3. Verificar permisos de Storage
gcloud storage ls gs://utalk-media/

# 4. Si el problema persiste, verificar credenciales
railway variables set FIREBASE_PRIVATE_KEY="nueva_clave_privada"
```

### 🚨 "Escalamiento no pausa bot"

#### 🔍 Diagnóstico
```bash
# 1. Verificar logs de escalamiento
grep "escalation.*bot" logs/combined.log | tail -20

# 2. Verificar estado de conversaciones
curl -X GET "https://utalk-backend.railway.app/api/conversations?status=escalated" \
  -H "Authorization: Bearer admin_token"

# 3. Verificar configuración de IA
curl -X GET "https://utalk-backend.railway.app/api/ai/config" \
  -H "Authorization: Bearer admin_token"
```

#### 🛠️ Solución
```bash
# 1. Verificar que el bot esté configurado correctamente
curl -X PUT "https://utalk-backend.railway.app/api/ai/config" \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "autoEscalate": true}'

# 2. Forzar pausa del bot para conversaciones escaladas
curl -X POST "https://utalk-backend.railway.app/api/conversations/force-pause-bot" \
  -H "Authorization: Bearer admin_token"

# 3. Verificar que las conversaciones escaladas no tengan bot activo
curl -X GET "https://utalk-backend.railway.app/api/conversations?botEnabled=false&status=escalated" \
  -H "Authorization: Bearer admin_token"
```

---

## 📋 GUÍA DE CAMBIOS Y DEPRECACIONES

### 🔄 Anunciar Cambios al Front
```javascript
// 1. Documentar cambios en API
const apiChanges = {
  version: '1.2.0',
  changes: [
    {
      type: 'breaking',
      endpoint: '/api/messages',
      description: 'Campo messageId ahora es requerido',
      migration: 'Agregar messageId UUID v4 a todos los requests'
    },
    {
      type: 'feature',
      endpoint: '/api/conversations',
      description: 'Nuevo campo metadata disponible',
      migration: 'Opcional, no requiere cambios'
    }
  ]
};

// 2. Notificar a través de Socket.IO
socket.emit('api:changes', {
  version: '1.2.0',
  changes: apiChanges.changes,
  migrationGuide: 'https://docs.utalk.com/migrations/v1.2.0'
});
```

### ⏰ Ventanas de Compatibilidad
```javascript
// Configuración de compatibilidad
const compatibility = {
  // Versiones soportadas
  supportedVersions: ['v1.0', 'v1.1', 'v1.2'],
  
  // Deprecation timeline
  deprecationTimeline: {
    'v1.0': {
      deprecated: '2025-01-01',
      sunset: '2025-07-01',
      migration: 'https://docs.utalk.com/migrations/v1.0-to-v1.1'
    },
    'v1.1': {
      deprecated: '2025-04-01',
      sunset: '2025-10-01',
      migration: 'https://docs.utalk.com/migrations/v1.1-to-v1.2'
    }
  },
  
  // Grace period
  gracePeriod: '6 months'
};
```

### 🚩 Feature Flags
```javascript
// Configuración de feature flags
const featureFlags = {
  // Por workspace
  workspaceFlags: {
    'new-ui': {
      enabled: true,
      rollout: '100%',
      description: 'Nueva interfaz de usuario'
    },
    'ai-enhancements': {
      enabled: false,
      rollout: '0%',
      description: 'Mejoras en IA'
    }
  },
  
  // Por usuario
  userFlags: {
    'beta-features': {
      enabled: false,
      users: ['user1@example.com', 'user2@example.com'],
      description: 'Características beta'
    }
  }
};

// Uso en código
if (featureFlags.workspaceFlags['new-ui'].enabled) {
  // Usar nueva UI
} else {
  // Usar UI legacy
}
```

---

## 📋 CHECKLIST DE LIBERACIÓN

### 🔍 Pre-Liberación
```markdown
## Pre-Release Checklist

### ✅ Funcionalidad
- [ ] Todos los tests pasando
- [ ] Coverage > 80%
- [ ] Performance tests pasando
- [ ] Security scan limpio

### 🔒 Seguridad
- [ ] No hay vulnerabilidades críticas
- [ ] Secrets rotados si es necesario
- [ ] Permisos verificados
- [ ] Inputs validados

### 📚 Documentación
- [ ] APIs documentadas
- [ ] Changelog actualizado
- [ ] Migration guide preparado
- [ ] Release notes listos

### 🚀 Deployment
- [ ] Staging environment probado
- [ ] Rollback plan preparado
- [ ] Monitoring configurado
- [ ] Alerts configurados
```

### 🚀 Durante la Liberación
```markdown
## Release Checklist

### 🔄 Deployment
- [ ] Backup de producción
- [ ] Deploy a producción
- [ ] Health checks pasando
- [ ] Smoke tests ejecutados

### 📊 Monitoreo
- [ ] Métricas de latencia
- [ ] Tasa de errores
- [ ] Throughput
- [ ] Memory usage

### 🔍 Verificación
- [ ] Funcionalidad crítica probada
- [ ] APIs respondiendo
- [ ] WebSocket funcionando
- [ ] Integraciones activas
```

### 🔍 Post-Liberación
```markdown
## Post-Release Checklist

### 📈 Métricas
- [ ] Latencia P95 < 400ms
- [ ] Error rate < 1%
- [ ] Availability > 99.9%
- [ ] Memory usage estable

### 🔍 Monitoreo
- [ ] Logs sin errores críticos
- [ ] Alerts configurados
- [ ] Dashboards actualizados
- [ ] Performance estable

### 📚 Documentación
- [ ] Release notes publicados
- [ ] Migration guide actualizado
- [ ] API docs actualizadas
- [ ] Runbooks actualizados
```

### 🔧 Configuración de Alertas
```javascript
// Configuración de alertas automáticas
const alertConfig = {
  // Alertas críticas
  critical: {
    'api-down': {
      condition: 'health_check_failed for 2 minutes',
      notification: ['slack#ops-alerts', 'pagerduty', 'sms'],
      escalation: 'immediate'
    },
    'database-down': {
      condition: 'database_connection_failed for 1 minute',
      notification: ['slack#ops-alerts', 'pagerduty', 'sms'],
      escalation: 'immediate'
    },
    'high-error-rate': {
      condition: 'error_rate > 10% for 5 minutes',
      notification: ['slack#ops-alerts', 'pagerduty'],
      escalation: '15 minutes'
    }
  },
  
  // Alertas de advertencia
  warning: {
    'high-latency': {
      condition: 'p95_latency > 500ms for 10 minutes',
      notification: ['slack#ops-alerts'],
      escalation: '30 minutes'
    },
    'high-memory': {
      condition: 'memory_usage > 85% for 15 minutes',
      notification: ['slack#ops-alerts'],
      escalation: '1 hour'
    },
    'disk-space': {
      condition: 'disk_usage > 80%',
      notification: ['slack#ops-alerts'],
      escalation: '2 hours'
    }
  }
};
```

### 🔧 Configuración de Dashboards
```javascript
// Configuración de dashboards de monitoreo
const dashboardConfig = {
  // Dashboard principal
  main: {
    title: 'UTalk Backend - Overview',
    refresh: '30s',
    panels: [
      {
        title: 'API Response Time',
        type: 'graph',
        query: 'avg(response_time) by (endpoint)',
        thresholds: { warning: 200, critical: 500 }
      },
      {
        title: 'Error Rate',
        type: 'graph',
        query: 'rate(error_count[5m])',
        thresholds: { warning: 0.01, critical: 0.05 }
      },
      {
        title: 'Active Connections',
        type: 'stat',
        query: 'socket_connections_active',
        thresholds: { warning: 5000, critical: 8000 }
      },
      {
        title: 'Memory Usage',
        type: 'gauge',
        query: 'memory_usage_percent',
        thresholds: { warning: 70, critical: 85 }
      }
    ]
  },
  
  // Dashboard de WebSocket
  websocket: {
    title: 'WebSocket Performance',
    refresh: '10s',
    panels: [
      {
        title: 'Connection Rate',
        type: 'graph',
        query: 'rate(socket_connections_total[1m])'
      },
      {
        title: 'Event Throughput',
        type: 'graph',
        query: 'rate(socket_events_total[1m])'
      },
      {
        title: 'Latency Distribution',
        type: 'heatmap',
        query: 'socket_event_duration_seconds'
      }
    ]
  }
};
```

### 🔧 Configuración de Logs
```javascript
// Configuración avanzada de logging
const loggingConfig = {
  // Niveles por ambiente
  levels: {
    development: 'debug',
    staging: 'info',
    production: 'warn'
  },
  
  // Formato de logs
  format: {
    timestamp: 'ISO',
    includeStack: true,
    includeMetadata: true,
    redactSensitive: true
  },
  
  // Transportes
  transports: {
    console: {
      enabled: true,
      level: 'info',
      colorize: true
    },
    file: {
      enabled: true,
      level: 'error',
      filename: 'logs/error.log',
      maxSize: '10MB',
      maxFiles: 5
    },
    cloudwatch: {
      enabled: process.env.NODE_ENV === 'production',
      level: 'info',
      logGroup: '/utalk/backend',
      logStream: 'app'
    }
  },
  
  // Filtros
  filters: {
    excludePaths: ['/health', '/metrics'],
    excludeUserAgents: ['health-check', 'monitoring'],
    sensitiveFields: ['password', 'token', 'secret']
  }
};
```

### 🔧 Configuración de Métricas
```javascript
// Configuración de métricas y telemetría
const metricsConfig = {
  // Métricas de aplicación
  application: {
    enabled: true,
    interval: 15000, // 15 segundos
    metrics: [
      'http_requests_total',
      'http_request_duration_seconds',
      'http_requests_in_flight',
      'nodejs_heap_size_total_bytes',
      'nodejs_heap_size_used_bytes',
      'nodejs_eventloop_lag_seconds'
    ]
  },
  
  // Métricas de negocio
  business: {
    enabled: true,
    interval: 60000, // 1 minuto
    metrics: [
      'conversations_total',
      'messages_total',
      'escalations_total',
      'bot_responses_total',
      'user_sessions_total'
    ]
  },
  
  // Métricas de WebSocket
  websocket: {
    enabled: true,
    interval: 5000, // 5 segundos
    metrics: [
      'socket_connections_active',
      'socket_connections_total',
      'socket_events_total',
      'socket_event_duration_seconds',
      'socket_errors_total'
    ]
  }
};
```

---

**📝 Nota**: Este documento es la fuente de verdad para operaciones y runbooks. Cualquier cambio en procedimientos debe ser documentado aquí. 