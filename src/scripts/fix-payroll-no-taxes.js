#!/usr/bin/env node

/**
 * Script para regenerar nóminas existentes sin impuestos automáticos
 * Uso: node src/scripts/fix-payroll-no-taxes.js
 */

// Configurar variables de entorno
require('dotenv').config();

const { db } = require('../config/firebase');
const PayrollService = require('../services/PayrollService');
const logger = require('../utils/logger');

// Inicializar Firebase
async function initializeFirebase() {
  try {
    // Verificar que Firebase esté inicializado
    if (!db) {
      throw new Error('Firebase no está inicializado correctamente');
    }
    console.log('✅ Firebase inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
    throw error;
  }
}

async function fixExistingPayrolls() {
  try {
    // Inicializar Firebase primero
    await initializeFirebase();
    
    console.log('🔄 Iniciando corrección de nóminas existentes...');

    // Obtener todas las nóminas existentes
    const payrollsSnapshot = await db.collection('payroll').get();
    
    if (payrollsSnapshot.empty) {
      console.log('ℹ️ No se encontraron nóminas para corregir');
      return;
    }

    console.log(`📋 Encontradas ${payrollsSnapshot.size} nóminas para revisar`);

    for (const doc of payrollsSnapshot.docs) {
      const payrollData = doc.data();
      const payrollId = doc.id;

      console.log(`\n🔍 Procesando nómina: ${payrollId}`);
      console.log(`   Empleado: ${payrollData.employeeId}`);
      console.log(`   Período: ${payrollData.periodStart} - ${payrollData.periodEnd}`);
      console.log(`   Estado: ${payrollData.status}`);

      try {
        // Verificar si tiene deducciones de impuestos
        const detailsSnapshot = await db.collection('payrollDetails')
          .where('payrollId', '==', payrollId)
          .where('type', '==', 'deduction')
          .where('category', 'in', ['tax', 'social_security'])
          .get();

        if (!detailsSnapshot.empty) {
          console.log(`   ❌ Encontradas ${detailsSnapshot.size} deducciones de impuestos - regenerando...`);
          
          // Eliminar nómina actual
          await PayrollService.deletePayroll(payrollId);
          
          // Regenerar nómina sin impuestos
          const newPayroll = await PayrollService.generatePayroll(
            payrollData.employeeId,
            new Date(payrollData.periodStart),
            true // forceRegenerate
          );

          console.log(`   ✅ Nómina regenerada exitosamente: ${newPayroll.id}`);
          console.log(`   💰 Nuevo salario neto: $${newPayroll.netSalary.toFixed(2)}`);
        } else {
          console.log(`   ✅ Nómina ya está sin impuestos automáticos`);
        }

      } catch (error) {
        console.error(`   ❌ Error procesando nómina ${payrollId}:`, error.message);
      }
    }

    console.log('\n🎉 Corrección de nóminas completada');

  } catch (error) {
    console.error('❌ Error en el script de corrección:', error);
    throw error;
  }
}

// Ejecutar script
if (require.main === module) {
  fixExistingPayrolls()
    .then(() => {
      console.log('✅ Script ejecutado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { fixExistingPayrolls };
