/**
 * 📞 CONFIGURACIÓN TWILIO CON LOGGING ESTRUCTURADO
 */

const { Twilio } = require('twilio');
const logger = require('../utils/logger');

logger.info('📞 TWILIO - Iniciando configuración...', {
  category: 'TWILIO_INIT',
  environment: process.env.NODE_ENV
});

// Verificar variables de entorno requeridas
const requiredVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER'];
const missingVars = requiredVars.filter(envVar => !process.env[envVar]);

// Log removido para reducir ruido en producción

let client = null;
let twilioConfig = null;

try {
  logger.info('🔍 TWILIO - Verificando variables de entorno...', {
    category: 'TWILIO_VALIDATION'
  });

  if (missingVars.length > 0) {
    logger.error('TWILIO - Variables faltantes detectadas', {
      category: 'TWILIO_ERROR',
      missingVars,
      severity: 'HIGH',
      impact: 'Funcionalidad Twilio no disponible'
    });
    throw new Error(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
  }

  // Validar formato de ACCOUNT_SID
  if (!process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    logger.error('TWILIO - ACCOUNT_SID formato inválido', {
      category: 'TWILIO_ERROR',
      expected: 'AC...',
      received: process.env.TWILIO_ACCOUNT_SID ? 
        process.env.TWILIO_ACCOUNT_SID.substring(0, 10) + '...' : 'MISSING',
      severity: 'HIGH'
    });
    throw new Error('TWILIO_ACCOUNT_SID debe comenzar con "AC"');
  }

  // Validar formato de WhatsApp number
  if (!process.env.TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:')) {
    logger.error('TWILIO - WhatsApp número formato inválido', {
      category: 'TWILIO_ERROR',
      expected: 'whatsapp:+1234567890',
      received: process.env.TWILIO_WHATSAPP_NUMBER,
      severity: 'HIGH'
    });
    throw new Error('TWILIO_WHATSAPP_NUMBER debe tener formato "whatsapp:+1234567890"');
  }

  logger.info('TWILIO - Variables de entorno validadas exitosamente', {
    category: 'TWILIO_VALIDATION',
    accountSidValid: true,
    whatsappNumberValid: true
  });

  // Inicializar cliente Twilio
  logger.info('📞 TWILIO - Inicializando cliente...', {
    category: 'TWILIO_CLIENT_INIT'
  });

  client = new Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  twilioConfig = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
    webhookSecret: process.env.WEBHOOK_SECRET || null,
  };

  logger.info('TWILIO - Cliente inicializado exitosamente', {
    category: 'TWILIO_SUCCESS',
    configComplete: true
  });

  // Configuración completada
  logger.info('TWILIO - Configuración completada exitosamente', {
    category: 'TWILIO_SUCCESS',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
    accountSidPrefix: process.env.TWILIO_ACCOUNT_SID.substring(0, 10) + '...',
    webhookSecretConfigured: !!process.env.WEBHOOK_SECRET
  });

  // Test de conectividad (opcional, no bloquea la inicialización)
  // Log removido para reducir ruido en producción

  client.api.accounts(process.env.TWILIO_ACCOUNT_SID)
    .fetch()
    .then((account) => {
      logger.info('TWILIO - Conectividad confirmada exitosamente', {
        category: 'TWILIO_CONNECTIVITY',
        accountStatus: account.status,
        testSuccessful: true
      });
    })
    .catch((authError) => {
      logger.warn('TWILIO - Test de conectividad falló', {
        category: 'TWILIO_CONNECTIVITY',
        error: authError.message,
        severity: 'MEDIUM',
        note: 'Configuración continuará, verificar credenciales si es necesario'
      });
    });

} catch (initError) {
  logger.error('TWILIO - Error crítico en inicialización', {
    category: 'TWILIO_CRITICAL_ERROR',
    error: initError.message,
    stack: initError.stack,
    severity: 'CRITICAL',
    requiresAttention: true
  });

  // Análisis específico del error
  const errorAnalysis = {
    isAccountSidIssue: initError.message.includes('ACCOUNT_SID'),
    isAuthTokenIssue: initError.message.includes('AUTH_TOKEN'),
    isFormatIssue: initError.message.includes('formato'),
    isMissingVarsIssue: initError.message.includes('faltantes')
  };

  logger.error('TWILIO - Análisis detallado del error', {
    category: 'TWILIO_ERROR_ANALYSIS',
    ...errorAnalysis,
    recommendations: {
      accountSid: errorAnalysis.isAccountSidIssue ? 'Verificar formato AC...' : null,
      authToken: errorAnalysis.isAuthTokenIssue ? 'Verificar token válido' : null,
      missingVars: errorAnalysis.isMissingVarsIssue ? 'Configurar variables de entorno' : null
    }
  });

  logger.warn('TWILIO - Creando cliente MOCK para continuar operación', {
    category: 'TWILIO_FALLBACK',
    reason: 'Prevenir crash de aplicación',
    impact: 'Funcionalidad Twilio NO estará disponible'
  });

  // CREAR MOCKS PARA QUE LA APP NO CRASHEE
  client = {
    messages: {
      create: () => Promise.reject(new Error('Twilio no inicializado - configurar variables de entorno')),
    },
    api: {
      accounts: () => ({
        fetch: () => Promise.reject(new Error('Twilio no inicializado - configurar variables de entorno')),
      }),
    },
  };

  twilioConfig = {
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'MOCK_SID',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'MOCK_TOKEN',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+1234567890',
    webhookSecret: process.env.WEBHOOK_SECRET || null,
  };

  logger.warn('TWILIO - Mocks creados exitosamente', {
    category: 'TWILIO_MOCK_SUCCESS',
    mockClientCreated: true,
    mockConfigCreated: true,
    appWillContinue: true,
    functionalityAvailable: false
  });
}

logger.info('🎉 TWILIO - Inicialización completada', {
  category: 'TWILIO_COMPLETE',
  clientAvailable: !!client,
  configAvailable: !!twilioConfig,
  functionalityStatus: client?.messages?.create ? 'available' : 'mock_mode',
  timestamp: new Date().toISOString()
});

module.exports = {
  client,
  twilioConfig,
};
