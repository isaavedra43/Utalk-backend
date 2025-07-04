const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString()
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use((req, _, next) => { console.log(`${req.method} ${req.path}`); next(); });

// Recibir mensajes entrantes desde Twilio
app.post('/webhook', async (req, res) => {
  try {
    const { From, Body, MessageSid, SmsStatus } = req.body;
    const phone = From.replace('whatsapp:', '');
    // 1) guardar mensaje
    await db.collection('messages').add({
      sid: MessageSid,
      from: phone,
      body: Body,
      direction: 'in',
      status: SmsStatus,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    // 2) upsert contacto
    await db.collection('contacts').doc(phone).set({
      phone,
      channel: 'whatsapp',
      lastMessage: Body,
      lastTimestamp: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error('Webhook error:', e);
  }
  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
});

// Enviar mensaje vía Twilio + almacenar
app.post('/send', async (req, res) => {
  const { to, body } = req.body;
  try {
    const dest = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const msg = await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: dest,
      body
    });
    await db.collection('messages').add({
      sid: msg.sid,
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: msg.to.replace('whatsapp:', ''),
      body: msg.body,
      direction: 'out',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true, sid: msg.sid });
  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listar últimos 50 mensajes
app.get('/messages', async (req, res) => {
  const snapshot = await db.collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get();
  res.json(snapshot.docs.map(d => d.data()));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
