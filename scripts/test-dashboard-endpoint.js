/**
 * 🧪 TEST DASHBOARD ENDPOINT
 * 
 * Script para probar que el endpoint /api/logs/dashboard funciona correctamente
 * después del fix del LogMonitorService
 */

const axios = require('axios');

const BASE_URL = 'https://utalk-backend-production.up.railway.app';

async function testDashboardEndpoint() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Probando endpoint /api/logs/dashboard...\n' });

  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📡 Haciendo petición GET a /api/logs/dashboard...' });
    
    const response = await axios.get(`${BASE_URL}/api/logs/dashboard`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Test-Script/1.0'
      }
    });

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Respuesta exitosa!' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Status:', response.status });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Headers:', {
      'content-type': response.headers['content-type'],
      'content-length': response.headers['content-length']
    } });

    const data = response.data;
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Response data:', {
      success: data.success,
      hasStats: !!data.data?.stats,
      hasRateLimitMetrics: !!data.data?.rateLimitMetrics,
      timestamp: data.data?.timestamp
    } });

    if (data.data?.stats) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📈 Stats:', {
        total: data.data.stats.total,
        lastHour: data.data.stats.lastHour,
        last24Hours: data.data.stats.last24Hours,
        byLevel: data.data.stats.byLevel
      } });
    }

    if (data.data?.rateLimitMetrics) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚦 Rate Limit Metrics:', {
        total: data.data.rateLimitMetrics.total,
        lastHour: data.data.rateLimitMetrics.lastHour,
        timelineLength: data.data.rateLimitMetrics.timeline?.length || 0
      } });
    }

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 ¡Endpoint funcionando correctamente!' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ El fix del LogMonitorService fue exitoso' });

  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error al probar el endpoint:');
    
    if (error.response) {
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '📊 Status:', error.response.status);
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '📊 Status Text:', error.response.statusText);
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '📊 Headers:', error.response.headers);
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '📊 Data:', error.response.data);
    } else if (error.request) {
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '📡 Error de red:', error.message);
    } else {
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '🔧 Error:', error.message);
    }
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n❌ El endpoint aún tiene problemas' });
  }
}

// Ejecutar la prueba
testDashboardEndpoint(); 