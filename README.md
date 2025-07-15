# Funday Backend API

Backend API para la aplicación Funday (anteriormente UTalk) - Plataforma de mensajería empresarial con integración WhatsApp.

## 🚀 Características

- **Autenticación**: Firebase Auth con JWT
- **Base de datos**: Firebase Firestore
- **Mensajería**: Integración con Twilio WhatsApp
- **WebSockets**: Mensajería en tiempo real
- **API RESTful**: Endpoints para todas las funcionalidades
- **Seguridad**: Validación, sanitización y rate limiting
- **Despliegue**: Railway con CI/CD

## 📁 Estructura del proyecto

```
src/
├── controllers/         # Controladores de rutas
├── routes/             # Definición de rutas
├── services/           # Lógica de negocio
├── models/             # Modelos de datos Firestore
├── middleware/         # Middlewares de Express
├── utils/              # Utilidades y helpers
├── config/             # Configuraciones
└── index.js           # Punto de entrada
```

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd funday-backend
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
# Edita .env con tus credenciales
```

4. **Configurar Firebase**
- Crear proyecto en Firebase Console
- Habilitar Firestore y Authentication
- Descargar service account key
- Configurar variables de entorno de Firebase

5. **Configurar Twilio**
- Crear cuenta en Twilio
- Configurar WhatsApp Business API
- Obtener credenciales y configurar webhook

## 🚀 Desarrollo

```bash
# Modo desarrollo con recarga automática
npm run dev

# Ejecutar en producción
npm start

# Ejecutar tests
npm test

# Linting
npm run lint
npm run lint:fix
```

## 📋 API Endpoints

### Autenticación
- `POST /api/auth/login` - Login con Firebase
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refrescar token

### Contactos
- `GET /api/contacts` - Listar contactos
- `POST /api/contacts` - Crear contacto
- `PUT /api/contacts/:id` - Actualizar contacto
- `DELETE /api/contacts/:id` - Eliminar contacto
- `GET /api/contacts/export` - Exportar CSV

### Mensajes
- `GET /api/messages` - Listar conversaciones
- `POST /api/messages/send` - Enviar mensaje
- `POST /api/messages/webhook` - Webhook Twilio

### Campañas
- `GET /api/campaigns` - Listar campañas
- `POST /api/campaigns` - Crear campaña
- `PUT /api/campaigns/:id` - Actualizar campaña
- `DELETE /api/campaigns/:id` - Eliminar campaña
- `POST /api/campaigns/:id/send` - Enviar campaña

### Base de conocimiento
- `GET /api/knowledge` - Listar documentos
- `POST /api/knowledge` - Crear documento
- `PUT /api/knowledge/:id` - Actualizar documento
- `DELETE /api/knowledge/:id` - Eliminar documento

### Dashboard
- `GET /api/dashboard/metrics` - Métricas generales
- `GET /api/dashboard/export` - Exportar reportes

### Equipo
- `GET /api/team` - Listar miembros
- `POST /api/team` - Invitar miembro
- `PUT /api/team/:id` - Actualizar miembro
- `DELETE /api/team/:id` - Eliminar miembro

## 🗄️ Colecciones Firestore

### users
```javascript
{
  uid: string,
  email: string,
  displayName: string,
  role: 'admin' | 'agent' | 'viewer',
  createdAt: timestamp,
  lastLoginAt: timestamp
}
```

### contacts
```javascript
{
  id: string,
  name: string,
  phone: string,
  email?: string,
  tags: string[],
  customFields: object,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### conversations
```javascript
{
  id: string,
  contactId: string,
  assignedTo?: string,
  status: 'open' | 'closed' | 'pending',
  lastMessage: string,
  lastMessageAt: timestamp,
  createdAt: timestamp
}
```

### messages
```javascript
{
  id: string,
  conversationId: string,
  from: string,
  to: string,
  content: string,
  type: 'text' | 'image' | 'document',
  direction: 'inbound' | 'outbound',
  timestamp: timestamp,
  twilioSid?: string
}
```

## 🔧 Configuración Firebase

1. **Firestore Rules** (ver `firestore.rules`)
2. **Authentication** - Habilitar Email/Password y Google
3. **Storage** - Para archivos multimedia

## 🚀 Despliegue en Railway

1. **Conectar repositorio**
2. **Configurar variables de entorno**
3. **Deploy automático en push a main**

```bash
# Manual deploy
npm run deploy
```

## 🔒 Seguridad

- Autenticación con Firebase Auth
- Validación de entrada con Joi
- Rate limiting
- CORS configurado
- Sanitización HTML
- Headers de seguridad con Helmet

## 📊 Monitoreo

- Logs estructurados con Morgan
- Métricas de API
- Alertas de errores

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Tests en modo watch
npm run test:watch
```

## 📝 Contribución

1. Fork el proyecto
2. Crear feature branch
3. Commit cambios
4. Push a la rama
5. Crear Pull Request

## 📄 Licencia

MIT License 