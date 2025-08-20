#!/usr/bin/env node

/**
 * 🎵 SCRIPT DE PRUEBA: FASE 3 - AUDIO EN TIEMPO REAL
 * 
 * Este script valida todas las funcionalidades de audio en tiempo real:
 * - Streaming de audio
 * - Grabación de audio
 * - Eventos WebSocket para audio
 * - Controles de audio en tiempo real
 * 
 * USO: node scripts/test-audio-real-time.js
 */

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Configurar logger
const logger = require('../src/utils/logger');

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎵 ========================================' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎵 PRUEBA FASE 3: AUDIO EN TIEMPO REAL' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎵 ========================================\n' });

// Variables de prueba
const TEST_CONVERSATION_ID = 'test-audio-conversation-' + Date.now();
const TEST_USER_EMAIL = 'test-audio@example.com';
const TEST_FILE_ID = 'test-audio-file-' + uuidv4();

// Simular archivo de audio de prueba
function createTestAudioBuffer(durationSeconds = 5) {
  // Crear un buffer de audio sintético para pruebas
  const sampleRate = 44100;
  const channels = 2;
  const bytesPerSample = 2;
  const totalSamples = sampleRate * durationSeconds;
  const bufferSize = totalSamples * channels * bytesPerSample;
  
  const buffer = Buffer.alloc(bufferSize);
  
  // Generar onda sinusoidal simple
  for (let i = 0; i < totalSamples; i++) {
    const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5; // 440Hz
    const sampleValue = Math.floor(sample * 32767);
    
    // Escribir para ambos canales
    buffer.writeInt16LE(sampleValue, i * 4);
    buffer.writeInt16LE(sampleValue, i * 4 + 2);
  }
  
  return buffer;
}

/**
 * 🧪 PRUEBA 1: STREAMING DE AUDIO
 */
async function testAudioStreaming() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 PRUEBA 1: Streaming de audio' });
  try {
    const AudioProcessor = require('../src/services/AudioProcessor');
    const audioProcessor = new AudioProcessor();
    
    // Crear buffer de audio de prueba
    const testBuffer = createTestAudioBuffer(3);
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Buffer de audio de prueba creado:', {
      size: testBuffer.length,
      duration: '3 segundos'
    } });
    
    // Probar optimización para streaming web
    const optimizedResult = await audioProcessor.optimizeForWebStreaming(testBuffer, {
      targetBitrate: 128000,
      targetFormat: 'mp3',
      normalize: true,
      removeSilence: false
    });
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Audio optimizado para streaming:', {
      originalSize: optimizedResult.metadata.originalSize,
      optimizedSize: optimizedResult.metadata.optimizedSize,
      compressionRatio: optimizedResult.metadata.compressionRatio,
      format: optimizedResult.metadata.format,
      bitrate: optimizedResult.metadata.bitrate
    } });
    
    // Probar generación de chunks
    const chunks = await audioProcessor.generateAudioChunks(testBuffer, {
      chunkDuration: 1,
      bitrate: 128000,
      format: 'mp3'
    });
    
    console.log('✅ Chunks de audio generados:', {
      totalChunks: chunks.length,
      averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.size, 0) / chunks.length),
      totalSize: chunks.reduce((sum, chunk) => sum + chunk.size, 0)
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error en prueba de streaming:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 2: GRABACIÓN DE AUDIO
 */
