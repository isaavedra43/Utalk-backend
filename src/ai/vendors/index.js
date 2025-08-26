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
const llmStudioProvider = require('./llmStudio');
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
    // Habilitar solo si hay API key configurada
    enabled: !!process.env.OPENAI_API_KEY
  },
  llm_studio: {
    name: 'LLM Studio Local',
    module: llmStudioProvider,
    defaultModel: 'gpt-oss-20b',
    models: ['gpt-oss-20b', 'llama-3.1-8b', 'mistral-7b', 'codellama-7b'],
    // Habilitar por defecto si hay URL configurada o si la flag lo indica
    enabled: (process.env.LLM_STUDIO_ENABLED === 'true') || !!process.env.LLM_STUDIO_URL
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
function getProvider(providerName = 'llm_studio') {
  const provider = PROVIDERS[providerName];
  
  if (!provider) {
    logger.warn('⚠️ Proveedor no encontrado, usando proveedor recomendado por defecto', {
      requestedProvider: providerName
    });
    // Preferir LLM Studio si está disponible
    return PROVIDERS.llm_studio.enabled ? PROVIDERS.llm_studio : PROVIDERS.openai;
  }
  
  if (!provider.enabled) {
    logger.warn('⚠️ Proveedor deshabilitado, seleccionando alternativa disponible', {
      requestedProvider: providerName,
      reason: 'disabled'
    });
    return PROVIDERS.llm_studio.enabled ? PROVIDERS.llm_studio : PROVIDERS.openai;
  }
  
  if (!provider.module) {
    logger.warn('⚠️ Módulo de proveedor no implementado, seleccionando alternativa disponible', {
      requestedProvider: providerName,
      reason: 'not_implemented'
    });
    return PROVIDERS.llm_studio.enabled ? PROVIDERS.llm_studio : PROVIDERS.openai;
  }
  
  return provider;
}

/**
 * Generar texto con proveedor específico
 */
async function generateWithProvider(providerName, params) {
  const provider = getProvider(providerName);
  
  // Si es LLM Studio, usar función específica
  if (providerName === 'llm_studio' && provider.module) {
    return await provider.module.generateWithLLMStudio(params);
  }
  
  logger.info('🤖 Usando proveedor para generación', {
    provider: provider.name,
    model: params.model || provider.defaultModel,
    workspaceId: params.workspaceId
  });
  
  return await provider.module.generateWithOpenAI(params);
}

/**
 * Verificar salud de todos los proveedores
 */
async function checkAllProvidersHealth() {
  const healthResults = {};
  
  for (const [name, provider] of Object.entries(PROVIDERS)) {
    if (provider.enabled && provider.module) {
      try {
        if (name === 'llm_studio' && provider.module.checkLLMStudioHealth) {
          healthResults[name] = await provider.module.checkLLMStudioHealth();
        } else if (provider.module.checkProviderHealth) {
          healthResults[name] = await provider.module.checkProviderHealth();
        } else {
          healthResults[name] = {
            ok: false,
            provider: name,
            error: 'NO_HEALTH_CHECK',
            message: 'Método de health check no disponible'
          };
        }
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
  // Preferir LLM Studio si está habilitado; si no, OpenAI si está disponible
  if (PROVIDERS.llm_studio.enabled) return 'llm_studio';
  if (PROVIDERS.openai.enabled) return 'openai';
  // Fallback: devolver el primero habilitado
  const available = Object.entries(PROVIDERS).find(([, p]) => p.enabled && p.module);
  return available ? available[0] : 'llm_studio';
}

/**
 * Obtener estadísticas de todos los proveedores
 */
function getAllProvidersStats() {
  const stats = {};
  
  for (const [name, provider] of Object.entries(PROVIDERS)) {
    if (provider.enabled && provider.module) {
      if (name === 'llm_studio' && provider.module.getLLMStudioStats) {
        stats[name] = provider.module.getLLMStudioStats();
      } else if (provider.module.getProviderStats) {
        stats[name] = provider.module.getProviderStats();
      }
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