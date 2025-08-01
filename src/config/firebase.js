/**
 * 🔥 CONFIGURACIÓN FIREBASE CON MANEJO ROBUSTO DE ERRORES
 */

const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firestore = null;
let storage = null;

try {
  logger.info('🔥 FIREBASE - Iniciando configuración...', {
    category: 'FIREBASE_INIT',
    environment: process.env.NODE_ENV,
    serviceAccountConfigured: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  });

  // Validar configuración
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no configurada');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch (parseError) {
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

  // Inicializar servicios
  firestore = admin.firestore();
  storage = admin.storage();

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

  // Test de conectividad
      // Log removido para reducir ruido en producción

  // Test async de Firestore
  firestore.collection('_health_check').doc('test').set({ 
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    test: true 
  }, { merge: true })
    .then(() => {
      logger.info('FIREBASE - Test de conectividad Firestore exitoso', {
        category: 'FIREBASE_CONNECTIVITY',
        service: 'firestore',
        testSuccessful: true
      });
    })
    .catch((connectError) => {
      logger.warn('FIREBASE - Test de conectividad Firestore falló', {
        category: 'FIREBASE_CONNECTIVITY',
        service: 'firestore',
        error: connectError.message,
        severity: 'MEDIUM'
      });
    });

} catch (error) {
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
  admin
};
