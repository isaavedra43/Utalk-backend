const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const Contact = require('../models/Contact');

/**
 * 🎯 SERVICIO CENTRALIZADO DE CONTACTOS
 * 
 * Maneja toda la lógica de creación, actualización y reactivación
 * de contactos de forma atómica y consistente.
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class ContactService {
  
  /**
   * 🆕 Crear o actualizar contacto desde mensaje entrante
   * 
   * @param {Object} messageData - Datos del mensaje
   * @param {string} messageData.from - Teléfono del remitente
   * @param {string} messageData.to - Teléfono del destinatario
   * @param {string} messageData.direction - 'inbound' o 'outbound'
   * @param {string} messageData.timestamp - Timestamp del mensaje
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Contact>} Contacto creado o actualizado
   */
  static async createOrUpdateFromMessage(messageData, options = {}) {
    const startTime = Date.now();
    
    try {
      // 🔍 PASO 1: Determinar teléfono del cliente
      const customerPhone = this.determineCustomerPhone(messageData);
      
      logger.info('🔄 Iniciando creación/actualización de contacto', {
        originalPhone: customerPhone,
        direction: messageData.direction,
        messageTimestamp: messageData.timestamp,
        processId: uuidv4().substring(0, 8)
      });

      // 🔍 PASO 3: Buscar contacto existente
      let contact = await Contact.getByPhone(customerPhone);
      
      // 🔍 PASO 4: Determinar acción (crear, actualizar, reactivar)
      const action = this.determineContactAction(contact, messageData);
      
      logger.info('📋 Acción determinada para contacto', {
        phone: customerPhone,
        action,
        contactExists: !!contact,
        contactActive: contact?.isActive,
        contactLastContact: contact?.lastContactAt
      });

      // 🔍 PASO 5: Ejecutar acción con transacción
      const result = await this.executeContactAction(action, contact, customerPhone, messageData, options);
      
      const processTime = Date.now() - startTime;
      
      logger.info('✅ Contacto procesado exitosamente', {
        phone: customerPhone,
        action,
        contactId: result.id,
        contactName: result.name,
        isActive: result.isActive,
        lastContactAt: result.lastContactAt,
        processTime: `${processTime}ms`
      });

      return result;
      
    } catch (error) {
      logger.error('❌ Error procesando contacto desde mensaje', {
        messageData: {
          from: messageData.from,
          to: messageData.to,
          direction: messageData.direction,
          timestamp: messageData.timestamp
        },
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      throw error;
    }
  }

  /**
   * 🎯 Determinar teléfono del cliente basado en dirección del mensaje
   */
  static determineCustomerPhone(messageData) {
    if (messageData.direction === 'inbound') {
      return messageData.from;
    } else if (messageData.direction === 'outbound') {
      return messageData.to;
    } else {
      throw new Error(`Dirección de mensaje inválida: ${messageData.direction}`);
    }
  }

  /**
   * 🎯 Determinar qué acción tomar con el contacto
   */
  static determineContactAction(contact, messageData) {
    if (!contact) {
      return 'create';
    }
    
    if (!contact.isActive) {
      return 'reactivate';
    }
    
    return 'update';
  }

  /**
   * 🎯 Ejecutar acción específica con transacción
   */
  static async executeContactAction(action, contact, phone, messageData, options) {
    const { userId = null, conversationId = null } = options;
    
    switch (action) {
      case 'create':
        return await this.createNewContact(phone, messageData, options);
        
      case 'reactivate':
        return await this.reactivateContact(contact, messageData, options);
        
      case 'update':
        return await this.updateExistingContact(contact, messageData, options);
        
      default:
        throw new Error(`Acción de contacto no soportada: ${action}`);
    }
  }

  /**
   * 🆕 Crear nuevo contacto
   */
  static async createNewContact(phone, messageData, options) {
    const { userId = null, conversationId = null } = options;
    
    // 🔧 NORMALIZAR TELÉFONO: Asegurar formato consistente con prefijo "whatsapp:"
    const normalizedPhone = phone.startsWith('whatsapp:') 
      ? phone 
      : `whatsapp:${phone}`;
    
    // Extraer nombre del perfil si está disponible
    const profileName = messageData.metadata?.profileName || 
                       messageData.metadata?.twilio?.ProfileName ||
                       normalizedPhone;

    const contactData = {
      phone: normalizedPhone,  // Usar formato normalizado
      name: profileName,
      email: null,
      tags: ['whatsapp', 'auto-created'],
      customFields: {
        firstMessageAt: messageData.timestamp,
        source: 'webhook',
        conversationId: conversationId || null
      },
      userId: userId || 'system',
      isActive: true,
      lastContactAt: messageData.timestamp,
      totalMessages: 1,
      createdAt: messageData.timestamp,
      updatedAt: messageData.timestamp
    };

    logger.info('🆕 Creando nuevo contacto', {
      originalPhone: phone,
      normalizedPhone,
      name: profileName,
      userId: contactData.userId,
      conversationId
    });

    const contact = await Contact.create(contactData);
    
    logger.info('✅ Nuevo contacto creado exitosamente', {
      contactId: contact.id,
      originalPhone: phone,
      normalizedPhone,
      name: contact.name
    });

    return contact;
  }

  /**
   * 🔄 Reactivar contacto inactivo
   */
  static async reactivateContact(contact, messageData, options) {
    const { userId = null, conversationId = null } = options;
    
    logger.info('🔄 Reactivando contacto inactivo', {
      contactId: contact.id,
      phone: contact.phone,
      wasActive: contact.isActive,
      lastContactBefore: contact.lastContactAt
    });

    // Actualizar con datos del nuevo mensaje
    await contact.update({
      isActive: true,
      lastContactAt: messageData.timestamp,
      totalMessages: FieldValue.increment(1),
      updatedAt: messageData.timestamp,
      customFields: {
        ...contact.customFields,
        reactivatedAt: messageData.timestamp,
        reactivationSource: 'webhook',
        conversationId: conversationId || null
      }
    });

    // Recargar contacto para obtener datos actualizados
    const updatedContact = await Contact.getById(contact.id);
    
    logger.info('✅ Contacto reactivado exitosamente', {
      contactId: updatedContact.id,
      phone: updatedContact.phone,
      isActive: updatedContact.isActive,
      lastContactAt: updatedContact.lastContactAt
    });

    return updatedContact;
  }

  /**
   * 📝 Actualizar contacto existente
   */
  static async updateExistingContact(contact, messageData, options) {
    const { conversationId = null } = options;
    
    logger.info('📝 Actualizando contacto existente', {
      contactId: contact.id,
      phone: contact.phone,
      lastContactBefore: contact.lastContactAt,
      totalMessagesBefore: contact.totalMessages
    });

    // Actualizar solo campos críticos
    await contact.update({
      lastContactAt: messageData.timestamp,
      totalMessages: FieldValue.increment(1),
      updatedAt: messageData.timestamp,
      customFields: {
        ...contact.customFields,
        lastMessageAt: messageData.timestamp,
        conversationId: conversationId || null
      }
    });

    // Recargar contacto para obtener datos actualizados
    const updatedContact = await Contact.getById(contact.id);
    
    logger.info('✅ Contacto actualizado exitosamente', {
      contactId: updatedContact.id,
      phone: updatedContact.phone,
      lastContactAt: updatedContact.lastContactAt,
      totalMessages: updatedContact.totalMessages
    });

    return updatedContact;
  }

  /**
   * 🔍 Buscar contacto por teléfono con manejo robusto de errores
   */
  static async findContactByPhone(phone) {
    const ErrorWrapper = require('../utils/errorWrapper');
    
    try {
      // Validar parámetro de entrada
      if (!phone || typeof phone !== 'string') {
        throw ErrorWrapper.createError(
          'Número de teléfono inválido',
          'VALIDATION_ERROR',
          400
        );
      }

      // Normalizar número de teléfono
      const normalizedPhone = phone.trim();
      if (!normalizedPhone.match(/^\+[1-9]\d{1,14}$/)) {
        throw ErrorWrapper.createError(
          'Formato de número de teléfono inválido',
          'VALIDATION_ERROR',
          400
        );
      }

      const contact = await ErrorWrapper.withTimeout(
        Contact.getByPhone(normalizedPhone),
        10000, // 10 segundos timeout
        'ContactService.findContactByPhone'
      );
      
      logger.info('🔍 Búsqueda de contacto completada', {
        phone: normalizedPhone,
        found: !!contact,
        contactId: contact?.id,
        isActive: contact?.isActive,
        lastContactAt: contact?.lastContactAt
      });

      return contact;
    } catch (error) {
      ErrorWrapper.logError(error, 'ContactService.findContactByPhone', {
        phone: phone?.substring(0, 10) + '...',
        phoneType: typeof phone
      });

      // Re-lanzar error estructurado
      if (error.code && error.status) {
        throw error;
      }

      // Crear error estructurado si no lo tiene
      throw ErrorWrapper.createError(
        `Error buscando contacto: ${error.message}`,
        'CONTACT_SEARCH_ERROR',
        500
      );
    }
  }

  /**
   * 📊 Obtener estadísticas de contactos
   */
  static async getContactStats(filters = {}) {
    try {
      const { userId = null, period = '30d' } = filters;
      
      // Calcular fechas del período
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (parseInt(period.replace('d', '')) * 24 * 60 * 60 * 1000));
      
      let query = firestore.collection('contacts').where('isActive', '==', true);
      
      if (userId) {
        query = query.where('userId', '==', userId);
      }
      
      const snapshot = await query.get();
      const contacts = snapshot.docs.map(doc => new Contact({ id: doc.id, ...doc.data() }));
      
      // Filtrar por período
      const contactsInPeriod = contacts.filter(contact => {
        const lastContact = contact.lastContactAt;
        if (!lastContact) return false;
        
        const lastContactDate = lastContact.toDate ? lastContact.toDate() : new Date(lastContact);
        return lastContactDate >= startDate && lastContactDate <= endDate;
      });
      
      const stats = {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          type: period
        },
        total: contacts.length,
        active: contacts.filter(c => c.isActive).length,
        inPeriod: contactsInPeriod.length,
        bySource: {
          webhook: contacts.filter(c => c.customFields?.source === 'webhook').length,
          manual: contacts.filter(c => !c.customFields?.source || c.customFields?.source !== 'webhook').length
        },
        averageMessagesPerContact: contacts.reduce((sum, c) => sum + (c.totalMessages || 0), 0) / contacts.length || 0
      };
      
      logger.info('📊 Estadísticas de contactos generadas', {
        userId,
        period,
        totalContacts: stats.total,
        activeContacts: stats.active,
        contactsInPeriod: stats.inPeriod
      });
      
      return stats;
    } catch (error) {
      logger.error('❌ Error generando estadísticas de contactos', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 💬 Obtener conversaciones recientes de un contacto
   */
  static async getRecentConversations(contactId, limit = 5) {
    try {
      const Conversation = require('../models/Conversation');
      
      // 🔧 ACTUALIZADO: Buscar conversaciones en la nueva estructura
      const contactRef = firestore.collection('contacts').doc(contactId);
      const conversationsSnapshot = await contactRef
        .collection('conversations')
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();

      const conversations = conversationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      logger.info('💬 Conversaciones recientes obtenidas', {
        contactId,
        limit,
        found: conversations.length
      });

      return conversations;
    } catch (error) {
      logger.error('❌ Error obteniendo conversaciones recientes', {
        contactId,
        limit,
        error: error.message
      });
      return [];
    }
  }
}

module.exports = ContactService; 