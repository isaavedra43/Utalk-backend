# Integración API Frontend - Backend

Esta guía explica cómo integrar el frontend de Funday con el backend API.

## Configuración Base

### Variables de Entorno Frontend

```javascript
// .env.local (Next.js/React)
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

### Configuración de Axios

```javascript
// utils/api.js
import axios from 'axios';
import { getAuth } from 'firebase/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Interceptor para agregar token de autenticación
apiClient.interceptors.request.use(async (config) => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// Interceptor para manejo de errores
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirigir a login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

## Autenticación

### Login con Firebase

```javascript
// services/auth.js
import { signInWithEmailAndPassword, getAuth } from 'firebase/auth';
import apiClient from '../utils/api';

export const loginUser = async (email, password) => {
  try {
    // 1. Autenticar con Firebase
    const auth = getAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // 2. Obtener token
    const token = await userCredential.user.getIdToken();
    
    // 3. Llamar al backend para verificar/crear usuario en Firestore
    const response = await apiClient.post('/auth/login', {
      email,
      password, // Solo para validación adicional
    });
    
    return {
      user: response.data.user,
      token,
    };
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Error de autenticación');
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await apiClient.get('/auth/me');
    return response.data.user;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Error al obtener usuario');
  }
};
```

### Contexto de Autenticación

```javascript
// contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getCurrentUser } from '../services/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userData = await getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error('Error al obtener datos del usuario:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

## Servicios de API

### Servicio de Contactos

```javascript
// services/contacts.js
import apiClient from '../utils/api';

export const contactsService = {
  // Listar contactos
  getContacts: async (params = {}) => {
    const response = await apiClient.get('/contacts', { params });
    return response.data;
  },

  // Crear contacto
  createContact: async (contactData) => {
    const response = await apiClient.post('/contacts', contactData);
    return response.data;
  },

  // Obtener contacto por ID
  getContact: async (id) => {
    const response = await apiClient.get(`/contacts/${id}`);
    return response.data;
  },

  // Actualizar contacto
  updateContact: async (id, updates) => {
    const response = await apiClient.put(`/contacts/${id}`, updates);
    return response.data;
  },

  // Eliminar contacto
  deleteContact: async (id) => {
    const response = await apiClient.delete(`/contacts/${id}`);
    return response.data;
  },

  // Buscar contactos
  searchContacts: async (query) => {
    const response = await apiClient.get('/contacts/search', {
      params: { q: query }
    });
    return response.data;
  },

  // Exportar contactos
  exportContacts: async () => {
    const response = await apiClient.get('/contacts/export', {
      responseType: 'blob'
    });
    return response;
  },

  // Importar contactos
  importContacts: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post('/contacts/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Obtener tags
  getTags: async () => {
    const response = await apiClient.get('/contacts/tags');
    return response.data;
  },
};
```

### Servicio de Mensajes

```javascript
// services/messages.js
import apiClient from '../utils/api';

export const messagesService = {
  // Obtener conversaciones
  getConversations: async (params = {}) => {
    const response = await apiClient.get('/messages', { params });
    return response.data;
  },

  // Obtener mensajes de una conversación
  getConversation: async (phone, params = {}) => {
    const response = await apiClient.get(`/messages/conversation/${phone}`, { params });
    return response.data;
  },

  // Enviar mensaje
  sendMessage: async (messageData) => {
    const response = await apiClient.post('/messages/send', messageData);
    return response.data;
  },

  // Obtener estadísticas
  getStats: async (params = {}) => {
    const response = await apiClient.get('/messages/stats', { params });
    return response.data;
  },

  // Buscar mensajes
  searchMessages: async (query) => {
    const response = await apiClient.get('/messages/search', {
      params: { q: query }
    });
    return response.data;
  },
};
```

### Servicio de Campañas

```javascript
// services/campaigns.js
import apiClient from '../utils/api';

export const campaignsService = {
  // Listar campañas
  getCampaigns: async (params = {}) => {
    const response = await apiClient.get('/campaigns', { params });
    return response.data;
  },

  // Crear campaña
  createCampaign: async (campaignData) => {
    const response = await apiClient.post('/campaigns', campaignData);
    return response.data;
  },

  // Obtener campaña
  getCampaign: async (id) => {
    const response = await apiClient.get(`/campaigns/${id}`);
    return response.data;
  },

  // Actualizar campaña
  updateCampaign: async (id, updates) => {
    const response = await apiClient.put(`/campaigns/${id}`, updates);
    return response.data;
  },

  // Enviar campaña
  sendCampaign: async (id) => {
    const response = await apiClient.post(`/campaigns/${id}/send`);
    return response.data;
  },

  // Pausar campaña
  pauseCampaign: async (id) => {
    const response = await apiClient.post(`/campaigns/${id}/pause`);
    return response.data;
  },

  // Obtener reporte
  getCampaignReport: async (id) => {
    const response = await apiClient.get(`/campaigns/${id}/report`);
    return response.data;
  },
};
```

## Hooks Personalizados

### Hook para Contactos

```javascript
// hooks/useContacts.js
import { useState, useEffect } from 'react';
import { contactsService } from '../services/contacts';

export const useContacts = (params = {}) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await contactsService.getContacts(params);
      setContacts(data.contacts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [JSON.stringify(params)]);

  const createContact = async (contactData) => {
    try {
      const newContact = await contactsService.createContact(contactData);
      setContacts(prev => [newContact.contact, ...prev]);
      return newContact;
    } catch (error) {
      throw error;
    }
  };

  const updateContact = async (id, updates) => {
    try {
      const updated = await contactsService.updateContact(id, updates);
      setContacts(prev => 
        prev.map(contact => 
          contact.id === id ? updated.contact : contact
        )
      );
      return updated;
    } catch (error) {
      throw error;
    }
  };

  const deleteContact = async (id) => {
    try {
      await contactsService.deleteContact(id);
      setContacts(prev => prev.filter(contact => contact.id !== id));
    } catch (error) {
      throw error;
    }
  };

  return {
    contacts,
    loading,
    error,
    refetch: fetchContacts,
    createContact,
    updateContact,
    deleteContact,
  };
};
```

### Hook para Mensajes en Tiempo Real

```javascript
// hooks/useMessages.js
import { useState, useEffect, useRef } from 'react';
import { messagesService } from '../services/messages';

export const useMessages = (phone) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchMessages = async () => {
    try {
      setError(null);
      const data = await messagesService.getConversation(phone);
      setMessages(data.messages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Polling para mensajes en tiempo real (alternativa a WebSockets)
  useEffect(() => {
    if (!phone) return;

    fetchMessages();
    
    // Actualizar cada 5 segundos
    intervalRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [phone]);

  const sendMessage = async (content, type = 'text') => {
    try {
      const result = await messagesService.sendMessage({
        to: phone,
        content,
        type,
      });
      
      // Actualizar inmediatamente la lista local
      fetchMessages();
      
      return result;
    } catch (error) {
      throw error;
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    refetch: fetchMessages,
  };
};
```

## Componentes de Ejemplo

### Lista de Contactos

```javascript
// components/ContactList.js
import React, { useState } from 'react';
import { useContacts } from '../hooks/useContacts';

const ContactList = () => {
  const [search, setSearch] = useState('');
  const { contacts, loading, error, deleteContact } = useContacts({ search });

  if (loading) return <div>Cargando contactos...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <input
        type="text"
        placeholder="Buscar contactos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      
      <div className="contact-list">
        {contacts.map(contact => (
          <div key={contact.id} className="contact-item">
            <h3>{contact.name}</h3>
            <p>{contact.phone}</p>
            <p>{contact.email}</p>
            <button onClick={() => deleteContact(contact.id)}>
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContactList;
```

### Chat de Mensajes

```javascript
// components/MessageChat.js
import React, { useState } from 'react';
import { useMessages } from '../hooks/useMessages';

const MessageChat = ({ phone }) => {
  const [newMessage, setNewMessage] = useState('');
  const { messages, loading, sendMessage } = useMessages(phone);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } catch (error) {
      alert('Error al enviar mensaje: ' + error.message);
    }
  };

  if (loading) return <div>Cargando conversación...</div>;

  return (
    <div className="message-chat">
      <div className="messages">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`message ${message.direction}`}
          >
            <div className="content">{message.content}</div>
            <div className="timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSendMessage} className="message-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe tu mensaje..."
        />
        <button type="submit">Enviar</button>
      </form>
    </div>
  );
};

export default MessageChat;
```

## Manejo de Errores

### Componente de Error Global

```javascript
// components/ErrorBoundary.js
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error capturado:', error, errorInfo);
    // Enviar error a servicio de monitoreo
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Algo salió mal</h2>
          <p>Ha ocurrido un error inesperado. Por favor, recarga la página.</p>
          <button onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

## Configuración de Estados Globales

### Usando Zustand

```javascript
// stores/useAppStore.js
import { create } from 'zustand';

const useAppStore = create((set, get) => ({
  // Estado
  user: null,
  notifications: [],
  sidebarOpen: true,
  
  // Acciones
  setUser: (user) => set({ user }),
  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, notification]
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  toggleSidebar: () => set((state) => ({
    sidebarOpen: !state.sidebarOpen
  })),
}));

export default useAppStore;
```

Esta estructura de integración asegura una comunicación fluida entre el frontend y backend, con manejo robusto de autenticación, estados y errores. 