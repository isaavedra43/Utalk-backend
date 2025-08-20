# 🔧 SERVICIOS, MÓDULOS Y MIDDLEWARE - UTalk Backend

## 📋 CORE Y CAPAS

### 🏗️ Arquitectura de Capas
```
┌─────────────────────────────────────┐
│           ROUTES                    │ ← Endpoints y validación de entrada
├─────────────────────────────────────┤
│         CONTROLLERS                 │ ← Lógica de presentación y respuesta
├─────────────────────────────────────┤
│          SERVICES                   │ ← Lógica de negocio
├─────────────────────────────────────┤
│       REPOSITORIES                  │ ← Acceso a datos
├─────────────────────────────────────┤
│      EXTERNAL PROVIDERS             │ ← APIs externas (Twilio, Firebase, etc.)
└─────────────────────────────────────┘
```

### 📁 Estructura de Carpetas
```
src/
├── routes/           # Definición de endpoints
├── controllers/      # Lógica de presentación
├── services/         # Lógica de negocio
├── repositories/     # Acceso a datos
├── middleware/       # Middlewares de Express
├── models/          # Modelos de datos
├── config/          # Configuraciones
├── utils/           # Utilidades compartidas
└── ai/              # Integraciones de IA
```

---

## 🔧 MÓDULOS (POR CARPETA)

### 🔐 AUTHENTICATION

#### 📁 Ubicación: `src/controllers/AuthController.js`, `src/services/AuthService.js`

#### 🎯 Responsabilidades
- **Hashing de contraseñas**: bcrypt con salt rounds 12
- **JWT Generation**: Access tokens (15min) + Refresh tokens (7 días)
- **Refresh Token Management**: Rotación y invalidación
- **Roles y permisos**: admin, agent, bot, service
- **Flujo de login y recuperación**: MFA opcional

#### 🔧 Funciones Principales
```javascript
// AuthService.js
class AuthService {
  static async login(email, password, deviceInfo) { /* ... */ }
  static async refreshToken(refreshToken) { /* ... */ }
  static async logout(refreshToken) { /* ... */ }
  static async changePassword(userId, oldPassword, newPassword) { /* ... */ }
  static async resetPassword(email) { /* ... */ }
  static async validateToken(token) { /* ... */ }
}

// AuthController.js
class AuthController {
  static async login(req, res) { /* ... */ }
  static async logout(req, res) { /* ... */ }
  static async refresh(req, res) { /* ... */ }
  static async changePassword(req, res) { /* ... */ }
}
```

#### 🔒 Seguridad
- **Password Hashing**: bcrypt con salt rounds 12
- **JWT Secret**: Variable de entorno `JWT_SECRET`
- **Token Expiration**: Access (15min), Refresh (7 días)
- **Rate Limiting**: 5 login attempts/minuto
- **Device Tracking**: Información de dispositivo para auditoría

### 👤 USERS

#### 📁 Ubicación: `src/controllers/TeamController.js`, `src/services/ContactService.js`

#### 🎯 Responsabilidades
- **Perfil de usuario**: Información personal y preferencias
- **Estados de usuario**: activo, inactivo, baneado
- **Límites y cuotas**: Máximo conversaciones por agente
- **Gestión de equipos**: Asignación de agentes a conversaciones

#### 🔧 Funciones Principales
```javascript
// ContactService.js
class ContactService {
  static async getProfile(userId) { /* ... */ }
  static async updateProfile(userId, profileData) { /* ... */ }
  static async updatePreferences(userId, preferences) { /* ... */ }
  static async getTeamMembers(workspaceId) { /* ... */ }
  static async updateUserStatus(userId, status) { /* ... */ }
}

// TeamController.js
class TeamController {
  static async getProfile(req, res) { /* ... */ }
  static async updateProfile(req, res) { /* ... */ }
  static async getTeamMembers(req, res) { /* ... */ }
  static async getTeamKPIs(req, res) { /* ... */ }
}
```

#### 📊 Estados de Usuario
- **active**: Usuario activo y disponible
- **inactive**: Usuario inactivo temporalmente
- **banned**: Usuario suspendido permanentemente
- **offline**: Usuario desconectado

### 💬 CONVERSATIONS

#### 📁 Ubicación: `src/controllers/ConversationController.js`, `src/services/ConversationService.js`

