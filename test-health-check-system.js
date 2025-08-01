/**
 * 🧪 SCRIPT DE PRUEBA: SISTEMA DE HEALTH CHECK ROBUSTO
 * 
 * Este script prueba el nuevo sistema de health check para verificar
 * que todos los servicios críticos se validan correctamente.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const HealthCheckService = require('./src/services/HealthCheckService');

/**
 * Probar health check completo
 */
async function testCompleteHealthCheck() {
  console.log('\n🏥 PROBANDO: Health check completo del sistema');
  
  try {
    const healthService = new HealthCheckService();
    const startTime = Date.now();
    
    const healthData = await healthService.runAllHealthChecks();
    const totalTime = Date.now() - startTime;
    
    console.log('✅ Health check completado:', {
      status: healthData.status,
      totalTime: `${totalTime}ms`,
      totalChecks: healthData.summary.total,
      healthyChecks: healthData.summary.healthy,
      failedChecks: healthData.summary.failed,
      failedServices: healthData.failedChecks
    });
    
    // Mostrar detalles de cada check
    console.log('\n📊 DETALLES POR SERVICIO:');
    for (const [serviceName, result] of Object.entries(healthData.checks)) {
      const status = result.status === 'healthy' ? '✅' : '❌';
      const responseTime = result.responseTime || 'N/A';
      console.log(`${status} ${serviceName}: ${result.status} (${responseTime})`);
      
      if (result.status !== 'healthy' && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
    
    return healthData;
    
  } catch (error) {
    console.error('❌ Error en health check completo:', error.message);
    throw error;
  }
}

/**
 * Probar health check individual de Firestore
 */
async function testFirestoreHealthCheck() {
  console.log('\n🗄️ PROBANDO: Health check de Firestore');
  
  try {
    const healthService = new HealthCheckService();
    const result = await healthService.checkFirestore();
    
    console.log('✅ Health check de Firestore:', {
      status: result.status,
      responseTime: result.responseTime,
      operations: result.operations,
      projectId: result.projectId
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en health check de Firestore:', error.message);
    throw error;
  }
}

/**
 * Probar health check individual de Storage
 */
async function testStorageHealthCheck() {
  console.log('\n📁 PROBANDO: Health check de Firebase Storage');
  
  try {
    const healthService = new HealthCheckService();
    const result = await healthService.checkStorage();
    
    console.log('✅ Health check de Storage:', {
      status: result.status,
      responseTime: result.responseTime,
      operations: result.operations,
      bucketName: result.bucketName
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en health check de Storage:', error.message);
    throw error;
  }
}

/**
 * Probar health check individual de Redis
 */
async function testRedisHealthCheck() {
  console.log('\n🗄️ PROBANDO: Health check de Redis');
  
  try {
    const healthService = new HealthCheckService();
    const result = await healthService.checkRedis();
    
    console.log('✅ Health check de Redis:', {
      status: result.status,
      responseTime: result.responseTime,
      operations: result.operations
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en health check de Redis:', error.message);
    throw error;
  }
}

/**
 * Probar health check individual de Twilio
 */
async function testTwilioHealthCheck() {
  console.log('\n📞 PROBANDO: Health check de Twilio');
  
  try {
    const healthService = new HealthCheckService();
    const result = await healthService.checkTwilio();
    
    console.log('✅ Health check de Twilio:', {
      status: result.status,
      responseTime: result.responseTime,
      accountSid: result.accountSid,
      whatsappNumber: result.whatsappNumber
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en health check de Twilio:', error.message);
    throw error;
  }
}

/**
 * Probar health check del sistema de archivos
 */
async function testFilesystemHealthCheck() {
  console.log('\n💾 PROBANDO: Health check del sistema de archivos');
  
  try {
    const healthService = new HealthCheckService();
    const result = await healthService.checkFilesystem();
    
    console.log('✅ Health check del sistema de archivos:', {
      status: result.status,
      responseTime: result.responseTime,
      operations: result.operations,
      diskUsage: result.diskUsage,
      freeSpace: result.freeSpace
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en health check del sistema de archivos:', error.message);
    throw error;
  }
}

/**
 * Probar health check de memoria
 */
async function testMemoryHealthCheck() {
  console.log('\n🧠 PROBANDO: Health check de memoria');
  
  try {
    const healthService = new HealthCheckService();
    const result = await healthService.checkMemory();
    
    console.log('✅ Health check de memoria:', {
      status: result.status,
      usagePercent: result.usagePercent,
      threshold: result.threshold,
      heapUsed: result.heapUsed,
      heapTotal: result.heapTotal
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en health check de memoria:', error.message);
    throw error;
  }
}

/**
 * Probar health check de CPU
 */
async function testCPUHealthCheck() {
  console.log('\n⚡ PROBANDO: Health check de CPU');
  
  try {
    const healthService = new HealthCheckService();
    const result = await healthService.checkCPU();
    
    console.log('✅ Health check de CPU:', {
      status: result.status,
      usagePercent: result.usagePercent,
      threshold: result.threshold
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en health check de CPU:', error.message);
    throw error;
  }
}

/**
 * Probar health check de servicios internos
 */
async function testInternalServicesHealthCheck() {
  console.log('\n🔧 PROBANDO: Health check de servicios internos');
  
  try {
    const healthService = new HealthCheckService();
    const result = await healthService.checkInternalServices();
    
    console.log('✅ Health check de servicios internos:', {
      status: result.status,
      services: result.services
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en health check de servicios internos:', error.message);
    throw error;
  }
}

/**
 * Simular endpoint /health
 */
async function testHealthEndpoint() {
  console.log('\n🌐 PROBANDO: Endpoint /health');
  
  try {
    const HealthCheckService = require('./src/services/HealthCheckService');
    const healthService = new HealthCheckService();
    
    const healthData = await healthService.runAllHealthChecks();
    
    // Simular respuesta HTTP
    const httpStatus = healthData.status === 'healthy' ? 200 : 503;
    
    console.log('✅ Simulación de endpoint /health:', {
      httpStatus,
      status: healthData.status,
      totalTime: healthData.totalTime,
      summary: healthData.summary
    });
    
    return {
      httpStatus,
      healthData
    };
    
  } catch (error) {
    console.error('❌ Error simulando endpoint /health:', error.message);
    throw error;
  }
}

/**
 * Ejecutar todas las pruebas
 */
async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS DEL SISTEMA DE HEALTH CHECK');
  console.log('=' .repeat(60));
  
  try {
    // Ejecutar pruebas en paralelo
    const results = await Promise.allSettled([
      testCompleteHealthCheck(),
      testFirestoreHealthCheck(),
      testStorageHealthCheck(),
      testRedisHealthCheck(),
      testTwilioHealthCheck(),
      testFilesystemHealthCheck(),
      testMemoryHealthCheck(),
      testCPUHealthCheck(),
      testInternalServicesHealthCheck(),
      testHealthEndpoint()
    ]);
    
    // Analizar resultados
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESUMEN DE PRUEBAS:');
    console.log(`✅ Exitosas: ${successful}`);
    console.log(`❌ Fallidas: ${failed}`);
    console.log(`📈 Tasa de éxito: ${((successful / results.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ PRUEBAS FALLIDAS:');
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const testNames = [
            'Health Check Completo',
            'Firestore',
            'Storage',
            'Redis',
            'Twilio',
            'Sistema de Archivos',
            'Memoria',
            'CPU',
            'Servicios Internos',
            'Endpoint /health'
          ];
          console.log(`  - ${testNames[index]}: ${result.reason.message}`);
        }
      });
    }
    
    if (successful === results.length) {
      console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON! El sistema de health check está funcionando correctamente.');
    } else {
      console.log('\n⚠️ Algunas pruebas fallaron. Revisa los errores arriba.');
    }
    
  } catch (error) {
    console.error('💥 Error ejecutando pruebas:', error.message);
  }
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
  runAllTests().then(() => {
    console.log('\n🏁 Pruebas completadas.');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Error fatal:', error.message);
    process.exit(1);
  });
}

module.exports = {
  testCompleteHealthCheck,
  testFirestoreHealthCheck,
  testStorageHealthCheck,
  testRedisHealthCheck,
  testTwilioHealthCheck,
  testFilesystemHealthCheck,
  testMemoryHealthCheck,
  testCPUHealthCheck,
  testInternalServicesHealthCheck,
  testHealthEndpoint,
  runAllTests
}; 