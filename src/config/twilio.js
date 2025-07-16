const twilio = require('twilio');
require('dotenv').config();

// ✅ RAILWAY LOGGING: Inicio de inicialización Twilio
console.log('📞 TWILIO - Iniciando configuración...');

// ✅ VERIFICACIÓN CRÍTICA: Variables de entorno obligatorias
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_NUMBER',
];

console.log('🔍 TWILIO - Verificando variables de entorno...');
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ TWILIO - Variables faltantes:', missingVars);
  console.error('❌ TWILIO - El webhook NO funcionará sin estas variables');
  process.exit(1);
}

// ✅ VALIDACIÓN ADICIONAL: Formato de variables
if (process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
  console.error('❌ TWILIO - TWILIO_ACCOUNT_SID debe comenzar con "AC"');
  process.exit(1);
}

if (process.env.TWILIO_WHATSAPP_NUMBER && !process.env.TWILIO_WHATSAPP_NUMBER.includes('whatsapp:')) {
  console.error('❌ TWILIO - TWILIO_WHATSAPP_NUMBER debe tener formato "whatsapp:+1234567890"');
  process.exit(1);
}

console.log('✅ TWILIO - Variables de entorno verificadas');

// ✅ INICIALIZACIÓN ROBUSTA CON TRY/CATCH
let client, twilioConfig;

try {
  console.log('📞 TWILIO - Inicializando cliente...');
  
  // Inicializar cliente de Twilio
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );

  console.log('✅ TWILIO - Cliente inicializado exitosamente');

  // ✅ CONFIGURACIÓN COMPLETA
  twilioConfig = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
    webhookSecret: process.env.WEBHOOK_SECRET || null, // Opcional
  };

  console.log('✅ TWILIO - Configuración completada');
  console.log('📞 TWILIO - Número WhatsApp:', process.env.TWILIO_WHATSAPP_NUMBER);
  console.log('📞 TWILIO - Account SID:', process.env.TWILIO_ACCOUNT_SID.substring(0, 10) + '...');

  // ✅ TEST DE VALIDACIÓN OPCIONAL (sin bloquear inicialización)
  console.log('🔍 TWILIO - Realizando test de conectividad...');
  
  // Test simple de validación de credenciales
  client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch()
    .then((account) => {
      console.log('✅ TWILIO - Conectividad confirmada, estado:', account.status);
    })
    .catch((authError) => {
      console.log('⚠️ TWILIO - Test de conectividad falló (verificar credenciales):', authError.message);
      // No bloquear la inicialización por esto
    });

} catch (initError) {
  console.error('❌ TWILIO - Error crítico en inicialización:', initError.message);
  console.error('❌ TWILIO - Stack trace:', initError.stack);
  
  // Mostrar información específica del error
  if (initError.message.includes('ACCOUNT_SID')) {
    console.error('❌ TWILIO - Problema con TWILIO_ACCOUNT_SID - verificar formato AC...');
  }
  if (initError.message.includes('AUTH_TOKEN')) {
    console.error('❌ TWILIO - Problema con TWILIO_AUTH_TOKEN - verificar token válido');
  }
  
  console.error('❌ TWILIO - El webhook NO funcionará correctamente');
  console.error('❌ TWILIO - Deteniendo aplicación por error crítico');
  process.exit(1);
}

console.log('🎉 TWILIO - Configuración completada exitosamente');

module.exports = {
  client,
  twilioConfig,
};
