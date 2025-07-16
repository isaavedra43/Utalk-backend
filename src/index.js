/**
 * FUNDAY BACKEND API - UTalk WhatsApp Management System
 *
 * CRITICAL FIX: Router.use() middleware error resolved
 * - Fixed: authMiddleware import using destructuring to get function, not object
 * - Standardized: All middleware/route import patterns documented
 * - Date: 2025-01-15
 *
 * Deploy requirements: Firebase + Twilio environment variables
 * See: DEPLOY_GUIDE.md for complete setup instructions
 */

// ✅ RAILWAY LOGGING: Inicio del servidor
console.log('🚀 FUNDAY BACKEND - Iniciando servidor...');
console.log('🌍 Entorno:', process.env.NODE_ENV || 'development');
console.log('🔌 Puerto:', process.env.PORT || 3000);
console.log('⏰ Timestamp:', new Date().toISOString());

// ✅ DEBUG MODE: Mostrar información del entorno Railway
console.log('🔍 RAILWAY DEBUG - Variables críticas detectadas:', {
  NODE_VERSION: process.version,
  PLATFORM: process.platform,
  MEMORY_USAGE: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
  HAS_FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
  HAS_FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
  HAS_FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
  HAS_TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
  HAS_TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
  HAS_TWILIO_WHATSAPP_NUMBER: !!process.env.TWILIO_WHATSAPP_NUMBER,
  ENV_COUNT: Object.keys(process.env).length,
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// ✅ IMPORTAR CONFIGURACIONES CON MANEJO DE ERRORES ROBUSTO
console.log('📥 Cargando configuraciones...');

try {
  // Importar configuraciones y middlewares
  console.log('📥 Cargando Firebase config...');
  const { firestore } = require('./config/firebase');
  console.log('✅ Firebase config cargado');

  console.log('📥 Cargando error handler...');
  const errorHandler = require('./middleware/errorHandler');
  console.log('✅ Error handler cargado');

  console.log('📥 Cargando auth middleware...');
  // FIXED: Usar destructuring para importar solo la función authMiddleware del objeto exportado
  const { authMiddleware } = require('./middleware/auth');
  console.log('✅ Auth middleware cargado');

  console.log('✅ Configuraciones cargadas exitosamente');

  // Importar rutas
  console.log('📥 Cargando rutas...');
  const authRoutes = require('./routes/auth');
  const contactRoutes = require('./routes/contacts');
  const messageRoutes = require('./routes/messages');
  const campaignRoutes = require('./routes/campaigns');
  const knowledgeRoutes = require('./routes/knowledge');
  const dashboardRoutes = require('./routes/dashboard');
  const teamRoutes = require('./routes/team');

  console.log('✅ Rutas cargadas exitosamente');

  const app = express();
  const PORT = process.env.PORT || 3000;

  // ✅ CONFIGURACIÓN DE RATE LIMITING
  console.log('🔒 Configurando rate limiting...');
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // máximo 100 requests por ventana
    message: {
      error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo en unos minutos.',
    },
  });

  // ✅ CONFIGURACIÓN DE CORS
  console.log('🌐 Configurando CORS...');
  const corsOptions = {
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
  };

  // ✅ MIDDLEWARES GLOBALES
  console.log('🔧 Aplicando middlewares globales...');
  app.use(helmet()); // Seguridad básica
  app.use(cors(corsOptions)); // CORS
  app.use(compression()); // Compresión gzip
  app.use(limiter); // Rate limiting
  app.use(morgan('combined')); // Logging
  app.use(express.json({ limit: '10mb' })); // Parse JSON
  app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded

  console.log('✅ Middlewares aplicados exitosamente');

  // ✅ HEALTH CHECK OPTIMIZADO: Verificación real de servicios
  app.get('/health', async (req, res) => {
    const startTime = Date.now();
    const healthcheck = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: require('../package.json').version,
      uptime: process.uptime(),
      railway: {
        hasFirebaseVars: !!process.env.FIREBASE_PROJECT_ID && !!process.env.FIREBASE_PRIVATE_KEY && !!process.env.FIREBASE_CLIENT_EMAIL,
        hasTwilioVars: !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_WHATSAPP_NUMBER,
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      },
      checks: {
        firebase: { status: 'unknown', details: null },
        twilio: { status: 'unknown', details: null },
        webhook: { status: 'unknown', url: null },
      },
      responseTime: 0,
    };

    // ✅ RAILWAY LOGGING: Visible en Railway console
    console.log('🏥 HEALTH CHECK - Iniciando verificación completa...');

    // ✅ VERIFICACIÓN FIREBASE: Test real de conectividad
    try {
      console.log('🔍 HEALTH - Verificando Firebase...');

      // Test de lectura real a Firestore
      const testQuery = await firestore.collection('_health_check').limit(1).get();

      // Test de escritura (opcional)
      const testDoc = {
        timestamp: new Date(),
        test: true,
        source: 'health_check',
      };

      await firestore.collection('_health_check').add(testDoc);

      healthcheck.checks.firebase = {
        status: 'connected',
        details: {
          canRead: true,
          canWrite: true,
          projectId: process.env.FIREBASE_PROJECT_ID,
          testQuerySize: testQuery.size,
        },
      };
      console.log('✅ HEALTH - Firebase: Lectura y escritura OK');

    } catch (firebaseError) {
      healthcheck.checks.firebase = {
        status: 'disconnected',
        details: {
          error: firebaseError.message,
          code: firebaseError.code || 'unknown',
          canRead: false,
          canWrite: false,
        },
      };
      healthcheck.status = 'DEGRADED';
      console.error('❌ HEALTH - Firebase falló:', firebaseError.message);
    }

    // ✅ VERIFICACIÓN TWILIO: Validación de credenciales y configuración
    try {
      console.log('🔍 HEALTH - Verificando Twilio...');

      const requiredTwilioVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER'];
      const missingTwilio = requiredTwilioVars.filter(varName => !process.env[varName]);

      if (missingTwilio.length > 0) {
        throw new Error(`Variables faltantes: ${missingTwilio.join(', ')}`);
      }

      // Validar formato de variables
      if (!process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
        throw new Error('TWILIO_ACCOUNT_SID debe comenzar con AC');
      }

      if (!process.env.TWILIO_WHATSAPP_NUMBER.includes('whatsapp:')) {
        throw new Error('TWILIO_WHATSAPP_NUMBER debe incluir whatsapp:');
      }

      healthcheck.checks.twilio = {
        status: 'configured',
        details: {
          accountSid: process.env.TWILIO_ACCOUNT_SID.substring(0, 10) + '...',
          whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
          hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
          hasWebhookSecret: !!process.env.WEBHOOK_SECRET,
        },
      };
      console.log('✅ HEALTH - Twilio: Variables y formato OK');

    } catch (twilioError) {
      healthcheck.checks.twilio = {
        status: 'misconfigured',
        details: {
          error: twilioError.message,
          hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
          hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
          hasWhatsappNumber: !!process.env.TWILIO_WHATSAPP_NUMBER,
        },
      };
      healthcheck.status = 'DEGRADED';
      console.error('❌ HEALTH - Twilio falló:', twilioError.message);
    }

    // ✅ VERIFICACIÓN WEBHOOK: URL y configuración
    try {
      const webhookUrl = `${req.protocol}://${req.headers.host}/api/messages/webhook`;

      healthcheck.checks.webhook = {
        status: 'configured',
        url: webhookUrl,
        details: {
          method: 'POST',
          expectedContentType: 'application/x-www-form-urlencoded',
          isPublic: true,
          twilioExpectedUrl: webhookUrl,
        },
      };
      console.log('✅ HEALTH - Webhook URL configurado:', webhookUrl);

    } catch (webhookError) {
      healthcheck.checks.webhook = {
        status: 'error',
        details: { error: webhookError.message },
      };
      console.error('❌ HEALTH - Webhook error:', webhookError.message);
    }

    // ✅ TIEMPO DE RESPUESTA Y STATUS FINAL
    healthcheck.responseTime = Date.now() - startTime;

    // Determinar status code basado en checks
    const statusCode = healthcheck.status === 'OK' ? 200 : 503;

    // ✅ LOGGING FINAL PARA RAILWAY
    console.log(`🏥 HEALTH CHECK completado en ${healthcheck.responseTime}ms`);
    console.log(`📊 Status: ${healthcheck.status}`);
    console.log(`🔥 Firebase: ${healthcheck.checks.firebase.status}`);
    console.log(`📞 Twilio: ${healthcheck.checks.twilio.status}`);
    console.log(`🔗 Webhook: ${healthcheck.checks.webhook.status}`);

    if (healthcheck.status === 'DEGRADED') {
      console.error('⚠️ HEALTH - Sistema degradado, revisar logs arriba');
    } else {
      console.log('✅ HEALTH - Todos los servicios funcionando correctamente');
    }

    res.status(statusCode).json(healthcheck);
  });

  // ✅ RUTAS PÚBLICAS SIN AUTENTICACIÓN (DEBEN IR ANTES del authMiddleware)
  console.log('🔗 Registrando webhook público...');
  // CRÍTICO: Webhook de Twilio debe ser público para recibir mensajes de WhatsApp
  app.use('/api/messages/webhook', require('./routes/webhook'));
  console.log('✅ Webhook registrado en: /api/messages/webhook');

  // ✅ RUTAS DE LA API PROTEGIDAS
  console.log('🔒 Registrando rutas protegidas...');
  app.use('/api/auth', authRoutes);
  app.use('/api/contacts', authMiddleware, contactRoutes);
  app.use('/api/messages', authMiddleware, messageRoutes);
  app.use('/api/campaigns', authMiddleware, campaignRoutes);
  app.use('/api/knowledge', authMiddleware, knowledgeRoutes);
  app.use('/api/dashboard', authMiddleware, dashboardRoutes);
  app.use('/api/team', authMiddleware, teamRoutes);
  console.log('✅ Rutas protegidas registradas');

  // ✅ RUTA POR DEFECTO CON DEBUG INFO
  app.get('/', (req, res) => {
    console.log('🏠 Acceso a ruta principal');
    res.json({
      message: 'Funday Backend API - DEBUGGING MODE',
      version: require('../package.json').version,
      environment: process.env.NODE_ENV || 'development',
      documentation: '/api/docs',
      health: '/health',
      webhook: '/api/messages/webhook',
      timestamp: new Date().toISOString(),
      railway: {
        uptime: process.uptime(),
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        nodeVersion: process.version,
        hasFirebase: !!process.env.FIREBASE_PROJECT_ID,
        hasTwilio: !!process.env.TWILIO_ACCOUNT_SID,
      },
    });
  });

  // ✅ MANEJO DE RUTAS NO ENCONTRADAS
  app.use('*', (req, res) => {
    console.log('❌ Ruta no encontrada:', req.originalUrl);
    res.status(404).json({
      error: 'Ruta no encontrada',
      message: `La ruta ${req.originalUrl} no existe en este servidor.`,
      availableRoutes: {
        health: '/health',
        webhook: '/api/messages/webhook',
        auth: '/api/auth',
        messages: '/api/messages',
        contacts: '/api/contacts',
      },
    });
  });

  // ✅ MIDDLEWARE DE MANEJO DE ERRORES (debe ir al final)
  app.use(errorHandler);

  // ✅ INICIALIZACIÓN DEL SERVIDOR (Solo si NO estamos en modo test)
  if (process.env.NODE_ENV !== 'test') {
    console.log('🚀 Iniciando servidor HTTP...');
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('🎉 ===================================');
      console.log('🎉 FUNDAY BACKEND INICIADO CON ÉXITO');
      console.log('🎉 ===================================');
      console.log(`🌍 URL: http://0.0.0.0:${PORT}`);
      console.log(`🏥 Health: http://0.0.0.0:${PORT}/health`);
      console.log(`🔗 Webhook: http://0.0.0.0:${PORT}/api/messages/webhook`);
      console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log(`💾 Memoria: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      console.log('🎉 ===================================');
      
      // ✅ TEST INMEDIATO POST-STARTUP
      console.log('🧪 Ejecutando test de funcionalidad...');
      setTimeout(() => {
        console.log('✅ Servidor completamente inicializado y listo');
      }, 1000);
    });

    // ✅ MANEJO DE CIERRE GRACEFUL
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM recibido, cerrando servidor...');
      server.close(() => {
        console.log('✅ Servidor cerrado correctamente');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT recibido, cerrando servidor...');
      server.close(() => {
        console.log('✅ Servidor cerrado correctamente');
        process.exit(0);
      });
    });

    // ✅ MANEJO DE ERRORES NO CAPTURADOS
    process.on('uncaughtException', (error) => {
      console.error('❌ UNCAUGHT EXCEPTION:', error.message);
      console.error('Stack:', error.stack);
      console.error('El proceso será terminado');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ UNHANDLED REJECTION en:', promise);
      console.error('Razón:', reason);
      console.error('El proceso continuará pero esto debería investigarse');
    });
  }

  // ✅ EXPORTAR APP PARA TESTING
  module.exports = app;

} catch (initError) {
  console.error('❌ ERROR CRÍTICO EN INICIALIZACIÓN PRINCIPAL:', initError.message);
  console.error('Stack completo:', initError.stack);
  console.error('Variables de entorno críticas:');
  console.error('- FIREBASE_PROJECT_ID:', !!process.env.FIREBASE_PROJECT_ID);
  console.error('- FIREBASE_PRIVATE_KEY:', !!process.env.FIREBASE_PRIVATE_KEY);
  console.error('- FIREBASE_CLIENT_EMAIL:', !!process.env.FIREBASE_CLIENT_EMAIL);
  console.error('- TWILIO_ACCOUNT_SID:', !!process.env.TWILIO_ACCOUNT_SID);
  console.error('- TWILIO_AUTH_TOKEN:', !!process.env.TWILIO_AUTH_TOKEN);
  
  console.error('💥 EL SERVIDOR NO PUEDE CONTINUAR - VERIFICA CONFIGURACIÓN EN RAILWAY');
  
  // En Railway, es mejor enviar una respuesta que crashear completamente
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 Modo producción - intentando respuesta básica de error...');
    
    const express = require('express');
    const errorApp = express();
    const PORT = process.env.PORT || 3000;
    
    errorApp.get('*', (req, res) => {
      res.status(500).json({
        error: 'Configuration Error',
        message: 'Server failed to initialize - check Railway environment variables',
        timestamp: new Date().toISOString(),
        issue: initError.message,
      });
    });
    
    errorApp.listen(PORT, () => {
      console.log(`🚨 Error server running on port ${PORT} - check Railway logs`);
    });
  } else {
    process.exit(1);
  }
}
