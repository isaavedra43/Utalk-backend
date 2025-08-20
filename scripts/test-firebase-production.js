#!/usr/bin/env node

/**
 * 🔥 SCRIPT DE PRUEBA DE FIREBASE EN PRODUCCIÓN
 * 
 * Este script verifica que Firebase esté configurado correctamente
 * y puede realizar operaciones básicas de Storage.
 */

const admin = require('firebase-admin');
const logger = require('../src/utils/logger');

async function testFirebaseProduction() {
  console.log('🔥 Iniciando prueba de Firebase en producción...\n');

  try {
    // 1. Verificar variables de entorno
    console.log('1️⃣ Verificando variables de entorno...');
    const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const hasProjectId = !!process.env.FIREBASE_PROJECT_ID;
    const nodeEnv = process.env.NODE_ENV;

    console.log(`   - NODE_ENV: ${nodeEnv}`);
    console.log(`   - FIREBASE_SERVICE_ACCOUNT_KEY: ${hasServiceAccount ? '✅ Configurada' : '❌ No configurada'}`);
    console.log(`   - FIREBASE_PROJECT_ID: ${hasProjectId ? '✅ Configurada' : '❌ No configurada'}`);

    if (!hasServiceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no está configurada');
    }

    // 2. Verificar inicialización de Firebase
    console.log('\n2️⃣ Verificando inicialización de Firebase...');
    console.log(`   - Apps inicializadas: ${admin.apps.length}`);

    if (!admin.apps.length) {
      console.log('   - Intentando inicializar Firebase...');
      
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch (parseError) {
        throw new Error(`Error parseando FIREBASE_SERVICE_ACCOUNT_KEY: ${parseError.message}`);
      }

      // Validar campos requeridos
      const requiredFields = ['project_id', 'private_key', 'client_email'];
      const missingFields = requiredFields.filter(field => !serviceAccount[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Campos faltantes en service account: ${missingFields.join(', ')}`);
      }

      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
        storageBucket: `${serviceAccount.project_id}.appspot.com`
      });

      console.log(`   - ✅ Firebase inicializado: ${app.name}`);
    } else {
      console.log('   - ✅ Firebase ya estaba inicializado');
    }

    // 3. Probar Firestore
    console.log('\n3️⃣ Probando Firestore...');
    const firestore = admin.firestore();
    
    // Test de escritura
    const testDoc = firestore.collection('_test').doc('firebase-test');
    await testDoc.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      test: true,
      environment: nodeEnv,
      message: 'Firebase test successful'
    });
    console.log('   - ✅ Escritura en Firestore exitosa');

    // Test de lectura
    const doc = await testDoc.get();
    console.log('   - ✅ Lectura de Firestore exitosa');

    // Limpiar documento de prueba
    await testDoc.delete();
    console.log('   - ✅ Limpieza de prueba exitosa');

    // 4. Probar Storage
    console.log('\n4️⃣ Probando Storage...');
    const storage = admin.storage();
    const bucket = storage.bucket();
    
    if (!bucket) {
      throw new Error('Bucket de Storage no disponible');
    }

    console.log(`   - ✅ Bucket disponible: ${bucket.name}`);

    // Test de operaciones de bucket
    const [files] = await bucket.getFiles({ maxResults: 1 });
    console.log(`   - ✅ Listado de archivos exitoso (${files.length} archivos encontrados)`);

    // 5. Probar FileService
    console.log('\n5️⃣ Probando FileService...');
    const FileService = require('../src/services/FileService');
    const fileService = new FileService();
    
    try {
      const bucket = fileService.getBucket();
      console.log('   - ✅ FileService.getBucket() exitoso');
    } catch (fileServiceError) {
      console.log(`   - ❌ FileService.getBucket() falló: ${fileServiceError.message}`);
      throw fileServiceError;
    }

    console.log('\n🎉 ¡TODAS LAS PRUEBAS EXITOSAS!');
    console.log('Firebase está configurado correctamente en producción.');
    
    return true;

  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBA DE FIREBASE:');
    console.error(`   - Mensaje: ${error.message}`);
    console.error(`   - Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}`);
    
    // Análisis del error
    console.error('\n🔍 ANÁLISIS DEL ERROR:');
    
    if (error.message.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
      console.error('   - Problema: Variable de entorno no configurada');
      console.error('   - Solución: Configurar FIREBASE_SERVICE_ACCOUNT_KEY en Railway');
    } else if (error.message.includes('JSON')) {
      console.error('   - Problema: Formato JSON inválido en service account');
      console.error('   - Solución: Verificar que el JSON esté completo y bien formateado');
    } else if (error.message.includes('Campos faltantes')) {
      console.error('   - Problema: Service account incompleto');
      console.error('   - Solución: Regenerar service account desde Firebase Console');
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      console.error('   - Problema: Error de conectividad');
      console.error('   - Solución: Verificar conectividad a Firebase desde Railway');
    } else {
      console.error('   - Problema: Error desconocido');
      console.error('   - Solución: Revisar logs completos');
    }
    
    return false;
  }
}

// Ejecutar prueba
if (require.main === module) {
  testFirebaseProduction()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error inesperado:', error);
      process.exit(1);
    });
}

module.exports = { testFirebaseProduction }; 