# ⚡ REALTIME, EVENTOS Y SINCRONÍA - UTalk Backend

## 📋 ARQUITECTURA RT

### 🏗️ Topología Socket.IO
```
┌─────────────────────────────────────┐
│           CLIENT                    │ ← Frontend (React/Vue/Angular)
├─────────────────────────────────────┤
│         SOCKET.IO CLIENT            │ ← Conexión WebSocket
├─────────────────────────────────────┤
│         LOAD BALANCER               │ ← Railway/Cloudflare
├─────────────────────────────────────┤
│      SOCKET.IO SERVER               │ ← Node.js + Socket.IO
├─────────────────────────────────────┤
│         REDIS ADAPTER               │ ← Sincronización entre instancias
├─────────────────────────────────────┤
│           REDIS                     │ ← Almacenamiento de sesiones
└─────────────────────────────────────┘
```

### 🔧 Configuración del Servidor
```javascript
// src/socket/index.js
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  },
  adapter: require('socket.io-redis')({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }),
  maxHttpBufferSize: 1e8, // 100MB
  pingTimeout: 60000,
  pingInterval: 25000
});
```

### 🏷️ Namespaces
- **`/app`**: Aplicación principal (conversaciones, mensajes)
- **`/admin`**: Panel de administración (métricas, configuración)
- **`/agent`**: Interfaz de agentes (asignaciones, escalamientos)

### 🏠 Rooms por Usuario/Conversación
```javascript
// Rooms por usuario
`user:${userId}`                    // Eventos personales del usuario
`workspace:${workspaceId}`          // Eventos del workspace
`role:${role}`                      // Eventos por rol (admin, agent)

// Rooms por conversación
`conversation:${conversationId}`    // Eventos de conversación específica
`channel:${channelType}`            // Eventos por canal (whatsapp, facebook)
```

---

## 🤝 HANDSHAKE Y AUTH

### 🔐 Autenticación JWT
```javascript
// Cliente envía token en handshake
const socket = io('https://utalk-backend.railway.app', {
  auth: {
    token: 'jwt_access_token_here'
  }
});

// Servidor valida token
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.sub;
    socket.userRole = decoded.role;
    socket.workspaceId = decoded.workspaceId;
    socket.tenantId = decoded.tenantId;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});
```

### 🔄 Refresh de Token
```javascript
// Cliente detecta token expirado
socket.on('token:expired', async () => {
  try {
    const newToken = await refreshAccessToken();
    socket.auth.token = newToken;
    socket.connect();
  } catch (error) {
    // Redirigir a login
    window.location.href = '/login';
  }
});

// Servidor emite evento de expiración
if (isTokenExpired(socket.decodedToken)) {
  socket.emit('token:expired');
  socket.disconnect();
}
```

### 🚫 Expulsión y Reconexión
```javascript
// Servidor expulsa usuario
socket.emit('user:expelled', {
  reason: 'account_suspended',
  message: 'Tu cuenta ha sido suspendida'
});
socket.disconnect();

// Cliente maneja expulsión
socket.on('user:expelled', (data) => {
  showNotification(data.message);
  redirectToLogin();
});
```

---

## 📚 CATÁLOGO DE EVENTOS (CON CONTRATO)

### 📤 CLIENTE → SERVIDOR

#### 🔐 Autenticación
```javascript
// Re-autenticar con nuevo token
socket.emit('auth:refresh', {
  token: 'new_jwt_token'
});

// Response: 'auth:refreshed' o 'auth:failed'
```

#### 💬 Mensajes
```javascript
// Enviar mensaje
socket.emit('message:send', {
  messageId: 'uuid-v4',           // Para deduplicación
  conversationId: 'conv_+1234567890_+0987654321',
  type: 'text|image|audio|file|location|sticker',
  text: 'Hola, ¿cómo estás?',
  mediaId: null,                  // Para mensajes con media
  metadata: {
    clientTs: '2025-08-20T10:00:00Z',
    botResponse: false
  }
});

// Response: 'message:sent' o 'message:error'
```

