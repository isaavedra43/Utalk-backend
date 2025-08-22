/**
 * 💬 CONVERSATION SERVICE - NUEVA ESTRUCTURA ÚNICAMENTE
 * 
 * Servicio para manejo de conversaciones con Firestore
 * SOLO usa la estructura contacts/{contactId}/conversations
 * 
 * @version 2.0.0 - Nueva estructura únicamente
 * @author Backend Team
 */

const { firestore, FieldValue } = require('../config/firebase');
const logger = require('../utils/logger');

class ConversationService {
  /**
   * Obtener conversaciones con filtros
   * 🔧 ESTRUCTURA NUEVA: contacts/{contactId}/conversations únicamente
   */
  static async getConversations(filters = {}) {
    try {
      // Consultar en la estructura contacts/{contactId}/conversations
      const contactsSnapshot = await firestore.collection('contacts').get();
      
      let allConversations = [];
      
      // Iterar sobre todos los contactos y obtener sus conversaciones
      for (const contactDoc of contactsSnapshot.docs) {
        const contactId = contactDoc.id;
        const contactData = contactDoc.data();
        
        // Obtener conversaciones de este contacto
        let conversationsQuery = firestore
          .collection('contacts')
          .doc(contactId)
          .collection('conversations');

        // Aplicar filtros
        if (filters.status && filters.status !== 'all') {
          conversationsQuery = conversationsQuery.where('status', '==', filters.status);
        }

        if (filters.assignedTo) {
          if (filters.assignedTo === 'unassigned') {
            conversationsQuery = conversationsQuery.where('assignedTo', '==', null);
          } else {
            conversationsQuery = conversationsQuery.where('assignedTo', '==', filters.assignedTo);
          }
        }

        if (filters.participants) {
          conversationsQuery = conversationsQuery.where('participants', 'array-contains', filters.participants);
        }

        // Ordenar
        const sortBy = filters.sortBy || 'lastMessageAt';
        const sortOrder = filters.sortOrder || 'desc';
        conversationsQuery = conversationsQuery.orderBy(sortBy, sortOrder);

        // Paginación
        if (filters.limit) {
          conversationsQuery = conversationsQuery.limit(filters.limit);
        }

        if (filters.cursor) {
          conversationsQuery = conversationsQuery.startAfter(filters.cursor);
        }

        const conversationsSnapshot = await conversationsQuery.get();
        
        // Agregar conversaciones con información del contacto
        const contactConversations = conversationsSnapshot.docs.map(doc => ({
          id: doc.id,
          contactId: contactId,
          contactName: contactData.name,
          contactPhone: contactData.phone,
          ...doc.data()
        }));
        
        allConversations = allConversations.concat(contactConversations);
      }

      // Ordenar todas las conversaciones por el criterio especificado
      const sortBy = filters.sortBy || 'lastMessageAt';
      const sortOrder = filters.sortOrder || 'desc';
      
      allConversations.sort((a, b) => {
        const valA = a[sortBy] || new Date(0);
        const valB = b[sortBy] || new Date(0);
        const timeA = valA.toMillis ? valA.toMillis() : new Date(valA).getTime();
        const timeB = valB.toMillis ? valB.toMillis() : new Date(valB).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });

      // Aplicar límite final si se especifica
      if (filters.limit) {
        allConversations = allConversations.slice(0, filters.limit);
      }

      logger.info('✅ Conversaciones obtenidas de estructura contacts/{contactId}/conversations', {
        totalConversations: allConversations.length,
        filters: filters,
        structure: 'contacts/{contactId}/conversations'
      });
      
      return allConversations;

    } catch (error) {
      logger.error('Error obteniendo conversaciones:', error);
      throw error;
    }
  }

