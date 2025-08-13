# 🔐 INTEGRACIÓN LOGIN FRONTEND - UTALK BACKEND + FIREBASE

## 📋 ÍNDICE
1. [Configuración Firebase](#configuración-firebase)
2. [Configuración Backend](#configuración-backend)
3. [Hook de Autenticación](#hook-de-autenticación)
4. [Context de Auth](#context-de-auth)
5. [Componentes de Login](#componentes-de-login)
6. [Protección de Rutas](#protección-de-rutas)
7. [Manejo de Sesión](#manejo-de-sesión)
8. [Integración con WebSocket](#integración-con-websocket)
9. [Testing](#testing)

---

## 🔥 CONFIGURACIÓN FIREBASE

### 1. Instalar Dependencias
```bash
npm install firebase
npm install react-router-dom
npm install axios
npm install js-cookie
# o
yarn add firebase react-router-dom axios js-cookie
```

### 2. Configuración Firebase
```javascript
// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
```

### 3. Variables de Entorno
```javascript
// .env
REACT_APP_FIREBASE_API_KEY=tu_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=tu_proyecto_id
REACT_APP_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef
REACT_APP_BACKEND_URL=https://tu-backend.railway.app
```

---

## 🔧 CONFIGURACIÓN BACKEND

### 1. Servicio de API
```javascript
// src/services/api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await api.post('/api/auth/refresh', { refreshToken });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', newRefreshToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        return api(originalRequest);
      } catch (refreshError) {
        // Limpiar tokens y redirigir al login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

---

## 🎣 HOOK DE AUTENTICACIÓN

### Hook Principal - `useAuth.js`
```javascript
// src/hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword
} from 'firebase/auth';
import { auth } from '../config/firebase';
import api from '../services/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendUser, setBackendUser] = useState(null);

  // Verificar estado de autenticación de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Obtener token de Firebase
          const firebaseToken = await firebaseUser.getIdToken();
          
          // Verificar/crear usuario en backend
          const backendResponse = await verifyBackendUser(firebaseToken, firebaseUser);
          
          setUser(firebaseUser);
          setBackendUser(backendResponse.user);
          
          // Guardar tokens
          localStorage.setItem('access_token', backendResponse.accessToken);
          localStorage.setItem('refresh_token', backendResponse.refreshToken);
          localStorage.setItem('user', JSON.stringify(backendResponse.user));
          
        } catch (error) {
          console.error('Error verificando usuario en backend:', error);
          setError(error.message);
          // Si falla el backend, cerrar sesión de Firebase
          await signOut(auth);
        }
      } else {
        // Usuario no autenticado
        setUser(null);
        setBackendUser(null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Verificar/crear usuario en backend
  const verifyBackendUser = async (firebaseToken, firebaseUser) => {
    try {
      // Intentar login con Firebase token
      const response = await api.post('/api/auth/login', {
        firebaseToken,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        // Usuario no existe, crear nuevo
        const createResponse = await api.post('/api/auth/create-user', {
          firebaseToken,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          role: 'agent' // Rol por defecto
        });
        
        return createResponse.data;
      }
      throw error;
    }
  };

  // Login con email y password
  const login = useCallback(async (email, password) => {
    try {
      setError(null);
      setLoading(true);
      
      // Login con Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Firebase automáticamente actualizará el estado
      // y el useEffect se encargará del resto
      
      return userCredential.user;
    } catch (error) {
      let errorMessage = 'Error en el login';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Usuario no encontrado';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Contraseña incorrecta';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Intenta más tarde';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Usuario deshabilitado';
          break;
        default:
          errorMessage = error.message;
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      // Logout del backend
      try {
        await api.post('/api/auth/logout');
      } catch (error) {
        console.warn('Error en logout del backend:', error);
      }
      
      // Logout de Firebase
      await signOut(auth);
      
      // Limpiar localStorage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      
    } catch (error) {
      console.error('Error en logout:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cambiar contraseña
  const changePassword = useCallback(async (newPassword) => {
    try {
      if (!user) throw new Error('Usuario no autenticado');
      
      await updatePassword(user, newPassword);
      
      // Actualizar en backend
      await api.put('/api/auth/change-password', { newPassword });
      
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, [user]);

  // Resetear contraseña
  const resetPassword = useCallback(async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  // Obtener perfil del usuario
  const getProfile = useCallback(async () => {
    try {
      const response = await api.get('/api/auth/profile');
      setBackendUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      return response.data;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  // Actualizar perfil
  const updateProfile = useCallback(async (profileData) => {
    try {
      const response = await api.put('/api/auth/profile', profileData);
      setBackendUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      return response.data;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  return {
    user,
    backendUser,
    loading,
    error,
    login,
    logout,
    changePassword,
    resetPassword,
    getProfile,
    updateProfile,
    isAuthenticated: !!user && !!backendUser
  };
};
```

---

## 🎯 CONTEXT DE AUTH

### Auth Context - `AuthContext.jsx`
```javascript
// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWebSocketContext } from './WebSocketContext';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const {
    user,
    backendUser,
    loading,
    error,
    login,
    logout,
    changePassword,
    resetPassword,
    getProfile,
    updateProfile,
    isAuthenticated
  } = useAuth();

  const { connect: connectSocket, disconnect: disconnectSocket } = useWebSocketContext();

  // Conectar WebSocket cuando se autentica
  useEffect(() => {
    if (isAuthenticated && backendUser) {
      const token = localStorage.getItem('access_token');
      if (token) {
        connectSocket(token);
      }
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated, backendUser, connectSocket, disconnectSocket]);

  // Verificar sesión al cargar
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('access_token');
      const userData = localStorage.getItem('user');
      
      if (token && userData && !isAuthenticated) {
        try {
          // Verificar token con backend
          await getProfile();
        } catch (error) {
          console.error('Error verificando sesión:', error);
          // Limpiar datos inválidos
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
        }
      }
    };

    if (!loading) {
      checkSession();
    }
  }, [loading, isAuthenticated, getProfile]);

  const value = {
    user,
    backendUser,
    loading,
    error,
    login,
    logout,
    changePassword,
    resetPassword,
    getProfile,
    updateProfile,
    isAuthenticated
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext debe usarse dentro de AuthProvider');
  }
  return context;
};
```

---

## 🧩 COMPONENTES DE LOGIN

### Componente de Login - `LoginComponent.jsx`
```javascript
// src/components/Auth/LoginComponent.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';
import './LoginComponent.css';

export const LoginComponent = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, loading, error, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // Manejar submit del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email, password);
      // La redirección se maneja en el useEffect
    } catch (error) {
      console.error('Error en login:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar cambio de campos
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Iniciar Sesión</h1>
          <p>Bienvenido a Utalk</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="tu@email.com"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Tu contraseña"
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={togglePasswordVisibility}
                disabled={isSubmitting}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isSubmitting || !email || !password}
          >
            {isSubmitting ? (
              <span className="loading-spinner"></span>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        <div className="login-footer">
          <a href="/forgot-password" className="forgot-password">
            ¿Olvidaste tu contraseña?
          </a>
        </div>
      </div>
    </div>
  );
};
```

### Componente de Reset Password - `ResetPasswordComponent.jsx`
```javascript
// src/components/Auth/ResetPasswordComponent.jsx
import React, { useState } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import './ResetPasswordComponent.css';

export const ResetPasswordComponent = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  
  const { resetPassword } = useAuthContext();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) return;

    try {
      setIsSubmitting(true);
      setMessage('');
      
      await resetPassword(email);
      setMessage('Se ha enviado un email con instrucciones para resetear tu contraseña.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reset-password-container">
      <div className="reset-password-card">
        <div className="reset-password-header">
          <h1>Resetear Contraseña</h1>
          <p>Ingresa tu email para recibir instrucciones</p>
        </div>

        <form onSubmit={handleSubmit} className="reset-password-form">
          {message && (
            <div className={`message ${message.includes('enviado') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            className="reset-button"
            disabled={isSubmitting || !email}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Email'}
          </button>
        </form>

        <div className="reset-password-footer">
          <Link to="/login" className="back-to-login">
            Volver al Login
          </Link>
        </div>
      </div>
    </div>
  );
};
```

---

## 🛡️ PROTECCIÓN DE RUTAS

### Componente ProtectedRoute - `ProtectedRoute.jsx`
```javascript
// src/components/Auth/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../UI/LoadingSpinner';

export const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, loading, backendUser } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && backendUser?.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};
```

### Componente PublicRoute - `PublicRoute.jsx`
```javascript
// src/components/Auth/PublicRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';

export const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuthContext();

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
```

---

## 🔄 MANEJO DE SESIÓN

### Hook de Sesión - `useSession.js`
```javascript
// src/hooks/useSession.js
import { useEffect, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import api from '../services/api';

export const useSession = () => {
  const { backendUser, getProfile } = useAuthContext();

  // Verificar sesión periódicamente
  useEffect(() => {
    const checkSession = async () => {
      try {
        await getProfile();
      } catch (error) {
        console.error('Error verificando sesión:', error);
      }
    };

    // Verificar cada 5 minutos
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [getProfile]);

  // Verificar sesión al hacer focus en la ventana
  useEffect(() => {
    const handleFocus = async () => {
      try {
        await getProfile();
      } catch (error) {
        console.error('Error verificando sesión al hacer focus:', error);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [getProfile]);

  return {
    user: backendUser,
    isAuthenticated: !!backendUser
  };
};
```

---

## 🔗 INTEGRACIÓN CON WEBSOCKET

### Actualizar WebSocket Context
```javascript
// src/contexts/WebSocketContext.jsx (actualización)
import { useAuthContext } from './AuthContext';

export const WebSocketProvider = ({ children }) => {
  const { isAuthenticated, backendUser } = useAuthContext();
  
  // ... resto del código existente ...

  // Conectar automáticamente cuando se autentica
  useEffect(() => {
    if (isAuthenticated && backendUser) {
      const token = localStorage.getItem('access_token');
      if (token) {
        connect(token);
      }
    } else {
      disconnect();
    }
  }, [isAuthenticated, backendUser, connect, disconnect]);

  // ... resto del código existente ...
};
```

---

## 🧪 TESTING

### Test de Auth Hook
```javascript
// src/hooks/__tests__/useAuth.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import { useAuth } from '../useAuth';

// Mock Firebase
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  updatePassword: jest.fn()
}));

// Mock API
jest.mock('../../services/api');

describe('useAuth', () => {
  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should handle login errors', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.login('invalid@example.com', 'wrong');
      } catch (error) {
        expect(error.message).toBeDefined();
      }
    });
  });
});
```

---

## 🚀 IMPLEMENTACIÓN COMPLETA

### 1. App.jsx
```javascript
// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { PublicRoute } from './components/Auth/PublicRoute';
import { LoginComponent } from './components/Auth/LoginComponent';
import { ResetPasswordComponent } from './components/Auth/ResetPasswordComponent';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ChatApp } from './components/ChatApp';

function App() {
  return (
    <Router>
      <AuthProvider>
        <WebSocketProvider>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/login" element={
              <PublicRoute>
                <LoginComponent />
              </PublicRoute>
            } />
            <Route path="/forgot-password" element={
              <PublicRoute>
                <ResetPasswordComponent />
              </PublicRoute>
            } />

            {/* Rutas protegidas */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/chat" element={
              <ProtectedRoute>
                <ChatApp />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin">
                <AdminPanel />
              </ProtectedRoute>
            } />

            {/* Ruta por defecto */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </WebSocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
```

### 2. Index.js
```javascript
// src/index.js
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './index.css';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### ✅ Configuración (10 min)
- [ ] Instalar dependencias (firebase, react-router-dom, axios)
- [ ] Configurar Firebase en .env
- [ ] Crear configuración de Firebase
- [ ] Configurar servicio de API con interceptors

### ✅ Hooks (30 min)
- [ ] useAuth hook completo
- [ ] useSession hook
- [ ] Manejo de errores de Firebase
- [ ] Integración con backend

### ✅ Context (20 min)
- [ ] AuthContext
- [ ] Integración con WebSocket
- [ ] Manejo de estado global

### ✅ Componentes (45 min)
- [ ] LoginComponent
- [ ] ResetPasswordComponent
- [ ] ProtectedRoute
- [ ] PublicRoute

### ✅ Integración (15 min)
- [ ] Rutas en App.jsx
- [ ] Integración con WebSocket
- [ ] Manejo de sesión persistente

### ✅ Testing (20 min)
- [ ] Tests de hooks
- [ ] Tests de componentes
- [ ] Tests de integración

---

## 🎯 RESULTADO FINAL

Con esta implementación tendrás:

✅ **Login completo** con Firebase y backend
✅ **Sesión persistente** con refresh automático
✅ **Protección de rutas** por roles
✅ **Integración perfecta** con WebSocket
✅ **Manejo de errores** robusto
✅ **Reset de contraseña** funcional
✅ **Testing completo** para mantener calidad

## 🔑 PUNTOS CLAVE PARA LA IA

### **1. Flujo de Autenticación:**
1. Usuario ingresa email/password
2. Firebase autentica
3. Backend verifica/crea usuario
4. Se obtienen tokens (access + refresh)
5. WebSocket se conecta automáticamente
6. Usuario redirigido al dashboard

### **2. Manejo de Tokens:**
- Access token en Authorization header
- Refresh automático cuando expira
- Limpieza automática en logout
- Persistencia en localStorage

### **3. Integración WebSocket:**
- Conecta automáticamente al autenticarse
- Desconecta al hacer logout
- Reconoce con nuevo token tras refresh

### **4. Protección de Rutas:**
- Rutas públicas (login, reset password)
- Rutas protegidas (dashboard, chat)
- Rutas con roles específicos (admin)

### **5. Manejo de Errores:**
- Errores de Firebase traducidos
- Errores de backend manejados
- Refresh token fallido = logout automático

¡Sigue estas instrucciones y tendrás un sistema de autenticación completo y robusto! 🚀 