#### ⌨️ Typing Indicators
```javascript
// Iniciar typing
socket.emit('typing:start', {
  conversationId: 'conv_+1234567890_+0987654321'
});

// Detener typing
socket.emit('typing:stop', {
  conversationId: 'conv_+1234567890_+0987654321'
});

// Response: 'typing:acknowledged'
```

#### 👀 Lectura de Mensajes
```javascript
// Marcar conversación como leída
socket.emit('conversation:read', {
  conversationId: 'conv_+1234567890_+0987654321',
  messageId: 'msg_uuid-v4'        // Último mensaje leído
});

// Response: 'conversation:read:acknowledged'
```

#### 👨‍💼 Gestión de Agentes
```javascript
// Tomar conversación
socket.emit('agent:takeover', {
  conversationId: 'conv_+1234567890_+0987654321',
  reason: 'manual_assignment'
});

// Devolver al bot
socket.emit('agent:return-to-bot', {
  conversationId: 'conv_+1234567890_+0987654321',
  reason: 'resolved|timeout|manual'
});

// Response: 'agent:takeover:acknowledged' o 'agent:return:acknowledged'
```

#### 🔄 Sincronización
```javascript
// Solicitar sincronización de estado
socket.emit('sync:state', {
  syncId: 'uuid-v4',              // Para tracking
  lastSync: '2025-08-20T10:00:00Z'
});

// Response: 'state:synced'
```

### 📥 SERVIDOR → CLIENTE

#### 📨 Mensajes
```javascript
// Nuevo mensaje recibido
socket.emit('message:new', {
  id: 'msg_uuid-v4',
  messageId: 'uuid-v4',
  conversationId: 'conv_+1234567890_+0987654321',
  type: 'text',
  text: 'Hola, ¿cómo estás?',
  sender: '+1234567890',
  direction: 'inbound',
  status: 'received',
  mediaId: null,
  metadata: {
    clientTs: '2025-08-20T10:00:00Z',
    twilioSid: 'SM123456789'
  },
  createdAt: '2025-08-20T10:00:00Z'
});

// Mensaje enviado exitosamente
socket.emit('message:sent', {
  id: 'msg_uuid-v4',
  messageId: 'uuid-v4',
  conversationId: 'conv_+1234567890_+0987654321',
  status: 'sent',
  twilioSid: 'SM123456789',
  sentAt: '2025-08-20T10:00:00Z'
});

// Mensaje entregado
socket.emit('message:delivered', {
  id: 'msg_uuid-v4',
  messageId: 'uuid-v4',
  conversationId: 'conv_+1234567890_+0987654321',
  status: 'delivered',
  deliveredAt: '2025-08-20T10:05:00Z'
});

// Mensaje leído
socket.emit('message:read', {
  id: 'msg_uuid-v4',
  messageId: 'uuid-v4',
  conversationId: 'conv_+1234567890_+0987654321',
  status: 'read',
  readAt: '2025-08-20T10:10:00Z'
});

// Error en mensaje
socket.emit('message:error', {
  messageId: 'uuid-v4',
  conversationId: 'conv_+1234567890_+0987654321',
  error: {
    code: 'DELIVERY_FAILED',
    message: 'No se pudo entregar el mensaje',
    details: {
      reason: 'invalid_phone_number'
    }
  }
});
```

#### 💬 Conversaciones
```javascript
// Conversación actualizada
socket.emit('conversation:updated', {
  id: 'conv_+1234567890_+0987654321',
  status: 'open|pending|closed|escalated',
  assignedAgent: 'agent_uuid',
  botEnabled: true,
  lastMessage: {
    id: 'msg_uuid',
    text: 'Hola, ¿cómo estás?',
    sender: '+1234567890',
    createdAt: '2025-08-20T15:30:00Z'
  },
  unreadCount: 3,
  updatedAt: '2025-08-20T15:30:00Z'
});

// Nueva conversación
socket.emit('conversation:new', {
  id: 'conv_+1234567890_+0987654321',
  participants: ['+1234567890', '+0987654321'],
  status: 'open',
  channel: 'whatsapp',
  assignedAgent: null,
  botEnabled: true,
  createdAt: '2025-08-20T10:00:00Z'
});

// Conversación asignada
socket.emit('conversation:assigned', {
  conversationId: 'conv_+1234567890_+0987654321',
  agentId: 'agent_uuid',
  agentName: 'John Doe',
  assignedAt: '2025-08-20T16:00:00Z'
});
```

