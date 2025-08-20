#!/usr/bin/env node

/**
 * 🧪 SCRIPT DE PRUEBA PARA LLM STUDIO
 * 
 * Prueba la conexión y funcionalidad de LLM Studio
 * 
 * @version 1.0.0
 * @author Backend Team
 */

require('dotenv').config();
const axios = require('axios');

// Configuración
const LLM_STUDIO_URL = process.env.LLM_STUDIO_URL || 'http://localhost:3001';
const TEST_PROMPT = "Eres un asistente útil. Responde brevemente: ¿Cuál es la capital de España?";
const TEST_MODEL = 'gpt-oss-20b';

/**
 * Función principal de prueba
 */
async function testLLMStudioConnection() {
  console.log('🧪 Iniciando pruebas de LLM Studio...\n');
  
  try {
    // 1. Probar conexión básica
    console.log('1️⃣ Probando conexión básica...');
    await testBasicConnection();
    
    // 2. Probar endpoint de salud
    console.log('\n2️⃣ Probando endpoint de salud...');
    await testHealthEndpoint();
    
    // 3. Probar generación de texto
    console.log('\n3️⃣ Probando generación de texto...');
    await testTextGeneration();
    
    // 4. Probar modelos disponibles
    console.log('\n4️⃣ Probando modelos disponibles...');
    await testAvailableModels();
    
    console.log('\n✅ Todas las pruebas completadas exitosamente!');
    
  } catch (error) {
    console.error('\n❌ Error en las pruebas:', error.message);
    process.exit(1);
  }
}

/**
 * Probar conexión básica
 */
async function testBasicConnection() {
  try {
    const response = await axios.get(LLM_STUDIO_URL, {
      timeout: 5000,
      validateStatus: () => true // Aceptar cualquier status code
    });
    
    console.log(`   ✅ Conexión exitosa a ${LLM_STUDIO_URL}`);
    console.log(`   📊 Status Code: ${response.status}`);
    
    if (response.status === 200) {
      console.log('   🎉 LLM Studio está respondiendo correctamente');
    } else {
      console.log('   ⚠️ LLM Studio responde pero con status inesperado');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`No se puede conectar a ${LLM_STUDIO_URL}. Verifica que LLM Studio esté ejecutándose.`);
    } else if (error.code === 'ENOTFOUND') {
      throw new Error(`No se puede resolver la dirección ${LLM_STUDIO_URL}. Verifica la URL.`);
    } else {
      throw new Error(`Error de conexión: ${error.message}`);
    }
  }
}

/**
 * Probar endpoint de salud
 */
async function testHealthEndpoint() {
  try {
    const response = await axios.get(`${LLM_STUDIO_URL}/health`, {
      timeout: 5000
    });
    
    console.log('   ✅ Endpoint de salud responde correctamente');
    console.log(`   📊 Status: ${response.status}`);
    
    if (response.data) {
      console.log('   📋 Datos de salud:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('   ⚠️ Endpoint /health no encontrado (puede ser normal)');
    } else {
      console.log(`   ⚠️ Error en endpoint de salud: ${error.message}`);
    }
  }
}

/**
 * Probar generación de texto
 */
async function testTextGeneration() {
  try {
    const payload = {
      model: TEST_MODEL,
      prompt: TEST_PROMPT,
      temperature: 0.3,
      max_tokens: 100,
      stop: ['\n\n', 'Human:', 'Assistant:'],
      stream: false
    };
    
    console.log(`   📝 Enviando prompt: "${TEST_PROMPT}"`);
    console.log(`   🤖 Modelo: ${TEST_MODEL}`);
    
    const response = await axios.post(`${LLM_STUDIO_URL}/v1/completions`, payload, {
      timeout: 30000, // 30 segundos para modelos locales
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('   ✅ Generación de texto exitosa');
    console.log(`   📊 Status: ${response.status}`);
    
    const result = response.data;
    if (result.choices && result.choices[0]) {
      const generatedText = result.choices[0].text;
      console.log(`   💬 Respuesta: "${generatedText.trim()}"`);
      
      if (result.usage) {
        console.log(`   📈 Tokens usados: ${result.usage.total_tokens || 'N/A'}`);
      }
    } else {
      console.log('   ⚠️ Respuesta sin contenido generado');
    }
    
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Endpoint /v1/completions no encontrado. Verifica que LLM Studio tenga habilitada la API.');
    } else if (error.response?.status === 422) {
      console.log('   ⚠️ Error de validación en el payload');
      if (error.response.data) {
        console.log('   📋 Detalles:', JSON.stringify(error.response.data, null, 2));
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout en la generación. Los modelos locales pueden tardar más tiempo.');
    } else {
      throw new Error(`Error en generación: ${error.message}`);
    }
  }
}

/**
 * Probar modelos disponibles
 */
async function testAvailableModels() {
  try {
    const response = await axios.get(`${LLM_STUDIO_URL}/v1/models`, {
      timeout: 5000
    });
    
    console.log('   ✅ Endpoint de modelos responde correctamente');
    
    if (response.data && response.data.data) {
      const models = response.data.data;
      console.log(`   📋 Modelos disponibles (${models.length}):`);
      
      models.forEach((model, index) => {
        console.log(`      ${index + 1}. ${model.id} (${model.object})`);
      });
    } else {
      console.log('   ⚠️ No se encontraron modelos en la respuesta');
    }
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('   ⚠️ Endpoint /v1/models no encontrado (puede ser normal)');
    } else {
      console.log(`   ⚠️ Error obteniendo modelos: ${error.message}`);
    }
  }
}

/**
 * Mostrar información de configuración
 */
function showConfiguration() {
  console.log('🔧 Configuración actual:');
  console.log(`   URL: ${LLM_STUDIO_URL}`);
  console.log(`   Habilitado: ${process.env.LLM_STUDIO_ENABLED === 'true' ? 'Sí' : 'No'}`);
  console.log(`   Modelo de prueba: ${TEST_MODEL}`);
  console.log('');
}

// Ejecutar pruebas
if (require.main === module) {
  showConfiguration();
  testLLMStudioConnection()
    .then(() => {
      console.log('\n🎉 Pruebas completadas!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error en las pruebas:', error.message);
      process.exit(1);
    });
}

module.exports = {
  testLLMStudioConnection,
  testBasicConnection,
  testHealthEndpoint,
  testTextGeneration,
  testAvailableModels
}; 