  /**
   * Obtener conversación por ID
   * 🔧 ESTRUCTURA NUEVA: contacts/{contactId}/conversations únicamente
   */
  static async getConversationById(id) {
    try {
      // Buscar en todos los contactos ya que no tenemos el contactId
      const contactsSnapshot = await firestore.collection('contacts').get();
      
      for (const contactDoc of contactsSnapshot.docs) {
        const contactId = contactDoc.id;
        const conversationDoc = await firestore
          .collection('contacts')
          .doc(contactId)
          .collection('conversations')
          .doc(id)
          .get();
        
        if (conversationDoc.exists) {
          logger.info('✅ Conversación encontrada en contacts/{contactId}/conversations', {
            conversationId: id,
            contactId: contactId,
            structure: 'contacts/{contactId}/conversations'
          });
          
          return {
            id: conversationDoc.id,
            contactId: contactId,
            ...conversationDoc.data()
          };
        }
      }
      
      logger.warn('⚠️ Conversación no encontrada en ningún contacto', {
        conversationId: id,
        structure: 'contacts/{contactId}/conversations'
      });
      
      return null;

    } catch (error) {
      logger.error('Error obteniendo conversación por ID:', error);
      throw error;
    }
  }

  /**
   * Crear nueva conversación
   * 🔧 ESTRUCTURA NUEVA: contacts/{contactId}/conversations únicamente
   */
  static async createConversation(conversationData) {
    try {
      // 🔧 Obtener todos los usuarios activos para agregarlos como participantes por defecto
      let allUserEmails = [];
      try {
        const User = require('../models/User');
        const users = await User.list({ isActive: true, limit: 1000 });
        allUserEmails = (users || [])
          .map(u => String(u.email || '').toLowerCase().trim())
          .filter(Boolean);
      } catch (_) {
        // No bloquear creación si falla el listado de usuarios
      }

      // Preparar datos de la conversación
      const conversation = {
        ...conversationData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastMessageAt: FieldValue.serverTimestamp(),
        status: conversationData.status || 'open',
        unreadCount: conversationData.unreadCount || 0,
        messageCount: conversationData.messageCount || 0,
        workspaceId: conversationData.workspaceId || 'default_workspace',
        tenantId: conversationData.tenantId || 'default_tenant',
        priority: conversationData.priority || 'normal',
        tags: Array.isArray(conversationData.tags) ? conversationData.tags : [],
        participants: Array.isArray(conversationData.participants) ? conversationData.participants : []
      };

      // Construir lista de participantes: todos los usuarios activos + creador + viewers por defecto
      const participantsSet = new Set(conversation.participants.map(p => String(p || '').toLowerCase().trim()));
      // agregar todos los usuarios activos
      for (const email of allUserEmails) participantsSet.add(email);
      // agregar creador si existe
      if (conversationData.createdBy) participantsSet.add(String(conversationData.createdBy).toLowerCase().trim());
      // viewers por defecto
      try {
        const { getDefaultViewerEmails } = require('../config/defaultViewers');
        const viewers = getDefaultViewerEmails();
        for (const v of viewers) participantsSet.add(String(v || '').toLowerCase().trim());
      } catch (_) {}
      conversation.participants = Array.from(participantsSet);

      // Buscar o crear el contacto
      const contactId = await this.getOrCreateContactId(conversationData.customerPhone, conversationData.customerName);
      
      // Crear la conversación en la subcolección del contacto
      const conversationRef = firestore
        .collection('contacts')
        .doc(contactId)
        .collection('conversations')
        .doc(conversation.id);
      
      // Crear la conversación y la subcolección messages en una transacción
      await firestore.runTransaction(async (transaction) => {
        // Verificar si la conversación existe
        const conversationDoc = await transaction.get(conversationRef);
        const conversationExists = conversationDoc.exists;

        // Crear el documento de conversación en contacts/{contactId}/conversations
        transaction.set(conversationRef, conversation);
        
        // Crear la subcolección messages con un documento inicial
        const messagesRef = conversationRef.collection('messages');
        const initialMessageDoc = {
          id: 'initial_placeholder',
          conversationId: conversation.id,
          content: 'Conversación iniciada',
          type: 'system',
          direction: 'system',
          status: 'sent',
          senderIdentifier: conversationData.createdBy || 'system',
          recipientIdentifier: conversationData.customerPhone,
          timestamp: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            isInitialPlaceholder: true,
            createdWithConversation: true
          }
        };
        
        // Crear documento inicial en la subcolección messages
        transaction.set(messagesRef.doc('initial_placeholder'), initialMessageDoc);
      });

      logger.info('✅ Conversación creada exitosamente en contacts/{contactId}/conversations', {
        conversationId: conversation.id,
        contactId: contactId,
        customerPhone: conversation.customerPhone,
        participants: conversation.participants,
        createdBy: conversationData.createdBy,
        hasMessagesSubcollection: true,
        structure: 'contacts/{contactId}/conversations/{conversationId}/messages'
      });

      return conversation;

    } catch (error) {
      logger.error('❌ Error creando conversación', {
        conversationId: conversationData.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Obtener o crear el ID del contacto
   */
  static async getOrCreateContactId(customerPhone, customerName) {
    try {
      // Buscar contacto existente por teléfono
      const contactsSnapshot = await firestore
        .collection('contacts')
        .where('phone', '==', customerPhone)
        .limit(1)
        .get();

      if (!contactsSnapshot.empty) {
        const contactDoc = contactsSnapshot.docs[0];
        logger.info('✅ Contacto existente encontrado', {
          contactId: contactDoc.id,
          customerPhone,
          customerName
        });
        return contactDoc.id;
      }

      // Crear nuevo contacto si no existe
      const newContactData = {
        phone: customerPhone,
        name: customerName || customerPhone,
        email: null,
        company: null,
        tags: [],
        metadata: {
          createdVia: 'conversation_creation',
          createdAt: new Date().toISOString()
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      const newContactRef = await firestore.collection('contacts').add(newContactData);
      
      logger.info('✅ Nuevo contacto creado', {
        contactId: newContactRef.id,
        customerPhone,
        customerName
      });

      return newContactRef.id;

    } catch (error) {
      logger.error('❌ Error obteniendo/creando contacto', {
        customerPhone,
        customerName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Actualizar conversación
   * 🔧 ESTRUCTURA NUEVA: contacts/{contactId}/conversations únicamente
   * Requiere encontrar primero el contactId
   */
  static async updateConversation(id, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: FieldValue.serverTimestamp()
      };

      // Buscar la conversación en todos los contactos para obtener el contactId
      const contactsSnapshot = await firestore.collection('contacts').get();
      
      for (const contactDoc of contactsSnapshot.docs) {
        const contactId = contactDoc.id;
        const conversationRef = firestore
          .collection('contacts')
          .doc(contactId)
          .collection('conversations')
          .doc(id);
        
        const conversationDoc = await conversationRef.get();
        
        if (conversationDoc.exists) {
          await conversationRef.update(updateData);
          
          logger.info('✅ Conversación actualizada en contacts/{contactId}/conversations', {
            conversationId: id,
            contactId: contactId,
            updates: Object.keys(updates),
            structure: 'contacts/{contactId}/conversations'
          });
          
          return this.getConversationById(id);
        }
      }
      
      throw new Error(`Conversación ${id} no encontrada en ningún contacto`);

    } catch (error) {
      logger.error('❌ Error actualizando conversación', {
        conversationId: id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // 🗑️ MÉTODOS OBSOLETOS ELIMINADOS - Ahora se usan ConversationsRepository y estructura contacts/{contactId}/conversations
  // Los siguientes métodos fueron eliminados porque usaban la estructura antigua:
  // - assignConversation, unassignConversation, changeConversationStatus
  // - changeConversationPriority, markConversationAsRead, getConversationStats, searchConversations
  // Usar ConversationsRepository en su lugar para operaciones CRUD
}

module.exports = ConversationService;