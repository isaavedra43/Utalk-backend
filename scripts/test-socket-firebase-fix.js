/**
 * 🧪 TEST: Socket.IO Firebase Fix
 * 
 * Script para probar que el arreglo de Socket.IO con Firebase funciona correctamente
 */

const { performance } = require('perf_hooks');

async function testSocketFirebaseFix() {
  console.log('🧪 Iniciando test de Socket.IO Firebase Fix...\n');
  
  const startTime = performance.now();
  
  try {
    // 1. Test de inicialización de Firebase
    console.log('🔥 1. Probando inicialización de Firebase...');
    const firebaseStart = performance.now();
    
    const { initializeFirebase } = require('../src/config/firebase');
    const firebaseInstance = await initializeFirebase();
    const firebaseTime = performance.now() - firebaseStart;
    
    console.log(`✅ Firebase inicializado en ${firebaseTime.toFixed(2)}ms`);
    console.log(`   - Firestore disponible: ${!!firebaseInstance.firestore}`);
    console.log(`   - Storage disponible: ${!!firebaseInstance.storage}\n`);
    
    // 2. Test de carga del Socket Manager
    console.log('🔌 2. Probando carga del Socket Manager...');
    const socketStart = performance.now();
    
    const { EnterpriseSocketManager } = require('../src/socket/enterpriseSocketManager');
    const socketTime = performance.now() - socketStart;
    
    console.log(`✅ Socket Manager cargado en ${socketTime.toFixed(2)}ms\n`);
    
    // 3. Test de inicialización del Socket Manager
    console.log('🚀 3. Probando inicialización del Socket Manager...');
    const initStart = performance.now();
    
    // Crear un servidor HTTP mock
    const http = require('http');
    const mockServer = http.createServer();
    
    // Inyectar dependencias mock
    const mockDeps = {
      User: {
        getByEmail: async (email) => ({
          id: 'test-user-id',
          email: email,
          role: 'agent',
          isActive: true
        })
      },
      Conversation: {},
      Message: {}
    };
    
    const socketManager = new EnterpriseSocketManager(mockServer, mockDeps);
    await socketManager.initialize();
    const initTime = performance.now() - initStart;
    
    console.log(`✅ Socket Manager inicializado en ${initTime.toFixed(2)}ms`);
    console.log(`   - IO disponible: ${!!socketManager.io}`);
    console.log(`   - Autenticación configurada: ${!!socketManager.io._middlewares}`);
    console.log(`   - Event handlers configurados: ${!!socketManager.io._events}\n`);
    
    // 4. Test de autenticación mock
    console.log('🔐 4. Probando autenticación mock...');
    const authStart = performance.now();
    
    // Crear un token JWT mock
    const jwt = require('jsonwebtoken');
    const mockToken = jwt.sign({
      userId: 'test-user-id',
      email: 'test@example.com',
      role: 'agent',
      workspaceId: 'test-workspace',
      tenantId: 'test-tenant'
    }, process.env.JWT_SECRET || 'test-secret');
    
    // Simular handshake de autenticación
    const mockSocket = {
      id: 'test-socket-id',
      handshake: {
        auth: {
          token: mockToken
        },
        headers: {
          'user-agent': 'test-agent'
        }
      },
      emit: () => true,
      disconnect: () => true
    };
    
    // Simular middleware de autenticación
    const authMiddleware = socketManager.io._middlewares[0];
    if (authMiddleware) {
      const authResult = await new Promise((resolve) => {
        authMiddleware(mockSocket, (error) => {
          resolve({ error, success: !error });
        });
      });
      
      const authTime = performance.now() - authStart;
      console.log(`✅ Autenticación mock completada en ${authTime.toFixed(2)}ms`);
      console.log(`   - Resultado: ${authResult.success ? 'ÉXITO' : 'FALLO'}`);
      if (authResult.error) {
        console.log(`   - Error: ${authResult.error.message}`);
      }
    } else {
      console.log('⚠️  Middleware de autenticación no encontrado');
    }
    
    // 5. Test de limpieza
    console.log('\n🧹 5. Limpiando recursos...');
    mockServer.close();
    
    const totalTime = performance.now() - startTime;
    
    console.log('\n📊 RESULTADOS DEL TEST:');
    console.log('='.repeat(50));
    console.log(`⏱️  Tiempo total: ${totalTime.toFixed(2)}ms`);
    console.log(`🔥  Firebase: ${firebaseTime.toFixed(2)}ms`);
    console.log(`🔌  Socket Manager: ${socketTime.toFixed(2)}ms`);
    console.log(`🚀  Inicialización: ${initTime.toFixed(2)}ms`);
    console.log('='.repeat(50));
    
    console.log('\n✅ Test de Socket.IO Firebase Fix completado exitosamente');
    console.log('🎯 El arreglo debería resolver los errores de "Firestore not initialized"');
    
  } catch (error) {
    console.error('\n❌ Error durante el test:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar test si es el archivo principal
if (require.main === module) {
  testSocketFirebaseFix().catch(error => {
    console.error('Error fatal en test de Socket.IO Firebase Fix:', error);
    process.exit(1);
  });
}

module.exports = { testSocketFirebaseFix }; 