/**
 * 🏠 LLM STUDIO PROVIDER
 * 
 * Integración con LLM Studio local para generación de texto
 * con timeouts, retries y configuración flexible.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const axios = require('axios');
const http = require('http');
const https = require('https');
const logger = require('../../utils/logger');
const { aiLogger } = require('../../utils/aiLogger');

/**
 * Configuración por defecto del proveedor LLM Studio
 */
const LLM_STUDIO_CONFIG = {
  baseURL: process.env.LLM_STUDIO_URL || 'http://localhost:3001',
  timeout: 10000, // 10 segundos (más tiempo para modelos locales)
  maxRetries: 2,
  backoffMs: 500,
  maxTokensOut: 500, // Más tokens para modelos locales
  maxOutputLength: 2000,
  rateLimitPerMinute: 10, // Más requests para local
  circuitBreakerThreshold: 0.2, // 20% error rate
  circuitBreakerWindow: 5 * 60 * 1000, // 5 minutos
  defaultModel: 'gpt-oss-20b', // Modelo por defecto
  availableModels: [
    'gpt-oss-20b',
    'llama-3.1-8b',
    'mistral-7b',
    'codellama-7b'
  ],
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20
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
    if (this.failures > 0) {
      this.failures = 0;
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    const totalRequests = this.successes + this.failures;
    const errorRate = this.failures / totalRequests;
    
    if (errorRate > LLM_STUDIO_CONFIG.circuitBreakerThreshold && totalRequests > 5) {
      this.isOpen = true;
      logger.warn('🚨 Circuit breaker abierto para LLM Studio', {
        errorRate: errorRate.toFixed(2),
        failures: this.failures,
        totalRequests
      });
    }
  }

  isCircuitOpen() {
    if (!this.isOpen) {
      return false;
    }
    
    // Intentar resetear después de 30 segundos
    if (Date.now() - this.lastFailureTime > 30000) {
      this.isOpen = false;
      this.failures = 0;
      logger.info('🔄 Circuit breaker reseteado para LLM Studio');
      return false;
    }
    
    return true;
  }

  getStats() {
    const totalRequests = this.successes + this.failures;
    return {
      isOpen: this.isOpen,
      successRate: totalRequests > 0 ? (this.successes / totalRequests * 100).toFixed(1) : '0.0',
      totalRequests,
      failures: this.failures,
      successes: this.successes
    };
  }
}

// Instancia global del circuit breaker
const circuitBreaker = new CircuitBreaker();

/**
 * Rate limiter para LLM Studio
 */
class RateLimiter {
  constructor() {
    this.requests = new Map();
  }

  canMakeRequest(conversationId) {
    const now = Date.now();
    const minuteAgo = now - 60000;
    
    if (!this.requests.has(conversationId)) {
      this.requests.set(conversationId, []);
    }
    
    const requests = this.requests.get(conversationId);
    
    // Limpiar requests antiguos
    const recentRequests = requests.filter(time => time > minuteAgo);
    this.requests.set(conversationId, recentRequests);
    
    if (recentRequests.length >= LLM_STUDIO_CONFIG.rateLimitPerMinute) {
      return false;
    }
    
    recentRequests.push(now);
    return true;
  }

  getStats(conversationId) {
    const requests = this.requests.get(conversationId) || [];
    const now = Date.now();
    const minuteAgo = now - 60000;
    const recentRequests = requests.filter(time => time > minuteAgo);
    
    return {
      recentRequests: recentRequests.length,
      remaining: LLM_STUDIO_CONFIG.rateLimitPerMinute - recentRequests.length
    };
  }
}

// Instancia global del rate limiter
const rateLimiter = new RateLimiter();

/**
 * Cliente HTTP para LLM Studio
 */
let llmStudioClient = null;

