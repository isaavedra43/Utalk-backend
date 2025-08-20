#!/usr/bin/env node

/**
 * 🖼️ SCRIPT DE PRUEBA: FASE 5 - PREVIEW Y VISUALIZACIÓN
 * 
 * Este script valida todas las funcionalidades de preview y visualización:
 * - Preview de imágenes con thumbnails
 * - Preview de documentos con extracción de texto
 * - Preview de videos con metadatos
 * - Lazy loading y optimización
 * 
 * USO: node scripts/test-preview-visualization.js
 */

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Configurar logger
const logger = require('../src/utils/logger');

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🖼️ ========================================' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🖼️ PRUEBA FASE 5: PREVIEW Y VISUALIZACIÓN' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🖼️ ========================================\n' });

// Variables de prueba
const TEST_CONVERSATION_ID = 'test-preview-conversation-' + Date.now();
const TEST_USER_EMAIL = 'test-preview@example.com';

// Crear archivos de prueba
function createTestImageBuffer(width = 800, height = 600) {
  // Crear un buffer de imagen sintética para pruebas
  const canvas = require('canvas');
  const testCanvas = canvas.createCanvas(width, height);
  const ctx = testCanvas.getContext('2d');

  // Fondo degradado
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#ff6b6b');
  gradient.addColorStop(0.5, '#4ecdc4');
  gradient.addColorStop(1, '#45b7d1');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Agregar texto
  ctx.fillStyle = '#ffffff';
  ctx.font = '48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TEST IMAGE', width / 2, height / 2);

  return testCanvas.toBuffer('image/jpeg', { quality: 0.9 });
}

function createTestDocumentBuffer() {
  // Crear un buffer de documento sintético
  const content = `Este es un documento de prueba.
  
Contenido del documento:
- Línea 1: Información importante
- Línea 2: Más datos de prueba
- Línea 3: Contenido adicional

Este documento se usa para probar la funcionalidad de preview de documentos en el sistema de chat.`;

  return Buffer.from(content, 'utf8');
}

function createTestVideoBuffer() {
  // Crear un buffer de video sintético (simulado)
  // En una implementación real, esto sería un archivo de video real
  const videoContent = 'VIDEO_TEST_CONTENT_' + Date.now();
  return Buffer.from(videoContent, 'utf8');
}

/**
 * 🧪 PRUEBA 1: PREVIEW DE IMÁGENES
 */
async function testImagePreview() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 PRUEBA 1: Preview de imágenes' });
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // Crear imagen de prueba
    const testImageBuffer = createTestImageBuffer(1200, 800);
    const fileId = 'test-image-' + uuidv4();
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🖼️ Generando preview de imagen de prueba...' });
    
    // Probar generación de preview completo
    const imagePreview = await fileService.generateImagePreview(
      testImageBuffer,
      fileId,
      TEST_CONVERSATION_ID,
      {
        thumbnailSize: 150,
        previewSize: 800,
        quality: 85
      }
    );
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Preview de imagen generado:', {
      thumbnailSize: `${imagePreview.thumbnail.size / 1024}KB`,
      previewSize: `${imagePreview.preview.size / 1024}KB`,
      originalSize: `${imagePreview.original.size / 1024}KB`,
      compressionRatio: `${((imagePreview.original.size - imagePreview.preview.size) / imagePreview.original.size * 100).toFixed(1)}%`
    });
    
    // Probar thumbnail rápido
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🖼️ Generando thumbnail rápido...' });
    const quickThumbnail = await fileService.generateQuickThumbnail(
      testImageBuffer,
      fileId,
      TEST_CONVERSATION_ID
    );
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Thumbnail rápido generado:', {
      size: `${quickThumbnail.size / 1024}KB`,
      dimensions: `${quickThumbnail.dimensions.width}x${quickThumbnail.dimensions.height}`
    } });
    
    // Validar URLs
    const hasValidUrls = imagePreview.thumbnail.url && 
                        imagePreview.preview.url && 
                        quickThumbnail.url;
    
    if (hasValidUrls) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ URLs de preview válidas generadas' });
      return true;
    } else {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error: URLs de preview no válidas' });
      return false;
    }
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en prueba de preview de imágenes:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 2: PREVIEW DE DOCUMENTOS
 */
