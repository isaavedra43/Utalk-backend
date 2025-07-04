const { TWILIO_WHATSAPP_NUMBER } = require('../../constants');
const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.send = (to, body) => {
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  return twilioClient.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to: toNumber,
    body
  });
};
