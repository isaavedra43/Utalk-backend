#!/usr/bin/env node

/**
 * Script para limpiar documentos de prueba de nómina general
 * Ejecutar con: node scripts/cleanup-test-documents.js
 */

const { db } = require('../src/config/firebase');
const logger = require('../src/utils/logger');

async function cleanupTestDocuments() {
  try {
    logger.info('🧹 Iniciando limpieza de documentos de prueba...');

    const testDocuments = [
      { collection: 'generalPayrolls', id: 'test-general-payroll-index' },
      { collection: 'generalPayrollEmployees', id: 'test-employee-index' },
      { collection: 'generalPayrollAdjustments', id: 'test-adjustment-index' }
    ];

    console.log('🗑️  Eliminando documentos de prueba...');

    for (const doc of testDocuments) {
      try {
        const docRef = db.collection(doc.collection).doc(doc.id);
        const docSnapshot = await docRef.get();
        
        if (docSnapshot.exists) {
          await docRef.delete();
          console.log(`✅ Eliminado: ${doc.collection}/${doc.id}`);
        } else {
          console.log(`ℹ️  No existe: ${doc.collection}/${doc.id}`);
        }
      } catch (error) {
        console.log(`❌ Error eliminando ${doc.collection}/${doc.id}:`, error.message);
      }
    }

    console.log('');
    console.log('✅ Limpieza completada');
    console.log('📋 Los índices de Firestore permanecen activos y funcionales');

  } catch (error) {
    logger.error('❌ Error en limpieza de documentos', error);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar script
if (require.main === module) {
  cleanupTestDocuments()
    .then(() => {
      console.log('');
      console.log('🎉 Script de limpieza completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error ejecutando script de limpieza:', error);
      process.exit(1);
    });
}

module.exports = { cleanupTestDocuments };