#### 🎯 Responsabilidades
- **Creación de conversaciones**: Generación de IDs únicos
- **Estados de conversación**: open, pending, closed, escalated
- **Ownership y asignación**: Asignación a agentes
- **Metadata y tags**: Información adicional del cliente

#### 🔧 Funciones Principales
```javascript
// ConversationService.js
class ConversationService {
  static async createConversation(participants, channel) { /* ... */ }
  static async getConversationById(id) { /* ... */ }
  static async listConversations(filters, pagination) { /* ... */ }
  static async updateConversationStatus(id, status) { /* ... */ }
  static async assignConversation(id, agentId) { /* ... */ }
  static async returnToBot(id, reason) { /* ... */ }
  static async getConversationStats(workspaceId) { /* ... */ }
}

// ConversationController.js
class ConversationController {
  static async getConversations(req, res) { /* ... */ }
  static async getConversation(req, res) { /* ... */ }
  static async assignConversation(req, res) { /* ... */ }
  static async returnToBot(req, res) { /* ... */ }
}
```

#### 📊 Estados de Conversación
- **open**: Conversación activa y abierta
- **pending**: Esperando respuesta del agente
- **closed**: Conversación cerrada
- **escalated**: Escalada a agente humano

### 📨 MESSAGES

#### 📁 Ubicación: `src/controllers/MessageController.js`, `src/services/MessageService.js`

#### 🎯 Responsabilidades
- **Tipos de mensaje**: texto, imagen, audio, archivo, ubicación, sticker
- **Validación de contenido**: Sanitización y validación
- **Deduplicación**: Por messageId (UUID v4)
- **Reintentos**: Manejo de fallos de entrega
- **Adjuntos**: Gestión de archivos multimedia

#### 🔧 Funciones Principales
```javascript
// MessageService.js
class MessageService {
  static async sendMessage(messageData) { /* ... */ }
  static async getMessages(conversationId, filters) { /* ... */ }
  static async updateMessageStatus(messageId, status) { /* ... */ }
  static async processWebhook(webhookData) { /* ... */ }
  static async retryFailedMessage(messageId) { /* ... */ }
  static async markAsRead(conversationId, messageId) { /* ... */ }
}

// MessageController.js
class MessageController {
  static async sendMessage(req, res) { /* ... */ }
  static async getMessages(req, res) { /* ... */ }
  static async markAsRead(req, res) { /* ... */ }
}
```

#### 📋 Tipos de Mensaje
- **text**: Mensaje de texto plano
- **image**: Imagen (JPEG, PNG, GIF)
- **audio**: Audio (MP3, WAV, OGG)
- **file**: Documento (PDF, DOC, XLS)
- **location**: Ubicación geográfica
- **sticker**: Sticker de WhatsApp

### 📎 MEDIA

#### 📁 Ubicación: `src/controllers/MediaUploadController.js`, `src/services/FileService.js`

#### 🎯 Responsabilidades
- **Intake de archivos**: Validación de MIME types
- **Antivirus opcional**: Escaneo de archivos maliciosos
- **Almacenamiento**: Firebase Storage con URLs firmadas
- **Optimización**: Compresión y redimensionamiento
- **Gestión de metadatos**: Información del archivo

#### 🔧 Funciones Principales
```javascript
// FileService.js
class FileService {
  static async uploadFile(file, metadata) { /* ... */ }
  static async getFileInfo(fileId) { /* ... */ }
  static async generateSignedUrl(fileId) { /* ... */ }
  static async deleteFile(fileId) { /* ... */ }
  static async validateFile(file) { /* ... */ }
  static async optimizeImage(buffer, options) { /* ... */ }
}

// MediaUploadController.js
class MediaUploadController {
  static async uploadFile(req, res) { /* ... */ }
  static async getFileInfo(req, res) { /* ... */ }
  static async downloadFile(req, res) { /* ... */ }
}
```

#### 📋 Tipos de Archivo Soportados
- **Imágenes**: JPEG, PNG, GIF, WebP (max 10MB)
- **Audio**: MP3, WAV, OGG (max 50MB)
- **Video**: MP4, AVI, MOV (max 100MB)
- **Documentos**: PDF, DOC, DOCX, XLS, XLSX (max 25MB)

### 🤖 AI

#### 📁 Ubicación: `src/controllers/AIController.js`, `src/services/AIService.js`, `src/ai/`

