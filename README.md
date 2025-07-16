# 🚀 UTalk Backend - API Completa de Mensajería en Tiempo Real

> **Backend profesional para aplicaciones de mensajería tipo WhatsApp Web, Chatwoot, Intercom, Tidio**

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Latest-orange.svg)](https://firebase.google.com/)
[![Twilio](https://img.shields.io/badge/Twilio-WhatsApp-blue.svg)](https://www.twilio.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.7+-red.svg)](https://socket.io/)
[![Production](https://img.shields.io/badge/Status-Production%20Ready-success.svg)](https://utalk-backend.railway.app/health)

## 📋 Tabla de Contenidos

- [🌟 Características Principales](#-características-principales)
- [🏗️ Arquitectura del Sistema](#-arquitectura-del-sistema)
- [🚀 Instalación y Configuración](#-instalación-y-configuración)
- [📡 API REST Completa](#-api-rest-completa)
- [⚡ Socket.IO - Tiempo Real](#-socketio---tiempo-real)
- [💬 Sistema de Conversaciones](#-sistema-de-conversaciones)
- [📎 Gestión de Multimedia](#-gestión-de-multimedia)
- [👥 Gestión de Usuarios y Roles](#-gestión-de-usuarios-y-roles)
- [📊 Analytics y Métricas](#-analytics-y-métricas)
- [🔧 Desarrollo y Testing](#-desarrollo-y-testing)
- [🚀 Deployment](#-deployment)

## 🌟 Características Principales

### ✅ **Sistema de Mensajería Completo**
- 📱 **Integración con WhatsApp Business** vía Twilio
- 💬 **Conversaciones en tiempo real** con Socket.IO
- 📎 **Multimedia avanzado** (imágenes, videos, audio, documentos)
- 🔄 **Sincronización bidireccional** con estado de mensajes
- 📋 **Gestión de conversaciones** con estados y asignación

### ✅ **Tiempo Real Profesional**
- ⚡ **Socket.IO con autenticación** Firebase JWT
- 🎯 **Salas por conversación** para escalabilidad
- 👀 **Indicadores de escritura** (typing indicators)
- 📨 **Notificaciones instantáneas** de nuevos mensajes
- 🔄 **Estados de conexión** y presencia de usuarios

### ✅ **Gestión Avanzada de Multimedia**
- 🗂️ **Almacenamiento permanente** de archivos de Twilio
- 🔍 **Validación de tipos** y firmas de archivos
- 📏 **Optimización automática** por categorías
- 🔒 **URLs seguras** con autenticación
- 📊 **Estadísticas de almacenamiento**

### ✅ **Sistema de Roles y Permisos**
- 👑 **Admin**: Acceso completo al sistema
- 👨‍💼 **Agent**: Gestión de conversaciones y mensajes
- 👀 **Viewer**: Solo lectura en módulos específicos
- 🔐 **Autenticación Firebase** con JWT tokens

### ✅ **Analytics y Métricas**
- 📊 **Dashboard completo** con métricas en tiempo real
- 📈 **KPIs de rendimiento** por usuario y equipo
- 📋 **Reportes exportables** en CSV/JSON
- ⏱️ **Tiempos de respuesta** y productividad

## 🏗️ Arquitectura del Sistema

```mermaid
graph TB
    subgraph "Frontend Clients"
        WEB[Web App]
        MOBILE[Mobile App]
        ADMIN[Admin Panel]
    end

    subgraph "Backend Services"
        API[Express.js API]
        SOCKET[Socket.IO Server]
        MEDIA[Media Service]
        TWILIO[Twilio Service]
    end

    subgraph "External Services"
        FB[Firebase Auth]
        FS[Firestore DB]
        TW[Twilio WhatsApp]
        STORAGE[File Storage]
    end

    WEB -->|REST + WebSocket| API
    MOBILE -->|REST + WebSocket| API
    ADMIN -->|REST + WebSocket| API

    API --> SOCKET
    API --> MEDIA
    API --> TWILIO

    API --> FB
    API --> FS
    TWILIO --> TW
    MEDIA --> STORAGE
```

## 🚀 Instalación y Configuración

### **Prerrequisitos**
- Node.js v18+
- Cuenta de Firebase con Firestore
- Cuenta de Twilio con WhatsApp Business
- Railway/Vercel/Heroku para deployment (opcional)

### **1. Clonar e Instalar**

```bash
git clone https://github.com/tu-usuario/utalk-backend.git
cd utalk-backend
npm install
```

### **2. Configuración de Variables de Entorno**

Crea un archivo `.env` basado en `env.example`:

```env
# ===== CONFIGURACIÓN GENERAL =====
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001

# ===== FIREBASE CONFIGURATION =====
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com

# ===== TWILIO CONFIGURATION =====
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_auth_token_twilio
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# ===== ALMACENAMIENTO DE MEDIA =====
MEDIA_DIR=./uploads/media
MEDIA_BASE_URL=http://localhost:3000/media

# ===== CONFIGURACIÓN DE LOGS =====
LOG_LEVEL=info
```

### **3. Configuración de Firebase**

1. **Crear proyecto en Firebase Console**
2. **Habilitar Firestore Database**
3. **Generar clave de servicio** (Admin SDK)
4. **Configurar reglas de Firestore** usando `firestore.rules`

### **4. Configuración de Twilio**

1. **Configurar Sandbox de WhatsApp** o número verificado
2. **Configurar webhook** apuntando a `/api/messages/webhook`
3. **Verificar configuración** con el script:

```bash
npm run verify-webhook
```

### **5. Inicializar Base de Datos**

```bash
# Poblar con datos de ejemplo
npm run seed

# Verificar configuración completa
npm run verify
```

## 📡 API REST Completa

### **🔐 Autenticación**

Todas las rutas protegidas requieren header de autorización:

```http
Authorization: Bearer <firebase_jwt_token>
```

### **💬 Conversaciones**

```http
# Listar conversaciones con filtros
GET /api/conversations?status=open&assignedTo=user123&limit=20

# Obtener conversación específica
GET /api/conversations/conv_1234567890_0987654321

# Obtener mensajes de conversación (paginado)
GET /api/conversations/conv_1234567890_0987654321/messages?limit=50&cursor=msg123

# Marcar conversación como leída
PUT /api/conversations/conv_1234567890_0987654321/read

# Asignar conversación a agente
PUT /api/conversations/conv_1234567890_0987654321/assign
{
  "assignedTo": "agent-user-id"
}

# Cambiar estado de conversación
PUT /api/conversations/conv_1234567890_0987654321/status
{
  "status": "closed"
}

# Archivar conversación
DELETE /api/conversations/conv_1234567890_0987654321
```

### **📨 Mensajes**

```http
# Enviar mensaje
POST /api/messages/send
{
  "to": "+1234567890",
  "content": "Hola, ¿cómo estás?",
  "type": "text"
}

# Marcar mensaje como leído
PUT /api/messages/msg123/read

# Marcar múltiples mensajes como leídos
PUT /api/messages/read-multiple
{
  "messageIds": ["msg123", "msg124", "msg125"],
  "conversationId": "conv_1234567890_0987654321"
}

# Buscar mensajes
GET /api/messages/search?q=hola&limit=20

# Obtener estadísticas
GET /api/messages/stats?startDate=2024-01-01&endDate=2024-01-31
```

### **📎 Multimedia**

```http
# Descargar archivo multimedia
GET /media/images/filename.jpg

# Obtener información de archivo
GET /media/info/images/filename.jpg

# Estadísticas de almacenamiento (Admin)
GET /media/stats

# Limpiar archivos antiguos (Admin)
DELETE /media/cleanup?daysOld=30
```

### **👥 Contactos**

```http
# Listar contactos
GET /api/contacts?search=juan&tags=cliente,vip&limit=20

# Crear contacto
POST /api/contacts
{
  "name": "Juan Pérez",
  "phone": "+1234567890",
  "email": "juan@example.com",
  "tags": ["cliente", "vip"]
}

# Actualizar contacto
PUT /api/contacts/contact123
{
  "name": "Juan Carlos Pérez",
  "customFields": {
    "empresa": "Tech Corp",
    "cargo": "Manager"
  }
}
```

## ⚡ Socket.IO - Tiempo Real

### **🔌 Conexión al Servidor**

```javascript
import io from 'socket.io-client';

const socket = io('https://utalk-backend.railway.app', {
  auth: {
    token: firebaseJwtToken
  },
  transports: ['websocket', 'polling']
});

// Confirmar conexión
socket.on('connected', (data) => {
  console.log('Conectado:', data);
  // { userId, role, displayName, capabilities }
});
```

### **📡 Eventos del Cliente al Servidor**

```javascript
// Unirse a una conversación específica
socket.emit('join-conversation', 'conv_1234567890_0987654321', (response) => {
  if (response.success) {
    console.log('Unido a conversación');
  }
});

// Salir de conversación
socket.emit('leave-conversation', 'conv_1234567890_0987654321');

// Indicadores de escritura
socket.emit('typing-start', 'conv_1234567890_0987654321');
socket.emit('typing-stop', 'conv_1234567890_0987654321');

// Cambiar estado de usuario
socket.emit('status-change', 'away'); // online, away, busy, offline
```

### **📨 Eventos del Servidor al Cliente**

```javascript
// Nuevo mensaje en conversación
socket.on('new-message', (data) => {
  console.log('Nuevo mensaje:', data);
  /*
  {
    type: 'new-message',
    conversationId: 'conv_1234567890_0987654321',
    message: {
      id: 'msg123',
      content: 'Hola!',
      from: '+1234567890',
      timestamp: '2024-01-15T10:30:00Z',
      type: 'text'
    }
  }
  */
});

// Mensaje marcado como leído
socket.on('message-read', (data) => {
  console.log('Mensaje leído:', data);
  /*
  {
    conversationId: 'conv_1234567890_0987654321',
    messageId: 'msg123',
    readBy: 'user-id'
  }
  */
});

// Estado de conversación cambiado
socket.on('conversation-status-changed', (data) => {
  console.log('Estado cambiado:', data);
  /*
  {
    conversationId: 'conv_1234567890_0987654321',
    status: 'closed',
    changedBy: 'agent-id'
  }
  */
});

// Conversación asignada
socket.on('conversation-assigned', (data) => {
  console.log('Conversación asignada:', data);
});

// Usuario escribiendo
socket.on('user-typing', (data) => {
  console.log(`${data.displayName} está escribiendo...`);
});

// Usuario dejó de escribir
socket.on('user-stopped-typing', (data) => {
  console.log(`${data.displayName} dejó de escribir`);
});
```

### **🎯 Gestión de Salas**

```javascript
// El sistema automáticamente gestiona las salas:
// - conversation-{conversationId}: Usuarios en conversación específica
// - role-admin: Todos los administradores
// - role-agent: Todos los agentes
// - role-viewer: Todos los viewers
```

## 💬 Sistema de Conversaciones

### **🆔 Formato de conversationId**

```
conv_TELEFONO1_TELEFONO2
```

- **Ejemplo**: `conv_1234567890_0987654321`
- **Consistente**: Siempre genera el mismo ID para los mismos participantes
- **Ordenado**: Los números se ordenan automáticamente

### **📊 Estados de Conversación**

| Estado | Descripción | Automático |
|--------|-------------|------------|
| `open` | Conversación activa | ✅ (al recibir mensaje) |
| `assigned` | Asignada a agente específico | ❌ (manual) |
| `pending` | En espera de respuesta | ❌ (manual) |
| `closed` | Conversación cerrada | ❌ (manual) |
| `archived` | Archivada | ❌ (manual) |

### **🎯 Prioridades**

- `low`: Baja prioridad
- `normal`: Prioridad normal (default)
- `high`: Alta prioridad
- `urgent`: Urgente

### **📈 Métricas Automáticas**

```javascript
// Cada conversación incluye automáticamente:
{
  "messageCount": 25,          // Total de mensajes
  "unreadCount": 3,           // Mensajes no leídos
  "lastMessageAt": "2024-01-15T10:30:00Z",
  "averageResponseTime": 120, // Segundos promedio
  "firstMessageAt": "2024-01-10T08:00:00Z"
}
```

## 📎 Gestión de Multimedia

### **🗂️ Categorías Soportadas**

| Categoría | Tipos | Tamaño Máx | Extensiones |
|-----------|-------|------------|-------------|
| `images` | Imágenes | 10MB | jpg, png, gif, webp |
| `videos` | Videos | 50MB | mp4, webm, ogg |
| `audio` | Audio | 20MB | mp3, wav, ogg, webm |
| `documents` | Documentos | 25MB | pdf, txt, doc, docx |

### **🔄 Procesamiento Automático**

1. **Recepción**: Webhook de Twilio contiene URL temporal
2. **Descarga**: MediaService descarga el archivo automáticamente
3. **Validación**: Verificación de tipo MIME y firma de archivo
4. **Almacenamiento**: Guardado categorizado con nombre único
5. **URL Permanente**: Generación de URL pública segura

### **🔒 Seguridad de Archivos**

```javascript
// Validaciones implementadas:
- Verificación de tipo MIME
- Validación de firma de archivo (magic numbers)
- Límites de tamaño por categoría
- Autenticación requerida para descargar
- Nombres de archivo seguros (sin path traversal)
```

### **📊 Estadísticas de Almacenamiento**

```http
GET /media/stats
```

```json
{
  "stats": {
    "totalFiles": 1250,
    "totalSize": 524288000,
    "totalSizeFormatted": "500.0 MB",
    "byCategory": {
      "images": {
        "files": 800,
        "size": 314572800,
        "sizeFormatted": "300.0 MB"
      },
      "videos": {
        "files": 50,
        "size": 157286400,
        "sizeFormatted": "150.0 MB"
      }
    }
  }
}
```

## 👥 Gestión de Usuarios y Roles

### **🔑 Roles del Sistema**

#### **👑 Admin (Administrador)**
- ✅ Acceso completo a todas las funcionalidades
- ✅ Gestión de usuarios y roles
- ✅ Configuración del sistema
- ✅ Métricas y analytics completos
- ✅ Gestión de multimedia y almacenamiento

#### **👨‍💼 Agent (Agente)**
- ✅ Gestión de conversaciones asignadas
- ✅ Envío y recepción de mensajes
- ✅ Gestión de contactos
- ✅ Creación de campañas
- ✅ Acceso a base de conocimiento
- ❌ Gestión de usuarios
- ❌ Configuración del sistema

#### **👀 Viewer (Visualizador)**
- ✅ Solo lectura en conversaciones
- ✅ Visualización de métricas básicas
- ✅ Acceso a base de conocimiento pública
- ❌ Envío de mensajes
- ❌ Gestión de contactos
- ❌ Creación de campañas

### **🔐 Autenticación y Autorización**

```javascript
// Middleware de autenticación
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const decodedToken = await firebase.auth().verifyIdToken(token);
  req.user = await User.getById(decodedToken.uid);
  next();
};

// Middleware de roles
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
};
```

## 📊 Analytics y Métricas

### **📈 Dashboard Principal**

```http
GET /api/dashboard/metrics?period=7d
```

```json
{
  "summary": {
    "totalMessages": 1520,
    "totalContacts": 450,
    "activeConversations": 25,
    "averageResponseTime": 180
  },
  "trends": {
    "messagesGrowth": 15.5,
    "contactsGrowth": 8.2,
    "responseTimeImprovement": -12.3
  },
  "topPerformers": [
    {
      "agent": "Juan Pérez",
      "messagesHandled": 320,
      "avgResponseTime": 120
    }
  ]
}
```

### **👥 Métricas de Equipo**

```http
GET /api/dashboard/performance?period=30d
```

### **💬 Estadísticas de Conversaciones**

```http
GET /api/conversations/stats
```

### **📊 Reportes Exportables**

```http
# Exportar reporte de campaña en CSV
GET /api/campaigns/{id}/report?format=csv

# Exportar métricas de equipo
GET /api/dashboard/export?period=30d&format=csv
```

## 🔧 Desarrollo y Testing

### **🚀 Scripts Disponibles**

```bash
# Desarrollo
npm run dev          # Iniciar con nodemon
npm start           # Iniciar en producción

# Base de datos
npm run seed        # Poblar DB con datos de ejemplo
npm run verify      # Verificar configuración completa

# Testing
npm test           # Ejecutar tests
npm run test:watch # Tests en modo watch

# Utilidades
npm run verify-webhook    # Verificar configuración de Twilio
npm run cleanup-media    # Limpiar archivos multimedia antiguos
```

### **🧪 Testing**

```bash
# Ejecutar tests específicos
npm test -- --testNamePattern="Conversation"
npm test -- tests/messages.test.js

# Coverage
npm run test:coverage
```

### **📝 Logging**

```javascript
// El sistema incluye logging estructurado:
logger.info('Mensaje procesado', {
  messageId: 'msg123',
  conversationId: 'conv_123_456',
  userId: 'user123',
  processing_time: 150
});

// Niveles disponibles: error, warn, info, debug
```

### **🔍 Debugging**

```bash
# Habilitar logs detallados
DEBUG=utalk:* npm run dev

# Solo logs de Socket.IO
DEBUG=socket.io:* npm run dev

# Logs de Firestore
DEBUG=firestore:* npm run dev
```

## 🚀 Deployment

### **☁️ Railway (Recomendado)**

1. **Conectar repositorio** a Railway
2. **Configurar variables de entorno** en Railway Dashboard
3. **Deploy automático** con cada push a main

```bash
# Verificar deployment
curl https://tu-app.railway.app/health
```

### **🌐 Vercel**

```bash
# Instalar CLI
npm i -g vercel

# Deploy
vercel --prod

# Configurar variables de entorno
vercel env add FIREBASE_PROJECT_ID
```

### **🐳 Docker**

```dockerfile
# Dockerfile incluido en el proyecto
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build y run
docker build -t utalk-backend .
docker run -p 3000:3000 --env-file .env utalk-backend
```

### **🔧 Variables de Entorno para Producción**

```env
NODE_ENV=production
PORT=3000
BACKEND_URL=https://tu-dominio.com
FRONTEND_URL=https://tu-frontend.com

# Firebase (usar variables de Railway/Vercel)
FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY=$FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL=$FIREBASE_CLIENT_EMAIL

# Twilio
TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_NUMBER=$TWILIO_WHATSAPP_NUMBER

# Media (usar bucket externo en producción)
MEDIA_BASE_URL=https://tu-dominio.com/media
```

## 📚 Documentación Adicional

- 📖 **[API Documentation](./docs/swagger.yaml)** - Swagger/OpenAPI completo
- 🏗️ **[Architecture Guide](./docs/architecture.md)** - Guía de arquitectura
- 🔧 **[Development Guide](./docs/development.md)** - Guía de desarrollo
- 🚀 **[Deployment Guide](./DEPLOY_GUIDE.md)** - Guía de deployment
- 🧪 **[Testing Guide](./docs/testing.md)** - Guía de testing

## 🤝 Contribución

1. **Fork** el repositorio
2. **Crear** branch para feature (`git checkout -b feature/nueva-funcionalidad`)
3. **Commit** cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. **Push** al branch (`git push origin feature/nueva-funcionalidad`)
5. **Crear** Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

- 📧 **Email**: support@funday.com
- 💬 **Discord**: [Unirse al servidor](https://discord.gg/funday)
- 📱 **WhatsApp**: +1 (555) 123-4567
- 🐛 **Issues**: [GitHub Issues](https://github.com/tu-usuario/utalk-backend/issues)

---

### 🎉 ¡Backend Listo para Producción!

Este backend está completamente preparado para soportar aplicaciones de mensajería profesionales con:

- ✅ **Tiempo real** con Socket.IO
- ✅ **Multimedia avanzado** 
- ✅ **Conversaciones estructuradas**
- ✅ **Roles y permisos**
- ✅ **Analytics completos**
- ✅ **Documentación completa**
- ✅ **Listo para escalar**

**¡Perfecto para construir tu propio WhatsApp Web, Chatwoot, Intercom o Tidio!** 🚀 