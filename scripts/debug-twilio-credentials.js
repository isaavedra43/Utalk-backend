#!/usr/bin/env node

/**
 * 🔍 DIAGNÓSTICO COMPLETO DE CREDENCIALES TWILIO
 * 
 * Este script diagnostica exactamente por qué fallan las credenciales de Twilio
 */

require('dotenv').config();

console.log('🔍 ========================================');
console.log('🔍 DIAGNÓSTICO TWILIO - CREDENCIALES');
console.log('🔍 ========================================\n');

// 1️⃣ VERIFICAR VARIABLES DE ENTORNO
console.log('1️⃣ VARIABLES DE ENTORNO:');
console.log('----------------------------');

const requiredVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER'];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 10)}... (${value.length} caracteres)`);
  } else {
    console.log(`❌ ${varName}: NO DEFINIDA`);
  }
});

console.log('\n');

// 2️⃣ VERIFICAR FORMATO
console.log('2️⃣ VERIFICACIÓN DE FORMATO:');
console.log('----------------------------');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

if (accountSid) {
  if (accountSid.startsWith('AC')) {
    console.log('✅ TWILIO_ACCOUNT_SID: Formato correcto (AC...)');
  } else {
    console.log(`❌ TWILIO_ACCOUNT_SID: Formato incorrecto. Debe empezar con "AC", actual: "${accountSid.substring(0, 5)}..."`);
  }
} else {
  console.log('❌ TWILIO_ACCOUNT_SID: NO DEFINIDA');
}

if (authToken) {
  if (authToken.length >= 32) {
    console.log('✅ TWILIO_AUTH_TOKEN: Longitud correcta');
  } else {
    console.log(`❌ TWILIO_AUTH_TOKEN: Muy corto (${authToken.length} caracteres, mínimo 32)`);
  }
} else {
  console.log('❌ TWILIO_AUTH_TOKEN: NO DEFINIDA');
}

if (whatsappNumber) {
  if (whatsappNumber.startsWith('whatsapp:')) {
    console.log('✅ TWILIO_WHATSAPP_NUMBER: Formato correcto (whatsapp:...)');
  } else {
    console.log(`❌ TWILIO_WHATSAPP_NUMBER: Formato incorrecto. Debe empezar con "whatsapp:", actual: "${whatsappNumber}"`);
  }
} else {
  console.log('❌ TWILIO_WHATSAPP_NUMBER: NO DEFINIDA');
}

console.log('\n');

// 3️⃣ PROBAR CONEXIÓN TWILIO
console.log('3️⃣ PRUEBA DE CONEXIÓN:');
console.log('----------------------------');

if (accountSid && authToken) {
  try {
    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);
    
    console.log('🔄 Probando conexión con Twilio...');
    
    client.api.accounts(accountSid)
      .fetch()
      .then((account) => {
        console.log('✅ CONEXIÓN EXITOSA');
        console.log(`   - Account Status: ${account.status}`);
        console.log(`   - Account SID: ${account.sid}`);
        console.log(`   - Date Created: ${account.dateCreated}`);
        console.log('\n🎉 LAS CREDENCIALES ESTÁN CORRECTAS');
        console.log('❗ El problema puede ser temporal de Twilio o de red');
      })
      .catch((error) => {
        console.log('❌ ERROR DE CONEXIÓN:');
        console.log(`   - Código: ${error.code || 'No disponible'}`);
        console.log(`   - Mensaje: ${error.message}`);
        console.log(`   - Status: ${error.status || 'No disponible'}`);
        
        if (error.code === 20003) {
          console.log('\n🔥 PROBLEMA IDENTIFICADO:');
          console.log('   Las credenciales están incorrectas o expiraron');
          console.log('   Revisa en Twilio Console que:');
          console.log('   1. El Account SID sea correcto');
          console.log('   2. El Auth Token no haya expirado');
          console.log('   3. La cuenta esté activa');
        }
      });
      
  } catch (requireError) {
    console.log('❌ ERROR CARGANDO TWILIO:');
    console.log(`   ${requireError.message}`);
  }
} else {
  console.log('⚠️  No se puede probar conexión: faltan credenciales');
}

console.log('\n');

// 4️⃣ ANÁLISIS FINAL
console.log('4️⃣ ANÁLISIS Y RECOMENDACIONES:');
console.log('----------------------------');

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('❌ FALTAN VARIABLES:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  console.log('\n📋 ACCIÓN REQUERIDA:');
  console.log('   1. Configura las variables faltantes en Railway');
  console.log('   2. Reinicia el servicio');
} else {
  console.log('✅ Todas las variables están definidas');
  console.log('\n🔍 SI EL ERROR PERSISTE:');
  console.log('   1. Verifica que las credenciales sean las más actuales');
  console.log('   2. Genera un nuevo Auth Token en Twilio Console');
  console.log('   3. Asegúrate de que la cuenta Twilio esté activa');
  console.log('   4. Revisa que no haya restricciones de IP');
}

console.log('\n🔗 ENLACES ÚTILES:');
console.log('   - Twilio Console: https://console.twilio.com/');
console.log('   - API Keys: https://console.twilio.com/us1/account/keys-credentials/api-keys');
console.log('   - Account Dashboard: https://console.twilio.com/us1/account');

console.log('\n🔍 ========================================');
console.log('🔍 FIN DEL DIAGNÓSTICO');
console.log('🔍 ========================================');
