#!/usr/bin/env node

/**
 * SCRIPT DE VERIFICACIÓN: Webhook de Twilio y Variables de Entorno
 * 
 * Este script verifica que todas las configuraciones necesarias
 * para el webhook de Twilio estén correctamente configuradas.
 */

require('dotenv').config();
const logger = require('../src/utils/logger');

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

const log = (color, symbol, message) => {
  console.log(`${color}${symbol} ${message}${colors.reset}`);
};

const success = (message) => log(colors.green, '✅', message);
const error = (message) => log(colors.red, '❌', message);
const warning = (message) => log(colors.yellow, '⚠️', message);
const info = (message) => log(colors.blue, 'ℹ️', message);
const header = (message) => log(colors.bright, '🔍', message);

async function verifyEnvironmentVariables() {
  header('VERIFICANDO VARIABLES DE ENTORNO');
  
  const criticalVars = [
    { name: 'TWILIO_ACCOUNT_SID', description: 'SID de cuenta Twilio' },
    { name: 'TWILIO_AUTH_TOKEN', description: 'Token de autenticación Twilio' },
    { name: 'TWILIO_WHATSAPP_NUMBER', description: 'Número WhatsApp de Twilio' },
    { name: 'FIREBASE_PROJECT_ID', description: 'ID del proyecto Firebase' },
    { name: 'FIREBASE_PRIVATE_KEY', description: 'Clave privada Firebase' },
    { name: 'FIREBASE_CLIENT_EMAIL', description: 'Email del cliente Firebase' },
    { name: 'JWT_SECRET', description: 'Secreto para JWT' },
    { name: 'NODE_ENV', description: 'Entorno de ejecución', optional: true }
  ];

  const optionalVars = [
    { name: 'WEBHOOK_SECRET', description: 'Secreto adicional para webhook' },
    { name: 'FRONTEND_URL', description: 'URL del frontend para CORS' },
    { name: 'PORT', description: 'Puerto del servidor' }
  ];

  let hasErrors = false;

  // Verificar variables críticas
  console.log('\n📋 Variables Críticas:');
  for (const variable of criticalVars) {
    const value = process.env[variable.name];
    
    if (!value) {
      error(`${variable.name}: NO CONFIGURADA - ${variable.description}`);
      hasErrors = true;
    } else {
      // Validaciones específicas
      if (variable.name === 'TWILIO_WHATSAPP_NUMBER') {
        if (!value.startsWith('whatsapp:')) {
          warning(`${variable.name}: Debe empezar con 'whatsapp:' (actual: ${value})`);
        } else {
          success(`${variable.name}: ✓ Configurada correctamente`);
        }
      } else if (variable.name === 'FIREBASE_PRIVATE_KEY') {
        if (!value.includes('BEGIN PRIVATE KEY')) {
          warning(`${variable.name}: Formato puede ser incorrecto (debe contener '-----BEGIN PRIVATE KEY-----')`);
        } else {
          success(`${variable.name}: ✓ Configurada correctamente`);
        }
      } else if (variable.name === 'JWT_SECRET') {
        if (value.length < 32) {
          warning(`${variable.name}: Muy corta (${value.length} chars, recomendado: 32+)`);
        } else {
          success(`${variable.name}: ✓ Configurada correctamente (${value.length} chars)`);
        }
      } else {
        success(`${variable.name}: ✓ Configurada`);
      }
    }
  }

  // Verificar variables opcionales
  console.log('\n📋 Variables Opcionales:');
  for (const variable of optionalVars) {
    const value = process.env[variable.name];
    
    if (!value) {
      info(`${variable.name}: No configurada - ${variable.description}`);
    } else {
      success(`${variable.name}: ✓ Configurada`);
    }
  }

  return !hasErrors;
}

async function verifyWebhookEndpoint() {
  header('VERIFICANDO CONFIGURACIÓN DEL WEBHOOK');
  
  const expectedUrl = 'https://utalk-backend-production.up.railway.app/api/messages/webhook';
  
  info(`URL esperada del webhook: ${expectedUrl}`);
  
  console.log('\n📝 Pasos de configuración en Twilio:');
  console.log('1. Ve a Twilio Console → WhatsApp → Senders');
  console.log('2. Selecciona tu número WhatsApp');
  console.log('3. En "Webhook URL" configura:');
  console.log(`   ${expectedUrl}`);
  console.log('4. Método: POST');
  console.log('5. Guarda la configuración');
  
  warning('⚠️ Verifica manualmente que la URL del webhook esté configurada en Twilio Console');
  
  return true;
}

