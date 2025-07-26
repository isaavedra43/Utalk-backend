/**
 * 🚨 SCRIPT DE PRUEBA - LOGIN CON CONTRASEÑAS EN TEXTO PLANO
 * 
 * Este script prueba el endpoint de login modificado para aceptar
 * contraseñas en texto plano sin hashing.
 * 
 * ⚠️ SOLO PARA PRUEBAS - NO USAR EN PRODUCCIÓN
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function testLogin() {
  console.log('🧪 PROBANDO LOGIN CON CONTRASEÑAS EN TEXTO PLANO...\n');

  const testCases = [
    {
      email: 'admin@utalk.com',
      password: 'admin123',
      description: 'Admin con contraseña simple'
    },
    {
      email: 'agente@utalk.com', 
      password: 'agente2024',
      description: 'Agente con contraseña alfanumérica'
    },
    {
      email: 'test@utalk.com',
      password: '123456',
      description: 'Usuario con contraseña numérica'
    }
  ];

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
  console.log('📋 INSTRUCCIONES PARA PROBAR:');
  console.log('1. Asegúrate de que el servidor esté corriendo en el puerto correcto');
  console.log('2. Verifica que existan usuarios en Firestore con las contraseñas en texto plano');
  console.log('3. Ejecuta: node test-login-plaintext.js');
  console.log('');
  console.log('⚠️  RECUERDA: Este modo es SOLO para pruebas. Restaura la seguridad después.');
}

// Ejecutar prueba
testLogin().catch(console.error); 