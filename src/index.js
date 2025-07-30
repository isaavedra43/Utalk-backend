/**
 * UTalk Backend API - WhatsApp Messaging Platform
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const { firestore } = require('./config/firebase');
const { client: twilioClient } = require('./config/twilio');
const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const logger = require('./utils/logger');

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

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*',
  credentials: true
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalRateLimit);

app.get('/', (req, res) => {
  res.json({
    message: 'UTalk Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/media', mediaRoutes);

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

const SocketManager = require('./socket');
const socketManager = new SocketManager(server);

// Hacer SocketManager disponible en la app
app.set('socketManager', socketManager);

logger.info('SocketManager inicializado y disponible en la app');

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

module.exports = app;
