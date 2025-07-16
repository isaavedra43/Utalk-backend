# 🚀 GUÍA DE DEPLOY - UTALK BACKEND

## ✅ ERRORES DE MIDDLEWARE CORREGIDOS

### Problema Resuelto: "Router.use() requires a middleware function but got a Object"

**Cambios realizados:**
- ✅ Corregida importación en `src/index.js` línea 11
- ✅ Estandarizados patrones de export/import en todo el proyecto
- ✅ Documentados todos los middlewares y rutas

## 🔧 VARIABLES DE ENTORNO CRÍTICAS

### Variables OBLIGATORIAS para el deploy:

```env
# Firebase - CRÍTICO para autenticación
FIREBASE_PROJECT_ID=tu-project-id-real
FIREBASE_PRIVATE_KEY=tu-private-key-real  
FIREBASE_CLIENT_EMAIL=tu-client-email-real

# Twilio - CRÍTICO para WhatsApp
TWILIO_ACCOUNT_SID=tu-account-sid-real
TWILIO_AUTH_TOKEN=tu-auth-token-real
TWILIO_WHATSAPP_NUMBER=whatsapp:+tu-numero-real

# Seguridad
JWT_SECRET=clave-segura-minimo-32-caracteres
```

## 🏗️ PASOS MÍNIMOS PARA DEPLOY

1. **Copiar variables de entorno:**
   ```bash
   cp env.example .env
   # Editar .env con valores reales
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Verificar configuración:**
   ```bash
   node -c src/index.js
   ```

4. **Iniciar servidor:**
   ```bash
   npm start
   ```

## 📋 PATRONES ESTANDARIZADOS

### ✅ RUTAS - Exportación estándar:
```javascript
// TODAS las rutas usan este patrón:
module.exports = router;
```

### ✅ MIDDLEWARES - Importación correcta:
```javascript
// Para múltiples middlewares:
const { authMiddleware, requireAdmin } = require('./middleware/auth');

// Para middleware único:
const errorHandler = require('./middleware/errorHandler');
```

### ❌ NUNCA hacer:
```javascript
// ❌ INCORRECTO - causa error Router.use()
const authMiddleware = require('./middleware/auth'); // Importa objeto completo
app.use('/api/endpoint', authMiddleware, router); // Error: Object no es función

// ✅ CORRECTO
const { authMiddleware } = require('./middleware/auth'); // Importa solo la función
app.use('/api/endpoint', authMiddleware, router); // Funciona correctamente
```

## 🚨 TROUBLESHOOTING

### Error: "Router.use() requires a middleware function but got a Object"
- **Causa:** Importación incorrecta de middleware
- **Solución:** Usar destructuring `const { middleware } = require('./path')`

### Error: "Firebase configuration missing"
- **Causa:** Variables de entorno faltantes
- **Solución:** Configurar todas las variables FIREBASE_* en .env

### Error: "Twilio authentication failed"
- **Causa:** Credenciales Twilio incorrectas
- **Solución:** Verificar TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN

## 📁 ARCHIVOS MODIFICADOS

- `src/index.js` - Corregida importación de authMiddleware
- `src/middleware/auth.js` - Documentado patrón de exportación
- `src/middleware/security.js` - Marcado como no usado
- `src/middleware/errorHandler.js` - Documentado patrón
- `src/utils/validation.js` - Documentado patrón
- `src/routes/*.js` - Documentados patrones de exportación (7 archivos)
- `env.example` - Marcadas variables críticas
- `DEPLOY_GUIDE.md` - Esta guía creada

## ✅ ESTADO FINAL

- ❌ **Error de middleware:** RESUELTO
- ✅ **Patrones estandarizados:** IMPLEMENTADO
- ✅ **Documentación:** COMPLETA
- ⚠️ **Pendiente:** Configurar variables de entorno reales

**El backend está listo para deploy una vez configuradas las variables de entorno.** 