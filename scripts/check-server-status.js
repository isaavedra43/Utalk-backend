/**
 * 🔍 CHECK SERVER STATUS
 * 
 * Script para verificar el estado del servidor y ver si el fix se ha desplegado
 */

const axios = require('axios');

const BASE_URL = 'https://utalk-backend-production.up.railway.app';

async function checkServerStatus() {
  const logger = require('../src/utils/logger');
logger.info('Verificando estado del servidor...', { category: 'SERVER_STATUS_CHECK' });

  try {
    // Probar endpoint de health check
    logger.info('Probando health check...', { category: 'SERVER_STATUS_CHECK' });
    const healthResponse = await axios.get(`${BASE_URL}/health`, {
      timeout: 5000
    });
    logger.info('Health check exitoso', { 
      category: 'SERVER_STATUS_CHECK',
      status: healthResponse.status 
    });

    // Probar endpoint de logs básico
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📋 Probando endpoint de logs básico...' });
    const logsResponse = await axios.get(`${BASE_URL}/api/logs?limit=1`, {
      timeout: 10000
    });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Logs básico exitoso:', logsResponse.status });

    // Probar dashboard con más detalle
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📊 Probando dashboard con manejo de errores detallado...' });
    try {
      const dashboardResponse = await axios.get(`${BASE_URL}/api/logs/dashboard`, {
        timeout: 15000
      });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Dashboard exitoso:', dashboardResponse.status });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Response data:', {
        success: dashboardResponse.data.success,
        hasData: !!dashboardResponse.data.data,
        timestamp: dashboardResponse.data.data?.timestamp
      } });
    } catch (dashboardError) {
      console.error('❌ Dashboard falló:');
      if (dashboardError.response) {
        console.error('📊 Status:', dashboardError.response.status);
        console.error('📊 Error details:', dashboardError.response.data);
        
        // Verificar si el error es el mismo que antes
        if (dashboardError.response.data?.details?.includes('log.message.includes is not a function')) {
          logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n⚠️ El error persiste - el fix aún no se ha desplegado completamente' });
        } else {
          logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔧 El error ha cambiado - posible progreso en el fix' });
        }
      } else {
        console.error('📡 Error de red:', dashboardError.message);
      }
    }

  } catch (error) {
    console.error('❌ Error general del servidor:');
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📊 Data:', error.response.data);
    } else {
      console.error('📡 Error:', error.message);
    }
  }
}

// Ejecutar verificación
checkServerStatus(); 