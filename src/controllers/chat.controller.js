const firestoreService = require('../services/firestore.service');
const twilioService = require('../services/twilio.service');

exports.receiveIncoming = async (req, res) => {
  try {
    const msg = await twilioService.parseIncoming(req.body);
    await firestoreService.saveIncoming(msg);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.sendOutgoing = async (req, res) => {
  try {
    const msg = await twilioService.sendMessage(req.body.to, req.body.body);
    await firestoreService.saveOutgoing(msg);
    res.json({ success: true, sid: msg.sid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.listLast = async (_req, res) => {
  try {
    const messages = await firestoreService.getLastMessages(50);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
