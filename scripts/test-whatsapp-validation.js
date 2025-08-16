#!/usr/bin/env node

/**
 * 📱 SCRIPT DE PRUEBA: FASE 4 - VALIDACIÓN WHATSAPP
 * 
 * Este script valida todas las funcionalidades de validación WhatsApp:
 * - Validación de límites por tipo de archivo
 * - Conversión automática para WhatsApp
 * - Soporte para stickers de WhatsApp
 * - Manejo de formatos compatibles
 * 
 * USO: node scripts/test-whatsapp-validation.js
 */

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Configurar logger
const logger = require('../src/utils/logger');

console.log('📱 ========================================');
console.log('📱 PRUEBA FASE 4: VALIDACIÓN WHATSAPP');
console.log('📱 ========================================\n');

// Variables de prueba
const TEST_CONVERSATION_ID = 'test-whatsapp-conversation-' + Date.now();
const TEST_USER_EMAIL = 'test-whatsapp@example.com';

// Crear archivos de prueba
function createTestFile(type, size = 1024 * 1024) {
  const buffer = Buffer.alloc(size);
  
  // Llenar con datos aleatorios
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  
  const testFiles = {
    image: {
      buffer,
      mimetype: 'image/jpeg',
      originalName: 'test-image.jpg',
      size: buffer.length
    },
    video: {
      buffer,
      mimetype: 'video/mp4',
      originalName: 'test-video.mp4',
      size: buffer.length
    },
    audio: {
      buffer,
      mimetype: 'audio/mpeg',
      originalName: 'test-audio.mp3',
      size: buffer.length
    },
    document: {
      buffer,
      mimetype: 'application/pdf',
      originalName: 'test-document.pdf',
      size: buffer.length
    },
    sticker: {
      buffer: Buffer.alloc(50 * 1024), // 50KB
      mimetype: 'image/webp',
      originalName: 'test-sticker.webp',
      size: 50 * 1024
    }
  };
  
  return testFiles[type] || testFiles.document;
}

/**
 * 🧪 PRUEBA 1: VALIDACIÓN DE LÍMITES WHATSAPP
 */
