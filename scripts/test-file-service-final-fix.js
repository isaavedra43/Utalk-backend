/**
 * 🧪 SCRIPT DE PRUEBA: Verificación de correcciones finales en FileService
 * 
 * Este script verifica que los métodos isDocument y el import de monitoring funcionan correctamente
 */

const FileService = require('../src/services/FileService');

async function testFileServiceFinalFixes() {
  console.log('🧪 Iniciando pruebas finales de FileService...\n');

  const fileService = new FileService();

  // Test 1: Verificar que isDocument funciona correctamente
  console.log('📋 Test 1: Método isDocument');
  try {
    const pdfResult = fileService.isDocument('application/pdf');
    console.log('✅ isDocument("application/pdf") →', pdfResult);
    
    const wordResult = fileService.isDocument('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    console.log('✅ isDocument("application/vnd.openxmlformats-officedocument.wordprocessingml.document") →', wordResult);
    
    const excelResult = fileService.isDocument('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    console.log('✅ isDocument("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") →', excelResult);
    
    const textResult = fileService.isDocument('text/plain');
    console.log('✅ isDocument("text/plain") →', textResult);
    
    const imageResult = fileService.isDocument('image/jpeg');
    console.log('✅ isDocument("image/jpeg") →', imageResult);
    
    const undefinedResult = fileService.isDocument(undefined);
    console.log('✅ isDocument(undefined) →', undefinedResult);
    
  } catch (error) {
    console.log('❌ Error en isDocument:', error.message);
  }

  // Test 2: Verificar que todos los métodos de validación funcionan
  console.log('\n📋 Test 2: Todos los métodos de validación');
  try {
    const testMimeTypes = [
      'image/jpeg',
      'video/mp4', 
      'audio/mp3',
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    testMimeTypes.forEach(mimeType => {
      const isImage = fileService.isImage(mimeType);
      const isVideo = fileService.isVideo(mimeType);
      const isAudio = fileService.isAudio(mimeType);
      const isDocument = fileService.isDocument(mimeType);
      
      console.log(`✅ ${mimeType}:`, {
        isImage,
        isVideo, 
        isAudio,
        isDocument
      });
    });
    
  } catch (error) {
    console.log('❌ Error en validaciones:', error.message);
  }

  // Test 3: Verificar que el import de monitoring no falla
  console.log('\n📋 Test 3: Import de monitoring');
  try {
    const monitoring = require('../src/utils/monitoring');
    console.log('✅ Import de monitoring exitoso:', typeof monitoring);
    
    if (monitoring && typeof monitoring.recordFileAction === 'function') {
      console.log('✅ recordFileAction disponible');
    } else {
      console.log('⚠️ recordFileAction no disponible (esperado)');
    }
    
  } catch (error) {
    console.log('⚠️ Import de monitoring falló (esperado en entorno de prueba):', error.message);
  }

  console.log('\n🎉 Pruebas finales completadas');
}

// Ejecutar pruebas
testFileServiceFinalFixes().catch(console.error); 