// src/server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// importa tus constantes (están al mismo nivel que server.js dentro de src/)
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_DATABASE_URL
} = require('./constants');

const admin = require('firebase-admin');
// inicialización de Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  databaseURL: FIREBASE_DATABASE_URL
});
const db = admin.firestore();

// inicialización de Twilio
const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// monta el router de chat (ahora bien referenciado)
const chatRoutes = require('./routes/chat.routes');
app.use('/api/chat', chatRoutes);

// aquí, en el futuro, montarías crm.routes y dashboard.routes igual:
// const crmRoutes       = require('./routes/crm.routes');
// app.use('/api/crm', crmRoutes);
// const dashboardRoutes = require('./routes/dashboard.routes');
// app.use('/api/dashboard', dashboardRoutes);

app.get('/', (_req, res) => {
  res.send('🟢 Utalk-Backend funcionando');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
