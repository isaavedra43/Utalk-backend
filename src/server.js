const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// 1) Carga tus constantes desde src/constants.js
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_DATABASE_URL
} = require('./constants');

// 2) Inicializa Firebase Admin
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  databaseURL: FIREBASE_DATABASE_URL
});
const db = admin.firestore();

// 3) Inicializa Twilio
const twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// 4) Crea la app de Express
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 5) Monta el router de chat
const chatRoutes = require('./routes/chat.routes');
app.use('/api/chat', chatRoutes);

// 6) Rutas futuras CRM y Dashboard
// const crmRoutes = require('./routes/crm.routes');
// app.use('/api/crm', crmRoutes);
// const dashboardRoutes = require('./routes/dashboard.routes');
// app.use('/api/dashboard', dashboardRoutes);

// 7) Ruta de verificación
app.get('/', (_req, res) => {
  res.send('🟢 Utalk-Backend funcionando');
});

// 8) Inicia el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