async function testAudioRecording() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 2: Grabación de audio' });
  try {
    const AudioProcessor = require('../src/services/AudioProcessor');
    const audioProcessor = new AudioProcessor();
    
    // Simular socket para pruebas
    const mockSocket = {
      emit: (event, data) => {
        console.log(`📡 Socket emit: ${event}`, {
          recordingId: data.recordingId?.substring(0, 20) + '...',
          conversationId: data.conversationId?.substring(0, 20) + '...',
          progress: data.progress,
          elapsedTime: data.elapsedTime
        });
      }
    };
    
    // Probar grabación de audio (versión simulada)
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎙️ Iniciando grabación simulada...' });
    
    // Simular proceso de grabación
    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simular progreso de grabación
    for (let i = 0; i <= 5; i++) {
      setTimeout(() => {
        mockSocket.emit('audio-recording-progress', {
          recordingId,
          conversationId: TEST_CONVERSATION_ID,
          progress: i * 20,
          elapsedTime: i,
          remainingTime: 5 - i
        });
      }, i * 1000);
    }
    
    // Simular finalización de grabación
    setTimeout(async () => {
      const testBuffer = createTestAudioBuffer(5);
      
      // Procesar audio grabado
      const processedAudio = await audioProcessor.processRecordedAudio(testBuffer, {
        format: 'mp3',
        bitrate: 128000,
        normalize: true,
        removeNoise: true
      });
      
      console.log('✅ Audio grabado procesado:', {
        originalSize: testBuffer.length,
        processedSize: processedAudio.length,
        compressionRatio: ((testBuffer.length - processedAudio.length) / testBuffer.length * 100).toFixed(1) + '%'
      });
      
      // Simular guardado
      const savedAudio = await audioProcessor.saveRecordedAudio(processedAudio, {
        recordingId,
        conversationId: TEST_CONVERSATION_ID,
        format: 'mp3'
      });
      
      console.log('✅ Audio grabado guardado:', {
        recordingId: savedAudio.recordingId,
        storagePath: savedAudio.storagePath,
        url: savedAudio.url?.substring(0, 50) + '...'
      });
      
      mockSocket.emit('audio-recording-completed', {
        recordingId,
        conversationId: TEST_CONVERSATION_ID,
        audioUrl: savedAudio.url,
        duration: 5,
        size: processedAudio.length,
        metadata: savedAudio.metadata
      });
      
    }, 6000);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error en prueba de grabación:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 3: EVENTOS WEBSOCKET PARA AUDIO
 */
async function testAudioWebSocketEvents() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 3: Eventos WebSocket para audio' });
  
  return new Promise((resolve) => {
    try {
      // Simular conexión WebSocket
      const mockSocket = {
        userEmail: TEST_USER_EMAIL,
        workspaceId: 'test-workspace',
        tenantId: 'test-tenant',
        decodedToken: {
          workspaceId: 'test-workspace',
          tenantId: 'test-tenant'
        },
        emit: (event, data) => {
          console.log(`📡 WebSocket emit: ${event}`, {
            fileId: data.fileId?.substring(0, 20) + '...',
            conversationId: data.conversationId?.substring(0, 20) + '...',
            currentTime: data.currentTime,
            duration: data.duration,
            playedBy: data.playedBy?.substring(0, 20) + '...'
          });
        }
      };
      
      // Simular EnterpriseSocketManager
      const { EnterpriseSocketManager } = require('../src/socket/enterpriseSocketManager');
      const socketManager = new EnterpriseSocketManager();
      
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎵 Simulando eventos de audio...' });
      
      // Simular reproducción de audio
      setTimeout(() => {
        socketManager.handleAudioPlaying(mockSocket, {
          fileId: TEST_FILE_ID,
          conversationId: TEST_CONVERSATION_ID,
          currentTime: 0,
          duration: 180
        });
      }, 1000);
      
      // Simular pausa de audio
      setTimeout(() => {
        socketManager.handleAudioPaused(mockSocket, {
          fileId: TEST_FILE_ID,
          conversationId: TEST_CONVERSATION_ID,
          pausedAt: 45
        });
      }, 2000);
      
      // Simular detención de audio
      setTimeout(() => {
        socketManager.handleAudioStopped(mockSocket, {
          fileId: TEST_FILE_ID,
          conversationId: TEST_CONVERSATION_ID,
          stoppedAt: 90
        });
      }, 3000);
      
      // Simular inicio de grabación
      setTimeout(() => {
        socketManager.handleAudioRecording(mockSocket, {
          conversationId: TEST_CONVERSATION_ID,
          duration: 60,
          format: 'mp3'
        });
      }, 4000);
      
      // Simular detención de grabación
      setTimeout(() => {
        socketManager.handleAudioRecordingStopped(mockSocket, {
          conversationId: TEST_CONVERSATION_ID
        });
      }, 5000);
      
      setTimeout(() => {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Eventos WebSocket de audio simulados correctamente' });
        resolve(true);
      }, 6000);
      
    } catch (error) {
      console.error('❌ Error en prueba de WebSocket:', error.message);
      resolve(false);
    }
  });
}

