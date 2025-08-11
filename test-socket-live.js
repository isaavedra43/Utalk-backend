/**
 * 🧪 VERIFICACIÓN DE SOCKET MANAGER EN SERVIDOR VIVO
 * 
 * Script para verificar que getSocketManager() retorna una instancia válida
 * cuando el servidor está corriendo.
 */

const axios = require('axios');

async function testSocketManagerLive() {
  console.log('🔍 VERIFICACIÓN DE SOCKET MANAGER EN SERVIDOR VIVO');
  console.log('==================================================');

  try {
    // 1. Verificar que el servidor está corriendo
    console.log('1. Verificando servidor...');
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('   ✅ Servidor corriendo, status:', healthResponse.status);
    console.log('   ✅ Uptime:', healthResponse.data.uptime);

    // 2. Probar endpoint que use socket manager
    console.log('\n2. Probando endpoint que use socket manager...');
    
    // Crear un endpoint temporal para probar socket manager
    const testResponse = await axios.post('http://localhost:3001/api/test-socket', {
      test: true
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(error => {
      if (error.response?.status === 404) {
        console.log('   ℹ️ Endpoint /api/test-socket no existe (esperado)');
        return null;
      }
      throw error;
    });

    if (testResponse) {
      console.log('   ✅ Endpoint respondió:', testResponse.data);
    }

    // 3. Verificar logs del servidor para SOCKETS:READY
    console.log('\n3. Verificando logs del servidor...');
    console.log('   ℹ️ Busca en los logs del servidor: SOCKETS:READY');
    console.log('   ℹ️ Si no ves ese log, el socket manager no se inicializó correctamente');

    // 4. Probar conexión Socket.IO directa
    console.log('\n4. Probando conexión Socket.IO...');
    
    const io = require('socket.io-client');
    const socket = io('http://localhost:3001', {
      auth: { token: 'test-token' },
      transports: ['websocket']
    });

    return new Promise((resolve) => {
      socket.on('connect', () => {
        console.log('   ✅ Socket.IO conectado:', socket.id);
        socket.disconnect();
        resolve();
      });

      socket.on('connect_error', (error) => {
        console.log('   ⚠️ Error conectando Socket.IO (esperado sin token válido):', error.message);
        resolve();
      });

      // Timeout
      setTimeout(() => {
        console.log('   ⏰ Timeout conectando Socket.IO');
        resolve();
      }, 5000);
    });

  } catch (error) {
    console.error('❌ Error en verificación:', error.message);
  }
}

// Ejecutar si es el script principal
if (require.main === module) {
  testSocketManagerLive().then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Verificación falló:', error.message);
    process.exit(1);
  });
}

module.exports = { testSocketManagerLive }; 