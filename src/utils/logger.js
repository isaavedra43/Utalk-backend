/**
 * Logger mejorado con soporte específico para webhook debugging
 */
class Logger {
  static formatMessage (level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      pid: process.pid,
      environment: process.env.NODE_ENV || 'development',
      ...data,
    };

    // En producción, usar JSON estructurado
    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logEntry);
    }

    // En desarrollo, usar formato más legible
    const dataStr = Object.keys(data).length > 0
      ? `\n📊 Data: ${JSON.stringify(data, null, 2)}`
      : '';

    return `[${timestamp}] ${level.toUpperCase()}: ${message}${dataStr}`;
  }

  static info (message, data = {}) {
    console.log(this.formatMessage('info', message, data));
  }

  static error (message, data = {}) {
    console.error(this.formatMessage('error', message, data));
  }

  static warn (message, data = {}) {
    console.warn(this.formatMessage('warn', message, data));
  }

  static debug (message, data = {}) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  /**
   * Log específico para webhooks con datos estructurados
   */
  static webhook (event, data = {}) {
    this.info(`🔗 WEBHOOK: ${event}`, {
      webhook: true,
      event,
      ...data,
    });
  }

  /**
   * Log específico para mensajes de WhatsApp
   */
  static whatsapp (action, data = {}) {
    this.info(`💬 WHATSAPP: ${action}`, {
      whatsapp: true,
      action,
      ...data,
    });
  }

  /**
   * Log específico para errores de Twilio
   */
  static twilioError (error, context = {}) {
    this.error('❌ TWILIO ERROR', {
      twilio: true,
      error: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
      stack: error.stack,
      ...context,
    });
  }

  /**
   * Log específico para Firebase
   */
  static firebase (action, data = {}) {
    this.info(`🔥 FIREBASE: ${action}`, {
      firebase: true,
      action,
      ...data,
    });
  }

  /**
   * Log para performance monitoring
   */
  static performance (operation, duration, data = {}) {
    this.info(`⚡ PERFORMANCE: ${operation}`, {
      performance: true,
      operation,
      duration: `${duration}ms`,
      ...data,
    });
  }

  /**
   * Log para autenticación
   */
  static auth (action, data = {}) {
    this.info(`🔐 AUTH: ${action}`, {
      auth: true,
      action,
      // No loggear datos sensibles como tokens
      ...Object.fromEntries(
        Object.entries(data).filter(([key]) =>
          !['password', 'token', 'secret', 'key'].some(sensitive =>
            key.toLowerCase().includes(sensitive),
          ),
        ),
      ),
    });
  }

  /**
   * Log para requests HTTP con rate limiting info
   */
  static request (req, res) {
    const duration = res.locals.startTime ? Date.now() - res.locals.startTime : 0;

    this.info(`🌐 REQUEST: ${req.method} ${req.path}`, {
      request: true,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.uid,
      // Headers específicos de Twilio
      twilioSignature: req.headers['x-twilio-signature'] ? 'presente' : 'ausente',
    });
  }
}

module.exports = Logger;
