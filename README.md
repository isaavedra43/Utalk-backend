# 🚀 UTalk Backend

> **Sistema de Mensajería Multicanal con CRM, Campañas y Chatbot**  
> **Versión**: 1.0.0  
> **Estado**: 🟢 Ready for Production – audited 2025-08-01

## 📋 Descripción

UTalk es un sistema completo de mensajería multicanal que integra CRM, gestión de campañas, equipos de agentes y chatbot inteligente. El backend proporciona una API REST robusta y escalable para gestionar todas las operaciones del sistema.

### 🎯 Características Principales

- **💬 Mensajería Multicanal**: WhatsApp, SMS, Email
- **👥 Gestión de Equipos**: Roles, permisos, asignación de conversaciones
- **📊 CRM Integrado**: Contactos, conversaciones, historial completo
- **📢 Campañas de Marketing**: Envío masivo, segmentación, tracking
- **🤖 Chatbot Inteligente**: Respuestas automáticas, integración con IA
- **📚 Base de Conocimientos**: Artículos, FAQs, sistema de votos
- **📈 Analytics**: Dashboard completo con métricas en tiempo real
- **🔐 Seguridad Enterprise**: JWT, CORS, Rate Limiting, Auditoría

## 🛠️ Tecnologías

### Core
- **Node.js** (v18+) - Runtime de JavaScript
- **Express.js** (v4.18+) - Framework web
- **Firebase** - Base de datos y autenticación
- **JWT** - Autenticación y autorización

### Base de Datos
- **Firestore** - Base de datos NoSQL
- **Firebase Storage** - Almacenamiento de archivos
- **Redis** (opcional) - Cache y rate limiting

### Servicios Externos
- **Twilio** - API de mensajería (WhatsApp, SMS)
- **OpenAI** - Procesamiento de audio y IA
- **Railway** - Plataforma de deployment

### Herramientas de Desarrollo
- **Winston** - Sistema de logging
- **Joi** - Validación de datos
- **Multer** - Manejo de archivos
- **Compression** - Compresión de respuestas
- **Helmet** - Seguridad HTTP

## 📁 Estructura del Proyecto

```
Utalk-backend/
├── 📁 src/
│   ├── 📁 config/           # Configuraciones (Firebase, JWT, etc.)
│   ├── 📁 controllers/      # Lógica de negocio
│   ├── 📁 middleware/       # Middlewares (auth, validation, etc.)
│   ├── 📁 models/          # Modelos de datos
│   ├── 📁 routes/          # Definición de rutas API
│   ├── 📁 services/        # Servicios especializados
│   ├── 📁 socket/          # WebSocket para tiempo real
│   ├── 📁 utils/           # Utilidades y helpers
│   ├── 📄 index.js         # Servidor principal (enterprise)
│   └── 📄 index-simple.js  # Servidor simplificado (producción)
├── 📁 docs/               # Documentación
│   └── 📄 API.md          # Documentación completa de la API
├── 📁 tests/              # Tests unitarios e integración
├── 📁 uploads/            # Archivos subidos
├── 📄 package.json        # Dependencias y scripts
├── 📄 env.example         # Variables de entorno de ejemplo
├── 📄 Dockerfile          # Configuración Docker
└── 📄 README.md           # Este archivo
```

## 🚀 Instalación y Configuración

### Prerrequisitos

- **Node.js** v18 o superior
- **npm** v8 o superior
- **Cuenta de Firebase** con proyecto configurado
- **Cuenta de Twilio** (para mensajería)

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/utalk-backend.git
cd utalk-backend
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Copia el archivo de ejemplo y configura tus variables:

```bash
cp env.example .env
```

#### Variables Críticas (REQUERIDAS)

```bash
# 🔐 AUTENTICACIÓN
JWT_SECRET=tu-super-secreto-jwt-aqui
JWT_REFRESH_SECRET=tu-refresh-token-secreto

# 🔥 FIREBASE
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# 📱 TWILIO
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu-auth-token-twilio
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# 🎯 CONFIGURACIÓN
NODE_ENV=development
PORT=3001
```

