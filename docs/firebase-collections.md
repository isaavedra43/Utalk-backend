# Estructura de Colecciones en Firestore

Este documento describe la estructura de las colecciones de Firebase Firestore para la aplicación Funday.

## Colecciones Principales

### 1. users
Almacena información de los usuarios del sistema.

```javascript
{
  uid: "string",                    // UID de Firebase Auth
  email: "user@example.com",        // Email del usuario
  displayName: "Juan Pérez",        // Nombre completo
  photoURL: "https://...",          // URL de foto de perfil
  role: "admin",                    // Roles: admin, agent, viewer
  isActive: true,                   // Estado del usuario
  createdAt: timestamp,             // Fecha de creación
  updatedAt: timestamp,             // Última actualización
  lastLoginAt: timestamp,           // Último login
  settings: {                       // Configuraciones personales
    notifications: true,
    language: "es",
    timezone: "America/Mexico_City"
  }
}
```

### 2. contacts
Gestión de contactos de WhatsApp.

```javascript
{
  id: "string",                     // ID único del contacto
  name: "María García",             // Nombre del contacto
  phone: "+525512345678",           // Número de teléfono (formato internacional)
  email: "maria@example.com",       // Email (opcional)
  tags: ["cliente", "vip"],         // Tags para categorización
  customFields: {                   // Campos personalizados
    empresa: "Tech Corp",
    cargo: "Gerente"
  },
  userId: "string",                 // ID del usuario que creó el contacto
  isActive: true,                   // Estado del contacto
  lastContactAt: timestamp,         // Último contacto
  totalMessages: 25,                // Total de mensajes intercambiados
  createdAt: timestamp,             // Fecha de creación
  updatedAt: timestamp              // Última actualización
}
```

### 3. conversations
Conversaciones agrupadas por contacto.

```javascript
{
  id: "string",                     // ID único de la conversación
  contactId: "string",              // ID del contacto
  assignedTo: "string",             // Usuario asignado (opcional)
  status: "open",                   // Estados: open, closed, pending
  lastMessage: "Hola, ¿cómo estás?", // Último mensaje
  lastMessageAt: timestamp,         // Fecha del último mensaje
  messageCount: 15,                 // Cantidad de mensajes
  createdAt: timestamp,             // Fecha de creación
  updatedAt: timestamp              // Última actualización
}
```

### 4. messages
Mensajes individuales de WhatsApp.

```javascript
{
  id: "string",                     // ID único del mensaje
  conversationId: "string",         // ID de la conversación
  from: "+525512345678",            // Número remitente
  to: "+525598765432",              // Número destinatario
  content: "Hola, ¿cómo estás?",    // Contenido del mensaje
  type: "text",                     // Tipos: text, image, document, audio, video
  direction: "inbound",             // Direcciones: inbound, outbound
  status: "delivered",              // Estados: pending, sent, delivered, read, failed
  twilioSid: "SM...",               // ID de Twilio
  mediaUrls: ["https://..."],       // URLs de archivos multimedia
  metadata: {                       // Información adicional
    errorCode: null,
    errorMessage: null
  },
  userId: "string",                 // Usuario que envió (si es outbound)
  timestamp: timestamp,             // Fecha y hora del mensaje
  createdAt: timestamp,             // Fecha de creación
  updatedAt: timestamp              // Última actualización
}
```

### 5. campaigns
Campañas de marketing masivo.

```javascript
{
  id: "string",                     // ID único de la campaña
  name: "Promoción Navidad",        // Nombre de la campaña
  message: "¡Ofertas especiales...", // Mensaje a enviar
  contacts: ["contact1", "contact2"], // IDs de contactos objetivo
  scheduledAt: timestamp,           // Fecha programada (opcional)
  status: "draft",                  // Estados: draft, scheduled, sending, completed, paused, cancelled
  createdBy: "string",              // Usuario que creó la campaña
  sentCount: 0,                     // Mensajes enviados
  deliveredCount: 0,                // Mensajes entregados
  failedCount: 0,                   // Mensajes fallidos
  results: [                        // Resultados detallados
    {
      contactId: "string",
      status: "sent",
      messageId: "string",
      sentAt: timestamp
    }
  ],
  createdAt: timestamp,             // Fecha de creación
  updatedAt: timestamp,             // Última actualización
  completedAt: timestamp            // Fecha de finalización
}
```

### 6. knowledge
Base de conocimiento y FAQs.