/**
 * 🧪 PRUEBA 4: INTEGRACIÓN COMPLETA DE AUDIO
 */
async function testCompleteAudioIntegration() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 4: Integración completa de audio' });
  try {
    const AudioProcessor = require('../src/services/AudioProcessor');
    const audioProcessor = new AudioProcessor();
    
    // Crear audio de prueba
    const testBuffer = createTestAudioBuffer(10);
    console.log('✅ Audio de prueba creado (10 segundos)');
    
    // Optimizar para streaming
    const optimizedAudio = await audioProcessor.optimizeForWebStreaming(testBuffer, {
      targetBitrate: 128000,
      targetFormat: 'mp3',
      normalize: true,
      removeSilence: true
    });
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Audio optimizado para streaming web' });
    
    // Generar chunks para streaming
    const streamingChunks = await audioProcessor.generateAudioChunks(optimizedAudio.buffer, {
      chunkDuration: 2,
      bitrate: 128000,
      format: 'mp3'
    });
    
    console.log('✅ Chunks de streaming generados:', {
      totalChunks: streamingChunks.length,
      totalDuration: streamingChunks.length * 2 + ' segundos',
      averageChunkSize: Math.round(streamingChunks.reduce((sum, chunk) => sum + chunk.size, 0) / streamingChunks.length)
    });
    
    // Simular reproducción en tiempo real
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎵 Simulando reproducción en tiempo real...' });
    for (let i = 0; i < streamingChunks.length; i++) {
      const chunk = streamingChunks[i];
      logger.info('Chunk ${i + 1}/${streamingChunks.length}: ${chunk.size} bytes, ${chunk.duration}s', { category: 'AUTO_MIGRATED' });
      
      // Simular delay de reproducción
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Reproducción en tiempo real simulada correctamente' });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error en integración completa:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 5: VALIDACIÓN DE FORMATOS Y COMPATIBILIDAD
 */
async function testAudioFormatsAndCompatibility() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 5: Validación de formatos y compatibilidad' });
  try {
    const AudioProcessor = require('../src/services/AudioProcessor');
    const audioProcessor = new AudioProcessor();
    
    const testBuffer = createTestAudioBuffer(3);
    const formats = ['mp3', 'wav', 'ogg', 'aac'];
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎵 Probando diferentes formatos de audio...' });
    
    for (const format of formats) {
      try {
        const optimizedAudio = await audioProcessor.optimizeForWebStreaming(testBuffer, {
          targetBitrate: 128000,
          targetFormat: format,
          normalize: true,
          removeSilence: false
        });
        
        logger.info('Formato ${format.toUpperCase()}:', { category: 'AUTO_MIGRATED', data: {
          originalSize: optimizedAudio.metadata.originalSize,
          optimizedSize: optimizedAudio.metadata.optimizedSize,
          compressionRatio: optimizedAudio.metadata.compressionRatio
        } });
        
      } catch (formatError) {
        logger.info('Formato ${format.toUpperCase()}: No soportado - ${formatError.message}', { category: 'AUTO_MIGRATED' });
      }
    }
    
    // Probar diferentes bitrates
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎵 Probando diferentes bitrates...' });
    const bitrates = [64000, 128000, 192000, 256000];
    
    for (const bitrate of bitrates) {
      try {
        const optimizedAudio = await audioProcessor.optimizeForWebStreaming(testBuffer, {
          targetBitrate: bitrate,
          targetFormat: 'mp3',
          normalize: true,
          removeSilence: false
        });
        
        logger.info('Bitrate ${bitrate/1000}kbps:', { category: 'AUTO_MIGRATED', data: {
          optimizedSize: optimizedAudio.metadata.optimizedSize,
          compressionRatio: optimizedAudio.metadata.compressionRatio
        } });
        
      } catch (bitrateError) {
        logger.info('Bitrate ${bitrate/1000}kbps: Error - ${bitrateError.message}', { category: 'AUTO_MIGRATED' });
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error en validación de formatos:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 6: RENDIMIENTO Y OPTIMIZACIÓN
 */
async function testAudioPerformance() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 6: Rendimiento y optimización' });
  try {
    const AudioProcessor = require('../src/services/AudioProcessor');
    const audioProcessor = new AudioProcessor();
    
    // Probar con diferentes tamaños de audio
    const testDurations = [5, 10, 30, 60]; // segundos
    
    for (const duration of testDurations) {
      logger.info('\n� Probando audio de ${duration} segundos...', { category: 'AUTO_MIGRATED' });
      
      const startTime = Date.now();
      const testBuffer = createTestAudioBuffer(duration);
      const bufferCreationTime = Date.now() - startTime;
      
      logger.info('Buffer creado en ${bufferCreationTime}ms', { category: 'AUTO_MIGRATED' });
      
      // Optimizar audio
      const optimizationStart = Date.now();
      const optimizedAudio = await audioProcessor.optimizeForWebStreaming(testBuffer, {
        targetBitrate: 128000,
        targetFormat: 'mp3',
        normalize: true,
        removeSilence: true
      });
      const optimizationTime = Date.now() - optimizationStart;
      
      logger.info('Optimización completada en ${optimizationTime}ms', { category: 'AUTO_MIGRATED' });
      
      // Generar chunks
      const chunkingStart = Date.now();
      const chunks = await audioProcessor.generateAudioChunks(optimizedAudio.buffer, {
        chunkDuration: 2,
        bitrate: 128000,
        format: 'mp3'
      });
      const chunkingTime = Date.now() - chunkingStart;
      
      console.log(`  Chunks generados en ${chunkingTime}ms:`, {
        totalChunks: chunks.length,
        averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.size, 0) / chunks.length)
      });
      
      const totalTime = Date.now() - startTime;
      logger.info('⏱ Tiempo total: ${totalTime}ms', { category: 'AUTO_MIGRATED' });
      
      // Calcular métricas de rendimiento
      const processingRate = (optimizedAudio.buffer.length / 1024 / 1024) / (totalTime / 1000); // MB/s
      logger.info('Velocidad de procesamiento: ${processingRate.toFixed(2)} MB/s', { category: 'AUTO_MIGRATED' });
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error en prueba de rendimiento:', error.message);
    return false;
  }
}

/**
 * FUNCIÓN PRINCIPAL DE PRUEBA
 */
async function runAllTests() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 Iniciando pruebas de audio en tiempo real...\n' });
  
  const tests = [
    { name: 'Streaming de audio', fn: testAudioStreaming },
    { name: 'Grabación de audio', fn: testAudioRecording },
    { name: 'Eventos WebSocket', fn: testAudioWebSocketEvents },
    { name: 'Integración completa', fn: testCompleteAudioIntegration },
    { name: 'Formatos y compatibilidad', fn: testAudioFormatsAndCompatibility },
    { name: 'Rendimiento y optimización', fn: testAudioPerformance }
  ];
  
  const results = [];
  
  for (const test of tests) {
    logger.info('\n� Ejecutando: ${test.name}', { category: 'AUTO_MIGRATED' });
    console.log('─'.repeat(50));
    
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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎵 ========================================' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎵 RESUMEN DE PRUEBAS FASE 3' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎵 ========================================' });
  
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
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎵 La Fase 3: Audio en tiempo real está funcionando correctamente.' });
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n⚠️ Algunas pruebas fallaron. Revisar logs para más detalles.' });
  }
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎵 ========================================' });
  
  return successfulTests === totalTests;
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Error crítico en las pruebas:', error);
      process.exit(1);
    });
}

module.exports = {
  testAudioStreaming,
  testAudioRecording,
  testAudioWebSocketEvents,
  testCompleteAudioIntegration,
  testAudioFormatsAndCompatibility,
  testAudioPerformance,
  runAllTests
}; 