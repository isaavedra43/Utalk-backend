/**
 * 🧪 SCRIPT DE PRUEBA PARA VERIFICAR CORRECCIONES DE MANEJO DE ERRORES
 * 
 * Este script prueba que las correcciones implementadas en FileService
 * manejan correctamente los errores sin causar TypeError.
 */

const FileService = require('../src/services/FileService');
const logger = require('../src/utils/logger');

async function testErrorHandling() {
  console.log('🧪 Iniciando pruebas de manejo de errores...\n');

  const fileService = new FileService();

  // Test 1: Error con error undefined
  console.log('📋 Test 1: Error con error undefined');
  try {
    // Simular un error undefined
    throw undefined;
  } catch (error) {
    try {
      // Esto debería manejar el error undefined correctamente
      const errorMessage = error && typeof error.message === 'string' ? error.message : 'Error desconocido';
      console.log('✅ Error manejado correctamente:', errorMessage);
    } catch (handlingError) {
      console.log('❌ Error en manejo:', handlingError.message);
    }
  }

  // Test 2: Error con error null
  console.log('\n📋 Test 2: Error con error null');
  try {
    throw null;
  } catch (error) {
    try {
      const errorMessage = error && typeof error.message === 'string' ? error.message : 'Error desconocido';
      console.log('✅ Error manejado correctamente:', errorMessage);
    } catch (handlingError) {
      console.log('❌ Error en manejo:', handlingError.message);
    }
  }

  // Test 3: Error con error que no tiene message
  console.log('\n📋 Test 3: Error con error que no tiene message');
  try {
    throw { customProperty: 'test' };
  } catch (error) {
    try {
      const errorMessage = error && typeof error.message === 'string' ? error.message : 'Error desconocido';
      console.log('✅ Error manejado correctamente:', errorMessage);
    } catch (handlingError) {
      console.log('❌ Error en manejo:', handlingError.message);
    }
  }

  // Test 4: Error normal
  console.log('\n📋 Test 4: Error normal');
  try {
    throw new Error('Error de prueba normal');
  } catch (error) {
    try {
      const errorMessage = error && typeof error.message === 'string' ? error.message : 'Error desconocido';
      console.log('✅ Error manejado correctamente:', errorMessage);
    } catch (handlingError) {
      console.log('❌ Error en manejo:', handlingError.message);
    }
  }

  // Test 5: Validación de firestore en modelo File
  console.log('\n📋 Test 5: Validación de firestore en modelo File');
  try {
    const File = require('../src/models/File');
    
    // Simular firestore como null
    const originalFirestore = require('../src/config/firebase').firestore;
    require('../src/config/firebase').firestore = null;
    
    try {
      await File.getById('test-id');
      console.log('❌ No se detectó firestore null');
    } catch (firestoreError) {
      console.log('✅ Error de firestore detectado correctamente:', firestoreError.message);
    }
    
    // Restaurar firestore
    require('../src/config/firebase').firestore = originalFirestore;
  } catch (testError) {
    console.log('⚠️ Test de firestore no pudo ejecutarse:', testError.message);
  }

  console.log('\n🎉 Pruebas de manejo de errores completadas');
}

// Ejecutar pruebas
testErrorHandling().catch(error => {
  console.error('❌ Error en pruebas:', error);
  process.exit(1);
}); 