function initializeLLMStudioClient() {
  try {
    if (!process.env.LLM_STUDIO_URL && !LLM_STUDIO_CONFIG.baseURL) {
      logger.warn('⚠️ LLM_STUDIO_URL no configurada, usando localhost:3001');
    }

    const isHttps = String(LLM_STUDIO_CONFIG.baseURL).startsWith('https');
    const agentOptions = {
      keepAlive: LLM_STUDIO_CONFIG.keepAlive,
      maxSockets: LLM_STUDIO_CONFIG.maxSockets,
      maxFreeSockets: LLM_STUDIO_CONFIG.maxFreeSockets,
      keepAliveMsecs: 10000
    };

    llmStudioClient = axios.create({
      baseURL: LLM_STUDIO_CONFIG.baseURL,
      timeout: LLM_STUDIO_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'UTalk-Backend/1.0.0'
      },
      httpAgent: isHttps ? undefined : new http.Agent(agentOptions),
      httpsAgent: isHttps ? new https.Agent(agentOptions) : undefined
    });

    logger.info('✅ Cliente LLM Studio inicializado', {
      baseURL: LLM_STUDIO_CONFIG.baseURL,
      keepAlive: LLM_STUDIO_CONFIG.keepAlive,
      maxSockets: LLM_STUDIO_CONFIG.maxSockets
    });
    return true;

  } catch (error) {
    logger.error('❌ Error inicializando cliente LLM Studio', {
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
    return 'Respuesta no válida del modelo local.';
  }
  
  // Limitar longitud
  if (text.length > LLM_STUDIO_CONFIG.maxOutputLength) {
    text = text.substring(0, LLM_STUDIO_CONFIG.maxOutputLength) + '...';
  }
  
  // Remover caracteres problemáticos
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return text.trim();
}

/**
 * Construir prompt con guardrails
 */
function buildPromptWithGuardrails(context, config) {
  const basePrompt = `
Eres un asistente de IA para un sistema de mensajería empresarial. Tu tarea es generar sugerencias de respuesta para agentes humanos.

CONTEXTO DE LA CONVERSACIÓN:
${context.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

INSTRUCCIONES:
- Genera una respuesta profesional y útil
- Mantén un tono ${config.policies?.tono || 'profesional'}
- Responde en ${config.policies?.idioma || 'español'}
- No inventes información que no esté en el contexto
- Sé conciso pero completo
- Máximo ${config.maxTokens} tokens

RESPUESTA:
`;

  return basePrompt;
}

/**
 * Generar texto con LLM Studio
 */
async function generateWithLLMStudio(params) {
  const startTime = Date.now();
  
  try {
    const {
      model = LLM_STUDIO_CONFIG.defaultModel,
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
        message: 'LLM Studio temporalmente no disponible',
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
    if (!llmStudioClient) {
      const initialized = initializeLLMStudioClient();
      if (!initialized) {
        logger.error('❌ LLM Studio no disponible', {
          workspaceId,
          conversationId,
          model
        });
        
        return {
          ok: false,
          error: 'LLM_STUDIO_NOT_AVAILABLE',
          message: 'LLM Studio no está disponible',
          usage: {
            in: 0,
            out: 0,
            latencyMs: Date.now() - startTime
          }
        };
      }
    }

    // Aplicar clamps a parámetros
    const clampedTemperature = Math.max(0, Math.min(1, temperature));
    const clampedMaxTokens = Math.min(maxTokens, LLM_STUDIO_CONFIG.maxTokensOut);

    // Validar workspaceId antes de usar
    const validWorkspaceId = workspaceId || 'default_workspace';

    // Log de inicio
    aiLogger.logAIStart(validWorkspaceId, 'llm_studio_generate', {
      model,
      temperature: clampedTemperature,
      maxTokens: clampedMaxTokens,
      conversationId
    });

    // Preparar payload para LLM Studio
    const payload = {
      model: model,
      prompt: prompt,
      temperature: clampedTemperature,
      max_tokens: clampedMaxTokens,
      stop: ['\n\n', 'Human:', 'Assistant:'],
      stream: false
    };

    // Realizar request con retry
    let response;
    let lastError;
    
    for (let attempt = 0; attempt <= LLM_STUDIO_CONFIG.maxRetries; attempt++) {
      try {
        response = await llmStudioClient.post('/v1/completions', payload);
        break;
      } catch (error) {
        lastError = error;
        
        if (attempt < LLM_STUDIO_CONFIG.maxRetries) {
          const delay = LLM_STUDIO_CONFIG.backoffMs * Math.pow(2, attempt);
          logger.warn('⚠️ Retry LLM Studio request', {
            attempt: attempt + 1,
            delay,
            error: error.message
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!response) {
      circuitBreaker.recordFailure();
      throw lastError || new Error('LLM Studio request failed');
    }

    // Procesar respuesta
    const responseText = response.data?.choices?.[0]?.text;
    if (!responseText) {
      throw new Error('Respuesta inválida de LLM Studio');
    }

    const sanitizedText = sanitizeOutput(responseText);
    const latencyMs = Date.now() - startTime;

    // Calcular tokens (estimación)
    const estimatedTokensIn = Math.ceil(prompt.length / 4);
    const estimatedTokensOut = Math.ceil(sanitizedText.length / 4);

    // Registrar éxito
    circuitBreaker.recordSuccess();
    aiLogger.logAISuccess(validWorkspaceId, 'llm_studio_generate', {
      model,
      tokensIn: estimatedTokensIn,
      tokensOut: estimatedTokensOut,
      latencyMs,
      conversationId
    });

    logger.info('✅ LLM Studio generación exitosa', {
      workspaceId: validWorkspaceId,
      conversationId,
      model,
      tokensIn: estimatedTokensIn,
      tokensOut: estimatedTokensOut,
      latencyMs
    });

    return {
      ok: true,
      text: sanitizedText,
      usage: {
        in: estimatedTokensIn,
        out: estimatedTokensOut,
        latencyMs,
        model: model
      }
    };

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    
    circuitBreaker.recordFailure();
    aiLogger.logAIError(validWorkspaceId, 'llm_studio_generate', {
      error: error.message,
      latencyMs,
      conversationId: params.conversationId
    });

    logger.error('❌ Error en LLM Studio', {
      workspaceId: validWorkspaceId,
      conversationId: params.conversationId,
      model: params.model,
      error: error.message,
      latencyMs
    });

    return {
      ok: false,
      error: 'LLM_STUDIO_ERROR',
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
 * Verificar salud del servicio
 */
async function checkLLMStudioHealth() {
  try {
    if (!llmStudioClient) {
      const initialized = initializeLLMStudioClient();
      if (!initialized) {
        return {
          status: 'unavailable',
          error: 'Cliente no inicializado'
        };
      }
    }

    const response = await llmStudioClient.get('/health', { timeout: 5000 });
    
    return {
      status: 'healthy',
      version: response.data?.version || 'unknown',
      models: response.data?.models || LLM_STUDIO_CONFIG.availableModels
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

/**
 * Obtener estadísticas del proveedor
 */
function getLLMStudioStats() {
  return {
    provider: 'llm_studio',
    circuitBreaker: circuitBreaker.getStats(),
    config: {
      baseURL: LLM_STUDIO_CONFIG.baseURL,
      timeout: LLM_STUDIO_CONFIG.timeout,
      maxRetries: LLM_STUDIO_CONFIG.maxRetries,
      rateLimitPerMinute: LLM_STUDIO_CONFIG.rateLimitPerMinute
    },
    availableModels: LLM_STUDIO_CONFIG.availableModels
  };
}

module.exports = {
  LLM_STUDIO_CONFIG,
  generateWithLLMStudio,
  checkLLMStudioHealth,
  getLLMStudioStats,
  circuitBreaker,
  rateLimiter
}; 