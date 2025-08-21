/**
 * 🧪 SCRIPT DE PRUEBA: Verificar corrección de IDs de conversación con doble ++
 * 
 * Este script prueba la solución para prevenir IDs con doble ++
 */

const { generateConversationId } = require('../src/utils/conversation');

console.log('🧪 Probando generación de conversation ID...\n');

// Simular datos del frontend
const customerPhone = '+4773790184';
const whatsappNumber = '+1234567890'; // Número de ejemplo

try {
  const conversationId = generateConversationId(whatsappNumber, customerPhone);
  
  console.log('✅ Conversation ID generado correctamente:');
  console.log(`   WhatsApp: ${whatsappNumber}`);
  console.log(`   Cliente: ${customerPhone}`);
  console.log(`   ID: ${conversationId}`);
  console.log(`   Formato correcto: ${conversationId.startsWith('conv_') ? '✅' : '❌'}`);
  console.log(`   Contiene ambos números: ${conversationId.includes(whatsappNumber.replace('+', '')) && conversationId.includes(customerPhone.replace('+', '')) ? '✅' : '❌'}`);
  
  console.log('\n🎯 Resultado esperado: conv_+1234567890_+4773790184');
  console.log(`🎯 Resultado obtenido: ${conversationId}`);
  console.log(`🎯 ¿Coincide?: ${conversationId === 'conv_+1234567890_+4773790184' ? '✅' : '❌'}`);
  
} catch (error) {
  console.error('❌ Error generando conversation ID:', error.message);
} 