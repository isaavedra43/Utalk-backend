/**
 * 🧪 SCRIPT DE PRUEBA: Endpoint de Contactos
 * 
 * Este script prueba el endpoint /api/contacts/client/:phone
 * para verificar que retorna la información del cliente correctamente
 */

const axios = require('axios');

// Configuración
const BACKEND_URL = process.env.BACKEND_URL || 'https://utalk-backend-production.up.railway.app';
const TEST_PHONE = '+5214773790184'; // Teléfono de prueba desde los logs

// Token de prueba (reemplazar con un token válido)
const TEST_TOKEN = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGNvbXBhbnkuY29tIiwicm9sZSI6ImFkbWluIiwibmFtZSI6IkFkbWluaXN0cmFkb3IgZGVsIFNpc3RlbWEiLCJ0eXBlIjoiYWNjZXNzIiwidXNlcklkIjoiYWRtaW5AY29tcGFueS5jb20iLCJ3b3Jrc3BhY2VJZCI6ImRlZmF1bHRfd29ya3NwYWNlIiwidGVuYW50SWQiOiJkZWZhdWx0X3RlbmFudCIsImlhdCI6MTc1NTQwOTk0NSwiZXhwIjoxNzU1NDEwODQ1LCJhdWQiOiJ1dGFsay1hcGkiLCJpc3MiOiJ1dGFsay1iYWNrZW5kIn0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

async function testContactsEndpoint() {
  console.log('🧪 INICIANDO PRUEBA DEL ENDPOINT DE CONTACTOS');
  console.log('=' .repeat(60));
  
  try {
    // Configurar axios con headers
    const api = axios.create({
      baseURL: BACKEND_URL,
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log(`📞 Probando endpoint: GET /api/contacts/client/${TEST_PHONE}`);
    console.log(`🌐 URL completa: ${BACKEND_URL}/api/contacts/client/${TEST_PHONE}`);
    
    // Hacer la petición
    const response = await api.get(`/api/contacts/client/${TEST_PHONE}`);
    
    console.log('\n✅ RESPUESTA EXITOSA:');
    console.log('📊 Status:', response.status);
    console.log('📋 Headers:', JSON.stringify(response.headers, null, 2));
    
    console.log('\n📦 DATOS DEL CLIENTE:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Verificar estructura de respuesta
    if (response.data.success && response.data.data) {
      const clientData = response.data.data;
      
      console.log('\n🔍 VERIFICACIÓN DE CAMPOS:');
      console.log(`✅ phone: ${clientData.phone}`);
      console.log(`✅ name: ${clientData.name}`);
      console.log(`✅ waId: ${clientData.waId}`);
      console.log(`✅ profilePhotoUrl: ${clientData.profilePhotoUrl}`);
      console.log(`✅ lastUpdated: ${clientData.lastUpdated}`);
      console.log(`✅ isActive: ${clientData.isActive}`);
      console.log(`✅ totalMessages: ${clientData.totalMessages}`);
      console.log(`✅ tags: ${JSON.stringify(clientData.tags)}`);
      
      // Verificar que el campo 'name' no sea undefined
      if (clientData.name && clientData.name !== 'undefined') {
        console.log('\n🎉 ¡ÉXITO! El campo "name" está presente y no es undefined');
      } else {
        console.log('\n❌ ERROR: El campo "name" está undefined o vacío');
      }
      
    } else {
      console.log('\n❌ ERROR: La respuesta no tiene la estructura esperada');
    }
    
  } catch (error) {
    console.log('\n❌ ERROR EN LA PRUEBA:');
    
    if (error.response) {
      console.log('📊 Status:', error.response.status);
      console.log('📋 Headers:', JSON.stringify(error.response.headers, null, 2));
      console.log('📦 Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('🌐 Error de red:', error.message);
    } else {
      console.log('💻 Error:', error.message);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 PRUEBA COMPLETADA');
}

// Ejecutar la prueba
if (require.main === module) {
  testContactsEndpoint().catch(console.error);
}

module.exports = { testContactsEndpoint }; 