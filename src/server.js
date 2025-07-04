// src/server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// IMPORTA las constantes desde la carpeta raíz
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_DATABASE_URL
} = require('../constants');

const admin = require('firebase-admin');
// Inicialización de Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  databaseURL: FIREBASE_DATABASE_URL
});
const db = admin.firestore();

// Inicialización de Twilio
const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// monta el router de chat (ajustado al path correcto)
const chatRoutes = require('./routes/chat.routes');
app.use('/api/chat', chatRoutes);

// ruta raíz de comprobación
app.get('/', (_req, res) => {
  res.send('🟢 Utalk-Backend funcionando');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
