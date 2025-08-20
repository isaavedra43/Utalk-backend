/**
 * 🔧 SCRIPT DE PRUEBA PARA VERIFICAR LA CORRECCIÓN DE SUBIDA DE MEDIA
 * 
 * Este script prueba que el middleware de multer está correctamente configurado
 * y que la subida de archivos funciona después de la corrección.
 * 
 * @version 1.0.0
 * @date 2025-08-19
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuración
const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TEST_EMAIL = 'admin@company.com';
const TEST_PASSWORD = 'admin123';

// Crear un archivo de prueba temporal
function createTestFile() {
  const testContent = 'Este es un archivo de prueba para verificar la subida de media.';
  const testFilePath = path.join(__dirname, 'test-image.txt');
  fs.writeFileSync(testFilePath, testContent);
  return testFilePath;
}

// Obtener token de autenticación
async function getAuthToken() {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔐 Obteniendo token de autenticación...' });
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (response.data.success && response.data.data.token) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Token obtenido correctamente' });
      return response.data.data.token;
    } else {
      throw new Error('No se pudo obtener el token');
    }
  } catch (error) {
    console.error('❌ Error obteniendo token:', error.response?.data || error.message);
    throw error;
  }
}

// Probar subida de archivo
async function testFileUpload(token) {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📁 Probando subida de archivo...' });
    
    const testFilePath = createTestFile();
    const formData = new FormData();
    
    // Agregar archivo al formulario
    formData.append('file', fs.createReadStream(testFilePath), {
      filename: 'test-image.txt',
      contentType: 'text/plain'
    });
    
    // Agregar metadatos opcionales
    formData.append('conversationId', 'test-conversation-id');
    formData.append('tags', JSON.stringify(['test', 'upload']));
    
    const response = await axios.post(`${BASE_URL}/api/media/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      },
      timeout: 30000
    });

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Subida de archivo exitosa!' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Respuesta:', {
      success: response.data.success,
      fileId: response.data.data?.id,
      url: response.data.data?.url,
      size: response.data.data?.size
    } });

    // Limpiar archivo temporal
    fs.unlinkSync(testFilePath);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error en subida de archivo:');
    
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📊 Data:', error.response.data);
      
      // Análisis específico del error
      if (error.response.data.error === 'NO_FILE') {
        console.error('🚨 PROBLEMA: El middleware de multer NO está funcionando');
        console.error('💡 SOLUCIÓN: Verificar que MediaUploadController.getMulterConfig().single("file") esté en la ruta');
      } else if (error.response.status === 401) {
        console.error('🚨 PROBLEMA: Error de autenticación');
      } else if (error.response.status === 413) {
        console.error('🚨 PROBLEMA: Archivo demasiado grande');
      } else {
        console.error('🚨 PROBLEMA: Error desconocido en la subida');
      }
    } else {
      console.error('🚨 PROBLEMA: Error de red:', error.message);
    }
    
    throw error;
  }
}

// Probar endpoint de health check
async function testHealthCheck() {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🏥 Probando health check...' });
    
    const response = await axios.get(`${BASE_URL}/health`, {
      timeout: 10000
    });

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Health check exitoso:', response.data.status });
    return true;
  } catch (error) {
    console.error('❌ Health check falló:', error.message);
    return false;
  }
}

// Función principal
async function runTest() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 INICIANDO PRUEBA DE CORRECCIÓN DE SUBIDA DE MEDIA' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📍 URL del backend:', BASE_URL });
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    // 1. Verificar que el servidor esté funcionando
    const isHealthy = await testHealthCheck();
    if (!isHealthy) {
      console.error('❌ El servidor no está respondiendo. Abortando prueba.');
      process.exit(1);
    }

    // 2. Obtener token de autenticación
    const token = await getAuthToken();

    // 3. Probar subida de archivo
    await testFileUpload(token);

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 ¡PRUEBA EXITOSA!' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ El middleware de multer está correctamente configurado' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ La subida de archivos funciona correctamente' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ El problema de "NO_FILE" ha sido resuelto' });

  } catch (error) {
    console.error('\n💥 PRUEBA FALLIDA');
    console.error('❌ La corrección no funcionó como se esperaba');
    console.error('🔍 Revisar logs del servidor para más detalles');
    
    process.exit(1);
  }
}

// Ejecutar prueba si se llama directamente
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = { runTest, testFileUpload, getAuthToken }; 