#### 🎯 Responsabilidades
- **Proveedor de LLM**: OpenAI, Anthropic, Google Gemini
- **Timeouts y retries**: Manejo de fallos de API
- **Guardrails**: Prevención de alucinaciones
- **Contexto y memoria**: Mantenimiento de conversación
- **Escalamiento inteligente**: Detección de intención

#### 🔧 Funciones Principales
```javascript
// AIService.js
class AIService {
  static async generateResponse(prompt, context) { /* ... */ }
  static async analyzeIntent(message) { /* ... */ }
  static async detectEscalation(message) { /* ... */ }
  static async getConversationContext(conversationId) { /* ... */ }
  static async updateContext(conversationId, message) { /* ... */ }
}

// AIController.js
class AIController {
  static async generateResponse(req, res) { /* ... */ }
  static async analyzeIntent(req, res) { /* ... */ }
  static async getAIConfig(req, res) { /* ... */ }
  static async updateAIConfig(req, res) { /* ... */ }
}
```

#### 🤖 Proveedores de IA
- **OpenAI**: GPT-4o-mini, GPT-4o (principal)
- **Anthropic**: Claude-3-haiku, Claude-3-sonnet
- **Google**: Gemini-1.5-flash, Gemini-1.5-pro

### 🚨 ESCALAMIENTO

#### 📁 Ubicación: `src/services/ConversationService.js` (escalamiento)

#### 🎯 Responsabilidades
- **Reglas de escalamiento**: Palabras clave, intención, manual
- **Pausa de bot**: Desactivación temporal del bot
- **Retorno por inactividad**: Reactivación después de 12h
- **Asignación de agentes**: Lógica de distribución de carga

#### 🔧 Funciones Principales
```javascript
// ConversationService.js (escalamiento)
class EscalationService {
  static async detectEscalationTrigger(message) { /* ... */ }
  static async escalateConversation(conversationId, reason) { /* ... */ }
  static async assignToAgent(conversationId, agentId) { /* ... */ }
  static async returnToBot(conversationId, reason) { /* ... */ }
  static async checkInactivityTimeout() { /* ... */ }
}
```

#### 🎯 Reglas de Escalamiento
- **Palabras clave**: "urgente", "problema", "queja"
- **Intención**: Análisis de sentimiento negativo
- **Manual**: Escalamiento por agente
- **Timeout**: 12 horas de inactividad

### 🔗 INTEGRACIONES

#### 📁 Ubicación: `src/services/TwilioMediaService.js`, `src/controllers/TwilioStatusController.js`

#### 🎯 Responsabilidades
- **Twilio**: WhatsApp Business API
- **Facebook**: Messenger API
- **Chatwoot**: Integración opcional
- **Adapters**: Mapeo de estados y formatos
- **Firma y verificación**: Seguridad de webhooks

#### 🔧 Funciones Principales
```javascript
// TwilioMediaService.js
class TwilioService {
  static async sendMessage(to, content, options) { /* ... */ }
  static async processWebhook(webhookData) { /* ... */ }
  static async verifySignature(signature, url, body) { /* ... */ }
  static async getMessageStatus(messageSid) { /* ... */ }
}

// FacebookService.js
class FacebookService {
  static async sendMessage(recipientId, message) { /* ... */ }
  static async processWebhook(webhookData) { /* ... */ }
  static async verifyWebhook(mode, token, challenge) { /* ... */ }
}
```

#### 🔗 Proveedores Integrados
- **Twilio**: WhatsApp Business API
- **Facebook**: Messenger Platform
- **Chatwoot**: Sistema de tickets (opcional)

### 📊 KPIs Y REPORTING

#### 📁 Ubicación: `src/controllers/AnalyticsController.js`, `src/services/ReportService.js`

#### 🎯 Responsabilidades
- **Agregadores**: Cálculo de métricas en tiempo real
- **Ventanas de tiempo**: Períodos configurables
- **Caché**: Optimización de consultas frecuentes
- **Exportación**: Reportes en CSV/PDF

#### 🔧 Funciones Principales
```javascript
// ReportService.js
class ReportService {
  static async getConversationKPIs(workspaceId, period) { /* ... */ }
  static async getAgentKPIs(workspaceId, period) { /* ... */ }
  static async getChannelKPIs(workspaceId, period) { /* ... */ }
  static async generateReport(type, filters) { /* ... */ }
  static async exportData(format, filters) { /* ... */ }
}

// AnalyticsController.js
class AnalyticsController {
  static async getConversationKPIs(req, res) { /* ... */ }
  static async getAgentKPIs(req, res) { /* ... */ }
  static async generateReport(req, res) { /* ... */ }
}
```

