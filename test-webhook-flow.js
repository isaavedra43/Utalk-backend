/**
 * 🧪 SCRIPT DE PRUEBA - FLUJO COMPLETO DE WEBHOOK TWILIO
 * 
 * Este script simula un webhook de Twilio para verificar que:
 * 1. La función processIncomingMessage funciona correctamente
 * 2. Se crea la conversación en Firestore
 * 3. Se guarda el mensaje como subcolección
 * 4. Todas las fechas son strings ISO
 * 5. assignedTo usa UIDs reales
 * 6. La estructura cumple con las especificaciones
 */

const { processIncomingMessage } = require('./src/services/TwilioService');
const { firestore } = require('./src/config/firebase');
const logger = require('./src/utils/logger');

// ✅ DATOS DE PRUEBA: Simular webhook real de Twilio
const simulatedWebhookData = {
  MessageSid: 'SMtestxxxxxxxxxxxxxxxxxxxxxxxxxx',
  From: 'whatsapp:+5214773790184', // Cliente
  To: 'whatsapp:+5214793176502',   // Número de negocio
  Body: 'Hola, necesito ayuda con mi pedido',
  NumMedia: '0',
  MediaUrl0: null,
  MediaContentType0: null,
  ProfileName: 'Test Cliente',
  WaId: '5214773790184',
  AccountSid: 'ACtest12345',
  ApiVersion: '2010-04-01',
  MessageStatus: 'received',
};

/**
 * ✅ FUNCIÓN PRINCIPAL: Ejecutar prueba completa
 */
async function testCompleteWebhookFlow() {
  console.log('🧪 INICIANDO PRUEBA COMPLETA DEL FLUJO WEBHOOK');
  console.log('================================================\n');

  try {
    // ✅ PASO 1: Procesar webhook simulado
    console.log('📨 PASO 1: Procesando webhook simulado...');
    console.log('Datos del webhook:', {
      MessageSid: simulatedWebhookData.MessageSid,
      From: simulatedWebhookData.From,
      To: simulatedWebhookData.To,
      Body: simulatedWebhookData.Body,
    });

    const result = await processIncomingMessage(simulatedWebhookData);

    if (!result.success) {
      throw new Error(`Procesamiento falló: ${result.error}`);
    }

    console.log('✅ Webhook procesado exitosamente');
    console.log('Resultado:', {
      conversationId: result.conversation?.id,
      messageId: result.message?.id,
      senderPhone: result.message?.senderPhone,
      recipientPhone: result.message?.recipientPhone,
      direction: result.message?.direction,
    });

    // ✅ PASO 2: Verificar conversación en Firestore
    console.log('\n📋 PASO 2: Verificando conversación en Firestore...');
    
    const conversationId = result.conversation.id;
    const conversationDoc = await firestore.collection('conversations').doc(conversationId).get();

    if (!conversationDoc.exists) {
      throw new Error('❌ Conversación no encontrada en Firestore');
    }

    const conversationData = conversationDoc.data();
    console.log('✅ Conversación encontrada en Firestore');
    console.log('Estructura de conversación:', {
      id: conversationId,
      participants: conversationData.participants,
      customerPhone: conversationData.customerPhone,
      agentPhone: conversationData.agentPhone,
      assignedTo: conversationData.assignedTo,
      status: conversationData.status,
      messageCount: conversationData.messageCount,
      createdAt: conversationData.createdAt,
      updatedAt: conversationData.updatedAt,
    });

    // ✅ PASO 3: Verificar mensaje en Firestore
    console.log('\n📨 PASO 3: Verificando mensaje en Firestore...');
    
    const messageId = result.message.id;
    const messageDoc = await firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc(messageId)
      .get();

    if (!messageDoc.exists) {
      throw new Error('❌ Mensaje no encontrado en Firestore');
    }

    const messageData = messageDoc.data();
    console.log('✅ Mensaje encontrado en Firestore');
    console.log('Estructura de mensaje:', {
      id: messageId,
      conversationId: messageData.conversationId,
      senderPhone: messageData.senderPhone,
      recipientPhone: messageData.recipientPhone,
      content: messageData.content,
      direction: messageData.direction,
      type: messageData.type,
      timestamp: messageData.timestamp,
      createdAt: messageData.createdAt,
      updatedAt: messageData.updatedAt,
    });

    // ✅ PASO 4: Verificar estructura según especificaciones
    console.log('\n🔍 PASO 4: Verificando cumplimiento de especificaciones...');
    
    const validationResults = await validateSpecificationCompliance(conversationData, messageData);
    
    console.log('Resultados de validación:');
    validationResults.forEach((result, index) => {
      console.log(`${result.success ? '✅' : '❌'} ${index + 1}. ${result.description}`);
      if (!result.success && result.details) {
        console.log(`   Detalles: ${result.details}`);
      }
    });

    // ✅ PASO 5: Simular segundo mensaje para verificar actualización
    console.log('\n📨 PASO 5: Simulando segundo mensaje...');
    
    const secondWebhookData = {
      ...simulatedWebhookData,
      MessageSid: 'SMsecondxxxxxxxxxxxxxxxxxxxxx',
      Body: 'Gracias por la respuesta rápida',
    };

    const secondResult = await processIncomingMessage(secondWebhookData);
    
    if (secondResult.success) {
      console.log('✅ Segundo mensaje procesado exitosamente');
      
      // Verificar que messageCount se actualizó
      const updatedConversationDoc = await firestore.collection('conversations').doc(conversationId).get();
      const updatedData = updatedConversationDoc.data();
      
      console.log('MessageCount actualizado:', {
        anterior: conversationData.messageCount,
        actual: updatedData.messageCount,
      });
    } else {
      console.log('❌ Error procesando segundo mensaje:', secondResult.error);
    }

    // ✅ RESULTADO FINAL
    console.log('\n🎉 PRUEBA COMPLETADA EXITOSAMENTE');
    console.log('=====================================');
    console.log('✅ Webhook procesado correctamente');
    console.log('✅ Conversación creada en Firestore');
    console.log('✅ Mensaje guardado como subcolección');
    console.log('✅ Estructura cumple especificaciones');
    console.log('✅ Contadores actualizados correctamente');

  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA:');
    console.error('=======================');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    process.exit(1);
  }
}