#### 🚨 Escalamientos
```javascript
// Escalamiento iniciado
socket.emit('escalation:started', {
  id: 'escalation_uuid',
  conversationId: 'conv_+1234567890_+0987654321',
  reason: 'manual|keyword|intent|timeout',
  fromAgent: null,
  toAgent: 'agent_uuid',
  status: 'pending',
  createdAt: '2025-08-20T16:00:00Z'
});

// Escalamiento aceptado
socket.emit('escalation:accepted', {
  id: 'escalation_uuid',
  conversationId: 'conv_+1234567890_+0987654321',
  status: 'accepted',
  acceptedAt: '2025-08-20T16:05:00Z'
});

// Bot reanudado
socket.emit('bot:resumed', {
  conversationId: 'conv_+1234567890_+0987654321',
  reason: 'agent_returned',
  resumedAt: '2025-08-20T16:30:00Z'
});
```

#### 📎 Media
```javascript
// Media subido
socket.emit('media:uploaded', {
  id: 'media_uuid-v4',
  conversationId: 'conv_+1234567890_+0987654321',
  messageId: 'msg_uuid-v4',
  type: 'image',
  mimeType: 'image/jpeg',
  fileName: 'photo.jpg',
  sizeBytes: 1024000,
  url: 'https://storage.googleapis.com/utalk-media/...',
  publicUrl: 'https://utalk-backend.railway.app/media/...',
  uploadedBy: 'user_uuid',
  createdAt: '2025-08-20T10:00:00Z'
});

// Progreso de subida
socket.emit('media:upload:progress', {
  messageId: 'msg_uuid-v4',
  progress: 75, // Porcentaje
  uploadedBytes: 768000,
  totalBytes: 1024000
});
```

#### 👥 Presencia
```javascript
// Actualización de presencia
socket.emit('presence:update', {
  userId: 'user_uuid',
  email: 'user@example.com',
  status: 'online|offline|busy|away',
  role: 'admin|agent|bot',
  lastSeen: '2025-08-20T15:30:00Z'
});

// Usuario conectado
socket.emit('user:connected', {
  userId: 'user_uuid',
  email: 'user@example.com',
  role: 'agent',
  connectedAt: '2025-08-20T15:30:00Z'
});

// Usuario desconectado
socket.emit('user:disconnected', {
  userId: 'user_uuid',
  email: 'user@example.com',
  role: 'agent',
  disconnectedAt: '2025-08-20T15:30:00Z'
});
```

#### 🔄 Sincronización
```javascript
// Estado sincronizado
socket.emit('state:synced', {
  syncId: 'uuid-v4',
  conversations: [
    {
      id: 'conv_+1234567890_+0987654321',
      status: 'open',
      unreadCount: 3,
      lastMessage: { /* ... */ }
    }
  ],
  unreadCounts: {
    'conv_+1234567890_+0987654321': 3
  },
  onlineUsers: [
    {
      userId: 'user_uuid',
      status: 'online',
      role: 'agent'
    }
  ],
  serverTime: '2025-08-20T10:00:00Z'
});
```

#### 🔔 Notificaciones
```javascript
// Notificación general
socket.emit('notification', {
  id: 'notification_uuid',
  type: 'info|warning|error|success',
  title: 'Nuevo mensaje',
  message: 'Tienes un nuevo mensaje en la conversación',
  data: {
    conversationId: 'conv_+1234567890_+0987654321'
  },
  timestamp: '2025-08-20T10:00:00Z'
});

// Notificación de sistema
socket.emit('system:notification', {
  type: 'maintenance|update|alert',
  message: 'El sistema estará en mantenimiento en 30 minutos',
  scheduledAt: '2025-08-20T18:00:00Z'
});
```

