/**
 * 🎯 SISTEMA DE LOGGING AVANZADO - UTALK BACKEND
 * 
 * Sistema de logs estructurado y visual para monitoreo completo
 * Cubre todos los procesos críticos con logs concisos pero informativos
 */

// Colores para terminal (solo desarrollo)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

// Categorías de logs con iconos y colores
const LOG_CATEGORIES = {
  AUTH: { icon: '🔐', color: colors.cyan, level: 'AUTH' },
  SOCKET: { icon: '🔌', color: colors.blue, level: 'SOCKET' },
  MESSAGE: { icon: '💬', color: colors.green, level: 'MESSAGE' },
  WEBHOOK: { icon: '🔗', color: colors.magenta, level: 'WEBHOOK' },
  DATABASE: { icon: '💾', color: colors.yellow, level: 'DATABASE' },
  MEDIA: { icon: '📎', color: colors.cyan, level: 'MEDIA' },
  SECURITY: { icon: '🛡️', color: colors.red, level: 'SECURITY' },
  PERFORMANCE: { icon: '⚡', color: colors.yellow, level: 'PERFORMANCE' },
  ERROR: { icon: '❌', color: colors.red, level: 'ERROR' },
  WARNING: { icon: '⚠️', color: colors.yellow, level: 'WARNING' },
  SUCCESS: { icon: '✅', color: colors.green, level: 'SUCCESS' },
  INFO: { icon: 'ℹ️', color: colors.blue, level: 'INFO' },
  DEBUG: { icon: '🔍', color: colors.gray, level: 'DEBUG' },
  TWILIO: { icon: '📞', color: colors.magenta, level: 'TWILIO' },
  FIREBASE: { icon: '🔥', color: colors.yellow, level: 'FIREBASE' }
};

