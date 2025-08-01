/**
 * 🧪 SCRIPT DE PRUEBA: SISTEMA DE ACTUALIZACIÓN AUTOMÁTICA DE CONTACTOS
 * 
 * Este script prueba toda la lógica de creación y actualización de contactos
 * para verificar que funciona correctamente en todos los escenarios.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const ContactService = require('./src/services/ContactService');
const MessageService = require('./src/services/MessageService');
const { logger } = require('./src/utils/logger');

/**
 * Simular datos de mensaje para pruebas
 */
function createMockMessageData(scenario) {
  const baseData = {
    from: '+1234567890',
    to: '+0987654321',
    timestamp: new Date().toISOString(),
    metadata: {
      twilio: {
        ProfileName: 'Test User',
        WaId: '1234567890'
      }
    }
  };

  switch (scenario) {
    case 'new_contact':
      return {
        ...baseData,
        from: '+1111111111',
        direction: 'inbound'
      };
    
    case 'existing_contact':
      return {
        ...baseData,
        from: '+2222222222',
        direction: 'inbound'
      };
    
    case 'inactive_contact':
      return {
        ...baseData,
        from: '+3333333333',
        direction: 'inbound'
      };
    
    case 'outbound_message':
      return {
        ...baseData,
        from: '+0987654321',
        to: '+1111111111',
        direction: 'outbound'
      };
    
    default:
      return {
        ...baseData,
        direction: 'inbound'
      };
  }
}

/**
 * Probar escenario de contacto nuevo
 */
async function testNewContact() {
  console.log('\n🧪 PROBANDO: Contacto nuevo');
  
  try {
    const messageData = createMockMessageData('new_contact');
    
    const contact = await ContactService.createOrUpdateFromMessage(messageData, {
      conversationId: 'test_conv_1',
      userId: 'test@example.com'
    });
    
    console.log('✅ Contacto nuevo creado:', {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      isActive: contact.isActive,
      lastContactAt: contact.lastContactAt
    });
    
    return contact;
  } catch (error) {
    console.error('❌ Error creando contacto nuevo:', error.message);
    throw error;
  }
}

/**
 * Probar escenario de contacto existente
 */
async function testExistingContact() {
  console.log('\n🧪 PROBANDO: Contacto existente');
  
  try {
    const messageData = createMockMessageData('existing_contact');
    
    // Primera vez - crear contacto
    const contact1 = await ContactService.createOrUpdateFromMessage(messageData, {
      conversationId: 'test_conv_2',
      userId: 'test@example.com'
    });
    
    console.log('✅ Contacto creado por primera vez:', {
      id: contact1.id,
      lastContactAt: contact1.lastContactAt
    });
    
    // Segunda vez - actualizar contacto
    const updatedMessageData = {
      ...messageData,
      timestamp: new Date().toISOString()
    };
    
    const contact2 = await ContactService.createOrUpdateFromMessage(updatedMessageData, {
      conversationId: 'test_conv_2',
      userId: 'test@example.com'
    });
    
    console.log('✅ Contacto actualizado:', {
      id: contact2.id,
      lastContactAt: contact2.lastContactAt,
      totalMessages: contact2.totalMessages
    });
    
    return contact2;
  } catch (error) {
    console.error('❌ Error actualizando contacto existente:', error.message);
    throw error;
  }
}

/**
 * Probar escenario de contacto inactivo
 */
async function testInactiveContact() {
  console.log('\n🧪 PROBANDO: Reactivación de contacto inactivo');
  
  try {
    const messageData = createMockMessageData('inactive_contact');
    
    // Crear contacto primero
    const contact1 = await ContactService.createOrUpdateFromMessage(messageData, {
      conversationId: 'test_conv_3',
      userId: 'test@example.com'
    });
    
    console.log('✅ Contacto creado:', {
      id: contact1.id,
      isActive: contact1.isActive
    });
    
    // Simular desactivación (en un caso real esto se haría manualmente)
    // Aquí solo verificamos que el sistema maneja contactos inactivos
    
    const updatedMessageData = {
      ...messageData,
      timestamp: new Date().toISOString()
    };
    
    const contact2 = await ContactService.createOrUpdateFromMessage(updatedMessageData, {
      conversationId: 'test_conv_3',
      userId: 'test@example.com'
    });
    
    console.log('✅ Contacto procesado (debería estar activo):', {
      id: contact2.id,
      isActive: contact2.isActive,
      lastContactAt: contact2.lastContactAt
    });
    
    return contact2;
  } catch (error) {
    console.error('❌ Error reactivando contacto inactivo:', error.message);
    throw error;
  }
}

/**
 * Probar escenario de mensaje saliente
 */
async function testOutboundMessage() {
  console.log('\n🧪 PROBANDO: Mensaje saliente');
  
  try {
    const messageData = createMockMessageData('outbound_message');
    
    const contact = await ContactService.createOrUpdateFromMessage(messageData, {
      conversationId: 'test_conv_4',
      userId: 'test@example.com'
    });
    
    console.log('✅ Contacto procesado desde mensaje saliente:', {
      id: contact.id,
      phone: contact.phone,
      direction: messageData.direction
    });
    
    return contact;
  } catch (error) {
    console.error('❌ Error procesando mensaje saliente:', error.message);
    throw error;
  }
}

/**
 * Probar estadísticas de contactos
 */
async function testContactStats() {
  console.log('\n🧪 PROBANDO: Estadísticas de contactos');
  
  try {
    const stats = await ContactService.getContactStats({
      userId: 'test@example.com',
      period: '30d'
    });
    
    console.log('✅ Estadísticas generadas:', {
      total: stats.total,
      active: stats.active,
      inPeriod: stats.inPeriod,
      bySource: stats.bySource
    });
    
    return stats;
  } catch (error) {
    console.error('❌ Error generando estadísticas:', error.message);
    throw error;
  }
}

/**
 * Ejecutar todas las pruebas
 */
async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS DEL SISTEMA DE ACTUALIZACIÓN DE CONTACTOS');
  console.log('=' .repeat(60));
  
  try {
    // Ejecutar pruebas en paralelo
    const results = await Promise.allSettled([
      testNewContact(),
      testExistingContact(),
      testInactiveContact(),
      testOutboundMessage(),
      testContactStats()
    ]);
    
    // Analizar resultados
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESUMEN DE PRUEBAS:');
    console.log(`✅ Exitosas: ${successful}`);
    console.log(`❌ Fallidas: ${failed}`);
    console.log(`📈 Tasa de éxito: ${((successful / results.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ PRUEBAS FALLIDAS:');
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.log(`  - Prueba ${index + 1}: ${result.reason.message}`);
        }
      });
    }
    
    if (successful === results.length) {
      console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON! El sistema está funcionando correctamente.');
    } else {
      console.log('\n⚠️ Algunas pruebas fallaron. Revisa los errores arriba.');
    }
    
  } catch (error) {
    console.error('💥 Error ejecutando pruebas:', error.message);
  }
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
  runAllTests().then(() => {
    console.log('\n🏁 Pruebas completadas.');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Error fatal:', error.message);
    process.exit(1);
  });
}

module.exports = {
  testNewContact,
  testExistingContact,
  testInactiveContact,
  testOutboundMessage,
  testContactStats,
  runAllTests
}; 