```javascript
{
  id: "string",                     // ID único del documento
  title: "Cómo configurar WhatsApp", // Título del documento
  content: "Pasos para configurar...", // Contenido en formato markdown
  category: "configuracion",        // Categoría del documento
  tags: ["whatsapp", "setup"],      // Tags para búsqueda
  isPublic: true,                   // Visible para todos los usuarios
  createdBy: "string",              // Usuario que creó el documento
  views: 15,                        // Número de visualizaciones
  helpful: 10,                      // Votos de "útil"
  notHelpful: 2,                    // Votos de "no útil"
  createdAt: timestamp,             // Fecha de creación
  updatedAt: timestamp              // Última actualización
}
```

### 7. dashboard_metrics
Métricas del dashboard (se actualiza diariamente).

```javascript
{
  id: "YYYY-MM-DD",                 // Fecha como ID
  date: timestamp,                  // Fecha de las métricas
  totalMessages: 1250,              // Total de mensajes del día
  inboundMessages: 800,             // Mensajes recibidos
  outboundMessages: 450,            // Mensajes enviados
  newContacts: 15,                  // Nuevos contactos
  activeConversations: 85,          // Conversaciones activas
  campaignsSent: 3,                 // Campañas enviadas
  responseTime: 120,                // Tiempo promedio de respuesta (minutos)
  userActivity: {                   // Actividad por usuario
    "userId1": {
      messagesSent: 50,
      conversationsHandled: 10
    }
  },
  createdAt: timestamp,             // Fecha de creación
  updatedAt: timestamp              // Última actualización
}
```

### 8. team_members
Miembros del equipo y sus métricas.

```javascript
{
  id: "string",                     // ID del miembro (igual al UID de usuario)
  uid: "string",                    // UID de Firebase Auth
  role: "agent",                    // Rol en el equipo
  department: "ventas",             // Departamento
  isActive: true,                   // Estado del miembro
  kpis: {                          // KPIs del mes actual
    messagesSent: 850,
    conversationsHandled: 45,
    averageResponseTime: 90,
    customerSatisfaction: 4.2
  },
  targets: {                       // Objetivos mensuales
    messagesSent: 1000,
    conversationsHandled: 50,
    averageResponseTime: 60
  },
  joinedAt: timestamp,             // Fecha de ingreso al equipo
  lastActivity: timestamp,         // Última actividad
  createdAt: timestamp,            // Fecha de creación
  updatedAt: timestamp             // Última actualización
}
```

### 9. settings
Configuraciones globales del sistema.

```javascript
{
  id: "global",                    // ID fijo para configuración global
  companyInfo: {
    name: "Mi Empresa",
    phone: "+525512345678",
    email: "info@miempresa.com",
    website: "https://miempresa.com"
  },
  whatsappConfig: {
    welcomeMessage: "¡Hola! Gracias por contactarnos...",
    autoReply: true,
    businessHours: {
      enabled: true,
      timezone: "America/Mexico_City",
      schedule: {
        monday: { start: "09:00", end: "18:00" },
        tuesday: { start: "09:00", end: "18:00" },
        // ... resto de días
      }
    }
  },
  notificationSettings: {
    emailNotifications: true,
    newMessageAlert: true,
    campaignReports: true
  },
  updatedAt: timestamp,            // Última actualización
  updatedBy: "string"              // Usuario que actualizó
}
```

### 10. activity_logs
Registro de actividades del sistema.

```javascript
{
  id: "string",                    // ID único del log
  action: "contact_created",       // Tipo de acción
  userId: "string",                // Usuario que realizó la acción
  entityType: "contact",           // Tipo de entidad afectada
  entityId: "string",              // ID de la entidad
  details: {                       // Detalles específicos de la acción
    oldValue: {...},
    newValue: {...}
  },
  ipAddress: "192.168.1.1",        // IP del usuario
  userAgent: "Mozilla/5.0...",     // User agent
  timestamp: timestamp             // Fecha y hora de la acción
}
```

## Índices Recomendados

Para optimizar las consultas, se recomienda crear los siguientes índices compuestos:

### contacts
- `userId, isActive, createdAt`
- `phone, isActive`
- `tags (array), isActive`

### messages
- `conversationId, timestamp`
- `from, to, timestamp`
- `userId, timestamp`
- `direction, timestamp`

### campaigns
- `createdBy, status, createdAt`
- `status, scheduledAt`

### team_members
- `isActive, role`
- `department, isActive`

## Reglas de Seguridad

Las reglas de seguridad se encuentran en el archivo `firestore.rules` y aseguran que:

1. Solo usuarios autenticados pueden acceder a los datos
2. Los usuarios solo pueden ver/modificar sus propios datos (excepto admins)
3. Los roles determinan los niveles de acceso
4. Se registran todas las modificaciones importantes

## Respaldo y Migración

- Configurar respaldos automáticos diarios
- Exportar datos críticos semanalmente
- Mantener scripts de migración para actualizaciones de esquema 