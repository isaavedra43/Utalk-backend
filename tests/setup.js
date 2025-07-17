const jwt = require('jsonwebtoken');

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

// Generar token JWT válido para testing
global.generateTestToken = (userData = {}) => {
  const defaultUser = {
    uid: 'test-uid-123',
    email: 'test@example.com',
    role: 'admin',
  };

  const user = { ...defaultUser, ...userData };

  return jwt.sign(user, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Tokens predefinidos para diferentes roles
global.testTokens = {
  admin: global.generateTestToken({ uid: 'admin-uid', email: 'admin@test.com', role: 'admin' }),
  agent: global.generateTestToken({ uid: 'agent-uid', email: 'agent@test.com', role: 'agent' }),
  viewer: global.generateTestToken({ uid: 'viewer-uid', email: 'viewer@test.com', role: 'viewer' }),
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
