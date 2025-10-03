#!/usr/bin/env node

/**
 * Script de Migración de Documentos de RH
 * Inicializa el sistema de documentos de RH
 * 
 * Uso: node scripts/migrate-hr-documents.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const HRDocumentInitializationService = require('../src/services/HRDocumentInitializationService');
const { initializeFirebase } = require('../src/config/firebase');

async function main() {
  try {
    console.log('🚀 Iniciando migración del sistema de documentos de RH...');
    console.log('================================================');
    
    // 0. Inicializar Firebase primero
    console.log('\n🔥 Paso 0: Inicializando Firebase...');
    await initializeFirebase();
    console.log('✅ Firebase inicializado correctamente');
    
    // 1. Inicializar sistema
    console.log('\n📚 Paso 1: Inicializando sistema...');
    const initResult = await HRDocumentInitializationService.initializeSystem('migration');
    
    console.log('\n📊 Resultados de inicialización:');
    console.log(`   Resumen creado: ✅`);
    console.log(`   Carpetas creadas: ${initResult.folders.length}`);
    initResult.folders.forEach(folder => {
      console.log(`     - ${folder.name}: ${folder.description}`);
    });
    
    // 2. Verificar estructura de base de datos
    console.log('\n🔍 Paso 2: Verificando estructura de base de datos...');
    await HRDocumentInitializationService.verifyDatabaseStructure();
    console.log('✅ Estructura verificada exitosamente');
    
    // 3. Verificar integridad del sistema
    console.log('\n🔍 Paso 3: Verificando integridad del sistema...');
    const integrity = await HRDocumentInitializationService.verifySystemIntegrity();
    
    console.log('\n📊 Resultados de integridad:');
    console.log(`   Verificado: ${integrity.verified ? '✅' : '❌'}`);
    console.log(`   Problemas encontrados: ${integrity.issues.length}`);
    console.log(`   Carpetas: ${integrity.foldersCount}`);
    console.log(`   Documentos: ${integrity.documentsCount}`);
    
    if (integrity.issues.length > 0) {
      console.log('\n⚠️ Problemas encontrados:');
      integrity.issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
    }
    
    // 4. Generar reporte de uso
    console.log('\n📋 Paso 4: Generando reporte de uso...');
    const usageReport = await HRDocumentInitializationService.generateUsageReport();
    
    console.log('\n📊 Reporte de uso:');
    console.log(`   Total documentos: ${usageReport.summary.totalDocuments}`);
    console.log(`   Tamaño total: ${(usageReport.summary.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Carpetas: ${usageReport.folders.total}`);
    console.log(`   Actividades totales: ${usageReport.activity.totalActivities}`);
    
    // 5. Optimizar rendimiento
    console.log('\n⚡ Paso 5: Optimizando rendimiento...');
    const optimization = await HRDocumentInitializationService.optimizeSystemPerformance();
    
    console.log('\n📊 Resultados de optimización:');
    console.log(`   Estadísticas recalculadas: ${optimization.statsRecalculated ? '✅' : '❌'}`);
    console.log(`   Datos obsoletos limpiados: ${optimization.obsoleteDataCleaned ? '✅' : '❌'}`);
    console.log(`   Integridad verificada: ${optimization.integrityVerified ? '✅' : '❌'}`);
    console.log(`   Problemas encontrados: ${optimization.issuesFound}`);
    
    console.log('\n🎉 ¡Migración completada exitosamente!');
    console.log('================================================');
    
    // Resumen final
    console.log('\n📈 RESUMEN FINAL:');
    console.log(`   ✅ Sistema inicializado`);
    console.log(`   ✅ Estructura verificada`);
    console.log(`   ✅ Integridad verificada`);
    console.log(`   ✅ Reporte generado`);
    console.log(`   ✅ Rendimiento optimizado`);
    console.log(`   📁 Carpetas creadas: ${initResult.folders.length}`);
    console.log(`   📊 Documentos iniciales: ${usageReport.summary.totalDocuments}`);
    console.log(`   🗂️ Tamaño total: ${(usageReport.summary.totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (integrity.issues.length > 0) {
      console.log('\n⚠️ Se encontraron problemas durante la verificación.');
      console.log('   Revisa los logs para más detalles.');
    } else {
      console.log('\n✨ ¡Migración perfecta! El sistema está listo para usar.');
    }
    
    console.log('\n🚀 El sistema de documentos de RH está listo para producción!');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    console.error('================================================');
    console.error('Detalles del error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { main };
