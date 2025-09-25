const logger = require('../utils/logger');
const { getHealthCheckService } = require('../services/HealthCheckService');
const { cacheService } = require('../services/CacheService');

// Rutas
const authRoutes = require('../routes/auth');
const contactRoutes = require('../routes/contacts');
const conversationRoutes = require('../routes/conversations');
const messageRoutes = require('../routes/messages');
const campaignRoutes = require('../routes/campaigns');
const teamRoutes = require('../routes/team');
const agentRoutes = require('../routes/agents');
const knowledgeRoutes = require('../routes/knowledge');
const mediaRoutes = require('../routes/media');
const dashboardRoutes = require('../routes/dashboard');
const twilioRoutes = require('../routes/twilio');
const aiRoutes = require('../routes/ai');
const reportRoutes = require('../routes/reports');
const ragRoutes = require('../routes/rag');
const aiOpsRoutes = require('../routes/aiOps');
const logRoutes = require('../routes/logs');
const clientRoutes = require('../routes/clients');
const modulePermissionsRoutes = require('../routes/modulePermissions');
const copilotRoutes = require('../routes/copilot');
const employeeRoutes = require('../routes/employees');

function registerRoutes(app, { PORT, socketManager, healthService }) {
  logger.info('🛣️ Configurando rutas de la aplicación...', {
    category: 'ROUTES_SETUP'
  });

  try {
    // Diagnostics básicos
    app.get('/diagnostics', (req, res) => {
      const health = getHealthCheckService();
      const diagnostics = {
        server: 'running',
        timestamp: new Date().toISOString(),
        services: {
          memoryManager: !!cacheService,
          healthService: !!healthService,
          rateLimiting: 'disabled',
          socketManager: !!socketManager
        },
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        uptime: process.uptime(),
        healthStatus: health.getHealthStatus()
      };
      res.json(diagnostics);
    });

    // Root info
    app.get('/', (req, res) => {
      logger.debug('Root endpoint solicitado', {
        category: 'ROOT_ENDPOINT',
        clientIp: req.ip
      });
      res.json({
        service: 'UTalk Backend API',
        status: 'running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        endpoints: { health: '/health', ping: '/ping', diagnostics: '/diagnostics', api: '/api/*' }
      });
    });

    // Internal metrics (sin auth como en implementación actual de lectura)
    app.get('/api/internal/metrics', async (req, res) => {
      try {
        const metrics = {
          server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            pid: process.pid,
            loadAverage: require('os').loadavg(),
            platform: process.platform,
            nodeVersion: process.version
          },
          memoryManager: cacheService ? cacheService.getStats() : null,
          socket: socketManager ? socketManager.getDetailedStats() : null,
          rateLimiting: {},
          healthService: healthService ? healthService.getDetailedMetrics() : null,
          logging: logger.getStats(),
          timestamp: new Date().toISOString()
        };
        res.json({ success: true, data: metrics, timestamp: new Date().toISOString() });
      } catch (error) {
        logger.error('Error obteniendo métricas internas', {
          category: 'METRICS_ERROR',
          error: error.message,
          stack: error.stack,
          requestId: req.requestId
        });
        res.status(500).json({ success: false, error: { type: 'METRICS_ERROR', message: 'Error obteniendo métricas del sistema', timestamp: new Date().toISOString() } });
      }
    });

    // Logging middleware para /api
    const loggingMiddleware = require('../middleware/logging');
    app.use('/api', loggingMiddleware);

    // API principales
    app.use('/api/auth', authRoutes);
    app.use('/api/contacts', contactRoutes);
    app.use('/api/conversations', conversationRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/campaigns', campaignRoutes);
    app.use('/api/team', teamRoutes);
    app.use('/api/agents', agentRoutes);
    app.use('/api/module-permissions', modulePermissionsRoutes);
    app.use('/api/knowledge', knowledgeRoutes);
    app.use('/api/media', mediaRoutes);
    app.use('/api/clients', clientRoutes);
    app.use('/api/employees', employeeRoutes);
    app.use('/api/auto-attendance', require('../routes/auto-attendance'));
    app.use('/api/attachments', require('../routes/attachments'));
    app.use('/api/payroll/general', require('../routes/generalPayroll'));
    app.use('/api/payroll', require('../routes/payroll'));

    // AI y derivados (los módulos exportan .router)
    if (aiRoutes?.router) app.use('/api/ai', aiRoutes.router);
    if (reportRoutes?.router) app.use('/api/ai/reports', reportRoutes.router);
    if (ragRoutes?.router) app.use('/api/ai/rag', ragRoutes.router);
    if (aiOpsRoutes?.router) app.use('/api/ai/ops', aiOpsRoutes.router);
    if (copilotRoutes?.router) app.use('/api/copilot', copilotRoutes.router);

    // Dashboard y Twilio
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/twilio', twilioRoutes);

    // Logs API y dashboard HTML
    app.use('/api/logs', logRoutes);
    app.get('/logs', (req, res) => {
      logger.info('📊 Dashboard HTML solicitado desde:', { category: '_DASHBOARD_HTML_SOLICITADO_DES', ip: req.ip });
      const LogDashboardController = require('../controllers/LogDashboardController');
      return LogDashboardController.getDashboardHTML(req, res);
    });

    // Media proxy shortcuts públicos
    app.get('/media/proxy', (req, res) => {
      logger.debug('Redireccionando ruta de media', { category: 'MEDIA_PROXY', from: '/media/proxy', to: '/api/media/proxy-public' });
      req.url = '/api/media/proxy-public' + req.url.replace('/media/proxy', '');
      app._router.handle(req, res);
    });

    app.get('/test-media', (req, res) => {
      logger.debug('Test media endpoint solicitado', { category: 'TEST_ENDPOINT', endpoint: '/test-media' });
      res.status(200).json({ success: true, message: 'Test endpoint funcionando', timestamp: new Date().toISOString() });
    });

    app.get('/media/proxy-public', async (req, res) => {
      logger.info('Proxy público de media solicitado', { category: 'MEDIA_PROXY_PUBLIC', messageSid: req.query.messageSid, mediaSid: req.query.mediaSid, url: req.url, method: req.method });
      try {
        const messageSid = req.query.messageSid;
        const mediaSid = req.query.mediaSid;
        if (!messageSid || !mediaSid) {
          return res.status(400).json({ error: 'messageSid y mediaSid son requeridos' });
        }
        const MediaUploadController = require('../controllers/MediaUploadController');
        const mediaUploadController = new MediaUploadController();
        return await mediaUploadController.proxyTwilioMedia(req, res);
      } catch (error) {
        logger.error('Error en proxy público de media', { category: 'MEDIA_PROXY_ERROR', error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Error interno del servidor', message: error.message });
      }
    });

    app.get('/media/proxy-file-public/:fileId', (req, res) => {
      logger.info('🔄 Redirigiendo /media/proxy-file-public a /api/media/proxy-file-public', { category: '_REDIRIGIENDO_MEDIA_PROXY_FILE' });
      req.url = req.url.replace('/media/proxy-file-public', '/api/media/proxy-file-public');
      app._router.handle(req, res);
    });

    // Redirecciones de compatibilidad
    app.use('/conversations', (req, res) => {
      logger.info('🔄 Redirigiendo /conversations a /api/conversations', { category: '_REDIRIGIENDO_CONVERSATIONS_A_' });
      req.url = req.url.replace('/conversations', '/api/conversations');
      app._router.handle(req, res);
    });
    app.use('/contacts', (req, res) => {
      logger.info('🔄 Redirigiendo /contacts a /api/contacts', { category: '_REDIRIGIENDO_CONTACTS_A_API_C' });
      req.url = req.url.replace('/contacts', '/api/contacts');
      app._router.handle(req, res);
    });
    app.use('/messages', (req, res) => {
      logger.info('🔄 Redirigiendo /messages a /api/messages', { category: '_REDIRIGIENDO_MESSAGES_A_API_M' });
      req.url = req.url.replace('/messages', '/api/messages');
      app._router.handle(req, res);
    });

    // 404 catch-all
    app.use('*', (req, res) => {
      logger.warn('Ruta no encontrada', { category: 'ROUTE_NOT_FOUND', method: req.method, url: req.originalUrl, ip: req.ip, userAgent: req.headers['user-agent']?.substring(0, 100), requestId: req.requestId });
      res.status(404).json({ success: false, error: { type: 'NOT_FOUND_ERROR', code: 'ROUTE_NOT_FOUND', message: 'Ruta no encontrada', details: { method: req.method, path: req.originalUrl }, timestamp: new Date().toISOString() }, requestId: req.requestId });
    });

    const routeCount = app._router ? app._router.stack.length : 0;
    logger.info('✅ Rutas configuradas exitosamente', { category: 'ROUTES_SUCCESS', totalRoutes: routeCount });
  } catch (error) {
    logger.error('💥 ERROR CRÍTICO en registerRoutes:', { category: '_ERROR_CR_TICO_EN_SETUPROUTES_', error: error.message });
    app.get('/emergency', (req, res) => {
      res.status(200).json({ status: 'emergency_mode', error: 'Route configuration failed', timestamp: new Date().toISOString() });
    });
    throw error;
  }
}

module.exports = { registerRoutes }; 