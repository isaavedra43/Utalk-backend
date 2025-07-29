/**
 * 🧪 TEST ESPECÍFICO - ENDPOINT VALIDATE-TOKEN
 * 
 * Prueba exhaustiva del endpoint /api/auth/validate-token
 * para asegurar el correcto funcionamiento de validación JWT
 * y manejo de sesiones al refrescar la página.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');

class ValidateTokenTester {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    this.testResults = [];
  }

  /**
   * 🚀 Ejecutar todas las pruebas
   */
  async runTests() {
    console.log('🧪 INICIANDO TESTS DE VALIDATE-TOKEN');
    console.log('=' .repeat(50));

    // Primero hacer login para obtener un token válido
    const validToken = await this.getValidToken();
    
    if (validToken) {
      await this.testValidToken(validToken);
      await this.testExpiredToken();
      await this.testMalformedToken();
      await this.testMissingToken();
      await this.testEmptyToken();
      await this.testInvalidSignature();
    } else {
      console.log('❌ No se pudo obtener token válido para pruebas');
    }

    this.generateReport();
  }

  /**
   * 🔐 Obtener token válido haciendo login
   */
  async getValidToken() {
    try {
      console.log('\n🔐 Obteniendo token válido...');
      
      const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
        email: 'admin@test.com',
        password: 'testpassword123'
      });

      if (response.data.success && response.data.data.token) {
        console.log('✅ Token válido obtenido');
        return response.data.data.token;
      } else {
        console.log('❌ Login falló:', response.data);
        return null;
      }
    } catch (error) {
      console.log('❌ Error en login:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * ✅ Test 1: Token válido
   */
  async testValidToken(token) {
    const testName = 'Token Válido';
    console.log(`\n🧪 Test: ${testName}`);
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/auth/validate-token`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 200 && response.data.success) {
        console.log('✅ Token válido aceptado correctamente');
        console.log(`📊 Usuario: ${response.data.data.user.email} (${response.data.data.user.role})`);
        
        this.testResults.push({
          test: testName,
          status: 'PASS',
          details: `Usuario validado: ${response.data.data.user.email}`
        });
      } else {
        throw new Error('Respuesta inesperada para token válido');
      }
    } catch (error) {
      console.log('❌ Error con token válido:', error.response?.data || error.message);
      this.testResults.push({
        test: testName,
        status: 'FAIL',
        details: error.response?.data?.message || error.message
      });
    }
  }

  /**
   * ⏰ Test 2: Token expirado
   */
  async testExpiredToken() {
    const testName = 'Token Expirado';
    console.log(`\n🧪 Test: ${testName}`);
    
    try {
      // Crear token expirado
      const expiredToken = jwt.sign(
        { email: 'test@test.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Expirado hace una hora
      );

      const response = await axios.get(`${this.baseUrl}/api/auth/validate-token`, {
        headers: {
          'Authorization': `Bearer ${expiredToken}`
        }
      });

      // No debería llegar aquí
      throw new Error('Token expirado fue aceptado incorrectamente');
      
    } catch (error) {
      if (error.response?.status === 401 && error.response.data.error === 'TOKEN_EXPIRED') {
        console.log('✅ Token expirado rechazado correctamente');
        this.testResults.push({
          test: testName,
          status: 'PASS',
          details: 'Token expirado rechazado como esperado'
        });
      } else {
        console.log('❌ Error inesperado con token expirado:', error.response?.data || error.message);
        this.testResults.push({
          test: testName,
          status: 'FAIL',
          details: error.response?.data?.message || error.message
        });
      }
    }
  }

  /**
   * 🔧 Test 3: Token malformado
   */
  async testMalformedToken() {
    const testName = 'Token Malformado';
    console.log(`\n🧪 Test: ${testName}`);
    
    try {
      const malformedToken = 'esto.no.es.un.jwt.valido';

      const response = await axios.get(`${this.baseUrl}/api/auth/validate-token`, {
        headers: {
          'Authorization': `Bearer ${malformedToken}`
        }
      });

      throw new Error('Token malformado fue aceptado incorrectamente');
      
    } catch (error) {
      if (error.response?.status === 401 && error.response.data.error === 'MALFORMED_TOKEN') {
        console.log('✅ Token malformado rechazado correctamente');
        this.testResults.push({
          test: testName,
          status: 'PASS',
          details: 'Token malformado rechazado como esperado'
        });
      } else {
        console.log('❌ Error inesperado con token malformado:', error.response?.data || error.message);
        this.testResults.push({
          test: testName,
          status: 'FAIL',
          details: error.response?.data?.message || error.message
        });
      }
    }
  }

  /**
   * 🚫 Test 4: Sin token
   */
  async testMissingToken() {
    const testName = 'Sin Token';
    console.log(`\n🧪 Test: ${testName}`);
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/auth/validate-token`);
      throw new Error('Petición sin token fue aceptada incorrectamente');
      
    } catch (error) {
      if (error.response?.status === 401 && error.response.data.error === 'NO_TOKEN') {
        console.log('✅ Petición sin token rechazada correctamente');
        this.testResults.push({
          test: testName,
          status: 'PASS',
          details: 'Petición sin token rechazada como esperado'
        });
      } else {
        console.log('❌ Error inesperado sin token:', error.response?.data || error.message);
        this.testResults.push({
          test: testName,
          status: 'FAIL',
          details: error.response?.data?.message || error.message
        });
      }
    }
  }

  /**
   * 📭 Test 5: Token vacío
   */
  async testEmptyToken() {
    const testName = 'Token Vacío';
    console.log(`\n🧪 Test: ${testName}`);
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/auth/validate-token`, {
        headers: {
          'Authorization': 'Bearer '
        }
      });

      throw new Error('Token vacío fue aceptado incorrectamente');
      
    } catch (error) {
      if (error.response?.status === 401 && error.response.data.error === 'EMPTY_TOKEN') {
        console.log('✅ Token vacío rechazado correctamente');
        this.testResults.push({
          test: testName,
          status: 'PASS',
          details: 'Token vacío rechazado como esperado'
        });
      } else {
        console.log('❌ Error inesperado con token vacío:', error.response?.data || error.message);
        this.testResults.push({
          test: testName,
          status: 'FAIL',
          details: error.response?.data?.message || error.message
        });
      }
    }
  }

  /**
   * 🔐 Test 6: Firma inválida
   */
  async testInvalidSignature() {
    const testName = 'Firma Inválida';
    console.log(`\n🧪 Test: ${testName}`);
    
    try {
      // Crear token con firma incorrecta
      const invalidToken = jwt.sign(
        { email: 'test@test.com' },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      const response = await axios.get(`${this.baseUrl}/api/auth/validate-token`, {
        headers: {
          'Authorization': `Bearer ${invalidToken}`
        }
      });

      throw new Error('Token con firma inválida fue aceptado incorrectamente');
      
    } catch (error) {
      if (error.response?.status === 401 && error.response.data.error === 'MALFORMED_TOKEN') {
        console.log('✅ Token con firma inválida rechazado correctamente');
        this.testResults.push({
          test: testName,
          status: 'PASS',
          details: 'Token con firma inválida rechazado como esperado'
        });
      } else {
        console.log('❌ Error inesperado con firma inválida:', error.response?.data || error.message);
        this.testResults.push({
          test: testName,
          status: 'FAIL',
          details: error.response?.data?.message || error.message
        });
      }
    }
  }

  /**
   * 📊 Generar reporte final
   */
  generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 REPORTE FINAL DE TESTS VALIDATE-TOKEN');
    console.log('='.repeat(50));

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
    const failedTests = this.testResults.filter(t => t.status === 'FAIL').length;

    console.log(`\n🎯 RESUMEN:`);
    console.log(`Total de tests: ${totalTests}`);
    console.log(`✅ Pasaron: ${passedTests}`);
    console.log(`❌ Fallaron: ${failedTests}`);
    console.log(`📊 Éxito: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (failedTests > 0) {
      console.log(`\n❌ TESTS FALLIDOS:`);
      this.testResults
        .filter(t => t.status === 'FAIL')
        .forEach(test => {
          console.log(`   ${test.test}: ${test.details}`);
        });
    }

    if (passedTests === totalTests) {
      console.log('\n🎉 ¡TODOS LOS TESTS PASARON! El endpoint validate-token está funcionando correctamente.');
    } else {
      console.log('\n⚠️ Algunos tests fallaron. Revisa la implementación del endpoint.');
    }

    console.log('\n' + '='.repeat(50));
  }
}

// Ejecutar tests si es llamado directamente
if (require.main === module) {
  const tester = new ValidateTokenTester();
  tester.runTests().catch(console.error);
}

module.exports = ValidateTokenTester; 