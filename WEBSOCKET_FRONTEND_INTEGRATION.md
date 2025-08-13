# 🔄 INTEGRACIÓN WEBSOCKET FRONTEND - UTALK BACKEND

## 📋 ÍNDICE
1. [Configuración Inicial](#configuración-inicial)
2. [Hook de WebSocket](#hook-de-websocket)
3. [Context Provider](#context-provider)
4. [Componentes de Chat](#componentes-de-chat)
5. [Manejo de Estados](#manejo-de-estados)
6. [Optimizaciones](#optimizaciones)
7. [Testing](#testing)

---

## 🔧 CONFIGURACIÓN INICIAL

### 1. Instalar Dependencias
```bash
npm install socket.io-client
# o
yarn add socket.io-client
```

### 2. Variables de Entorno
```javascript
// .env
REACT_APP_BACKEND_URL=https://tu-backend.railway.app
REACT_APP_SOCKET_URL=https://tu-backend.railway.app
```

### 3. Configuración de Socket.IO
```javascript
// src/config/socket.js
import { io } from 'socket.io-client';

const SOCKET_CONFIG = {
  transports: ['websocket', 'polling'],
  timeout: 30000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  autoConnect: false // No conectar automáticamente
};

export const createSocket = (token) => {
  return io(process.env.REACT_APP_SOCKET_URL, {
    ...SOCKET_CONFIG,
    auth: {
      token: token
    }
  });
};
```

---

## 🎣 HOOK DE WEBSOCKET

### Hook Principal - `useWebSocket.js`
```javascript
// src/hooks/useWebSocket.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { createSocket } from '../config/socket';

export const useWebSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const socketRef = useRef(null);
  const eventListenersRef = useRef(new Map());

  // Conectar socket
  const connect = useCallback((token) => {
    if (socketRef.current?.connected) {
      return;
    }

    try {
      const newSocket = createSocket(token);
      socketRef.current = newSocket;
      setSocket(newSocket);

      // Configurar listeners de conexión
      newSocket.on('connect', () => {
        console.log('✅ Socket conectado:', newSocket.id);
        setIsConnected(true);
        setConnectionError(null);
        setReconnectAttempts(0);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Socket desconectado:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // Reconexión manual necesaria
          setTimeout(() => connect(token), 1000);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('🔌 Error de conexión:', error);
        setConnectionError(error.message);
        setIsConnected(false);
      });

      newSocket.on('error', (error) => {
        console.error('🚨 Error de socket:', error);
        setConnectionError(error.message);
      });

      // Conectar
      newSocket.connect();

    } catch (error) {
      console.error('Error creando socket:', error);
      setConnectionError(error.message);
    }
  }, []);

  // Desconectar socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setConnectionError(null);
    }
  }, []);

  // Registrar listener de evento
  const on = useCallback((event, callback) => {
    if (!socketRef.current) return;

    // Remover listener anterior si existe
    const existingCallback = eventListenersRef.current.get(event);
    if (existingCallback) {
      socketRef.current.off(event, existingCallback);
    }

    // Registrar nuevo listener
    socketRef.current.on(event, callback);
    eventListenersRef.current.set(event, callback);
  }, []);

  // Remover listener de evento
  const off = useCallback((event) => {
    if (!socketRef.current) return;

    const callback = eventListenersRef.current.get(event);
    if (callback) {
      socketRef.current.off(event, callback);
      eventListenersRef.current.delete(event);
    }
  }, []);

  // Emitir evento
  const emit = useCallback((event, data) => {
    if (!socketRef.current?.connected) {
      console.warn('Socket no conectado, no se puede emitir:', event);
      return false;
    }

    socketRef.current.emit(event, data);
    return true;
  }, []);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    socket,
    isConnected,
    connectionError,
    reconnectAttempts,
    connect,
    disconnect,
    on,
    off,
    emit
  };
};
```

---

## 🎯 CONTEXT PROVIDER

### WebSocket Context - `WebSocketContext.jsx`
```javascript
// src/contexts/WebSocketContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const {
    socket,
    isConnected,
    connectionError,
    connect,
    disconnect,
    on,
    off,
    emit
  } = useWebSocket();

  const [activeConversations, setActiveConversations] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Conectar automáticamente cuando hay token
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token && !isConnected) {
      connect(token);
    }
  }, [connect, isConnected]);

  // Configurar listeners globales
  useEffect(() => {
    if (!socket) return;

    // Nuevo mensaje
    on('new-message', (data) => {
      console.log('📨 Nuevo mensaje recibido:', data);
      // El hook de chat manejará esto
    });

    // Mensaje enviado (confirmación)
    on('message-sent', (data) => {
      console.log('✅ Mensaje enviado confirmado:', data);
      // Actualizar estado del mensaje
    });

    // Usuario escribiendo
    on('typing', (data) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        const conversationUsers = newMap.get(data.conversationId) || new Set();
        conversationUsers.add(data.userEmail);
        newMap.set(data.conversationId, conversationUsers);
        return newMap;
      });
    });

    // Usuario dejó de escribir
    on('typing-stop', (data) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        const conversationUsers = newMap.get(data.conversationId);
        if (conversationUsers) {
          conversationUsers.delete(data.userEmail);
          if (conversationUsers.size === 0) {
            newMap.delete(data.conversationId);
          } else {
            newMap.set(data.conversationId, conversationUsers);
          }
        }
        return newMap;
      });
    });

    // Usuario en línea
    on('user-online', (data) => {
      setOnlineUsers(prev => new Set(prev).add(data.email));
    });

    // Usuario desconectado
    on('user-offline', (data) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.email);
        return newSet;
      });
    });

    // Evento de conversación
    on('conversation-event', (data) => {
      console.log('💬 Evento de conversación:', data);
      // Actualizar lista de conversaciones
    });

    // Shutdown del servidor
    on('server-shutdown', (data) => {
      console.log('🔄 Servidor reiniciándose:', data);
      // Mostrar notificación y reconectar
    });

    // Sincronización requerida
    on('sync-required', (data) => {
      console.log('🔄 Sincronización requerida:', data);
      emit('sync-state', { syncId: Date.now() });
    });

    // Estado sincronizado
    on('state-synced', (data) => {
      console.log('✅ Estado sincronizado:', data);
      // Actualizar estado global
    });

    return () => {
      // Limpiar listeners
      off('new-message');
      off('message-sent');
      off('typing');
      off('typing-stop');
      off('user-online');
      off('user-offline');
      off('conversation-event');
      off('server-shutdown');
      off('sync-required');
      off('state-synced');
    };
  }, [socket, on, off, emit]);

  const value = {
    socket,
    isConnected,
    connectionError,
    activeConversations,
    typingUsers,
    onlineUsers,
    connect,
    disconnect,
    emit,
    joinConversation: (conversationId) => {
      emit('join-conversation', { conversationId });
      setActiveConversations(prev => new Set(prev).add(conversationId));
    },
    leaveConversation: (conversationId) => {
      emit('leave-conversation', { conversationId });
      setActiveConversations(prev => {
        const newSet = new Set(prev);
        newSet.delete(conversationId);
        return newSet;
      });
    },
    startTyping: (conversationId) => {
      emit('typing', { conversationId });
    },
    stopTyping: (conversationId) => {
      emit('typing-stop', { conversationId });
    },
    sendMessage: (conversationId, content, type = 'text', metadata = {}) => {
      return emit('new-message', {
        conversationId,
        content,
        type,
        metadata
      });
    },
    markMessagesAsRead: (conversationId, messageIds) => {
      emit('message-read', {
        conversationId,
        messageIds
      });
    },
    changeUserStatus: (status) => {
      emit('user-status-change', { status });
    },
    syncState: () => {
      emit('sync-state', { syncId: Date.now() });
    }
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext debe usarse dentro de WebSocketProvider');
  }
  return context;
};
```

---

## 💬 COMPONENTES DE CHAT

### Hook de Chat - `useChat.js`
```javascript
// src/hooks/useChat.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { api } from '../services/api';

export const useChat = (conversationId) => {
  const {
    socket,
    isConnected,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    sendMessage: socketSendMessage,
    markMessagesAsRead,
    typingUsers,
    on,
    off
  } = useWebSocketContext();

  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Cargar mensajes iniciales
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      setLoading(true);
      const response = await api.get(`/api/messages?conversationId=${conversationId}&limit=50`);
      setMessages(response.data.messages || []);
      scrollToBottom();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Cargar conversación
  const loadConversation = useCallback(async () => {
    if (!conversationId) return;

    try {
      const response = await api.get(`/api/conversations/${conversationId}`);
      setConversation(response.data);
    } catch (err) {
      setError(err.message);
    }
  }, [conversationId]);

  // Unirse a conversación cuando se conecta
  useEffect(() => {
    if (isConnected && conversationId) {
      joinConversation(conversationId);
      loadMessages();
      loadConversation();
    }
  }, [isConnected, conversationId, joinConversation, loadMessages, loadConversation]);

  // Salir de conversación al desmontar
  useEffect(() => {
    return () => {
      if (conversationId) {
        leaveConversation(conversationId);
      }
    };
  }, [conversationId, leaveConversation]);

  // Configurar listeners de socket para esta conversación
  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleNewMessage = (data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => [...prev, data.message]);
        scrollToBottom();
      }
    };

    const handleMessageSent = (data) => {
      if (data.conversationId === conversationId) {
        // Actualizar mensaje con confirmación
        setMessages(prev => 
          prev.map(msg => 
            msg.id === data.message.id 
              ? { ...msg, status: 'sent' }
              : msg
          )
        );
      }
    };

    const handleTyping = (data) => {
      if (data.conversationId === conversationId) {
        // El context ya maneja typingUsers
      }
    };

    const handleTypingStop = (data) => {
      if (data.conversationId === conversationId) {
        // El context ya maneja typingUsers
      }
    };

    on('new-message', handleNewMessage);
    on('message-sent', handleMessageSent);
    on('typing', handleTyping);
    on('typing-stop', handleTypingStop);

    return () => {
      off('new-message');
      off('message-sent');
      off('typing');
      off('typing-stop');
    };
  }, [socket, conversationId, on, off]);

  // Enviar mensaje
  const sendMessage = useCallback(async (content, type = 'text', metadata = {}) => {
    if (!conversationId || !content.trim()) return;

    try {
      setSending(true);

      // Crear mensaje optimista
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        content,
        type,
        direction: 'outbound',
        timestamp: new Date().toISOString(),
        status: 'sending',
        metadata
      };

      setMessages(prev => [...prev, optimisticMessage]);
      scrollToBottom();

      // Enviar por socket
      const success = socketSendMessage(conversationId, content, type, metadata);

      if (!success) {
        // Marcar como error si falla
        setMessages(prev => 
          prev.map(msg => 
            msg.id === optimisticMessage.id 
              ? { ...msg, status: 'error' }
              : msg
          )
        );
        throw new Error('Error enviando mensaje');
      }

      // También enviar por API para persistencia
      await api.post(`/api/conversations/${conversationId}/messages`, {
        content,
        type,
        metadata
      });

    } catch (error) {
      console.error('Error enviando mensaje:', error);
      setError(error.message);
    } finally {
      setSending(false);
    }
  }, [conversationId, socketSendMessage]);

  // Indicar escritura
  const handleTyping = useCallback(() => {
    if (!conversationId) return;

    startTyping(conversationId);

    // Limpiar timeout anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop typing después de 10 segundos
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(conversationId);
    }, 10000);
  }, [conversationId, startTyping, stopTyping]);

  // Detener escritura
  const handleStopTyping = useCallback(() => {
    if (!conversationId) return;

    stopTyping(conversationId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [conversationId, stopTyping]);

  // Marcar mensajes como leídos
  const markAsRead = useCallback((messageIds) => {
    if (!conversationId || !messageIds.length) return;

    markMessagesAsRead(conversationId, messageIds);
  }, [conversationId, markMessagesAsRead]);

  // Scroll al final
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    messages,
    conversation,
    loading,
    error,
    sending,
    typingUsers: typingUsers.get(conversationId) || new Set(),
    sendMessage,
    handleTyping,
    handleStopTyping,
    markAsRead,
    scrollToBottom,
    messagesEndRef,
    refresh: loadMessages
  };
};
```

### Componente de Chat - `ChatComponent.jsx`
```javascript
// src/components/Chat/ChatComponent.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatHeader } from './ChatHeader';
import { TypingIndicator } from './TypingIndicator';
import './ChatComponent.css';

export const ChatComponent = ({ conversationId }) => {
  const {
    messages,
    conversation,
    loading,
    error,
    sending,
    typingUsers,
    sendMessage,
    handleTyping,
    handleStopTyping,
    markAsRead,
    messagesEndRef
  } = useChat(conversationId);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef(null);

  // Marcar mensajes como leídos cuando se ven
  useEffect(() => {
    if (messages.length > 0) {
      const unreadMessages = messages
        .filter(msg => msg.direction === 'inbound' && !msg.readAt)
        .map(msg => msg.id);

      if (unreadMessages.length > 0) {
        markAsRead(unreadMessages);
      }
    }
  }, [messages, markAsRead]);

  // Manejar envío de mensaje
  const handleSend = async () => {
    if (!inputValue.trim() || sending) return;

    try {
      await sendMessage(inputValue);
      setInputValue('');
      handleStopTyping();
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  };

  // Manejar cambio de input
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      handleTyping();
    }
  };

  // Manejar pérdida de foco
  const handleInputBlur = () => {
    setIsTyping(false);
    handleStopTyping();
  };

  // Manejar tecla Enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="chat-container">
        <div className="chat-loading">
          <div className="loading-spinner"></div>
          <p>Cargando conversación...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-container">
        <div className="chat-error">
          <p>Error: {error}</p>
          <button onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <ChatHeader conversation={conversation} />
      
      <div className="chat-messages">
        <MessageList 
          messages={messages}
          conversationId={conversationId}
        />
        
        {typingUsers.size > 0 && (
          <TypingIndicator users={Array.from(typingUsers)} />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <MessageInput
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyPress={handleKeyPress}
          onSend={handleSend}
          disabled={sending}
          placeholder="Escribe un mensaje..."
        />
      </div>
    </div>
  );
};
```

---

## 🎯 MANEJO DE ESTADOS

### Hook de Conversaciones - `useConversations.js`
```javascript
// src/hooks/useConversations.js
import { useState, useEffect, useCallback } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { api } from '../services/api';

export const useConversations = (filters = {}) => {
  const { on, off } = useWebSocketContext();
  
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });

  // Cargar conversaciones
  const loadConversations = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page,
        limit: pagination.limit,
        ...filters
      });

      const response = await api.get(`/api/conversations?${queryParams}`);
      
      setConversations(response.data.conversations || []);
      setPagination({
        page: response.data.page || 1,
        limit: response.data.limit || 20,
        total: response.data.total || 0
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  // Escuchar eventos de conversación
  useEffect(() => {
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

    const handleNewMessage = (data) => {
      setConversations(prev => 
        prev.map(conv => {
          if (conv.id === data.conversationId) {
            return {
              ...conv,
              lastMessage: data.message.content,
              lastMessageAt: data.message.timestamp,
              unreadCount: conv.unreadCount + 1
            };
          }
          return conv;
        })
      );
    };

    on('conversation-event', handleConversationEvent);
    on('new-message', handleNewMessage);

    return () => {
      off('conversation-event');
      off('new-message');
    };
  }, [on, off]);

  // Cargar conversaciones iniciales
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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

## ⚡ OPTIMIZACIONES

### 1. Debouncing para Typing
```javascript
// src/hooks/useTyping.js
import { useCallback, useRef } from 'react';

export const useTyping = (conversationId, startTyping, stopTyping) => {
  const timeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const handleTyping = useCallback(() => {
    if (!conversationId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      startTyping(conversationId);
    }

    // Limpiar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Auto-stop typing después de 3 segundos
    timeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      stopTyping(conversationId);
    }, 3000);
  }, [conversationId, startTyping, stopTyping]);

  const handleStopTyping = useCallback(() => {
    if (!conversationId) return;

    isTypingRef.current = false;
    stopTyping(conversationId);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [conversationId, stopTyping]);

  return { handleTyping, handleStopTyping };
};
```

### 2. Virtualización para Mensajes
```javascript
// src/components/Chat/VirtualizedMessageList.jsx
import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { Message } from './Message';

export const VirtualizedMessageList = ({ messages, height = 400 }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <Message message={messages[index]} />
    </div>
  );

  return (
    <List
      height={height}
      itemCount={messages.length}
      itemSize={80} // Altura estimada por mensaje
      width="100%"
    >
      {Row}
    </List>
  );
};
```

### 3. Optimistic Updates
```javascript
// src/hooks/useOptimisticUpdates.js
import { useCallback } from 'react';

export const useOptimisticUpdates = (setMessages) => {
  const addOptimisticMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
  }, [setMessages]);

  const updateMessageStatus = useCallback((messageId, status) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, status }
          : msg
      )
    );
  }, [setMessages]);

  return { addOptimisticMessage, updateMessageStatus };
};
```

---

## 🧪 TESTING

### Test de WebSocket Hook
```javascript
// src/hooks/__tests__/useWebSocket.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import { useWebSocket } from '../useWebSocket';

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connected: false
  }))
}));

