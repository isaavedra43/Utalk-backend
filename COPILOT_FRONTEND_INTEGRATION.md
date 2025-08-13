# 🤖 INTEGRACIÓN COPILOTO IA FRONTEND - UTALK BACKEND

## 📋 ÍNDICE
1. [Arquitectura del Copiloto](#arquitectura-del-copiloto)
2. [Configuración Inicial](#configuración-inicial)
3. [Hook de Copiloto](#hook-de-copiloto)
4. [Context Provider](#context-provider)
5. [Componentes de UI](#componentes-de-ui)
6. [Estados y Modos](#estados-y-modos)
7. [Integración con Chat](#integración-con-chat)
8. [Testing](#testing)

---

## 🏗️ ARQUITECTURA DEL COPILOTO

### **Flujo de Funcionamiento:**
```
Usuario escribe en Chat IA
    ↓
Frontend envía mensaje al backend
    ↓
Backend procesa con IA (sugerencias + chat)
    ↓
Backend retorna respuesta + sugerencias
    ↓
Frontend muestra respuesta y actualiza sugerencias
    ↓
Usuario puede usar sugerencias o continuar chat
```

### **Modos de Operación:**
1. **Chat IA** - Conversación directa con IA
2. **Sugerencias** - Sugerencias automáticas para agentes
3. **Mock Mode** - Modo simulado sin backend real

---

## 🔧 CONFIGURACIÓN INICIAL

### 1. Variables de Entorno
```javascript
// .env
REACT_APP_COPILOT_ENABLED=true
REACT_APP_COPILOT_MOCK_MODE=false
REACT_APP_COPILOT_DEFAULT_MODEL=gpt-4o-mini
REACT_APP_COPILOT_MAX_TOKENS=150
```

### 2. Configuración de API
```javascript
// src/services/copilotApi.js
import api from './api';

const COPILOT_ENDPOINTS = {
  CHAT: '/api/ai/chat',
  SUGGESTIONS: '/api/ai/suggestions',
  CONFIG: '/api/ai/config',
  HEALTH: '/api/ai/health'
};

export const copilotApi = {
  // Chat directo con IA
  async sendMessage(workspaceId, message, options = {}) {
    const response = await api.post(COPILOT_ENDPOINTS.CHAT, {
      workspaceId,
      message,
      model: options.model || process.env.REACT_APP_COPILOT_DEFAULT_MODEL,
      maxTokens: options.maxTokens || process.env.REACT_APP_COPILOT_MAX_TOKENS,
      temperature: options.temperature || 0.3
    });
    return response.data;
  },

  // Generar sugerencias para conversación
  async generateSuggestions(workspaceId, conversationId, messageId) {
    const response = await api.post(COPILOT_ENDPOINTS.SUGGESTIONS + '/generate', {
      workspaceId,
      conversationId,
      messageId
    });
    return response.data;
  },

  // Obtener sugerencias existentes
  async getSuggestions(conversationId, options = {}) {
    const params = new URLSearchParams({
      limit: options.limit || 10,
      status: options.status || 'draft'
    });
    
    const response = await api.get(`${COPILOT_ENDPOINTS.SUGGESTIONS}/${conversationId}?${params}`);
    return response.data;
  },

  // Actualizar estado de sugerencia
  async updateSuggestionStatus(conversationId, suggestionId, status) {
    const response = await api.put(`${COPILOT_ENDPOINTS.SUGGESTIONS}/${conversationId}/${suggestionId}`, {
      status
    });
    return response.data;
  },

  // Obtener configuración de IA
  async getConfig(workspaceId) {
    const response = await api.get(`${COPILOT_ENDPOINTS.CONFIG}/${workspaceId}`);
    return response.data;
  },

  // Verificar salud de IA
  async checkHealth() {
    const response = await api.get(COPILOT_ENDPOINTS.HEALTH);
    return response.data;
  }
};
```

---

## 🎣 HOOK DE COPILOTO

### Hook Principal - `useCopilot.js`
```javascript
// src/hooks/useCopilot.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { copilotApi } from '../services/copilotApi';
import { useAuthContext } from '../contexts/AuthContext';

export const useCopilot = (workspaceId, conversationId = null) => {
  const { backendUser } = useAuthContext();
  
  // Estados principales
  const [mode, setMode] = useState('chat'); // 'chat' | 'suggestions'
  const [isMockMode, setIsMockMode] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [config, setConfig] = useState(null);
  
  // Estados de chat
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  
  // Estados de sugerencias
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  
  // Referencias
  const abortControllerRef = useRef(null);

  // Verificar configuración al montar
  useEffect(() => {
    if (workspaceId) {
      checkCopilotStatus();
    }
  }, [workspaceId]);

  // Verificar estado del copiloto
  const checkCopilotStatus = useCallback(async () => {
    try {
      // Verificar si está habilitado globalmente
      const mockMode = process.env.REACT_APP_COPILOT_MOCK_MODE === 'true';
      setIsMockMode(mockMode);

      if (mockMode) {
        setIsEnabled(true);
        return;
      }

      // Verificar salud de IA
      const health = await copilotApi.checkHealth();
      setIsEnabled(health.aiEnabled);

      if (health.aiEnabled) {
        // Obtener configuración
        const aiConfig = await copilotApi.getConfig(workspaceId);
        setConfig(aiConfig);
      }
    } catch (error) {
      console.error('Error verificando estado del copiloto:', error);
      setIsEnabled(false);
    }
  }, [workspaceId]);

  // Enviar mensaje de chat
  const sendChatMessage = useCallback(async (message, options = {}) => {
    if (!isEnabled || !workspaceId) {
      throw new Error('Copiloto no disponible');
    }

    try {
      setIsChatLoading(true);
      setChatError(null);

      // Cancelar request anterior si existe
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Crear nuevo abort controller
      abortControllerRef.current = new AbortController();

      // Agregar mensaje del usuario
      const userMessage = {
        id: `user-${Date.now()}`,
        content: message,
        role: 'user',
        timestamp: new Date().toISOString()
      };

      setChatMessages(prev => [...prev, userMessage]);

      // Enviar al backend
      const response = await copilotApi.sendMessage(workspaceId, message, {
        ...options,
        signal: abortControllerRef.current.signal
      });

      // Agregar respuesta de IA
      const aiMessage = {
        id: `ai-${Date.now()}`,
        content: response.response,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        metadata: {
          model: response.model,
          tokens: response.tokens,
          latency: response.latency
        }
      };

      setChatMessages(prev => [...prev, aiMessage]);

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        return; // Request cancelado
      }

      setChatError(error.message);
      throw error;
    } finally {
      setIsChatLoading(false);
      abortControllerRef.current = null;
    }
  }, [isEnabled, workspaceId]);

  // Generar sugerencias
  const generateSuggestions = useCallback(async (messageId) => {
    if (!isEnabled || !workspaceId || !conversationId) {
      throw new Error('Copiloto no disponible o conversación no especificada');
    }

    try {
      setIsSuggestionsLoading(true);
      setSuggestionsError(null);

      const response = await copilotApi.generateSuggestions(workspaceId, conversationId, messageId);
      
      setSuggestions(prev => [...prev, ...response.suggestions]);
      
      return response;
    } catch (error) {
      setSuggestionsError(error.message);
      throw error;
    } finally {
      setIsSuggestionsLoading(false);
    }
  }, [isEnabled, workspaceId, conversationId]);

  // Cargar sugerencias existentes
  const loadSuggestions = useCallback(async (options = {}) => {
    if (!conversationId) return;

    try {
      setIsSuggestionsLoading(true);
      setSuggestionsError(null);

      const response = await copilotApi.getSuggestions(conversationId, options);
      setSuggestions(response.suggestions);
      
      return response;
    } catch (error) {
      setSuggestionsError(error.message);
      throw error;
    } finally {
      setIsSuggestionsLoading(false);
    }
  }, [conversationId]);

  // Actualizar estado de sugerencia
  const updateSuggestionStatus = useCallback(async (suggestionId, status) => {
    if (!conversationId) return;

    try {
      await copilotApi.updateSuggestionStatus(conversationId, suggestionId, status);
      
      // Actualizar estado local
      setSuggestions(prev => 
        prev.map(suggestion => 
          suggestion.id === suggestionId 
            ? { ...suggestion, status }
            : suggestion
        )
      );
    } catch (error) {
      console.error('Error actualizando sugerencia:', error);
      throw error;
    }
  }, [conversationId]);

  // Limpiar chat
  const clearChat = useCallback(() => {
    setChatMessages([]);
    setChatError(null);
  }, []);

  // Limpiar sugerencias
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setSuggestionsError(null);
  }, []);

  // Cambiar modo
  const changeMode = useCallback((newMode) => {
    setMode(newMode);
  }, []);

  // Cancelar operación en curso
  const cancelOperation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Estados
    mode,
    isMockMode,
    isEnabled,
    config,
    chatMessages,
    isChatLoading,
    chatError,
    suggestions,
    isSuggestionsLoading,
    suggestionsError,
    
    // Acciones
    sendChatMessage,
    generateSuggestions,
    loadSuggestions,
    updateSuggestionStatus,
    clearChat,
    clearSuggestions,
    changeMode,
    cancelOperation,
    checkCopilotStatus
  };
};
```

---

## 🎯 CONTEXT PROVIDER

### Copiloto Context - `CopilotContext.jsx`
```javascript
// src/contexts/CopilotContext.jsx
import React, { createContext, useContext, useEffect } from 'react';
import { useCopilot } from '../hooks/useCopilot';
import { useWebSocketContext } from './WebSocketContext';

const CopilotContext = createContext();

export const CopilotProvider = ({ children, workspaceId, conversationId }) => {
  const {
    mode,
    isMockMode,
    isEnabled,
    config,
    chatMessages,
    isChatLoading,
    chatError,
    suggestions,
    isSuggestionsLoading,
    suggestionsError,
    sendChatMessage,
    generateSuggestions,
    loadSuggestions,
    updateSuggestionStatus,
    clearChat,
    clearSuggestions,
    changeMode,
    cancelOperation,
    checkCopilotStatus
  } = useCopilot(workspaceId, conversationId);

  const { on, off } = useWebSocketContext();

  // Escuchar eventos de sugerencias automáticas
  useEffect(() => {
    if (!conversationId) return;

    const handleNewSuggestion = (data) => {
      if (data.conversationId === conversationId) {
        setSuggestions(prev => [...prev, data.suggestion]);
      }
    };

    const handleSuggestionUsed = (data) => {
      if (data.conversationId === conversationId) {
        updateSuggestionStatus(data.suggestionId, 'used');
      }
    };

    on('new-suggestion', handleNewSuggestion);
    on('suggestion-used', handleSuggestionUsed);

    return () => {
      off('new-suggestion');
      off('suggestion-used');
    };
  }, [conversationId, on, off, updateSuggestionStatus]);

  // Cargar sugerencias al cambiar conversación
  useEffect(() => {
    if (conversationId && isEnabled) {
      loadSuggestions();
    }
  }, [conversationId, isEnabled, loadSuggestions]);

  const value = {
    // Estados
    mode,
    isMockMode,
    isEnabled,
    config,
    chatMessages,
    isChatLoading,
    chatError,
    suggestions,
    isSuggestionsLoading,
    suggestionsError,
    
    // Acciones
    sendChatMessage,
    generateSuggestions,
    loadSuggestions,
    updateSuggestionStatus,
    clearChat,
    clearSuggestions,
    changeMode,
    cancelOperation,
    checkCopilotStatus
  };

  return (
    <CopilotContext.Provider value={value}>
      {children}
    </CopilotContext.Provider>
  );
};

export const useCopilotContext = () => {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error('useCopilotContext debe usarse dentro de CopilotProvider');
  }
  return context;
};
```

---

## 🧩 COMPONENTES DE UI

### Componente Principal - `CopilotComponent.jsx`
```javascript
// src/components/Copilot/CopilotComponent.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useCopilotContext } from '../../contexts/CopilotContext';
import { CopilotHeader } from './CopilotHeader';
import { CopilotTabs } from './CopilotTabs';
import { ChatInterface } from './ChatInterface';
import { SuggestionsInterface } from './SuggestionsInterface';
import './CopilotComponent.css';

export const CopilotComponent = () => {
  const {
    mode,
    isMockMode,
    isEnabled,
    chatMessages,
    suggestions,
    changeMode
  } = useCopilotContext();

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  // Focus en input al cambiar modo
  useEffect(() => {
    if (mode === 'chat') {
      inputRef.current?.focus();
    }
  }, [mode]);

  // Manejar envío de mensaje
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    try {
      await sendChatMessage(inputValue);
      setInputValue('');
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  };

  // Manejar tecla Enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isEnabled) {
    return (
      <div className="copilot-container">
        <div className="copilot-disabled">
          <div className="disabled-icon">🤖</div>
          <h3>Copiloto IA Deshabilitado</h3>
          <p>El copiloto no está disponible en este momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="copilot-container">
      <CopilotHeader isMockMode={isMockMode} />
      
      <CopilotTabs 
        mode={mode} 
        onModeChange={changeMode}
        suggestionsCount={suggestions.length}
      />
      
      <div className="copilot-content">
        {mode === 'chat' ? (
          <ChatInterface 
            messages={chatMessages}
            inputValue={inputValue}
            onInputChange={setInputValue}
            onSendMessage={handleSendMessage}
            onKeyPress={handleKeyPress}
            inputRef={inputRef}
          />
        ) : (
          <SuggestionsInterface 
            suggestions={suggestions}
          />
        )}
      </div>
      
      {isMockMode && (
        <div className="mock-mode-indicator">
          Modo simulado - sin backend real
        </div>
      )}
    </div>
  );
};
```

### Componente de Header - `CopilotHeader.jsx`
```javascript
// src/components/Copilot/CopilotHeader.jsx
import React from 'react';
import './CopilotHeader.css';

export const CopilotHeader = ({ isMockMode }) => {
  return (
    <div className="copilot-header">
      <div className="header-left">
        <div className="copilot-icon">⭐</div>
        <h1>Copiloto IA</h1>
      </div>
      
      {isMockMode && (
        <div className="mock-mode-badge">
          Mock Mode
        </div>
      )}
      
      <div className="header-description">
        Copilot is here to help. Just ask.
      </div>
    </div>
  );
};
```

### Componente de Tabs - `CopilotTabs.jsx`
```javascript
// src/components/Copilot/CopilotTabs.jsx
import React from 'react';
import './CopilotTabs.css';

export const CopilotTabs = ({ mode, onModeChange, suggestionsCount }) => {
  return (
    <div className="copilot-tabs">
      <button
        className={`tab-button ${mode === 'suggestions' ? 'active' : ''}`}
        onClick={() => onModeChange('suggestions')}
      >
        Sugerencias
        {suggestionsCount > 0 && (
          <span className="suggestions-badge">{suggestionsCount}</span>
        )}
      </button>
      
      <button
        className={`tab-button ${mode === 'chat' ? 'active' : ''}`}
        onClick={() => onModeChange('chat')}
      >
        Chat IA
      </button>
    </div>
  );
};
```

### Componente de Chat - `ChatInterface.jsx`
```javascript
// src/components/Copilot/ChatInterface.jsx
import React, { useRef, useEffect } from 'react';
import { useCopilotContext } from '../../contexts/CopilotContext';
import { MessageBubble } from './MessageBubble';
import './ChatInterface.css';

export const ChatInterface = ({ 
  messages, 
  inputValue, 
  onInputChange, 
  onSendMessage, 
  onKeyPress, 
  inputRef 
}) => {
  const { isChatLoading, chatError } = useCopilotContext();
  const messagesEndRef = useRef(null);

  // Scroll al final de mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-interface">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <div className="chat-bubble-icon">💬</div>
            <p className="empty-title">Pregunta lo que necesites</p>
            <p className="empty-subtitle">El copiloto está aquí para ayudarte</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
            />
          ))
        )}
        
        {isChatLoading && (
          <div className="loading-message">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        {chatError && (
          <div className="error-message">
            <p>Error: {chatError}</p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-container">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder="Escribe tu mensaje..."
          disabled={isChatLoading}
          className="chat-input"
        />
        
        <button
          onClick={onSendMessage}
          disabled={isChatLoading || !inputValue.trim()}
          className="send-button"
        >
          ✈️
        </button>
      </div>
    </div>
  );
};
```

### Componente de Sugerencias - `SuggestionsInterface.jsx`
```javascript
// src/components/Copilot/SuggestionsInterface.jsx
import React from 'react';
import { useCopilotContext } from '../../contexts/CopilotContext';
import { SuggestionCard } from './SuggestionCard';
import './SuggestionsInterface.css';

export const SuggestionsInterface = ({ suggestions }) => {
  const { isSuggestionsLoading, suggestionsError } = useCopilotContext();

  if (isSuggestionsLoading) {
    return (
      <div className="suggestions-interface">
        <div className="loading-suggestions">
          <div className="loading-spinner"></div>
          <p>Generando sugerencias...</p>
        </div>
      </div>
    );
  }

  if (suggestionsError) {
    return (
      <div className="suggestions-interface">
        <div className="error-suggestions">
          <p>Error: {suggestionsError}</p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="suggestions-interface">
        <div className="empty-suggestions">
          <div className="suggestions-icon">💡</div>
          <p className="empty-title">No hay sugerencias disponibles</p>
          <p className="empty-subtitle">El copiloto generará sugerencias automáticamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="suggestions-interface">
      <div className="suggestions-list">
        {suggestions.map((suggestion) => (
          <SuggestionCard 
            key={suggestion.id} 
            suggestion={suggestion} 
          />
        ))}
      </div>
    </div>
  );
};
```

---

## 🔄 ESTADOS Y MODOS

### **Estados del Copiloto:**
```javascript
// Estados principales
const COPILOT_STATES = {
  DISABLED: 'disabled',      // IA deshabilitada
  ENABLED: 'enabled',        // IA habilitada
  MOCK: 'mock',             // Modo simulado
  LOADING: 'loading',       // Cargando
  ERROR: 'error'            // Error
};

// Modos de operación
const COPILOT_MODES = {
  CHAT: 'chat',             // Chat directo
  SUGGESTIONS: 'suggestions' // Sugerencias
};

// Estados de sugerencias
const SUGGESTION_STATUS = {
  DRAFT: 'draft',           // Borrador
  USED: 'used',            // Usada
  REJECTED: 'rejected',    // Rechazada
  ARCHIVED: 'archived'     // Archivada
};
```

### **Configuración por Workspace:**
```javascript
// Ejemplo de configuración
const AI_CONFIG = {
  ai_enabled: true,
  provider: 'openai',
  defaultModel: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 150,
  flags: {
    suggestions: true,
    chat: true,
    rag: false
  },
  policies: {
    tono: 'profesional',
    idioma: 'es'
  }
};
```

---

## 🔗 INTEGRACIÓN CON CHAT

### **Hook de Integración - `useCopilotChatIntegration.js`**
```javascript
// src/hooks/useCopilotChatIntegration.js
import { useCallback } from 'react';
import { useCopilotContext } from '../contexts/CopilotContext';
import { useChat } from './useChat';

export const useCopilotChatIntegration = (conversationId) => {
  const { generateSuggestions, updateSuggestionStatus } = useCopilotContext();
  const { sendMessage } = useChat(conversationId);

  // Generar sugerencias cuando llega mensaje
  const handleNewMessage = useCallback(async (messageId) => {
    if (!conversationId) return;

    try {
      await generateSuggestions(messageId);
    } catch (error) {
      console.error('Error generando sugerencias:', error);
    }
  }, [conversationId, generateSuggestions]);

  // Usar sugerencia
  const useSuggestion = useCallback(async (suggestionId, suggestionContent) => {
    if (!conversationId) return;

    try {
      // Enviar mensaje usando sugerencia
      await sendMessage(suggestionContent);
      
      // Marcar sugerencia como usada
      await updateSuggestionStatus(suggestionId, 'used');
    } catch (error) {
      console.error('Error usando sugerencia:', error);
    }
  }, [conversationId, sendMessage, updateSuggestionStatus]);

  // Rechazar sugerencia
  const rejectSuggestion = useCallback(async (suggestionId) => {
    if (!conversationId) return;

    try {
      await updateSuggestionStatus(suggestionId, 'rejected');
    } catch (error) {
      console.error('Error rechazando sugerencia:', error);
    }
  }, [conversationId, updateSuggestionStatus]);

  return {
    handleNewMessage,
    useSuggestion,
    rejectSuggestion
  };
};
```

---

## 🧪 TESTING

### **Test de Copiloto Hook**
```javascript
// src/hooks/__tests__/useCopilot.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import { useCopilot } from '../useCopilot';

// Mock API
jest.mock('../../services/copilotApi');

describe('useCopilot', () => {
  it('should send chat message successfully', async () => {
    const { result } = renderHook(() => useCopilot('workspace-1'));

    await act(async () => {
      await result.current.sendChatMessage('Hola');
    });

    expect(result.current.chatMessages).toHaveLength(2); // User + AI
    expect(result.current.chatError).toBeNull();
  });

  it('should generate suggestions', async () => {
    const { result } = renderHook(() => useCopilot('workspace-1', 'conv-1'));

    await act(async () => {
      await result.current.generateSuggestions('msg-1');
    });

    expect(result.current.suggestions.length).toBeGreaterThan(0);
  });
});
```

---

## 🚀 IMPLEMENTACIÓN COMPLETA

### **1. App.jsx (Integración)**
```javascript
// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { CopilotProvider } from './contexts/CopilotContext';
import { ChatApp } from './components/ChatApp';

function App() {
  return (
    <Router>
      <AuthProvider>
        <WebSocketProvider>
          <CopilotProvider workspaceId="workspace-1">
            <Routes>
              <Route path="/chat" element={<ChatApp />} />
              <Route path="/copilot" element={<CopilotComponent />} />
            </Routes>
          </CopilotProvider>
        </WebSocketProvider>
      </AuthProvider>
    </Router>
  );
}
```

### **2. ChatApp.jsx (Integración)**
```javascript
// src/components/Copilot/ChatApp.jsx
import React, { useState } from 'react';
import { ConversationList } from '../ConversationList';
import { ChatComponent } from '../Chat/ChatComponent';
import { CopilotComponent } from './CopilotComponent';
import { useConversations } from '../../hooks/useConversations';

export const ChatApp = () => {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showCopilot, setShowCopilot] = useState(false);
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
      
      {showCopilot && (
        <CopilotComponent />
      )}
      
      <button 
        className="copilot-toggle"
        onClick={() => setShowCopilot(!showCopilot)}
      >
        🤖 Copiloto
      </button>
    </div>
  );
};
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### ✅ **Configuración (10 min)**
- [ ] Variables de entorno
- [ ] Configuración de API
- [ ] Endpoints del backend

### ✅ **Hooks (30 min)**
- [ ] useCopilot hook
- [ ] useCopilotChatIntegration hook
- [ ] Manejo de estados y errores

### ✅ **Context (20 min)**
- [ ] CopilotContext
- [ ] Integración con WebSocket
- [ ] Manejo de eventos

### ✅ **Componentes (45 min)**
- [ ] CopilotComponent
- [ ] CopilotHeader
- [ ] CopilotTabs
- [ ] ChatInterface
- [ ] SuggestionsInterface

### ✅ **Integración (15 min)**
- [ ] Integración con chat
- [ ] Manejo de sugerencias
- [ ] Estados de UI

### ✅ **Testing (20 min)**
- [ ] Tests de hooks
- [ ] Tests de componentes
- [ ] Tests de integración

---

## 🎯 RESULTADO FINAL

Con esta implementación tendrás:

✅ **Copiloto IA completo** con chat y sugerencias
✅ **Integración perfecta** con el backend
✅ **Modo simulado** para desarrollo
✅ **Sugerencias automáticas** para agentes
✅ **Chat directo** con IA
✅ **Estados de UI** responsivos
✅ **Testing completo** para mantener calidad

## 🔑 PUNTOS CLAVE PARA LA IA

### **1. Flujo de Integración:**
1. Usuario escribe en Chat IA
2. Frontend envía al backend
3. Backend procesa con IA
4. Retorna respuesta + sugerencias
5. Frontend actualiza UI

### **2. Estados del Copiloto:**
- **Mock Mode** - Sin backend real
- **Enabled** - IA habilitada
- **Disabled** - IA deshabilitada
- **Loading** - Procesando
- **Error** - Error en operación

### **3. Modos de Operación:**
- **Chat IA** - Conversación directa
- **Sugerencias** - Sugerencias automáticas

### **4. Integración con Chat:**
- Sugerencias se generan automáticamente
- Usuario puede usar sugerencias
- Estado se sincroniza en tiempo real

### **5. Configuración:**
- Por workspace
- Múltiples modelos
- Políticas de IA
- Límites y rate limiting

¡Sigue estas instrucciones y tendrás un Copiloto IA perfectamente alineado con tu backend! 🚀 