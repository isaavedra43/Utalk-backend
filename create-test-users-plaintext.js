/**
 * 🚨 SCRIPT PARA CREAR USUARIOS DE PRUEBA CON CONTRASEÑAS EN TEXTO PLANO
 * 
 * Este script crea usuarios de prueba en Firestore con contraseñas
 * almacenadas en texto plano para facilitar las pruebas.
 * 
 * ⚠️ SOLO PARA PRUEBAS - NO USAR EN PRODUCCIÓN
 */

const { firestore } = require('./src/config/firebase');
const { prepareForFirestore } = require('./src/utils/firestore');
const { FieldValue, Timestamp } = require('@google-cloud/firestore');

const testUsers = [
  {
    email: 'admin@utalk.com',
    password: 'admin123',
    name: 'Administrador',
    role: 'admin',
    phone: '+1234567890',
    description: 'Usuario administrador'
  },
  {
    email: 'agente@utalk.com',
    password: 'agente2024', 
    name: 'Agente de Soporte',
    role: 'agent',
    phone: '+1234567891',
    description: 'Usuario agente'
  },
  {
    email: 'superadmin@utalk.com',
    password: 'super123',
    name: 'Super Administrador',
    role: 'superadmin',
    phone: '+1234567892',
    description: 'Usuario super administrador'
  },
  {
    email: 'test@utalk.com',
    password: '123456',
    name: 'Usuario de Prueba',
    role: 'viewer',
    phone: '+1234567893',
    description: 'Usuario de prueba básico'
  }
];

async function createTestUsers() {
  console.log('🚨 CREANDO USUARIOS DE PRUEBA CON CONTRASEÑAS EN TEXTO PLANO...\n');

  for (const userData of testUsers) {
    try {
      console.log(`📝 Creando: ${userData.description}`);
      console.log(`   Email: ${userData.email}`);
      console.log(`   Password: ${userData.password}`);
      console.log(`   Role: ${userData.role}`);

      // Crear documento con email como ID
      const docId = userData.email.replace(/[.#$[\]]/g, '_');
      
      const userDoc = {
        email: userData.email,
        password: userData.password, // 🚨 TEXTO PLANO
        name: userData.name,
        phone: userData.phone,
        role: userData.role,
        permissions: [],
        department: null,
        isActive: true,
        settings: {
          notifications: true,
          language: 'es',
          timezone: 'America/Mexico_City',
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastLoginAt: null,
        performance: null,
      };

      await firestore.collection('users').doc(docId).set(prepareForFirestore(userDoc));

      console.log('   ✅ Usuario creado exitosamente\n');
    } catch (error) {
      console.log('   ❌ Error creando usuario');
      console.log(`   Error: ${error.message}\n`);
    }
  }

  console.log('🎯 USUARIOS DE PRUEBA CREADOS');
  console.log('');
  console.log('📋 CREDENCIALES DE PRUEBA:');
  console.log('┌─────────────────────┬──────────────┬─────────────┐');
  console.log('│ Email               │ Password     │ Role        │');
  console.log('├─────────────────────┼──────────────┼─────────────┤');
  
  for (const user of testUsers) {
    console.log(`│ ${user.email.padEnd(19)} │ ${user.password.padEnd(12)} │ ${user.role.padEnd(11)} │`);
  }
  
  console.log('└─────────────────────┴──────────────┴─────────────┘');
  console.log('');
  console.log('🧪 Ahora puedes probar el login con:');
  console.log('   node test-login-plaintext.js');
  console.log('');
  console.log('⚠️  RECUERDA: Estos usuarios tienen contraseñas en texto plano.');
  console.log('   Elimina estos usuarios después de las pruebas.');
}

// Ejecutar creación de usuarios
createTestUsers().catch(console.error); 