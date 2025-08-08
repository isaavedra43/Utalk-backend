const baseWinstonLogger = require('./logger');

const UNIFIED_FLAG = '__isUnifiedRequestLogger';

function isWinstonLogger(candidate) {
  return !!candidate && typeof candidate.info === 'function' && typeof candidate.child === 'function';
}

function copyDomainMethods(target, source) {
  if (!source || typeof source !== 'object') return target;
  const domainKeys = [
    'database',
    'auth',
    'message',
    'media',
    'twilio',
    'socket',
    'security',
    'success',
    // 'error', // conflicto con winston.error: preservamos estándar
    // 'debug', // conflicto con winston.debug: preservamos estándar
  ];
  for (const key of domainKeys) {
    if (typeof source[key] === 'function') {
      target[key] = source[key].bind(source);
    }
  }
  return target;
}

function buildStdLogger(baseLogger, context) {
  const root = baseLogger || baseWinstonLogger;
  try {
    return root.child(context || {});
  } catch (_) {
    return root; // fallback defensivo
  }
}

function buildRequestLogger({ baseLogger = baseWinstonLogger, existing, context }) {
  // Idempotencia: si ya está unificado, retornar tal cual
  if (existing && existing[UNIFIED_FLAG]) {
    return existing;
  }

  // Caso 1: existing ya es Winston → child con contexto y copiar métodos de dominio si existieran
  if (isWinstonLogger(existing)) {
    const std = buildStdLogger(existing, context);
    std[UNIFIED_FLAG] = true;
    // Copiar métodos de dominio si existieran sobre el logger existente
    copyDomainMethods(std, existing);
    return std;
  }

  // Caso 2: existing es de dominio (no tiene .info) → construir std y mezclar métodos de dominio
  if (existing && typeof existing === 'object') {
    const std = buildStdLogger(baseLogger, context);
    const unified = {
      info: std.info.bind(std),
      warn: std.warn?.bind(std) || std.info.bind(std),
      error: std.error.bind(std),
      debug: std.debug?.bind(std) || std.info.bind(std),
      child: std.child.bind(std),
    };
    copyDomainMethods(unified, existing);
    Object.defineProperty(unified, UNIFIED_FLAG, { value: true, enumerable: false });
    return unified;
  }

  // Caso 3: no hay existing → usar baseLogger.child(context)
  const std = buildStdLogger(baseLogger, context);
  std[UNIFIED_FLAG] = true;
  return std;
}

module.exports = { buildRequestLogger }; 