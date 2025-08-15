# 🚀 GUÍA DE INTEGRACIÓN FRONTEND - UTALK BACKEND

## 📋 ÍNDICE
1. [Configuración Inicial](#configuración-inicial)
2. [Autenticación](#autenticación)
3. [WebSocket (Socket.IO)](#websocket-socketio)
4. [APIs de Conversaciones](#apis-de-conversaciones)
5. [APIs de Mensajes](#apis-de-mensajes)
6. [APIs de Contactos](#apis-de-contactos)
7. [APIs de IA](#apis-de-ia)
8. [APIs de Autenticación](#apis-de-autenticación)
9. [Manejo de Errores](#manejo-de-errores)
10. [Ejemplos de Implementación](#ejemplos-de-implementación)

---

## 🔧 CONFIGURACIÓN INICIAL

### Variables de Entorno Requeridas
```javascript
// Configuración del backend
const BACKEND_URL = 'https://tu-backend.railway.app'; // o tu URL
const SOCKET_URL = BACKEND_URL; // Mismo dominio para WebSocket

// Configuración de autenticación
const AUTH_STORAGE_KEY = 'utalk_auth_tokens';
const REFRESH_TOKEN_KEY = 'utalk_refresh_token';
```

### Configuración de Axios
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para renovar token automáticamente
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        try {
          const response = await api.post('/api/auth/refresh', { refreshToken });
          localStorage.setItem('access_token', response.data.accessToken);
          error.config.headers.Authorization = `Bearer ${response.data.accessToken}`;
          return api.request(error.config);
        } catch (refreshError) {
          // Redirigir al login
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 🔐 AUTENTICACIÓN

### Login
```javascript
const login = async (email, password) => {
  try {
    const response = await api.post('/api/auth/login', { email, password });
    
    // Guardar tokens
    localStorage.setItem('access_token', response.data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refreshToken);
    localStorage.setItem('user_profile', JSON.stringify(response.data.user));
    
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Error de autenticación');
  }
};
```

### Logout
```javascript
const logout = async () => {
  try {
    await api.post('/api/auth/logout');
  } catch (error) {
    console.warn('Error en logout:', error);
  } finally {
    localStorage.clear();
    // Desconectar socket si está activo
    if (socket) {
      socket.disconnect();
    }
  }
};
```

### Validar Token
```javascript
const validateToken = async () => {
  try {
    const response = await api.post('/api/auth/validate-token');
    return response.data.valid;
  } catch (error) {
    return false;
  }
};
```

---

## 🔄 WEBSOCKET (SOCKET.IO)

### Configuración del Socket
```javascript
import { io } from 'socket.io-client';

let socket = null;

const initializeSocket = () => {
  const token = localStorage.getItem('access_token');
  
  socket = io(SOCKET_URL, {
    auth: {
      token: token
    },
    transports: ['websocket', 'polling'],
    timeout: 30000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  setupSocketListeners();
  return socket;
};

const setupSocketListeners = () => {
  // Conexión
  socket.on('connect', () => {
    console.log('Socket conectado:', socket.id);
    // Sincronizar estado inicial
    socket.emit('sync-state', { syncId: Date.now() });
  });

  // Desconexión
  socket.on('disconnect', (reason) => {
    console.log('Socket desconectado:', reason);
  });

  // Errores
  socket.on('error', (error) => {
    console.error('Error de socket:', error);
  });

  // Estado sincronizado
  socket.on('state-synced', (data) => {
    console.log('Estado sincronizado:', data);
    // Actualizar estado de la aplicación
    updateAppState(data);
  });

  // Nuevos mensajes
  socket.on('new-message', (data) => {
    console.log('Nuevo mensaje recibido:', data);
    // Actualizar conversación en tiempo real
    handleNewMessage(data);
  });

  // Mensaje enviado (confirmación)
  socket.on('message-sent', (data) => {
    console.log('Mensaje enviado confirmado:', data);
    // Actualizar estado del mensaje
    handleMessageSent(data);
  });

  // Mensaje leído
  socket.on('message-read', (data) => {
    console.log('Mensaje marcado como leído:', data);
    // Actualizar indicadores de lectura
    handleMessageRead(data);
  });

  // Usuario escribiendo
  socket.on('typing', (data) => {
    console.log('Usuario escribiendo:', data);
    // Mostrar indicador de escritura
    showTypingIndicator(data);
  });

  // Usuario dejó de escribir
  socket.on('typing-stop', (data) => {
    console.log('Usuario dejó de escribir:', data);
    // Ocultar indicador de escritura
    hideTypingIndicator(data);
  });

  // Usuario en línea
  socket.on('user-online', (data) => {
    console.log('Usuario en línea:', data);
    // Actualizar estado de presencia
    updateUserPresence(data);
  });

  // Usuario desconectado
  socket.on('user-offline', (data) => {
    console.log('Usuario desconectado:', data);
    // Actualizar estado de presencia
    updateUserPresence(data);
  });

  // Evento de conversación
  socket.on('conversation-event', (data) => {
    console.log('Evento de conversación:', data);
    // Actualizar lista de conversaciones
    handleConversationEvent(data);
  });

  // Shutdown del servidor
  socket.on('server-shutdown', (data) => {
    console.log('Servidor reiniciándose:', data);
    // Mostrar notificación y reconectar
    showReconnectionMessage(data);
  });

  // Sincronización requerida
  socket.on('sync-required', (data) => {
    console.log('Sincronización requerida:', data);
    // Reconectar y sincronizar
    socket.emit('sync-state', { syncId: Date.now() });
  });
};
```

### Métodos del Socket
```javascript
// Unirse a conversación
const joinConversation = (conversationId) => {
  socket.emit('join-conversation', { conversationId });
};

// Salir de conversación
const leaveConversation = (conversationId) => {
  socket.emit('leave-conversation', { conversationId });
};

// Enviar mensaje
const sendMessage = (conversationId, content, type = 'text', metadata = {}) => {
  socket.emit('new-message', {
    conversationId,
    content,
    type,
    metadata
  });
};

// Indicar que está escribiendo
const startTyping = (conversationId) => {
  socket.emit('typing', { conversationId });
};

// Indicar que dejó de escribir
const stopTyping = (conversationId) => {
  socket.emit('typing-stop', { conversationId });
};

// Marcar mensajes como leídos
const markMessagesAsRead = (conversationId, messageIds) => {
  socket.emit('message-read', {
    conversationId,
    messageIds
  });
};

// Cambiar estado de usuario
const changeUserStatus = (status) => {
  socket.emit('user-status-change', { status });
};

// Sincronizar estado
const syncState = () => {
  socket.emit('sync-state', { syncId: Date.now() });
};
```

---

## 💬 APIS DE CONVERSACIONES

### Listar Conversaciones
```javascript
const getConversations = async (params = {}) => {
  const queryParams = new URLSearchParams({
    page: params.page || 1,
    limit: params.limit || 20,
    status: params.status || 'all',
    priority: params.priority || '',
    assignedTo: params.assignedTo || '',
    search: params.search || ''
  });

  const response = await api.get(`/api/conversations?${queryParams}`);
  return response.data;
};
```

### Obtener Conversación
```javascript
const getConversation = async (conversationId) => {
  const response = await api.get(`/api/conversations/${conversationId}`);
  return response.data;
};
```

### Crear Conversación
```javascript
const createConversation = async (conversationData) => {
  const response = await api.post('/api/conversations', {
    customerPhone: conversationData.customerPhone,
    customerName: conversationData.customerName,
    subject: conversationData.subject,
    priority: conversationData.priority || 'medium',
    tags: conversationData.tags || [],
    metadata: conversationData.metadata || {}
  });
  return response.data;
};
```

### Actualizar Conversación
```javascript
const updateConversation = async (conversationId, updateData) => {
  const response = await api.put(`/api/conversations/${conversationId}`, {
    customerName: updateData.customerName,
    subject: updateData.subject,
    status: updateData.status,
    priority: updateData.priority,
    tags: updateData.tags,
    metadata: updateData.metadata
  });
  return response.data;
};
```

### Asignar Conversación
```javascript
const assignConversation = async (conversationId, agentEmail) => {
  const response = await api.put(`/api/conversations/${conversationId}/assign`, {
    agentEmail
  });
  return response.data;
};
```

### Desasignar Conversación
```javascript
const unassignConversation = async (conversationId) => {
  const response = await api.put(`/api/conversations/${conversationId}/unassign`);
  return response.data;
};
```

### Transferir Conversación
```javascript
const transferConversation = async (conversationId, targetAgentEmail, reason) => {
  const response = await api.post(`/api/conversations/${conversationId}/transfer`, {
    targetAgentEmail,
    reason
  });
  return response.data;
};
```

### Cambiar Estado
```javascript
const changeConversationStatus = async (conversationId, status) => {
  const response = await api.put(`/api/conversations/${conversationId}/status`, {
    status
  });
  return response.data;
};
```

### Cambiar Prioridad
```javascript
const changeConversationPriority = async (conversationId, priority) => {
  const response = await api.put(`/api/conversations/${conversationId}/priority`, {
    priority
  });
  return response.data;
};
```

### Marcar como Leído
```javascript
const markConversationAsRead = async (conversationId) => {
  const response = await api.put(`/api/conversations/${conversationId}/read-all`);
  return response.data;
};
```

### Indicar Escritura
```javascript
const indicateTyping = async (conversationId) => {
  const response = await api.post(`/api/conversations/${conversationId}/typing`);
  return response.data;
};
```

### Eliminar Conversación
```javascript
const deleteConversation = async (conversationId) => {
  const response = await api.delete(`/api/conversations/${conversationId}`);
  return response.data;
};
```

---

## 📨 APIS DE MENSAJES

### Obtener Mensajes
```javascript
const getMessages = async (conversationId, params = {}) => {
  const queryParams = new URLSearchParams({
    conversationId,
    limit: params.limit || 50,
    cursor: params.cursor || '',
    before: params.before || '',
    after: params.after || ''
  });

  const response = await api.get(`/api/messages?${queryParams}`);
  return response.data;
};
```

### Enviar Mensaje
```javascript
const sendMessage = async (conversationId, messageData) => {
  const response = await api.post(`/api/conversations/${conversationId}/messages`, {
    content: messageData.content,
    type: messageData.type || 'text',
    replyToMessageId: messageData.replyToMessageId,
    metadata: messageData.metadata || {}
  });
  return response.data;
};
```

### Marcar Mensaje como Leído
```javascript
const markMessageAsRead = async (conversationId, messageId) => {
  const response = await api.put(`/api/conversations/${conversationId}/messages/${messageId}/read`, {
    readAt: new Date().toISOString()
  });
  return response.data;
};
```

### Eliminar Mensaje
```javascript
const deleteMessage = async (conversationId, messageId) => {
  const response = await api.delete(`/api/conversations/${conversationId}/messages/${messageId}`);
  return response.data;
};
```

### Enviar Ubicación
```javascript
const sendLocation = async (locationData) => {
  const response = await api.post('/api/messages/send-location', {
    to: locationData.to,
    latitude: locationData.latitude,
    longitude: locationData.longitude,
    name: locationData.name,
    address: locationData.address,
    conversationId: locationData.conversationId
  });
  return response.data;
};
```

### Enviar Sticker
```javascript
const sendSticker = async (stickerData) => {
  const response = await api.post('/api/messages/send-sticker', {
    to: stickerData.to,
    stickerUrl: stickerData.stickerUrl,
    conversationId: stickerData.conversationId
  });
  return response.data;
};
```

---

## 👥 APIS DE CONTACTOS

### Listar Contactos
```javascript
const getContacts = async (params = {}) => {
  const queryParams = new URLSearchParams({
    page: params.page || 1,
    limit: params.limit || 20,
    q: params.search || '',
    tags: params.tags || ''
  });

  const response = await api.get(`/api/contacts?${queryParams}`);
  return response.data;
};
```

### Obtener Contacto
```javascript
const getContact = async (contactId) => {
  const response = await api.get(`/api/contacts/${contactId}`);
  return response.data;
};
```

### Crear Contacto
```javascript
const createContact = async (contactData) => {
  const response = await api.post('/api/contacts', {
    phone: contactData.phone,
    name: contactData.name,
    email: contactData.email,
    company: contactData.company,
    tags: contactData.tags || [],
    metadata: contactData.metadata || {}
  });
  return response.data;
};
```

### Actualizar Contacto
```javascript
const updateContact = async (contactId, updateData) => {
  const response = await api.put(`/api/contacts/${contactId}`, {
    name: updateData.name,
    email: updateData.email,
    company: updateData.company,
    tags: updateData.tags,
    metadata: updateData.metadata
  });
  return response.data;
};
```

### Eliminar Contacto
```javascript
const deleteContact = async (contactId) => {
  const response = await api.delete(`/api/contacts/${contactId}`);
  return response.data;
};
```

### Importar Contactos
```javascript
const importContacts = async (contactsData) => {
  const response = await api.post('/api/contacts/import', {
    contacts: contactsData.contacts,
    tags: contactsData.tags || [],
    updateExisting: contactsData.updateExisting || false
  });
  return response.data;
};
```

### Agregar Tags
```javascript
const addContactTags = async (contactId, tags) => {
  const response = await api.post(`/api/contacts/${contactId}/tags`, {
    tags
  });
  return response.data;
};
```

### Remover Tags
```javascript
const removeContactTags = async (contactId, tags) => {
  const response = await api.delete(`/api/contacts/${contactId}/tags`, {
    data: { tags }
  });
  return response.data;
};
```

### Obtener Tags
```javascript
const getContactTags = async () => {
  const response = await api.get('/api/contacts/tags');
  return response.data;
};
```

### Buscar Contacto por Teléfono
```javascript
const searchContactByPhone = async (phone) => {
  const response = await api.get(`/api/contacts/search?q=${phone}`);
  return response.data;
};
```

### Obtener Estadísticas
```javascript
const getContactStats = async (params = {}) => {
  const queryParams = new URLSearchParams({
    period: params.period || '30d',
    userId: params.userId || ''
  });

  const response = await api.get(`/api/contacts/stats?${queryParams}`);
  return response.data;
};
```

---

## 🤖 APIS DE IA

### Obtener Configuración IA
```javascript
const getAIConfig = async (workspaceId) => {
  const response = await api.get(`/api/ai/config/${workspaceId}`);
  return response.data;
};
```

### Actualizar Configuración IA
```javascript
const updateAIConfig = async (workspaceId, config) => {
  const response = await api.put(`/api/ai/config/${workspaceId}`, config);
  return response.data;
};
```

### Generar Sugerencia
```javascript
const generateSuggestion = async (suggestionData) => {
  const response = await api.post('/api/ai/suggestions/generate', {
    workspaceId: suggestionData.workspaceId,
    conversationId: suggestionData.conversationId,
    messageId: suggestionData.messageId
  });
  return response.data;
};
```

### Prueba de Sugerencia
```javascript
const testSuggestion = async (suggestionData) => {
  const response = await api.post('/api/ai/test-suggestion', {
    workspaceId: suggestionData.workspaceId,
    conversationId: suggestionData.conversationId,
    messageId: suggestionData.messageId
  });
  return response.data;
};
```

### Obtener Sugerencias
```javascript
const getSuggestions = async (conversationId, params = {}) => {
  const queryParams = new URLSearchParams({
    limit: params.limit || 10,
    status: params.status || ''
  });

  const response = await api.get(`/api/ai/suggestions/${conversationId}?${queryParams}`);
  return response.data;
};
```

### Actualizar Estado de Sugerencia
```javascript
const updateSuggestionStatus = async (conversationId, suggestionId, status) => {
  const response = await api.put(`/api/ai/suggestions/${conversationId}/${suggestionId}/status`, {
    status
  });
  return response.data;
};
```

### Obtener Estadísticas IA
```javascript
const getAIStats = async (workspaceId, params = {}) => {
  const queryParams = new URLSearchParams({
    days: params.days || 7
  });

  const response = await api.get(`/api/ai/stats/${workspaceId}?${queryParams}`);
  return response.data;
};
```

### Health Check IA
```javascript
const getAIHealth = async () => {
  const response = await api.get('/api/ai/health');
  return response.data;
};
```

---

## 🔐 APIS DE AUTENTICACIÓN

### Obtener Perfil
```javascript
const getProfile = async () => {
  const response = await api.get('/api/auth/profile');
  return response.data;
};
```

### Actualizar Perfil
```javascript
const updateProfile = async (profileData) => {
  const response = await api.put('/api/auth/profile', profileData);
  return response.data;
};
```

### Cambiar Contraseña
```javascript
const changePassword = async (passwordData) => {
  const response = await api.post('/api/auth/change-password', passwordData);
  return response.data;
};
```

### Crear Usuario (Admin)
```javascript
const createUser = async (userData) => {
  const response = await api.post('/api/auth/create-user', {
    email: userData.email,
    password: userData.password,
    name: userData.name,
    phone: userData.phone,
    role: userData.role || 'viewer'
  });
  return response.data;
};
```

### Obtener Sesiones Activas
```javascript
const getActiveSessions = async () => {
  const response = await api.get('/api/auth/sessions');
  return response.data;
};
```

### Cerrar Sesión Específica
```javascript
const closeSession = async (sessionId) => {
  const response = await api.delete(`/api/auth/sessions/${sessionId}`);
  return response.data;
};
```

---

## ❌ MANEJO DE ERRORES

### Estructura de Error
```javascript
const handleApiError = (error) => {
  const errorResponse = {
    message: 'Error desconocido',
    code: 'UNKNOWN_ERROR',
    details: null
  };

  if (error.response) {
    // Error de respuesta del servidor
    errorResponse.message = error.response.data?.message || 'Error del servidor';
    errorResponse.code = error.response.data?.code || 'SERVER_ERROR';
    errorResponse.details = error.response.data?.details || null;
    errorResponse.status = error.response.status;
  } else if (error.request) {
    // Error de red
    errorResponse.message = 'Error de conexión';
    errorResponse.code = 'NETWORK_ERROR';
  } else {
    // Error de configuración
    errorResponse.message = error.message || 'Error de configuración';
    errorResponse.code = 'CONFIG_ERROR';
  }

  return errorResponse;
};
```

### Códigos de Error Comunes
```javascript
const ERROR_CODES = {
  // Autenticación
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Autorización
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validación
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PHONE: 'INVALID_PHONE',
  INVALID_EMAIL: 'INVALID_EMAIL',
  
  // Recursos
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  CONTACT_NOT_FOUND: 'CONTACT_NOT_FOUND',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  
  // Socket
  SOCKET_CONNECTION_ERROR: 'SOCKET_CONNECTION_ERROR',
  SOCKET_AUTHENTICATION_ERROR: 'SOCKET_AUTHENTICATION_ERROR',
  
  // IA
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  AI_CONFIGURATION_ERROR: 'AI_CONFIGURATION_ERROR',
  
  // Servidor
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};
```

---

## 💡 EJEMPLOS DE IMPLEMENTACIÓN

### Hook de Chat Completo
```javascript
import { useState, useEffect, useCallback } from 'react';

const useChat = (conversationId) => {
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);

  // Cargar mensajes iniciales
  useEffect(() => {
    if (conversationId) {
      loadMessages();
      loadConversation();
      joinConversation();
    }
  }, [conversationId]);

  // Configurar listeners de socket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => [...prev, data.message]);
      }
    };

    const handleTyping = (data) => {
      if (data.conversationId === conversationId) {
        setTypingUsers(prev => [...prev.filter(u => u !== data.userEmail), data.userEmail]);
      }
    };

    const handleTypingStop = (data) => {
      if (data.conversationId === conversationId) {
        setTypingUsers(prev => prev.filter(u => u !== data.userEmail));
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('typing', handleTyping);
    socket.on('typing-stop', handleTypingStop);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('typing', handleTyping);
      socket.off('typing-stop', handleTypingStop);
      leaveConversation();
    };
  }, [conversationId]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await getMessages(conversationId, { limit: 50 });
      setMessages(response.messages || []);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async () => {
    try {
      const response = await getConversation(conversationId);
      setConversation(response);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const joinConversation = () => {
    if (socket) {
      socket.emit('join-conversation', { conversationId });
    }
  };

  const leaveConversation = () => {
    if (socket) {
      socket.emit('leave-conversation', { conversationId });
    }
  };

  const sendMessage = useCallback(async (content, type = 'text') => {
    try {
      // Enviar por socket para tiempo real
      socket.emit('new-message', {
        conversationId,
        content,
        type
      });

      // También enviar por API para persistencia
      const response = await sendMessageAPI(conversationId, { content, type });
      return response;
    } catch (err) {
      setError(handleApiError(err));
      throw err;
    }
  }, [conversationId]);

  const startTyping = useCallback(() => {
    socket.emit('typing', { conversationId });
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    socket.emit('typing-stop', { conversationId });
  }, [conversationId]);

  return {
    messages,
    conversation,
    loading,
    error,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping,
    refresh: loadMessages
  };
};
```

### Componente de Chat
```javascript
import React, { useState, useRef, useEffect } from 'react';
import { useChat } from './hooks/useChat';

const ChatComponent = ({ conversationId }) => {
  const {
    messages,
    conversation,
    loading,
    error,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping
  } = useChat(conversationId);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    try {
      await sendMessage(inputValue);
      setInputValue('');
      stopTyping();
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      startTyping();
    }
  };

  const handleInputBlur = () => {
    setIsTyping(false);
    stopTyping();
  };

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>{conversation?.customerName || 'Conversación'}</h3>
        <span className="status">{conversation?.status}</span>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.direction}`}>
            <div className="message-content">{message.content}</div>
            <div className="message-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            {typingUsers.join(', ')} está escribiendo...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder="Escribe un mensaje..."
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>Enviar</button>
      </div>
    </div>
  );
};
```

### Hook de Conversaciones
```javascript
const useConversations = (filters = {}) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });

  const loadConversations = async (page = 1) => {
    try {
      setLoading(true);
      const response = await getConversations({
        ...filters,
        page,
        limit: pagination.limit
      });
      
      setConversations(response.conversations || []);
      setPagination({
        page: response.page || 1,
        limit: response.limit || 20,
        total: response.total || 0
      });
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [filters]);

  // Escuchar eventos de conversación en tiempo real
  useEffect(() => {
    if (!socket) return;

    const handleConversationEvent = (data) => {
      setConversations(prev => {
        const index = prev.findIndex(c => c.id === data.conversationId);
        if (index >= 0) {
          // Actualizar conversación existente
          const updated = [...prev];
          updated[index] = { ...updated[index], ...data };
          return updated;
        } else {
          // Agregar nueva conversación al inicio
          return [data, ...prev];
        }
      });
    };

    socket.on('conversation-event', handleConversationEvent);

    return () => {
      socket.off('conversation-event', handleConversationEvent);
    };
  }, []);

  return {
    conversations,
    loading,
    error,
    pagination,
    refresh: () => loadConversations(1),
    loadMore: () => loadConversations(pagination.page + 1)
  };
};
```

---

## 🎯 CONSIDERACIONES FINALES

### Mejores Prácticas
1. **Manejo de Estado**: Usa un estado global (Redux, Zustand, Context) para datos compartidos
2. **Optimistic Updates**: Actualiza la UI inmediatamente y revierte en caso de error
3. **Debouncing**: Implementa debounce para eventos de escritura
4. **Error Boundaries**: Usa React Error Boundaries para capturar errores
5. **Loading States**: Muestra estados de carga apropiados
6. **Retry Logic**: Implementa reintentos automáticos para operaciones fallidas
7. **Offline Support**: Considera funcionalidad offline con sincronización

### Seguridad
1. **Validación**: Valida todos los inputs en el frontend
2. **Sanitización**: Sanitiza datos antes de enviarlos
3. **Tokens**: Maneja tokens de forma segura
4. **HTTPS**: Usa siempre HTTPS en producción
5. **CORS**: Configura CORS apropiadamente

### Performance
1. **Paginación**: Implementa paginación para listas grandes
2. **Virtualización**: Usa virtualización para listas muy largas
3. **Caching**: Cachea datos apropiadamente
4. **Lazy Loading**: Carga componentes y datos bajo demanda
5. **Bundle Splitting**: Divide el bundle por rutas

### Testing
1. **Unit Tests**: Prueba funciones individuales
2. **Integration Tests**: Prueba flujos completos
3. **E2E Tests**: Prueba la aplicación completa
4. **Socket Tests**: Prueba eventos de WebSocket
5. **Error Scenarios**: Prueba casos de error

---

## 📞 SOPORTE

Para soporte técnico o preguntas sobre la integración:
- Email: soporte@utalk.com
- Documentación: https://docs.utalk.com
- GitHub: https://github.com/utalk/backend

---

**¡Feliz integración! 🚀** 

---

## 📜 CONTRATOS Y CONVENCIONES (IDs, Rooms, Eventos)

### Reglas de ID de conversación (conv_{phone1}_{phone2})
- **En path HTTP**: usar `+` literal. Ej.: `/api/conversations/conv_+5214773790184_+5214793176502`
- **En query HTTP**: URL-encode de `+` como `%2B`. Ej.: `/api/messages?conversationId=conv_%2B5211477...`
- **En WebSocket**: enviar y escuchar siempre con `+` literal.

### Rooms de Socket.IO
- Formato: `ws:{workspace}:ten:{tenant}:conv:{id}`
- Ejemplo: `ws:default:ten:na:conv:conv_+5214773790184_+5214793176502`

### Eventos y acks relevantes
- **Join a conversación**
  - Emit: `join-conversation` `{ conversationId }`
  - Ack: evento `conversation-joined` con payload `{ ok:true, conversationId, roomId, onlineUsers, timestamp }`

- **Marcar mensajes como leídos (lote)**
  - Emit: `message-read` `{ conversationId, messageIds[] }`
  - Ack: `message-read-ack` `{ ok:true, conversationId, messageIds, updated, timestamp }`
  - Broadcast a la sala: `message-read` `{ conversationId, messageIds, readBy, timestamp }`
  - Además, se recalcula `unreadCount` y se emite actualización de conversación (ver abajo).

- **Actualización de conversación (contador)**
  - Eventos gemelos emitidos a la sala tras reads o cambios:
    - `conversation-event`
    - `conversation.updated`
  - Payload: `{ conversationId, unreadCount, updatedAt, lastMessage?, correlationId? }`

### Manejo de 429 (HTTP/WS) y shape de errores
- **HTTP 429**
  - Respuesta JSON típica:
    ```json
    {
      "success": false,
      "error": {
        "type": "RATE_LIMIT_ERROR",
        "code": "TOO_MANY_REQUESTS",
        "message": "Has superado el límite de solicitudes.",
        "timestamp": "2025-01-01T00:00:00.000Z"
      }
    }
    ```
  - Recomendación FE: backoff exponencial y retry después de `Retry-After` si está presente.

- **WS rate limit / errores**
  - Canal de errores: evento `error`
  - Shape sugerido por backend:
    ```json
    {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "Too many events in a short time",
      "details": { "windowMs": 10000, "limit": 30 }
    }
    ```
  - Recomendación FE: pausar envíos por `windowMs` y reintentar. 

---

## 🔧 Helpers recomendados (IDs y encoding)

```javascript
// ID de conversación canónico con +
export const encodeConversationIdForUrl = (id) => id; // Path usa +
export const encodeConversationIdForQuery = (id) => id.replace(/\+/g, '%2B'); // Query encode de +
export const encodeConversationIdForWebSocket = (id) => id; // WS usa +

// Ejemplo de uso (HTTP):
const conversationId = 'conv_+5214773790184_+5214793176502';
const url = `/api/messages?conversationId=${encodeConversationIdForQuery(conversationId)}&limit=50`;
```

## 🔔 Listeners recomendados (acks y actualizaciones)

```javascript
// Acks y actualizaciones clave
socket.on('conversation-joined', (data) => {
  console.log('JOIN ACK:', data); // { ok:true, roomId, ... }
});

socket.on('message-read-ack', (data) => {
  console.log('READ ACK:', data); // { ok:true, updated, ... }
});

// Actualización de contador sin refresh
socket.on('conversation-event', (payload) => {
  // { conversationId, unreadCount, updatedAt, ... }
  updateConversationCounters(payload);
});

socket.on('conversation.updated', (payload) => {
  updateConversationCounters(payload);
});
```

## 🧪 Ejemplo completo: marcar leídos con ack + contador

```javascript
const markAsRead = (conversationId, messageIds) => {
  socket.emit('message-read', { conversationId, messageIds });
};

// Listeners (ver sección anterior)
socket.on('message-read-ack', ({ ok, updated, conversationId }) => {
  if (ok) {
    console.log(`Marcados como leídos: ${updated}`);
  }
});

socket.on('conversation-event', ({ conversationId, unreadCount }) => {
  // Reflejar en UI inmediatamente
  setConversationUnread(conversationId, unreadCount);
});
```

## 🔁 Manejo de 429 (HTTP y WS)

```javascript
// HTTP backoff simple
const withBackoff = async (fn, { tries = 3, baseDelay = 500 } = {}) => {
  let attempt = 0;
  while (attempt < tries) {
    try { return await fn(); } catch (e) {
      const status = e?.response?.status;
      if (status !== 429) throw e;
      const retryAfter = Number(e.response.headers['retry-after'] || 0);
      const delay = retryAfter > 0 ? retryAfter * 1000 : baseDelay * 2 ** attempt;
      await new Promise(r => setTimeout(r, Math.min(delay, 8000)));
      attempt++;
    }
  }
  throw new Error('Too many requests');
};

// WS: pausar envíos al recibir error de rate limit
let wsBlockedUntil = 0;
socket.on('error', (err) => {
  if (err?.code === 'RATE_LIMIT_EXCEEDED') {
    const { windowMs = 10000 } = err.details || {};
    wsBlockedUntil = Date.now() + windowMs;
  }
});

const safeEmit = (event, payload) => {
  if (Date.now() < wsBlockedUntil) return; // descartar hasta liberar
  socket.emit(event, payload);
};
```

## ℹ️ Logout idempotente (contrato)

- No requiere token válido; si el access token expiró, responde 200 igualmente.
- Cuerpo opcional: `{ refreshToken?: string, invalidateAll?: boolean }`.
- Recomendación FE: llamar siempre a `/api/auth/logout` y luego limpiar storage; ignorar errores. 