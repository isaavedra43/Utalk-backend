/**
 * 💬 MODELO DE CONVERSACIÓN - NUEVA ESTRUCTURA ÚNICAMENTE
 * 
 * Maneja conversaciones en la estructura contacts/{contactId}/conversations
 * ELIMINA todos los métodos que usaban la colección 'conversations' antigua
 * 
 * @version 2.0.0 - Solo nueva estructura
 * @author Backend Team
 */

const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const logger = require('../utils/logger');
const { prepareForFirestore } = require('../utils/firestore');
const { isValidConversationId } = require('../utils/conversation');
const { ensureConversationAssignment } = require('../utils/agentAssignment');
const { safeDateToISOString } = require('../utils/dateHelpers');

class Conversation {
  constructor(data = {}) {
    // 🔧 CRÍTICO: Estructura EMAIL-FIRST con IDs únicos
    this.id = data.id;
    this.customerPhone = data.customerPhone;
    this.customerName = data.customerName || null;
    this.status = data.status || 'open';
    this.priority = data.priority || 'normal';
    this.assignedTo = data.assignedTo || null; // EMAIL del agente
    this.participants = Array.isArray(data.participants) ? data.participants : [];
    this.tags = Array.isArray(data.tags) ? data.tags : [];
    this.metadata = data.metadata || {};
    
    // Estadísticas de mensajes
    this.messageCount = data.messageCount || 0;
    this.unreadCount = data.unreadCount || 0;
    this.lastMessage = data.lastMessage || null;
    this.lastMessageAt = data.lastMessageAt || null;
    
    // Campos de tenant/workspace
    this.workspaceId = data.workspaceId || 'default_workspace';
    this.tenantId = data.tenantId || 'default_tenant';
    
    // 🔧 NUEVO: Campos adicionales
    this.createdBy = data.createdBy || null; // EMAIL del creador
    this.assignedAt = data.assignedAt || null;
    this.lastReadBy = data.lastReadBy || null;
    this.lastReadAt = data.lastReadAt || null;
    
    // Timestamps
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
  }

  /**
   * 📧 HELPER: Asegurar que participants sea un array de emails únicamente
   * Elimina teléfonos y mantiene solo emails válidos
   */
  static ensureParticipantsArray(customerPhone, agentEmail, additionalEmails = []) {
    const emails = new Set();
    
    // Agregar agente si es email válido
    if (agentEmail && agentEmail.includes('@')) {
      emails.add(agentEmail.toLowerCase());
    }
    
    // Agregar emails adicionales válidos
    if (Array.isArray(additionalEmails)) {
      additionalEmails.forEach(email => {
        if (email && typeof email === 'string' && email.includes('@')) {
          emails.add(email.toLowerCase());
        }
      });
    }
    
    const result = Array.from(emails);
    
    logger.info('🔧 Participants array procesado (EMAIL-ONLY)', {
      customerPhone: customerPhone ? customerPhone.substring(0, 10) + '...' : null,
      agentEmail: agentEmail ? agentEmail.substring(0, 10) + '...' : null,
      additionalCount: additionalEmails.length,
      finalParticipants: result.length,
      finalEmails: result.map(e => e.substring(0, 10) + '...')
    });
    
    return result;
  }

  /**
   * 🗑️ MÉTODOS OBSOLETOS ELIMINADOS - Usar ConversationsRepository y ConversationService en su lugar
   */
  static async findOrCreate(customerPhone, agentEmail = null) {
    throw new Error('Conversation.findOrCreate() OBSOLETO - Usar ConversationsRepository en su lugar');
  }

  static async findOpenByCustomerPhone(customerPhone) {
    throw new Error('Conversation.findOpenByCustomerPhone() OBSOLETO - Usar ConversationService.getConversations() en su lugar');
  }

  async save() {
    throw new Error('Conversation.save() OBSOLETO - Usar ConversationsRepository en su lugar');
  }

  async saveWithMessagesSubcollection() {
    throw new Error('Conversation.saveWithMessagesSubcollection() OBSOLETO - Usar ConversationsRepository en su lugar');
  }

  static async getById(id) {
    throw new Error('Conversation.getById() OBSOLETO - Usar ConversationService.getConversationById() en su lugar');
  }

  static async list(options = {}) {
    throw new Error('Conversation.list() OBSOLETO - Usar ConversationService.getConversations() en su lugar');
  }

  async update(updates) {
    throw new Error('Conversation.update() OBSOLETO - Usar ConversationService.updateConversation() en su lugar');
  }

  static async getStats(agentEmail, period, conversationId) {
    throw new Error('Conversation.getStats() OBSOLETO - Usar ConversationsRepository para estadísticas en su lugar');
  }

