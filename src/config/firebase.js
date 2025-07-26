const { Firestore, FieldValue, Timestamp } = require('@google-cloud/firestore');
require('dotenv').config();

// ✅ RAILWAY LOGGING: Inicio de inicialización Firestore únicamente
console.log('🔥 FIRESTORE - Iniciando configuración (SIN Firebase Auth)...');

// ✅ DEBUG MODE: Mostrar variables de entorno (sin secretos)
console.log('🔍 FIRESTORE - Variables de entorno detectadas:', {
  FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
  FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
  FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY_LENGTH: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
  FIREBASE_PRIVATE_KEY_STARTS_WITH: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.substring(0, 20) + '...' : 'MISSING',
});

// Configuración del service account usando variables de entorno
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  keyFilename: undefined, // Usaremos credentials en lugar de keyFilename
  credentials: {
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
  },
};

// ✅ VERIFICACIÓN CRÍTICA: Variables de entorno obligatorias para Firestore
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
];

console.log('🔍 FIRESTORE - Verificando variables de entorno...');
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ FIRESTORE - Variables faltantes:', missingVars);
  console.error('❌ FIRESTORE - El proyecto INTENTARÁ continuar para debugging');
  // ✅ NO MATAR LA APP - Solo logear el problema
}

// ✅ VERIFICACIÓN ADICIONAL: Formato de private key (sin matar app)
if (process.env.FIREBASE_PRIVATE_KEY && !process.env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
  console.error('❌ FIRESTORE - FIREBASE_PRIVATE_KEY parece tener formato incorrecto');
  console.error('❌ FIRESTORE - Debe incluir "-----BEGIN PRIVATE KEY-----"');
  console.error('❌ FIRESTORE - Continuando para debugging...');
  // ✅ NO MATAR LA APP - Solo logear el problema
}

console.log('✅ FIRESTORE - Variables de entorno verificadas (con warnings)');

// ✅ INICIALIZACIÓN ROBUSTA CON TRY/CATCH
let firestore;

try {
  // Inicializar Firestore directamente
  console.log('🔥 FIRESTORE - Inicializando cliente Firestore...');

  // Configuración para Firestore
  const firestoreConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
  };

  // Solo agregar credentials si están disponibles
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    firestoreConfig.credentials = serviceAccount.credentials;
  }

  firestore = new Firestore(firestoreConfig);

  console.log('✅ FIRESTORE - Cliente Firestore inicializado exitosamente');

  // ✅ TEST DE CONECTIVIDAD OPCIONAL (sin bloquear)
  console.log('🔍 FIRESTORE - Realizando test de conectividad...');
  firestore.collection('_health_check').limit(1).get()
    .then((snapshot) => {
      console.log('✅ FIRESTORE - Conectividad confirmada, documentos encontrados:', snapshot.size);
    })
    .catch((connectError) => {
      console.log('⚠️ FIRESTORE - Test de conectividad falló:', connectError.message);
      // No bloquear la inicialización por esto
    });
} catch (initError) {
  console.error('❌ FIRESTORE - Error crítico en inicialización:', initError.message);
  console.error('❌ FIRESTORE - Stack trace:', initError.stack);

  // Mostrar información específica del error
  if (initError.message.includes('private_key')) {
    console.error('❌ FIRESTORE - Problema con FIREBASE_PRIVATE_KEY - verificar formato y escapes');
  }
  if (initError.message.includes('client_email')) {
    console.error('❌ FIRESTORE - Problema con FIREBASE_CLIENT_EMAIL - verificar service account');
  }
  if (initError.message.includes('project_id')) {
    console.error('❌ FIRESTORE - Problema con FIREBASE_PROJECT_ID - verificar proyecto');
  }

  console.error('❌ FIRESTORE - Creando instancia MOCK para debugging');

  // ✅ CREAR MOCK PARA QUE LA APP NO CRASHEE
  firestore = {
    collection: () => ({
      limit: () => ({
        get: () => Promise.reject(new Error('Firestore no inicializado')),
      }),
      add: () => Promise.reject(new Error('Firestore no inicializado')),
      doc: () => ({
        get: () => Promise.reject(new Error('Firestore no inicializado')),
        set: () => Promise.reject(new Error('Firestore no inicializado')),
        update: () => Promise.reject(new Error('Firestore no inicializado')),
        delete: () => Promise.reject(new Error('Firestore no inicializado')),
      }),
      where: () => ({
        limit: () => ({
          get: () => Promise.reject(new Error('Firestore no inicializado')),
        }),
        where: () => ({
          limit: () => ({
            get: () => Promise.reject(new Error('Firestore no inicializado')),
          }),
        }),
      }),
    }),
  };

  console.log('⚠️ FIRESTORE - Mock creado - la app continuará pero Firestore NO funcionará');
}

console.log('🎉 FIRESTORE - Configuración completada (con o sin errores)');

// ✅ EXPORTAR SOLO FIRESTORE (NO más Firebase Auth)
module.exports = {
  firestore,
  FieldValue,
  Timestamp,
};
