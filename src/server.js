const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const twilio = require('twilio');
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_DATABASE_URL
} = require('./constants');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  databaseURL: FIREBASE_DATABASE_URL
});
const db = admin.firestore();

// Initialize Twilio
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Express setup
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Mount chat routes
const chatRoutes = require('./routes/chat.routes');
app.use('/api/chat', chatRoutes);

// Sanity check
app.get('/', (_req, res) => res.send('🟢 Utalk-Backend funcionando'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
