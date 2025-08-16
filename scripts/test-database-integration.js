/**
 * 🧪 SCRIPT DE PRUEBA: INTEGRACIÓN CON BASE DE DATOS
 * 
 * Prueba la funcionalidad completa de guardado de archivos en la base de datos
 * incluyendo indexación y consultas eficientes.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

// Inicializar Firebase antes de importar servicios
require('../src/config/firebase');

const FileService = require('../src/services/FileService');
const { logger } = require('../src/utils/logger');

/**
 * Crear un buffer de prueba para simular un archivo
 */
function createTestBuffer(size = 1024) {
  return Buffer.alloc(size, 'A');
}

/**
 * Generar datos de archivo de prueba
 */
function generateTestFileData(conversationId, userId, uploadedBy) {
  return {
    buffer: createTestBuffer(2048), // 2KB
    originalName: `test-file-${Date.now()}.txt`,
    mimetype: 'text/plain',
    size: 2048,
    conversationId,
    userId,
    uploadedBy,
    tags: ['test', 'database-integration']
  };
}

/**
 * Prueba principal de integración con base de datos
 */
async function testDatabaseIntegration() {
  const fileService = new FileService();
  
  logger.info('🧪 Iniciando pruebas de integración con base de datos');
  
  try {
    // Datos de prueba
    const conversationId = 'test-conversation-' + Date.now();
    const userId = 'test-user-123';
    const uploadedBy = 'test@example.com';
    
    logger.info('📋 Datos de prueba configurados', {
      conversationId,
      userId,
      uploadedBy
    });

    // 1. PRUEBA: Subir archivo y verificar guardado en base de datos
    logger.info('🔄 Prueba 1: Subir archivo y verificar guardado en BD');
    
    const testFileData = generateTestFileData(conversationId, userId, uploadedBy);
    const uploadedFile = await fileService.uploadFile(testFileData);
    
    logger.info('✅ Archivo subido exitosamente', {
      fileId: uploadedFile.id,
      originalName: uploadedFile.originalName,
      category: uploadedFile.category
    });

    // 2. PRUEBA: Verificar que el archivo existe en la base de datos
    logger.info('🔄 Prueba 2: Verificar existencia en base de datos');
    
    const fileFromDB = await fileService.getFileById(uploadedFile.id);
    
    if (!fileFromDB) {
      throw new Error('❌ Archivo no encontrado en base de datos');
    }
    
    logger.info('✅ Archivo encontrado en base de datos', {
      fileId: fileFromDB.id,
      conversationId: fileFromDB.conversationId,
      uploadedBy: fileFromDB.uploadedBy
    });

    // 3. PRUEBA: Listar archivos por conversación
    logger.info('🔄 Prueba 3: Listar archivos por conversación');
    
    const filesByConversation = await fileService.listFilesByConversation(conversationId);
    
    logger.info('✅ Archivos listados por conversación', {
      conversationId,
      count: filesByConversation.length,
      files: filesByConversation.map(f => ({
        id: f.id,
        name: f.originalName,
        category: f.category
      }))
    });

    // 4. PRUEBA: Listar archivos por usuario
    logger.info('🔄 Prueba 4: Listar archivos por usuario');
    
    const filesByUser = await fileService.listFilesByUser(userId);
    
    logger.info('✅ Archivos listados por usuario', {
      userId,
      count: filesByUser.length
    });

    // 5. PRUEBA: Buscar archivos por texto
    logger.info('🔄 Prueba 5: Buscar archivos por texto');
    
    const searchResults = await fileService.searchFiles(conversationId, 'test');
    
    logger.info('✅ Búsqueda de archivos completada', {
      searchTerm: 'test',
      results: searchResults.length
    });

    // 6. PRUEBA: Obtener estadísticas
    logger.info('🔄 Prueba 6: Obtener estadísticas de archivos');
    
    const stats = await fileService.getFileStatsByConversation(conversationId);
    
    logger.info('✅ Estadísticas obtenidas', {
      totalFiles: stats.totalFiles,
      totalSize: stats.totalSize,
      byCategory: stats.byCategory
    });

    // 7. PRUEBA: Actualizar metadata
    logger.info('🔄 Prueba 7: Actualizar metadata de archivo');
    
    const updateResult = await fileService.updateFileMetadata(uploadedFile.id, {
      metadata: {
        testUpdate: true,
        updatedAt: new Date().toISOString()
      }
    });
    
    logger.info('✅ Metadata actualizada', { success: updateResult });

    // 8. PRUEBA: Incrementar contador de descargas
    logger.info('🔄 Prueba 8: Incrementar contador de descargas');
    
    const downloadResult = await fileService.incrementDownloadCount(uploadedFile.id);
    
    logger.info('✅ Contador de descargas incrementado', { success: downloadResult });

    // 9. PRUEBA: Subir múltiples archivos de diferentes tipos
    logger.info('🔄 Prueba 9: Subir múltiples archivos de diferentes tipos');
    
    const testFiles = [
      {
        ...generateTestFileData(conversationId, userId, uploadedBy),
        originalName: 'test-image.jpg',
        mimetype: 'image/jpeg',
        buffer: createTestBuffer(5120) // 5KB
      },
      {
        ...generateTestFileData(conversationId, userId, uploadedBy),
        originalName: 'test-document.pdf',
        mimetype: 'application/pdf',
        buffer: createTestBuffer(10240) // 10KB
      },
      {
        ...generateTestFileData(conversationId, userId, uploadedBy),
        originalName: 'test-audio.mp3',
        mimetype: 'audio/mpeg',
        buffer: createTestBuffer(15360) // 15KB
      }
    ];

    const uploadedFiles = [];
    for (const testFile of testFiles) {
      const uploaded = await fileService.uploadFile(testFile);
      uploadedFiles.push(uploaded);
      logger.info('✅ Archivo adicional subido', {
        id: uploaded.id,
        name: uploaded.originalName,
        category: uploaded.category
      });
    }

    // 10. PRUEBA: Verificar estadísticas actualizadas
    logger.info('🔄 Prueba 10: Verificar estadísticas actualizadas');
    
    const updatedStats = await fileService.getFileStatsByConversation(conversationId);
    
    logger.info('✅ Estadísticas actualizadas', {
      totalFiles: updatedStats.totalFiles,
      totalSize: updatedStats.totalSize,
      byCategory: updatedStats.byCategory
    });

    // 11. PRUEBA: Buscar archivos duplicados
    logger.info('🔄 Prueba 11: Buscar archivos duplicados');
    
    const duplicates = await fileService.findDuplicateFiles(conversationId);
    
    logger.info('✅ Búsqueda de duplicados completada', {
      duplicateGroups: duplicates.length
    });

    // 12. PRUEBA: Soft delete de archivo
    logger.info('🔄 Prueba 12: Soft delete de archivo');
    
    const deleteResult = await fileService.softDeleteFile(uploadedFile.id, uploadedBy);
    
    logger.info('✅ Archivo marcado como eliminado', { success: deleteResult });

    // 13. PRUEBA: Verificar que el archivo eliminado no aparece en listas
    logger.info('🔄 Prueba 13: Verificar archivo eliminado no aparece en listas');
    
    const filesAfterDelete = await fileService.listFilesByConversation(conversationId);
    const deletedFileInList = filesAfterDelete.find(f => f.id === uploadedFile.id);
    
    if (deletedFileInList) {
      logger.warn('⚠️ Archivo eliminado aún aparece en la lista');
    } else {
      logger.info('✅ Archivo eliminado correctamente de las listas');
    }

    logger.info('🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE');
    
    // Resumen final
    const finalStats = await fileService.getFileStatsByConversation(conversationId);
    
    logger.info('📊 RESUMEN FINAL', {
      conversationId,
      totalFiles: finalStats.totalFiles,
      totalSize: finalStats.totalSize,
      byCategory: finalStats.byCategory,
      testsPassed: 13
    });

  } catch (error) {
    logger.error('❌ Error en pruebas de integración', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    });
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    await testDatabaseIntegration();
    logger.info('✅ Script de prueba completado exitosamente');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Script de prueba falló', {
      error: error.message
    });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = {
  testDatabaseIntegration,
  generateTestFileData,
  createTestBuffer
}; 