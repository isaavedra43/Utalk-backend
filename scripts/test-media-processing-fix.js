/**
 * 🧪 SCRIPT DE PRUEBA: Corrección de Procesamiento de Media
 * 
 * Prueba específicamente la corrección del error:
 * "Error procesando media individual: Cannot read properties of undefined (reading 'error')"
 * 
 * @author Backend Team
 * @version 1.0.0
 */

const { MessageService } = require('../src/services/MessageService');
const { FileService } = require('../src/services/FileService');

console.log('🧪 INICIANDO PRUEBA DE CORRECCIÓN DE PROCESAMIENTO DE MEDIA\n');

async function testMediaProcessingFix() {
  try {
    console.log('🔄 Ejecutando prueba de procesamiento de media...\n');

    // Simular datos de webhook con media
    const mockMediaUrl = 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123';
    const mockMessageSid = 'MM123456789';
    const mockIndex = 0;

    console.log('📋 Datos de prueba:');
    console.log('- Media URL:', mockMediaUrl);
    console.log('- Message SID:', mockMessageSid);
    console.log('- Index:', mockIndex);
    console.log('');

    // Test 1: Probar processIndividualWebhookMedia
    console.log('1. Probando processIndividualWebhookMedia...');
    try {
      const result = await MessageService.processIndividualWebhookMedia(
        mockMediaUrl,
        mockMessageSid,
        mockIndex
      );
      console.log('✅ processIndividualWebhookMedia: PASÓ');
      console.log('   Resultado:', {
        fileId: result.fileId,
        category: result.category,
        url: result.url ? 'URL generada' : 'Sin URL',
        size: result.size,
        mimetype: result.mimetype
      });
    } catch (error) {
      console.log('❌ processIndividualWebhookMedia: FALLÓ');
      console.log('   Error:', error.message);
      console.log('   Stack:', error.stack?.split('\n').slice(0, 3));
    }

    console.log('');

    // Test 2: Probar FileService.uploadFile con datos simulados
    console.log('2. Probando FileService.uploadFile...');
    try {
      const fileService = new FileService();
      
      // Crear datos de archivo simulados
      const mockFileData = {
        buffer: Buffer.from('datos de prueba'),
        originalName: 'test-image.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        conversationId: 'temp-webhook',
        userId: null,
        uploadedBy: 'webhook',
        tags: ['test', 'webhook']
      };

      const uploadResult = await fileService.uploadFile(mockFileData);
      console.log('✅ FileService.uploadFile: PASÓ');
      console.log('   Resultado:', {
        id: uploadResult.id,
        category: uploadResult.category,
        processTime: uploadResult.processTime
      });
    } catch (error) {
      console.log('❌ FileService.uploadFile: FALLÓ');
      console.log('   Error:', error.message);
      console.log('   Stack:', error.stack?.split('\n').slice(0, 3));
    }

    console.log('');

    // Test 3: Probar validación de archivo
    console.log('3. Probando validación de archivo...');
    try {
      const fileService = new FileService();
      
      const validation = fileService.validateFile({
        buffer: Buffer.from('datos'),
        mimetype: 'image/jpeg',
        size: 1024
      });

      console.log('✅ Validación de archivo: PASÓ');
      console.log('   Resultado:', validation);
    } catch (error) {
      console.log('❌ Validación de archivo: FALLÓ');
      console.log('   Error:', error.message);
    }

    console.log('');

    // Test 4: Probar procesamiento por categoría
    console.log('4. Probando procesamiento por categoría...');
    try {
      const fileService = new FileService();
      
      const processedFile = await fileService.processFileByCategory(
        Buffer.from('datos de imagen'),
        'test-file-id',
        'temp-webhook',
        'image',
        'image/jpeg',
        'test-image.jpg'
      );

      console.log('✅ Procesamiento por categoría: PASÓ');
      console.log('   Resultado:', {
        storagePath: processedFile.storagePath,
        publicUrl: processedFile.publicUrl ? 'URL generada' : 'Sin URL',
        metadata: processedFile.metadata ? 'Metadata presente' : 'Sin metadata'
      });
    } catch (error) {
      console.log('❌ Procesamiento por categoría: FALLÓ');
      console.log('   Error:', error.message);
      console.log('   Stack:', error.stack?.split('\n').slice(0, 3));
    }

    console.log('\n🎉 PRUEBA COMPLETADA');

  } catch (error) {
    console.error('❌ Error general en la prueba:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0, 5));
  }
}

// Ejecutar prueba
if (require.main === module) {
  testMediaProcessingFix()
    .then(() => {
      console.log('\n✅ PRUEBA FINALIZADA EXITOSAMENTE');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ PRUEBA FALLÓ:', error.message);
      process.exit(1);
    });
}

module.exports = {
  testMediaProcessingFix
}; 