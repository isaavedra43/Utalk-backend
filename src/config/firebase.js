const admin = require('firebase-admin');
require('dotenv').config();

// ✅ RAILWAY LOGGING: Inicio de inicialización Firebase
console.log('🔥 FIREBASE - Iniciando configuración...');

// ✅ DEBUG MODE: Mostrar variables de entorno (sin secretos)
console.log('🔍 FIREBASE - Variables de entorno detectadas:', {
  FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
  FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
  FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY_LENGTH: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
  FIREBASE_PRIVATE_KEY_STARTS_WITH: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.substring(0, 20) + '...' : 'MISSING',
});

// Configuración del service account usando variables de entorno
const serviceAccount = {
  type: process.env.FIREBASE_TYPE || 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
  token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
};

// ✅ VERIFICACIÓN CRÍTICA: Variables de entorno obligatorias
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
];

console.log('🔍 FIREBASE - Verificando variables de entorno...');
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ FIREBASE - Variables faltantes:', missingVars);
  console.error('❌ FIREBASE - El proyecto INTENTARÁ continuar para debugging');
  // ✅ NO MATAR LA APP - Solo logear el problema
}

// ✅ VERIFICACIÓN ADICIONAL: Formato de private key (sin matar app)
if (process.env.FIREBASE_PRIVATE_KEY && !process.env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
  console.error('❌ FIREBASE - FIREBASE_PRIVATE_KEY parece tener formato incorrecto');
  console.error('❌ FIREBASE - Debe incluir "-----BEGIN PRIVATE KEY-----"');
  console.error('❌ FIREBASE - Continuando para debugging...');
  // ✅ NO MATAR LA APP - Solo logear el problema
}

console.log('✅ FIREBASE - Variables de entorno verificadas (con warnings)');

// ✅ INICIALIZACIÓN ROBUSTA CON TRY/CATCH
let auth, firestore, FieldValue, Timestamp;

try {
  // Inicializar Firebase Admin SDK solo si no está inicializado
  if (!admin.apps.length) {
    console.log('🔥 FIREBASE - Inicializando Admin SDK...');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    console.log('✅ FIREBASE - Admin SDK inicializado exitosamente');
  } else {
    console.log('✅ FIREBASE - Admin SDK ya estaba inicializado');
  }

  // Obtener instancias de Firebase
  auth = admin.auth();
  firestore = admin.firestore();
  FieldValue = admin.firestore.FieldValue;
  Timestamp = admin.firestore.Timestamp;

  console.log('✅ FIREBASE - Servicios Auth y Firestore obtenidos');

  // ✅ CONFIGURAR FIRESTORE CON MANEJO DE ERRORES
  try {
    firestore.settings({
      timestampsInSnapshots: true,
    });
    console.log('✅ FIREBASE - Configuración Firestore aplicada');
  } catch (settingsError) {
    console.log('⚠️ FIREBASE - Error aplicando configuración (puede ser normal):', settingsError.message);
    // No es crítico, continuar
  }

  // ✅ TEST DE CONECTIVIDAD OPCIONAL (sin bloquear)
  console.log('🔍 FIREBASE - Realizando test de conectividad...');
  firestore.collection('_health_check').limit(1).get()
    .then(() => {
      console.log('✅ FIREBASE - Conectividad confirmada');
    })
    .catch((connectError) => {
      console.log('⚠️ FIREBASE - Test de conectividad falló (verificar permisos):', connectError.message);
      // No bloquear la inicialización por esto
    });
} catch (initError) {
  console.error('❌ FIREBASE - Error crítico en inicialización:', initError.message);
  console.error('❌ FIREBASE - Stack trace:', initError.stack);

  // Mostrar información específica del error
  if (initError.message.includes('private_key')) {
    console.error('❌ FIREBASE - Problema con FIREBASE_PRIVATE_KEY - verificar formato y escapes');
  }
  if (initError.message.includes('client_email')) {
    console.error('❌ FIREBASE - Problema con FIREBASE_CLIENT_EMAIL - verificar service account');
  }
  if (initError.message.includes('project_id')) {
    console.error('❌ FIREBASE - Problema con FIREBASE_PROJECT_ID - verificar proyecto');
  }

  console.error('❌ FIREBASE - Creando instancias MOCK para debugging');

  // ✅ CREAR MOCKS PARA QUE LA APP NO CRASHEE
  auth = {
    verifyIdToken: () => Promise.reject(new Error('Firebase no inicializado')),
    getUser: () => Promise.reject(new Error('Firebase no inicializado')),
  };

  firestore = {
    collection: () => ({
      limit: () => ({
        get: () => Promise.reject(new Error('Firebase no inicializado')),
      }),
      add: () => Promise.reject(new Error('Firebase no inicializado')),
      doc: () => ({
        get: () => Promise.reject(new Error('Firebase no inicializado')),
        set: () => Promise.reject(new Error('Firebase no inicializado')),
        update: () => Promise.reject(new Error('Firebase no inicializado')),
        delete: () => Promise.reject(new Error('Firebase no inicializado')),
      }),
      where: () => ({
        limit: () => ({
          get: () => Promise.reject(new Error('Firebase no inicializado')),
        }),
      }),
    }),
  };

  FieldValue = {
    serverTimestamp: () => new Date(),
  };

  Timestamp = {
    now: () => new Date(),
  };

  console.log('⚠️ FIREBASE - Mocks creados - la app continuará pero Firebase NO funcionará');
}

console.log('🎉 FIREBASE - Configuración completada (con o sin errores)');

module.exports = {
  admin,
  auth,
  firestore,
  FieldValue,
  Timestamp,
};
