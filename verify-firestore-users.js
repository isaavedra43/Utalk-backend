/**
 * 🔍 SCRIPT PARA VERIFICAR USUARIOS EN FIRESTORE
 * 
 * Este script verifica que los usuarios de prueba se crearon
 * correctamente con ambos campos password y passwordHash.
 * 
 * ⚠️ SOLO PARA PRUEBAS - NO USAR EN PRODUCCIÓN
 */

const { firestore } = require('./src/config/firebase');

async function verifyFirestoreUsers() {
  console.log('🔍 VERIFICANDO USUARIOS EN FIRESTORE...\n');

  const testEmails = [
    'admin@utalk.com',
    'agente@utalk.com',
    'superadmin@utalk.com',
    'test@utalk.com'
  ];

  console.log('📋 USUARIOS A VERIFICAR:');
  console.log('┌─────────────────────┬──────────────┬─────────────┐');
  console.log('│ Email               │ Password     │ Role        │');
  console.log('├─────────────────────┼──────────────┼─────────────┤');
  console.log('│ admin@utalk.com     │ admin123     │ admin       │');
  console.log('│ agente@utalk.com    │ agente2024   │ agent       │');
  console.log('│ superadmin@utalk.com│ super123     │ superadmin  │');
  console.log('│ test@utalk.com      │ 123456       │ viewer      │');
  console.log('└─────────────────────┴──────────────┴─────────────┘\n');

  for (const email of testEmails) {
    try {
      console.log(`🔍 Verificando: ${email}`);
      
      const usersQuery = await firestore
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (usersQuery.empty) {
        console.log('   ❌ Usuario NO encontrado en Firestore');
        continue;
      }

      const userData = usersQuery.docs[0].data();
      const docId = usersQuery.docs[0].id;

      console.log(`   ✅ Usuario encontrado (ID: ${docId})`);
      console.log(`   📝 Datos del usuario:`);
      console.log(`      - Email: ${userData.email}`);
      console.log(`      - Name: ${userData.name}`);
      console.log(`      - Role: ${userData.role}`);
      console.log(`      - IsActive: ${userData.isActive}`);
      
      // Verificar campos de contraseña
      const hasPassword = !!userData.password;
      const hasPasswordHash = !!userData.passwordHash;
      const passwordMatch = userData.password === userData.passwordHash;

      console.log(`   🔐 Campos de contraseña:`);
      console.log(`      - password: ${hasPassword ? '✅ Presente' : '❌ Ausente'}`);
      console.log(`      - passwordHash: ${hasPasswordHash ? '✅ Presente' : '❌ Ausente'}`);
      console.log(`      - Ambos iguales: ${passwordMatch ? '✅ Sí' : '❌ No'}`);

      if (hasPassword && hasPasswordHash && passwordMatch) {
        console.log('   🎉 Usuario configurado correctamente para login en texto plano');
      } else {
        console.log('   ⚠️  Usuario necesita configuración adicional');
      }

    } catch (error) {
      console.log(`   ❌ Error verificando usuario: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('🎯 VERIFICACIÓN COMPLETADA');
  console.log('');
  console.log('📋 PRÓXIMOS PASOS:');
  console.log('1. Si todos los usuarios están correctos, prueba el login:');
  console.log('   node test-login-enhanced.js');
  console.log('');
  console.log('2. Si hay usuarios faltantes, créalos:');
  console.log('   node create-test-users-plaintext.js');
  console.log('');
  console.log('3. Si hay problemas, verifica la conexión a Firestore');
  console.log('');
  console.log('⚠️  RECUERDA: Estos usuarios tienen contraseñas en texto plano.');
  console.log('   Elimina estos usuarios después de las pruebas.');
}

// Ejecutar verificación
verifyFirestoreUsers().catch(console.error); 