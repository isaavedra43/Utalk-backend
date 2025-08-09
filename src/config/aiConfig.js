/**
 * 🤖 CONFIGURACIÓN IA CENTRALIZADA
 * 
 * Maneja configuración de IA por workspace con validaciones
 * y valores por defecto. Se lee desde .env y base de datos.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Configuración por defecto para IA
 */
const DEFAULT_AI_CONFIG = {
  ai_enabled: false,
  defaultModel: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 150,
  flags: {
    suggestions: false,
    rag: false,
    reports: false,
    console: false
  },
  policies: {
    no_inventar_precios: true,
    tono: 'profesional',
    idioma: 'es'
  },
  limits: {
    maxContextMessages: 20,
    maxResponseLength: 300,
    maxLatencyMs: 5000
  }
};

/**
 * Validaciones de configuración IA
 */
const AI_VALIDATIONS = {
  temperature: { min: 0, max: 1, type: 'number' },
  maxTokens: { min: 1, max: 300, type: 'number' },
  maxContextMessages: { min: 1, max: 50, type: 'number' },
  maxResponseLength: { min: 1, max: 1000, type: 'number' },
  maxLatencyMs: { min: 100, max: 30000, type: 'number' }
};

/**
 * Modelos soportados
 */
const SUPPORTED_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-3.5-turbo',
  'claude-3-haiku',
  'claude-3-sonnet',
  'gemini-1.5-flash'
];

/**
 * Validar y aplicar clamps a valores de configuración
 */
function validateAndClampConfig(config) {
  const validated = { ...config };

  // Validar temperature
  if (validated.temperature !== undefined) {
    validated.temperature = Math.max(0, Math.min(1, validated.temperature));
  }

  // Validar maxTokens
  if (validated.maxTokens !== undefined) {
    validated.maxTokens = Math.max(1, Math.min(300, validated.maxTokens));
  }

  // Validar maxContextMessages
  if (validated.limits?.maxContextMessages !== undefined) {
    validated.limits.maxContextMessages = Math.max(1, Math.min(50, validated.limits.maxContextMessages));
  }

  // Validar maxResponseLength
  if (validated.limits?.maxResponseLength !== undefined) {
    validated.limits.maxResponseLength = Math.max(1, Math.min(1000, validated.limits.maxResponseLength));
  }

  // Validar maxLatencyMs
  if (validated.limits?.maxLatencyMs !== undefined) {
    validated.limits.maxLatencyMs = Math.max(100, Math.min(30000, validated.limits.maxLatencyMs));
  }

  // Validar modelo
  if (validated.defaultModel && !SUPPORTED_MODELS.includes(validated.defaultModel)) {
    validated.defaultModel = DEFAULT_AI_CONFIG.defaultModel;
  }

  return validated;
}

/**
 * Obtener configuración IA por workspace
 */
async function getAIConfig(workspaceId) {
  try {
    // Intentar obtener de Firestore
    const configDoc = await firestore
      .collection('ai_configs')
      .doc(workspaceId)
      .get();

    if (configDoc.exists) {
      const config = configDoc.data();
      return validateAndClampConfig({
        ...DEFAULT_AI_CONFIG,
        ...config,
        workspaceId
      });
    }

    // Si no existe, crear configuración por defecto
    const defaultConfig = {
      ...DEFAULT_AI_CONFIG,
      workspaceId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await firestore
      .collection('ai_configs')
      .doc(workspaceId)
      .set(defaultConfig);

    logger.info('✅ Configuración IA por defecto creada', {
      workspaceId,
      config: defaultConfig
    });

    return defaultConfig;

  } catch (error) {
    logger.error('❌ Error obteniendo configuración IA', {
      workspaceId,
      error: error.message
    });

    // Fallback a configuración por defecto
    return {
      ...DEFAULT_AI_CONFIG,
      workspaceId,
      error: 'fallback_to_default'
    };
  }
}

/**
 * Actualizar configuración IA por workspace
 */
async function updateAIConfig(workspaceId, updates) {
  try {
    // Obtener configuración actual
    const currentConfig = await getAIConfig(workspaceId);

    // Validar y aplicar clamps
    const validatedUpdates = validateAndClampConfig(updates);

    // Preparar configuración actualizada
    const updatedConfig = {
      ...currentConfig,
      ...validatedUpdates,
      workspaceId,
      updatedAt: new Date()
    };

    // Guardar en Firestore
    await firestore
      .collection('ai_configs')
      .doc(workspaceId)
      .set(updatedConfig, { merge: true });

    logger.info('✅ Configuración IA actualizada', {
      workspaceId,
      updates: validatedUpdates,
      previousConfig: currentConfig
    });

    return updatedConfig;

  } catch (error) {
    logger.error('❌ Error actualizando configuración IA', {
      workspaceId,
      updates,
      error: error.message
    });
    throw error;
  }
}

/**
 * Verificar si IA está habilitada para un workspace
 */
async function isAIEnabled(workspaceId) {
  try {
    const config = await getAIConfig(workspaceId);
    return config.ai_enabled === true;
  } catch (error) {
    logger.warn('⚠️ Error verificando estado IA, asumiendo deshabilitado', {
      workspaceId,
      error: error.message
    });
    return false;
  }
}

/**
 * Obtener configuración desde variables de entorno
 */
function getEnvAIConfig() {
  return {
    ai_enabled: process.env.AI_ENABLED === 'true',
    defaultModel: process.env.AI_MODEL || DEFAULT_AI_CONFIG.defaultModel,
    temperature: parseFloat(process.env.AI_TEMPERATURE) || DEFAULT_AI_CONFIG.temperature,
    maxTokens: parseInt(process.env.AI_MAX_TOKENS) || DEFAULT_AI_CONFIG.maxTokens,
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY
  };
}

module.exports = {
  DEFAULT_AI_CONFIG,
  AI_VALIDATIONS,
  SUPPORTED_MODELS,
  validateAndClampConfig,
  getAIConfig,
  updateAIConfig,
  isAIEnabled,
  getEnvAIConfig
};