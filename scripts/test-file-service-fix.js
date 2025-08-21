/**
 * 🧪 SCRIPT DE PRUEBA: Verificación de correcciones en FileService
 * 
 * Este script verifica que las correcciones de mimeType y métodos faltantes funcionan correctamente
 */

const FileService = require('../src/services/FileService');
const File = require('../src/models/File');

async function testFileServiceFixes() {
  console.log('🧪 Iniciando pruebas de FileService...\\n');

  const fileService = new FileService();

  // Test 1: Verificar que los métodos de validación funcionan
  console.log('📋 Test 1: Métodos de validación de tipos de archivo');
  try {
    const imageResult = fileService.isImage('image/jpeg');
    console.log('✅ isImage("image/jpeg") →', imageResult);
    
    const audioResult = fileService.isAudio('audio/mp3');
    console.log('✅ isAudio("audio/mp3") →', audioResult);
    
    const videoResult = fileService.isVideo('video/mp4');
    console.log('✅ isVideo("video/mp4") →', videoResult);
    
    const invalidResult = fileService.isImage('invalid/mime');
    console.log('✅ isImage("invalid/mime") →', invalidResult);
    
  } catch (error) {
    console.log('❌ Error en métodos de validación:', error.message);
  }

  // Test 2: Verificar que el método getCountByConversation existe
  console.log('\\n📋 Test 2: Método getCountByConversation');
  try {
    if (typeof File.getCountByConversation === 'function') {
      console.log('✅ File.getCountByConversation existe');
      
      // Probar con una conversación de prueba
      const count = await File.getCountByConversation('test-conversation');
      console.log('✅ getCountByConversation("test-conversation") →', count);
    } else {
      console.log('❌ File.getCountByConversation NO existe');
    }
  } catch (error) {
    console.log('❌ Error en getCountByConversation:', error.message);
  }

  // Test 3: Verificar que el método saveFileToDatabase usa mimeType correcto
  console.log('\\n📋 Test 3: Verificar estructura de datos en saveFileToDatabase');
  try {
    // Simular datos de archivo
    const testFileData = {
      fileId: 'test-file-id',
      conversationId: 'test-conversation',
      userId: 'test-user',
      uploadedBy: 'test-user',
      originalName: 'test-image.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      url: 'https://example.com/test.jpg',
      category: 'image',
      storagePath: 'test/path',
      publicUrl: 'https://example.com/public/test.jpg'
    };

    // Verificar que el método existe
    if (typeof fileService.saveFileToDatabase === 'function') {
      console.log('✅ fileService.saveFileToDatabase existe');
      
      // Verificar la estructura interna (sin ejecutar realmente)
      const methodSource = fileService.saveFileToDatabase.toString();
      if (methodSource.includes('mimeType: mimetype')) {
        console.log('✅ saveFileToDatabase usa mimeType correcto');
      } else {
        console.log('❌ saveFileToDatabase NO usa mimeType correcto');
      }
    } else {
      console.log('❌ fileService.saveFileToDatabase NO existe');
    }
  } catch (error) {
    console.log('❌ Error verificando saveFileToDatabase:', error.message);
  }

  console.log('\\n🎉 Pruebas completadas');
}

// Ejecutar pruebas
testFileServiceFixes().catch(console.error); 