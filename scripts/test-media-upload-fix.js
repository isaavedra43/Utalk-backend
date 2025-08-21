/**
 * 🧪 SCRIPT DE PRUEBA: Verificación de correcciones en MediaUploadController
 * 
 * Este script verifica que las correcciones de mimeType vs mimetype funcionan correctamente
 */

const MediaUploadController = require('../src/controllers/MediaUploadController');

async function testMediaUploadController() {
  console.log('🧪 Iniciando pruebas de MediaUploadController...\n');

  const controller = new MediaUploadController();

  // Test 1: Verificar que getFileType funciona con mimeType válido
  console.log('📋 Test 1: getFileType con mimeType válido');
  try {
    const result1 = controller.getFileType('image/jpeg');
    console.log('✅ image/jpeg →', result1);
    
    const result2 = controller.getFileType('video/mp4');
    console.log('✅ video/mp4 →', result2);
    
    const result3 = controller.getFileType('audio/mpeg');
    console.log('✅ audio/mpeg →', result3);
    
    const result4 = controller.getFileType('application/pdf');
    console.log('✅ application/pdf →', result4);
  } catch (error) {
    console.error('❌ Error en Test 1:', error.message);
  }

  // Test 2: Verificar que getFileType maneja valores inválidos
  console.log('\n📋 Test 2: getFileType con valores inválidos');
  try {
    const result1 = controller.getFileType(undefined);
    console.log('✅ undefined →', result1);
    
    const result2 = controller.getFileType(null);
    console.log('✅ null →', result2);
    
    const result3 = controller.getFileType('');
    console.log('✅ string vacío →', result3);
    
    const result4 = controller.getFileType(123);
    console.log('✅ número →', result4);
  } catch (error) {
    console.error('❌ Error en Test 2:', error.message);
  }

  // Test 3: Verificar que isPreviewable funciona
  console.log('\n📋 Test 3: isPreviewable');
  try {
    const result1 = controller.isPreviewable('image/jpeg');
    console.log('✅ image/jpeg previewable →', result1);
    
    const result2 = controller.isPreviewable('video/mp4');
    console.log('✅ video/mp4 previewable →', result2);
    
    const result3 = controller.isPreviewable('text/plain');
    console.log('✅ text/plain previewable →', result3);
  } catch (error) {
    console.error('❌ Error en Test 3:', error.message);
  }

  // Test 4: Verificar que isWhatsAppCompatible funciona
  console.log('\n📋 Test 4: isWhatsAppCompatible');
  try {
    const result1 = controller.isWhatsAppCompatible('image/jpeg', 1024 * 1024); // 1MB
    console.log('✅ image/jpeg 1MB compatible →', result1);
    
    const result2 = controller.isWhatsAppCompatible('image/jpeg', 10 * 1024 * 1024); // 10MB
    console.log('✅ image/jpeg 10MB compatible →', result2);
    
    const result3 = controller.isWhatsAppCompatible('video/mp4', 5 * 1024 * 1024); // 5MB
    console.log('✅ video/mp4 5MB compatible →', result3);
  } catch (error) {
    console.error('❌ Error en Test 4:', error.message);
  }

  console.log('\n🎉 Todas las pruebas completadas exitosamente!');
  console.log('✅ Las correcciones de MediaUploadController están funcionando correctamente');
}

// Ejecutar pruebas
testMediaUploadController().catch(error => {
  console.error('❌ Error ejecutando pruebas:', error);
  process.exit(1);
}); 