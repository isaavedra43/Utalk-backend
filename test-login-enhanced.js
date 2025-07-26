/**
 * 🚨 SCRIPT DE PRUEBA MEJORADO - LOGIN CON AMBOS CAMPOS
 * 
 * Este script prueba el endpoint de login modificado para aceptar
 * contraseñas en texto plano usando password O passwordHash.
 * 
 * ⚠️ SOLO PARA PRUEBAS - NO USAR EN PRODUCCIÓN
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function testEnhancedLogin() {
  console.log('🧪 PROBANDO LOGIN MEJORADO CON AMBOS CAMPOS...\n');

  const testCases = [
    {
      email: 'admin@utalk.com',
      password: 'admin123',
      description: 'Admin - campo password'
    },
    {
      email: 'agente@utalk.com', 
      password: 'agente2024',
      description: 'Agente - campo password'
    },
    {
      email: 'superadmin@utalk.com',
      password: 'super123',
      description: 'SuperAdmin - campo password'
    },
    {
      email: 'test@utalk.com',
      password: '123456',
      description: 'Test - campo password'
    }
  ];

  console.log('📋 CREDENCIALES DE PRUEBA:');
  console.log('┌─────────────────────┬──────────────┬─────────────┐');
  console.log('│ Email               │ Password     │ Role        │');
  console.log('├─────────────────────┼──────────────┼─────────────┤');
  
  for (const user of testCases) {
    console.log(`│ ${user.email.padEnd(19)} │ ${user.password.padEnd(12)} │ ${user.role || 'N/A'.padEnd(11)} │`);
  }
  
  console.log('└─────────────────────┴──────────────┴─────────────┘\n');

  for (const testCase of testCases) {
    console.log(`📝 Probando: ${testCase.description}`);
    console.log(`   Email: ${testCase.email}`);
    console.log(`   Password: ${testCase.password}`);
    
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: testCase.email,
        password: testCase.password
      });

      if (response.data.success) {
        console.log('   ✅ LOGIN EXITOSO');
        console.log(`   Token: ${response.data.token.substring(0, 20)}...`);
        console.log(`   Usuario: ${response.data.user.name} (${response.data.user.role})`);
        console.log(`   Email: ${response.data.user.email}`);
      } else {
        console.log('   ❌ LOGIN FALLIDO');
        console.log(`   Error: ${response.data.error}`);
      }
    } catch (error) {
      console.log('   ❌ ERROR EN REQUEST');
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${error.response.data.error}`);
        console.log(`   Message: ${error.response.data.message}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }
    
    console.log('');
  }

  console.log('🎯 PRUEBA COMPLETADA');
  console.log('');
  console.log('📋 INSTRUCCIONES:');
  console.log('1. Ejecuta: node create-test-users-plaintext.js');
  console.log('2. Reinicia el servidor backend');
  console.log('3. Ejecuta: node test-login-enhanced.js');
  console.log('');
  console.log('🔍 VERIFICACIÓN EN FIRESTORE:');
  console.log('   - Campo "password": "123456"');
  console.log('   - Campo "passwordHash": "123456"');
  console.log('   - Ambos campos deben tener el mismo valor');
  console.log('');
  console.log('⚠️  RECUERDA: Este modo es SOLO para pruebas. Restaura la seguridad después.');
}

// Ejecutar prueba
testEnhancedLogin().catch(console.error); 