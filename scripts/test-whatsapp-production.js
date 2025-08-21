/**
 * 🔍 SCRIPT DE DIAGNÓSTICO PRODUCCIÓN: Envío de WhatsApp
 * 
 * Este script usa las credenciales de Railway para probar el envío
 * de mensajes de WhatsApp en el entorno de producción.
 */

// Configurar variables de Railway
process.env.TWILIO_ACCOUNT_SID = "AC1ed6685660488369e7f0c3ab257f250c";
process.env.TWILIO_AUTH_TOKEN = "1e41598bad872369f10c9489042b5612";
process.env.TWILIO_WHATSAPP_NUMBER = "whatsapp:+5214793176502";
process.env.NODE_ENV = "production";

const { getMessageService } = require('../src/services/MessageService');
const logger = require('../src/utils/logger');

async function testWhatsAppProduction() {
  console.log('🔍 INICIANDO DIAGNÓSTICO DE PRODUCCIÓN...\n');

  try {
    // 1. Verificar configuración de Twilio
    console.log('📋 1. Verificando configuración de Twilio (PRODUCCIÓN)...');
    console.log(`   TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   TWILIO_WHATSAPP_NUMBER: ${process.env.TWILIO_WHATSAPP_NUMBER || '❌ No configurado'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}\n`);

    // 2. Obtener servicio de mensajes
    console.log('🔧 2. Inicializando MessageService (PRODUCCIÓN)...');
    const messageService = getMessageService();
    
    if (!messageService) {
      console.log('❌ ERROR: No se pudo obtener MessageService');
      return;
    }

    console.log(`   WhatsApp Number: ${messageService.whatsappNumber}`);
    console.log(`   Twilio Client: ${messageService.client ? '✅ Disponible' : '❌ No disponible'}\n`);

    // 3. Probar envío de mensaje
    console.log('📤 3. Probando envío de mensaje (PRODUCCIÓN)...');
    
    const testPhone = '+5214773790184'; // El número del problema
    const testMessage = '🔍 Mensaje de prueba - Diagnóstico PRODUCCIÓN';
    
    console.log(`   Destinatario: ${testPhone}`);
    console.log(`   Mensaje: "${testMessage}"`);
    console.log(`   Desde: ${messageService.whatsappNumber}\n`);

    const result = await messageService.sendWhatsAppMessage({
      from: messageService.whatsappNumber,
      to: testPhone,
      body: testMessage
    });

    console.log('✅ MENSAJE ENVIADO EXITOSAMENTE (PRODUCCIÓN)');
    console.log(`   SID: ${result.sid}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Error Code: ${result.errorCode || 'N/A'}`);
    console.log(`   Error Message: ${result.errorMessage || 'N/A'}\n`);

    // 4. Verificar logs
    console.log('📊 4. Verificando logs...');
    logger.info('DIAGNÓSTICO_PRODUCCIÓN_COMPLETADO', {
      testPhone,
      testMessage,
      resultSid: result.sid,
      resultStatus: result.status,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Diagnóstico de producción completado exitosamente');

  } catch (error) {
    console.log('❌ ERROR EN DIAGNÓSTICO DE PRODUCCIÓN:');
    console.log(`   Mensaje: ${error.message}`);
    console.log(`   Código: ${error.code || 'N/A'}`);
    console.log(`   Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}\n`);

    // Log del error
    logger.error('DIAGNÓSTICO_PRODUCCIÓN_ERROR', {
      error: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 3)
    });

    // Verificar si es un problema de configuración
    if (error.message.includes('credentials') || error.message.includes('authentication')) {
      console.log('🔧 SUGERENCIA: Verificar credenciales de Twilio en Railway');
    } else if (error.message.includes('phone') || error.message.includes('number')) {
      console.log('🔧 SUGERENCIA: Verificar formato del número de teléfono');
    } else if (error.message.includes('whatsapp')) {
      console.log('🔧 SUGERENCIA: Verificar configuración de WhatsApp Business API');
    }
  }
}

// Ejecutar diagnóstico
testWhatsAppProduction().then(() => {
  console.log('\n🏁 Diagnóstico de producción finalizado');
  process.exit(0);
}).catch((error) => {
  console.log('\n💥 Error fatal en diagnóstico de producción:', error.message);
  process.exit(1);
}); 