async function testDocumentPreview() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 2: Preview de documentos' });
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // Probar diferentes tipos de documentos
    const testCases = [
      {
        name: 'Documento de texto simple',
        buffer: createTestDocumentBuffer(),
        mimetype: 'text/plain',
        expectedType: 'text'
      },
      {
        name: 'Documento JSON',
        buffer: Buffer.from(JSON.stringify({ test: 'data', number: 123 }, null, 2)),
        mimetype: 'application/json',
        expectedType: 'json'
      }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (const testCase of testCases) {
      logger.info('\n  � Probando: ${testCase.name}', { category: 'AUTO_MIGRATED' });
      
      const fileId = 'test-doc-' + uuidv4();
      
      try {
        const documentPreview = await fileService.generateDocumentPreview(
          testCase.buffer,
          fileId,
          TEST_CONVERSATION_ID,
          testCase.mimetype,
          {
            extractText: true,
            generateThumbnail: true,
            maxPages: 3,
            thumbnailSize: 200
          }
        );
        
        logger.info('Tipo de documento: ${documentPreview.documentType}', { category: 'AUTO_MIGRATED' });
        logger.info('Tiene texto: ${!!documentPreview.text}', { category: 'AUTO_MIGRATED' });
        logger.info('Tiene thumbnail: ${!!documentPreview.thumbnail}', { category: 'AUTO_MIGRATED' });
        logger.info('Número de páginas: ${documentPreview.pages.length}', { category: 'AUTO_MIGRATED' });
        
        if (documentPreview.documentType === testCase.expectedType) {
          logger.info('PASÓ', { category: 'AUTO_MIGRATED' });
          passedTests++;
        } else {
          logger.info('❌ FALLÓ - Esperado: ${testCase.expectedType}, Obtenido: ${documentPreview.documentType}', { category: 'AUTO_MIGRATED' });
        }
        
      } catch (docError) {
        logger.info('❌ Error procesando documento: ${docError.message}', { category: 'AUTO_MIGRATED' });
      }
    }
    
    logger.info('\n Resultados: ${passedTests}/${totalTests} pruebas pasaron', { category: 'AUTO_MIGRATED' });
    return passedTests === totalTests;
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en prueba de preview de documentos:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 3: PREVIEW DE VIDEOS
 */
async function testVideoPreview() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 3: Preview de videos' });
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // Crear video de prueba (simulado)
    const testVideoBuffer = createTestVideoBuffer();
    const fileId = 'test-video-' + uuidv4();
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎥 Generando preview de video de prueba...' });
    
    try {
      const videoPreview = await fileService.generateVideoPreview(
        testVideoBuffer,
        fileId,
        TEST_CONVERSATION_ID,
        {
          generateThumbnail: true,
          extractMetadata: true,
          thumbnailSize: 320,
          thumbnailTime: 5
        }
      );
      
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Preview de video generado:', {
        videoType: videoPreview.videoType,
        originalSize: `${videoPreview.originalSize / 1024}KB`,
        hasMetadata: !!videoPreview.metadata,
        hasThumbnail: !!videoPreview.thumbnail
      } });
      
      if (videoPreview.thumbnail) {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  Thumbnail:', {
          size: `${videoPreview.thumbnail.size / 1024}KB`,
          dimensions: `${videoPreview.thumbnail.dimensions.width}x${videoPreview.thumbnail.dimensions.height}`,
          type: videoPreview.thumbnail.type
        } });
      }
      
      if (videoPreview.metadata) {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  Metadatos:', {
          duration: videoPreview.metadata.duration,
          format: videoPreview.metadata.format,
          hasVideo: !!videoPreview.metadata.video,
          hasAudio: !!videoPreview.metadata.audio
        } });
      }
      
      return true;
      
    } catch (videoError) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️ Error en preview de video (esperado para video simulado):', videoError.message);
      
      // Probar preview completo con manejo de errores
      try {
        const completeVideoPreview = await fileService.generateCompleteVideoPreview(
          testVideoBuffer,
          fileId,
          TEST_CONVERSATION_ID,
          'video/mp4',
          {
            generateThumbnail: true,
            extractMetadata: false, // No extraer metadatos para video simulado
            generatePreviewUrl: true
          }
        );
        
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Preview completo de video generado:', {
          videoType: completeVideoPreview.videoType,
          hasThumbnail: !!completeVideoPreview.thumbnail,
          hasPreviewUrl: !!completeVideoPreview.previewUrl
        } });
        
        return true;
        
      } catch (completeError) {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️ Error en preview completo de video:', completeError.message });
        return false;
      }
    }
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en prueba de preview de videos:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 4: INTEGRACIÓN COMPLETA DE PREVIEW
 */
