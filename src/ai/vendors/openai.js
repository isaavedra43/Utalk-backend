/**
 * 🤖 WRAPPER OPENAI PROVIDER
 * 
 * Integración con OpenAI API para generación de texto
 * con timeouts, retries, rate limiting y guardrails.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

let OpenAI;
try {
  OpenAI = require('openai');
} catch (error) {
  // logger.warn('⚠️ Módulo OpenAI no disponible. Usando stub temporal.', { category: '_M_DULO_OPENAI_NO_DISPONIBLE_U' });
  OpenAI = null;
}

const logger = require('../../utils/logger');
const { aiLogger } = require('../../utils/aiLogger');

/**
 * Configuración por defecto del proveedor OpenAI
 */
const OPENAI_CONFIG = {
  timeout: 2000, // 2 segundos
  maxRetries: 1,
  backoffMs: 250,
  maxTokensOut: 150,
  maxOutputLength: 500,
  rateLimitPerMinute: 6,
  circuitBreakerThreshold: 0.1, // 10% error rate
  circuitBreakerWindow: 5 * 60 * 1000, // 5 minutos
};

/**
 * Circuit breaker para el proveedor
 */
class CircuitBreaker {
  constructor() {
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.isOpen = false;
  }

  recordSuccess() {
    this.successes++;
    this.failures = 0;
    this.isOpen = false;
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    const total = this.successes + this.failures;
    const errorRate = this.failures / total;
    
    if (errorRate > OPENAI_CONFIG.circuitBreakerThreshold) {
      this.isOpen = true;
      logger.warn('🚨 Circuit breaker abierto para OpenAI', {
        errorRate,
        failures: this.failures,
        successes: this.successes
      });
    }
  }

  isCircuitOpen() {
    if (!this.isOpen) return false;
    
    // Verificar si ha pasado el tiempo de ventana
    if (Date.now() - this.lastFailureTime > OPENAI_CONFIG.circuitBreakerWindow) {
      this.isOpen = false;
      logger.info('✅ Circuit breaker cerrado para OpenAI');
      return false;
    }
    
    return true;
  }

