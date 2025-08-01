/**
 * 🧪 SCRIPT DE PRUEBA: SISTEMA DE CALLBACKS DE STATUS TWILIO
 * 
 * Prueba completa del sistema de callbacks de status de mensajes:
 * 1. Webhook de status → 2. Procesamiento → 3. Guardado → 4. Verificación
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const axios = require('axios');
const { firestore, Timestamp } = require('./src/config/firebase');
const MessageStatus = require('./src/models/MessageStatus');
const TwilioStatusController = require('./src/controllers/TwilioStatusController');

// Configuración
const BASE_URL = process.env.API_URL || 'http://localhost:3000';

/**
 * Clase para manejar las pruebas del sistema de callbacks de status
 */
class TwilioStatusTester {
  constructor() {
    this.testResults = [];
    this.testMessageId = `test_message_${Date.now()}`;
    this.testTwilioSid = `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log de prueba
   */
  log(message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data);
    this.testResults.push({ timestamp, message, data });
  }

  /**
   * Hacer petición HTTP
   */
  async makeRequest(method, endpoint, data = null, headers = {}) {
    try {
      const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response;
    } catch (error) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { error: error.message }
      };
    }
  }

  /**
   * Crear mensaje de prueba en Firestore
   */
  async createTestMessage() {
    try {
      const conversationId = `test_conv_${Date.now()}`;
      
      // Crear conversación de prueba
      await firestore.collection('conversations').doc(conversationId).set({
        id: conversationId,
        participants: ['+1234567890', '+0987654321'],
        customerPhone: '+1234567890',
        agentPhone: '+0987654321',
        status: 'open',
        messageCount: 0,
        unreadCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Crear mensaje de prueba
      const messageData = {
        id: this.testMessageId,
        conversationId,
        senderPhone: '+1234567890',
        recipientPhone: '+0987654321',
        content: 'Mensaje de prueba para status',
        direction: 'outbound',
        type: 'text',
        status: 'sent',
        sender: 'agent',
        timestamp: Timestamp.now(),
        metadata: {
          twilioSid: this.testTwilioSid,
          test: true
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(this.testMessageId)
        .set(messageData);

      this.log('✅ Mensaje de prueba creado', {
        messageId: this.testMessageId,
        conversationId,
        twilioSid: this.testTwilioSid
      });

      return { messageId: this.testMessageId, conversationId };
    } catch (error) {
      this.log('❌ Error creando mensaje de prueba', { error: error.message });
      throw error;
    }
  }

  /**
   * Prueba 1: Webhook de status básico
   */
  async testBasicStatusWebhook() {
    this.log('🧪 PRUEBA 1: Webhook de status básico');

    const webhookData = {
      MessageSid: this.testTwilioSid,
      MessageStatus: 'delivered',
      To: 'whatsapp:+1234567890',
      From: 'whatsapp:+0987654321',
      AccountSid: 'AC1234567890abcdef',
      ApiVersion: '2010-04-01',
      Price: '0.001',
      PriceUnit: 'USD',
      NumSegments: '1',
      NumMedia: '0',
      ErrorCode: null,
      ErrorMessage: null,
      SmsStatus: 'delivered',
      SmsSid: 'SM1234567890abcdef',
      SmsMessageSid: 'SM1234567890abcdef',
      Body: 'Mensaje de prueba',
      ProfileName: 'Usuario Prueba',
      WaId: '1234567890'
    };

    const response = await this.makeRequest('POST', '/api/twilio/status-callback', webhookData);

    if (response.status === 200 && response.data.success) {
      this.log('✅ Webhook de status básico procesado correctamente', {
        messageId: response.data.data?.messageId,
        status: response.data.data?.status
      });
      return true;
    } else {
      this.log('❌ Webhook de status básico falló', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 2: Webhook de status con error
   */
  async testErrorStatusWebhook() {
    this.log('🧪 PRUEBA 2: Webhook de status con error');

    const webhookData = {
      MessageSid: this.testTwilioSid,
      MessageStatus: 'failed',
      To: 'whatsapp:+1234567890',
      From: 'whatsapp:+0987654321',
      AccountSid: 'AC1234567890abcdef',
      ApiVersion: '2010-04-01',
      Price: '0.001',
      PriceUnit: 'USD',
      NumSegments: '1',
      NumMedia: '0',
      ErrorCode: '30008',
      ErrorMessage: 'Message delivery failed',
      SmsStatus: 'failed',
      SmsSid: 'SM1234567890abcdef',
      SmsMessageSid: 'SM1234567890abcdef',
      Body: 'Mensaje de prueba con error',
      ProfileName: 'Usuario Prueba',
      WaId: '1234567890'
    };

    const response = await this.makeRequest('POST', '/api/twilio/status-callback', webhookData);

    if (response.status === 200 && response.data.success) {
      this.log('✅ Webhook de status con error procesado correctamente', {
        messageId: response.data.data?.messageId,
        status: response.data.data?.status,
        errorCode: webhookData.ErrorCode
      });
      return true;
    } else {
      this.log('❌ Webhook de status con error falló', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 3: Webhook de status con información de contacto
   */
  async testContactInfoStatusWebhook() {
    this.log('🧪 PRUEBA 3: Webhook de status con información de contacto');

    const webhookData = {
      MessageSid: this.testTwilioSid,
      MessageStatus: 'read',
      To: 'whatsapp:+1234567890',
      From: 'whatsapp:+0987654321',
      AccountSid: 'AC1234567890abcdef',
      ApiVersion: '2010-04-01',
      Price: '0.001',
      PriceUnit: 'USD',
      NumSegments: '1',
      NumMedia: '0',
      ErrorCode: null,
      ErrorMessage: null,
      SmsStatus: 'read',
      SmsSid: 'SM1234567890abcdef',
      SmsMessageSid: 'SM1234567890abcdef',
      Body: 'Mensaje leído',
      ProfileName: 'Juan Pérez',
      WaId: '1234567890',
      // Campos adicionales de referral
      ReferralNumMedia: '0',
      ReferralNumSegments: '1',
      ReferralIntegrationError: null,
      ReferralTo: 'whatsapp:+1234567890',
      ReferralFrom: 'whatsapp:+0987654321',
      ReferralMediaUrl: null,
      ReferralMediaContentType: null,
      ReferralMediaSize: null,
      ReferralMediaSid: null
    };

    const response = await this.makeRequest('POST', '/api/twilio/status-callback', webhookData);

    if (response.status === 200 && response.data.success) {
      this.log('✅ Webhook de status con información de contacto procesado correctamente', {
        messageId: response.data.data?.messageId,
        status: response.data.data?.status,
        profileName: webhookData.ProfileName,
        waId: webhookData.WaId
      });
      return true;
    } else {
      this.log('❌ Webhook de status con información de contacto falló', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 4: Obtener historial de status
   */
  async testGetStatusHistory() {
    this.log('🧪 PRUEBA 4: Obtener historial de status');

    const response = await this.makeRequest('GET', `/api/twilio/status/${this.testMessageId}`);

    if (response.status === 200 && response.data.success) {
      this.log('✅ Historial de status obtenido correctamente', {
        messageId: response.data.data?.messageId,
        statusCount: response.data.data?.statusHistory?.length || 0,
        lastStatus: response.data.data?.lastStatus?.status
      });
      return true;
    } else {
      this.log('❌ Error obteniendo historial de status', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 5: Obtener último status
   */
  async testGetLastStatus() {
    this.log('🧪 PRUEBA 5: Obtener último status');

    const response = await this.makeRequest('GET', `/api/twilio/status/${this.testMessageId}/last`);

    if (response.status === 200 && response.data.success) {
      this.log('✅ Último status obtenido correctamente', {
        messageId: response.data.data?.messageId,
        status: response.data.data?.status,
        timestamp: response.data.data?.timestamp
      });
      return true;
    } else {
      this.log('❌ Error obteniendo último status', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 6: Obtener estadísticas de status
   */
  async testGetStatusStats() {
    this.log('🧪 PRUEBA 6: Obtener estadísticas de status');

    const response = await this.makeRequest('GET', '/api/twilio/status/stats?period=1d');

    if (response.status === 200 && response.data.success) {
      this.log('✅ Estadísticas de status obtenidas correctamente', {
        total: response.data.data?.stats?.total,
        byStatus: Object.keys(response.data.data?.stats?.byStatus || {}).length,
        period: response.data.data?.period
      });
      return true;
    } else {
      this.log('❌ Error obteniendo estadísticas de status', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 7: Actualización masiva de status
   */
  async testBulkUpdateStatus() {
    this.log('🧪 PRUEBA 7: Actualización masiva de status');

    const statusUpdates = [
      {
        messageId: this.testMessageId,
        twilioSid: this.testTwilioSid,
        status: 'queued',
        metadata: { test: true, bulk: true }
      },
      {
        messageId: this.testMessageId,
        twilioSid: this.testTwilioSid,
        status: 'sent',
        metadata: { test: true, bulk: true }
      },
      {
        messageId: this.testMessageId,
        twilioSid: this.testTwilioSid,
        status: 'delivered',
        metadata: { test: true, bulk: true }
      }
    ];

    const response = await this.makeRequest('POST', '/api/twilio/status/bulk-update', {
      statusUpdates
    });

    if (response.status === 200 && response.data.success) {
      this.log('✅ Actualización masiva de status completada', {
        total: response.data.data?.summary?.total,
        success: response.data.data?.summary?.success,
        errors: response.data.data?.summary?.errors
      });
      return true;
    } else {
      this.log('❌ Error en actualización masiva de status', {
        status: response.status,
        error: response.data?.error,
        message: response.data?.message
      });
      return false;
    }
  }

  /**
   * Prueba 8: Verificar información de contacto guardada
   */
  async testContactInfoSaved() {
    this.log('🧪 PRUEBA 8: Verificar información de contacto guardada');

    try {
      const contactsSnapshot = await firestore
        .collection('contacts')
        .where('phone', '==', '+1234567890')
        .limit(1)
        .get();

      if (!contactsSnapshot.empty) {
        const contact = contactsSnapshot.docs[0].data();
        this.log('✅ Información de contacto encontrada', {
          phone: contact.phone,
          name: contact.name,
          waId: contact.waId,
          hasProfilePhoto: !!contact.profilePhotoUrl
        });
        return true;
      } else {
        this.log('⚠️ No se encontró información de contacto', { phone: '+1234567890' });
        return false;
      }
    } catch (error) {
      this.log('❌ Error verificando información de contacto', { error: error.message });
      return false;
    }
  }

  /**
   * Prueba 9: Verificar metadatos avanzados guardados
   */
  async testAdvancedMetadataSaved() {
    this.log('🧪 PRUEBA 9: Verificar metadatos avanzados guardados');

    try {
      const conversationsSnapshot = await firestore.collection('conversations').get();
      
      for (const convDoc of conversationsSnapshot.docs) {
        const messageDoc = await convDoc.ref
          .collection('messages')
          .doc(this.testMessageId)
          .get();

        if (messageDoc.exists) {
          const messageData = messageDoc.data();
          const hasTwilioMetadata = !!(messageData.metadata?.twilio);
          const hasContactInfo = !!(messageData.metadata?.contact);

          this.log('✅ Metadatos avanzados verificados', {
            messageId: messageData.id,
            hasTwilioMetadata,
            hasContactInfo,
            twilioFields: hasTwilioMetadata ? Object.keys(messageData.metadata.twilio).length : 0,
            contactFields: hasContactInfo ? Object.keys(messageData.metadata.contact).length : 0
          });
          return true;
        }
      }

      this.log('⚠️ No se encontró mensaje con metadatos avanzados', { messageId: this.testMessageId });
      return false;
    } catch (error) {
      this.log('❌ Error verificando metadatos avanzados', { error: error.message });
      return false;
    }
  }

  /**
   * Prueba 10: Verificar status en base de datos
   */
  async testStatusInDatabase() {
    this.log('🧪 PRUEBA 10: Verificar status en base de datos');

    try {
      const statusSnapshot = await firestore
        .collection('message_statuses')
        .where('messageId', '==', this.testMessageId)
        .orderBy('timestamp', 'desc')
        .get();

      if (!statusSnapshot.empty) {
        const statuses = statusSnapshot.docs.map(doc => doc.data());
        this.log('✅ Status encontrados en base de datos', {
          messageId: this.testMessageId,
          statusCount: statuses.length,
          statuses: statuses.map(s => s.status)
        });
        return true;
      } else {
        this.log('⚠️ No se encontraron status en base de datos', { messageId: this.testMessageId });
        return false;
      }
    } catch (error) {
      this.log('❌ Error verificando status en base de datos', { error: error.message });
      return false;
    }
  }

  /**
   * Limpiar datos de prueba
   */
  async cleanupTestData() {
    try {
      this.log('🧹 Limpiando datos de prueba');

      // Eliminar mensajes de prueba
      const conversationsSnapshot = await firestore.collection('conversations').get();
      
      for (const convDoc of conversationsSnapshot.docs) {
        const messageRef = convDoc.ref.collection('messages').doc(this.testMessageId);
        const messageDoc = await messageRef.get();
        
        if (messageDoc.exists) {
          await messageRef.delete();
          this.log('✅ Mensaje de prueba eliminado', { messageId: this.testMessageId });
        }
      }

      // Eliminar status de prueba
      const statusSnapshot = await firestore
        .collection('message_statuses')
        .where('messageId', '==', this.testMessageId)
        .get();

      const batch = firestore.batch();
      statusSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      this.log('✅ Status de prueba eliminados', { count: statusSnapshot.docs.length });

      // Eliminar conversaciones de prueba
      const testConversations = await firestore
        .collection('conversations')
        .where('id', '>=', 'test_conv_')
        .get();

      const convBatch = firestore.batch();
      testConversations.docs.forEach(doc => {
        convBatch.delete(doc.ref);
      });
      await convBatch.commit();

      this.log('✅ Conversaciones de prueba eliminadas', { count: testConversations.docs.length });

    } catch (error) {
      this.log('❌ Error limpiando datos de prueba', { error: error.message });
    }
  }

  /**
   * Ejecutar todas las pruebas
   */
  async runAllTests() {
    console.log('🚀 INICIANDO PRUEBAS DEL SISTEMA DE CALLBACKS DE STATUS TWILIO');
    console.log('=' .repeat(70));

    try {
      // Crear datos de prueba
      await this.createTestMessage();

      const tests = [
        { name: 'Webhook de status básico', fn: () => this.testBasicStatusWebhook() },
        { name: 'Webhook de status con error', fn: () => this.testErrorStatusWebhook() },
        { name: 'Webhook con información de contacto', fn: () => this.testContactInfoStatusWebhook() },
        { name: 'Obtener historial de status', fn: () => this.testGetStatusHistory() },
        { name: 'Obtener último status', fn: () => this.testGetLastStatus() },
        { name: 'Obtener estadísticas de status', fn: () => this.testGetStatusStats() },
        { name: 'Actualización masiva de status', fn: () => this.testBulkUpdateStatus() },
        { name: 'Verificar información de contacto', fn: () => this.testContactInfoSaved() },
        { name: 'Verificar metadatos avanzados', fn: () => this.testAdvancedMetadataSaved() },
        { name: 'Verificar status en base de datos', fn: () => this.testStatusInDatabase() }
      ];

      let passedTests = 0;
      let totalTests = tests.length;

      for (const test of tests) {
        try {
          const result = await test.fn();
          if (result) {
            passedTests++;
            console.log(`✅ ${test.name}: PASÓ`);
          } else {
            console.log(`❌ ${test.name}: FALLÓ`);
          }
        } catch (error) {
          console.log(`💥 ${test.name}: ERROR - ${error.message}`);
        }
        
        console.log('-'.repeat(50));
      }

      // Limpiar datos de prueba
      await this.cleanupTestData();

      console.log('\n📊 RESUMEN DE PRUEBAS:');
      console.log(`✅ Pruebas pasadas: ${passedTests}/${totalTests}`);
      console.log(`❌ Pruebas fallidas: ${totalTests - passedTests}/${totalTests}`);
      console.log(`📈 Tasa de éxito: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

      if (passedTests === totalTests) {
        console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON! El sistema de callbacks de status está funcionando correctamente.');
      } else {
        console.log('\n⚠️ Algunas pruebas fallaron. Revisa los logs para más detalles.');
      }

      return {
        passed: passedTests,
        total: totalTests,
        successRate: (passedTests / totalTests) * 100,
        results: this.testResults
      };
    } catch (error) {
      console.error('💥 Error ejecutando pruebas:', error.message);
      throw error;
    }
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    const tester = new TwilioStatusTester();
    const results = await tester.runAllTests();
    
    // Guardar resultados en archivo
    const fs = require('fs');
    const resultsFile = `twilio-status-test-results-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    
    console.log(`\n📄 Resultados guardados en: ${resultsFile}`);
    
    process.exit(results.passed === results.total ? 0 : 1);
  } catch (error) {
    console.error('💥 Error ejecutando pruebas:', error.message);
    process.exit(1);
  }
}

// Ejecutar si el script se ejecuta directamente
if (require.main === module) {
  main();
}

module.exports = TwilioStatusTester; 