async function testCompletePreviewIntegration() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 4: Integración completa de preview' });
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // Simular flujo completo de preview para diferentes tipos de archivos
    const testFiles = [
      {
        name: 'Imagen grande',
        buffer: createTestImageBuffer(1920, 1080),
        mimetype: 'image/jpeg',
        type: 'image'
      },
      {
        name: 'Documento de texto',
        buffer: createTestDocumentBuffer(),
        mimetype: 'text/plain',
        type: 'document'
      },
      {
        name: 'Video simulado',
        buffer: createTestVideoBuffer(),
        mimetype: 'video/mp4',
        type: 'video'
      }
    ];
    
    let passedTests = 0;
    let totalTests = testFiles.length;
    
    for (const testFile of testFiles) {
      logger.info('\n   Procesando: ${testFile.name}', { category: 'AUTO_MIGRATED' });
      
      const fileId = 'test-integration-' + uuidv4();
      
      try {
        let previewResult = null;
        
        // Generar preview según el tipo de archivo
        switch (testFile.type) {
          case 'image':
            previewResult = await fileService.generateImagePreview(
              testFile.buffer,
              fileId,
              TEST_CONVERSATION_ID,
              {
                thumbnailSize: 150,
                previewSize: 800,
                quality: 85
              }
            );
            break;
            
          case 'document':
            previewResult = await fileService.generateDocumentPreview(
              testFile.buffer,
              fileId,
              TEST_CONVERSATION_ID,
              testFile.mimetype,
              {
                extractText: true,
                generateThumbnail: true,
                maxPages: 3,
                thumbnailSize: 200
              }
            );
            break;
            
          case 'video':
            previewResult = await fileService.generateCompleteVideoPreview(
              testFile.buffer,
              fileId,
              TEST_CONVERSATION_ID,
              testFile.mimetype,
              {
                generateThumbnail: true,
                extractMetadata: false,
                generatePreviewUrl: true
              }
            );
            break;
        }
        
        if (previewResult) {
          logger.info('Preview generado exitosamente', { category: 'AUTO_MIGRATED' });
          logger.info('Tipo: ${testFile.type}', { category: 'AUTO_MIGRATED' });
          logger.info('Tamaño original: ${(testFile.buffer.length / 1024).toFixed(1)}KB', { category: 'AUTO_MIGRATED' });
          
          // Verificar que se generaron los elementos esperados
          let hasRequiredElements = false;
          
          if (testFile.type === 'image') {
            hasRequiredElements = previewResult.thumbnail && previewResult.preview;
          } else if (testFile.type === 'document') {
            hasRequiredElements = previewResult.thumbnail || previewResult.text;
          } else if (testFile.type === 'video') {
            hasRequiredElements = previewResult.thumbnail || previewResult.previewUrl;
          }
          
          if (hasRequiredElements) {
            logger.info('Elementos requeridos generados', { category: 'AUTO_MIGRATED' });
            passedTests++;
          } else {
            logger.info('❌ Faltan elementos requeridos', { category: 'AUTO_MIGRATED' });
          }
        } else {
          logger.info('❌ No se generó preview', { category: 'AUTO_MIGRATED' });
        }
        
      } catch (integrationError) {
        logger.info('❌ Error en integración: ${integrationError.message}', { category: 'AUTO_MIGRATED' });
      }
    }
    
    logger.info('\n Resultados: ${passedTests}/${totalTests} pruebas pasaron', { category: 'AUTO_MIGRATED' });
    return passedTests === totalTests;
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en integración completa:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 5: OPTIMIZACIÓN Y LAZY LOADING
 */