async function testWhatsAppLimits() {
  console.log('🧪 PRUEBA 1: Validación de límites WhatsApp');
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // Probar diferentes tipos de archivos
    const testCases = [
      {
        name: 'Imagen pequeña (válida)',
        file: createTestFile('image', 2 * 1024 * 1024), // 2MB
        expectedValid: true
      },
      {
        name: 'Imagen grande (inválida)',
        file: createTestFile('image', 10 * 1024 * 1024), // 10MB
        expectedValid: false
      },
      {
        name: 'Video válido',
        file: createTestFile('video', 15 * 1024 * 1024), // 15MB
        expectedValid: true
      },
      {
        name: 'Video muy grande (inválido)',
        file: createTestFile('video', 20 * 1024 * 1024), // 20MB
        expectedValid: false
      },
      {
        name: 'Audio válido',
        file: createTestFile('audio', 10 * 1024 * 1024), // 10MB
        expectedValid: true
      },
      {
        name: 'Documento válido',
        file: createTestFile('document', 50 * 1024 * 1024), // 50MB
        expectedValid: true
      },
      {
        name: 'Sticker válido',
        file: createTestFile('sticker'),
        expectedValid: true
      },
      {
        name: 'Formato no soportado',
        file: {
          buffer: Buffer.alloc(1024),
          mimetype: 'application/unknown',
          originalName: 'test.unknown',
          size: 1024
        },
        expectedValid: false
      }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (const testCase of testCases) {
      console.log(`\n  📋 Probando: ${testCase.name}`);
      
      const validation = fileService.validateWhatsAppCompatibility(testCase.file);
      
      console.log(`    Categoría: ${validation.category}`);
      console.log(`    Válido: ${validation.isValid}`);
      console.log(`    Mensaje: ${validation.message}`);
      
      if (validation.isValid === testCase.expectedValid) {
        console.log(`    ✅ PASÓ`);
        passedTests++;
      } else {
        console.log(`    ❌ FALLÓ - Esperado: ${testCase.expectedValid}, Obtenido: ${validation.isValid}`);
      }
    }
    
    console.log(`\n📊 Resultados: ${passedTests}/${totalTests} pruebas pasaron`);
    return passedTests === totalTests;
    
  } catch (error) {
    console.error('❌ Error en prueba de límites:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 2: CONVERSIÓN AUTOMÁTICA PARA WHATSAPP
 */
async function testWhatsAppConversion() {
  console.log('\n🧪 PRUEBA 2: Conversión automática para WhatsApp');
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // Probar conversiones de diferentes tipos
    const testCases = [
      {
        name: 'Imagen PNG a JPEG',
        file: {
          buffer: Buffer.alloc(3 * 1024 * 1024), // 3MB
          mimetype: 'image/png',
          originalName: 'test-image.png',
          size: 3 * 1024 * 1024
        },
        expectedConversion: true
      },
      {
        name: 'Video AVI a MP4',
        file: {
          buffer: Buffer.alloc(8 * 1024 * 1024), // 8MB
          mimetype: 'video/avi',
          originalName: 'test-video.avi',
          size: 8 * 1024 * 1024
        },
        expectedConversion: true
      },
      {
        name: 'Audio WAV a MP3',
        file: {
          buffer: Buffer.alloc(5 * 1024 * 1024), // 5MB
          mimetype: 'audio/wav',
          originalName: 'test-audio.wav',
          size: 5 * 1024 * 1024
        },
        expectedConversion: true
      },
      {
        name: 'Archivo ya compatible',
        file: {
          buffer: Buffer.alloc(1 * 1024 * 1024), // 1MB
          mimetype: 'image/jpeg',
          originalName: 'test-image.jpg',
          size: 1 * 1024 * 1024
        },
        expectedConversion: false // No necesita conversión
      }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (const testCase of testCases) {
      console.log(`\n  📋 Probando: ${testCase.name}`);
      
      const conversion = await fileService.convertForWhatsApp(testCase.file);
      
      console.log(`    Éxito: ${conversion.success}`);
      console.log(`    Conversión aplicada: ${conversion.conversionApplied}`);
      console.log(`    Mensaje: ${conversion.message}`);
      
      if (conversion.conversionApplied === testCase.expectedConversion) {
        console.log(`    ✅ PASÓ`);
        passedTests++;
      } else {
        console.log(`    ❌ FALLÓ - Esperado: ${testCase.expectedConversion}, Obtenido: ${conversion.conversionApplied}`);
      }
    }
    
    console.log(`\n📊 Resultados: ${passedTests}/${totalTests} pruebas pasaron`);
    return passedTests === totalTests;
    
  } catch (error) {
    console.error('❌ Error en prueba de conversión:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 3: SOPORTE PARA STICKERS
 */
async function testStickerSupport() {
  console.log('\n🧪 PRUEBA 3: Soporte para stickers de WhatsApp');
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // Probar diferentes tipos de stickers
    const testCases = [
      {
        name: 'Sticker WebP válido',
        file: {
          buffer: Buffer.alloc(50 * 1024), // 50KB
          mimetype: 'image/webp',
          originalName: 'test-sticker.webp',
          size: 50 * 1024
        },
        expectedValid: true
      },
      {
        name: 'Sticker PNG válido',
        file: {
          buffer: Buffer.alloc(80 * 1024), // 80KB
          mimetype: 'image/png',
          originalName: 'test-sticker.png',
          size: 80 * 1024
        },
        expectedValid: true
      },
      {
        name: 'Sticker muy grande (inválido)',
        file: {
          buffer: Buffer.alloc(200 * 1024), // 200KB
          mimetype: 'image/webp',
          originalName: 'large-sticker.webp',
          size: 200 * 1024
        },
        expectedValid: false
      },
      {
        name: 'Formato de sticker no soportado',
        file: {
          buffer: Buffer.alloc(50 * 1024), // 50KB
          mimetype: 'image/jpeg',
          originalName: 'test-sticker.jpg',
          size: 50 * 1024
        },
        expectedValid: false
      }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (const testCase of testCases) {
      console.log(`\n  📋 Probando: ${testCase.name}`);
      
      // Validar sticker
      const validation = fileService.validateStickerForWhatsApp(testCase.file.buffer, testCase.file.mimetype);
      
      console.log(`    Válido: ${validation.isValid}`);
      console.log(`    Mensaje: ${validation.message}`);
      console.log(`    Tamaño actual: ${validation.currentSize?.toFixed(1)}KB`);
      
      if (validation.isValid === testCase.expectedValid) {
        console.log(`    ✅ PASÓ`);
        passedTests++;
      } else {
        console.log(`    ❌ FALLÓ - Esperado: ${testCase.expectedValid}, Obtenido: ${validation.isValid}`);
      }
    }
    
    // Probar procesamiento completo de stickers
    console.log('\n  🎭 Probando procesamiento completo de stickers...');
    
    const largeSticker = {
      buffer: Buffer.alloc(150 * 1024), // 150KB (muy grande)
      mimetype: 'image/png',
      originalName: 'large-sticker.png',
      size: 150 * 1024
    };
    
    const processing = await fileService.processStickerForWhatsApp(
      largeSticker.buffer,
      largeSticker.mimetype,
      largeSticker.originalName
    );
    
    console.log(`    Procesamiento exitoso: ${processing.success}`);
    console.log(`    Conversión aplicada: ${processing.conversionApplied}`);
    console.log(`    Mensaje: ${processing.message}`);
    
    if (processing.success) {
      console.log(`    ✅ Procesamiento de sticker PASÓ`);
      passedTests++;
    } else {
      console.log(`    ❌ Procesamiento de sticker FALLÓ`);
    }
    
    totalTests++;
    
    console.log(`\n📊 Resultados: ${passedTests}/${totalTests} pruebas pasaron`);
    return passedTests === totalTests;
    
  } catch (error) {
    console.error('❌ Error en prueba de stickers:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 4: INTEGRACIÓN COMPLETA WHATSAPP
 */
async function testCompleteWhatsAppIntegration() {
  console.log('\n🧪 PRUEBA 4: Integración completa WhatsApp');
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    // Simular flujo completo de validación y conversión
    const testFiles = [
      {
        name: 'Imagen grande que necesita conversión',
        file: createTestFile('image', 8 * 1024 * 1024), // 8MB
        shouldConvert: true
      },
      {
        name: 'Video que necesita conversión',
        file: createTestFile('video', 20 * 1024 * 1024), // 20MB
        shouldConvert: true
      },
      {
        name: 'Sticker que necesita optimización',
        file: {
          buffer: Buffer.alloc(150 * 1024), // 150KB
          mimetype: 'image/png',
          originalName: 'large-sticker.png',
          size: 150 * 1024
        },
        shouldConvert: true
      },
      {
        name: 'Archivo ya compatible',
        file: createTestFile('audio', 5 * 1024 * 1024), // 5MB
        shouldConvert: false
      }
    ];
    
    let passedTests = 0;
    let totalTests = testFiles.length;
    
    for (const testFile of testFiles) {
      console.log(`\n  📋 Procesando: ${testFile.name}`);
      
      // Paso 1: Validar compatibilidad
      const validation = fileService.validateWhatsAppCompatibility(testFile.file);
      console.log(`    Validación inicial: ${validation.isValid ? '✅ Válido' : '❌ Inválido'}`);
      
      // Paso 2: Intentar conversión si es necesario
      let conversion = null;
      if (!validation.isValid || testFile.shouldConvert) {
        console.log(`    🔄 Intentando conversión...`);
        conversion = await fileService.convertForWhatsApp(testFile.file);
        console.log(`    Conversión: ${conversion.success ? '✅ Exitosa' : '❌ Fallida'}`);
        
        if (conversion.success) {
          // Paso 3: Validar archivo convertido
          const convertedValidation = fileService.validateWhatsAppCompatibility(conversion.convertedFile);
          console.log(`    Validación final: ${convertedValidation.isValid ? '✅ Válido' : '❌ Inválido'}`);
          
          if (convertedValidation.isValid) {
            console.log(`    ✅ FLUJO COMPLETO EXITOSO`);
            passedTests++;
          } else {
            console.log(`    ❌ Archivo convertido aún no es válido`);
          }
        } else {
          console.log(`    ❌ Conversión falló: ${conversion.message}`);
        }
      } else {
        console.log(`    ✅ Archivo ya compatible, no necesita conversión`);
        passedTests++;
      }
    }
    
    console.log(`\n📊 Resultados: ${passedTests}/${totalTests} pruebas pasaron`);
    return passedTests === totalTests;
    
  } catch (error) {
    console.error('❌ Error en integración completa:', error.message);
    return false;
  }
}

/**
 * 🧪 PRUEBA 5: MANEJO DE ERRORES Y CASOS LÍMITE
 */
async function testErrorHandlingAndEdgeCases() {
  console.log('\n🧪 PRUEBA 5: Manejo de errores y casos límite');
  try {
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    const edgeCases = [
      {
        name: 'Archivo sin mimetype',
        file: {
          buffer: Buffer.alloc(1024),
          mimetype: null,
          originalName: 'test.file',
          size: 1024
        }
      },
      {
        name: 'Archivo sin tamaño',
        file: {
          buffer: Buffer.alloc(1024),
          mimetype: 'image/jpeg',
          originalName: 'test.jpg',
          size: null
        }
      },
      {
        name: 'Archivo con mimetype inválido',
        file: {
          buffer: Buffer.alloc(1024),
          mimetype: 'invalid/mime',
          originalName: 'test.invalid',
          size: 1024
        }
      },
      {
        name: 'Archivo extremadamente grande',
        file: {
          buffer: Buffer.alloc(200 * 1024 * 1024), // 200MB
          mimetype: 'video/mp4',
          originalName: 'huge-video.mp4',
          size: 200 * 1024 * 1024
        }
      }
    ];
    
    let passedTests = 0;
    let totalTests = edgeCases.length;
    
    for (const edgeCase of edgeCases) {
      console.log(`\n  📋 Probando: ${edgeCase.name}`);
      
      try {
        const validation = fileService.validateWhatsAppCompatibility(edgeCase.file);
        console.log(`    Validación: ${validation.isValid ? '✅ Válido' : '❌ Inválido'}`);
        console.log(`    Mensaje: ${validation.message}`);
        
        // Los casos límite deberían ser inválidos
        if (!validation.isValid) {
          console.log(`    ✅ MANEJO CORRECTO`);
          passedTests++;
        } else {
          console.log(`    ❌ Debería ser inválido`);
        }
        
      } catch (error) {
        console.log(`    ✅ Error manejado correctamente: ${error.message}`);
        passedTests++;
      }
    }
    
    console.log(`\n📊 Resultados: ${passedTests}/${totalTests} pruebas pasaron`);
    return passedTests === totalTests;
    
  } catch (error) {
    console.error('❌ Error en manejo de errores:', error.message);
    return false;
  }
}

/**
 * FUNCIÓN PRINCIPAL DE PRUEBA
 */
async function runAllTests() {
  console.log('🚀 Iniciando pruebas de validación WhatsApp...\n');
  
  const tests = [
    { name: 'Validación de límites WhatsApp', fn: testWhatsAppLimits },
    { name: 'Conversión automática para WhatsApp', fn: testWhatsAppConversion },
    { name: 'Soporte para stickers', fn: testStickerSupport },
    { name: 'Integración completa WhatsApp', fn: testCompleteWhatsAppIntegration },
    { name: 'Manejo de errores y casos límite', fn: testErrorHandlingAndEdgeCases }
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
  console.log('\n📱 ========================================');
  console.log('📱 RESUMEN DE PRUEBAS FASE 4');
  console.log('📱 ========================================');
  
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
    console.log('📱 La Fase 4: Validación WhatsApp está funcionando correctamente.');
  } else {
    console.log('\n⚠️ Algunas pruebas fallaron. Revisar logs para más detalles.');
  }
  
  console.log('\n📱 ========================================');
  
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
  testWhatsAppLimits,
  testWhatsAppConversion,
  testStickerSupport,
  testCompleteWhatsAppIntegration,
  testErrorHandlingAndEdgeCases,
  runAllTests
}; 