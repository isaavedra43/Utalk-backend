const admin = require('firebase-admin');
require('dotenv').config();

let firestore;
let FieldValue;
let Timestamp;

try {
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE || 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  };

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  }

  firestore = admin.firestore();
  FieldValue = admin.firestore.FieldValue;
  Timestamp = admin.firestore.Timestamp;

  console.log('Firebase Admin SDK initialized successfully');

} catch (error) {
  console.error('Error initializing Firebase:', error.message);
  
  // Create mock for development
  firestore = {
    collection: () => ({
      limit: () => ({
        get: () => Promise.reject(new Error('Firestore not initialized')),
      }),
      add: () => Promise.reject(new Error('Firestore not initialized')),
      doc: () => ({
        get: () => Promise.reject(new Error('Firestore not initialized')),
        set: () => Promise.reject(new Error('Firestore not initialized')),
        update: () => Promise.reject(new Error('Firestore not initialized')),
        delete: () => Promise.reject(new Error('Firestore not initialized')),
      }),
      where: () => ({
        limit: () => ({
          get: () => Promise.reject(new Error('Firestore not initialized')),
        }),
        where: () => ({
          limit: () => ({
            get: () => Promise.reject(new Error('Firestore not initialized')),
          }),
        }),
      }),
    }),
  };

  FieldValue = {
    serverTimestamp: () => new Date(),
    arrayUnion: (...elements) => elements,
    arrayRemove: (...elements) => elements,
  };

  Timestamp = {
    now: () => new Date(),
    fromDate: (date) => date,
  };
}

module.exports = {
  firestore,
  FieldValue,
  Timestamp,
  admin
};
