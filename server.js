const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const admin = require('firebase-admin');
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_DATABASE_URL
} = require('./constants');

admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  databaseURL: FIREBASE_DATABASE_URL
});
const db = admin.firestore();
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Webhook Twilio: recibe mensajes entrantes
app.post('/webhook', async (req, res) => {
  const { From, Body, MessageSid } = req.body;
  await db.collection('messages').add({
    sid: MessageSid,
    from: From,
    body: Body,
    direction: 'in',
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
});

// Enviar mensaje
app.post('/send', async (req, res) => {
  const { to, body } = req.body;
  try {
    const msg = await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
      body
    });
    await db.collection('messages').add({
      sid: msg.sid,
      from: TWILIO_WHATSAPP_NUMBER,
      to: msg.to,
      body: msg.body,
      direction: 'out',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true, sid: msg.sid });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener mensajes
app.get('/messages', async (req, res) => {
  const snapshot = await db.collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get();
  const messages = snapshot.docs.map(doc => doc.data());
  res.json(messages);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