async function testOptimizationAndLazyLoading() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 5: Optimización y lazy loading' });
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // Crear imagen de prueba grande
    const largeImageBuffer = createTestImageBuffer(2048, 1536);
    const fileId = 'test-optimization-' + uuidv4();
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🖼️ Probando optimización de imagen grande...' });
    
    // Medir tiempo de generación de thumbnail rápido
    const startTime = Date.now();
    
    const quickThumbnail = await fileService.generateQuickThumbnail(
      largeImageBuffer,
      fileId,
      TEST_CONVERSATION_ID
    );
    
    const quickTime = Date.now() - startTime;
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Thumbnail rápido generado:', {
      time: `${quickTime}ms`,
      size: `${quickThumbnail.size / 1024}KB`,
      dimensions: `${quickThumbnail.dimensions.width}x${quickThumbnail.dimensions.height}`
    } });
    
    // Medir tiempo de generación de preview completo
    const previewStartTime = Date.now();
    
    const fullPreview = await fileService.generateImagePreview(
      largeImageBuffer,
      fileId,
      TEST_CONVERSATION_ID,
      {
        thumbnailSize: 150,
        previewSize: 800,
        quality: 85
      }
    );
    
    const previewTime = Date.now() - previewStartTime;
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Preview completo generado:', {
      time: `${previewTime}ms`,
      thumbnailSize: `${fullPreview.thumbnail.size / 1024}KB`,
      previewSize: `${fullPreview.preview.size / 1024}KB`,
      compressionRatio: `${((largeImageBuffer.length - fullPreview.preview.size) / largeImageBuffer.length * 100).toFixed(1)}%`
    });
    
    // Validar que el thumbnail rápido es más pequeño y rápido
    const isOptimized = quickThumbnail.size < fullPreview.thumbnail.size && quickTime < previewTime;
    
    if (isOptimized) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Optimización y lazy loading funcionando correctamente' });
      return true;
    } else {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Optimización no funcionando como esperado' });
      return false;
    }
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en prueba de optimización:', error.message);
    return false;
  }
}

/**
 * FUNCIÓN PRINCIPAL DE PRUEBA
 */
async function runAllTests() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 Iniciando pruebas de preview y visualización...\n' });
  
  const tests = [
    { name: 'Preview de imágenes', fn: testImagePreview },
    { name: 'Preview de documentos', fn: testDocumentPreview },
    { name: 'Preview de videos', fn: testVideoPreview },
    { name: 'Integración completa de preview', fn: testCompletePreviewIntegration },
    { name: 'Optimización y lazy loading', fn: testOptimizationAndLazyLoading }
  ];
  
  const results = [];
  
  for (const test of tests) {
    logger.info('\n� Ejecutando: ${test.name}', { category: 'AUTO_MIGRATED' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '─'.repeat(50));
    
    const startTime = Date.now();
    const result = await test.fn();
    const duration = Date.now() - startTime;
    
    results.push({
      name: test.name,
      success: result,
      duration: duration
    });
    
    logger.info('\n${result ? '' : '❌'} ${test.name}: ${result ? 'EXITOSO' : 'FALLIDO'} (${duration}ms)', { category: 'AUTO_MIGRATED' });
  }
  
  // Resumen final
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🖼️ ========================================' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🖼️ RESUMEN DE PRUEBAS FASE 5' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🖼️ ========================================' });
  
  const successfulTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  
  logger.info('\n Resultados:', { category: 'AUTO_MIGRATED' });
  logger.info('Exitosos: ${successfulTests}/${totalTests}', { category: 'AUTO_MIGRATED' });
  logger.info('❌ Fallidos: ${totalTests - successfulTests}/${totalTests}', { category: 'AUTO_MIGRATED' });
  logger.info('⏱ Tiempo total: ${totalTime}ms', { category: 'AUTO_MIGRATED' });
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📋 Detalles por prueba:' });
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    logger.info('${index + 1}. ${status} ${result.name} (${result.duration}ms)', { category: 'AUTO_MIGRATED' });
  });
  
  if (successfulTests === totalTests) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 ¡TODAS LAS PRUEBAS EXITOSAS!' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🖼️ La Fase 5: Preview y visualización está funcionando correctamente.' });
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n⚠️ Algunas pruebas fallaron. Revisar logs para más detalles.' });
  }
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🖼️ ========================================' });
  
  return successfulTests === totalTests;
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error crítico en las pruebas:', error);
      process.exit(1);
    });
}

module.exports = {
  testImagePreview,
  testDocumentPreview,
  testVideoPreview,
  testCompletePreviewIntegration,
  testOptimizationAndLazyLoading,
  runAllTests
}; 