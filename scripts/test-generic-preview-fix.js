/**
 * 🧪 SCRIPT DE PRUEBA: Verificación de generateGenericPreview
 * 
 * Este script verifica que el método generateGenericPreview funciona correctamente
 */

const FileService = require('../src/services/FileService');

async function testGenericPreviewFix() {
  console.log('🧪 Iniciando pruebas de generateGenericPreview...\n');

  const fileService = new FileService();

  // Test 1: Verificar que generateGenericPreview existe
  console.log('📋 Test 1: Verificar que generateGenericPreview existe');
  try {
    if (typeof fileService.generateGenericPreview === 'function') {
      console.log('✅ generateGenericPreview es una función');
    } else {
      console.log('❌ generateGenericPreview no es una función');
      return;
    }
  } catch (error) {
    console.log('❌ Error verificando generateGenericPreview:', error.message);
    return;
  }

  // Test 2: Verificar que funciona con datos simulados
  console.log('\n📋 Test 2: Probar generateGenericPreview con datos simulados');
  try {
    const mockFile = {
      id: 'test-file-id',
      originalName: 'test-document.pdf',
      url: 'https://example.com/test-file.pdf',
      size: 1024000,
      mimeType: 'application/pdf',
      conversationId: 'test-conversation'
    };

    const result = await fileService.generateGenericPreview(mockFile, 'test-file-id', 'test-conversation');
    
    console.log('✅ generateGenericPreview ejecutado exitosamente');
    console.log('📊 Resultado:', {
      hasPreviewUrl: !!result.previewUrl,
      hasThumbnail: !!result.thumbnail,
      hasMetadata: !!result.metadata,
      previewUrl: result.previewUrl?.substring(0, 50) + '...',
      thumbnailUrl: result.thumbnail?.url?.substring(0, 50) + '...',
      metadataType: result.metadata?.type
    });

  } catch (error) {
    console.log('❌ Error ejecutando generateGenericPreview:', error.message);
  }

  // Test 3: Verificar que maneja errores correctamente
  console.log('\n📋 Test 3: Probar manejo de errores');
  try {
    const invalidFile = null;
    
    const result = await fileService.generateGenericPreview(invalidFile, 'test-file-id', 'test-conversation');
    
    console.log('✅ generateGenericPreview manejó el error correctamente');
    console.log('📊 Resultado con error:', {
      hasPreviewUrl: !!result.previewUrl,
      hasThumbnail: !!result.thumbnail,
      hasMetadata: !!result.metadata,
      previewType: result.metadata?.previewType
    });

  } catch (error) {
    console.log('❌ generateGenericPreview no manejó el error correctamente:', error.message);
  }

  console.log('\n🎉 Pruebas de generateGenericPreview completadas');
}

// Ejecutar pruebas
testGenericPreviewFix().catch(console.error); 