/**
 * 🚀 SERVIDOR SIMPLIFICADO PARA PRUEBAS
 */

// Cargar variables de entorno
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Configuración
const logger = require('./utils/logger');

// Rutas
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const campaignRoutes = require('./routes/campaigns');
const teamRoutes = require('./routes/team');
const knowledgeRoutes = require('./routes/knowledge');
const mediaRoutes = require('./routes/media');
const dashboardRoutes = require('./routes/dashboard');

class SimpleServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.PORT = process.env.PORT || 3001;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Middlewares básicos
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    this.app.use((req, res, next) => {
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      next();
    });
  }

  setupRoutes() {
    // Health check básico
    this.app.get('/health', (req, res) => {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks: {
          server: { status: 'healthy', message: 'Server is running' },
          memory: { 
            status: 'healthy', 
            usage: process.memoryUsage(),
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
          },
          process: { 
            status: 'healthy', 
            pid: process.pid,
            uptime: process.uptime()
          }
        },
        summary: {
          total: 3,
          healthy: 3,
          failed: 0,
          failedChecks: []
        }
      };

      res.status(200).json(healthData);
    });

    // Rutas principales
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/contacts', contactRoutes);
    this.app.use('/api/conversations', conversationRoutes);
    this.app.use('/api/messages', messageRoutes);
    this.app.use('/api/campaigns', campaignRoutes);
    this.app.use('/api/team', teamRoutes);
    this.app.use('/api/knowledge', knowledgeRoutes);
    this.app.use('/api/media', mediaRoutes);
    this.app.use('/api/dashboard', dashboardRoutes);

    // Ruta catch-all para 404
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          type: 'NOT_FOUND_ERROR',
          code: 'ROUTE_NOT_FOUND',
          message: 'Ruta no encontrada',
          details: {
            method: req.method,
            path: req.originalUrl
          },
          timestamp: new Date().toISOString()
        }
      });
    });
  }

  async start() {
    try {
      this.server = this.app.listen(this.PORT, () => {
        logger.info('🚀 Servidor simplificado iniciado exitosamente', {
          category: 'SERVER_START',
          port: this.PORT,
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString()
        });
      });

      // Manejo de señales
      process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    } catch (error) {
      logger.error('💥 Error iniciando servidor', {
        category: 'SERVER_START_ERROR',
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  async gracefulShutdown(signal) {
    logger.info('🛑 Iniciando graceful shutdown...', {
      category: 'SHUTDOWN_START',
      signal,
      uptime: process.uptime()
    });

    if (this.server) {
      this.server.close(() => {
        logger.info('✅ Servidor cerrado exitosamente', {
          category: 'SHUTDOWN_COMPLETE'
        });
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }
}

// Iniciar servidor
const server = new SimpleServer();
server.start(); 