  getStats() {
    const total = this.successes + this.failures;
    return {
      isOpen: this.isOpen,
      errorRate: total > 0 ? this.failures / total : 0,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Instancia global del circuit breaker
const circuitBreaker = new CircuitBreaker();

/**
 * Rate limiter por conversación
 */
class RateLimiter {
  constructor() {
    this.requests = new Map(); // conversationId -> { count, lastReset }
  }

  canMakeRequest(conversationId) {
    const now = Date.now();
    const minute = 60 * 1000;
    
    if (!this.requests.has(conversationId)) {
      this.requests.set(conversationId, { count: 0, lastReset: now });
    }
    
    const request = this.requests.get(conversationId);
    
    // Resetear contador si ha pasado un minuto
    if (now - request.lastReset > minute) {
      request.count = 0;
      request.lastReset = now;
    }
    
    // Verificar límite
    if (request.count >= OPENAI_CONFIG.rateLimitPerMinute) {
      return false;
    }
    
    request.count++;
    return true;
  }

  getStats(conversationId) {
    const request = this.requests.get(conversationId);
    if (!request) return { count: 0, remaining: OPENAI_CONFIG.rateLimitPerMinute };
    
    const now = Date.now();
    const minute = 60 * 1000;
    
    if (now - request.lastReset > minute) {
      return { count: 0, remaining: OPENAI_CONFIG.rateLimitPerMinute };
    }
    
    return {
      count: request.count,
      remaining: OPENAI_CONFIG.rateLimitPerMinute - request.count
    };
  }
}

// Instancia global del rate limiter
const rateLimiter = new RateLimiter();

/**
 * Cliente OpenAI con configuración
 */
let openaiClient = null;

function initializeOpenAIClient() {
  try {
    // Verificar si OpenAI está disponible
    if (!OpenAI) {
      logger.warn('⚠️ Módulo OpenAI no disponible. Usando modo stub.');
      return false;
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      logger.error('❌ OPENAI_API_KEY no configurada');
      return false;
    }
    
    openaiClient = new OpenAI({
      apiKey: apiKey,
      timeout: OPENAI_CONFIG.timeout,
      maxRetries: 0 // Manejamos retries manualmente
    });
    
    logger.info('✅ Cliente OpenAI inicializado');
    return true;
    
  } catch (error) {
    logger.error('❌ Error inicializando cliente OpenAI', {
      error: error.message
    });
    return false;
  }
}

/**
 * Sanitizar salida del LLM
 */
function sanitizeOutput(text) {
  if (!text || typeof text !== 'string') {
    return { text: '', json: null };
  }
  
  // Recortar a máximo 500 caracteres
  let sanitizedText = text.substring(0, OPENAI_CONFIG.maxOutputLength);
  
  // Remover HTML peligroso
  sanitizedText = sanitizedText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  
  // Intentar parsear JSON si está presente
  let json = null;
  try {
    // Buscar JSON en el texto
    const jsonMatch = sanitizedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      json = JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    // Si no se puede parsear JSON, continuar con texto limpio
    logger.debug('JSON no parseable en salida del LLM', {
      text: sanitizedText.substring(0, 100)
    });
  }
  
  return {
    text: sanitizedText,
    json: json
  };
}

/**
 * Construir prompt dinámico con guardrails
 */
function buildPromptWithGuardrails(context, config) {
  const basePrompt = `Eres un asistente de atención al cliente profesional. 
  
Contexto de la conversación:
${context.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Último mensaje del cliente: "${context.messages[context.messages.length - 1]?.content || 'N/A'}"

Genera una respuesta sugerida para el agente que sea:
- Profesional y amigable
- Relevante al contexto de la conversación
- Máximo ${config.maxTokens} palabras
- En español
- DIRECTA al mensaje del cliente sin inventar conversaciones

GUARDRAILS IMPORTANTES:
- NO inventes precios, productos o servicios específicos
- Si falta información importante, pide UN SOLO dato específico
- Mantén un tono ${config.policies?.tono || 'profesional'}
- No uses lenguaje técnico complejo
- Sé conciso pero completo
- Responde DIRECTAMENTE al mensaje sin generar contexto ficticio

Respuesta sugerida:`;

  return basePrompt;
}

/**
 * Generar texto con OpenAI
 */
async function generateWithOpenAI(params) {
  const startTime = Date.now();
  
  try {
    const {
      model = 'gpt-4o-mini',
      prompt,
      temperature = 0.3,
      maxTokens = 150,
      workspaceId,
      conversationId
    } = params;

    // Verificar circuit breaker
    if (circuitBreaker.isCircuitOpen()) {
      return {
        ok: false,
        error: 'CIRCUIT_BREAKER_OPEN',
        message: 'Proveedor temporalmente no disponible',
        usage: {
          in: 0,
          out: 0,
          latencyMs: Date.now() - startTime
        }
      };
    }

    // Verificar rate limit
    if (!rateLimiter.canMakeRequest(conversationId)) {
      return {
        ok: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Límite de requests por minuto excedido',
        usage: {
          in: 0,
          out: 0,
          latencyMs: Date.now() - startTime
        }
      };
    }

    // Verificar cliente inicializado
    if (!openaiClient) {
      const initialized = initializeOpenAIClient();
      if (!initialized) {
        // Si OpenAI no está disponible, devolver respuesta stub
        logger.warn('⚠️ OpenAI no disponible, devolviendo respuesta stub', {
          workspaceId,
          conversationId,
          model
        });
        
        return {
          ok: true,
          text: 'Gracias por tu mensaje. Un agente te responderá pronto.',
          usage: {
            in: 0,
            out: 0,
            latencyMs: Date.now() - startTime,
            model: 'stub'
          }
        };
      }
    }

    // Aplicar clamps a parámetros
    const clampedTemperature = Math.max(0, Math.min(1, temperature));
    const clampedMaxTokens = Math.min(maxTokens, OPENAI_CONFIG.maxTokensOut);

    // Log de inicio
    aiLogger.logAIStart(workspaceId, 'openai_generate', {
      model,
      temperature: clampedTemperature,
      maxTokens: clampedMaxTokens,
      conversationId
    });

    // Realizar request con retry
    let response;
    let lastError;
    
    for (let attempt = 0; attempt <= OPENAI_CONFIG.maxRetries; attempt++) {
      try {
        response = await openaiClient.chat.completions.create({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'Eres un asistente de atención al cliente profesional y útil.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: clampedTemperature,
          max_tokens: clampedMaxTokens,
          timeout: OPENAI_CONFIG.timeout
        });
        
        break; // Éxito, salir del loop
        
      } catch (error) {
        lastError = error;
        
        if (attempt < OPENAI_CONFIG.maxRetries) {
          // Esperar antes del retry
          const delay = OPENAI_CONFIG.backoffMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          logger.warn('⚠️ Retry OpenAI request', {
            attempt: attempt + 1,
            error: error.message,
            conversationId
          });
        }
      }
    }

    // Si no hay respuesta después de todos los intentos
    if (!response) {
      circuitBreaker.recordFailure();
      
      return {
        ok: false,
        error: 'PROVIDER_ERROR',
        message: lastError?.message || 'Error desconocido del proveedor',
        usage: {
          in: 0,
          out: 0,
          latencyMs: Date.now() - startTime
        }
      };
    }

    // Procesar respuesta
    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage || {};
    
    // Sanitizar salida
    const sanitized = sanitizeOutput(content);
    
    // Calcular métricas
    const latencyMs = Date.now() - startTime;
    const tokensIn = usage.prompt_tokens || 0;
    const tokensOut = usage.completion_tokens || 0;
    
    // Registrar éxito
    circuitBreaker.recordSuccess();
    
    // Log de éxito
    await aiLogger.logAISuccess(workspaceId, 'openai_generate', {
      text: sanitized.text,
      json: sanitized.json
    }, {
      model,
      tokensIn,
      tokensOut,
      latencyMs,
      costUsd: estimateCost(tokensIn, tokensOut, model)
    });

    logger.info('✅ OpenAI request exitoso', {
      workspaceId,
      conversationId,
      model,
      tokensIn,
      tokensOut,
      latencyMs
    });

    return {
      ok: true,
      text: sanitized.text,
      json: sanitized.json,
      usage: {
        in: tokensIn,
        out: tokensOut,
        latencyMs
      }
    };

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    
    // Registrar fallo
    circuitBreaker.recordFailure();
    
    // Log de error
    aiLogger.logAIError(workspaceId || 'unknown', 'openai_generate', error, {
      latencyMs
    });

    logger.error('❌ Error en OpenAI request', {
      workspaceId,
      conversationId,
      error: error.message,
      latencyMs
    });

    return {
      ok: false,
      error: 'UNEXPECTED_ERROR',
      message: error.message,
      usage: {
        in: 0,
        out: 0,
        latencyMs
      }
    };
  }
}

/**
 * Estimar costo de la request
 */
function estimateCost(tokensIn, tokensOut, model) {
  const costs = {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
  };
  
  const modelCosts = costs[model] || costs['gpt-4o-mini'];
  const inputCost = (tokensIn / 1000) * modelCosts.input;
  const outputCost = (tokensOut / 1000) * modelCosts.output;
  
  return inputCost + outputCost;
}

/**
 * Obtener estadísticas del proveedor
 */
function getProviderStats() {
  return {
    circuitBreaker: circuitBreaker.getStats(),
    rateLimiter: {
      config: {
        maxRequestsPerMinute: OPENAI_CONFIG.rateLimitPerMinute
      }
    },
    config: OPENAI_CONFIG
  };
}

/**
 * Verificar salud del proveedor
 */
async function checkProviderHealth() {
  try {
    // Verificar si OpenAI está disponible
    if (!OpenAI) {
      return {
        ok: false,
        provider: 'openai',
        error: 'MODULE_NOT_AVAILABLE',
        message: 'Módulo OpenAI no disponible (pendiente instalación)'
      };
    }
    
    // Verificar inicialización
    if (!openaiClient) {
      const initialized = initializeOpenAIClient();
      if (!initialized) {
        return {
          ok: false,
          provider: 'openai',
          error: 'NOT_INITIALIZED',
          message: 'Cliente OpenAI no inicializado'
        };
      }
    }

    // Verificar circuit breaker
    if (circuitBreaker.isCircuitOpen()) {
      return {
        ok: false,
        provider: 'openai',
        error: 'CIRCUIT_BREAKER_OPEN',
        message: 'Circuit breaker abierto'
      };
    }

    // Test simple de conectividad
    const testResponse = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }],
      max_tokens: 5,
      timeout: 1000
    });

    return {
      ok: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      limits: {
        maxTokensOut: OPENAI_CONFIG.maxTokensOut,
        timeout: OPENAI_CONFIG.timeout,
        maxRetries: OPENAI_CONFIG.maxRetries
      },
      stats: getProviderStats()
    };

  } catch (error) {
    return {
      ok: false,
      provider: 'openai',
      error: 'HEALTH_CHECK_FAILED',
      message: error.message
    };
  }
}

module.exports = {
  generateWithOpenAI,
  checkProviderHealth,
  getProviderStats,
  initializeOpenAIClient,
  OPENAI_CONFIG,
  circuitBreaker,
  rateLimiter
};