#### 📈 Métricas Principales
- **TMO Bot**: Tiempo medio de respuesta del bot
- **FCR**: Resolución en primer contacto
- **ASA Agente**: Tiempo medio de respuesta del agente
- **Tasa de escalamiento**: Porcentaje de conversaciones escaladas

---

## 🔧 MIDDLEWARES

### 🆔 Request ID
**Ubicación**: `src/middleware/correlation.js`
**Propósito**: Generar ID único para cada request
**Implementación**:
```javascript
// Agregar requestId a cada request
req.requestId = uuidv4();
res.setHeader('X-Request-ID', req.requestId);
```

### 🔐 Authorization
**Ubicación**: `src/middleware/auth.js`
**Propósito**: Validar JWT tokens y roles
**Implementación**:
```javascript
// Verificar token y extraer usuario
const token = req.headers.authorization?.split(' ')[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded;
```

### ⚡ Rate Limiting
**Ubicación**: `src/middleware/intelligentRateLimit.js`
**Propósito**: Limitar requests por usuario/endpoint
**Implementación**:
```javascript
// Rate limiting adaptativo
const key = `${req.user.id}:${req.path}`;
const limit = getLimitForEndpoint(req.path);
const current = await redis.incr(key);
```

### 📝 Schema Validation
**Ubicación**: `src/middleware/validation.js`
**Propósito**: Validar request body/query
**Implementación**:
```javascript
// Validación con Joi
const schema = getSchemaForEndpoint(req.path);
const { error, value } = schema.validate(req.body);
if (error) throw new ValidationError(error);
```

### 🛡️ Error Handler
**Ubicación**: `src/middleware/enhancedErrorHandler.js`
**Propósito**: Manejo centralizado de errores
**Implementación**:
```javascript
// Capturar y formatear errores
app.use((error, req, res, next) => {
  const errorResponse = formatError(error);
  res.status(errorResponse.status).json(errorResponse);
});
```

### 📊 Audit Log
**Ubicación**: `src/middleware/logging.js`
**Propósito**: Logging de acciones importantes
**Implementación**:
```javascript
// Log de acciones críticas
logger.info('User action', {
  userId: req.user.id,
  action: req.method + ' ' + req.path,
  requestId: req.requestId
});
```

---

## 🔄 JOBS/WORKERS

### 🔄 Reintentos de Entrega
**Ubicación**: `src/services/MessageService.js`
**Propósito**: Reintentar mensajes fallidos
**Implementación**:
```javascript
// Cola de reintentos con backoff exponencial
const retryQueue = new Queue('message-retry');
retryQueue.process(async (job) => {
  const { messageId, attempt } = job.data;
  await retryMessage(messageId, attempt);
});
```

### 🧹 Limpieza de Media Huérfana
**Ubicación**: `src/services/FileService.js`
**Propósito**: Eliminar archivos sin referencias
**Implementación**:
```javascript
// Job diario de limpieza
cron.schedule('0 2 * * *', async () => {
  const orphanedFiles = await findOrphanedFiles();
  await deleteOrphanedFiles(orphanedFiles);
});
```

### 📦 Compactación de Conversaciones
**Ubicación**: `src/services/ConversationService.js`
**Propósito**: Optimizar almacenamiento
**Implementación**:
```javascript
// Compactar conversaciones antiguas
cron.schedule('0 3 * * 0', async () => {
  const oldConversations = await findOldConversations();
  await compactConversations(oldConversations);
});
```

---

## 🔧 VARIABLES DE ENTORNO (POR MÓDULO)

### 🔐 AUTHENTICATION
| Variable | Descripción | Ejemplo | Requerida |
|----------|-------------|---------|-----------|
| `JWT_SECRET` | Clave secreta para JWT | `your-super-secret-key` | ✅ S |
| `JWT_EXPIRES_IN` | Expiración del token | `900` (15min) | ❌ N |
| `REFRESH_TOKEN_EXPIRES_IN` | Expiración refresh token | `604800` (7 días) | ❌ N |
| `BCRYPT_ROUNDS` | Rounds para hashing | `12` | ❌ N |

