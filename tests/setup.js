// Configuración global para tests de Express + Firebase + Twilio

// Mock de Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  apps: [], // Agregar array de apps para evitar errores
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
    settings: jest.fn(),
    FieldValue: {
      serverTimestamp: jest.fn(),
      increment: jest.fn(),
      arrayUnion: jest.fn(),
      arrayRemove: jest.fn()
    },
    Timestamp: {
      now: jest.fn(),
      fromDate: jest.fn()
    }
  })
}));

// Mock de Twilio
jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'SMtest123',
        status: 'queued',
        to: 'whatsapp:+1234567890',
        from: 'whatsapp:+14155238886'
      })
    }
  }));
});

// Variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only-minimum-32-chars';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = 'test-private-key';
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