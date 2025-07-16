#!/usr/bin/env node

/**
 * 🚀 SCRIPT DE TESTING COMPLETO - WEBHOOK TWILIO EN RAILWAY
 * 
 * Este script verifica que el webhook esté funcionando correctamente
 * en el entorno Railway con todas las validaciones necesarias.
 */

const axios = require('axios');

// ✅ CONFIGURACIÓN PARA RAILWAY PRODUCTION
const CONFIG = {
  BASE_URL: 'https://utalk-backend-production.up.railway.app',
  WEBHOOK_PATH: '/api/messages/webhook',
  HEALTH_PATH: '/health',
  TIMEOUT: 10000, // 10 segundos
};

// ✅ COLORES PARA CONSOLE
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// ✅ FUNCIONES DE LOGGING
function logHeader(message) {
  console.log(`\n${colors.cyan}${colors.bright}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}${message}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}${'='.repeat(60)}${colors.reset}\n`);
}

function logSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function logInfo(message) {
  console.log(`${colors.blue}🔍 ${message}${colors.reset}`);
}

// ✅ FUNCIÓN PARA PAUSAR ENTRE TESTS
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ✅ TEST 1: HEALTH CHECK COMPLETO
async function testHealthCheck() {
  logHeader('TEST 1: HEALTH CHECK COMPLETO');
  
  try {
    logInfo('Verificando health check...');
    const response = await axios.get(`${CONFIG.BASE_URL}${CONFIG.HEALTH_PATH}`, {
      timeout: CONFIG.TIMEOUT,
    });

    logInfo(`Status Code: ${response.status}`);
    logInfo(`Response Time: ${response.data.responseTime || 'N/A'}ms`);
    
    // Verificar estructura de respuesta
    if (response.status === 200) {
      logSuccess('Health check respondió 200 OK');
      
      // Verificar checks específicos
      const checks = response.data.checks || {};
      
      if (checks.firebase?.status === 'connected') {
        logSuccess('Firebase: CONECTADO');
      } else {
        logError(`Firebase: ${checks.firebase?.status || 'DESCONOCIDO'}`);
        if (checks.firebase?.details?.error) {
          logError(`  Error: ${checks.firebase.details.error}`);
        }
      }
      
      if (checks.twilio?.status === 'configured') {
        logSuccess('Twilio: CONFIGURADO');
        logInfo(`  WhatsApp: ${checks.twilio.details?.whatsappNumber || 'N/A'}`);
      } else {
        logError(`Twilio: ${checks.twilio?.status || 'DESCONOCIDO'}`);
        if (checks.twilio?.details?.error) {
          logError(`  Error: ${checks.twilio.details.error}`);
        }
      }
      
      if (checks.webhook?.url) {
        logSuccess(`Webhook URL: ${checks.webhook.url}`);
      } else {
        logWarning('Webhook URL no configurado');
      }
      
    } else {
      logError(`Health check falló con status ${response.status}`);
    }
    
    return response.status === 200;
    
  } catch (error) {
    logError(`Health check falló: ${error.message}`);
    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

// ✅ TEST 2: WEBHOOK GET VERIFICATION
async function testWebhookGet() {
  logHeader('TEST 2: WEBHOOK GET VERIFICATION');
  
  try {
    logInfo('Verificando endpoint GET del webhook...');
    const response = await axios.get(`${CONFIG.BASE_URL}${CONFIG.WEBHOOK_PATH}`, {
      timeout: CONFIG.TIMEOUT,
      headers: {
        'User-Agent': 'Twilio-Verification-Test',
      },
    });

    logInfo(`Status Code: ${response.status}`);
    logInfo(`Response: ${response.data}`);
    
    if (response.status === 200) {
      logSuccess('Webhook GET respondió correctamente');
      return true;
    } else {
      logError(`Webhook GET falló con status ${response.status}`);
      return false;
    }
    
  } catch (error) {
    logError(`Webhook GET falló: ${error.message}`);
    return false;
  }
}

// ✅ TEST 3: WEBHOOK POST CON MENSAJE TEXTO
async function testWebhookTextMessage() {
  logHeader('TEST 3: WEBHOOK POST - MENSAJE TEXTO');
  
  const testData = {
    MessageSid: `SM${Date.now()}text1234567890`,
    AccountSid: 'AC1234567890abcdef1234567890abcdef',
    From: 'whatsapp:+1234567890',
    To: 'whatsapp:+0987654321',
    Body: 'Hola, este es un mensaje de prueba desde el script de testing',
    NumMedia: '0',
    MessageStatus: 'received',
    ApiVersion: '2010-04-01',
    ProfileName: 'Usuario Test Railway',
    WaId: '1234567890',
  };
  
  try {
    logInfo('Enviando mensaje de texto de prueba...');
    logInfo(`MessageSid: ${testData.MessageSid}`);
    
    const response = await axios.post(`${CONFIG.BASE_URL}${CONFIG.WEBHOOK_PATH}`, testData, {
      timeout: CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TwilioProxy/1.1',
        'X-Twilio-Signature': 'test-signature-for-development',
      },
    });

    logInfo(`Status Code: ${response.status}`);
    logInfo(`Response: ${JSON.stringify(response.data, null, 2)}`);
    
    if (response.status === 200) {
      logSuccess('Webhook procesó mensaje de texto correctamente');
      
      if (response.data.status === 'success') {
        logSuccess(`Mensaje guardado con ID: ${response.data.messageId || 'N/A'}`);
      } else if (response.data.status === 'error_logged') {
        logWarning('Mensaje procesado con errores pero respondió 200 OK');
        logWarning(`Error: ${response.data.error || 'N/A'}`);
      }
      
      return true;
    } else {
      logError(`Webhook falló con status ${response.status}`);
      return false;
    }
    
  } catch (error) {
    logError(`Webhook POST falló: ${error.message}`);
    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

// ✅ TEST 4: WEBHOOK POST CON MULTIMEDIA
async function testWebhookMediaMessage() {
  logHeader('TEST 4: WEBHOOK POST - MENSAJE CON IMAGEN');
  
  const testData = {
    MessageSid: `SM${Date.now()}media1234567890`,
    AccountSid: 'AC1234567890abcdef1234567890abcdef',
    From: 'whatsapp:+1234567890',
    To: 'whatsapp:+0987654321',
    Body: 'Mira esta imagen de prueba',
    NumMedia: '1',
    MediaUrl0: 'https://example.com/test-image.jpg',
    MediaContentType0: 'image/jpeg',
    MessageStatus: 'received',
    ApiVersion: '2010-04-01',
  };
  
  try {
    logInfo('Enviando mensaje con imagen de prueba...');
    
    const response = await axios.post(`${CONFIG.BASE_URL}${CONFIG.WEBHOOK_PATH}`, testData, {
      timeout: CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TwilioProxy/1.1',
      },
    });

    logInfo(`Status Code: ${response.status}`);
    
    if (response.status === 200) {
      logSuccess('Webhook procesó mensaje con media correctamente');
      return true;
    } else {
      logError(`Webhook media falló con status ${response.status}`);
      return false;
    }
    
  } catch (error) {
    logError(`Webhook media falló: ${error.message}`);
    return false;
  }
}

// ✅ TEST 5: WEBHOOK CON DATOS INCOMPLETOS
async function testWebhookIncompleteData() {
  logHeader('TEST 5: WEBHOOK POST - DATOS INCOMPLETOS');
  
  const testData = {
    AccountSid: 'AC1234567890abcdef1234567890abcdef',
    Body: 'Mensaje con datos incompletos',
    ApiVersion: '2010-04-01',
    // Faltan From, To, MessageSid intencionalmente
  };
  
  try {
    logInfo('Enviando mensaje con datos incompletos...');
    
    const response = await axios.post(`${CONFIG.BASE_URL}${CONFIG.WEBHOOK_PATH}`, testData, {
      timeout: CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TwilioProxy/1.1',
      },
    });

    logInfo(`Status Code: ${response.status}`);
    
    if (response.status === 200) {
      logSuccess('Webhook manejó datos incompletos correctamente (respuesta 200 OK)');
      logInfo('Esto es correcto: debe responder 200 OK incluso con datos faltantes');
      return true;
    } else {
      logError(`Webhook datos incompletos falló con status ${response.status}`);
      logError('CRÍTICO: Debe responder 200 OK incluso con errores');
      return false;
    }
    
  } catch (error) {
    logError(`Webhook datos incompletos falló: ${error.message}`);
    return false;
  }
}

// ✅ FUNCIÓN PRINCIPAL
async function runAllTests() {
  logHeader('🚀 INICIANDO TESTING COMPLETO DEL WEBHOOK RAILWAY');
  
  console.log(`${colors.blue}🌍 URL Base: ${CONFIG.BASE_URL}${colors.reset}`);
  console.log(`${colors.blue}🔗 Webhook: ${CONFIG.BASE_URL}${CONFIG.WEBHOOK_PATH}${colors.reset}`);
  console.log(`${colors.blue}🏥 Health: ${CONFIG.BASE_URL}${CONFIG.HEALTH_PATH}${colors.reset}\n`);
  
  const results = {
    healthCheck: false,
    webhookGet: false,
    webhookText: false,
    webhookMedia: false,
    webhookIncomplete: false,
  };
  
  // Ejecutar tests con pausas entre ellos
  results.healthCheck = await testHealthCheck();
  await sleep(1000);
  
  results.webhookGet = await testWebhookGet();
  await sleep(1000);
  
  results.webhookText = await testWebhookTextMessage();
  await sleep(1000);
  
  results.webhookMedia = await testWebhookMediaMessage();
  await sleep(1000);
  
  results.webhookIncomplete = await testWebhookIncompleteData();
  
  // ✅ RESUMEN FINAL
  logHeader('📊 RESUMEN DE RESULTADOS');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  
  console.log(`${colors.blue}Tests ejecutados: ${totalTests}${colors.reset}`);
  console.log(`${colors.green}Tests exitosos: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Tests fallidos: ${totalTests - passedTests}${colors.reset}\n`);
  
  // Detalles por test
  Object.entries(results).forEach(([testName, passed]) => {
    const status = passed ? `${colors.green}✅ PASSED` : `${colors.red}❌ FAILED`;
    console.log(`${status} ${testName}${colors.reset}`);
  });
  
  // ✅ RECOMENDACIONES FINALES
  logHeader('📋 PRÓXIMOS PASOS');
  
  if (passedTests === totalTests) {
    logSuccess('¡TODOS LOS TESTS PASARON! El webhook está funcionando correctamente.');
    console.log(`${colors.green}🎉 El sistema está listo para recibir mensajes de WhatsApp${colors.reset}`);
    console.log(`${colors.blue}🔗 Configurar en Twilio Console: ${CONFIG.BASE_URL}${CONFIG.WEBHOOK_PATH}${colors.reset}`);
  } else {
    logError('Algunos tests fallaron. Revisar logs de Railway y configuración.');
    console.log(`${colors.yellow}📋 Checklist de verificación:${colors.reset}`);
    console.log(`${colors.yellow}  1. Variables de entorno en Railway${colors.reset}`);
    console.log(`${colors.yellow}  2. Conexión Firebase${colors.reset}`);
    console.log(`${colors.yellow}  3. Configuración Twilio${colors.reset}`);
    console.log(`${colors.yellow}  4. Logs en Railway Dashboard${colors.reset}`);
  }
  
  process.exit(passedTests === totalTests ? 0 : 1);
}

// ✅ EJECUTAR TESTS
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error(`${colors.red}❌ Error ejecutando tests: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testHealthCheck,
  testWebhookTextMessage,
}; 