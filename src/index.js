const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importar configuraciones y middlewares
const firebaseConfig = require('./config/firebase');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

// Importar rutas
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const messageRoutes = require('./routes/messages');
const campaignRoutes = require('./routes/campaigns');
const knowledgeRoutes = require('./routes/knowledge');
const dashboardRoutes = require('./routes/dashboard');
const teamRoutes = require('./routes/team');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // máximo 100 requests por ventana
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo en unos minutos.',
  },
});

// Configuración de CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middlewares globales
app.use(helmet()); // Seguridad básica
app.use(cors(corsOptions)); // CORS
app.use(compression()); // Compresión gzip
app.use(limiter); // Rate limiting
app.use(morgan('combined')); // Logging
app.use(express.json({ limit: '10mb' })); // Parse JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: require('../package.json').version,
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/contacts', authMiddleware, contactRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/knowledge', authMiddleware, knowledgeRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/team', authMiddleware, teamRoutes);

// Ruta por defecto
app.get('/', (req, res) => {
  res.json({
    message: 'Funday Backend API',
    version: require('../package.json').version,
    documentation: '/api/docs',
    health: '/health',
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `La ruta ${req.originalUrl} no existe en este servidor.`,
  });
});

// Middleware de manejo de errores (debe ir al final)
app.use(errorHandler);

// Inicializar servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor Funday Backend ejecutándose en puerto ${PORT}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Manejo de cierre graceful
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

module.exports = app; 