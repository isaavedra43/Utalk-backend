/**
 * 🔍 SCRIPT DE DIAGNÓSTICO: Envío de WhatsApp
 * 
 * Este script prueba el envío de mensajes de WhatsApp para identificar
 * por qué no se están enviando los mensajes iniciales.
 */

require('dotenv').config();
const { getMessageService } = require('../src/services/MessageService');
const logger = require('../src/utils/logger');

async function testWhatsAppSend() {
  console.log('🔍 INICIANDO DIAGNÓSTICO DE WHATSAPP...\n');

  try {
    // 1. Verificar configuración de Twilio
    console.log('📋 1. Verificando configuración de Twilio...');
    console.log(`   TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   TWILIO_WHATSAPP_NUMBER: ${process.env.TWILIO_WHATSAPP_NUMBER || '❌ No configurado'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}\n`);

    // 2. Obtener servicio de mensajes
    console.log('🔧 2. Inicializando MessageService...');
    const messageService = getMessageService();
    
    if (!messageService) {
      console.log('❌ ERROR: No se pudo obtener MessageService');
      return;
    }

    console.log(`   WhatsApp Number: ${messageService.whatsappNumber}`);
    console.log(`   Twilio Client: ${messageService.client ? '✅ Disponible' : '❌ No disponible'}\n`);

    // 3. Probar envío de mensaje
    console.log('📤 3. Probando envío de mensaje...');
    
    const testPhone = '+5214773790184'; // El número del problema
    const testMessage = '🔍 Mensaje de prueba - Diagnóstico automático';
    
    console.log(`   Destinatario: ${testPhone}`);
    console.log(`   Mensaje: "${testMessage}"`);
    console.log(`   Desde: ${messageService.whatsappNumber}\n`);

    const result = await messageService.sendWhatsAppMessage({
      from: messageService.whatsappNumber,
      to: testPhone,
      body: testMessage
    });

    console.log('✅ MENSAJE ENVIADO EXITOSAMENTE');
    console.log(`   SID: ${result.sid}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Error Code: ${result.errorCode || 'N/A'}`);
    console.log(`   Error Message: ${result.errorMessage || 'N/A'}\n`);

    // 4. Verificar logs
    console.log('📊 4. Verificando logs...');
    logger.info('DIAGNÓSTICO_COMPLETADO', {
      testPhone,
      testMessage,
      resultSid: result.sid,
      resultStatus: result.status,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Diagnóstico completado exitosamente');

  } catch (error) {
    console.log('❌ ERROR EN DIAGNÓSTICO:');
    console.log(`   Mensaje: ${error.message}`);
    console.log(`   Código: ${error.code || 'N/A'}`);
    console.log(`   Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}\n`);

    // Log del error
    logger.error('DIAGNÓSTICO_ERROR', {
      error: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 3)
    });

    // Verificar si es un problema de configuración
    if (error.message.includes('credentials') || error.message.includes('authentication')) {
      console.log('🔧 SUGERENCIA: Verificar credenciales de Twilio');
    } else if (error.message.includes('phone') || error.message.includes('number')) {
      console.log('🔧 SUGERENCIA: Verificar formato del número de teléfono');
    } else if (error.message.includes('whatsapp')) {
      console.log('🔧 SUGERENCIA: Verificar configuración de WhatsApp Business API');
    }
  }
}

// Ejecutar diagnóstico
testWhatsAppSend().then(() => {
  console.log('\n🏁 Diagnóstico finalizado');
  process.exit(0);
}).catch((error) => {
  console.log('\n💥 Error fatal en diagnóstico:', error.message);
  process.exit(1);
}); 