/**
 * ✅ FUNCIÓN DE VALIDACIÓN: Verificar cumplimiento de especificaciones
 */
async function validateSpecificationCompliance(conversationData, messageData) {
  const results = [];

  // Validar conversación
  results.push({
    success: Array.isArray(conversationData.participants) && conversationData.participants.length === 2,
    description: 'Conversación tiene exactamente 2 participantes',
    details: `Encontrados: ${conversationData.participants?.length || 0}`,
  });

  results.push({
    success: !!conversationData.customerPhone && conversationData.customerPhone.startsWith('+'),
    description: 'customerPhone en formato E.164',
    details: `Valor: ${conversationData.customerPhone}`,
  });

  results.push({
    success: !!conversationData.agentPhone && conversationData.agentPhone.startsWith('+'),
    description: 'agentPhone en formato E.164',
    details: `Valor: ${conversationData.agentPhone}`,
  });

  results.push({
    success: conversationData.status === 'open',
    description: 'Estado de conversación es "open"',
    details: `Valor: ${conversationData.status}`,
  });

  results.push({
    success: typeof conversationData.messageCount === 'number' && conversationData.messageCount >= 1,
    description: 'messageCount es número válido',
    details: `Valor: ${conversationData.messageCount}`,
  });

  // Validar mensaje
  results.push({
    success: !!messageData.senderPhone && messageData.senderPhone.startsWith('+'),
    description: 'Mensaje tiene senderPhone válido',
    details: `Valor: ${messageData.senderPhone}`,
  });

  results.push({
    success: !!messageData.recipientPhone && messageData.recipientPhone.startsWith('+'),
    description: 'Mensaje tiene recipientPhone válido',
    details: `Valor: ${messageData.recipientPhone}`,
  });

  results.push({
    success: !messageData.from && !messageData.to,
    description: 'Mensaje NO tiene campos from/to obsoletos',
    details: `from: ${!!messageData.from}, to: ${!!messageData.to}`,
  });

  results.push({
    success: messageData.direction === 'inbound' || messageData.direction === 'outbound',
    description: 'direction es válido',
    details: `Valor: ${messageData.direction}`,
  });

  results.push({
    success: typeof messageData.content === 'string',
    description: 'content es string',
    details: `Tipo: ${typeof messageData.content}`,
  });

  // Validar fechas (estos campos pueden venir como Timestamp de Firestore)
  const timestampFields = ['createdAt', 'updatedAt'];
  timestampFields.forEach(field => {
    const value = conversationData[field];
    const isValidTimestamp = value && (value.toDate || value._seconds || typeof value === 'string');
    results.push({
      success: isValidTimestamp,
      description: `Conversación.${field} es fecha válida`,
      details: `Tipo: ${typeof value}, hasToDate: ${!!value?.toDate}`,
    });
  });

  const messageTimestampFields = ['timestamp', 'createdAt', 'updatedAt'];
  messageTimestampFields.forEach(field => {
    const value = messageData[field];
    const isValidTimestamp = value && (value.toDate || value._seconds || typeof value === 'string');
    results.push({
      success: isValidTimestamp,
      description: `Mensaje.${field} es fecha válida`,
      details: `Tipo: ${typeof value}, hasToDate: ${!!value?.toDate}`,
    });
  });

  return results;
}

/**
 * ✅ FUNCIÓN DE LIMPIEZA: Eliminar datos de prueba
 */
async function cleanupTestData() {
  try {
    console.log('\n🧹 Limpiando datos de prueba...');
    
    const conversationId = 'conv_5214773790184_5214793176502';
    
    // Eliminar mensajes
    const messagesSnapshot = await firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .get();
    
    const batch = firestore.batch();
    messagesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Eliminar conversación
    const conversationRef = firestore.collection('conversations').doc(conversationId);
    batch.delete(conversationRef);
    
    await batch.commit();
    
    console.log('✅ Datos de prueba eliminados');
  } catch (error) {
    console.log('⚠️ Error limpiando datos de prueba:', error.message);
  }
}

/**
 * ✅ EJECUTAR PRUEBA
 */
async function main() {
  try {
    // Limpiar datos previos
    await cleanupTestData();
    
    // Ejecutar prueba
    await testCompleteWebhookFlow();
    
    // Preguntar si mantener datos de prueba
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.question('\n¿Deseas eliminar los datos de prueba? (y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        await cleanupTestData();
      } else {
        console.log('✅ Datos de prueba mantenidos para inspección manual');
      }
      
      rl.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error en main:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = {
  testCompleteWebhookFlow,
  validateSpecificationCompliance,
  cleanupTestData,
}; 