### 🔥 FIREBASE
| Variable | Descripción | Ejemplo | Requerida |
|----------|-------------|---------|-----------|
| `FIREBASE_PROJECT_ID` | ID del proyecto Firebase | `utalk-backend` | ✅ S |
| `FIREBASE_PRIVATE_KEY` | Clave privada del servicio | `-----BEGIN PRIVATE KEY-----` | ✅ S |
| `FIREBASE_CLIENT_EMAIL` | Email del cliente de servicio | `firebase-adminsdk@...` | ✅ S |
| `FIREBASE_STORAGE_BUCKET` | Bucket de almacenamiento | `utalk-media` | ✅ S |

### 📱 TWILIO
| Variable | Descripción | Ejemplo | Requerida |
|----------|-------------|---------|-----------|
| `TWILIO_ACCOUNT_SID` | SID de la cuenta Twilio | `AC123456789` | ✅ S |
| `TWILIO_AUTH_TOKEN` | Token de autenticación | `your-auth-token` | ✅ S |
| `TWILIO_PHONE_NUMBER` | Número de WhatsApp | `+1234567890` | ✅ S |
| `TWILIO_WEBHOOK_SECRET` | Secreto para webhooks | `webhook-secret` | ❌ N |

### 📘 FACEBOOK
| Variable | Descripción | Ejemplo | Requerida |
|----------|-------------|---------|-----------|
| `FB_APP_ID` | ID de la aplicación Facebook | `123456789` | ❌ N |
| `FB_APP_SECRET` | Secreto de la aplicación | `app-secret` | ❌ N |
| `FB_PAGE_ACCESS_TOKEN` | Token de acceso de página | `page-access-token` | ❌ N |
| `FB_WEBHOOK_VERIFY_TOKEN` | Token de verificación | `verify-token` | ❌ N |

### 🤖 AI
| Variable | Descripción | Ejemplo | Requerida |
|----------|-------------|---------|-----------|
| `OPENAI_API_KEY` | API key de OpenAI | `sk-...` | ✅ S |
| `OPENAI_MODEL` | Modelo a usar | `gpt-4o-mini` | ❌ N |
| `ANTHROPIC_API_KEY` | API key de Anthropic | `sk-ant-...` | ❌ N |
| `GEMINI_API_KEY` | API key de Google | `AIza...` | ❌ N |

### 🔗 CHATWOOT (OPCIONAL)
| Variable | Descripción | Ejemplo | Requerida |
|----------|-------------|---------|-----------|
| `CHATWOOT_TOKEN` | Token de acceso Chatwoot | `chatwoot-token` | ❌ N |
| `CHATWOOT_BASE_URL` | URL base de Chatwoot | `https://app.chatwoot.com` | ❌ N |
| `CHATWOOT_ACCOUNT_ID` | ID de la cuenta | `1` | ❌ N |

### 🔧 REDIS
| Variable | Descripción | Ejemplo | Requerida |
|----------|-------------|---------|-----------|
| `REDIS_URL` | URL de conexión Redis | `redis://localhost:6379` | ❌ N |
| `REDIS_PASSWORD` | Contraseña de Redis | `redis-password` | ❌ N |
| `REDIS_DB` | Base de datos Redis | `0` | ❌ N |

### 🌐 SERVER
| Variable | Descripción | Ejemplo | Requerida |
|----------|-------------|---------|-----------|
| `PORT` | Puerto del servidor | `3001` | ❌ N |
| `NODE_ENV` | Ambiente de ejecución | `production` | ❌ N |
| `CORS_ORIGIN` | Orígenes permitidos CORS | `https://app.utalk.com` | ❌ N |
| `LOG_LEVEL` | Nivel de logging | `info` | ❌ N |

---

## 🚀 GUÍA PARA AÑADIR UN MÓDULO NUEVO

### 📋 Checklist de Creación

#### 1. 📁 Estructura de Carpetas
```bash
src/
├── controllers/
│   └── NewModuleController.js
├── services/
│   └── NewModuleService.js
├── repositories/
│   └── NewModuleRepository.js
├── routes/
│   └── newModule.js
├── models/
│   └── NewModule.js
└── middleware/
    └── newModuleValidation.js
```

