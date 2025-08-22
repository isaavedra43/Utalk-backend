#!/usr/bin/env node

/**
 * 🧪 Script de Prueba para Endpoints de Clientes
 * 
 * Prueba los nuevos endpoints del módulo de clientes que mapean contacts → clients
 */

const { firestore } = require('../src/config/firebase');
const ClientController = require('../src/controllers/ClientController');

console.log('🧪 INICIANDO PRUEBAS DEL MÓDULO DE CLIENTES\n');

// Mock request/response para pruebas
const createMockReq = (query = {}, params = {}, user = { email: 'test@example.com' }) => ({
  query,
  params,
  user
});

const createMockRes = () => {
  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.data = data;
      return this;
    },
    statusCode: 200,
    data: null
  };
  return res;
};

async function testMetricsEndpoint() {
  try {
    console.log('📊 PROBANDO: ClientController.getMetrics()');
    
    const req = createMockReq();
    const res = createMockRes();
    
    await ClientController.getMetrics(req, res);
    
    console.log('✅ Respuesta exitosa:', {
      statusCode: res.statusCode,
      success: res.data?.success,
      totalClients: res.data?.data?.totalClients,
      hasStageMetrics: !!res.data?.data?.stageMetrics,
      hasSourceMetrics: !!res.data?.data?.sourceMetrics
    });
    
    return res.data;
    
  } catch (error) {
    console.error('❌ Error en test de métricas:', error.message);
    return null;
  }
}

async function testListEndpoint() {
  try {
    console.log('\n📋 PROBANDO: ClientController.list()');
    
    const req = createMockReq({ page: 1, limit: 5 });
    const res = createMockRes();
    
    await ClientController.list(req, res);
    
    console.log('✅ Respuesta exitosa:', {
      statusCode: res.statusCode,
      success: res.data?.success,
      totalClients: res.data?.data?.clients?.length,
      hasPagination: !!res.data?.data?.pagination,
      firstClient: res.data?.data?.clients?.[0]?.name || 'N/A'
    });
    
    return res.data;
    
  } catch (error) {
    console.error('❌ Error en test de lista:', error.message);
    return null;
  }
}

async function testGetByIdEndpoint() {
  try {
    console.log('\n🔍 PROBANDO: ClientController.getById()');
    
    // Primero obtenemos la lista para conseguir un ID real
    const req = createMockReq({ limit: 1 });
    const res = createMockRes();
    await ClientController.list(req, res);
    
    const firstClient = res.data?.data?.clients?.[0];
    if (!firstClient) {
      console.log('⚠️ No hay clientes para probar getById');
      return null;
    }
    
    // Ahora probamos getById con un ID real
    const reqById = createMockReq({}, { id: firstClient.id });
    const resById = createMockRes();
    
    await ClientController.getById(reqById, resById);
    
    console.log('✅ Cliente específico obtenido:', {
      statusCode: resById.statusCode,
      success: resById.data?.success,
      clientId: resById.data?.data?.id,
      clientName: resById.data?.data?.name,
      hasMetadata: !!resById.data?.data?.metadata
    });
    
    return resById.data;
    
  } catch (error) {
    console.error('❌ Error en test getById:', error.message);
    return null;
  }
}

async function checkFirestoreConnection() {
  try {
    console.log('🔥 VERIFICANDO: Conexión con Firestore');
    
    const snapshot = await firestore.collection('contacts').limit(1).get();
    const contactCount = snapshot.size;
    
    console.log('✅ Firestore conectado:', {
      hasContacts: contactCount > 0,
      contactCount
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error conectando con Firestore:', error.message);
    return false;
  }
}

async function runAllTests() {
  try {
    console.log('🚀 INICIANDO SUITE DE PRUEBAS\n');
    
    // 1. Verificar conexión con Firestore
    const firestoreOk = await checkFirestoreConnection();
    if (!firestoreOk) {
      console.log('💥 No se puede continuar sin Firestore');
      return;
    }
    
    console.log('\n' + '='.repeat(50));
    
    // 2. Probar métricas
    const metricsResult = await testMetricsEndpoint();
    
    console.log('\n' + '='.repeat(50));
    
    // 3. Probar lista
    const listResult = await testListEndpoint();
    
    console.log('\n' + '='.repeat(50));
    
    // 4. Probar getById
    const getByIdResult = await testGetByIdEndpoint();
    
    console.log('\n' + '='.repeat(50));
    
    // 5. Resumen
    console.log('\n📋 RESUMEN DE PRUEBAS:');
    console.log('- Firestore:', firestoreOk ? '✅ OK' : '❌ FALLO');
    console.log('- Métricas:', metricsResult?.success ? '✅ OK' : '❌ FALLO');
    console.log('- Lista:', listResult?.success ? '✅ OK' : '❌ FALLO');
    console.log('- GetById:', getByIdResult?.success ? '✅ OK' : '❌ FALLO');
    
    console.log('\n🎯 ESTADO DEL MÓDULO DE CLIENTES:');
    if (metricsResult?.success && listResult?.success) {
      console.log('✅ ¡MÓDULO LISTO PARA EL FRONTEND!');
      console.log('\n📡 Endpoints disponibles:');
      console.log('- GET /api/clients - Lista de clientes');
      console.log('- GET /api/clients/metrics - Métricas de clientes');
      console.log('- GET /api/clients/:id - Cliente específico');
    } else {
      console.log('❌ Módulo necesita correcciones');
    }
    
  } catch (error) {
    console.error('💥 Error en suite de pruebas:', error);
  }
}

// Ejecutar pruebas
runAllTests()
  .then(() => {
    console.log('\n🏁 PRUEBAS COMPLETADAS');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 ERROR CRÍTICO:', error);
    process.exit(1);
  });
