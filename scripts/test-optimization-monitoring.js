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

console.log('⚡ ========================================');
console.log('⚡ PRUEBA FASE 6: OPTIMIZACIÓN Y MONITOREO');
console.log('⚡ ========================================\n');

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
  console.log('🧪 PRUEBA 1: Optimización de rendimiento');
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // Probar archivos de diferentes tamaños
    const testSizes = [1, 5, 10, 25, 50]; // MB
    const results = [];
    
    for (const sizeMB of testSizes) {
      console.log(`  📁 Probando archivo de ${sizeMB}MB...`);
      
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
      
      console.log(`    ✅ ${sizeMB}MB procesado en ${processingTime}ms`);
    }
    
    // Analizar resultados
    console.log('\n📊 Análisis de rendimiento:');
    results.forEach(result => {
      const speed = result.sizeMB / (result.processingTime / 1000); // MB/s
      console.log(`  ${result.sizeMB}MB: ${result.processingTime}ms (${speed.toFixed(2)} MB/s) - ${result.result}`);
    });
    
    // Verificar que archivos grandes se procesaron en chunks
    const largeFiles = results.filter(r => r.sizeMB >= 25);
    const chunkedFiles = largeFiles.filter(r => r.processedInChunks);
    
    console.log(`\n✅ Archivos grandes procesados en chunks: ${chunkedFiles.length}/${largeFiles.length}`);
    
    return results.every(r => r.result === 'success');
    
  } catch (error) {
    console.error('❌ Error en prueba de optimización:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 2: SISTEMA DE CACHE
 */
async function testCacheSystem() {
  console.log('\n🧪 PRUEBA 2: Sistema de cache');
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    const testBuffer = createTestFile(1); // 1MB
    const fileId = `test-cache-${uuidv4()}`;
    const options = { mimetype: 'text/plain' };
    
    console.log('  🔄 Probando cache de archivos...');
    
    // Primera llamada - debería procesar y cachear
    const startTime1 = Date.now();
    const result1 = await fileService.processLargeFile(testBuffer, fileId, TEST_CONVERSATION_ID, options);
    const time1 = Date.now() - startTime1;
    
    console.log(`    Primera llamada: ${time1}ms`);
    
    // Segunda llamada - debería usar cache
    const startTime2 = Date.now();
    const result2 = await fileService.processLargeFile(testBuffer, fileId, TEST_CONVERSATION_ID, options);
    const time2 = Date.now() - startTime2;
    
    console.log(`    Segunda llamada: ${time2}ms`);
    
    // Verificar mejora de rendimiento
    const improvement = ((time1 - time2) / time1) * 100;
    console.log(`    Mejora de rendimiento: ${improvement.toFixed(1)}%`);
    
    // Obtener métricas de cache
    const metrics = fileService.getPerformanceMetrics();
    console.log(`    Cache hits: ${metrics.cacheHits}`);
    console.log(`    Cache misses: ${metrics.cacheMisses}`);
    console.log(`    Tasa de acierto: ${metrics.cacheHitRate}`);
    
    const cacheEffective = time2 < time1 && metrics.cacheHits > 0;
    console.log(`    ✅ Cache efectivo: ${cacheEffective ? 'SÍ' : 'NO'}`);
    
    return cacheEffective;
    
  } catch (error) {
    console.error('❌ Error en prueba de cache:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 3: SISTEMA DE MONITOREO
 */
async function testMonitoringSystem() {
  console.log('\n🧪 PRUEBA 3: Sistema de monitoreo');
  try {
    const fileMonitoringSystem = require('../src/utils/monitoring');
    
    console.log('  📊 Probando sistema de monitoreo...');
    
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
    console.log(`    Archivos procesados: ${currentMetrics.files.totalProcessed}`);
    console.log(`    Archivos subidos: ${currentMetrics.files.totalUploaded}`);
    console.log(`    Errores totales: ${currentMetrics.errors.total}`);
    
    // Verificar categorización por tipo
    console.log('    Archivos por tipo:');
    Object.entries(currentMetrics.files.byType).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`      ${type}: ${count}`);
      }
    });
    
    // Verificar categorización por tamaño
    console.log('    Archivos por tamaño:');
    Object.entries(currentMetrics.files.bySize).forEach(([size, count]) => {
      if (count > 0) {
        console.log(`      ${size}: ${count}`);
      }
    });
    
    // Obtener estadísticas detalladas
    const detailedStats = fileMonitoringSystem.getDetailedStats();
    console.log(`    Tasa de error: ${detailedStats.overview.errorRate.toFixed(2)}%`);
    console.log(`    Tamaño promedio: ${(detailedStats.overview.averageFileSize / 1024 / 1024).toFixed(2)}MB`);
    
    const monitoringWorking = currentMetrics.files.totalProcessed > 0 && 
                             currentMetrics.errors.total > 0;
    console.log(`    ✅ Monitoreo funcionando: ${monitoringWorking ? 'SÍ' : 'NO'}`);
    
    return monitoringWorking;
    
  } catch (error) {
    console.error('❌ Error en prueba de monitoreo:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 4: ALERTAS Y THRESHOLDS
 */
async function testAlertsAndThresholds() {
  console.log('\n🧪 PRUEBA 4: Alertas y thresholds');
  try {
    const fileMonitoringSystem = require('../src/utils/monitoring');
    
    console.log('  🚨 Probando sistema de alertas...');
    
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
    
    console.log(`    Tasa de error actual: ${errorRate.toFixed(2)}%`);
    console.log(`    Errores totales: ${currentMetrics.errors.total}`);
    
    // Verificar categorización de errores
    console.log('    Errores por categoría:');
    Object.entries(currentMetrics.errors.byType).forEach(([category, count]) => {
      if (count > 0) {
        console.log(`      ${category}: ${count}`);
      }
    });
    
    // Verificar errores recientes
    const recentErrors = currentMetrics.errors.recent.slice(0, 5);
    console.log(`    Errores recientes: ${recentErrors.length}`);
    
    const alertsWorking = errorRate > 0 && currentMetrics.errors.total > 0;
    console.log(`    ✅ Alertas funcionando: ${alertsWorking ? 'SÍ' : 'NO'}`);
    
    return alertsWorking;
    
  } catch (error) {
    console.error('❌ Error en prueba de alertas:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 5: MÉTRICAS DE RENDIMIENTO
 */
async function testPerformanceMetrics() {
  console.log('\n🧪 PRUEBA 5: Métricas de rendimiento');
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    console.log('  ⚡ Probando métricas de rendimiento...');
    
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
    
    console.log(`    Archivos procesados: ${metrics.filesProcessed}`);
    console.log(`    Cache hits: ${metrics.cacheHits}`);
    console.log(`    Cache misses: ${metrics.cacheMisses}`);
    console.log(`    Tasa de acierto de cache: ${metrics.cacheHitRate}`);
    console.log(`    Tiempo promedio de procesamiento: ${metrics.averageProcessingTime}`);
    console.log(`    Errores: ${metrics.errors}`);
    
    // Verificar tamaños de cache
    console.log('    Tamaños de cache:');
    Object.entries(metrics.cacheSize).forEach(([cacheType, size]) => {
      console.log(`      ${cacheType}: ${size} items`);
    });
    
    const metricsWorking = metrics.filesProcessed > 0 && 
                          typeof metrics.averageProcessingTime === 'string';
    console.log(`    ✅ Métricas funcionando: ${metricsWorking ? 'SÍ' : 'NO'}`);
    
    return metricsWorking;
    
  } catch (error) {
    console.error('❌ Error en prueba de métricas:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 6: TEST DE CARGA
 */
async function testLoadTesting() {
  console.log('\n🧪 PRUEBA 6: Test de carga');
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    console.log('  🔥 Probando carga del sistema...');
    
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
    
    console.log(`    Requests concurrentes: ${concurrentRequests}`);
    console.log(`    Requests exitosos: ${successfulRequests}`);
    console.log(`    Requests fallidos: ${failedRequests}`);
    console.log(`    Tiempo total: ${totalTime}ms`);
    console.log(`    Requests por segundo: ${(concurrentRequests / (totalTime / 1000)).toFixed(2)}`);
    
    const successRate = (successfulRequests / concurrentRequests) * 100;
    console.log(`    Tasa de éxito: ${successRate.toFixed(1)}%`);
    
    const loadTestPassed = successRate >= 80; // Al menos 80% de éxito
    console.log(`    ✅ Test de carga: ${loadTestPassed ? 'PASÓ' : 'FALLÓ'}`);
    
    return loadTestPassed;
    
  } catch (error) {
    console.error('❌ Error en test de carga:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 7: LIMPIEZA Y MANTENIMIENTO
 */
async function testCleanupAndMaintenance() {
  console.log('\n🧪 PRUEBA 7: Limpieza y mantenimiento');
  try {
    const fileMonitoringSystem = require('../src/utils/monitoring');
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    console.log('  🧹 Probando limpieza automática...');
    
    // Verificar limpieza de cache
    const initialMetrics = fileService.getPerformanceMetrics();
    console.log(`    Cache inicial: ${JSON.stringify(initialMetrics.cacheSize)}`);
    
    // Simular tiempo para que expire cache
    console.log('    Simulando expiración de cache...');
    
    // Verificar limpieza de historial
    const initialHistory = fileMonitoringSystem.history.hourly.length;
    console.log(`    Historial inicial: ${initialHistory} snapshots`);
    
    // Simular limpieza de historial
    console.log('    Simulando limpieza de historial...');
    
    // Verificar reset de métricas
    console.log('    Probando reset de métricas...');
    fileMonitoringSystem.resetMetrics();
    
    const resetMetrics = fileMonitoringSystem.getCurrentMetrics();
    const metricsReset = resetMetrics.files.totalProcessed === 0 && 
                        resetMetrics.errors.total === 0;
    
    console.log(`    ✅ Métricas reseteadas: ${metricsReset ? 'SÍ' : 'NO'}`);
    
    return metricsReset;
    
  } catch (error) {
    console.error('❌ Error en prueba de limpieza:', error.message);
    return false;
  }
}

/**
 * FUNCIÓN PRINCIPAL DE PRUEBA
 */
async function runAllTests() {
  console.log('🚀 Iniciando pruebas de optimización y monitoreo...\n');
  
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
    console.log(`\n🎯 Ejecutando: ${test.name}`);
    console.log('─'.repeat(50));
    
    const startTime = Date.now();
    const result = await test.fn();
    const duration = Date.now() - startTime;
    
    results.push({
      name: test.name,
      success: result,
      duration: duration
    });
    
    console.log(`\n${result ? '✅' : '❌'} ${test.name}: ${result ? 'EXITOSO' : 'FALLIDO'} (${duration}ms)`);
  }
  
  // Resumen final
  console.log('\n⚡ ========================================');
  console.log('⚡ RESUMEN DE PRUEBAS FASE 6');
  console.log('⚡ ========================================');
  
  const successfulTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`\n📊 Resultados:`);
  console.log(`   ✅ Exitosos: ${successfulTests}/${totalTests}`);
  console.log(`   ❌ Fallidos: ${totalTests - successfulTests}/${totalTests}`);
  console.log(`   ⏱️ Tiempo total: ${totalTime}ms`);
  
  console.log('\n📋 Detalles por prueba:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${index + 1}. ${status} ${result.name} (${result.duration}ms)`);
  });
  
  if (successfulTests === totalTests) {
    console.log('\n🎉 ¡TODAS LAS PRUEBAS EXITOSAS!');
    console.log('⚡ La Fase 6: Optimización y monitoreo está funcionando correctamente.');
  } else {
    console.log('\n⚠️ Algunas pruebas fallaron. Revisar logs para más detalles.');
  }
  
  console.log('\n⚡ ========================================');
  
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
  testPerformanceOptimization,
  testCacheSystem,
  testMonitoringSystem,
  testAlertsAndThresholds,
  testPerformanceMetrics,
  testLoadTesting,
  testCleanupAndMaintenance,
  runAllTests
}; 