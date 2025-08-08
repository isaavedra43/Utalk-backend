const { randomUUID } = require('crypto');
const baseLogger = require('../utils/logger');
const { buildRequestLogger } = require('../utils/requestLogger');

const HDR_REQ_ID = 'x-request-id';
const HDR_TRACE_ID = 'x-trace-id';

function mask(val) {
  if (!val) return null;
  // Enmascarado simple (no PII exacta), para logs de contexto
  if (typeof val === 'string' && val.includes('@')) {
    const [u, d] = val.split('@');
    return `${u.slice(0,3)}***@${d}`;
  }
  if (typeof val === 'string' && val.startsWith('+')) {
    return `${val.slice(0,3)}******${val.slice(-2)}`;
  }
  return typeof val === 'string' ? `${val.slice(0,3)}***${val.slice(-2)}` : null;
}

function correlationMiddleware(req, res, next) {
  const incomingReqId = req.get(HDR_REQ_ID);
  const incomingTraceId = req.get(HDR_TRACE_ID);
  const requestId = incomingReqId || randomUUID();
  const traceId = incomingTraceId || requestId; // primer requestId = traceId raíz

  // Adjuntar al request
  req.requestId = requestId;
  req.traceId = traceId;

  // Si tienes user en req.user, enmascara para logs
  const userCtx = req.user ? {
    userId: req.user.id || null,
    emailMasked: mask(req.user.email || null),
    workspaceIdMasked: mask(req.user.workspaceId || null),
    tenantIdMasked: mask(req.user.tenantId || null),
    role: req.user.role || null
  } : null;

  req.logContext = { requestId, traceId, userCtx };

  // Instalar accessor para unificar cualquier asignación posterior a req.logger
  const RAW_KEY = '__rawRequestLogger';
  const UNIFIED_KEY = '__unifiedRequestLogger';

  try {
    const desc = Object.getOwnPropertyDescriptor(req, 'logger');
    if (!desc || desc.configurable) {
      Object.defineProperty(req, 'logger', {
        configurable: true,
        enumerable: false,
        get() {
          return this[UNIFIED_KEY];
        },
        set(value) {
          this[RAW_KEY] = value;
          try {
            this[UNIFIED_KEY] = buildRequestLogger({
              baseLogger,
              existing: value,
              context: this.logContext
            });
          } catch (_) {
            this[UNIFIED_KEY] = buildRequestLogger({ baseLogger, existing: null, context: this.logContext });
          }
        }
      });
    }

    // Inicializar con el valor actual (puede ser undefined) para construir el unificado
    req.logger = req[RAW_KEY];
  } catch (_) {
    // fallback: asignación directa unificada si el accessor fallara
    try {
      req.logger = buildRequestLogger({ baseLogger, existing: req.logger, context: req.logContext });
    } catch (_) {}
  }

  // Headers de salida
  res.set(HDR_REQ_ID, requestId);
  res.set(HDR_TRACE_ID, traceId);

  next();
}

module.exports = { correlationMiddleware }; 