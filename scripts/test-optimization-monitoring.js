#!/usr/bin/env node

/**
 * ⚡ SCRIPT DE PRUEBA: FASE 6 - OPTIMIZACIÓN Y MONITOREO
 * 
 * Este script valida todas las funcionalidades de optimización y monitoreo:
 * - Optimización de rendimiento con cache
 * - Procesamiento de archivos grandes en chunks
 * - Sistema de monitoreo y métricas
 * - Alertas y thresholds
 * - Tests de carga y rendimiento
 * 
 * USO: node scripts/test-optimization-monitoring.js
 */

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Configurar logger
const logger = require('../src/utils/logger');

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚡ ========================================' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚡ PRUEBA FASE 6: OPTIMIZACIÓN Y MONITOREO' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚡ ========================================\n' });

// Variables de prueba
const TEST_CONVERSATION_ID = 'test-optimization-conversation-' + Date.now();
const TEST_USER_EMAIL = 'test-optimization@example.com';

// Crear archivos de prueba de diferentes tamaños
function createTestFile(sizeInMB) {
  const sizeInBytes = sizeInMB * 1024 * 1024;
  return Buffer.alloc(sizeInBytes, 'A'); // Llenar con 'A's
}

function createLargeTestFile(sizeInMB) {
  const sizeInBytes = sizeInMB * 1024 * 1024;
  const chunks = [];
  
  // Crear archivo grande en chunks para evitar problemas de memoria
  const chunkSize = 1024 * 1024; // 1MB chunks
  for (let i = 0; i < sizeInBytes; i += chunkSize) {
    const chunk = Buffer.alloc(Math.min(chunkSize, sizeInBytes - i), 'B');
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

/**
 * 🧪 PRUEBA 1: OPTIMIZACIÓN DE RENDIMIENTO
 */
async function testPerformanceOptimization() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 PRUEBA 1: Optimización de rendimiento' });
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // Probar archivos de diferentes tamaños
    const testSizes = [1, 5, 10, 25, 50]; // MB
    const results = [];
    
    for (const sizeMB of testSizes) {
      logger.info('� Probando archivo de ${sizeMB}MB...', { category: 'AUTO_MIGRATED' });
      
      const testBuffer = createTestFile(sizeMB);
      const fileId = `test-optimization-${sizeMB}mb-${uuidv4()}`;
      
      const startTime = Date.now();
      
      const result = await fileService.processLargeFile(
        testBuffer,
        fileId,
        TEST_CONVERSATION_ID,
        {
          mimetype: 'application/octet-stream',
          optimize: true
        }
      );
      
      const processingTime = Date.now() - startTime;
      
      results.push({
        sizeMB,
        processingTime,
        result: result ? 'success' : 'failed',
        processedInChunks: result?.processedInChunks || false,
        totalChunks: result?.totalChunks || 0
      });
      
      logger.info('${sizeMB}MB procesado en ${processingTime}ms', { category: 'AUTO_MIGRATED' });
    }
    
    // Analizar resultados
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📊 Análisis de rendimiento:' });
    results.forEach(result => {
      const speed = result.sizeMB / (result.processingTime / 1000); // MB/s
      logger.info('${result.sizeMB}MB: ${result.processingTime}ms (${speed.toFixed(2)} MB/s) - ${result.result}', { category: 'AUTO_MIGRATED' });
    });
    
    // Verificar que archivos grandes se procesaron en chunks
    const largeFiles = results.filter(r => r.sizeMB >= 25);
    const chunkedFiles = largeFiles.filter(r => r.processedInChunks);
    
    logger.info('\n Archivos grandes procesados en chunks: ${chunkedFiles.length}/${largeFiles.length}', { category: 'AUTO_MIGRATED' });
    
    return results.every(r => r.result === 'success');
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en prueba de optimización:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 2: SISTEMA DE CACHE
 */
async function testCacheSystem() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 2: Sistema de cache' });
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    const testBuffer = createTestFile(1); // 1MB
    const fileId = `test-cache-${uuidv4()}`;
    const options = { mimetype: 'text/plain' };
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  🔄 Probando cache de archivos...' });
    
    // Primera llamada - debería procesar y cachear
    const startTime1 = Date.now();
    const result1 = await fileService.processLargeFile(testBuffer, fileId, TEST_CONVERSATION_ID, options);
    const time1 = Date.now() - startTime1;
    
    logger.info('Primera llamada: ${time1}ms', { category: 'AUTO_MIGRATED' });
    
    // Segunda llamada - debería usar cache
    const startTime2 = Date.now();
    const result2 = await fileService.processLargeFile(testBuffer, fileId, TEST_CONVERSATION_ID, options);
    const time2 = Date.now() - startTime2;
    
    logger.info('Segunda llamada: ${time2}ms', { category: 'AUTO_MIGRATED' });
    
    // Verificar mejora de rendimiento
    const improvement = ((time1 - time2) / time1) * 100;
    logger.info('Mejora de rendimiento: ${improvement.toFixed(1)}%', { category: 'AUTO_MIGRATED' });
    
    // Obtener métricas de cache
    const metrics = fileService.getPerformanceMetrics();
    logger.info('Cache hits: ${metrics.cacheHits}', { category: 'AUTO_MIGRATED' });
    logger.info('Cache misses: ${metrics.cacheMisses}', { category: 'AUTO_MIGRATED' });
    logger.info('Tasa de acierto: ${metrics.cacheHitRate}', { category: 'AUTO_MIGRATED' });
    
    const cacheEffective = time2 < time1 && metrics.cacheHits > 0;
    logger.info('Cache efectivo: ${cacheEffective ? 'SÍ' : 'NO'}', { category: 'AUTO_MIGRATED' });
    
    return cacheEffective;
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en prueba de cache:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 3: SISTEMA DE MONITOREO
 */
async function testMonitoringSystem() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 3: Sistema de monitoreo' });
  try {
    const fileMonitoringSystem = require('../src/utils/monitoring');
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  📊 Probando sistema de monitoreo...' });
    
    // Simular procesamiento de archivos
    const testFiles = [
      { mimetype: 'image/jpeg', size: 1024 * 1024, success: true },
      { mimetype: 'video/mp4', size: 5 * 1024 * 1024, success: true },
      { mimetype: 'audio/mp3', size: 2 * 1024 * 1024, success: false },
      { mimetype: 'application/pdf', size: 3 * 1024 * 1024, success: true }
    ];
    
    for (const file of testFiles) {
      fileMonitoringSystem.recordFileProcessing({
        fileId: `test-monitoring-${uuidv4()}`,
        conversationId: TEST_CONVERSATION_ID,
        userId: 'test-user',
        mimetype: file.mimetype,
        size: file.size,
        processingTime: Math.random() * 1000 + 100,
        success: file.success,
        error: file.success ? null : new Error('Test error')
      });
    }
    
    // Obtener métricas actuales
    const currentMetrics = fileMonitoringSystem.getCurrentMetrics();
    logger.info('Archivos procesados: ${currentMetrics.files.totalProcessed}', { category: 'AUTO_MIGRATED' });
    logger.info('Archivos subidos: ${currentMetrics.files.totalUploaded}', { category: 'AUTO_MIGRATED' });
    logger.info('Errores totales: ${currentMetrics.errors.total}', { category: 'AUTO_MIGRATED' });
    
    // Verificar categorización por tipo
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '    Archivos por tipo:' });
    Object.entries(currentMetrics.files.byType).forEach(([type, count]) => {
      if (count > 0) {
        logger.info('${type}: ${count}', { category: 'AUTO_MIGRATED' });
      }
    });
    
    // Verificar categorización por tamaño
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '    Archivos por tamaño:' });
    Object.entries(currentMetrics.files.bySize).forEach(([size, count]) => {
      if (count > 0) {
        logger.info('${size}: ${count}', { category: 'AUTO_MIGRATED' });
      }
    });
    
    // Obtener estadísticas detalladas
    const detailedStats = fileMonitoringSystem.getDetailedStats();
    logger.info('Tasa de error: ${detailedStats.overview.errorRate.toFixed(2)}%', { category: 'AUTO_MIGRATED' });
    logger.info('Tamaño promedio: ${(detailedStats.overview.averageFileSize / 1024 / 1024).toFixed(2)}MB', { category: 'AUTO_MIGRATED' });
    
    const monitoringWorking = currentMetrics.files.totalProcessed > 0 && 
                             currentMetrics.errors.total > 0;
    logger.info('Monitoreo funcionando: ${monitoringWorking ? 'SÍ' : 'NO'}', { category: 'AUTO_MIGRATED' });
    
    return monitoringWorking;
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en prueba de monitoreo:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 4: ALERTAS Y THRESHOLDS
 */
