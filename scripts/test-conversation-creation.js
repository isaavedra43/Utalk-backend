/**
 * 🔍 SCRIPT DE PRUEBA: Creación de conversación con mensaje inicial
 * 
 * Este script simula exactamente lo que hace el frontend cuando
 * crea una conversación con mensaje inicial.
 */

// Configurar variables de Railway
process.env.TWILIO_ACCOUNT_SID = "AC1ed6685660488369e7f0c3ab257f250c";
process.env.TWILIO_AUTH_TOKEN = "1e41598bad872369f10c9489042b5612";
process.env.TWILIO_WHATSAPP_NUMBER = "whatsapp:+5214793176502";
process.env.NODE_ENV = "production";

const ConversationController = require('../src/controllers/ConversationController');
const logger = require('../src/utils/logger');

// Mock del request y response
const mockRequest = {
  body: {
    customerPhone: '+5214773790184',
    initialMessage: '🔍 Mensaje de prueba - Creación de conversación',
    priority: 'normal',
    tags: []
  },
  user: {
    email: 'admin@company.com',
    name: 'Administrador del Sistema',
    role: 'admin',
    workspaceId: 'default_workspace',
    tenantId: 'default_tenant'
  }
};

const mockResponse = {
  status: function(code) {
    console.log(`📤 Response Status: ${code}`);
    return this;
  },
  json: function(data) {
    console.log('📤 Response Data:', JSON.stringify(data, null, 2));
    return this;
  }
};

const mockNext = function(error) {
  if (error) {
    console.log('❌ Error en next():', error.message);
  }
};

async function testConversationCreation() {
  console.log('🔍 INICIANDO PRUEBA DE CREACIÓN DE CONVERSACIÓN...\n');

  try {
    console.log('📋 Datos de prueba:');
    console.log(`   Customer Phone: ${mockRequest.body.customerPhone}`);
    console.log(`   Initial Message: "${mockRequest.body.initialMessage}"`);
    console.log(`   User: ${mockRequest.user.email}`);
    console.log(`   Workspace: ${mockRequest.user.workspaceId}\n`);

    // Llamar al controlador
    console.log('🔄 Llamando ConversationController.createConversation...\n');
    
    await ConversationController.createConversation(mockRequest, mockResponse, mockNext);

    console.log('\n✅ Prueba de creación de conversación completada');

  } catch (error) {
    console.log('❌ ERROR EN PRUEBA:');
    console.log(`   Mensaje: ${error.message}`);
    console.log(`   Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}\n`);

    logger.error('PRUEBA_CONVERSATION_CREATION_ERROR', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    });
  }
}

// Ejecutar prueba
testConversationCreation().then(() => {
  console.log('\n🏁 Prueba finalizada');
  process.exit(0);
}).catch((error) => {
  console.log('\n💥 Error fatal en prueba:', error.message);
  process.exit(1);
}); 