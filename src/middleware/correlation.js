const { randomUUID } = require('crypto');

const HDR_REQ_ID = 'x-request-id';
const HDR_TRACE_ID = 'x-trace-id';

function mask(val) {
  if (!val) return null;
  // Enmascarado simple (no PII exacta), para logs de contexto
  if (val.includes('@')) {
    const [u, d] = val.split('@');
    return `${u.slice(0,3)}***@${d}`;
  }
  if (val.startsWith('+')) {
    return `${val.slice(0,3)}******${val.slice(-2)}`;
  }
  return `${val.slice(0,3)}***${val.slice(-2)}`;
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

  // Headers de salida
  res.set(HDR_REQ_ID, requestId);
  res.set(HDR_TRACE_ID, traceId);

  // Si tienes logger con child, crea uno con contexto
  if (req.logger?.child) {
    req.logger = req.logger.child({ requestId, traceId });
  }

  next();
}

module.exports = { correlationMiddleware }; 