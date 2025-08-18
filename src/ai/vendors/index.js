/**
 * 🤖 INTERFAZ DE PROVEEDORES IA
 * 
 * Interfaz unificada para múltiples proveedores de LLM
 * con fallback y selección automática.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const openaiProvider = require('./openai');
const lmstudioProvider = require('./lmstudio');
const logger = require('../../utils/logger');

/**
 * Proveedores disponibles
 */
const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    module: openaiProvider,
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    enabled: true
  },
  lmstudio: {
    name: 'LM Studio',
    module: lmstudioProvider,
    defaultModel: 'local-model',
    models: ['local-model', 'llama-3.1-8b', 'mistral-7b', 'codellama-7b'],
    enabled: process.env.LM_STUDIO_ENABLED === 'true'
  },
  anthropic: {
    name: 'Anthropic',
    module: null, // TODO: Implementar en Fase C
    defaultModel: 'claude-3-haiku',
    models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'],
    enabled: false
  },
  gemini: {
    name: 'Google Gemini',
    module: null, // TODO: Implementar en Fase C
    defaultModel: 'gemini-1.5-flash',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
    enabled: false
  }
};

/**
 * Obtener proveedor por nombre
 */
function getProvider(providerName = 'openai') {
  const provider = PROVIDERS[providerName];
  
  if (!provider) {
    logger.warn('⚠️ Proveedor no encontrado, usando OpenAI por defecto', {
      requestedProvider: providerName
    });
    return PROVIDERS.openai;
  }
  
  if (!provider.enabled) {
    logger.warn('⚠️ Proveedor deshabilitado, usando OpenAI por defecto', {
      requestedProvider: providerName,
      reason: 'disabled'
    });
    return PROVIDERS.openai;
  }
  
  if (!provider.module) {
    logger.warn('⚠️ Módulo de proveedor no implementado, usando OpenAI por defecto', {
      requestedProvider: providerName,
      reason: 'not_implemented'
    });
    return PROVIDERS.openai;
  }
  
  return provider;
}

/**
 * Generar texto con proveedor específico
 */
async function generateWithProvider(providerName, params) {
  const provider = getProvider(providerName);
  
  logger.info('🤖 Usando proveedor para generación', {
    provider: provider.name,
    model: params.model || provider.defaultModel,
    workspaceId: params.workspaceId
  });
  
  // Usar método específico según el proveedor
  if (providerName === 'lmstudio') {
    return await provider.module.generateWithRetry(params.prompt, {
      maxTokens: params.maxTokens || 150,
      temperature: params.temperature || 0.3,
      model: params.model || provider.defaultModel,
      systemPrompt: params.systemPrompt
    });
  } else {
    return await provider.module.generateWithOpenAI(params);
  }
}

/**
 * Verificar salud de todos los proveedores
 */
async function checkAllProvidersHealth() {
  const healthResults = {};
  
  for (const [name, provider] of Object.entries(PROVIDERS)) {
    if (provider.enabled && provider.module) {
      try {
        healthResults[name] = await provider.module.checkProviderHealth();
      } catch (error) {
        healthResults[name] = {
          ok: false,
          provider: name,
          error: 'HEALTH_CHECK_ERROR',
          message: error.message
        };
      }
    } else {
      healthResults[name] = {
        ok: false,
        provider: name,
        error: 'PROVIDER_DISABLED',
        message: provider.enabled ? 'Módulo no implementado' : 'Proveedor deshabilitado'
      };
    }
  }
  
  return healthResults;
}

/**
 * Obtener proveedor recomendado basado en configuración
 */
function getRecommendedProvider(config) {
  // Por ahora, siempre usar OpenAI
  // En el futuro, se puede implementar lógica de selección
  return 'openai';
}

/**
 * Obtener estadísticas de todos los proveedores
 */
function getAllProvidersStats() {
  const stats = {};
  
  for (const [name, provider] of Object.entries(PROVIDERS)) {
    if (provider.enabled && provider.module && provider.module.getProviderStats) {
      stats[name] = provider.module.getProviderStats();
    }
  }
  
  return stats;
}

/**
 * Verificar si un proveedor está disponible
 */
function isProviderAvailable(providerName) {
  const provider = PROVIDERS[providerName];
  return provider && provider.enabled && provider.module;
}

/**
 * Obtener lista de proveedores disponibles
 */
function getAvailableProviders() {
  return Object.entries(PROVIDERS)
    .filter(([name, provider]) => isProviderAvailable(name))
    .map(([name, provider]) => ({
      name,
      displayName: provider.name,
      defaultModel: provider.defaultModel,
      models: provider.models
    }));
}

module.exports = {
  PROVIDERS,
  getProvider,
  generateWithProvider,
  checkAllProvidersHealth,
  getRecommendedProvider,
  getAllProvidersStats,
  isProviderAvailable,
  getAvailableProviders
};