#### Variables Opcionales

```bash
# 🗄️ REDIS (opcional)
REDIS_URL=redis://localhost:6379

# 🤖 OPENAI (para procesamiento de audio)
OPENAI_API_KEY=sk-tu-openai-api-key

# 📊 LOGGING
LOG_LEVEL=info
ENABLE_FILE_LOGGING=true

# 🔒 CORS
CORS_ORIGINS=https://utalk.com,https://app.utalk.com
```

### 4. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crea un nuevo proyecto o usa uno existente
3. Habilita **Firestore Database** y **Storage**
4. Ve a **Project Settings** > **Service Accounts**
5. Genera una nueva clave privada
6. Copia el JSON completo a `FIREBASE_SERVICE_ACCOUNT_KEY`

### 5. Configurar Twilio

1. Ve a [Twilio Console](https://console.twilio.com)
2. Obtén tu **Account SID** y **Auth Token**
3. Configura un número de WhatsApp en **Messaging** > **Try it out**
4. Actualiza las variables de entorno con tus credenciales

### 6. Ejecutar el Servidor

#### Desarrollo
```bash
npm run dev
```

#### Producción
```bash
npm start
```

#### Con Docker
```bash
docker build -t utalk-backend .
docker run -p 3001:3001 utalk-backend
```

## 🧪 Testing

### Ejecutar Tests
```bash
# Tests unitarios
npm test

# Tests de integración
npm run test:integration

# Tests de seguridad
npm run test:security

# Coverage
npm run test:coverage
```

### Probar con Postman

1. **Importar Collection**: Usa la colección de Postman incluida en `/docs/postman/`
2. **Configurar Variables**:
   - `baseUrl`: `http://localhost:3001`
   - `token`: Token JWT obtenido del login
3. **Ejecutar Tests**: La colección incluye tests automáticos

### Probar con cURL

```bash
# Health check
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@utalk.com","password":"password123"}'

# Obtener contactos (con token)
curl -X GET http://localhost:3001/api/contacts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🚀 Deployment

### Railway (Recomendado)

1. **Conectar Repositorio**:
   ```bash
   # Instalar Railway CLI
   npm install -g @railway/cli
   
   # Login y deploy
   railway login
   railway init
   railway up
   ```

2. **Configurar Variables**:
   - Ve a tu proyecto en Railway
   - Configura todas las variables de entorno
   - Especialmente las variables críticas (JWT, Firebase, Twilio)

3. **Variables de Railway**:
   ```bash
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=tu-secreto-produccion
   FIREBASE_PROJECT_ID=tu-proyecto
   TWILIO_ACCOUNT_SID=ACxxx
   TWILIO_AUTH_TOKEN=tu-token
   CORS_ORIGINS=https://utalk.com,https://app.utalk.com
   ```

### Docker

```bash
# Build
docker build -t utalk-backend .

# Run
docker run -d \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e JWT_SECRET=tu-secreto \
  -e FIREBASE_PROJECT_ID=tu-proyecto \
  utalk-backend
```

### Heroku

```bash
# Crear app
heroku create utalk-backend

# Configurar variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=tu-secreto
heroku config:set FIREBASE_PROJECT_ID=tu-proyecto

# Deploy
git push heroku main
```

## 🔐 Seguridad

### Características Implementadas

- ✅ **JWT Authentication** - Tokens seguros con refresh
- ✅ **Role-Based Access Control** - Roles: admin, agent, viewer
- ✅ **CORS Protection** - Lista blanca de dominios en producción
- ✅ **Rate Limiting** - Prevención de abuso
- ✅ **Input Validation** - Validación con Joi
- ✅ **SQL Injection Protection** - Firestore sanitization
- ✅ **XSS Protection** - Headers de seguridad
- ✅ **Audit Logging** - Registro de todas las operaciones
- ✅ **Error Handling** - Manejo seguro de errores

### Headers de Seguridad

```javascript
// Configurados automáticamente
helmet() // XSS, Content Security Policy
compression() // Compresión gzip
cors() // CORS protection
```

## 📊 Monitoreo y Logs

### Logs Estructurados

El sistema usa Winston para logging estructurado:

```javascript
// Ejemplo de log
{
  "timestamp": "2025-08-01T22:00:00.000Z",
  "level": "info",
  "message": "Usuario autenticado",
  "category": "AUTH",
  "userId": "user_123",
  "ip": "192.168.1.1"
}
```

### Métricas Disponibles

- **Performance**: Response time, throughput
- **Errors**: Error rate, error types
- **Business**: Users, messages, campaigns
- **System**: Memory, CPU, uptime

### Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-01T22:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "server": {"status": "healthy"},
    "memory": {"status": "healthy", "heapUsed": "48MB"},
    "process": {"status": "healthy", "pid": 12345}
  }
}
```

## 🔧 Configuración Avanzada

### Variables de Entorno Completas

Consulta `env.example` para todas las variables disponibles:

- **🔐 Autenticación**: JWT secrets, expiración
- **🗄️ Base de Datos**: Firebase config
- **📱 Mensajería**: Twilio credentials
- **🤖 IA**: OpenAI API key
- **📊 Logging**: Niveles, archivos
- **🔒 Seguridad**: Rate limiting, CORS
- **⚡ Performance**: Cache, compression

### Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Servidor de desarrollo con nodemon
npm run start        # Servidor de producción

# Testing
npm test             # Tests unitarios
npm run test:watch   # Tests en modo watch
npm run test:coverage # Coverage report

# Linting
npm run lint         # ESLint
npm run lint:fix     # Auto-fix linting issues

# Database
npm run db:seed      # Seed database
npm run db:migrate   # Run migrations

# Utils
npm run docs:generate # Generar documentación
npm run security:audit # Auditoría de seguridad
```

## 📚 Documentación

### API Documentation

- **📄 [API.md](docs/API.md)** - Documentación completa de la API
- **📋 [Postman Collection](docs/postman/)** - Colección de Postman
- **🔧 [Environment Variables](env.example)** - Variables de entorno

### Guías

- **🚀 [Deployment Guide](docs/DEPLOYMENT.md)** - Guía de deployment
- **🔐 [Security Guide](docs/SECURITY.md)** - Guía de seguridad
- **🧪 [Testing Guide](docs/TESTING.md)** - Guía de testing

## 🤝 Contribución

### Flujo de Trabajo

1. **Fork** el repositorio
2. **Crea** una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. **Commit** tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. **Push** a la rama (`git push origin feature/nueva-funcionalidad`)
5. **Crea** un Pull Request

### Estándares de Código

- **ESLint** para linting
- **Prettier** para formateo
- **Conventional Commits** para commits
- **JSDoc** para documentación de código

### Tests

- **Unit Tests**: Jest
- **Integration Tests**: Supertest
- **Security Tests**: OWASP ZAP
- **Coverage**: Mínimo 80%

## 📞 Soporte

### Canales de Soporte

- **🐛 Issues**: [GitHub Issues](https://github.com/tu-usuario/utalk-backend/issues)
- **💬 Discord**: [UTalk Community](https://discord.gg/utalk)
- **📧 Email**: support@utalk.com

### Reportar Bugs

Por favor incluye:

1. **Descripción** del problema
2. **Pasos** para reproducir
3. **Comportamiento esperado** vs actual
4. **Logs** relevantes
5. **Versión** del sistema

## 📄 Licencia


## 🙏 Agradecimientos

- **Firebase** por la infraestructura
- **Twilio** por las APIs de mensajería
- **OpenAI** por las capacidades de IA
- **Railway** por la plataforma de deployment

---

**🟢 Estado del Backend**: Ready for Production – audited 2025-08-01

*Última actualización: 2025-08-01* 