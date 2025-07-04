// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// importa tus constantes de configuración (Twilio, Firebase, etc.)
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_DATABASE_URL
} = require('./constants');

// inicialización de Firebase Admin
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  databaseURL: FIREBASE_DATABASE_URL
});
const db = admin.firestore();

// inicialización de Twilio
const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// crea la app de Express
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// monta el router de chat (toda la lógica de mensajes entrantes/salientes)
const chatRoutes = require('./routes/chat.routes');
app.use('/api/chat', chatRoutes);

// más adelante, cuando tengas crm.routes.js y dashboard.routes.js:
// const crmRoutes = require('./routes/crm.routes');
// app.use('/api/crm', crmRoutes);
// const dashboardRoutes = require('./routes/dashboard.routes');
// app.use('/api/dashboard', dashboardRoutes);

// ruta raíz de comprobación
app.get('/', (_req, res) => {
  res.send('🟢 Utalk-Backend funcionando');
});

// arranca el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
