/**
 * 🔧 VALIDADOR DE CONFIGURACIÓN IA
 * 
 * Valida configuración de IA propuesta con clamps automáticos
 * y validación opcional con IA.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('./logger');

// Importaciones condicionales para evitar errores en desarrollo
let validateAndClampConfig;
let generateWithProvider;

try {
  validateAndClampConfig = require('../config/aiConfig').validateAndClampConfig;
} catch (error) {
  logger.warn('⚠️ aiConfig no disponible, usando validación local', { error: error.message });
  validateAndClampConfig = null;
}

try {
  generateWithProvider = require('../ai/vendors').generateWithProvider;
} catch (error) {
  logger.warn('⚠️ AI vendors no disponible, usando validación local', { error: error.message });
  generateWithProvider = null;
}

/**
 * Validar configuración con IA (opcional)
 */
async function validateConfigWithAI(config) {
  try {
    // Verificar si AI vendors está disponible
    if (!generateWithProvider) {
      throw new Error('AI vendors no disponible');
    }

    // Validación asistida por IA es opcional y solo si hay OPENAI_API_KEY explícita
    if (!process.env.OPENAI_API_KEY || process.env.AI_CONFIG_VALIDATE_WITH_OPENAI !== 'true') {
      // Saltar validación con IA cuando no hay clave o no está habilitada por bandera
      throw new Error('AI validation disabled (no OPENAI_API_KEY or flag off)');
    }

    // Preparar prompt para validación
    const validationPrompt = `
Eres un validador de configuración de IA. Analiza la siguiente configuración y responde SOLO con un JSON válido en este formato exacto:

{
  "ok": true/false,
  "normalized": {config_clampeada},
  "warnings": ["warning1", "warning2"],
  "errors": ["error1", "error2"]
}

Configuración a validar:
${JSON.stringify(config, null, 2)}

Reglas de validación:
- temperature: 0-1
- maxTokens: 1-300
- provider: openai, anthropic, gemini
- defaultModel: debe ser válido para el provider
- flags: objeto con booleanos
- policies: objeto opcional

Responde SOLO con el JSON, sin texto adicional.
`;

    // Llamar a IA para validación
    const response = await generateWithProvider('openai', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un validador de configuración de IA. Responde SOLO con JSON válido.'
        },
        {
          role: 'user',
          content: validationPrompt
        }
      ],
      temperature: 0.1,
      maxTokens: 500,
      workspaceId: 'config_validation'
    });

    // Parsear respuesta JSON
    let validationResult;
    try {
      validationResult = JSON.parse(response.text);
    } catch (parseError) {
      throw new Error('Respuesta de IA no es JSON válido: ' + response.text);
    }

    // Validar estructura de respuesta
    if (typeof validationResult.ok !== 'boolean') {
      throw new Error('Respuesta de IA no contiene campo "ok" válido');
    }

    return validationResult;

  } catch (error) {
    logger.warn('⚠️ Validación con IA falló', {
      error: error.message,
      config: config
    });
    throw error;
  }
}

/**
 * Validar configuración localmente (fallback)
 */
function validateConfigLocally(config) {
  const warnings = [];
  const errors = [];
  let normalized = { ...config };

  // Validar provider
  if (normalized.provider) {
    if (!['openai', 'anthropic', 'gemini'].includes(normalized.provider)) {
      errors.push(`Proveedor "${normalized.provider}" no soportado`);
      normalized.provider = 'openai';
    }
  }

  // Validar modelos
  const supportedModels = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'],
    gemini: ['gemini-1.5-flash', 'gemini-1.5-pro']
  };

  if (normalized.defaultModel) {
    const provider = normalized.provider || 'openai';
    const models = supportedModels[provider] || [];
    
    if (!models.includes(normalized.defaultModel)) {
      warnings.push(`Modelo "${normalized.defaultModel}" no soportado para ${provider}`);
      normalized.defaultModel = models[0] || 'gpt-4o-mini';
    }
  }

  if (normalized.escalationModel) {
    const provider = normalized.provider || 'openai';
    const models = supportedModels[provider] || [];
    
    if (!models.includes(normalized.escalationModel)) {
      warnings.push(`Modelo de escalación "${normalized.escalationModel}" no soportado para ${provider}`);
      normalized.escalationModel = undefined;
    }
  }

  // Validar temperature
  if (normalized.temperature !== undefined) {
    const originalTemp = normalized.temperature;
    normalized.temperature = Math.max(0, Math.min(1, normalized.temperature));
    if (originalTemp !== normalized.temperature) {
      warnings.push(`Temperature ajustada de ${originalTemp} a ${normalized.temperature}`);
    }
  }

  // Validar maxTokens
  if (normalized.maxTokens !== undefined) {
    const originalTokens = normalized.maxTokens;
    normalized.maxTokens = Math.max(1, Math.min(300, normalized.maxTokens));
    if (originalTokens !== normalized.maxTokens) {
      warnings.push(`maxTokens ajustado de ${originalTokens} a ${normalized.maxTokens}`);
    }
  }

  // Validar flags
  if (normalized.flags && typeof normalized.flags === 'object') {
    const validFlags = ['suggestions', 'console', 'rag', 'reports', 'provider_ready'];
    for (const [key, value] of Object.entries(normalized.flags)) {
      if (!validFlags.includes(key)) {
        warnings.push(`Flag "${key}" no reconocido`);
        delete normalized.flags[key];
      } else if (typeof value !== 'boolean') {
        warnings.push(`Flag "${key}" debe ser booleano`);
        normalized.flags[key] = false;
      }
    }
  }

  // Validar policies
  if (normalized.policies && typeof normalized.policies === 'object') {
    if (normalized.policies.tono && !['profesional', 'amigable', 'formal'].includes(normalized.policies.tono)) {
      warnings.push(`Tono "${normalized.policies.tono}" no válido`);
      normalized.policies.tono = 'profesional';
    }

    if (normalized.policies.idioma && !['es', 'en'].includes(normalized.policies.idioma)) {
      warnings.push(`Idioma "${normalized.policies.idioma}" no válido`);
      normalized.policies.idioma = 'es';
    }
  }

  // Validar toolsEnabled
  if (normalized.toolsEnabled && Array.isArray(normalized.toolsEnabled)) {
    const validTools = ['crear_reporte', 'enviar_alerta', 'programar_followup'];
    const invalidTools = normalized.toolsEnabled.filter(tool => !validTools.includes(tool));
    
    if (invalidTools.length > 0) {
      warnings.push(`Herramientas no válidas: ${invalidTools.join(', ')}`);
      normalized.toolsEnabled = normalized.toolsEnabled.filter(tool => validTools.includes(tool));
    }
  }

  return {
    ok: errors.length === 0,
    normalized,
    warnings,
    errors
  };
}

module.exports = {
  validateConfigWithAI,
  validateConfigLocally
}; 