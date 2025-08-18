/**
 * 🧪 TEST DASHBOARD ENDPOINT
 * 
 * Script para probar que el endpoint /api/logs/dashboard funciona correctamente
 * después del fix del LogMonitorService
 */

const axios = require('axios');

const BASE_URL = 'https://utalk-backend-production.up.railway.app';

async function testDashboardEndpoint() {
  console.log('🧪 Probando endpoint /api/logs/dashboard...\n');

  try {
    console.log('📡 Haciendo petición GET a /api/logs/dashboard...');
    
    const response = await axios.get(`${BASE_URL}/api/logs/dashboard`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Test-Script/1.0'
      }
    });

    console.log('✅ Respuesta exitosa!');
    console.log('📊 Status:', response.status);
    console.log('📊 Headers:', {
      'content-type': response.headers['content-type'],
      'content-length': response.headers['content-length']
    });

    const data = response.data;
    console.log('📊 Response data:', {
      success: data.success,
      hasStats: !!data.data?.stats,
      hasRateLimitMetrics: !!data.data?.rateLimitMetrics,
      timestamp: data.data?.timestamp
    });

    if (data.data?.stats) {
      console.log('📈 Stats:', {
        total: data.data.stats.total,
        lastHour: data.data.stats.lastHour,
        last24Hours: data.data.stats.last24Hours,
        byLevel: data.data.stats.byLevel
      });
    }

    if (data.data?.rateLimitMetrics) {
      console.log('🚦 Rate Limit Metrics:', {
        total: data.data.rateLimitMetrics.total,
        lastHour: data.data.rateLimitMetrics.lastHour,
        timelineLength: data.data.rateLimitMetrics.timeline?.length || 0
      });
    }

    console.log('\n🎉 ¡Endpoint funcionando correctamente!');
    console.log('✅ El fix del LogMonitorService fue exitoso');

  } catch (error) {
    console.error('❌ Error al probar el endpoint:');
    
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📊 Status Text:', error.response.statusText);
      console.error('📊 Headers:', error.response.headers);
      console.error('📊 Data:', error.response.data);
    } else if (error.request) {
      console.error('📡 Error de red:', error.message);
    } else {
      console.error('🔧 Error:', error.message);
    }
    
    console.log('\n❌ El endpoint aún tiene problemas');
  }
}

// Ejecutar la prueba
testDashboardEndpoint(); 