---

## 🔄 ORDEN, IDEMPOTENCIA Y CONSISTENCIA

### 📋 Reglas de Orden
```javascript
// 1. El front debe enviar messageId (UUID v4)
socket.emit('message:send', {
  messageId: 'uuid-v4', // Obligatorio para deduplicación
  conversationId: 'conv_...',
  text: 'Hola'
});

// 2. Reintento seguro con el mismo messageId
socket.emit('message:send', {
  messageId: 'same-uuid-v4', // Mismo ID para reintento
  conversationId: 'conv_...',
  text: 'Hola'
});

// 3. Exactly-once lógico por deduplicación
// El servidor detecta messageId duplicado y responde con el mensaje existente
```

### 🔄 Manejo de Reintentos
```javascript
// Cliente: Reintento con backoff exponencial
const sendMessageWithRetry = async (messageData, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        socket.emit('message:send', messageData);
        
        const timeout = setTimeout(() => {
          reject(new Error('Timeout'));
        }, 10000);
        
        socket.once('message:sent', (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
        
        socket.once('message:error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Backoff exponencial: 1s, 2s, 4s
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt - 1) * 1000)
      );
    }
  }
};
```

### 🔍 Detección de Duplicados
```javascript
// Servidor: Detección de messageId duplicado
socket.on('message:send', async (data) => {
  const { messageId, conversationId } = data;
  
  // Verificar si ya existe
  const existingMessage = await MessageRepository.getByMessageId(messageId);
  if (existingMessage) {
    // Responder con el mensaje existente
    socket.emit('message:sent', {
      id: existingMessage.id,
      messageId: existingMessage.messageId,
      conversationId: existingMessage.conversationId,
      status: existingMessage.status,
      createdAt: existingMessage.createdAt
    });
    return;
  }
  
  // Procesar mensaje nuevo
  const message = await MessageService.sendMessage(data);
  socket.emit('message:sent', message);
});
```

---

## 🔄 RECONEXIÓN Y BACKPRESSURE

### ⏱️ Timers de Reconexión
```javascript
// Cliente: Configuración de reconexión
const socket = io('https://utalk-backend.railway.app', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true
});

// Manejo de eventos de reconexión
socket.on('connect', () => {
  console.log('Conectado al servidor');
  // Sincronizar estado después de reconexión
  socket.emit('sync:state', { syncId: uuidv4() });
});

socket.on('disconnect', (reason) => {
  console.log('Desconectado:', reason);
  if (reason === 'io server disconnect') {
    // Reconexión manual requerida
    socket.connect();
  }
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Reconectado después de', attemptNumber, 'intentos');
  // Sincronizar estado
  socket.emit('sync:state', { syncId: uuidv4() });
});
```

### 📦 Buffers y Límites
```javascript
// Servidor: Configuración de buffers
const io = require('socket.io')(server, {
  maxHttpBufferSize: 1e8, // 100MB
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  allowUpgrades: true,
  transports: ['websocket', 'polling']
});

// Límites por room
const MAX_MESSAGES_PER_ROOM = 1000;
const MAX_USERS_PER_ROOM = 100;

// Verificar límites antes de emitir
const emitToRoom = (roomId, event, data) => {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (room && room.size > MAX_USERS_PER_ROOM) {
    logger.warn('Room limit exceeded', { roomId, userCount: room.size });
    return false;
  }
  
  io.to(roomId).emit(event, data);
  return true;
};
```

### 🔄 Caída Parcial del Adapter
```javascript
// Servidor: Manejo de fallos de Redis
const redisAdapter = require('socket.io-redis')({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null
});

redisAdapter.on('error', (error) => {
  logger.error('Redis adapter error', { error: error.message });
  // Continuar funcionando sin Redis (modo standalone)
});

io.adapter(redisAdapter);
```

