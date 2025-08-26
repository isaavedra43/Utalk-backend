#!/usr/bin/env node

/**
 * Script para verificar la conexión a LLM Studio a través de ngrok
 * Uso: node scripts/test-ngrok-connection.js
 */

const axios = require('axios');

const NGROK_URL = 'https://dd067794d343.ngrok-free.app';

async function testNgrokConnection() {
  console.log('🔍 Probando conexión a LLM Studio a través de ngrok...\n');
  
  try {
    // 1. Probar conexión básica
    console.log('1️⃣ Probando conexión básica...');
    const healthResponse = await axios.get(`${NGROK_URL}/health`, {
      timeout: 10000
    });
    console.log('   ✅ Conexión exitosa');
    console.log('   📊 Status:', healthResponse.status);
    
    // 2. Probar endpoint de modelos
    console.log('\n2️⃣ Probando endpoint de modelos...');
    const modelsResponse = await axios.get(`${NGROK_URL}/v1/models`, {
      timeout: 10000
    });
    console.log('   ✅ Modelos disponibles');
    console.log('   📋 Modelos:', modelsResponse.data.data?.map(m => m.id).join(', '));
    
    // 3. Probar generación de texto
    console.log('\n3️⃣ Probando generación de texto...');
    const completionPayload = {
      model: 'microsoft/phi-4-reasoning-plus',
      prompt: 'Hola, ¿cómo estás?',
      max_tokens: 50,
      temperature: 0.7
    };
    
    const completionResponse = await axios.post(`${NGROK_URL}/v1/completions`, completionPayload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('   ✅ Generación exitosa');
    console.log('   💬 Respuesta:', completionResponse.data.choices?.[0]?.text?.trim());
    
    console.log('\n🎉 ¡Todas las pruebas pasaron! LLM Studio está funcionando correctamente a través de ngrok.');
    console.log(`🌐 URL pública: ${NGROK_URL}`);
    console.log('\n📝 Ahora puedes configurar esta URL en Railway como LLM_STUDIO_URL');
    
  } catch (error) {
    console.error('\n❌ Error en las pruebas:');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   🔌 No se puede conectar al servidor. Verifica que:');
      console.error('      - LLM Studio esté ejecutándose en puerto 1234');
      console.error('      - ngrok esté activo y apuntando al puerto correcto');
    } else if (error.code === 'ENOTFOUND') {
      console.error('   🌐 No se puede resolver la URL. Verifica que:');
      console.error('      - La URL de ngrok sea correcta');
      console.error('      - ngrok esté funcionando');
    } else if (error.response) {
      console.error('   📡 Error HTTP:', error.response.status);
      console.error('   📄 Respuesta:', error.response.data);
    } else {
      console.error('   ⚠️ Error inesperado:', error.message);
    }
    
    console.log('\n🔧 Solución:');
    console.log('   1. Verifica que LLM Studio esté corriendo en puerto 1234');
    console.log('   2. Verifica que ngrok esté activo: ngrok http 1234');
    console.log('   3. Usa la URL correcta de ngrok');
  }
}

// Ejecutar el test
testNgrokConnection();
