/**
 * 🔥 CONFIGURACIÓN FIREBASE CON MANEJO ROBUSTO DE ERRORES - OPTIMIZADA
 */

const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firestore = null;
let storage = null;
let isInitializing = false;
let initializationPromise = null;

/**
 * Nota: Se eliminó la inicialización síncrona inmediata para no bloquear el arranque.
 * La inicialización ahora es 100% asíncrona y en segundo plano.
 */

/**
 * 🔥 INICIALIZAR FIREBASE DE FORMA ASÍNCRONA
 */
async function initializeFirebase() {
  // Evitar inicialización múltiple
  if (isInitializing) {
    return initializationPromise;
  }
  
  if (firestore && storage) {
    return { firestore, storage, admin };
  }

  isInitializing = true;
  initializationPromise = initializeFirebaseAsync();
  
  return initializationPromise;
}

async function initializeFirebaseAsync() {
  try {
    logger.info('🔥 FIREBASE - Iniciando configuración asíncrona...', {
      category: 'FIREBASE_INIT',
      environment: process.env.NODE_ENV,
      serviceAccountConfigured: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    });

    // Validar configuración
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no configurada');
      } else {
        logger.warn('🔥 FIREBASE - Configuración opcional en desarrollo', {
          category: 'FIREBASE_DEV_MODE',
          message: 'Firebase no configurado, usando modo desarrollo sin Firebase',
          severity: 'MEDIUM'
        });
        isInitializing = false;
        return { firestore: null, storage: null, admin };
      }
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

    // Inicializar Firebase Admin SDK (solo si no está ya inicializado)
    let app;
    if (!admin.apps.length) {
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
      });
    } else {
      app = admin.app();
    }

    // Inicializar servicios
    firestore = firestore || admin.firestore();
    storage = storage || admin.storage();

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
      appName: app.name,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
    });

    // Test async de Firestore (SILENCIOSO) - NO BLOQUEANTE
    setImmediate(() => {
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
    });

    isInitializing = false;
    return { firestore, storage, admin };

  } catch (error) {
    isInitializing = false;
    logger.error('🔥 FIREBASE - Error crítico en inicialización', {
      category: 'FIREBASE_CRITICAL_ERROR',
      error: error.message,
      stack: error.stack,
      severity: 'CRITICAL',
      requiresAttention: true,
      impact: 'Aplicación no puede continuar sin Firebase'
    });

    throw error;
  }
}

// Inicializar Firebase automáticamente en segundo plano
setImmediate(() => {
  initializeFirebase().catch(error => {
    logger.error('Error en inicialización automática de Firebase', {
      category: 'FIREBASE_AUTO_INIT_ERROR',
      error: error.message
    });
  });
});

// 🔧 CORRECCIÓN CRÍTICA: Exportar getters para que siempre devuelvan el valor actual
module.exports = {
  get firestore() {
    return firestore;
  },
  get storage() {
    return storage;
  },
  admin,
  get db() {
    return firestore; // Siempre devuelve el valor actual de firestore
  },
  FieldValue: admin.firestore.FieldValue,
  Timestamp: admin.firestore.Timestamp,
  initializeFirebase
};