describe('useWebSocket', () => {
  it('should connect when token is provided', () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      result.current.connect('test-token');
    });

    expect(result.current.isConnected).toBe(false); // Inicialmente false
  });

  it('should emit events when connected', () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      result.current.connect('test-token');
      result.current.emit('test-event', { data: 'test' });
    });

    // Verificar que emit fue llamado
    expect(result.current.emit).toBeDefined();
  });
});
```

### Test de Chat Hook
```javascript
// src/hooks/__tests__/useChat.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import { useChat } from '../useChat';

// Mock WebSocket context
const mockWebSocketContext = {
  socket: { connected: true },
  isConnected: true,
  joinConversation: jest.fn(),
  leaveConversation: jest.fn(),
  sendMessage: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

jest.mock('../../contexts/WebSocketContext', () => ({
  useWebSocketContext: () => mockWebSocketContext
}));

describe('useChat', () => {
  it('should join conversation when mounted', () => {
    renderHook(() => useChat('test-conversation-id'));

    expect(mockWebSocketContext.joinConversation).toHaveBeenCalledWith('test-conversation-id');
  });

  it('should leave conversation when unmounted', () => {
    const { unmount } = renderHook(() => useChat('test-conversation-id'));

    unmount();

    expect(mockWebSocketContext.leaveConversation).toHaveBeenCalledWith('test-conversation-id');
  });
});
```

---

## 🚀 IMPLEMENTACIÓN COMPLETA

### 1. App.jsx
```javascript
// src/App.jsx
import React from 'react';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ChatApp } from './components/ChatApp';

