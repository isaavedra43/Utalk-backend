#!/usr/bin/env node

/**
 * Script para agregar índices de Firestore necesarios para nómina general
 * Ejecutar con: node scripts/add-general-payroll-indexes.js
 */

const { db } = require('../src/config/firebase');
const logger = require('../src/utils/logger');

async function addGeneralPayrollIndexes() {
  try {
    logger.info('🔧 Iniciando creación de índices para nómina general...');

    // Los índices de Firestore se crean automáticamente cuando se ejecutan las consultas
    // Pero podemos pre-crear algunos documentos de prueba para que Firebase los detecte

    console.log('📋 Índices requeridos para nómina general:');
    console.log('');
    console.log('1. generalPayrolls:');
    console.log('   - period.startDate ASC, period.endDate ASC (para buscar por período)');
    console.log('   - status ASC, createdAt DESC (para listar por estado)');
    console.log('   - period.startDate ASC, status ASC (para validaciones)');
    console.log('');
    console.log('2. generalPayrollEmployees:');
    console.log('   - generalPayrollId ASC, employeeId ASC (para buscar empleados de nómina)');
    console.log('   - generalPayrollId ASC, status ASC (para filtrar por estado)');
    console.log('   - employeeId ASC, generalPayrollId ASC (para buscar nóminas de empleado)');
    console.log('');
    console.log('3. generalPayrollAdjustments:');
    console.log('   - generalPayrollId ASC, employeeId ASC (para buscar ajustes)');
    console.log('   - generalPayrollId ASC, status ASC, appliedAt DESC (para listar ajustes)');
    console.log('');
    console.log('4. payroll (modificaciones):');
    console.log('   - generalPayrollId ASC, employeeId ASC (para buscar nóminas individuales)');
    console.log('   - employeeId ASC, generalPayrollId ASC (para validaciones)');
    console.log('');
    console.log('🎯 Estos índices se crearán automáticamente cuando se ejecuten las consultas.');
    console.log('📖 Para crearlos manualmente, ejecuta las consultas desde la consola de Firebase.');
    console.log('');

    // Crear documentos de ejemplo para que Firebase detecte los índices necesarios
    const testData = {
      generalPayroll: {
        id: 'test-general-payroll-index',
        period: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          frequency: 'monthly'
        },
        status: 'draft',
        employees: [],
        totals: {
          totalEmployees: 0,
          totalGrossSalary: 0,
          totalDeductions: 0,
          totalNetSalary: 0,
          totalOvertime: 0,
          totalBonuses: 0,
          totalTaxes: 0,
          averageSalary: 0
        },
        createdBy: 'system-index-script',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: 'Documento de prueba para índices - ELIMINAR DESPUÉS'
      },
      generalPayrollEmployee: {
        id: 'test-employee-index',
        generalPayrollId: 'test-general-payroll-index',
        employeeId: 'test-employee-index',
        employee: {
          id: 'test-employee-index',
          name: 'Test Employee',
          position: 'Test Position',
          department: 'Test Department',
          code: 'TEST001',
          email: 'test@test.com'
        },
        baseSalary: 10000,
        overtime: 0,
        bonuses: 0,
        deductions: 0,
        taxes: 0,
        grossSalary: 10000,
        netSalary: 10000,
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentMethod: 'bank_transfer',
        adjustments: [],
        includedExtras: [],
        notes: 'Documento de prueba para índices - ELIMINAR DESPUÉS',
        faults: 0,
        attendance: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      generalPayrollAdjustment: {
        id: 'test-adjustment-index',
        generalPayrollId: 'test-general-payroll-index',
        employeeId: 'test-employee-index',
        type: 'bonus',
        concept: 'Test Bonus',
        amount: 1000,
        reason: 'Test adjustment for indexes',
        appliedBy: 'system-index-script',
        appliedAt: new Date().toISOString(),
        status: 'active',
        notes: 'Documento de prueba para índices - ELIMINAR DESPUÉS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    // Crear documentos de prueba
    console.log('📝 Creando documentos de prueba para generar índices...');
    
    await db.collection('generalPayrolls').doc(testData.generalPayroll.id).set(testData.generalPayroll);
    console.log('✅ Documento de prueba creado: generalPayrolls');

    await db.collection('generalPayrollEmployees').doc(testData.generalPayrollEmployee.id).set(testData.generalPayrollEmployee);
    console.log('✅ Documento de prueba creado: generalPayrollEmployees');

    await db.collection('generalPayrollAdjustments').doc(testData.generalPayrollAdjustment.id).set(testData.generalPayrollAdjustment);
    console.log('✅ Documento de prueba creado: generalPayrollAdjustments');

    console.log('');
    console.log('🎉 Documentos de prueba creados exitosamente!');
    console.log('');
    console.log('📋 Próximos pasos:');
    console.log('1. Ejecuta algunas consultas desde tu aplicación');
    console.log('2. Firebase creará automáticamente los índices necesarios');
    console.log('3. Elimina los documentos de prueba cuando ya no los necesites');
    console.log('');
    console.log('🗑️  Para eliminar los documentos de prueba, ejecuta:');
    console.log('   node scripts/cleanup-test-documents.js');

  } catch (error) {
    logger.error('❌ Error creando índices para nómina general', error);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar script
if (require.main === module) {
  addGeneralPayrollIndexes()
    .then(() => {
      console.log('');
      console.log('✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { addGeneralPayrollIndexes };







