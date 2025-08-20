const axios = require('axios');

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 TESTING: Health Check Endpoints');
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '==================================');

async function testHealthEndpoints() {
  const baseUrl = 'http://localhost:3001';
  
  const endpoints = [
    '/health',
    '/emergency-test',
    '/api/ai/health'
  ];

  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 Probando endpoints en:', baseUrl);
  
  for (const endpoint of endpoints) {
    try {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: `\n📍 Testing: ${endpoint}`);
      
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        timeout: 5000,
        validateStatus: () => true // No lanzar error por status codes
      });
      
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: `   Status: ${response.status}`);
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: `   Response:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
      
      if (response.status === 200) {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ Endpoint funcionando correctamente');
      } else {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ⚠️ Endpoint devolvió status no-200');
      }
      
    } catch (error) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: `   ❌ Error: ${error.message}`);
    }
  }
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎯 RESUMEN:');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- /health: Requerido por Railway para health checks');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- /emergency-test: Ruta de diagnóstico interno');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- /api/ai/health: Health check específico de IA');
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ Verificación de health endpoints completada');
}

// Ejecutar si el servidor está corriendo
testHealthEndpoints().catch(error => {
  logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error ejecutando pruebas:', error.message);
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n💡 Asegúrate de que el servidor esté corriendo en puerto 3001');
}); 