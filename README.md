# 🚀 UTalk Backend API

Backend completo para la aplicación de mensajería omnicanal UTalk con WhatsApp, gestión de conversaciones, campañas de marketing y base de conocimiento.

## 📋 Características Principales

- **🔐 Autenticación JWT robusta** con roles y permisos granulares
- **📱 Integración WhatsApp completa** via Twilio con webhooks
- **💬 Chat tiempo real** con Socket.IO y gestión de estado
- **📊 Sistema de conversaciones avanzado** con asignación automática
- **🏷️ Gestión de contactos** con tags y campos personalizados
- **📢 Campañas de marketing** automatizadas y programadas
- **📚 Base de conocimiento** con documentos y FAQs
- **📈 Dashboard con métricas** y analytics en tiempo real
- **👥 Gestión de equipo** y roles de usuario
- **📁 Manejo de multimedia** (imágenes, videos, documentos, audio)

## 🏗️ Arquitectura y Tecnologías

- **Backend:** Node.js + Express.js
- **Base de datos:** Google Cloud Firestore
- **Autenticación:** JWT con email como identificador principal  
- **Mensajería:** Twilio WhatsApp Business API
- **Tiempo real:** Socket.IO para eventos instantáneos
- **Storage:** Sistema de archivos local + validación multimedia
- **Deployment:** Railway con Docker containerization

## 📡 **ESTRUCTURA DE RESPUESTA API UNIFICADA**

