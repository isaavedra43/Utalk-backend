const twilio = require('twilio');
require('dotenv').config();

// Verificar variables de entorno de Twilio
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_NUMBER',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Variables de entorno de Twilio faltantes:', missingVars);
  process.exit(1);
}

// Inicializar cliente de Twilio
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Configuración de WhatsApp
const twilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  webhookSecret: process.env.WEBHOOK_SECRET,
};

console.log('✅ Cliente Twilio inicializado correctamente');

module.exports = {
  client,
  twilioConfig,
}; 