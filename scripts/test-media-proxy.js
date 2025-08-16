/**
 * SCRIPT DE PRUEBA PARA EL ENDPOINT PROXY DE MEDIA
 * Prueba el endpoint /api/media/proxy que acabamos de implementar
 */

const axios = require('axios');

// Configuración
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'your-test-token-here';

// Datos de prueba basados en los logs
const TEST_DATA = {
  messageSid: 'MMa4e6b8ea9a2da0e405b7d7244174e350',
  mediaSid: 'ME29ecf51d959860aa1c78acee75de38d2'
};

async function testMediaProxy() {
  console.log('🧪 INICIANDO PRUEBA DEL ENDPOINT PROXY DE MEDIA');
  console.log('=' .repeat(60));
  
  try {
    // 1. Probar endpoint sin autenticación (debería fallar)
    console.log('\n1️⃣ Probando sin autenticación...');
    try {
      const response = await axios.get(`${BASE_URL}/api/media/proxy`, {
        params: TEST_DATA,
        timeout: 10000
      });
      console.log('❌ ERROR: Debería haber fallado sin autenticación');
      console.log('Status:', response.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correcto: Falló con 401 (sin autenticación)');
      } else {
        console.log('⚠️ Falló con error diferente:', error.response?.status || error.message);
      }
    }

    // 2. Probar endpoint con autenticación
    console.log('\n2️⃣ Probando con autenticación...');
    try {
      const response = await axios.get(`${BASE_URL}/api/media/proxy`, {
        params: TEST_DATA,
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        responseType: 'stream'
      });

      console.log('✅ ÉXITO: Endpoint responde correctamente');
      console.log('Status:', response.status);
      console.log('Content-Type:', response.headers['content-type']);
      console.log('Content-Length:', response.headers['content-length']);
      console.log('Cache-Control:', response.headers['cache-control']);
      console.log('X-Proxy-By:', response.headers['x-proxy-by']);
      console.log('X-Twilio-Message-Sid:', response.headers['x-twilio-message-sid']);
      console.log('X-Twilio-Media-Sid:', response.headers['x-twilio-media-sid']);

      // Contar bytes recibidos
      let bytesReceived = 0;
      response.data.on('data', (chunk) => {
        bytesReceived += chunk.length;
      });

      response.data.on('end', () => {
        console.log(`📊 Bytes recibidos: ${bytesReceived}`);
        console.log('✅ Stream completado exitosamente');
      });

      response.data.on('error', (error) => {
        console.log('❌ Error en stream:', error.message);
      });

    } catch (error) {
      console.log('❌ Error en petición autenticada:');
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Error:', error.response.data);
      } else {
        console.log('Error:', error.message);
      }
    }

    // 3. Probar con parámetros inválidos
    console.log('\n3️⃣ Probando con parámetros inválidos...');
    try {
      const response = await axios.get(`${BASE_URL}/api/media/proxy`, {
        params: {
          messageSid: 'invalid-sid',
          mediaSid: 'invalid-media'
        },
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      console.log('❌ ERROR: Debería haber fallado con parámetros inválidos');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Correcto: Falló con 400 (parámetros inválidos)');
      } else {
        console.log('⚠️ Falló con error diferente:', error.response?.status || error.message);
      }
    }

    // 4. Probar sin parámetros
    console.log('\n4️⃣ Probando sin parámetros...');
    try {
      const response = await axios.get(`${BASE_URL}/api/media/proxy`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      console.log('❌ ERROR: Debería haber fallado sin parámetros');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Correcto: Falló con 400 (parámetros faltantes)');
      } else {
        console.log('⚠️ Falló con error diferente:', error.response?.status || error.message);
      }
    }

  } catch (error) {
    console.log('❌ Error general en la prueba:', error.message);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 PRUEBA COMPLETADA');
}

// Ejecutar prueba
if (require.main === module) {
  testMediaProxy().catch(console.error);
}

module.exports = { testMediaProxy }; 