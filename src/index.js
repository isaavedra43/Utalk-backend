/**
 * UTalk Backend API - WhatsApp Messaging Platform
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const { firestore } = require('./config/firebase');
const { client: twilioClient } = require('./config/twilio');
const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const logger = require('./utils/logger');

// ✅ NUEVO: Importar middleware de logging avanzado
const { 
  loggingMiddleware, 
  errorLoggingMiddleware, 
  securityLoggingMiddleware, 
  performanceLoggingMiddleware 
} = require('./middleware/logging');

const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const campaignRoutes = require('./routes/campaigns');
const knowledgeRoutes = require('./routes/knowledge');
const dashboardRoutes = require('./routes/dashboard');
const teamRoutes = require('./routes/team');
const mediaRoutes = require('./routes/media');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ INICIO: Log de inicialización del servidor
logger.info('🚀 Iniciando UTalk Backend', {
  version: '2.0.0',
  environment: process.env.NODE_ENV || 'development',
  port: PORT,
  nodeVersion: process.version,
  platform: process.platform,
  // ✅ NUEVO: Confirmar que la corrección de rate limiting está activa
  rateLimitFix: 'express-rate-limit v7 handler implemented',
  deployment: 'latest'
});

// Middleware de seguridad básico
app.use(helmet());
app.use(compression());

// ✅ CORS con logging
const corsOptions = {
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*',
  credentials: true
};

app.use(cors(corsOptions));
logger.info('✅ CORS configurado', { 
  origins: corsOptions.origin === '*' ? 'all' : corsOptions.origin 
});

// ✅ NUEVO: Middleware de logging avanzado (PRIMERO)
app.use(loggingMiddleware);
app.use(securityLoggingMiddleware);
app.use(performanceLoggingMiddleware);

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting global
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ CORREGIDO: Usar el nuevo sistema de handlers de v7
  handler: (req, res) => {
    // ✅ NUEVO: Log de rate limit excedido usando el nuevo sistema
    logger.security('rate_limit_exceeded', {
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    
    // ✅ RESPONDER con el mensaje de error estándar
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(15 * 60), // 15 minutos en segundos
      timestamp: new Date().toISOString()
    });
  }
});
app.use(globalRateLimit);

// Health endpoints
app.get('/', (req, res) => {
  req.logger.info('Endpoint raíz accedido');
  res.json({
    message: 'UTalk Backend API',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0',
    services: {
      database: 'connected', // TODO: Verificar conexión real
      storage: 'connected',   // TODO: Verificar Firebase Storage
      twilio: 'connected'     // TODO: Verificar Twilio
    }
  };
  
  req.logger.info('Health check ejecutado', healthStatus);
  res.json(healthStatus);
});

// ✅ RUTAS CON LOGGING MEJORADO
app.use('/api/auth', (req, res, next) => {
  req.logger.info('Accediendo a rutas de autenticación');
  next();
}, authRoutes);

app.use('/api/contacts', (req, res, next) => {
  req.logger.info('Accediendo a rutas de contactos');
  next();
}, contactRoutes);

app.use('/api/conversations', (req, res, next) => {
  req.logger.info('Accediendo a rutas de conversaciones');
  next();
}, conversationRoutes);

app.use('/api/messages', (req, res, next) => {
  req.logger.info('Accediendo a rutas de mensajes');
  next();
}, messageRoutes);

app.use('/api/campaigns', (req, res, next) => {
  req.logger.info('Accediendo a rutas de campañas');
  next();
}, campaignRoutes);

app.use('/api/knowledge', (req, res, next) => {
  req.logger.info('Accediendo a rutas de conocimiento');
  next();
}, knowledgeRoutes);

app.use('/api/dashboard', (req, res, next) => {
  req.logger.info('Accediendo a rutas de dashboard');
  next();
}, dashboardRoutes);

app.use('/api/team', (req, res, next) => {
  req.logger.info('Accediendo a rutas de equipo');
  next();
}, teamRoutes);

app.use('/api/media', (req, res, next) => {
  req.logger.info('Accediendo a rutas de media');
  next();
}, mediaRoutes);

// 404 Handler con logging
app.use('*', (req, res) => {
  req.logger.warn('Ruta no encontrada', {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.headers['user-agent']?.substring(0, 100)
  });
  
  res.status(404).json({
    error: 'Route not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// ✅ NUEVO: Error handler con logging avanzado
app.use(errorLoggingMiddleware);
app.use(errorHandler);

// Iniciar servidor
const server = app.listen(PORT, () => {
  logger.success('🎉 Servidor iniciado exitosamente', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    processId: process.pid
  });
});

// ✅ INICIALIZAR SOCKET.IO CON LOGGING
const SocketManager = require('./socket');
logger.info('🔌 Inicializando Socket.IO Manager');

const socketManager = new SocketManager(server);

// Hacer SocketManager disponible en la app
app.set('socketManager', socketManager);

logger.success('✅ SocketManager inicializado y disponible en la app');

// ✅ MANEJO DE EVENTOS DEL PROCESO CON LOGGING MEJORADO
process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Promise Rejection', { 
    reason: reason?.toString(),
    stack: reason?.stack,
    promise: promise?.toString()
  });
});

process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception', { 
    error: error.message, 
    stack: error.stack,
    pid: process.pid
  });
  
  // Cerrar servidor gracefully
  server.close(() => {
    logger.error('💀 Proceso terminado por excepción no capturada');
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  logger.info('📢 SIGTERM recibido, cerrando servidor gracefully');
  
  server.close(() => {
    logger.info('🛑 Servidor cerrado exitosamente');
    logger.info('💤 Proceso terminado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('📢 SIGINT recibido (Ctrl+C), cerrando servidor gracefully');
  
  server.close(() => {
    logger.info('🛑 Servidor cerrado exitosamente');
    logger.info('💤 Proceso terminado');
    process.exit(0);
  });
});

// ✅ MONITOREO DE MEMORIA Y PERFORMANCE
setInterval(() => {
  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  if (memUsedMB > 200) { // Más de 200MB
    logger.performance('memory_high', {
      heapUsed: `${memUsedMB}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    });
  }
}, 60000); // Cada minuto

logger.info('✅ Sistema de monitoreo iniciado');

module.exports = app;
