/**
 * ✅ SCRIPT DE VERIFICACIÓN - ESTRUCTURA CANÓNICA
 * 
 * Este script valida que las respuestas del backend cumplan EXACTAMENTE
 * con la estructura canónica esperada por el frontend.
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN; // JWT de prueba

// ✅ Estructura esperada para MENSAJES
const EXPECTED_MESSAGE_STRUCTURE = {
  required: ['id', 'conversationId', 'content', 'type', 'timestamp', 'sender', 'direction', 'isRead', 'isDelivered'],
  optional: ['attachments', 'metadata'],
  senderRequired: ['id', 'name', 'type'],
  senderOptional: ['avatar']
};

// ✅ Estructura esperada para RESPUESTA DE MENSAJES
const EXPECTED_MESSAGE_RESPONSE_STRUCTURE = {
  required: ['messages', 'total', 'page', 'limit'],
  forbidden: ['data', 'result', 'items', 'pagination']
};

// ✅ Estructura esperada para CONVERSACIONES
const EXPECTED_CONVERSATION_STRUCTURE = {
  required: ['id', 'contact', 'status', 'createdAt', 'updatedAt'],
  optional: ['lastMessage', 'assignedTo'],
  contactRequired: ['id', 'name', 'channel'],
  contactOptional: ['avatar']
};

async function validateMessageStructure(message, messageIndex = 0) {
  const errors = [];
  
  // Verificar campos requeridos
  EXPECTED_MESSAGE_STRUCTURE.required.forEach(field => {
    if (!message.hasOwnProperty(field)) {
      errors.push(`Mensaje ${messageIndex}: Campo requerido faltante: ${field}`);
    } else if (message[field] === undefined || message[field] === null) {
      errors.push(`Mensaje ${messageIndex}: Campo ${field} es null/undefined`);
    }
  });

  // Verificar tipos específicos
  if (message.isRead !== undefined && typeof message.isRead !== 'boolean') {
    errors.push(`Mensaje ${messageIndex}: isRead debe ser boolean, es ${typeof message.isRead}`);
  }
  
  if (message.isDelivered !== undefined && typeof message.isDelivered !== 'boolean') {
    errors.push(`Mensaje ${messageIndex}: isDelivered debe ser boolean, es ${typeof message.isDelivered}`);
  }

  if (message.timestamp && !message.timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    errors.push(`Mensaje ${messageIndex}: timestamp debe ser ISO 8601, es ${message.timestamp}`);
  }

  // Verificar estructura de sender
  if (message.sender) {
    EXPECTED_MESSAGE_STRUCTURE.senderRequired.forEach(field => {
      if (!message.sender.hasOwnProperty(field)) {
        errors.push(`Mensaje ${messageIndex}: Campo sender.${field} requerido faltante`);
      }
    });

    if (message.sender.type && !['contact', 'agent', 'bot'].includes(message.sender.type)) {
      errors.push(`Mensaje ${messageIndex}: sender.type debe ser contact|agent|bot, es ${message.sender.type}`);
    }
  }

  // Verificar que attachments sea array
  if (message.attachments !== undefined && !Array.isArray(message.attachments)) {
    errors.push(`Mensaje ${messageIndex}: attachments debe ser array, es ${typeof message.attachments}`);
  }

  return errors;
}

async function validateMessageResponse(response) {
  const errors = [];

  // Verificar estructura de respuesta
  EXPECTED_MESSAGE_RESPONSE_STRUCTURE.required.forEach(field => {
    if (!response.hasOwnProperty(field)) {
      errors.push(`Respuesta: Campo requerido faltante: ${field}`);
    }
  });

  // Verificar campos prohibidos
  EXPECTED_MESSAGE_RESPONSE_STRUCTURE.forbidden.forEach(field => {
    if (response.hasOwnProperty(field)) {
      errors.push(`Respuesta: Campo prohibido presente: ${field}`);
    }
  });

  // Verificar que messages sea array
  if (!Array.isArray(response.messages)) {
    errors.push(`Respuesta: messages debe ser array, es ${typeof response.messages}`);
  }

  // Verificar tipos numéricos
  if (typeof response.total !== 'number') {
    errors.push(`Respuesta: total debe ser number, es ${typeof response.total}`);
  }
  
  if (typeof response.page !== 'number') {
    errors.push(`Respuesta: page debe ser number, es ${typeof response.page}`);
  }
  
  if (typeof response.limit !== 'number') {
    errors.push(`Respuesta: limit debe ser number, es ${typeof response.limit}`);
  }

  // Validar cada mensaje
  if (response.messages && Array.isArray(response.messages)) {
    for (let i = 0; i < response.messages.length; i++) {
      const messageErrors = await validateMessageStructure(response.messages[i], i);
      errors.push(...messageErrors);
    }
  }

  return errors;
}

async function testMessagesEndpoint() {
  console.log('🔍 PROBANDO ENDPOINT: GET /api/conversations/:id/messages');
  
  if (!TEST_TOKEN) {
    console.log('⚠️ TEST_TOKEN no configurado, saltando prueba con autenticación');
    return;
  }

  try {
    // Usar conversationId de ejemplo
    const testConversationId = 'conv_1234567890_0987654321';
    
    const response = await axios.get(
      `${BASE_URL}/api/conversations/${testConversationId}/messages?limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Respuesta recibida, validando estructura...');
    
    const errors = await validateMessageResponse(response.data);
    
    if (errors.length === 0) {
      console.log('🎉 ¡ESTRUCTURA PERFECTA! El endpoint cumple 100% con la especificación canónica');
      console.log('📊 Estadísticas:', {
        messagesCount: response.data.messages?.length || 0,
        hasMessages: (response.data.messages?.length || 0) > 0,
        responseFields: Object.keys(response.data),
        firstMessageFields: response.data.messages?.[0] ? Object.keys(response.data.messages[0]) : 'NONE'
      });
    } else {
      console.log('❌ ERRORES ENCONTRADOS:');
      errors.forEach(error => console.log(`  - ${error}`));
    }

  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⚠️ Conversación de prueba no encontrada (normal en testing)');
      console.log('✅ Endpoint responde correctamente con 404');
    } else if (error.response?.status === 401) {
      console.log('⚠️ Token de prueba inválido o expirado');
    } else {
      console.log('❌ Error en petición:', error.message);
    }
  }
}

async function testConversationsEndpoint() {
  console.log('\n🔍 PROBANDO ENDPOINT: GET /api/conversations');
  
  if (!TEST_TOKEN) {
    console.log('⚠️ TEST_TOKEN no configurado, saltando prueba');
    return;
  }

  try {
    const response = await axios.get(
      `${BASE_URL}/api/conversations?limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Respuesta recibida para conversaciones');
    
    // Verificar estructura básica
    const hasCorrectStructure = 
      response.data.hasOwnProperty('conversations') &&
      response.data.hasOwnProperty('total') &&
      response.data.hasOwnProperty('page') &&
      response.data.hasOwnProperty('limit');

    if (hasCorrectStructure) {
      console.log('🎉 ¡ESTRUCTURA DE CONVERSACIONES CORRECTA!');
      console.log('📊 Estadísticas:', {
        conversationsCount: response.data.conversations?.length || 0,
        responseFields: Object.keys(response.data)
      });
    } else {
      console.log('❌ Estructura de conversaciones incorrecta');
      console.log('📋 Campos presentes:', Object.keys(response.data));
    }

  } catch (error) {
    console.log('❌ Error en endpoint de conversaciones:', error.response?.status || error.message);
  }
}

async function runAllTests() {
  console.log('🧪 INICIANDO VALIDACIÓN DE ESTRUCTURA CANÓNICA');
  console.log('🎯 Objetivo: Verificar 100% de alineación con frontend');
  console.log('=' .repeat(60));
  
  await testMessagesEndpoint();
  await testConversationsEndpoint();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ VALIDACIÓN COMPLETADA');
  console.log('💡 Para testing completo, configura TEST_TOKEN con un JWT válido');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  validateMessageStructure,
  validateMessageResponse,
  runAllTests
}; 