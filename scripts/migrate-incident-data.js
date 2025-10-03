#!/usr/bin/env node

/**
 * Script de Migración de Datos de Incidentes
 * Migra empleados existentes al nuevo sistema de incidentes
 * 
 * Uso: node scripts/migrate-incident-data.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const IncidentInitializationService = require('../src/services/IncidentInitializationService');

async function main() {
  try {
    console.log('🚀 Iniciando migración de datos de incidentes...');
    console.log('================================================');
    
    // 1. Migrar empleados existentes
    console.log('\n📋 Paso 1: Migrando empleados existentes...');
    const migrationResult = await IncidentInitializationService.migrateExistingEmployees();
    
    console.log('\n📊 Resultados de migración:');
    console.log(`   Total empleados: ${migrationResult.total}`);
    console.log(`   Migrados: ${migrationResult.migrated}`);
    console.log(`   Errores: ${migrationResult.errors}`);
    
    // 2. Recalcular estadísticas
    console.log('\n📊 Paso 2: Recalculando estadísticas...');
    const recalculationResult = await IncidentInitializationService.recalculateAllStatistics();
    
    console.log('\n📊 Resultados de recálculo:');
    console.log(`   Total empleados: ${recalculationResult.total}`);
    console.log(`   Recalculados: ${recalculationResult.recalculated}`);
    console.log(`   Errores: ${recalculationResult.errors}`);
    
    // 3. Generar reporte por departamento
    console.log('\n📋 Paso 3: Generando reporte por departamento...');
    const departmentReport = await IncidentInitializationService.generateDepartmentReport();
    
    console.log('\n📊 Reporte por departamento:');
    Object.entries(departmentReport.departments).forEach(([dept, stats]) => {
      console.log(`   ${dept}:`);
      console.log(`     Empleados: ${stats.totalEmployees}`);
      console.log(`     Incidentes: ${stats.totalIncidents}`);
      console.log(`     Costo total: $${stats.totalCost.toFixed(2)}`);
    });
    
    // 4. Identificar incidentes críticos
    console.log('\n🚨 Paso 4: Identificando incidentes críticos...');
    const criticalIncidents = await IncidentInitializationService.identifyCriticalIncidents();
    
    console.log('\n📊 Incidentes críticos:');
    console.log(`   Total empleados con incidentes críticos: ${criticalIncidents.count}`);
    if (criticalIncidents.count > 0) {
      criticalIncidents.criticalIncidents.forEach(incident => {
        console.log(`   - ${incident.employeeName} (${incident.department}): ${incident.criticalIncidents} críticos`);
      });
    }
    
    // 5. Limpiar datos obsoletos
    console.log('\n🧹 Paso 5: Limpiando datos obsoletos...');
    const cleanupResult = await IncidentInitializationService.cleanupObsoleteData();
    
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
    console.log(`   🚨 Incidentes críticos encontrados: ${criticalIncidents.count}`);
    console.log(`   📊 Departamentos procesados: ${Object.keys(departmentReport.departments).length}`);
    
    if (totalErrors > 0) {
      console.log('\n⚠️  Se encontraron errores durante la migración.');
      console.log('   Revisa los logs para más detalles.');
    } else {
      console.log('\n✨ ¡Migración perfecta! Todos los empleados fueron procesados sin errores.');
    }
    
    if (criticalIncidents.count > 0) {
      console.log('\n🚨 ATENCIÓN: Se encontraron empleados con incidentes críticos pendientes.');
      console.log('   Se recomienda revisar estos casos inmediatamente.');
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