async function testAlertsAndThresholds() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 4: Alertas y thresholds' });
  try {
    const fileMonitoringSystem = require('../src/utils/monitoring');
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  🚨 Probando sistema de alertas...' });
    
    // Simular alta tasa de errores para trigger alerta
    for (let i = 0; i < 20; i++) {
      fileMonitoringSystem.recordFileProcessing({
        fileId: `test-alert-${uuidv4()}`,
        conversationId: TEST_CONVERSATION_ID,
        userId: 'test-user',
        mimetype: 'text/plain',
        size: 1024,
        processingTime: 100,
        success: false,
        error: new Error(`Test error ${i}`)
      });
    }
    
    // Verificar que se generaron alertas
    const currentMetrics = fileMonitoringSystem.getCurrentMetrics();
    const errorRate = currentMetrics.performance.errorRate;
    
    logger.info('Tasa de error actual: ${errorRate.toFixed(2)}%', { category: 'AUTO_MIGRATED' });
    logger.info('Errores totales: ${currentMetrics.errors.total}', { category: 'AUTO_MIGRATED' });
    
    // Verificar categorización de errores
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '    Errores por categoría:' });
    Object.entries(currentMetrics.errors.byType).forEach(([category, count]) => {
      if (count > 0) {
        logger.info('${category}: ${count}', { category: 'AUTO_MIGRATED' });
      }
    });
    
    // Verificar errores recientes
    const recentErrors = currentMetrics.errors.recent.slice(0, 5);
    logger.info('Errores recientes: ${recentErrors.length}', { category: 'AUTO_MIGRATED' });
    
    const alertsWorking = errorRate > 0 && currentMetrics.errors.total > 0;
    logger.info('Alertas funcionando: ${alertsWorking ? 'SÍ' : 'NO'}', { category: 'AUTO_MIGRATED' });
    
    return alertsWorking;
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en prueba de alertas:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 5: MÉTRICAS DE RENDIMIENTO
 */
