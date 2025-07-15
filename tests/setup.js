// Configuración global para tests
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock de Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  },
  auth: () => ({
    verifyIdToken: jest.fn(),
    getUser: jest.fn(),
    createUser: jest.fn(),
    setCustomUserClaims: jest.fn()
  }),
  firestore: () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    settings: jest.fn()
  })
}));

// Mock de Twilio
jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn()
    }
  }));
});

// Variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.TWILIO_ACCOUNT_SID = 'test-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-token';
process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886';

// Configuración global antes de cada test
beforeEach(() => {
  jest.clearAllMocks();
});

// Limpiar después de cada test
afterEach(() => {
  jest.restoreAllMocks();
}); 