#### 2. 🔧 Contrato Mínimo
```javascript
// NewModuleController.js
class NewModuleController {
  static async create(req, res) { /* ... */ }
  static async getById(req, res) { /* ... */ }
  static async update(req, res) { /* ... */ }
  static async delete(req, res) { /* ... */ }
  static async list(req, res) { /* ... */ }
}

// NewModuleService.js
class NewModuleService {
  static async create(data) { /* ... */ }
  static async getById(id) { /* ... */ }
  static async update(id, data) { /* ... */ }
  static async delete(id) { /* ... */ }
  static async list(filters) { /* ... */ }
}
```

#### 3. 📝 DTOs y Validación
```javascript
// validation/schemas.js
const newModuleSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  status: Joi.string().valid('active', 'inactive').default('active')
});

// middleware/newModuleValidation.js
const validateNewModule = (req, res, next) => {
  const { error } = newModuleSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details });
  next();
};
```

#### 4. 🧪 Pruebas
```javascript
// tests/newModule.test.js
describe('NewModule', () => {
  test('should create new module', async () => { /* ... */ });
  test('should validate required fields', async () => { /* ... */ });
  test('should handle errors gracefully', async () => { /* ... */ });
});
```

#### 5. 📚 Documentación
- [ ] Actualizar `02_APIS_ENDPOINTS_Y_CONTRATOS.md`
- [ ] Agregar variables de entorno en este documento
- [ ] Documentar en README del módulo
- [ ] Crear ejemplos de uso

### 🔄 Flujo de Integración

#### 1. **Desarrollo**
```bash
# Crear rama feature
git checkout -b feature/new-module

# Implementar módulo
# Crear tests
# Documentar cambios
```

#### 2. **Testing**
```bash
# Ejecutar tests
npm test

# Test de integración
npm run test:integration

# Test de performance
npm run test:performance
```

#### 3. **Code Review**
- [ ] Revisión de código
- [ ] Aprobación de tests
- [ ] Validación de documentación
- [ ] Verificación de seguridad

#### 4. **Deployment**
```bash
# Merge a main
git checkout main
git merge feature/new-module

# Deploy automático
# Railway detecta cambios y despliega
```

### 📊 Métricas de Calidad

#### 🎯 Objetivos por Módulo
- **Test Coverage**: > 80%
- **Documentation**: 100% de endpoints documentados
- **Performance**: < 200ms respuesta promedio
- **Error Rate**: < 1% de errores 5xx

#### 🔍 Checklist de Calidad
- [ ] **Funcionalidad**: Todos los casos de uso implementados
- [ ] **Seguridad**: Validación y sanitización de inputs
- [ ] **Performance**: Optimización de queries y cache
- [ ] **Mantenibilidad**: Código limpio y bien documentado
- [ ] **Testabilidad**: Tests unitarios y de integración
- [ ] **Observabilidad**: Logging y métricas implementados

---

## 🔧 CONFIGURACIÓN Y OPTIMIZACIÓN

### ⚙️ Configuración por Ambiente

#### Development
```javascript
// config/development.js
module.exports = {
  database: {
    host: 'localhost',
    port: 8080
  },
  logging: {
    level: 'debug',
    prettyPrint: true
  },
  rateLimit: {
    enabled: false
  }
};
```

#### Production
```javascript
// config/production.js
module.exports = {
  database: {
    host: process.env.FIREBASE_PROJECT_ID,
    port: 443
  },
  logging: {
    level: 'info',
    prettyPrint: false
  },
  rateLimit: {
    enabled: true,
    windowMs: 15 * 60 * 1000,
    max: 100
  }
};
```

### 🚀 Optimizaciones

#### Database
- **Indexes**: Índices en campos de búsqueda frecuente
- **Pagination**: Cursor-based pagination para grandes datasets
- **Caching**: Redis para datos frecuentemente accedidos
- **Connection Pooling**: Reutilización de conexiones

#### Memory
- **Garbage Collection**: Configuración optimizada para Node.js
- **Memory Leaks**: Monitoreo y cleanup automático
- **Streaming**: Para archivos grandes
- **Compression**: Gzip para responses

#### Network
- **CDN**: Firebase Hosting para archivos estáticos
- **Caching**: Headers de cache apropiados
- **Compression**: Gzip/Brotli para responses
- **Connection Keep-Alive**: Reutilización de conexiones HTTP

---

**📝 Nota**: Este documento es la fuente de verdad para la arquitectura interna del backend. Cualquier cambio en módulos debe ser documentado aquí. 