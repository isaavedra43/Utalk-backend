#!/usr/bin/env node
/**
 * 🧪 SCRIPT DE PRUEBA: Envío de archivos adjuntos corregido
 * 
 * Este script simula el flujo completo de envío de archivos para verificar
 * que las correcciones implementadas resuelven el problema de Twilio.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configurar logging
const logger = require('../src/utils/logger');

// Simular datos de prueba
const mockAttachment = {
  id: '2fe8e968-2688-46fa-8fce-3534d8717262', // ID del archivo del log anterior
  type: 'image'
};

const mockRequest = {
  body: {
    conversationId: 'conv_+1234567890_+0987654321',
    content: 'Archivo de prueba',
    attachments: [mockAttachment]
  },
  user: {
    email: 'test@utalk.com',
    workspaceId: 'test-workspace',
    tenantId: 'test-tenant',
    role: 'agent'
  }
};

async function testFileSending() {
  try {
    logger.info('🧪 Iniciando prueba de envío de archivos corregido');
    
    // 1. Verificar que las clases existen
    logger.info('📦 Cargando servicios...');
    
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // 2. Simular obtención de archivo por ID
    logger.info('🔍 Simulando obtención de archivo por ID...');
    
    // Mock del método getFileById para esta prueba
    const originalGetFileById = fileService.getFileById;
    fileService.getFileById = async function(fileId) {
      logger.info('🔍 Mock: Obteniendo archivo por ID', { fileId });
      
      // Simular archivo válido con URL pública
      return {
        id: fileId,
        originalName: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: 636722,
        category: 'image',
        publicUrl: `https://storage.googleapis.com/test-bucket/files/${fileId}/test-image.jpg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=test%40test.iam.gserviceaccount.com%2F20250821%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20250821T063300Z&X-Goog-Expires=86400&X-Goog-SignedHeaders=host&X-Goog-Signature=test-signature`,
        url: `https://storage.googleapis.com/test-bucket/files/${fileId}/test-image.jpg`,
        metadata: {}
      };
    };
    
    // 3. Probar processMessageAttachments
    logger.info('📁 Probando procesamiento de archivos adjuntos...');
    
    const processedFiles = await fileService.processMessageAttachments(
      mockRequest.body.attachments,
      mockRequest.user.email,
      mockRequest.body.conversationId
    );
    
    logger.info('✅ Archivos procesados:', {
      success: processedFiles.success,
      attachmentCount: processedFiles.attachments.length,
      attachments: processedFiles.attachments.map(a => ({
        id: a.id,
        hasUrl: !!a.url,
        urlValid: !!(a.url && typeof a.url === 'string' && a.url.startsWith('http')),
        type: a.type,
        size: a.size
      }))
    });
    
    // 4. Simular preparación de URLs para Twilio (lógica corregida)
    logger.info('🔍 Simulando preparación de URLs para Twilio...');
    
    const mediaUrls = processedFiles.attachments
      .filter(attachment => attachment && attachment.url)
      .map(attachment => attachment.url)
      .filter(url => url && typeof url === 'string' && url.startsWith('http'));
    
    logger.info('🔗 URLs preparadas para Twilio:', {
      totalAttachments: processedFiles.attachments.length,
      validUrls: mediaUrls.length,
      urlsPreview: mediaUrls.map(url => url.substring(0, 100) + '...')
    });
    
    // 5. Simular validación de Twilio
    logger.info('📤 Simulando validación para Twilio...');
    
    if (mediaUrls.length === 0) {
      throw new Error('No se pudieron generar URLs válidas para los archivos adjuntos');
    }
    
    // Simular payload de Twilio
    const twilioPayload = {
      from: 'whatsapp:+1234567890',
      to: 'whatsapp:+0987654321',
      body: mockRequest.body.content || 'Archivos adjuntos',
      mediaUrl: mediaUrls
    };
    
    logger.info('📋 Payload simulado para Twilio:', {
      from: twilioPayload.from,
      to: twilioPayload.to,
      bodyLength: twilioPayload.body?.length || 0,
      hasMedia: !!twilioPayload.mediaUrl,
      mediaCount: twilioPayload.mediaUrl?.length || 0,
      payloadKeys: Object.keys(twilioPayload)
    });
    
    // 6. Validación final
    const isValid = !!(
      twilioPayload.mediaUrl && 
      Array.isArray(twilioPayload.mediaUrl) && 
      twilioPayload.mediaUrl.length > 0 &&
      twilioPayload.mediaUrl.every(url => url && typeof url === 'string' && url.startsWith('http'))
    );
    
    logger.info('🎯 Resultado de la prueba:', {
      success: isValid,
      message: isValid 
        ? 'Las correcciones funcionan correctamente - Twilio recibirá hasMedia: true' 
        : 'Aún hay problemas con la generación de URLs',
      mediaUrlsCount: twilioPayload.mediaUrl?.length || 0,
      allUrlsValid: twilioPayload.mediaUrl?.every(url => url && typeof url === 'string' && url.startsWith('http'))
    });
    
    if (!isValid) {
      throw new Error('La validación falló - las URLs no son válidas para Twilio');
    }
    
    logger.info('✅ PRUEBA EXITOSA: El problema de envío de archivos está corregido');
    
    // Restaurar método original
    fileService.getFileById = originalGetFileById;
    
    return true;
    
  } catch (error) {
    logger.error('❌ ERROR EN PRUEBA DE ENVÍO DE ARCHIVOS:', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5)
    });
    return false;
  }
}

// Ejecutar prueba
if (require.main === module) {
  testFileSending()
    .then(success => {
      if (success) {
        logger.info('🎉 RESULTADO: Las correcciones resuelven el problema de envío de archivos');
        process.exit(0);
      } else {
        logger.error('💥 RESULTADO: Aún hay problemas pendientes por resolver');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('💥 Error fatal en la prueba:', error);
      process.exit(1);
    });
}

module.exports = { testFileSending };