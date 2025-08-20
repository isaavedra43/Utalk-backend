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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 INICIANDO PRUEBA DEL ENDPOINT PROXY DE MEDIA' });
  console.log('=' .repeat(60));
  
  try {
    // 1. Probar endpoint sin autenticación (debería fallar)
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n1️⃣ Probando sin autenticación...' });
    try {
      const response = await axios.get(`${BASE_URL}/api/media/proxy`, {
        params: TEST_DATA,
        timeout: 10000
      });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ ERROR: Debería haber fallado sin autenticación' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Status:', response.status });
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correcto: Falló con 401 (sin autenticación)');
      } else {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️ Falló con error diferente:', error.response?.status || error.message });
      }
    }

    // 2. Probar endpoint con autenticación
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n2️⃣ Probando con autenticación...' });
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

      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ ÉXITO: Endpoint responde correctamente' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Status:', response.status });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Content-Type:', response.headers['content-type'] });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Content-Length:', response.headers['content-length'] });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Cache-Control:', response.headers['cache-control'] });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'X-Proxy-By:', response.headers['x-proxy-by'] });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'X-Twilio-Message-Sid:', response.headers['x-twilio-message-sid'] });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'X-Twilio-Media-Sid:', response.headers['x-twilio-media-sid'] });

      // Contar bytes recibidos
      let bytesReceived = 0;
      response.data.on('data', (chunk) => {
        bytesReceived += chunk.length;
      });

      response.data.on('end', () => {
        logger.info('Bytes recibidos: ${bytesReceived}', { category: 'AUTO_MIGRATED' });
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Stream completado exitosamente' });
      });

      response.data.on('error', (error) => {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en stream:', error.message });
      });

    } catch (error) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en petición autenticada:' });
      if (error.response) {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Status:', error.response.status });
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Error:', error.response.data });
      } else {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Error:', error.message });
      }
    }

    // 3. Probar con parámetros inválidos
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n3️⃣ Probando con parámetros inválidos...' });
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
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ ERROR: Debería haber fallado con parámetros inválidos' });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Correcto: Falló con 400 (parámetros inválidos)');
      } else {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️ Falló con error diferente:', error.response?.status || error.message });
      }
    }

    // 4. Probar sin parámetros
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n4️⃣ Probando sin parámetros...' });
    try {
      const response = await axios.get(`${BASE_URL}/api/media/proxy`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ ERROR: Debería haber fallado sin parámetros' });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Correcto: Falló con 400 (parámetros faltantes)');
      } else {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️ Falló con error diferente:', error.response?.status || error.message });
      }
    }

  } catch (error) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error general en la prueba:', error.message });
  }

  console.log('\n' + '=' .repeat(60));
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🏁 PRUEBA COMPLETADA' });
}

// Ejecutar prueba
if (require.main === module) {
  testMediaProxy().catch(console.error);
}

module.exports = { testMediaProxy }; 