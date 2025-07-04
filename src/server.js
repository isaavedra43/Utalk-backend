// src/server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_DATABASE_URL
} = require('../constants');   // <<– constants.js está un nivel arriba

const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  databaseURL: FIREBASE_DATABASE_URL
});
const db = admin.firestore();

const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// <-- Aquí elimina el 'src/' extra, porque server.js ya está en src/
const chatRoutes = require('./routes/chat.routes');
app.use('/api/chat', chatRoutes);

// futura integración de crm y dashboard:
// const crmRoutes       = require('./routes/crm.routes');
// const dashboardRoutes = require('./routes/dashboard.routes');
// app.use('/api/crm', crmRoutes);
// app.use('/api/dashboard', dashboardRoutes);

app.get('/', (_req, res) => res.send('🟢 Utalk-Backend funcionando'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