Todos los endpoints del sistema responden con la siguiente estructura estándar siguiendo las mejores prácticas REST según [Quilltez](https://quilltez.com/blog/maintaining-standard-rest-api-response-format-expressjs) y [Medium](https://medium.com/@seun.thedeveloper/simplifying-api-responses-with-node-js-introducing-a-response-service-46c641ce2411):

### ✅ **Respuesta Exitosa:**
```json
{
  "success": true,
  "data": [...] | {...},
  "message": "Descripción opcional del resultado",
  "pagination": {  // Solo en endpoints paginados
    "hasMore": false,
    "nextCursor": "cursor_token",
    "limit": 20,
    "totalResults": 150
  },
  "timestamp": "2024-01-15T11:00:00.000Z"
}
```

### ❌ **Respuesta de Error:**
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Descripción del error",
  "suggestion": "Cómo solucionarlo",
  "details": {},
  "timestamp": "2024-01-15T11:00:00.000Z"
}
```

### 📋 **Ejemplos por Módulo:**

**Conversaciones:**
```json
{
  "success": true,
  "data": [
    {
      "id": "conv_001_002",
      "contact": {
        "id": "+1234567890",
        "name": "Cliente X",
        "avatar": null,
        "channel": "whatsapp"
      },
      "lastMessage": {
        "content": "Último mensaje",
        "timestamp": "2024-01-15T10:30:00.000Z"
      },
      "status": "open",
      "assignedTo": {
        "email": "agent@company.com",
        "name": "Agente 1"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "pagination": {
    "hasMore": false,
    "limit": 20,
    "totalResults": 1
  },
  "message": "1 conversaciones encontradas",
  "timestamp": "2024-01-15T11:00:00.000Z"
}
```

**Mensajes:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg_001",
      "conversationId": "conv_001_002", 
      "content": "Hola, ¿cómo están?",
      "senderIdentifier": "+1234567890",
      "recipientIdentifier": "agent@company.com",
      "direction": "inbound",
      "type": "text",
      "status": "read",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "media": []
    }
  ],
  "pagination": {
    "hasMore": true,
    "nextCursor": "cursor_token_123",
    "limit": 50
  },
  "message": "50 mensajes encontrados"
}
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 18+ y npm
- Cuenta Google Cloud con Firestore habilitado
- Cuenta Twilio con WhatsApp Business configurado
- Variables de entorno configuradas

### Instalación
```bash
# Clonar repositorio
git clone https://github.com/tu-org/utalk-backend.git
cd utalk-backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp env.example .env
# Editar .env con tus credenciales

# Iniciar en desarrollo
npm run dev

# Iniciar en producción
npm start
```

### Variables de Entorno Requeridas
```bash
# Firebase
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu-auth-token-twilio
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# JWT y Seguridad
JWT_SECRET=tu-jwt-secret-muy-seguro-y-largo
JWT_EXPIRES_IN=7d

# Frontend
FRONTEND_URL=http://localhost:3000,https://tu-dominio.com

# Opcional
NODE_ENV=development|production
PORT=3000
```

## 📖 API Endpoints Principales

### 🔐 Autenticación
- `POST /api/auth/login` - Login con email/password
- `GET /api/auth/validate-token` - Validar JWT para persistencia de sesión
- `POST /api/auth/create-user` - Crear nuevo usuario (Admin only)

### 💬 Conversaciones
- `GET /api/conversations` - Listar conversaciones con filtros
- `GET /api/conversations/:id` - Obtener conversación específica
- `POST /api/conversations` - Crear nueva conversación
- `PUT /api/conversations/:id/assign` - Asignar a agente
- `PUT /api/conversations/:id/status` - Cambiar estado

### 📨 Mensajes
- `GET /api/conversations/:id/messages` - Historial de mensajes
- `POST /api/messages/send` - Enviar mensaje WhatsApp
- `POST /api/messages/webhook` - Webhook público de Twilio (sin auth)

### 👥 Contactos
- `GET /api/contacts` - Listar contactos con búsqueda
- `POST /api/contacts` - Crear/actualizar contacto
- `GET /api/contacts/:phone` - Obtener contacto por teléfono

### 📁 Multimedia
- `GET /media/:category/:filename` - Servir archivos con autenticación
- Soporte para: imágenes (10MB), videos (50MB), audio (20MB), documentos (25MB)

## 🔌 WebSocket Events

### Cliente → Servidor
- `join-conversation` - Unirse a conversación
- `typing-start/stop` - Indicadores de escritura
- `message-read` - Marcar mensaje como leído

### Servidor → Cliente  
- `new-message` - Nuevo mensaje recibido
- `user-typing` - Usuario escribiendo
- `conversation-assigned` - Conversación asignada
- `message-read-by-user` - Mensaje leído por usuario

## 🧪 Testing

```bash
# Tests unitarios
npm test

# Tests con watch mode
npm run test:watch

# Linter
npm run lint
npm run lint:fix
```

## 📁 Estructura del Proyecto

```
src/
├── config/          # Configuración de servicios externos
│   ├── firebase.js  # Firestore configuration
│   └── twilio.js    # Twilio WhatsApp setup
├── controllers/     # Lógica de endpoints
│   ├── AuthController.js
│   ├── ConversationController.js
│   ├── MessageController.js
│   └── ...
├── models/          # Modelos de datos
│   ├── User.js
│   ├── Conversation.js
│   ├── Message.js
│   └── ...
├── routes/          # Definición de rutas
├── services/        # Servicios de negocio
│   ├── TwilioService.js
│   ├── MessageService.js
│   └── MediaService.js
├── middleware/      # Middlewares personalizados
│   ├── auth.js      # Autenticación JWT
│   ├── security.js  # Headers de seguridad
│   └── errorHandler.js
├── utils/           # Utilidades
│   ├── responseHandler.js  # Respuestas API estandarizadas
│   ├── validation.js       # Schemas Joi
│   └── logger.js          # Winston logging
├── socket/          # WebSocket management
│   └── index.js     # Socket.IO server setup
└── index.js         # Entry point de la aplicación
```

## 🚀 Deployment

### Railway (Recomendado)
1. Conectar repositorio GitHub a Railway
2. Configurar variables de entorno en Railway dashboard
3. El deploy es automático con cada push a main

### Docker
```bash
# Build imagen
docker build -t utalk-backend .

# Ejecutar contenedor
docker run -p 3000:3000 --env-file .env utalk-backend
```

## 📊 Monitoreo y Logs

- **Health Check:** `GET /health` - Estado de servicios
- **Logs estructurados** con Winston
- **Rate limiting** para prevenir abuso
- **Métricas** de conversaciones y mensajes
- **Error tracking** con códigos únicos

## 🔒 Seguridad

- ✅ Autenticación JWT robusta
- ✅ Rate limiting por IP y usuario
- ✅ Validación de entrada con Joi
- ✅ Headers de seguridad con Helmet
- ✅ CORS configurado específicamente
- ✅ Sanitización HTML automática
- ✅ Logs de auditoría detallados

## 📚 Documentación

- `/docs/api-integration.md` - Guía de integración frontend
- `/docs/guia-integracion-final.md` - Documentación completa
- `/docs/swagger.yaml` - Especificación OpenAPI 3.0
- `/docs/firebase-collections.md` - Estructura de base de datos

## 🤝 Contribución

1. Fork del repositorio
2. Crear branch para feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

MIT License - ver archivo `LICENSE` para detalles.

## 📞 Soporte

- Email: support@utalk.com
- Issues: GitHub Issues
- Documentación: `/docs/`

---

**Desarrollado con ❤️ por el equipo UTalk** 