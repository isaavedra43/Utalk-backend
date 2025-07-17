const jwt = require('jsonwebtoken');
const app = require('../src/index'); // Importar la app para inicializarla

// Mock de Firebase Admin SDK
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    getUser: jest.fn(),
    createUser: jest.fn(),
    setCustomUserClaims: jest.fn(),
  })),
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })),
      add: jest.fn(),
      where: jest.fn(() => ({
        get: jest.fn(),
      })),
    })),
  })),
}));

// Mock de Twilio
jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'test-message-sid',
        status: 'sent',
        to: 'whatsapp:+1234567890',
        from: 'whatsapp:+14155238886',
      }),
    },
  }));
});

// Variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only-minimum-32-chars';
process.env.JWT_EXPIRES_IN = '24h';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = 'test-private-key';
process.env.TWILIO_ACCOUNT_SID = 'test-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-token';
process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886';

/**
 * UTILIDADES PARA TESTING CON JWT PROPIO
 *
 * Estas funciones ayudan a generar tokens JWT válidos para testing
 * del nuevo sistema de autenticación (NO Firebase ID Token)
 */

const initializeTestApp = async () => {
  // Aquí se podrían inicializar servicios o bases de datos de prueba
  return app; // Devuelve la instancia de la app para supertest
};

const cleanupTest = async () => {
  // Aquí se podría limpiar la base de datos de prueba
};

global.generateTestToken = (userData = {}) => {
  const defaultUser = {
    id: 'test-id-123',
    email: 'test@example.com',
    role: 'admin',
    name: 'Test User',
  };
  const user = { ...defaultUser, ...userData };
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '24h' });
};

global.testTokens = {
  admin: global.generateTestToken({ id: 'admin-id', email: 'admin@test.com', role: 'admin', name: 'Admin User' }),
  agent: global.generateTestToken({ id: 'agent-id', email: 'agent@test.com', role: 'agent', name: 'Agent User' }),
  viewer: global.generateTestToken({ id: 'viewer-id', email: 'viewer@test.com', role: 'viewer', name: 'Viewer User' }),
  expired: jwt.sign(
    { uid: 'expired-uid', email: 'expired@test.com', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '-1h' }, // Token expirado hace 1 hora
  ),
  invalid: 'invalid-token-string',
};

// Configuración global antes de cada test
beforeEach(() => {
  jest.clearAllMocks();
});

// Limpiar después de cada test
afterEach(() => {
  jest.restoreAllMocks();
});

module.exports = {
  initializeTestApp,
  cleanupTest,
};