// Niveles de log
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class AdvancedLogger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = this.getLogLevel();
    this.requestId = null;
    this.userId = null;
  }

  /**
   * Obtener nivel de log desde variable de entorno
   */
  getLogLevel() {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    return LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.INFO;
  }

  /**
   * Crear contexto de request para tracking
   */
  createRequestContext(req) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const context = {
      requestId,
      method: req?.method,
      path: req?.path,
      userEmail: req?.user?.email,
      userRole: req?.user?.role,
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent']?.substring(0, 50)
    };
    
    // Almacenar en el request para uso posterior
    if (req) {
      req.logContext = context;
    }
    
    return context;
  }

  /**
   * Formatear mensaje de log con estructura visual
   */
  formatLog(category, level, message, data = {}, context = {}) {
    const timestamp = new Date().toISOString();
    const cat = LOG_CATEGORIES[category] || LOG_CATEGORIES.INFO;
    
    // Estructura base del log
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      category: cat.level,
      message,
      pid: process.pid,
      environment: process.env.NODE_ENV || 'development',
      ...context,
      ...data
    };

    // En producción, retornar JSON estructurado
    if (this.isProduction) {
      return JSON.stringify(logEntry);
    }

    // En desarrollo, formato visual mejorado
    const contextStr = context.requestId ? `[${context.requestId}]` : '';
    const userStr = context.userEmail ? `{${context.userEmail}}` : '';
    const dataStr = Object.keys(data).length > 0 
      ? `\n${colors.dim}   📊 ${JSON.stringify(data, null, 3)}${colors.reset}`
      : '';

    return `${colors.dim}[${timestamp}]${colors.reset} ${cat.color}${cat.icon} ${cat.level}${colors.reset}${contextStr}${userStr} ${message}${dataStr}`;
  }

  /**
   * Log genérico con nivel
   */
  log(level, category, message, data = {}, context = {}) {
    const numericLevel = LOG_LEVELS[level.toUpperCase()];
    if (numericLevel > this.logLevel) return;
    
    console.log(this.formatLog(category, level, message, data, context));
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🔐 LOGS DE AUTENTICACIÓN
  // ═══════════════════════════════════════════════════════════════════

  auth(action, data = {}, context = {}) {
    const actions = {
      login_attempt: { level: 'INFO', message: 'Intento de login' },
      login_success: { level: 'INFO', message: 'Login exitoso' },
      login_failed: { level: 'WARN', message: 'Login fallido' },
      token_generated: { level: 'INFO', message: 'Token JWT generado' },
      token_validated: { level: 'INFO', message: 'Token validado exitosamente' },
      token_invalid: { level: 'WARN', message: 'Token inválido o expirado' },
      token_missing: { level: 'WARN', message: 'Token faltante en request' },
      session_expired: { level: 'WARN', message: 'Sesión expirada' },
      logout: { level: 'INFO', message: 'Logout ejecutado' },
      user_inactive: { level: 'WARN', message: 'Usuario inactivo intentando acceder' },
      permission_denied: { level: 'WARN', message: 'Permiso denegado' },
      password_changed: { level: 'INFO', message: 'Contraseña cambiada' },
      user_created: { level: 'INFO', message: 'Usuario creado' }
    };

    const actionConfig = actions[action] || { level: 'INFO', message: action };
    this.log(actionConfig.level, 'AUTH', actionConfig.message, data, context);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🔌 LOGS DE SOCKET.IO
  // ═══════════════════════════════════════════════════════════════════

  socket(action, data = {}, context = {}) {
    const actions = {
      server_init: { level: 'INFO', message: 'Socket.IO server inicializado' },
      client_connected: { level: 'INFO', message: 'Cliente conectado' },
      client_disconnected: { level: 'INFO', message: 'Cliente desconectado' },
      auth_success: { level: 'INFO', message: 'Autenticación Socket.IO exitosa' },
      auth_failed: { level: 'WARN', message: 'Autenticación Socket.IO fallida' },
      room_joined: { level: 'INFO', message: 'Usuario unido a sala' },
      room_left: { level: 'INFO', message: 'Usuario salió de sala' },
      message_emitted: { level: 'INFO', message: 'Mensaje emitido via Socket.IO' },
      event_received: { level: 'DEBUG', message: 'Evento recibido' },
      rate_limit_exceeded: { level: 'WARN', message: 'Rate limit excedido' },
      connection_error: { level: 'ERROR', message: 'Error de conexión Socket.IO' },
      duplicate_session: { level: 'WARN', message: 'Sesión duplicada detectada' },
      invalid_room: { level: 'WARN', message: 'Intento de unirse a sala inválida' }
    };

    const actionConfig = actions[action] || { level: 'INFO', message: action };
    this.log(actionConfig.level, 'SOCKET', actionConfig.message, data, context);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 💬 LOGS DE MENSAJES
  // ═══════════════════════════════════════════════════════════════════

  message(action, data = {}, context = {}) {
    const actions = {
      received_inbound: { level: 'INFO', message: 'Mensaje entrante recibido' },
      sent_outbound: { level: 'INFO', message: 'Mensaje saliente enviado' },
      created: { level: 'INFO', message: 'Mensaje creado en BD' },
      updated: { level: 'INFO', message: 'Mensaje actualizado' },
      deleted: { level: 'INFO', message: 'Mensaje eliminado' },
      marked_read: { level: 'INFO', message: 'Mensaje marcado como leído' },
      validation_failed: { level: 'WARN', message: 'Validación de mensaje fallida' },
      duplicate_detected: { level: 'WARN', message: 'Mensaje duplicado detectado' },
      missing_content: { level: 'WARN', message: 'Mensaje sin contenido' },
      media_attached: { level: 'INFO', message: 'Media adjunta al mensaje' },
      processing_started: { level: 'INFO', message: 'Procesamiento de mensaje iniciado' },
      processing_completed: { level: 'INFO', message: 'Procesamiento completado' },
      delivery_failed: { level: 'ERROR', message: 'Fallo en entrega de mensaje' },
      search_executed: { level: 'INFO', message: 'Búsqueda de mensajes ejecutada' }
    };

    const actionConfig = actions[action] || { level: 'INFO', message: action };
    this.log(actionConfig.level, 'MESSAGE', actionConfig.message, data, context);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🔗 LOGS DE WEBHOOKS
  // ═══════════════════════════════════════════════════════════════════

  webhook(action, data = {}, context = {}) {
    const actions = {
      received: { level: 'INFO', message: 'Webhook recibido' },
      validated: { level: 'INFO', message: 'Webhook validado exitosamente' },
      validation_failed: { level: 'WARN', message: 'Validación de webhook fallida' },
      processed: { level: 'INFO', message: 'Webhook procesado exitosamente' },
      processing_failed: { level: 'ERROR', message: 'Error procesando webhook' },
      signature_invalid: { level: 'WARN', message: 'Firma de webhook inválida' },
      missing_data: { level: 'WARN', message: 'Datos faltantes en webhook' },
      duplicate_event: { level: 'WARN', message: 'Evento webhook duplicado' },
      verification: { level: 'INFO', message: 'Verificación de webhook' }
    };

    const actionConfig = actions[action] || { level: 'INFO', message: action };
    this.log(actionConfig.level, 'WEBHOOK', actionConfig.message, data, context);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 💾 LOGS DE BASE DE DATOS
  // ═══════════════════════════════════════════════════════════════════

  database(action, data = {}, context = {}) {
    const actions = {
      query_started: { level: 'DEBUG', message: 'Query iniciada' },
      query_completed: { level: 'DEBUG', message: 'Query completada' },
      query_slow: { level: 'WARN', message: 'Query lenta detectada' },
      query_failed: { level: 'ERROR', message: 'Query fallida' },
      connection_established: { level: 'INFO', message: 'Conexión a BD establecida' },
      connection_lost: { level: 'ERROR', message: 'Conexión a BD perdida' },
      document_created: { level: 'INFO', message: 'Documento creado' },
      document_updated: { level: 'INFO', message: 'Documento actualizado' },
      document_deleted: { level: 'INFO', message: 'Documento eliminado' },
      document_not_found: { level: 'WARN', message: 'Documento no encontrado' },
      batch_operation: { level: 'INFO', message: 'Operación en lote ejecutada' },
      transaction_started: { level: 'DEBUG', message: 'Transacción iniciada' },
      transaction_committed: { level: 'DEBUG', message: 'Transacción confirmada' },
      transaction_rolled_back: { level: 'WARN', message: 'Transacción revertida' }
    };

    const actionConfig = actions[action] || { level: 'INFO', message: action };
    this.log(actionConfig.level, 'DATABASE', actionConfig.message, data, context);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📎 LOGS DE MEDIA
  // ═══════════════════════════════════════════════════════════════════

  media(action, data = {}, context = {}) {
    const actions = {
      upload_started: { level: 'INFO', message: 'Carga de archivo iniciada' },
      upload_completed: { level: 'INFO', message: 'Archivo cargado exitosamente' },
      upload_failed: { level: 'ERROR', message: 'Error cargando archivo' },
      processing_started: { level: 'INFO', message: 'Procesamiento de media iniciado' },
      processing_completed: { level: 'INFO', message: 'Media procesada exitosamente' },
      processing_failed: { level: 'ERROR', message: 'Error procesando media' },
      transcription_started: { level: 'INFO', message: 'Transcripción iniciada' },
      transcription_completed: { level: 'INFO', message: 'Transcripción completada' },
      compression_applied: { level: 'INFO', message: 'Compresión aplicada' },
      format_converted: { level: 'INFO', message: 'Formato convertido' },
      file_deleted: { level: 'INFO', message: 'Archivo eliminado' },
      invalid_format: { level: 'WARN', message: 'Formato de archivo inválido' },
      size_exceeded: { level: 'WARN', message: 'Tamaño de archivo excedido' },
      whatsapp_compatible: { level: 'INFO', message: 'Archivo compatible con WhatsApp' },
      whatsapp_incompatible: { level: 'WARN', message: 'Archivo no compatible con WhatsApp' }
    };

    const actionConfig = actions[action] || { level: 'INFO', message: action };
    this.log(actionConfig.level, 'MEDIA', actionConfig.message, data, context);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📞 LOGS DE TWILIO
  // ═══════════════════════════════════════════════════════════════════

  twilio(action, data = {}, context = {}) {
    const actions = {
      service_init: { level: 'INFO', message: 'Servicio Twilio inicializado' },
      message_sent: { level: 'INFO', message: 'Mensaje enviado via Twilio' },
      message_failed: { level: 'ERROR', message: 'Error enviando mensaje Twilio' },
      webhook_verified: { level: 'INFO', message: 'Webhook Twilio verificado' },
      webhook_invalid: { level: 'WARN', message: 'Webhook Twilio inválido' },
      phone_validated: { level: 'INFO', message: 'Número de teléfono validado' },
      phone_invalid: { level: 'WARN', message: 'Número de teléfono inválido' },
      media_sent: { level: 'INFO', message: 'Media enviada via Twilio' },
      delivery_status: { level: 'INFO', message: 'Estado de entrega actualizado' },
      rate_limit_hit: { level: 'WARN', message: 'Rate limit de Twilio alcanzado' },
      config_error: { level: 'ERROR', message: 'Error de configuración Twilio' },
      connectivity_test: { level: 'INFO', message: 'Test de conectividad Twilio' }
    };

    const actionConfig = actions[action] || { level: 'INFO', message: action };
    this.log(actionConfig.level, 'TWILIO', actionConfig.message, data, context);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🔥 LOGS DE FIREBASE
  // ═══════════════════════════════════════════════════════════════════

  firebase(action, data = {}, context = {}) {
    const actions = {
      init_success: { level: 'INFO', message: 'Firebase inicializado exitosamente' },
      init_failed: { level: 'ERROR', message: 'Error inicializando Firebase' },
      storage_upload: { level: 'INFO', message: 'Archivo subido a Firebase Storage' },
      storage_download: { level: 'INFO', message: 'Archivo descargado de Firebase Storage' },
      storage_delete: { level: 'INFO', message: 'Archivo eliminado de Firebase Storage' },
      storage_error: { level: 'ERROR', message: 'Error en Firebase Storage' },
      firestore_read: { level: 'DEBUG', message: 'Lectura de Firestore' },
      firestore_write: { level: 'DEBUG', message: 'Escritura en Firestore' },
      firestore_error: { level: 'ERROR', message: 'Error en Firestore' },
      auth_token_verified: { level: 'INFO', message: 'Token Firebase verificado' },
      auth_token_invalid: { level: 'WARN', message: 'Token Firebase inválido' },
      bucket_access: { level: 'INFO', message: 'Acceso a bucket Firebase' }
    };

    const actionConfig = actions[action] || { level: 'INFO', message: action };
    this.log(actionConfig.level, 'FIREBASE', actionConfig.message, data, context);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🛡️ LOGS DE SEGURIDAD
  // ═══════════════════════════════════════════════════════════════════

  security(action, data = {}, context = {}) {
    const actions = {
      suspicious_activity: { level: 'WARN', message: 'Actividad sospechosa detectada' },
      brute_force_attempt: { level: 'WARN', message: 'Intento de fuerza bruta' },
      ip_blocked: { level: 'WARN', message: 'IP bloqueada' },
      invalid_signature: { level: 'WARN', message: 'Firma inválida detectada' },
      unauthorized_access: { level: 'WARN', message: 'Acceso no autorizado' },
      data_leak_prevented: { level: 'WARN', message: 'Fuga de datos prevenida' },
      encryption_applied: { level: 'INFO', message: 'Encriptación aplicada' },
      decryption_success: { level: 'INFO', message: 'Desencriptación exitosa' },
      certificate_validated: { level: 'INFO', message: 'Certificado validado' },
      security_scan: { level: 'INFO', message: 'Escaneo de seguridad ejecutado' }
    };

    const actionConfig = actions[action] || { level: 'INFO', message: action };
    this.log(actionConfig.level, 'SECURITY', actionConfig.message, data, context);
  }

  // ═══════════════════════════════════════════════════════════════════
  // ⚡ LOGS DE PERFORMANCE
  // ═══════════════════════════════════════════════════════════════════

  performance(action, data = {}, context = {}) {
    const actions = {
      request_slow: { level: 'WARN', message: 'Request lento detectado' },
      memory_high: { level: 'WARN', message: 'Uso alto de memoria' },
      cpu_high: { level: 'WARN', message: 'Uso alto de CPU' },
      cache_hit: { level: 'DEBUG', message: 'Cache hit' },
      cache_miss: { level: 'DEBUG', message: 'Cache miss' },
      optimization_applied: { level: 'INFO', message: 'Optimización aplicada' },
      bottleneck_detected: { level: 'WARN', message: 'Cuello de botella detectado' },
      threshold_exceeded: { level: 'WARN', message: 'Umbral de performance excedido' },
      monitoring_started: { level: 'INFO', message: 'Monitoreo de performance iniciado' },
      benchmark_completed: { level: 'INFO', message: 'Benchmark completado' }
    };

    const actionConfig = actions[action] || { level: 'INFO', message: action };
    this.log(actionConfig.level, 'PERFORMANCE', actionConfig.message, data, context);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎯 MÉTODOS DE CONVENIENCIA
  // ═══════════════════════════════════════════════════════════════════

  info(message, data = {}, context = {}) {
    this.log('INFO', 'INFO', message, data, context);
  }

  warn(message, data = {}, context = {}) {
    this.log('WARN', 'WARNING', message, data, context);
  }

  error(message, data = {}, context = {}) {
    this.log('ERROR', 'ERROR', message, data, context);
  }

  debug(message, data = {}, context = {}) {
    this.log('DEBUG', 'DEBUG', message, data, context);
  }

  success(message, data = {}, context = {}) {
    this.log('INFO', 'SUCCESS', message, data, context);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📊 LOGS DE REQUEST HTTP
  // ═══════════════════════════════════════════════════════════════════

  request(req, res, next) {
    const context = this.createRequestContext(req);
    const startTime = Date.now();
    
    // Log de inicio de request
    this.info('Request iniciado', {
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      authorization: req.headers.authorization ? 'presente' : 'ausente'
    }, context);

    // Interceptar respuesta
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      // Log de finalización de request
      logger.info('Request completado', {
        statusCode,
        duration: `${duration}ms`,
        contentLength: data ? data.length : 0,
        successful: statusCode < 400
      }, context);

      // Log de error si es necesario
      if (statusCode >= 400) {
        logger.warn('Request con error', {
          statusCode,
          duration: `${duration}ms`,
          errorType: statusCode >= 500 ? 'server_error' : 'client_error'
        }, context);
      }

      originalSend.call(this, data);
    };

    if (next) next();
    return context;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎯 UTILIDADES DE DEBUGGING
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Log para debugging con stack trace
   */
  debugWithStack(message, error = null, data = {}) {
    const stack = error ? error.stack : new Error().stack;
    this.debug(message, {
      ...data,
      stack: stack?.split('\n').slice(1, 4) // Solo primeras 3 líneas del stack
    });
  }

  /**
   * Log temporal para desarrollo (se auto-elimina en producción)
   */
  temp(message, data = {}) {
    if (!this.isProduction) {
      this.debug(`[TEMP] ${message}`, data);
    }
  }

  /**
   * Log de timing para medir performance
   */
  timing(label, startTime, data = {}) {
    const duration = Date.now() - startTime;
    this.performance('timing_measured', {
      label,
      duration: `${duration}ms`,
      slow: duration > 1000,
      ...data
    });
  }
}

// Crear instancia singleton
const logger = new AdvancedLogger();

module.exports = logger;
