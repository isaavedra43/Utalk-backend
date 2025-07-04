// src/services/twilio.service.js
const twilio = require('twilio');
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER
} = require('../constants');

// inicializa el cliente de Twilio
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * envía un mensaje WhatsApp usando Twilio
 * @param {string} to número destino (sin prefijo “whatsapp:” o ya con él)
 * @param {string} body contenido del mensaje
 * @returns {Promise<Object>} objeto mensaje de Twilio
 */
async function sendWhatsApp(to, body) {
  const destino = to.startsWith('whatsapp:')
    ? to
    : `whatsapp:${to}`;

  const msg = await client.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to: destino,
    body
  });

  return msg;
}

/**
 * construye la respuesta XML para el webhook de Twilio
 * (para confirmar recepción y no reenviar)
 * @returns {string} cadena XML vacía <Response/>
 */
function buildTwilioResponse() {
  return '<Response></Response>';
}

module.exports = {
  sendWhatsApp,
  buildTwilioResponse
};
