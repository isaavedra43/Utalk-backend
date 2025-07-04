const firestoreService = require('../services/firestore.service');
const twilioService = require('../services/twilio.service');

exports.handleWebhook = async (req, res) => {
  const { From, Body, MessageSid } = req.body;
  try {
    await firestoreService.saveIncoming(MessageSid, From, Body);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (e) {
    res.status(500).end();
  }
};

exports.sendMessage = async (req, res) => {
  const { to, body } = req.body;
  try {
    const msg = await twilioService.send(to, body);
    await firestoreService.saveOutgoing(msg.sid, msg.from, msg.to, msg.body);
    res.json({ success: true, sid: msg.sid });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const messages = await firestoreService.fetchRecent(50);
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
