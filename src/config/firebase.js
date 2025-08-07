/**
 * 🔥 CONFIGURACIÓN FIREBASE CON MANEJO ROBUSTO DE ERRORES
 */

const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firestore = null;
let storage = null;

// === LOG DE EMERGENCIA AL INICIAR FIREBASE ===
console.log('🚨 EMERGENCY FIREBASE INIT STARTED:', {
  timestamp: new Date().toISOString(),
  hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  serviceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0,
  nodeEnv: process.env.NODE_ENV,
  step: 'firebase_init_start'
});

try {
  logger.info('🔥 FIREBASE - Iniciando configuración...', {
    category: 'FIREBASE_INIT',
    environment: process.env.NODE_ENV,
    serviceAccountConfigured: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  });

  // Validar configuración
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.log('🚨 EMERGENCY FIREBASE NO SERVICE ACCOUNT:', {
      timestamp: new Date().toISOString(),
      step: 'no_service_account'
    });
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no configurada');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('🚨 EMERGENCY FIREBASE SERVICE ACCOUNT PARSED:', {
      timestamp: new Date().toISOString(),
      hasProjectId: !!serviceAccount.project_id,
      hasPrivateKey: !!serviceAccount.private_key,
      hasClientEmail: !!serviceAccount.client_email,
      step: 'service_account_parsed'
    });
  } catch (parseError) {
    console.log('🚨 EMERGENCY FIREBASE PARSE ERROR:', {
      timestamp: new Date().toISOString(),
      error: parseError.message,
      step: 'parse_error'
    });
    logger.error('FIREBASE - Error parseando service account key', {
      category: 'FIREBASE_CONFIG_ERROR',
      error: parseError.message,
      severity: 'CRITICAL'
    });
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tiene formato JSON inválido');
  }

  // Validar campos requeridos del service account
  const requiredFields = ['project_id', 'private_key', 'client_email'];
  const missingFields = requiredFields.filter(field => !serviceAccount[field]);
  
  if (missingFields.length > 0) {
    console.log('🚨 EMERGENCY FIREBASE MISSING FIELDS:', {
      timestamp: new Date().toISOString(),
      missingFields,
      step: 'missing_fields'
    });
    logger.error('FIREBASE - Campos faltantes en service account', {
      category: 'FIREBASE_CONFIG_ERROR',
      missingFields,
      severity: 'CRITICAL'
    });
    throw new Error(`Campos faltantes en service account: ${missingFields.join(', ')}`);
  }

  // Inicializar Firebase Admin SDK
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
    storageBucket: `${serviceAccount.project_id}.appspot.com`
  });

  console.log('🚨 EMERGENCY FIREBASE APP INITIALIZED:', {
    timestamp: new Date().toISOString(),
    appName: app.name,
    projectId: serviceAccount.project_id,
    step: 'app_initialized'
  });

  // Inicializar servicios
  firestore = admin.firestore();
  storage = admin.storage();

  console.log('🚨 EMERGENCY FIREBASE SERVICES INITIALIZED:', {
    timestamp: new Date().toISOString(),
    hasFirestore: !!firestore,
    hasStorage: !!storage,
    step: 'services_initialized'
  });

  // Configurar Firestore settings
  firestore.settings({
    timestampsInSnapshots: true,
    ignoreUndefinedProperties: true
  });

  logger.info('🔥 FIREBASE - Admin SDK inicializado exitosamente', {
    category: 'FIREBASE_SUCCESS',
    projectId: serviceAccount.project_id,
    firestoreAvailable: !!firestore,
    storageAvailable: !!storage,
    appName: app.name
  });

  console.log('🚨 EMERGENCY FIREBASE INIT SUCCESS:', {
    timestamp: new Date().toISOString(),
    projectId: serviceAccount.project_id,
    firestoreAvailable: !!firestore,
    storageAvailable: !!storage,
    step: 'init_success'
  });

  // Test de conectividad
      // Log removido para reducir ruido en producción

  // Test async de Firestore
  firestore.collection('_health_check').doc('test').set({ 
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    test: true 
  }, { merge: true })
    .then(() => {
      console.log('🚨 EMERGENCY FIREBASE CONNECTIVITY TEST SUCCESS:', {
        timestamp: new Date().toISOString(),
        step: 'connectivity_success'
      });
      logger.info('FIREBASE - Test de conectividad Firestore exitoso', {
        category: 'FIREBASE_CONNECTIVITY',
        service: 'firestore',
        testSuccessful: true
      });
    })
    .catch((connectError) => {
      console.log('🚨 EMERGENCY FIREBASE CONNECTIVITY TEST FAILED:', {
        timestamp: new Date().toISOString(),
        error: connectError.message,
        step: 'connectivity_failed'
      });
      logger.warn('FIREBASE - Test de conectividad Firestore falló', {
        category: 'FIREBASE_CONNECTIVITY',
        service: 'firestore',
        error: connectError.message,
        severity: 'MEDIUM'
      });
    });

} catch (error) {
  console.log('🚨 EMERGENCY FIREBASE INIT ERROR:', {
    timestamp: new Date().toISOString(),
    error: error.message,
    errorType: error.constructor.name,
    step: 'init_error'
  });
  
  logger.error('🔥 FIREBASE - Error crítico en inicialización', {
    category: 'FIREBASE_CRITICAL_ERROR',
    error: error.message,
    stack: error.stack,
    severity: 'CRITICAL',
    requiresAttention: true,
    impact: 'Aplicación no puede continuar sin Firebase'
  });

  // Análisis específico del error
  const errorAnalysis = {
    isServiceAccountIssue: error.message.includes('FIREBASE_SERVICE_ACCOUNT_KEY'),
    isJSONParseIssue: error.message.includes('JSON'),
    isMissingFieldsIssue: error.message.includes('Campos faltantes'),
    isCredentialIssue: error.message.includes('credential'),
    isNetworkIssue: error.message.includes('network') || error.message.includes('timeout')
  };

  logger.error('FIREBASE - Análisis detallado del error', {
    category: 'FIREBASE_ERROR_ANALYSIS',
    ...errorAnalysis,
    recommendations: {
      serviceAccount: errorAnalysis.isServiceAccountIssue ? 'Configurar FIREBASE_SERVICE_ACCOUNT_KEY' : null,
      jsonFormat: errorAnalysis.isJSONParseIssue ? 'Verificar formato JSON válido' : null,
      missingFields: errorAnalysis.isMissingFieldsIssue ? 'Verificar service account completo' : null,
      credentials: errorAnalysis.isCredentialIssue ? 'Regenerar service account desde Firebase Console' : null,
      network: errorAnalysis.isNetworkIssue ? 'Verificar conectividad a Firebase' : null
    }
  });

  // Firebase es crítico, no podemos crear mocks útiles
  throw error;
}

module.exports = {
  firestore,
  storage,
  admin,
  FieldValue: admin.firestore.FieldValue,
  Timestamp: admin.firestore.Timestamp
};