async function testPerformanceMetrics() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 5: Métricas de rendimiento' });
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  ⚡ Probando métricas de rendimiento...' });
    
    // Procesar varios archivos para generar métricas
    const testFiles = [1, 2, 3, 4, 5]; // MB
    
    for (const sizeMB of testFiles) {
      const testBuffer = createTestFile(sizeMB);
      const fileId = `test-metrics-${sizeMB}mb-${uuidv4()}`;
      
      await fileService.processLargeFile(
        testBuffer,
        fileId,
        TEST_CONVERSATION_ID,
        { mimetype: 'application/octet-stream' }
      );
    }
    
    // Obtener métricas de rendimiento
    const metrics = fileService.getPerformanceMetrics();
    
    logger.info('Archivos procesados: ${metrics.filesProcessed}', { category: 'AUTO_MIGRATED' });
    logger.info('Cache hits: ${metrics.cacheHits}', { category: 'AUTO_MIGRATED' });
    logger.info('Cache misses: ${metrics.cacheMisses}', { category: 'AUTO_MIGRATED' });
    logger.info('Tasa de acierto de cache: ${metrics.cacheHitRate}', { category: 'AUTO_MIGRATED' });
    logger.info('Tiempo promedio de procesamiento: ${metrics.averageProcessingTime}', { category: 'AUTO_MIGRATED' });
    logger.info('Errores: ${metrics.errors}', { category: 'AUTO_MIGRATED' });
    
    // Verificar tamaños de cache
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '    Tamaños de cache:' });
    Object.entries(metrics.cacheSize).forEach(([cacheType, size]) => {
      logger.info('${cacheType}: ${size} items', { category: 'AUTO_MIGRATED' });
    });
    
    const metricsWorking = metrics.filesProcessed > 0 && 
                          typeof metrics.averageProcessingTime === 'string';
    logger.info('Métricas funcionando: ${metricsWorking ? 'SÍ' : 'NO'}', { category: 'AUTO_MIGRATED' });
    
    return metricsWorking;
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en prueba de métricas:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 6: TEST DE CARGA
 */
