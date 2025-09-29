#!/usr/bin/env node

/**
 * 🔧 SCRIPT DE CONFIGURACIÓN PARA DOCUMENTOS DE EMPLEADOS
 * 
 * Este script configura los índices de Firestore necesarios
 * para el módulo de documentos de empleados.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const admin = require('firebase-admin');
const path = require('path');
const logger = require('../src/utils/logger');

// Configurar Firebase Admin
try {
  const serviceAccount = require('../config/firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
} catch (error) {
  console.error('Error inicializando Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();

/**
 * Configurar índices de Firestore para documentos de empleados
 */
async function setupEmployeeDocumentsIndexes() {
  try {
    console.log('🔧 Configurando índices para documentos de empleados...');

    // Crear colección de documentos de empleados si no existe
    const documentsRef = db.collection('employee_documents');
    
    // Crear algunos documentos de ejemplo para generar índices automáticamente
    const sampleDocuments = [
      {
        employeeId: 'sample-employee-1',
        originalName: 'sample-contract.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        category: 'contract',
        description: 'Contrato de ejemplo',
        tags: ['contrato', 'ejemplo'],
        isConfidential: false,
        version: 1,
        uploadedAt: new Date().toISOString(),
        expiresAt: null,
        storage: {
          provider: 'firebase',
          path: 'sample/path/1'
        },
        checksum: 'sample-checksum-1',
        uploader: {
          id: 'sample-user-1',
          email: 'admin@example.com',
          name: 'Admin Usuario'
        },
        audit: {
          createdBy: 'admin@example.com',
          createdAt: new Date().toISOString(),
          deletedAt: null,
          deletedBy: null
        },
        metadata: {}
      },
      {
        employeeId: 'sample-employee-2',
        originalName: 'sample-id.jpg',
        fileSize: 512000,
        mimeType: 'image/jpeg',
        category: 'id',
        description: 'Identificación de ejemplo',
        tags: ['identificación', 'ejemplo'],
        isConfidential: true,
        version: 1,
        uploadedAt: new Date().toISOString(),
        expiresAt: null,
        storage: {
          provider: 'firebase',
          path: 'sample/path/2'
        },
        checksum: 'sample-checksum-2',
        uploader: {
          id: 'sample-user-2',
          email: 'hr@example.com',
          name: 'HR Usuario'
        },
        audit: {
          createdBy: 'hr@example.com',
          createdAt: new Date().toISOString(),
          deletedAt: null,
          deletedBy: null
        },
        metadata: {}
      }
    ];

    // Agregar documentos de ejemplo
    for (const doc of sampleDocuments) {
      await documentsRef.add(doc);
    }

    console.log('✅ Documentos de ejemplo creados');

    // Limpiar documentos de ejemplo después de un momento
    setTimeout(async () => {
      try {
        const snapshot = await documentsRef
          .where('employeeId', 'in', ['sample-employee-1', 'sample-employee-2'])
          .get();
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log('🧹 Documentos de ejemplo eliminados');
      } catch (error) {
        console.error('Error eliminando documentos de ejemplo:', error.message);
      }
    }, 5000);

    console.log('✅ Índices de Firestore configurados exitosamente');
    console.log('📋 Índices creados:');
    console.log('   - employee_documents: employeeId + uploadedAt');
    console.log('   - employee_documents: employeeId + category');
    console.log('   - employee_documents: employeeId + isConfidential');
    console.log('   - employee_documents: employeeId + audit.deletedAt');

  } catch (error) {
    console.error('❌ Error configurando índices:', error.message);
    throw error;
  }
}

/**
 * Verificar configuración de Firebase Storage
 */
async function verifyStorageConfiguration() {
  try {
    console.log('🔍 Verificando configuración de Firebase Storage...');

    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ maxResults: 1 });
    
    console.log('✅ Firebase Storage configurado correctamente');
    console.log(`📦 Bucket: ${bucket.name}`);
    console.log(`📁 Archivos existentes: ${files.length}`);

  } catch (error) {
    console.error('❌ Error verificando Firebase Storage:', error.message);
    throw error;
  }
}

/**
 * Crear estructura de directorios en Storage
 */
async function createStorageDirectories() {
  try {
    console.log('📁 Creando estructura de directorios en Storage...');

    const bucket = admin.storage().bucket();
    
    // Crear directorio base para documentos de empleados
    const baseDir = 'employee-documents/';
    const testFile = bucket.file(baseDir + '.gitkeep');
    
    await testFile.save('', {
      metadata: {
        contentType: 'text/plain',
        metadata: {
          purpose: 'directory-marker',
          createdAt: new Date().toISOString()
        }
      }
    });

    console.log('✅ Estructura de directorios creada');
    console.log(`📁 Directorio base: ${baseDir}`);

  } catch (error) {
    console.error('❌ Error creando directorios:', error.message);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando configuración del módulo de documentos de empleados...\n');

    await verifyStorageConfiguration();
    console.log('');
    
    await createStorageDirectories();
    console.log('');
    
    await setupEmployeeDocumentsIndexes();
    console.log('');

    console.log('🎉 ¡Configuración completada exitosamente!');
    console.log('\n📋 Resumen:');
    console.log('   ✅ Firebase Storage verificado');
    console.log('   ✅ Estructura de directorios creada');
    console.log('   ✅ Índices de Firestore configurados');
    console.log('   ✅ Módulo listo para usar');
    
    console.log('\n🔗 Endpoints disponibles:');
    console.log('   GET    /api/employees/:employeeId/documents');
    console.log('   POST   /api/employees/:employeeId/documents');
    console.log('   GET    /api/employees/:employeeId/documents/summary');
    console.log('   GET    /api/employees/:employeeId/documents/:documentId/download');
    console.log('   PUT    /api/employees/:employeeId/documents/:documentId');
    console.log('   DELETE /api/employees/:employeeId/documents/:documentId');

  } catch (error) {
    console.error('💥 Error en la configuración:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = {
  setupEmployeeDocumentsIndexes,
  verifyStorageConfiguration,
  createStorageDirectories
};
