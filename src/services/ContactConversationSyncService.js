/**
 * 🔄 SERVICIO DE SINCRONIZACIÓN CONTACTO-CONVERSACIÓN
 * 
 * Maneja la sincronización de referencias cruzadas entre contactos y conversaciones
 * para permitir búsquedas bidireccionales sin romper la lógica existente.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore, FieldValue } = require('../config/firebase');
const logger = require('../utils/logger');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');

class ContactConversationSyncService {
  
  /**
   * 🔄 Sincronizar conversación con contacto
   * Agrega la conversación a la lista de conversationIds del contacto
   */
  static async syncConversationWithContact(conversationId, customerPhone) {
    try {
      logger.info('🔄 Iniciando sincronización conversación-contacto', {
        conversationId,
        customerPhone
      });

      // Buscar contacto por teléfono
      const contact = await Contact.getByPhone(customerPhone);
      
      if (!contact) {
        logger.warn('⚠️ Contacto no encontrado para sincronización', {
          conversationId,
          customerPhone
        });
        return false;
      }

      // Verificar si la conversación ya está en la lista
      const conversationIds = contact.conversationIds || [];
      
      if (!conversationIds.includes(conversationId)) {
        // Agregar conversación a la lista del contacto
        await firestore.collection('contacts').doc(contact.id).update({
          conversationIds: FieldValue.arrayUnion(conversationId),
          updatedAt: FieldValue.serverTimestamp()
        });

        logger.info('✅ Conversación agregada al contacto', {
          conversationId,
          contactId: contact.id,
          customerPhone,
          totalConversations: conversationIds.length + 1
        });
      } else {
        logger.info('ℹ️ Conversación ya existe en contacto', {
          conversationId,
          contactId: contact.id,
          customerPhone
        });
      }

      return true;

    } catch (error) {
      logger.error('❌ Error sincronizando conversación con contacto', {
        conversationId,
        customerPhone,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 🔄 Sincronizar contacto con todas sus conversaciones
   * Actualiza la lista de conversationIds del contacto basado en conversaciones existentes
   */
  static async syncContactWithConversations(customerPhone) {
    try {
      logger.info('🔄 Iniciando sincronización contacto-conversaciones', {
        customerPhone
      });

      // 🗑️ OBSOLETO: syncConversationWithContact deshabilitado
      logger.warn('🗑️ OBSOLETO: syncConversationWithContact usa estructura antigua', {
        customerPhone,
        note: 'Las conversaciones ya están en contacts/{contactId}/conversations'
      });
      
      return true; // Simular éxito - la sincronización ya no es necesaria

      if (conversationsSnapshot.empty) {
        logger.warn('⚠️ No se encontraron conversaciones para el contacto', {
          customerPhone
        });
        return false;
      }

      // Extraer IDs de conversaciones
      const conversationIds = conversationsSnapshot.docs.map(doc => doc.id);

      // Buscar contacto
      const contact = await Contact.getByPhone(customerPhone);
      
      if (!contact) {
        logger.warn('⚠️ Contacto no encontrado para sincronización', {
          customerPhone
        });
        return false;
      }

      // Actualizar lista de conversationIds
      await firestore.collection('contacts').doc(contact.id).update({
        conversationIds: conversationIds,
        updatedAt: FieldValue.serverTimestamp()
      });

      logger.info('✅ Contacto sincronizado con conversaciones', {
        contactId: contact.id,
        customerPhone,
        totalConversations: conversationIds.length,
        conversationIds
      });

      return true;

    } catch (error) {
      logger.error('❌ Error sincronizando contacto con conversaciones', {
        customerPhone,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 🔄 Sincronizar todas las conversaciones con sus contactos
   * Ejecuta sincronización masiva para todas las conversaciones existentes
   */
  static async syncAllConversationsWithContacts() {
    try {
      logger.info('🔄 Iniciando sincronización masiva conversaciones-contactos');

      // 🗑️ OBSOLETO: syncAllConversationsToContacts deshabilitado
      logger.warn('🗑️ OBSOLETO: syncAllConversationsToContacts usa estructura antigua', {
        note: 'Las conversaciones ya están en contacts/{contactId}/conversations'
      });
      
      return { success: 0, failed: 0 }; // Simular éxito - la sincronización ya no es necesaria

      if (conversationsSnapshot.empty) {
        logger.info('ℹ️ No hay conversaciones para sincronizar');
        return { success: 0, failed: 0 };
      }

      let successCount = 0;
      let failedCount = 0;

      // Procesar cada conversación
      for (const doc of conversationsSnapshot.docs) {
        const conversationData = doc.data();
        const conversationId = doc.id;
        const customerPhone = conversationData.customerPhone;

        if (customerPhone) {
          const success = await this.syncConversationWithContact(conversationId, customerPhone);
          if (success) {
            successCount++;
          } else {
            failedCount++;
          }
        } else {
          logger.warn('⚠️ Conversación sin customerPhone', { conversationId });
          failedCount++;
        }
      }

      logger.info('✅ Sincronización masiva completada', {
        totalConversations: conversationsSnapshot.size,
        successCount,
        failedCount
      });

      return { success: successCount, failed: failedCount };

    } catch (error) {
      logger.error('❌ Error en sincronización masiva', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 🔍 Obtener conversaciones de un contacto
   * Usa la nueva referencia conversationIds para obtener conversaciones rápidamente
   */
  static async getConversationsByContact(customerPhone) {
    try {
      logger.info('🔍 Obteniendo conversaciones por contacto', {
        customerPhone
      });

      // Buscar contacto
      const contact = await Contact.getByPhone(customerPhone);
      
      if (!contact) {
        logger.warn('⚠️ Contacto no encontrado', { customerPhone });
        return [];
      }

      const conversationIds = contact.conversationIds || [];

      if (conversationIds.length === 0) {
        logger.info('ℹ️ Contacto sin conversaciones', { customerPhone });
        return [];
      }

      // Obtener conversaciones usando los IDs
      const conversations = [];
      
      for (const conversationId of conversationIds) {
        try {
          const ConversationService = require('./ConversationService');
          const conversation = await ConversationService.getConversationById(conversationId);
          if (conversation) {
            conversations.push(conversation);
          }
        } catch (error) {
          logger.warn('⚠️ Error obteniendo conversación', {
            conversationId,
            error: error.message
          });
        }
      }

      logger.info('✅ Conversaciones obtenidas por contacto', {
        customerPhone,
        totalConversations: conversations.length
      });

      return conversations;

    } catch (error) {
      logger.error('❌ Error obteniendo conversaciones por contacto', {
        customerPhone,
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * 🔍 Obtener contacto de una conversación
   * Usa la nueva referencia contactId para obtener contacto rápidamente
   */
  static async getContactByConversation(conversationId) {
    try {
      logger.info('🔍 Obteniendo contacto por conversación', {
        conversationId
      });

      // Obtener conversación
      const ConversationService = require('./ConversationService');
      const conversation = await ConversationService.getConversationById(conversationId);
      
      if (!conversation) {
        logger.warn('⚠️ Conversación no encontrada', { conversationId });
        return null;
      }

      const customerPhone = conversation.customerPhone;

      if (!customerPhone) {
        logger.warn('⚠️ Conversación sin customerPhone', { conversationId });
        return null;
      }

      // Obtener contacto
      const contact = await Contact.getByPhone(customerPhone);

      logger.info('✅ Contacto obtenido por conversación', {
        conversationId,
        contactId: contact?.id,
        customerPhone
      });

      return contact;

    } catch (error) {
      logger.error('❌ Error obteniendo contacto por conversación', {
        conversationId,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }
}

module.exports = ContactConversationSyncService; 