  static async create(conversationData) {
    throw new Error('Conversation.create() OBSOLETO - Usar ConversationService.createConversation() en su lugar');
  }

  static async searchInUserConversations(searchOptions) {
    throw new Error('Conversation.searchInUserConversations() OBSOLETO - Usar ConversationService.getConversations() en su lugar');
  }

  /**
   * ✅ MÉTODOS PERMITIDOS - Solo para serialización y validación
   */
  toJSON() {
    return {
      id: this.id,
      customerPhone: this.customerPhone,
      customerName: this.customerName,
      status: this.status,
      priority: this.priority,
      assignedTo: this.assignedTo,
      participants: this.participants,
      tags: this.tags,
      metadata: this.metadata,
      messageCount: this.messageCount,
      unreadCount: this.unreadCount,
      lastMessage: this.lastMessage,
      lastMessageAt: safeDateToISOString(this.lastMessageAt),
      workspaceId: this.workspaceId,
      tenantId: this.tenantId,
      createdBy: this.createdBy,
      assignedAt: safeDateToISOString(this.assignedAt),
      lastReadBy: this.lastReadBy,
      lastReadAt: safeDateToISOString(this.lastReadAt),
      createdAt: safeDateToISOString(this.createdAt),
      updatedAt: safeDateToISOString(this.updatedAt)
    };
  }

  isValid() {
    return !!(
      this.id &&
      this.customerPhone &&
      this.status &&
      Array.isArray(this.participants)
    );
  }

  isOpen() {
    return this.status === 'open';
  }

  isClosed() {
    return this.status === 'closed';
  }

  isPending() {
    return this.status === 'pending';
  }

  isAssigned() {
    return !!this.assignedTo;
  }

  hasUnreadMessages() {
    return this.unreadCount > 0;
  }

  /**
   * 🔧 MÉTODOS CRÍTICOS FALTANTES - Implementados para compatibilidad
   */

  /**
   * Marcar todos los mensajes como leídos
   */
  async markAllAsRead(userEmail) {
    try {
      const { getConversationsRepository } = require('../repositories/ConversationsRepository');
      const conversationsRepo = getConversationsRepository();
      
      // Marcar conversación como leída
      await conversationsRepo.markAsRead(this.id, userEmail);
      
      // Actualizar instancia local
      this.unreadCount = 0;
      this.lastReadBy = userEmail;
      this.lastReadAt = new Date();
      
      logger.info('✅ Todos los mensajes marcados como leídos', {
        conversationId: this.id,
        userEmail,
        method: 'Conversation.markAllAsRead'
      });
      
      return this.unreadCount; // Retorna 0 para compatibilidad

    } catch (error) {
      logger.error('❌ Error marcando mensajes como leídos', {
        conversationId: this.id,
        userEmail,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Asignar conversación a un agente
   */
  async assignTo(agentEmail, agentName = null) {
    try {
      const ConversationService = require('../services/ConversationService');
      
      // Actualizar conversación usando ConversationService
      const updatedConversation = await ConversationService.updateConversation(this.id, {
        assignedTo: agentEmail,
        assignedAt: new Date()
      });
      
      // Actualizar instancia local
      this.assignedTo = agentEmail;
      this.assignedAt = new Date();
      
      logger.info('✅ Conversación asignada', {
      conversationId: this.id,
        agentEmail,
        agentName,
        method: 'Conversation.assignTo'
      });
      
      return updatedConversation;
      
          } catch (error) {
      logger.error('❌ Error asignando conversación', {
        conversationId: this.id,
        agentEmail,
        agentName,
              error: error.message
      });
      throw error;
    }
  }

  /**
   * Actualizar último mensaje (compatibilidad)
   */
  async updateLastMessage(messageData) {
    try {
      const { getConversationsRepository } = require('../repositories/ConversationsRepository');
      const conversationsRepo = getConversationsRepository();
      
      await conversationsRepo.updateLastMessage(this.id, messageData);
      
      // Actualizar instancia local
      this.lastMessage = {
        id: messageData.id,
        content: messageData.content,
        timestamp: messageData.timestamp,
        direction: messageData.direction,
        type: messageData.type,
        senderIdentifier: messageData.senderIdentifier
      };
      this.lastMessageAt = messageData.timestamp;
      this.updatedAt = new Date();
      
      logger.info('✅ Último mensaje actualizado', {
        conversationId: this.id,
        messageId: messageData.id,
        method: 'Conversation.updateLastMessage'
      });
      
    } catch (error) {
      logger.error('❌ Error actualizando último mensaje', {
        conversationId: this.id,
        messageId: messageData.id,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = Conversation;