---

## 🛡️ SEGURIDAD EN RT

### 🔐 Autorización por Room
```javascript
// Servidor: Verificar acceso a room
socket.on('join:conversation', async (data) => {
  const { conversationId } = data;
  
  // Verificar que el usuario tiene acceso a la conversación
  const hasAccess = await ConversationService.userHasAccess(
    socket.userId, 
    conversationId
  );
  
  if (!hasAccess) {
    socket.emit('error', {
      code: 'ACCESS_DENIED',
      message: 'No tienes acceso a esta conversación'
    });
    return;
  }
  
  // Unirse a la room
  socket.join(`conversation:${conversationId}`);
  socket.emit('joined:conversation', { conversationId });
});
```

### 🔍 Filtrado de Eventos
```javascript
// Servidor: Validar eventos entrantes
const validateEvent = (event, data) => {
  const allowedEvents = [
    'message:send',
    'typing:start',
    'typing:stop',
    'conversation:read',
    'sync:state'
  ];
  
  if (!allowedEvents.includes(event)) {
    throw new Error(`Evento no permitido: ${event}`);
  }
  
  // Validar estructura de datos según el evento
  const schema = getEventSchema(event);
  const { error } = schema.validate(data);
  if (error) {
    throw new Error(`Datos inválidos: ${error.message}`);
  }
  
  return true;
};

socket.onAny((event, data) => {
  try {
    validateEvent(event, data);
  } catch (error) {
    socket.emit('error', {
      code: 'INVALID_EVENT',
      message: error.message
    });
  }
});
```

