/**
 * 🧪 SCRIPT DE PRUEBA: SISTEMA DE REFRESH TOKENS
 * 
 * Prueba completa del flujo de autenticación con refresh tokens:
 * 1. Login → 2. Acceso → 3. Expiración → 4. Renovación → 5. Logout
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuración
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword123';

/**
 * Clase para manejar las pruebas del sistema de refresh tokens
 */
class RefreshTokenTester {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.testResults = [];
  }

  /**
   * Log de prueba
   */
  log(message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data);
    this.testResults.push({ timestamp, message, data });
  }

  /**
   * Hacer petición HTTP
   */
  async makeRequest(method, endpoint, data = null, headers = {}) {
    try {
      const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response;
    } catch (error) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { error: error.message }
      };
    }
  }

  /**
   * Prueba 1: Login exitoso
   */
  async testLogin() {
    this.log('🧪 PRUEBA 1: Login exitoso');

    const loginData = {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    };

    const response = await this.makeRequest('POST', '/api/auth/login', loginData);

    if (response.status === 200 && response.data.success) {
      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken;
      this.user = response.data.user;

      this.log('✅ Login exitoso', {
        accessTokenLength: this.accessToken?.length,
        refreshTokenLength: this.refreshToken?.length,
        userEmail: this.user?.email,
        expiresIn: response.data.expiresIn,
        refreshExpiresIn: response.data.refreshExpiresIn
      });

      return true;
    } else {
      this.log('❌ Login fallido', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 2: Acceso con token válido
   */
  async testValidAccess() {
    this.log('🧪 PRUEBA 2: Acceso con token válido');

    if (!this.accessToken) {
      this.log('❌ No hay access token disponible');
      return false;
    }

    const response = await this.makeRequest('POST', '/api/auth/validate-token', {}, {
      'Authorization': `Bearer ${this.accessToken}`
    });

    if (response.status === 200 && response.data.success) {
      this.log('✅ Acceso válido', {
        userEmail: response.data.data?.user?.email,
        sessionValid: response.data.data?.sessionValid
      });
      return true;
    } else {
      this.log('❌ Acceso inválido', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 3: Acceso a endpoint protegido
   */
  async testProtectedEndpoint() {
    this.log('🧪 PRUEBA 3: Acceso a endpoint protegido');

    if (!this.accessToken) {
      this.log('❌ No hay access token disponible');
      return false;
    }

    const response = await this.makeRequest('GET', '/api/auth/profile', {}, {
      'Authorization': `Bearer ${this.accessToken}`
    });

    if (response.status === 200 && response.data.success) {
      this.log('✅ Endpoint protegido accesible', {
        userEmail: response.data.user?.email,
        userName: response.data.user?.name
      });
      return true;
    } else {
      this.log('❌ Endpoint protegido inaccesible', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 4: Simular token expirado
   */
  async testExpiredToken() {
    this.log('🧪 PRUEBA 4: Simular token expirado');

    // Crear un token que expire en 1 segundo
    const expiredToken = jwt.sign(
      {
        email: this.user?.email,
        role: this.user?.role,
        name: this.user?.name,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 1 // Expira en 1 segundo
      },
      process.env.JWT_SECRET || 'test-secret',
      {
        issuer: 'utalk-backend',
        audience: 'utalk-frontend'
      }
    );

    // Esperar 2 segundos para que expire
    await new Promise(resolve => setTimeout(resolve, 2000));

    const response = await this.makeRequest('POST', '/api/auth/validate-token', {}, {
      'Authorization': `Bearer ${expiredToken}`
    });

    if (response.status === 401 && response.data?.code === 'TOKEN_EXPIRED') {
      this.log('✅ Token expirado detectado correctamente', {
        error: response.data?.error,
        code: response.data?.code
      });
      return true;
    } else {
      this.log('❌ Token expirado no detectado', {
        status: response.status,
        data: response.data
      });
      return false;
    }
  }

  /**
   * Prueba 5: Renovación de token
   */
  async testTokenRefresh() {
    this.log('🧪 PRUEBA 5: Renovación de token');

    if (!this.refreshToken) {
      this.log('❌ No hay refresh token disponible');
      return false;
    }

    const response = await this.makeRequest('POST', '/api/auth/refresh', {
      refreshToken: this.refreshToken
    });

    if (response.status === 200 && response.data.success) {
      const newAccessToken = response.data.accessToken;
      const newRefreshToken = response.data.refreshToken;

      this.log('✅ Token renovado exitosamente', {
        newAccessTokenLength: newAccessToken?.length,
        newRefreshTokenLength: newRefreshToken?.length,
        expiresIn: response.data.expiresIn,
        tokenRotated: response.data.tokenRotated || false
      });

      // Actualizar tokens
      this.accessToken = newAccessToken;
      if (newRefreshToken) {
        this.refreshToken = newRefreshToken;
      }

      return true;
    } else {
      this.log('❌ Renovación de token fallida', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 6: Acceso con token renovado
   */
  async testRefreshedTokenAccess() {
    this.log('🧪 PRUEBA 6: Acceso con token renovado');

    if (!this.accessToken) {
      this.log('❌ No hay access token renovado disponible');
      return false;
    }

    const response = await this.makeRequest('GET', '/api/auth/profile', {}, {
      'Authorization': `Bearer ${this.accessToken}`
    });

    if (response.status === 200 && response.data.success) {
      this.log('✅ Acceso con token renovado exitoso', {
        userEmail: response.data.user?.email,
        userName: response.data.user?.name
      });
      return true;
    } else {
      this.log('❌ Acceso con token renovado fallido', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 7: Obtener sesiones activas
   */
  async testActiveSessions() {
    this.log('🧪 PRUEBA 7: Obtener sesiones activas');

    if (!this.accessToken) {
      this.log('❌ No hay access token disponible');
      return false;
    }

    const response = await this.makeRequest('GET', '/api/auth/sessions', {}, {
      'Authorization': `Bearer ${this.accessToken}`
    });

    if (response.status === 200 && response.data.success) {
      this.log('✅ Sesiones activas obtenidas', {
        sessionCount: response.data.count,
        sessions: response.data.sessions?.length || 0
      });
      return true;
    } else {
      this.log('❌ Error obteniendo sesiones activas', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 8: Logout con invalidación
   */
  async testLogout() {
    this.log('🧪 PRUEBA 8: Logout con invalidación');

    if (!this.accessToken) {
      this.log('❌ No hay access token disponible');
      return false;
    }

    const response = await this.makeRequest('POST', '/api/auth/logout', {
      refreshToken: this.refreshToken,
      invalidateAll: true
    }, {
      'Authorization': `Bearer ${this.accessToken}`
    });

    if (response.status === 200 && response.data.success) {
      this.log('✅ Logout exitoso', {
        invalidatedTokens: response.data.invalidatedTokens
      });
      return true;
    } else {
      this.log('❌ Logout fallido', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 9: Verificar invalidación de tokens
   */
  async testTokenInvalidation() {
    this.log('🧪 PRUEBA 9: Verificar invalidación de tokens');

    if (!this.accessToken) {
      this.log('❌ No hay access token disponible');
      return false;
    }

    const response = await this.makeRequest('POST', '/api/auth/validate-token', {}, {
      'Authorization': `Bearer ${this.accessToken}`
    });

    if (response.status === 401) {
      this.log('✅ Token invalidado correctamente', {
        error: response.data?.error,
        code: response.data?.code
      });
      return true;
    } else {
      this.log('❌ Token no invalidado', {
        status: response.status,
        data: response.data
      });
      return false;
    }
  }

  /**
   * Prueba 10: Renovación con token invalidado
   */
  async testRefreshWithInvalidToken() {
    this.log('🧪 PRUEBA 10: Renovación con token invalidado');

    if (!this.refreshToken) {
      this.log('❌ No hay refresh token disponible');
      return false;
    }

    const response = await this.makeRequest('POST', '/api/auth/refresh', {
      refreshToken: this.refreshToken
    });

    if (response.status === 401) {
      this.log('✅ Renovación con token invalidado rechazada correctamente', {
        error: response.data?.error,
        code: response.data?.code
      });
      return true;
    } else {
      this.log('❌ Renovación con token invalidado no fue rechazada', {
        status: response.status,
        data: response.data
      });
      return false;
    }
  }

  /**
   * Ejecutar todas las pruebas
   */
  async runAllTests() {
    console.log('🚀 INICIANDO PRUEBAS DEL SISTEMA DE REFRESH TOKENS');
    console.log('=' .repeat(60));

    const tests = [
      { name: 'Login', fn: () => this.testLogin() },
      { name: 'Acceso válido', fn: () => this.testValidAccess() },
      { name: 'Endpoint protegido', fn: () => this.testProtectedEndpoint() },
      { name: 'Token expirado', fn: () => this.testExpiredToken() },
      { name: 'Renovación de token', fn: () => this.testTokenRefresh() },
      { name: 'Acceso con token renovado', fn: () => this.testRefreshedTokenAccess() },
      { name: 'Sesiones activas', fn: () => this.testActiveSessions() },
      { name: 'Logout', fn: () => this.testLogout() },
      { name: 'Invalidación de tokens', fn: () => this.testTokenInvalidation() },
      { name: 'Renovación con token invalidado', fn: () => this.testRefreshWithInvalidToken() }
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (const test of tests) {
      try {
        const result = await test.fn();
        if (result) {
          passedTests++;
          console.log(`✅ ${test.name}: PASÓ`);
        } else {
          console.log(`❌ ${test.name}: FALLÓ`);
        }
      } catch (error) {
        console.log(`💥 ${test.name}: ERROR - ${error.message}`);
      }
      
      console.log('-'.repeat(40));
    }

    console.log('\n📊 RESUMEN DE PRUEBAS:');
    console.log(`✅ Pruebas pasadas: ${passedTests}/${totalTests}`);
    console.log(`❌ Pruebas fallidas: ${totalTests - passedTests}/${totalTests}`);
    console.log(`📈 Tasa de éxito: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (passedTests === totalTests) {
      console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON! El sistema de refresh tokens está funcionando correctamente.');
    } else {
      console.log('\n⚠️ Algunas pruebas fallaron. Revisa los logs para más detalles.');
    }

    return {
      passed: passedTests,
      total: totalTests,
      successRate: (passedTests / totalTests) * 100,
      results: this.testResults
    };
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    const tester = new RefreshTokenTester();
    const results = await tester.runAllTests();
    
    // Guardar resultados en archivo
    const fs = require('fs');
    const resultsFile = `refresh-token-test-results-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    
    console.log(`\n📄 Resultados guardados en: ${resultsFile}`);
    
    process.exit(results.passed === results.total ? 0 : 1);
  } catch (error) {
    console.error('💥 Error ejecutando pruebas:', error.message);
    process.exit(1);
  }
}

// Ejecutar si el script se ejecuta directamente
if (require.main === module) {
  main();
}

module.exports = RefreshTokenTester; 