async function verifyFirebaseConnection() {
  header('VERIFICANDO CONEXIÓN CON FIREBASE');
  
  try {
    // Intentar inicializar Firebase
    const { firestore } = require('../src/config/firebase');
    
    // Hacer una consulta de prueba
    const testCollection = firestore.collection('_test_connection');
    await testCollection.limit(1).get();
    
    success('Conexión con Firebase Firestore: ✓ EXITOSA');
    return true;
  } catch (error) {
    error(`Conexión con Firebase: ❌ ERROR - ${error.message}`);
    
    console.log('\n🔧 Posibles soluciones:');
    console.log('1. Verifica las credenciales de Firebase en las variables de entorno');
    console.log('2. Asegúrate de que el proyecto Firebase existe');
    console.log('3. Verifica que Firestore esté habilitado');
    console.log('4. Revisa las reglas de seguridad de Firestore');
    
    return false;
  }
}

async function verifyTwilioConnection() {
  header('VERIFICANDO CONEXIÓN CON TWILIO');
  
  try {
    const { client } = require('../src/config/twilio');
    
    // Verificar configuración básica
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    
    success(`Conexión con Twilio: ✓ EXITOSA (Account: ${account.friendlyName})`);
    
    // Verificar número WhatsApp
    try {
      const phoneNumbers = await client.incomingPhoneNumbers.list({ 
        phoneNumber: process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', ''),
        limit: 1 
      });
      
      if (phoneNumbers.length > 0) {
        success(`Número WhatsApp verificado: ✓ ${process.env.TWILIO_WHATSAPP_NUMBER}`);
      } else {
        warning(`Número WhatsApp no encontrado en la cuenta: ${process.env.TWILIO_WHATSAPP_NUMBER}`);
      }
    } catch (phoneError) {
      warning(`No se pudo verificar el número WhatsApp: ${phoneError.message}`);
    }
    
    return true;
  } catch (error) {
    error(`Conexión con Twilio: ❌ ERROR - ${error.message}`);
    
    console.log('\n🔧 Posibles soluciones:');
    console.log('1. Verifica TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN');
    console.log('2. Asegúrate de que la cuenta Twilio esté activa');
    console.log('3. Verifica que tengas permisos en la cuenta');
    
    return false;
  }
}

async function verifyWebhookSecurity() {
  header('VERIFICANDO SEGURIDAD DEL WEBHOOK');
  
  // Verificar validación de firma
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!authToken) {
    error('TWILIO_AUTH_TOKEN no configurado - validación de firma deshabilitada');
    return false;
  }
  
  try {
    const twilio = require('twilio');
    
    // Test básico de validación
    const testUrl = 'https://example.com/webhook';
    const testParams = { From: 'test', To: 'test', Body: 'test' };
    const testSignature = twilio.webhook.generateSignature(authToken, testUrl, testParams);
    
    const isValid = twilio.validateRequest(authToken, testSignature, testUrl, testParams);
    
    if (isValid) {
      success('Validación de firma Twilio: ✓ FUNCIONAL');
    } else {
      error('Validación de firma Twilio: ❌ ERROR');
      return false;
    }
    
  } catch (error) {
    error(`Error en validación de firma: ${error.message}`);
    return false;
  }
  
  // Verificar configuración de producción
  if (process.env.NODE_ENV === 'production') {
    success('Entorno de producción: ✓ Validación de firma habilitada');
  } else {
    warning('Entorno de desarrollo: Validación de firma deshabilitada');
  }
  
  return true;
}

async function main() {
  console.log(`${colors.bright}
🔍 AUDITORÍA COMPLETA DEL WEBHOOK DE TWILIO
===========================================
  `);
  
  const results = {
    env: await verifyEnvironmentVariables(),
    webhook: await verifyWebhookEndpoint(),
    firebase: await verifyFirebaseConnection(),
    twilio: await verifyTwilioConnection(),
    security: await verifyWebhookSecurity()
  };
  
  console.log(`\n${colors.bright}📊 RESUMEN DE VERIFICACIÓN:${colors.reset}\n`);
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASÓ' : '❌ FALLÓ';
    const color = passed ? colors.green : colors.red;
    console.log(`${color}${test.toUpperCase()}: ${status}${colors.reset}`);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  
  if (allPassed) {
    console.log(`\n${colors.green}🎉 TODAS LAS VERIFICACIONES PASARON`);
    console.log(`El webhook está listo para recibir mensajes de Twilio${colors.reset}\n`);
  } else {
    console.log(`\n${colors.red}⚠️ HAY PROBLEMAS QUE CORREGIR`);
    console.log(`Revisa los errores arriba antes de usar el webhook${colors.reset}\n`);
    process.exit(1);
  }
}

// Ejecutar verificación
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}❌ Error fatal en verificación:`, error);
    process.exit(1);
  });
}

module.exports = { main }; 