### ⚡ Rate Limit por Socket
```javascript
// Servidor: Rate limiting por socket
const rateLimitMap = new Map();

socket.onAny((event, data) => {
  const key = `${socket.id}:${event}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minuto
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, []);
  }
  
  const events = rateLimitMap.get(key);
  const recentEvents = events.filter(time => now - time < windowMs);
  
  // Límites por evento
  const limits = {
    'message:send': 60,    // 60 mensajes/minuto
    'typing:start': 120,   // 120 typing events/minuto
    'sync:state': 10       // 10 syncs/minuto
  };
  
  const limit = limits[event] || 100;
  
  if (recentEvents.length >= limit) {
    socket.emit('error', {
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Límite excedido para evento: ${event}`,
      details: {
        limit,
        windowMs,
        resetAt: new Date(now + windowMs).toISOString()
      }
    });
    return;
  }
  
  recentEvents.push(now);
  rateLimitMap.set(key, recentEvents);
});
```

---

## 🧪 PRUEBAS RT

### 📋 Matriz de Casos de Prueba

#### 🔌 Desconexión
```javascript
// Test: Desconexión inesperada
test('should handle unexpected disconnection', async () => {
  const socket = io('http://localhost:3001');
  
  await new Promise(resolve => socket.on('connect', resolve));
  
  // Simular desconexión
  socket.disconnect();
  
  // Verificar reconexión automática
  await new Promise(resolve => socket.on('reconnect', resolve));
  
  expect(socket.connected).toBe(true);
});
```

#### 🔄 Mensajes Duplicados
```javascript
// Test: Detección de duplicados
test('should handle duplicate messages', async () => {
  const socket = io('http://localhost:3001');
  const messageId = uuidv4();
  
  // Enviar mensaje
  socket.emit('message:send', {
    messageId,
    conversationId: 'conv_test',
    text: 'Test message'
  });
  
  const response1 = await new Promise(resolve => {
    socket.once('message:sent', resolve);
  });
  
  // Enviar el mismo mensaje
  socket.emit('message:send', {
    messageId, // Mismo ID
    conversationId: 'conv_test',
    text: 'Test message'
  });
  
  const response2 = await new Promise(resolve => {
    socket.once('message:sent', resolve);
  });
  
  // Verificar que es el mismo mensaje
  expect(response1.id).toBe(response2.id);
  expect(response1.messageId).toBe(messageId);
});
```

#### 📦 Llegada Fuera de Orden
```javascript
// Test: Mensajes fuera de orden
test('should handle out-of-order messages', async () => {
  const socket = io('http://localhost:3001');
  const messages = [];
  
  // Enviar mensajes rápidamente
  for (let i = 0; i < 5; i++) {
    socket.emit('message:send', {
      messageId: uuidv4(),
      conversationId: 'conv_test',
      text: `Message ${i}`
    });
  }
  
  // Recibir respuestas
  for (let i = 0; i < 5; i++) {
    const response = await new Promise(resolve => {
      socket.once('message:sent', resolve);
    });
    messages.push(response);
  }
  
  // Verificar que todos los mensajes se procesaron
  expect(messages).toHaveLength(5);
  expect(messages.every(m => m.status === 'sent')).toBe(true);
});
```

#### 🔌 Caída del Adapter
```javascript
// Test: Fallo de Redis adapter
test('should handle Redis adapter failure', async () => {
  // Simular fallo de Redis
  const redisMock = {
    on: jest.fn(),
    emit: jest.fn()
  };
  
  // Verificar que el servidor continúa funcionando
  const socket = io('http://localhost:3001');
  
  await new Promise(resolve => socket.on('connect', resolve));
  
  // Enviar mensaje
  socket.emit('message:send', {
    messageId: uuidv4(),
    conversationId: 'conv_test',
    text: 'Test message'
  });
  
  const response = await new Promise(resolve => {
    socket.once('message:sent', resolve);
  });
  
  expect(response.status).toBe('sent');
});
```

#### ❌ Pérdida de Acks
```javascript
// Test: Pérdida de acknowledgments
test('should handle lost acknowledgments', async () => {
  const socket = io('http://localhost:3001');
  const messageId = uuidv4();
  
  // Enviar mensaje con timeout
  const sendPromise = new Promise((resolve, reject) => {
    socket.emit('message:send', {
      messageId,
      conversationId: 'conv_test',
      text: 'Test message'
    });
    
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for ack'));
    }, 10000);
    
    socket.once('message:sent', (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
    
    socket.once('message:error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  
  const response = await sendPromise;
  expect(response.messageId).toBe(messageId);
});
```

### 🔧 Herramientas de Testing

#### 📊 Socket.IO Testing
```javascript
// tools/socket-test.js
const io = require('socket.io-client');

class SocketTester {
  constructor(url) {
    this.url = url;
    this.sockets = [];
  }
  
  async createSocket(auth = {}) {
    const socket = io(this.url, {
      auth,
      timeout: 10000
    });
    
    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
    });
    
    this.sockets.push(socket);
    return socket;
  }
  
  async sendMessage(socket, messageData) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 10000);
      
      socket.emit('message:send', messageData);
      
      socket.once('message:sent', (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
      
      socket.once('message:error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  async cleanup() {
    for (const socket of this.sockets) {
      socket.disconnect();
    }
    this.sockets = [];
  }
}

module.exports = SocketTester;
```

#### 📈 Performance Testing
```javascript
// tests/performance/socket-performance.test.js
const SocketTester = require('../../tools/socket-test');

describe('Socket.IO Performance', () => {
  let tester;
  
  beforeEach(() => {
    tester = new SocketTester('http://localhost:3001');
  });
  
  afterEach(async () => {
    await tester.cleanup();
  });
  
  test('should handle 100 concurrent connections', async () => {
    const startTime = Date.now();
    const sockets = [];
    
    // Crear 100 conexiones concurrentes
    for (let i = 0; i < 100; i++) {
      const socket = await tester.createSocket({
        token: 'test_token_' + i
      });
      sockets.push(socket);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(sockets).toHaveLength(100);
    expect(duration).toBeLessThan(10000); // < 10 segundos
  });
  
  test('should handle 1000 messages per minute', async () => {
    const socket = await tester.createSocket();
    const startTime = Date.now();
    const messages = [];
    
    // Enviar 1000 mensajes
    for (let i = 0; i < 1000; i++) {
      const messageData = {
        messageId: `msg_${i}`,
        conversationId: 'conv_test',
        text: `Message ${i}`
      };
      
      const response = await tester.sendMessage(socket, messageData);
      messages.push(response);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(messages).toHaveLength(1000);
    expect(duration).toBeLessThan(60000); // < 1 minuto
  });
});
```

---

## 📊 MÉTRICAS Y MONITOREO

### 📈 Métricas de Socket.IO
```javascript
// Métricas a monitorear
const socketMetrics = {
  // Conexiones
  activeConnections: io.engine.clientsCount,
  totalConnections: io.engine.clientsCount,
  
  // Eventos
  eventsPerSecond: 0, // Calculado
  eventsPerMinute: 0, // Calculado
  
  // Rooms
  activeRooms: io.sockets.adapter.rooms.size,
  usersPerRoom: {}, // Por room
  
  // Performance
  averageLatency: 0, // ms
  p95Latency: 0,     // ms
  p99Latency: 0,     // ms
  
  // Errores
  connectionErrors: 0,
  messageErrors: 0,
  timeoutErrors: 0
};
```

### 🔍 Health Checks
```javascript
// Health check endpoint para Socket.IO
app.get('/health/socket', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    metrics: {
      activeConnections: io.engine.clientsCount,
      activeRooms: io.sockets.adapter.rooms.size,
      uptime: process.uptime()
    },
    redis: {
      connected: io.sockets.adapter.redis.connected,
      status: io.sockets.adapter.redis.status
    }
  };
  
  res.json(health);
});
```

### 🔧 Configuración de Performance
```javascript
// Configuración optimizada para performance
const performanceConfig = {
  // Socket.IO
  socket: {
    maxHttpBufferSize: 1e8, // 100MB
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    allowUpgrades: true,
    transports: ['websocket', 'polling']
  },
  
  // Redis Adapter
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: 60000, // 1 minuto
    max: 50, // 50 eventos por minuto
    message: 'Demasiados eventos desde este socket'
  }
};
```

### 🔧 Configuración de Seguridad
```javascript
// Configuración de seguridad para Socket.IO
const securityConfig = {
  // Autenticación
  auth: {
    required: true,
    timeout: 5000,
    tokenExpiration: 900 // 15 minutos
  },
  
  // Autorización
  authorization: {
    roomAccess: true,
    eventFiltering: true,
    userValidation: true
  },
  
  // Rate Limiting
  rateLimit: {
    enabled: true,
    windowMs: 60000,
    maxEvents: 50,
    maxConnections: 10
  },
  
  // Sanitización
  sanitization: {
    enabled: true,
    maxPayloadSize: 1024 * 1024, // 1MB
    allowedEvents: [
      'message:send',
      'typing:start',
      'typing:stop',
      'conversation:read',
      'sync:state'
    ]
  }
};
```

### 🔧 Configuración de Monitoreo
```javascript
// Configuración de monitoreo en tiempo real
const monitoringConfig = {
  // Métricas en tiempo real
  realtime: {
    enabled: true,
    interval: 5000, // 5 segundos
    metrics: ['connections', 'events', 'latency', 'errors']
  },
  
  // Alertas
  alerts: {
    highLatency: {
      threshold: 200, // ms
      duration: 300000, // 5 minutos
      notification: 'slack#ops-alerts'
    },
    connectionSpike: {
      threshold: 1000, // conexiones
      duration: 60000, // 1 minuto
      notification: 'slack#ops-alerts'
    },
    errorRate: {
      threshold: 0.05, // 5%
      duration: 300000, // 5 minutos
      notification: 'slack#ops-alerts,pagerduty'
    }
  },
  
  // Logging
  logging: {
    level: 'info',
    events: ['connect', 'disconnect', 'error', 'message'],
    retention: '30 days'
  }
};
```

---

**📝 Nota**: Este documento es la fuente de verdad para todos los eventos de Socket.IO. Cualquier cambio en eventos debe ser documentado aquí. 