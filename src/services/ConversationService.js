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
   */
  static async getConversations(filters = {}) {
    try {
      let query = firestore.collection('conversations');

      // Aplicar filtros
      if (filters.status && filters.status !== 'all') {
        query = query.where('status', '==', filters.status);
      }

      if (filters.assignedTo) {
        if (filters.assignedTo === 'unassigned') {
          query = query.where('assignedTo', '==', null);
        } else {
          query = query.where('assignedTo', '==', filters.assignedTo);
        }
      }

      if (filters.participants) {
        query = query.where('participants', 'array-contains', filters.participants);
      }

      // Ordenar
      const sortBy = filters.sortBy || 'lastMessageAt';
      const sortOrder = filters.sortOrder || 'desc';
      query = query.orderBy(sortBy, sortOrder);

      // Paginación
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.cursor) {
        query = query.startAfter(filters.cursor);
      }

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    } catch (error) {
      logger.error('Error obteniendo conversaciones:', error);
      throw error;
    }
  }

  /**
   * Obtener conversación por ID
   */
  static async getConversationById(id) {
    try {
      // 🔍 LOGGING MEJORADO PARA DEBUG
      logger.debug('ConversationService.getConversationById - Iniciando consulta', {
        conversationId: id,
        timestamp: new Date().toISOString()
      });

      const doc = await firestore.collection('conversations').doc(id).get();
      
      // 🔧 SOLUCIÓN SEGURA: Verificación completa del documento
      if (!doc || !doc.exists) {
        logger.warn('Conversación no encontrada en Firestore', { 
          conversationId: id,
          docExists: doc?.exists,
          docType: typeof doc
        });
        return null;
      }

      // 🔍 DEBUGGING: Logging del documento obtenido
      logger.debug('Documento de Firestore obtenido', {
        conversationId: id,
        docId: doc.id,
        docExists: doc.exists,
        hasData: !!doc.data(),
        dataKeys: Object.keys(doc.data() || {})
      });

      const conversationData = {
        id: doc.id,
        ...doc.data()
      };

      // ✅ SINCRONIZAR INFORMACIÓN DEL CONTACTO SI ES NECESARIO
      if (conversationData.contact && conversationData.contact.profileName) {
        // Asegurar que el nombre se use correctamente
        conversationData.contact.name = conversationData.contact.profileName;
      } else if (conversationData.customerName && conversationData.customerPhone) {
        // Si no hay contact.profileName pero sí hay customerName, crear estructura de contacto
        conversationData.contact = {
          id: conversationData.customerPhone,
          name: conversationData.customerName,
          profileName: conversationData.customerName,
          phoneNumber: conversationData.customerPhone,
          waId: null,
          hasProfilePhoto: false,
          avatar: null,
          channel: 'whatsapp',
          lastSeen: conversationData.lastMessageAt
        };
      }

      logger.info('Conversación obtenida exitosamente', {
        conversationId: id,
        hasData: !!conversationData,
        dataKeys: Object.keys(conversationData)
      });

      return conversationData;

    } catch (error) {
      logger.error('Error obteniendo conversación de Firestore', {
        conversationId: id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Crear nueva conversación
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

      const conversationRef = firestore.collection('conversations').doc(conversation.id);
      
      // 🔧 NUEVO: Crear la conversación y la subcolección messages en una transacción
      await firestore.runTransaction(async (transaction) => {
        // Crear el documento de conversación
        transaction.set(conversationRef, conversation);
        
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

      logger.info('✅ Conversación creada exitosamente con subcolección messages', {
        conversationId: conversation.id,
        customerPhone: conversation.customerPhone,
        participants: conversation.participants,
        createdBy: conversationData.createdBy,
        hasMessagesSubcollection: true
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
   * Actualizar conversación
   */
  static async updateConversation(id, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: FieldValue.serverTimestamp()
      };

      await firestore.collection('conversations').doc(id).update(updateData);
      
      return this.getConversationById(id);

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