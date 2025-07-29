/**
 * 🧪 SCRIPT DE VALIDACIÓN - ESTRUCTURA ESTÁNDAR API
 * 
 * Verifica que todos los endpoints del chat respondan con la estructura:
 * { success: true, data: [...] }
 */

const axios = require('axios');

const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  FIREBASE_TOKEN: process.env.FIREBASE_TOKEN || 'test_token'
};

class APIStructureValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async validateEndpoint(method, endpoint, headers = {}, data = null) {
    try {
      console.log(`\n🧪 Validando: ${method.toUpperCase()} ${endpoint}`);
      
      const config = {
        method,
        url: `${CONFIG.API_BASE_URL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${CONFIG.FIREBASE_TOKEN}`,
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      
      // Verificar estructura estándar
      const hasSuccess = response.data.hasOwnProperty('success');
      const hasData = response.data.hasOwnProperty('data');
      const successIsBoolean = typeof response.data.success === 'boolean';
      
      const isValid = hasSuccess && hasData && successIsBoolean;
      
      if (isValid) {
        console.log('✅ ESTRUCTURA VÁLIDA');
        console.log(`   - success: ${response.data.success}`);
        console.log(`   - data type: ${Array.isArray(response.data.data) ? 'array' : typeof response.data.data}`);
        console.log(`   - data length: ${Array.isArray(response.data.data) ? response.data.data.length : 'N/A'}`);
        this.results.passed++;
      } else {
        console.log('❌ ESTRUCTURA INVÁLIDA');
        console.log(`   - Tiene success: ${hasSuccess}`);
        console.log(`   - Tiene data: ${hasData}`);
        console.log(`   - Success es boolean: ${successIsBoolean}`);
        console.log(`   - Campos presentes: ${Object.keys(response.data).join(', ')}`);
        this.results.failed++;
      }

      this.results.tests.push({
        endpoint: `${method.toUpperCase()} ${endpoint}`,
        valid: isValid,
        structure: Object.keys(response.data)
      });

    } catch (error) {
      console.log(`⚠️ ERROR EN ENDPOINT: ${error.response?.status || error.message}`);
      this.results.failed++;
      this.results.tests.push({
        endpoint: `${method.toUpperCase()} ${endpoint}`,
        valid: false,
        error: error.message
      });
    }
  }

  async runValidation() {
    console.log('🚀 INICIANDO VALIDACIÓN DE ESTRUCTURA API');
    console.log('==========================================');

    // Endpoints críticos del chat
    await this.validateEndpoint('GET', '/api/conversations');
    await this.validateEndpoint('GET', '/api/conversations/unassigned');
    
    // Si hay conversaciones, probar con ID específico
    try {
      const convResponse = await axios.get(`${CONFIG.API_BASE_URL}/api/conversations`, {
        headers: { 'Authorization': `Bearer ${CONFIG.FIREBASE_TOKEN}` }
      });
      
      if (convResponse.data.data && convResponse.data.data.length > 0) {
        const firstConvId = convResponse.data.data[0].id;
        await this.validateEndpoint('GET', `/api/conversations/${firstConvId}/messages`);
      }
    } catch (error) {
      console.log('⚠️ No se pudieron obtener conversaciones para test específico');
    }

    this.printResults();
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESULTADOS DE VALIDACIÓN');
    console.log('='.repeat(50));
    console.log(`✅ Tests pasados: ${this.results.passed}`);
    console.log(`❌ Tests fallidos: ${this.results.failed}`);
    console.log(`📈 Porcentaje éxito: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
    
    console.log('\n📋 DETALLE POR ENDPOINT:');
    this.results.tests.forEach(test => {
      const status = test.valid ? '✅' : '❌';
      console.log(`${status} ${test.endpoint}`);
      if (test.error) {
        console.log(`    Error: ${test.error}`);
      }
    });

    if (this.results.failed === 0) {
      console.log('\n🎉 ¡TODOS LOS ENDPOINTS USAN LA ESTRUCTURA ESTÁNDAR!');
      console.log('✅ API completamente unificado bajo { success: true, data: [...] }');
    } else {
      console.log('\n⚠️ ALGUNOS ENDPOINTS NECESITAN CORRECCIÓN');
      console.log('🔧 Revisar endpoints fallidos para aplicar ResponseHandler');
    }
  }
}

// Ejecutar validación si se llama directamente
if (require.main === module) {
  const validator = new APIStructureValidator();
  validator.runValidation().catch(console.error);
}

module.exports = APIStructureValidator; 