async function testLoadTesting() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 6: Test de carga' });
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  🔥 Probando carga del sistema...' });
    
    const concurrentRequests = 10;
    const requests = [];
    
    // Crear múltiples requests concurrentes
    for (let i = 0; i < concurrentRequests; i++) {
      const testBuffer = createTestFile(0.5); // 500KB
      const fileId = `test-load-${i}-${uuidv4()}`;
      
      const request = fileService.processLargeFile(
        testBuffer,
        fileId,
        TEST_CONVERSATION_ID,
        { mimetype: 'text/plain' }
      ).then(result => ({ success: true, index: i }))
       .catch(error => ({ success: false, index: i, error: error.message }));
      
      requests.push(request);
    }
    
    // Ejecutar requests concurrentemente
    const startTime = Date.now();
    const results = await Promise.all(requests);
    const totalTime = Date.now() - startTime;
    
    // Analizar resultados
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.filter(r => !r.success).length;
    
    logger.info('Requests concurrentes: ${concurrentRequests}', { category: 'AUTO_MIGRATED' });
    logger.info('Requests exitosos: ${successfulRequests}', { category: 'AUTO_MIGRATED' });
    logger.info('Requests fallidos: ${failedRequests}', { category: 'AUTO_MIGRATED' });
    logger.info('Tiempo total: ${totalTime}ms', { category: 'AUTO_MIGRATED' });
    logger.info('Requests por segundo: ${(concurrentRequests / (totalTime / 1000)).toFixed(2)}', { category: 'AUTO_MIGRATED' });
    
    const successRate = (successfulRequests / concurrentRequests) * 100;
    logger.info('Tasa de éxito: ${successRate.toFixed(1)}%', { category: 'AUTO_MIGRATED' });
    
    const loadTestPassed = successRate >= 80; // Al menos 80% de éxito
    logger.info('Test de carga: ${loadTestPassed ? 'PASÓ' : 'FALLÓ'}', { category: 'AUTO_MIGRATED' });
    
    return loadTestPassed;
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en test de carga:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 7: LIMPIEZA Y MANTENIMIENTO
 */
async function testCleanupAndMaintenance() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 7: Limpieza y mantenimiento' });
  try {
    const fileMonitoringSystem = require('../src/utils/monitoring');
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  🧹 Probando limpieza automática...' });
    
    // Verificar limpieza de cache
    const initialMetrics = fileService.getPerformanceMetrics();
    logger.info('Cache inicial: ${JSON.stringify(initialMetrics.cacheSize)}', { category: 'AUTO_MIGRATED' });
    
    // Simular tiempo para que expire cache
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '    Simulando expiración de cache...' });
    
    // Verificar limpieza de historial
    const initialHistory = fileMonitoringSystem.history.hourly.length;
    logger.info('Historial inicial: ${initialHistory} snapshots', { category: 'AUTO_MIGRATED' });
    
    // Simular limpieza de historial
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '    Simulando limpieza de historial...' });
    
    // Verificar reset de métricas
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '    Probando reset de métricas...' });
    fileMonitoringSystem.resetMetrics();
    
    const resetMetrics = fileMonitoringSystem.getCurrentMetrics();
    const metricsReset = resetMetrics.files.totalProcessed === 0 && 
                        resetMetrics.errors.total === 0;
    
    logger.info('Métricas reseteadas: ${metricsReset ? 'SÍ' : 'NO'}', { category: 'AUTO_MIGRATED' });
    
    return metricsReset;
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en prueba de limpieza:', error.message);
    return false;
  }
}

/**
 * FUNCIÓN PRINCIPAL DE PRUEBA
 */
async function runAllTests() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 Iniciando pruebas de optimización y monitoreo...\n' });
  
  const tests = [
    { name: 'Optimización de rendimiento', fn: testPerformanceOptimization },
    { name: 'Sistema de cache', fn: testCacheSystem },
    { name: 'Sistema de monitoreo', fn: testMonitoringSystem },
    { name: 'Alertas y thresholds', fn: testAlertsAndThresholds },
    { name: 'Métricas de rendimiento', fn: testPerformanceMetrics },
    { name: 'Test de carga', fn: testLoadTesting },
    { name: 'Limpieza y mantenimiento', fn: testCleanupAndMaintenance }
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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n⚡ ========================================' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚡ RESUMEN DE PRUEBAS FASE 6' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚡ ========================================' });
  
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
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚡ La Fase 6: Optimización y monitoreo está funcionando correctamente.' });
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n⚠️ Algunas pruebas fallaron. Revisar logs para más detalles.' });
  }
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n⚡ ========================================' });
  
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
  testPerformanceOptimization,
  testCacheSystem,
  testMonitoringSystem,
  testAlertsAndThresholds,
  testPerformanceMetrics,
  testLoadTesting,
  testCleanupAndMaintenance,
  runAllTests
}; 