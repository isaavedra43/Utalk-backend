const axios = require('axios');
const { logger } = require('../src/utils/logger');

/**
 * 🔍 SCRIPT DE DIAGNÓSTICO DE DESPLIEGUE
 * 
 * Verifica el estado del sistema después del despliegue
 * y diagnostica problemas comunes.
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class DeploymentDiagnostic {
  constructor() {
    this.baseUrl = process.env.RAILWAY_STATIC_URL || 'http://localhost:3001';
    this.results = {
      timestamp: new Date().toISOString(),
      checks: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
  }

  /**
   * 🔍 Ejecutar diagnóstico completo
   */
  async runDiagnostic() {
    logger.info('🔍 Iniciando diagnóstico de despliegue...', {
      baseUrl: this.baseUrl,
      timestamp: this.results.timestamp
    });

    try {
      // 1. Verificar conectividad básica
      await this.checkBasicConnectivity();

      // 2. Verificar endpoints críticos
      await this.checkCriticalEndpoints();

      // 3. Verificar configuración de Firebase
      await this.checkFirebaseConfiguration();

      // 4. Verificar servicios externos
      await this.checkExternalServices();

      // 5. Verificar rendimiento
      await this.checkPerformance();

      // 6. Generar reporte
      this.generateReport();

    } catch (error) {
      logger.error('❌ Error en diagnóstico de despliegue', {
        error: error?.message || 'Error desconocido',
        stack: error?.stack?.split('\n').slice(0, 3) || []
      });
    }
  }

  /**
   * 🔍 Verificar conectividad básica
   */
  async checkBasicConnectivity() {
    const check = {
      name: 'Conectividad Básica',
      status: 'pending',
      details: {}
    };

    try {
      logger.debug('🔍 Verificando conectividad básica...');

      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 10000,
        validateStatus: () => true
      });

      check.status = response.status === 200 ? 'passed' : 'failed';
      check.details = {
        statusCode: response.status,
        responseTime: response.headers['x-response-time'] || 'unknown',
        hasResponse: !!response.data
      };

      if (response.status !== 200) {
        check.details.error = `Status code: ${response.status}`;
      }

    } catch (error) {
      check.status = 'failed';
      check.details = {
        error: error?.message || 'Error desconocido',
        code: error?.code || 'unknown'
      };
    }

    this.addCheck(check);
  }

  /**
   * 🔍 Verificar endpoints críticos
   */
  async checkCriticalEndpoints() {
    const endpoints = [
      { path: '/api/auth/status', name: 'Auth Status' },
      { path: '/api/conversations', name: 'Conversations API' },
      { path: '/api/media/upload', name: 'Media Upload API', method: 'POST' }
    ];

    for (const endpoint of endpoints) {
      const check = {
        name: `Endpoint: ${endpoint.name}`,
        status: 'pending',
        details: {}
      };

      try {
        logger.debug(`🔍 Verificando endpoint: ${endpoint.path}`);

        const config = {
          timeout: 15000,
          validateStatus: () => true
        };

        let response;
        if (endpoint.method === 'POST') {
          response = await axios.post(`${this.baseUrl}${endpoint.path}`, {}, config);
        } else {
          response = await axios.get(`${this.baseUrl}${endpoint.path}`, config);
        }

        // Para POST, esperamos 405 (Method Not Allowed) o 400 (Bad Request) como respuestas normales
        const expectedStatuses = endpoint.method === 'POST' ? [405, 400, 401] : [200, 401, 403];
        
        check.status = expectedStatuses.includes(response.status) ? 'passed' : 'failed';
        check.details = {
          statusCode: response.status,
          method: endpoint.method || 'GET',
          responseTime: response.headers['x-response-time'] || 'unknown'
        };

        if (!expectedStatuses.includes(response.status)) {
          check.details.error = `Unexpected status: ${response.status}`;
        }

      } catch (error) {
        check.status = 'failed';
        check.details = {
          error: error?.message || 'Error desconocido',
          code: error?.code || 'unknown'
        };
      }

      this.addCheck(check);
    }
  }

  /**
   * 🔍 Verificar configuración de Firebase
   */
  async checkFirebaseConfiguration() {
    const check = {
      name: 'Configuración Firebase',
      status: 'pending',
      details: {}
    };

    try {
      logger.debug('🔍 Verificando configuración Firebase...');

      // Verificar variables de entorno
      const requiredVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY'
      ];

      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        check.status = 'failed';
        check.details = {
          missingVariables: missingVars,
          error: 'Variables de entorno de Firebase faltantes'
        };
      } else {
        // Intentar conectar a Firebase
        try {
          const admin = require('firebase-admin');
          
          if (!admin.apps || admin.apps.length === 0) {
            check.status = 'failed';
            check.details = {
              error: 'Firebase Admin SDK no inicializado'
            };
          } else {
            check.status = 'passed';
            check.details = {
              appsCount: admin.apps.length,
              hasFirestore: !!admin.firestore,
              hasStorage: !!admin.storage
            };
          }
        } catch (firebaseError) {
          check.status = 'failed';
          check.details = {
            error: `Error Firebase: ${firebaseError?.message || 'Error desconocido'}`
          };
        }
      }

    } catch (error) {
      check.status = 'failed';
      check.details = {
        error: error?.message || 'Error desconocido'
      };
    }

    this.addCheck(check);
  }

  /**
   * 🔍 Verificar servicios externos
   */
  async checkExternalServices() {
    const services = [
      { name: 'Redis', url: process.env.REDIS_URL || 'redis://localhost:6379' },
      { name: 'Twilio', check: () => !!process.env.TWILIO_ACCOUNT_SID }
    ];

    for (const service of services) {
      const check = {
        name: `Servicio: ${service.name}`,
        status: 'pending',
        details: {}
      };

      try {
        if (service.check) {
          // Verificación basada en variables de entorno
          const isAvailable = service.check();
          check.status = isAvailable ? 'passed' : 'failed';
          check.details = {
            available: isAvailable,
            configured: isAvailable
          };
        } else if (service.url) {
          // Verificación de conectividad
          logger.debug(`🔍 Verificando servicio: ${service.name}`);
          
          // Para Redis, solo verificamos que la URL esté configurada
          check.status = service.url !== 'redis://localhost:6379' ? 'passed' : 'warning';
          check.details = {
            url: service.url,
            configured: service.url !== 'redis://localhost:6379'
          };
        }

      } catch (error) {
        check.status = 'failed';
        check.details = {
          error: error?.message || 'Error desconocido'
        };
      }

      this.addCheck(check);
    }
  }

  /**
   * 🔍 Verificar rendimiento
   */
  async checkPerformance() {
    const check = {
      name: 'Rendimiento',
      status: 'pending',
      details: {}
    };

    try {
      logger.debug('🔍 Verificando rendimiento...');

      const startTime = Date.now();
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 30000,
        validateStatus: () => true
      });
      const responseTime = Date.now() - startTime;

      check.status = responseTime < 5000 ? 'passed' : 'warning';
      check.details = {
        responseTime: `${responseTime}ms`,
        statusCode: response.status,
        threshold: '5000ms'
      };

      if (responseTime > 10000) {
        check.status = 'failed';
        check.details.error = 'Respuesta muy lenta';
      }

    } catch (error) {
      check.status = 'failed';
      check.details = {
        error: error?.message || 'Error desconocido'
      };
    }

    this.addCheck(check);
  }

  /**
   * ➕ Agregar verificación al reporte
   */
  addCheck(check) {
    this.results.checks.push(check);
    this.results.summary.total++;
    
    switch (check.status) {
      case 'passed':
        this.results.summary.passed++;
        break;
      case 'failed':
        this.results.summary.failed++;
        break;
      case 'warning':
        this.results.summary.warnings++;
        break;
    }
  }

  /**
   * 📋 Generar reporte final
   */
  generateReport() {
    logger.info('📋 Reporte de diagnóstico de despliegue', {
      summary: this.results.summary,
      timestamp: this.results.timestamp
    });

    console.log('\n🔍 REPORTE DE DIAGNÓSTICO DE DESPLIEGUE');
    console.log('=====================================');
    console.log(`📅 Timestamp: ${this.results.timestamp}`);
    console.log(`🌐 Base URL: ${this.baseUrl}`);
    console.log('');

    // Resumen
    console.log('📊 RESUMEN:');
    console.log(`   ✅ Pasadas: ${this.results.summary.passed}`);
    console.log(`   ❌ Fallidas: ${this.results.summary.failed}`);
    console.log(`   ⚠️  Advertencias: ${this.results.summary.warnings}`);
    console.log(`   📈 Total: ${this.results.summary.total}`);
    console.log('');

    // Detalles de cada verificación
    console.log('🔍 DETALLES:');
    for (const check of this.results.checks) {
      const statusIcon = check.status === 'passed' ? '✅' : 
                        check.status === 'failed' ? '❌' : '⚠️';
      
      console.log(`${statusIcon} ${check.name}: ${check.status.toUpperCase()}`);
      
      if (check.details.error) {
        console.log(`   Error: ${check.details.error}`);
      }
      
      if (Object.keys(check.details).length > 0 && !check.details.error) {
        console.log(`   Detalles: ${JSON.stringify(check.details, null, 2)}`);
      }
      console.log('');
    }

    // Recomendaciones
    const failedChecks = this.results.checks.filter(c => c.status === 'failed');
    if (failedChecks.length > 0) {
      console.log('🚨 RECOMENDACIONES:');
      for (const check of failedChecks) {
        console.log(`   • Revisar: ${check.name}`);
        if (check.details.error) {
          console.log(`     Error: ${check.details.error}`);
        }
      }
    }

    // Estado general
    const isHealthy = this.results.summary.failed === 0;
    console.log(`\n🎯 ESTADO GENERAL: ${isHealthy ? '✅ SALUDABLE' : '❌ PROBLEMAS DETECTADOS'}`);
  }
}

// Ejecutar diagnóstico si se llama directamente
if (require.main === module) {
  const diagnostic = new DeploymentDiagnostic();
  diagnostic.runDiagnostic().catch(error => {
    logger.error('❌ Error ejecutando diagnóstico', {
      error: error?.message || 'Error desconocido'
    });
    process.exit(1);
  });
}

module.exports = DeploymentDiagnostic; 