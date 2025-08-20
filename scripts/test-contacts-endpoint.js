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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 INICIANDO PRUEBA DEL ENDPOINT DE CONTACTOS' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '=' .repeat(60));
  
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

    logger.info('� Probando endpoint: GET /api/contacts/client/${TEST_PHONE}', { category: 'AUTO_MIGRATED' });
    logger.info('� URL completa: ${BACKEND_URL}/api/contacts/client/${TEST_PHONE}', { category: 'AUTO_MIGRATED' });
    
    // Hacer la petición
    const response = await api.get(`/api/contacts/client/${TEST_PHONE}`);
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ RESPUESTA EXITOSA:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Status:', response.status });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Headers:', JSON.stringify(response.headers, null, 2));
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📦 DATOS DEL CLIENTE:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: JSON.stringify(response.data, null, 2));
    
    // Verificar estructura de respuesta
    if (response.data.success && response.data.data) {
      const clientData = response.data.data;
      
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔍 VERIFICACIÓN DE CAMPOS:' });
      logger.info('phone: ${clientData.phone}', { category: 'AUTO_MIGRATED' });
      logger.info('name: ${clientData.name}', { category: 'AUTO_MIGRATED' });
      logger.info('waId: ${clientData.waId}', { category: 'AUTO_MIGRATED' });
      logger.info('profilePhotoUrl: ${clientData.profilePhotoUrl}', { category: 'AUTO_MIGRATED' });
      logger.info('lastUpdated: ${clientData.lastUpdated}', { category: 'AUTO_MIGRATED' });
      logger.info('isActive: ${clientData.isActive}', { category: 'AUTO_MIGRATED' });
      logger.info('totalMessages: ${clientData.totalMessages}', { category: 'AUTO_MIGRATED' });
      logger.info('tags: ${JSON.stringify(clientData.tags)}', { category: 'AUTO_MIGRATED' });
      
      // Verificar que el campo 'name' no sea undefined
      if (clientData.name && clientData.name !== 'undefined') {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 ¡ÉXITO! El campo "name" está presente y no es undefined' });
      } else {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n❌ ERROR: El campo "name" está undefined o vacío' });
      }
      
    } else {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n❌ ERROR: La respuesta no tiene la estructura esperada' });
    }
    
  } catch (error) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n❌ ERROR EN LA PRUEBA:' });
    
    if (error.response) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Status:', error.response.status });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Headers:', JSON.stringify(error.response.headers, null, 2));
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📦 Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🌐 Error de red:', error.message });
    } else {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '💻 Error:', error.message });
    }
  }
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n' + '=' .repeat(60));
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🏁 PRUEBA COMPLETADA' });
}

// Ejecutar la prueba
if (require.main === module) {
  testContactsEndpoint().catch(console.error);
}

module.exports = { testContactsEndpoint }; 