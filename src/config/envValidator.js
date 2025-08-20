/**
 * 🔧 VALIDADOR DE VARIABLES DE ENTORNO CENTRALIZADO
 * 
 * Elimina la configuración fragmentada y proporciona validación robusta
 * con fallbacks apropiados para desarrollo y producción.
 */

const logger = require('../utils/logger');

/**
 * Configuración de variables de entorno requeridas y opcionales
 */
const ENV_CONFIG = {
  // 🔐 CRÍTICAS - Sin estas la app no funciona
  CRITICAL: {
    JWT_SECRET: {
      required: true,
      description: 'Secret para firmar JWT tokens',
      validation: (value) => value && value.length >= 32,
      errorMessage: 'JWT_SECRET debe tener al menos 32 caracteres'
    },
    PORT: {
      required: true,
      description: 'Puerto del servidor',
      validation: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0,
      errorMessage: 'PORT debe ser un número válido mayor a 0',
      fallback: '3000'
    }
  },

  // 🔑 IMPORTANTES - Funcionalidad limitada sin estas
  IMPORTANT: {
    FIREBASE_PROJECT_ID: {
      required: false,
      description: 'ID del proyecto Firebase',
      validation: (value) => !value || (typeof value === 'string' && value.length > 0),
      errorMessage: 'FIREBASE_PROJECT_ID debe ser un string válido'
    },
    FIREBASE_PRIVATE_KEY: {
      required: false,
      description: 'Clave privada de Firebase',
      validation: (value) => !value || (typeof value === 'string' && value.includes('-----BEGIN PRIVATE KEY-----')),
      errorMessage: 'FIREBASE_PRIVATE_KEY debe ser una clave privada válida'
    },
    TWILIO_ACCOUNT_SID: {
      required: false,
      description: 'Account SID de Twilio',
      validation: (value) => !value || (typeof value === 'string' && value.startsWith('AC')),
      errorMessage: 'TWILIO_ACCOUNT_SID debe empezar con AC'
    },
    TWILIO_AUTH_TOKEN: {
      required: false,
      description: 'Auth Token de Twilio',
      validation: (value) => !value || (typeof value === 'string' && value.length > 0),
      errorMessage: 'TWILIO_AUTH_TOKEN debe ser un string válido'
    }
  },

  // ⚙️ OPCIONALES - Con fallbacks apropiados
  OPTIONAL: {
    NODE_ENV: {
      required: false,
      description: 'Entorno de ejecución',
      validation: (value) => !value || ['development', 'production', 'test'].includes(value),
      errorMessage: 'NODE_ENV debe ser development, production o test',
      fallback: 'development'
    },
    LOG_LEVEL: {
      required: false,
      description: 'Nivel de logging',
      validation: (value) => !value || ['error', 'warn', 'info', 'debug'].includes(value),
      errorMessage: 'LOG_LEVEL debe ser error, warn, info o debug',
      fallback: 'info'
    },
    WORKSPACE_ID: {
      required: false,
      description: 'ID del workspace por defecto',
      validation: (value) => !value || (typeof value === 'string' && value.length > 0),
      errorMessage: 'WORKSPACE_ID debe ser un string válido',
      fallback: 'default_workspace'
    },
    TENANT_ID: {
      required: false,
      description: 'ID del tenant por defecto',
      validation: (value) => !value || (typeof value === 'string' && value.length > 0),
      errorMessage: 'TENANT_ID debe ser un string válido',
      fallback: 'default_tenant'
    }
  }
};

/**
 * Validador de configuración de entorno
 */
class EnvValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.config = {};
  }

  /**
   * Validar todas las variables de entorno
   */
  validate() {
    logger.info('🔧 Iniciando validación de variables de entorno', {
      category: 'ENV_VALIDATION'
    });

    this.errors = [];
    this.warnings = [];
    this.config = {};

    // Validar variables críticas
    this.validateCategory('CRITICAL', ENV_CONFIG.CRITICAL);
    
    // Validar variables importantes
    this.validateCategory('IMPORTANT', ENV_CONFIG.IMPORTANT);
    
    // Validar variables opcionales
    this.validateCategory('OPTIONAL', ENV_CONFIG.OPTIONAL);

    // Reportar resultados
    this.reportResults();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      config: this.config
    };
  }

  /**
   * Validar una categoría de variables
   */
  validateCategory(category, variables) {
    logger.debug(`Validando categoría: ${category}`, {
      category: 'ENV_VALIDATION',
      variableCount: Object.keys(variables).length
    });

    for (const [key, config] of Object.entries(variables)) {
      const value = process.env[key];
      
      // Verificar si es requerida
      if (config.required && !value) {
        this.errors.push({
          variable: key,
          category,
          message: `${key} es requerida: ${config.description}`,
          severity: 'CRITICAL'
        });
        continue;
      }

      // Si no hay valor y no es requerida, usar fallback
      if (!value && config.fallback !== undefined) {
        this.config[key] = config.fallback;
        logger.info(`Usando fallback para ${key}: ${config.fallback}`, {
          category: 'ENV_VALIDATION',
          variable: key
        });
        continue;
      }

      // Si no hay valor y no hay fallback, saltar
      if (!value) {
        logger.debug(`Variable ${key} no configurada (opcional)`, {
          category: 'ENV_VALIDATION',
          variable: key
        });
        continue;
      }

      // Validar valor
      try {
        if (config.validation && !config.validation(value)) {
          this.errors.push({
            variable: key,
            category,
            message: config.errorMessage,
            severity: category === 'CRITICAL' ? 'CRITICAL' : 'WARNING'
          });
          continue;
        }
      } catch (error) {
        this.errors.push({
          variable: key,
          category,
          message: `Error validando ${key}: ${error.message}`,
          severity: 'CRITICAL'
        });
        continue;
      }

      // Valor válido
      this.config[key] = value;
      logger.debug(`Variable ${key} validada correctamente`, {
        category: 'ENV_VALIDATION',
        variable: key
      });
    }
  }

  /**
   * Reportar resultados de validación
   */
  reportResults() {
    if (this.errors.length > 0) {
      logger.error('❌ Errores de validación de entorno', {
        category: 'ENV_VALIDATION_ERROR',
        errorCount: this.errors.length,
        errors: this.errors.map(e => `${e.variable}: ${e.message}`)
      });

      // Log detallado de errores críticos
      const criticalErrors = this.errors.filter(e => e.severity === 'CRITICAL');
      if (criticalErrors.length > 0) {
        logger.error('🚨 ERRORES CRÍTICOS - La aplicación no puede iniciar', {
          category: 'ENV_CRITICAL_ERRORS',
          errors: criticalErrors
        });
      }
    }

    if (this.warnings.length > 0) {
      logger.warn('⚠️ Advertencias de configuración', {
        category: 'ENV_VALIDATION_WARNINGS',
        warningCount: this.warnings.length,
        warnings: this.warnings
      });
    }

    if (this.errors.length === 0) {
      logger.info('✅ Validación de entorno completada exitosamente', {
        category: 'ENV_VALIDATION_SUCCESS',
        configKeys: Object.keys(this.config).length
      });
    }
  }

  /**
   * Obtener configuración validada
   */
  getConfig() {
    return this.config;
  }

  /**
   * Verificar si la configuración es válida
   */
  isValid() {
    return this.errors.length === 0;
  }

  /**
   * Obtener errores críticos
   */
  getCriticalErrors() {
    return this.errors.filter(e => e.severity === 'CRITICAL');
  }

  /**
   * Obtener todas las variables configuradas
   */
  getAllVariables() {
    return {
      ...process.env,
      ...this.config
    };
  }
}

// Instancia singleton
const envValidator = new EnvValidator();

/**
 * Función helper para validar entorno al inicio
 */
function validateEnvironment() {
  return envValidator.validate();
}

/**
 * Función helper para obtener configuración validada
 */
function getValidatedConfig() {
  return envValidator.getConfig();
}

/**
 * Función helper para verificar si el entorno es válido
 */
function isEnvironmentValid() {
  return envValidator.isValid();
}

module.exports = {
  EnvValidator,
  validateEnvironment,
  getValidatedConfig,
  isEnvironmentValid,
  envValidator
}; 