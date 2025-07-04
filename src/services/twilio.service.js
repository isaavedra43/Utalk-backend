const twilio = require('twilio');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = require('../constants');

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

exports.parseIncoming = (body) => {
  return {
    sid: body.MessageSid,
    from: body.From,
    to: body.To,
    body: body.Body,
    direction: 'in'
  };
};

exports.sendMessage = async (to, text) => {
  const formatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const message = await client.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to: formatted,
    body: text
  });
  return {
    sid: message.sid,
    from: message.from,
    to: message.to,
    body: message.body,
    direction: 'out'
  };
};
