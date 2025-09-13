#!/usr/bin/env node

/**
 * 🚀 Script de Configuración Avanzada de Nómina
 * Configura índices, impuestos por defecto y estructura inicial
 */

const { db } = require('../src/config/firebase');
const TaxConfig = require('../src/models/TaxConfig');
const logger = require('../src/utils/logger');

async function setupAdvancedPayroll() {
  try {
    console.log('🚀 Configurando sistema avanzado de nómina...\n');

    // 1. Crear configuraciones de impuestos por defecto para México
    console.log('📋 Creando configuraciones de impuestos por defecto para México...');
    
    const defaultTaxes = await TaxConfig.createDefaultMexicoTaxes('default', 'setup-script');
    
    console.log(`✅ ${defaultTaxes.length} configuraciones de impuestos creadas:`);
    defaultTaxes.forEach(tax => {
      console.log(`   - ${tax.displayName} (${tax.name}): ${tax.type === 'percentage' ? tax.value + '%' : '$' + tax.value}`);
    });

    // 2. Mostrar información sobre índices necesarios
    console.log('\n📊 Índices de Firestore necesarios:');
    console.log('Los siguientes índices deben crearse en Firebase Console:');
    
    const requiredIndexes = [
      {
        collection: 'payrollConfigs',
        fields: [
          { field: 'employeeId', order: 'ASCENDING' },
          { field: 'isActive', order: 'ASCENDING' },
          { field: 'startDate', order: 'DESCENDING' }
        ]
      },
      {
        collection: 'payroll',
        fields: [
          { field: 'employeeId', order: 'ASCENDING' },
          { field: 'periodStart', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'movements',
        fields: [
          { field: 'employeeId', order: 'ASCENDING' },
          { field: 'date', order: 'ASCENDING' },
          { field: 'appliedToPayroll', order: 'ASCENDING' },
          { field: 'status', order: 'ASCENDING' }
        ]
      },
      {
        collectionGroup: 'movements',
        fields: [
          { field: 'type', order: 'ASCENDING' },
          { field: 'amount', order: 'ASCENDING' },
          { field: 'date', order: 'ASCENDING' },
          { field: 'status', order: 'ASCENDING' }
        ]
      }
    ];

    requiredIndexes.forEach((index, i) => {
      console.log(`\n${i + 1}. ${index.collectionGroup ? 'Collection Group' : 'Collection'}: ${index.collectionGroup || index.collection}`);
      index.fields.forEach(field => {
        console.log(`   - ${field.field}: ${field.order}`);
      });
    });

    // 3. Crear documentos de ejemplo si es necesario
    console.log('\n📄 Configuración de estructura de datos...');
    
    // Verificar si existe configuración global
    const existingGlobal = await db.collection('globalTaxConfigs').limit(1).get();
    if (existingGlobal.empty) {
      console.log('ℹ️ No se encontraron configuraciones globales existentes');
    } else {
      console.log(`✅ ${existingGlobal.size} configuración(es) global(es) encontrada(s)`);
    }

    // 4. Mostrar información de uso
    console.log('\n🎯 Funcionalidades Implementadas:');
    console.log('');
    console.log('📊 IMPUESTOS OPCIONALES:');
    console.log('   • Configuración global y por empleado');
    console.log('   • ISR, IMSS, IVA, INFONAVIT configurables');
    console.log('   • Impuestos personalizados');
    console.log('   • Cálculo progresivo (ISR)');
    console.log('');
    console.log('🔗 INTEGRACIÓN CON EXTRAS:');
    console.log('   • Aplicación automática de movimientos');
    console.log('   • Control de duplicados');
    console.log('   • Tracking de nóminas aplicadas');
    console.log('   • Historial completo de aplicaciones');
    console.log('');
    console.log('📈 ANÁLISIS AVANZADO:');
    console.log('   • Vista previa de nómina');
    console.log('   • Impacto de extras por período');
    console.log('   • Detección automática de duplicados');
    console.log('   • Reportes analíticos detallados');

    console.log('\n🌐 ENDPOINTS DISPONIBLES:');
    console.log('');
    console.log('📋 Configuración de Impuestos:');
    console.log('   GET    /api/tax-config/global');
    console.log('   POST   /api/tax-config/global');
    console.log('   GET    /api/tax-config/employee/:employeeId');
    console.log('   POST   /api/tax-config/employee/:employeeId');
    console.log('   GET    /api/tax-config/effective/:employeeId');
    console.log('   PUT    /api/tax-config/employee/:employeeId/settings');
    console.log('');
    console.log('🚀 Nómina Avanzada:');
    console.log('   POST   /api/payroll/generate-advanced/:employeeId');
    console.log('   POST   /api/payroll/preview/:employeeId');
    console.log('   GET    /api/payroll/:payrollId/summary-with-extras');
    console.log('   GET    /api/payroll/extras-impact/:employeeId');
    console.log('   GET    /api/payroll/check-duplicates/:employeeId');
    console.log('   PUT    /api/payroll/mark-movements-applied');

    console.log('\n✅ Configuración completada exitosamente!');
    console.log('\n📋 PRÓXIMOS PASOS:');
    console.log('1. Crear los índices de Firestore mostrados arriba');
    console.log('2. Configurar impuestos por empleado según necesidades');
    console.log('3. Probar generación de nómina avanzada');
    console.log('4. Verificar integración con sistema de extras');

  } catch (error) {
    console.error('❌ Error durante la configuración:', error);
    process.exit(1);
  }
}

// Ejecutar configuración si se llama directamente
if (require.main === module) {
  setupAdvancedPayroll()
    .then(() => {
      console.log('\n🎉 ¡Configuración completada!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { setupAdvancedPayroll };
