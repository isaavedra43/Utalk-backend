/**
 * 💬 CONVERSATION SERVICE
 * 
 * Servicio para manejo de conversaciones con Firestore
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore, FieldValue } = require('../config/firebase');
const logger = require('../utils/logger');

class ConversationService {
  /**
   * Obtener conversaciones con filtros
   * 🔧 CORREGIDO: Consultar en contacts/{contactId}/conversations
   */
  static async getConversations(filters = {}) {
    try {
      // 🔧 CORRECCIÓN CRÍTICA: Consultar en la estructura correcta
      // Necesitamos obtener todas las conversaciones de todos los contactos
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
   * 🔧 CORREGIDO: Buscar en contacts/{contactId}/conversations
   */
  static async getConversationById(id) {
    try {
      // 🔍 LOGGING MEJORADO PARA DEBUG
      logger.debug('ConversationService.getConversationById - Iniciando consulta', {
        conversationId: id,
        timestamp: new Date().toISOString()
      });

      // 🔧 CORRECCIÓN CRÍTICA: Buscar en la estructura correcta
      // Necesitamos buscar en todos los contactos para encontrar la conversación
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
          const conversationData = {
            id: conversationDoc.id,
            contactId: contactId,
            ...conversationDoc.data()
          };
          
          logger.info('✅ Conversación encontrada en contacts/{contactId}/conversations', {
            conversationId: id,
            contactId: contactId,
            structure: 'contacts/{contactId}/conversations'
          });
          
          return conversationData;
        }
      }

      // Si no se encuentra en ningún contacto
      logger.warn('Conversación no encontrada en ningún contacto', { 
        conversationId: id,
        searchedStructure: 'contacts/{contactId}/conversations'
      });
      
      return null;

    } catch (error) {
      logger.error('Error obteniendo conversación por ID:', error);
      throw error;
    }
  }

  /**
   * Crear nueva conversación
   * 🔧 CORREGIDO: Crear en contacts/{contactId}/conversations en lugar de conversations
   */
  static async createConversation(conversationData) {
    try {
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

      // 🔧 CRÍTICO: Asegurar que participants incluya al creador
      if (conversationData.createdBy && !conversation.participants.includes(conversationData.createdBy)) {
        conversation.participants.push(conversationData.createdBy);
      }

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

      // 🔧 CORRECCIÓN CRÍTICA: Crear en contacts/{contactId}/conversations
      // Primero, buscar o crear el contacto
      const contactId = await this.getOrCreateContactId(conversationData.customerPhone, conversationData.customerName);
      
      // Crear la conversación en la subcolección del contacto
      const conversationRef = firestore
        .collection('contacts')
        .doc(contactId)
        .collection('conversations')
        .doc(conversation.id);
      
      // 🔧 NUEVO: Crear la conversación y la subcolección messages en una transacción
      await firestore.runTransaction(async (transaction) => {
        // Verificar si la conversación existe
        const conversationDoc = await transaction.get(conversationRef);
        const conversationExists = conversationDoc.exists;

        // Preparar datos del mensaje para Firestore
        const messageFirestoreData = {
          id: msg.messageId,
          conversationId: msg.conversationId,
          content: msg.content || '',
          type: msg.type || 'text',
          direction: 'outbound',
          status: 'queued', // Inicialmente queued, se actualizará después de Twilio
          senderIdentifier: msg.senderIdentifier, // email del agente
          recipientIdentifier: msg.recipientIdentifier, // teléfono del cliente
          timestamp: msg.timestamp || new Date(),
          metadata: msg.metadata || {},
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Construir lista de participantes: todos los usuarios activos + creador + viewers por defecto
        const existingParticipants = conversationExists ? (conversationDoc.data().participants || []) : [];
        const participantsSet = new Set(existingParticipants.map(p => String(p || '').toLowerCase().trim()));
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
        const participants = Array.from(participantsSet);

        // Preparar datos de la conversación para Firestore
        const conversationUpdate = {
          id: conversation.id,
          customerPhone: conversation.customerPhone,
          customerName: conversation.customerName,
          status: conversation.status,
          unreadCount: conversation.unreadCount,
          messageCount: conversation.messageCount,
          workspaceId: conversation.workspaceId,
          tenantId: conversation.tenantId,
          priority: conversation.priority,
          tags: conversation.tags,
          participants: participants,
          updatedAt: FieldValue.serverTimestamp(),
          lastMessageAt: FieldValue.serverTimestamp()
        };

        if (!conversationExists) {
          conversationUpdate.id = msg.conversationId;
          conversationUpdate.customerPhone = msg.recipientIdentifier; // cliente (teléfono)
          conversationUpdate.status = 'open';
          conversationUpdate.createdAt = new Date();
        }

        // Crear el documento de conversación en contacts/{contactId}/conversations
        transaction.set(conversationRef, conversationUpdate);
        
        // 🔧 CRÍTICO: Crear la subcolección messages con un documento inicial
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
   * 🔧 NUEVO: Obtener o crear el ID del contacto
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
   * 🔧 CORREGIDO: Actualizar en contacts/{contactId}/conversations
   */
  static async updateConversation(id, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: FieldValue.serverTimestamp()
      };

      // 🔧 CORRECCIÓN CRÍTICA: Buscar la conversación en la estructura correcta
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
          // Actualizar la conversación encontrada
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

      // Si no se encuentra la conversación
      throw new Error(`Conversación con ID ${id} no encontrada en ningún contacto`);

    } catch (error) {
      logger.error('Error actualizando conversación:', error);
      throw error;
    }
  }

  /**
   * Asignar conversación
   */
  static async assignConversation(id, assignedTo) {
    try {
      await firestore.collection('conversations').doc(id).update({
        assignedTo,
        assignedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      return this.getConversationById(id);

    } catch (error) {
      logger.error('Error asignando conversación:', error);
      throw error;
    }
  }

  /**
   * Desasignar conversación
   */
  static async unassignConversation(id) {
    try {
      await firestore.collection('conversations').doc(id).update({
        assignedTo: null,
        assignedAt: null,
        updatedAt: FieldValue.serverTimestamp()
      });

      return this.getConversationById(id);

    } catch (error) {
      logger.error('Error desasignando conversación:', error);
      throw error;
    }
  }

  /**
   * Cambiar estado de conversación
   */
  static async changeConversationStatus(id, status) {
    try {
      await firestore.collection('conversations').doc(id).update({
        status,
        updatedAt: FieldValue.serverTimestamp()
      });

      return this.getConversationById(id);

    } catch (error) {
      logger.error('Error cambiando estado de conversación:', error);
      throw error;
    }
  }

  /**
   * Cambiar prioridad de conversación
   */
  static async changeConversationPriority(id, priority) {
    try {
      await firestore.collection('conversations').doc(id).update({
        priority,
        updatedAt: FieldValue.serverTimestamp()
      });

      return this.getConversationById(id);

    } catch (error) {
      logger.error('Error cambiando prioridad de conversación:', error);
      throw error;
    }
  }

  /**
   * Marcar conversación como leída
   */
  static async markConversationAsRead(id, userEmail) {
    try {
      await firestore.collection('conversations').doc(id).update({
        unreadCount: 0,
        lastReadBy: userEmail,
        lastReadAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      return this.getConversationById(id);

    } catch (error) {
      logger.error('Error marcando conversación como leída:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de conversaciones
   */
  static async getConversationStats(filters = {}) {
    try {
      let query = firestore.collection('conversations');

      if (filters.assignedTo) {
        query = query.where('assignedTo', '==', filters.assignedTo);
      }

      const snapshot = await query.get();
      
      const stats = {
        total: 0,
        open: 0,
        closed: 0,
        pending: 0,
        archived: 0,
        unassigned: 0,
        urgent: 0,
        high: 0,
        normal: 0,
        low: 0
      };

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        stats.total++;
        
        if (data.status) {
          stats[data.status] = (stats[data.status] || 0) + 1;
        }
        
        if (data.priority) {
          stats[data.priority] = (stats[data.priority] || 0) + 1;
        }
        
        if (!data.assignedTo) {
          stats.unassigned++;
        }
      });

      return stats;

    } catch (error) {
      logger.error('Error obteniendo estadísticas de conversaciones:', error);
      throw error;
    }
  }

  /**
   * Buscar conversaciones
   */
  static async searchConversations(searchTerm, filters = {}) {
    try {
      let query = firestore.collection('conversations');

      // Aplicar filtros base
      if (filters.assignedTo) {
        query = query.where('assignedTo', '==', filters.assignedTo);
      }

      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      const snapshot = await query.get();
      
      // Filtrar por término de búsqueda
      const results = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(conversation => {
          const searchLower = searchTerm.toLowerCase();
          
          return (
            conversation.customerPhone?.toLowerCase().includes(searchLower) ||
            conversation.contact?.name?.toLowerCase().includes(searchLower) ||
            conversation.tags?.some(tag => tag.toLowerCase().includes(searchLower))
          );
        });

      return results;

    } catch (error) {
      logger.error('Error buscando conversaciones:', error);
      throw error;
    }
  }
}

module.exports = ConversationService; 