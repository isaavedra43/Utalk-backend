#!/usr/bin/env node

/**
 * Script de prueba para el endpoint de simulación de nómina
 * POST /api/payroll/simulate
 */

const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3000';
const TEST_TOKEN = 'your-test-jwt-token-here'; // Reemplazar con un token válido

// Datos de prueba
const testPayload = {
  period: {
    type: "weekly",
    startDate: "2025-09-22",
    endDate: "2025-09-28",
    label: "Semana del 22/9/2025"
  },
  scope: {
    allEmployees: true,
    employeeIds: []
  },
  options: {
    includeExtras: true,
    includeBonuses: true,
    includeAbsencesAndLates: true,
    includeEmployerContribs: false,
    taxRulesVersion: "MX_2025_09",
    overtimePolicyId: "default",
    roundingMode: "HALF_UP",
    currency: "MXN",
    timezone: "America/Mexico_City",
    previewOnly: true
  }
};

async function testSimulationEndpoint() {
  console.log('🧮 Probando endpoint de simulación de nómina...\n');

  try {
    console.log('📤 Enviando solicitud:', JSON.stringify(testPayload, null, 2));
    console.log('\n---\n');

    const response = await axios.post(`${BASE_URL}/api/payroll/simulate`, testPayload, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Trace-ID': `test_${Date.now()}`
      },
      timeout: 30000 // 30 segundos
    });

    console.log('✅ Respuesta exitosa!');
    console.log('📊 Status:', response.status);
    console.log('⏱️  Tiempo de cómputo:', response.data.simulation?.computeMs + 'ms');
    console.log('\n📋 Resumen de simulación:');
    console.log('- Total empleados:', response.data.simulation.summary.totalEmployees);
    console.log('- Total bruto:', response.data.simulation.summary.grossTotal);
    console.log('- Total neto:', response.data.simulation.summary.netTotal);
    console.log('- Total deducciones:', response.data.simulation.summary.deductionsTotal);
    console.log('- Promedio salarial:', response.data.simulation.summary.avgSalary);
    
    if (response.data.simulation.summary.warnings.length > 0) {
      console.log('\n⚠️  Advertencias:');
      response.data.simulation.summary.warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }

    console.log('\n📄 Respuesta completa:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error en la prueba:');
    
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📝 Mensaje:', error.response.data?.message || error.message);
      console.error('🔍 Detalles:', error.response.data?.details || 'Sin detalles');
      console.error('🆔 Trace ID:', error.response.data?.traceId || 'Sin trace ID');
      console.error('\n📄 Respuesta completa:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('🌐 Error de conexión - el servidor no está respondiendo');
      console.error('💡 Asegúrate de que el servidor esté ejecutándose en http://localhost:3000');
    } else {
      console.error('🔧 Error de configuración:', error.message);
    }
  }
}

// Ejecutar prueba
testSimulationEndpoint();
