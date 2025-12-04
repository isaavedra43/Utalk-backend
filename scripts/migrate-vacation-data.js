#!/usr/bin/env node

/**
 * Script de Migración de Datos de Vacaciones
 * Migra empleados existentes al nuevo sistema de vacaciones
 * 
 * Uso: node scripts/migrate-vacation-data.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const VacationInitializationService = require('../src/services/VacationInitializationService');

async function main() {
  try {
    console.log('🚀 Iniciando migración de datos de vacaciones...');
    console.log('================================================');
    
    // 1. Migrar empleados existentes
    console.log('\n📋 Paso 1: Migrando empleados existentes...');
    const migrationResult = await VacationInitializationService.migrateExistingEmployees();
    
    console.log('\n📊 Resultados de migración:');
    console.log(`   Total empleados: ${migrationResult.total}`);
    console.log(`   Migrados: ${migrationResult.migrated}`);
    console.log(`   Errores: ${migrationResult.errors}`);
    
    // 2. Recalcular balances
    console.log('\n🧮 Paso 2: Recalculando balances...');
    const recalculationResult = await VacationInitializationService.recalculateAllBalances();
    
    console.log('\n📊 Resultados de recálculo:');
    console.log(`   Total empleados: ${recalculationResult.total}`);
    console.log(`   Recalculados: ${recalculationResult.recalculated}`);
    console.log(`   Errores: ${recalculationResult.errors}`);
    
    // 3. Limpiar datos obsoletos
    console.log('\n🧹 Paso 3: Limpiando datos obsoletos...');
    const cleanupResult = await VacationInitializationService.cleanupObsoleteData();
    
    console.log('\n📊 Resultados de limpieza:');
    console.log(`   Total empleados inactivos: ${cleanupResult.total}`);
    console.log(`   Marcados para limpieza: ${cleanupResult.cleaned}`);
    console.log(`   Errores: ${cleanupResult.errors}`);
    
    console.log('\n🎉 ¡Migración completada exitosamente!');
    console.log('================================================');
    
    // Resumen final
    const totalErrors = migrationResult.errors + recalculationResult.errors + cleanupResult.errors;
    const totalProcessed = migrationResult.migrated + recalculationResult.recalculated;
    
    console.log('\n📈 RESUMEN FINAL:');
    console.log(`   ✅ Empleados procesados: ${totalProcessed}`);
    console.log(`   ❌ Errores totales: ${totalErrors}`);
    console.log(`   🎯 Tasa de éxito: ${((totalProcessed / (totalProcessed + totalErrors)) * 100).toFixed(2)}%`);
    
    if (totalErrors > 0) {
      console.log('\n⚠️  Se encontraron errores durante la migración.');
      console.log('   Revisa los logs para más detalles.');
    } else {
      console.log('\n✨ ¡Migración perfecta! Todos los empleados fueron procesados sin errores.');
    }
    
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