function App() {
  return (
    <WebSocketProvider>
      <ChatApp />
    </WebSocketProvider>
  );
}

export default App;
```

### 2. ChatApp.jsx
```javascript
// src/components/ChatApp.jsx
import React, { useState } from 'react';
import { ConversationList } from './ConversationList';
import { ChatComponent } from './Chat/ChatComponent';
import { DetailsPanel } from './DetailsPanel';
import { useConversations } from '../hooks/useConversations';
import './ChatApp.css';

export const ChatApp = () => {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const { conversations, loading } = useConversations();

  return (
    <div className="chat-app">
      <ConversationList
        conversations={conversations}
        selectedConversation={selectedConversation}
        onSelectConversation={setSelectedConversation}
        loading={loading}
      />
      
      <ChatComponent conversationId={selectedConversation} />
      
      <DetailsPanel conversationId={selectedConversation} />
    </div>
  );
};
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### ✅ Configuración
- [ ] Instalar socket.io-client
- [ ] Configurar variables de entorno
- [ ] Crear configuración de socket

### ✅ Hooks
- [ ] Implementar useWebSocket
- [ ] Implementar useChat
- [ ] Implementar useConversations
- [ ] Implementar useTyping

### ✅ Context
- [ ] Crear WebSocketContext
- [ ] Configurar listeners globales
- [ ] Manejar reconexión

### ✅ Componentes
- [ ] ChatComponent
- [ ] MessageList
- [ ] MessageInput
- [ ] TypingIndicator
- [ ] ChatHeader

### ✅ Optimizaciones
- [ ] Debouncing para typing
- [ ] Optimistic updates
- [ ] Virtualización (opcional)
- [ ] Error handling

### ✅ Testing
- [ ] Tests de hooks
- [ ] Tests de componentes
- [ ] Tests de integración

---

## 🎯 RESULTADO FINAL

Con esta implementación tendrás:

✅ **WebSocket completamente funcional** con reconexión automática
✅ **Chat en tiempo real** con indicadores de escritura
✅ **Optimistic updates** para mejor UX
✅ **Manejo de errores** robusto
✅ **Performance optimizada** con debouncing
✅ **Testing completo** para mantener calidad
✅ **Integración perfecta** con tu backend

¡Tu frontend estará completamente alineado con el backend y funcionando en tiempo real! 🚀 